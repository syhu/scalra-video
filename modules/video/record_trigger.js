

/*
	record_trigger.js
	
	periodic checking to turn on/off recording for streams based on recording schedule
	
	history:		2016-04-21	first version


	basic steps:
	
		(when server starts)
		v init periodic checking (per minute)
		for each unclosed recording session
			check for last valid segment and reduce recording period accordingly
			mark recording session as closed
	
		(at each check)
		for each recording group 
			if (should be recording)
				if not recording then start (for each streams)
			else	
				if already recording then turn off (for each stream)

		(for each stream in a active recording group)
		to turn on recording:
			turn its to_del flag to false in 'streams'
			init a recording record (with start timestamp)
		
		to turn off recording:
			turn its to_del flag on
			close a recording record (with definite start/stop timestamp)
				
		(when querying for recording records)	
		when returning recording record for a given session
			for each segment within the recording period
				if (segment is missing)
					record the interval as 'missing intervals'
*/


// module object
var l_module = exports.module = {};
var l_name = 'record_trigger';

// how long to check (in seconds), default to: 60
var l_checkInterval = 5;

// how big is a slot (in seconds)
var l_slotInterval = 30 * 60;

var l_groups = SR.State.get('StreamGroups', 'array');
var l_recordings = SR.State.get('Recordings', 'array');
var l_segments = SR.State.get('SR.Video.segments');

// recording states
var l_recording_states = ['unknown', 'none', 'schedule', 'motion'];

// start recording session for a set of streams 
// streams: an array of vid for the streams to be recorded
// type: one of the values in l_recording_states
var l_turnonRecording = function (streams, type) {
	
	if (streams instanceof Array === false || typeof type !== 'string') {
		return LOG.error('l_turnonRecording para error', l_name);
	}
	
	// nothing to turn on
	if (streams.length === 0) {
		return;
	}
	
	//LOG.warn('recording should be on for:', l_name);
	//LOG.warn(streams, l_name);
	
	for (var i in streams) {
		var vid = streams[i];		
		var obj = l_segments[vid];

		if (!obj) {
			// NOTE: if no prerecording is done, it's possible nothing can be found here
			LOG.sys('segment info cannot be found for vid [' + vid + ']', l_name);
			continue;
		}
				
		// turn on recording mode or update mode info
		if (obj.recording === false) {
			l_openRecording(vid, type);	
		}
	}
}

// end recording session for a set of streams 
// streams: an array of vid for the streams to be stopped
var l_turnoffRecording = function (streams) {
	
	if (streams instanceof Array === false || streams.length === 0) {
		return LOG.error('l_turnoffRecording para error', l_name);
	}
	
	for (var i in streams) {
		var vid = streams[i];
		
		var obj = l_segments[vid];

		if (!obj) {
			// NOTE: it's possible that if no pre-recording has been done yet
			// l_segments won't have any valid records, so this check will fail 
			// in normal conditions
			LOG.sys('segment info cannot be found for vid [' + vid + ']', l_name);
			continue;
		}
		
		// turn on recording mode or update mode info
		if (obj.recording === true) {		
		
			l_closeRecording(vid, function (err) {
				if (err) {
					LOG.error(err, l_name);
				}
			});		
		}
	}
}


// periodic checking whether to start/stop recording
var l_checkTrigger = function () {
	
	// check if l_groups has been inited
	if (l_groups instanceof Array !== true)
		return;
	
	var names = '';
	
	// determine current timelot
	var slot = l_getCurrentTimeSlot(l_slotInterval, 7);

	// build a list for streams that should be on at this moment
	// NOTE: we use map for onlist as it's possible that multiple recording groups
	// may contain the same streams set for recording
	var onlist = {};

	// check each recording group
	for (var i=0; i < l_groups.length; i++) {
		var group = l_groups[i];
		names += ('[' + group.name + '] ');
		
		if (group.config.schedule instanceof Array === false || group.config.schedule.length === 0) {
			continue;	
		}
		
		// assemble the schedule
		var schedule = group.config.schedule;
		var arr = [];
		
		// TODO: make schedule into 1D array
		for (var i=0; i < schedule.length; i++) {
			for (var j=0; j < schedule[i].length; j++) {
				arr.push(schedule[i][j]);	
			}
		}
		// should be: 2 * 24 * 7 = 336
		//LOG.warn('arr length: ' + arr.length + ' slot: ' + slot + ' flag in slot: ' + arr[slot]);
		var on = (l_recording_states[arr[slot]] === 'schedule');
		
		if (on) {
			for (var vid in group.streams) {
				onlist[vid] = true;
 			}
		}
	}
	
	// go through all currently known streams and build off stream list
	// NOTE: if it's not on then it should be off
	// NOTE: the reason we have offlist is so that if a stream is just added or removed
	// from a stream group, we may still correctly to start/stop its recording status
	var offlist = [];
	for (var vid in l_segments) {
		if (onlist.hasOwnProperty(vid) === false)
			offlist.push(vid);
	}

	// perform actual on/off actions
	l_turnonRecording(Object.keys(onlist), 'schedule');

	// need to turn off recording
	l_turnoffRecording(offlist);

	//LOG.warn('check triggers for ' + l_groups.length + ' recording groups: ' + names, l_name);	
}

// find out which 'slots' given an interval period in seconds
var l_getCurrentTimeSlot = function (interval, days) {
	
	// how many days to count totally
	days = days || 7;
	
	var now = new Date();
	
	// total number of seconds in duration
	var duration_insec = (60 * 60 * 24 * days);	
	
	// how many time slots in total
	var total_slots = duration_insec / interval;
	
	// calculate seconds within the week	
	var seconds = now.getDay() * (60*60*24) + now.getHours() * (60*60) + now.getSeconds();
	
	// calculate current slot
	var slot = Math.floor(seconds / interval);
	
	//LOG.warn('getDay: ' + now.getDay());	
	//LOG.warn('seconds: ' + seconds + ' interval: ' + interval + ' slot_index: ' + slot + ' total_slot: ' + total_slots);
	
	return slot;
}

// open a new recording record
var l_openRecording = function (vid, type, onDone) {
	
	LOG.warn('start recording for [' + vid + ']', l_name);
	var now = (new Date()).getTime();
	
	// create new record
	l_recordings.add({
		vid: 		vid,
		begin:		now,			// timestamp when the recording starts
		end: 		0,				// timestamp when the recording ends
		type: 		type,			// what kind of trigger ['schedule' | 'motion'] 		
	}, function (err) {
		if (err) { 
			return UTIL.safeCall(onDone, err);
		}

		// try to find the last valid segment for this recording session
		if (l_segments.hasOwnProperty(vid) === false) {
			return UTIL.safeCall(onDone, '[' + vid + '] segment info not found');
		}
		
		var obj = l_segments[vid];		
		obj.recording = true;
		obj.sync(onDone);
	});
}

// close a given recording based on the end time of its last valid segment
var l_closeRecording = function (vid, onDone) {

	LOG.warn('close recording for [' + vid + ']', l_name);
	
	// try to find the last valid segment for this recording session
	if (l_segments.hasOwnProperty(vid) === false) {
		return UTIL.safeCall(onDone, '[' + vid + '] segment info not found');
	}
	
	// check if we've got recording records
	if (l_recordings.length === 0) {
		return UTIL.safeCall(onDone, '[' + vid + '] recording records not found');
	}
		
	// get the recording data
	// NOTE: we go from end to front as the unclosed recording is likely at the end (newest inserted)
	LOG.warn('go over recordings... length: ' + l_recordings.length, l_name);
	
	for (var i=l_recordings.length-1; i >=0 ; i--) {
		
		var record = l_recordings[i];
		if (record.end === 0 && record.vid === vid) {
						
			// get end time of last segment for this stream
			LOG.warn('try to get end time of last valid segment for [' + vid + ']', l_name);			
			var segments = l_segments[vid].segments.done;
			
			if (segments.length === 0) {
				return UTIL.safeCall(onDone, 'no closed segments found for vid [' + vid + ']');
			}
			
			record.end = segments[segments.length-1].end;
			// check for special case if end < start 
			// this happens if a recording session is very short (shorter than the segment duration)
			if (record.end < record.begin) {
				record.end = (new Date()).getTime();
			}
			
			record.sync(function (err) {
				// also mark an end to current recording sessions
				l_segments[vid].recording = false;
				l_segments[vid].sync(onDone);			
			});
			
			// we assume only one unclosed recording exists for a stream
			return;
		}
	}
	
	// this should not happen
	UTIL.safeCall(onDone, 'cannot find recordings for vid [' + vid + ']');
}

// close all existing unclosed recordings
var l_closeRecordings = function (onDone) {

	// record all unclosed stream's vid
	var unclosed = [];

	// check all streams marked with being active in recording and change its flag
	// NOTE: we store to an array first so we can have an idea of how many streams need to be closed in total
	for (var i in l_segments) {
		if (typeof l_segments[i] !== 'object')
			continue;
		
		if (l_segments[i].recording === true) {
			unclosed.push(l_segments[i].vid);
		}
	}

	LOG.warn('total unclosed streams: ' + unclosed.length, l_name);
	if (unclosed.length === 0) {
		return UTIL.safeCall(onDone, null);
	}
	
	var counter = 0;
	var errmsg = [];
	for (var i=0; i < unclosed.length; i++) {
		l_closeRecording(unclosed[i], function (err) {
			if (err) {
				LOG.error(err, l_name);
				errmsg.push(err);
			}
			// check if we're all done
			if (++counter === unclosed.length) {
				UTIL.safeCall(onDone, (errmsg.length === 0 ? null : errmsg));
			}
		});
	}
}


// module init
l_module.start = function (config, onDone) {	

	// wait a little till all in-memory caches are loaded
	// TODO: find a more exact way? as load time can vary due to different data loads
	setTimeout(function () {
		l_closeRecordings(function (err) {
			if (err) {
				LOG.error(err, l_name);
			}
			
			// start recording checks only AFTER we've closed all previous recordings
			setInterval(l_checkTrigger, l_checkInterval * 1000);
		});
		
	}, 2000);
	
	UTIL.safeCall(onDone);
}

// module shutdown
l_module.stop = function (onDone) {
	UTIL.safeCall(onDone);
}
