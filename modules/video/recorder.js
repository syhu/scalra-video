/*
	Recorder Module:	to provide recording capability in SR.Video
	
	will rely on: 
		SR.Settings.INTERVAL_VIDEO_RECORDING	
*/

// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};

var l_name = 'SR.Video.Record';
var l_filePath = SR.Settings.VIDEO_PATH;
var l_fileType = SR.Settings.VIDEO_EXT;

var l_dbSegment = 'Segments';
var l_dbRecording = 'Recordings';
var l_dbStreamGroup = 'StreamGroups';


// obtain recording interval (in minutes)
var l_recordInterval = SR.Settings.INTERVAL_VIDEO_RECORDING = 1;

// gain access to recorded segments
var l_segments = SR.State.get('SR.Video.segments');

// gain access to stream objects
var l_streamObjects = SR.State.get('SR.Video.streamObjects');

// gain access to recording records
var l_recordings = SR.State.get(l_dbRecording, 'array');

// gain access to recording groups
var l_groups = SR.State.get(l_dbStreamGroup, 'array');

// auto-recording (like car recorder.. delete beyond a certain period of time) 
// currently we delete old files beyond one hour
var l_autoDelTime =  5 * 60 * 1000; //  now Time  - _autoDelTime ;  假如  start < _autoDelTime  Delete

//
// Main recording-related functions
//

//var l_ffrec = require('./ffmpeg_recorder.js');

//
//	streamObj:	'object'		(stream object containing source rtsp url or 'stdin')
//	vid:		'string'		(video id)
//
var l_createRecorder = function (streamObj, vid) {
		
	var source = streamObj.source;	
	var filepath = l_filePath + vid;
	
	// ensure directory exists for this particular stream to record	
	UTIL.validatePath(filepath);

	// build file name
	var fid = parseInt(UTIL.getDateTimeString(), 10);

	LOG.warn('l_createRecorder called for source: ' + source + ' vid: ' + vid + ' fid: ' + fid, l_name);
	
	var recorder = streamObj.recorder;
	
	if (!recorder) {
		LOG.error('recorder object missing for vid: ' + vid, l_name);
		return undefined;
	}
	
	recorder.attach({
		method: 'file', 
		dir: filepath, 
		filename_prefix: fid
	});
	
	// call this when everything is done
	recorder.on('segment_start', function (file) {
		l_onRecordSegmentStart(vid, file.name);
	});
	
	recorder.on('segment_end', function (file) {
		l_onRecordSegmentEnd(vid, file.name);
	});
		
	return recorder;		
}

var l_onRecordSegmentStart = function (vid, fid, onDone) {

	// init basic data
	var info = {
		fid: fid,
		start: (new Date()).getTime(),
	};

	//LOG.warn('onRecordSegmentStart, l_segments keys:');
	//LOG.warn(Object.keys(l_segments));
	
	if (l_segments.hasOwnProperty(vid) === false) {
		l_segments.add(l_createSegment(vid, info), function (err, record) {
			
			if (err) {
				LOG.error(err, l_name);	
			}
			
			LOG.warn('after adding new record', l_name);
			for (var vid in l_segments) {
				var obj = l_segments[vid];
				if (typeof obj !== 'object')
					continue;
				
				LOG.warn('[' + vid + '] segments:', l_name);
				LOG.warn(obj.segments, l_name);
			}
			UTIL.safeCall(onDone, err, record);
		});
	} else {
		// otherwise simply add a new segment info to it
		var obj = l_segments[vid];
		obj.segments.curr.push(info);
		obj.sync(onDone);
	}
};


// close up a segment with additional info
var l_closeSegment = function (vid, fid, onDone) {

	var errmsg = '';
	
	var obj = l_segments[vid];
	if (!obj || typeof obj.segments !== 'object' || obj.segments.curr.length === 0) {
		errmsg = '[' + vid + '] no segment info found';
		return UTIL.safeCall(onDone, errmsg);
	} 
	
	var segments = obj.segments;
	var vid = obj.vid;

	// find file info based on fid & record its position index in segments.curr
	var info = undefined;
	for (var i = 0; i < segments.curr.length; i++) {
		if (segments.curr[i].fid === fid) {
			info = segments.curr[i];
			break;
		}
	}
	if (!info) {
		return UTIL.safeCall(onDone, 'segment info not found for fid: ' + fid);
	}
			
	// record file size
	var path = SR.Video.Record.getRecordedFilePath(vid, fid);
	SR.fs.stat(path, function (err, stats) {
		if (err) {
			LOG.error(err, l_name);
			return UTIL.safeCall(onDone, err);
		}
		
		LOG.warn('[' + vid + '/' + fid + '] saved w/size: ' + stats.size, l_name);
		info['size'] = stats.size;
		info['end'] = stats.mtime.getTime();
		
		// if this stream is recording we'll keep the segment
		info['to_del'] = !(obj.recording === true);

		LOG.sys('storing end segment info:', l_name);
		LOG.sys(info, l_name);
	
		// remove from current
		// NOTE: need to scan again as there's no guarantee segments.curr isn't changed after fs.stat operation
		//segments.curr.splice(index, 1);	
		for (var i = 0; i < segments.curr.length; i++) {
			if (segments.curr[i].fid === fid) {
				segments.curr.splice(i, 1);	
				break;
			}
		}
	
		// store to done
		segments.done.push(info);	
		obj.sync(onDone);
	});
}

// what to do when a piece of recording is done
var l_onRecordSegmentEnd = function (vid, fid, onDone) {
	
	LOG.sys('l_onRecordSegmentEnd.. closing: ' + vid, l_name);
	l_closeSegment(vid, fid, onDone);
}

// handle unfinished segment info after server restart
var l_closeupSegments = function (onDone) {
		
	for (var vid in l_segments) {
		
		if (typeof l_segments[vid] !== 'object')
			continue;
		
		var curr = l_segments[vid].segments.curr;
		
		// extract unclosed fid and close them one by one
		for (var i=0; i < curr.length; i++) {
			l_closeSegment(vid, curr[i].fid, function (err) {
				if (err) {
					LOG.error(err);
				}
			});
		}
	}
	UTIL.safeCall(onDone, null);
}



// clear obsolete recordings, defined as "outdated" segments whose 'to_del' flag is true
var l_clearRecording = exports.clearRecording = function (before_now, onDone) {
	
	//require('fs').appendFile('/tmp/clearRecording.txt', vid + '\n');

	if (typeof before_now === 'function') {
		onDone = before_now;
		before_now = undefined;
	}

	var time = (new Date()).getTime();
	var deleteTime = time - (before_now === true ? 0 : l_autoDelTime);	
	var remove_total = 0;
	
	// cleanup for all streams
	for (var vid in l_segments) {
			
		var record = l_segments[vid];

		// if nothing to remove
		if (typeof record !== 'object' || record.segments.done.length === 0)
			continue;
		
		// NOTE: segments is an array
		var segments = record.segments.done;
		
		// go through each recorded file record and see if they need to be removed
		// NOTE: after removal, the record won't exist on either memory or DB (as DB is being updated)
		// should we keep the record nevertheless? (at least in DB?)
		var remove_list = [];
		var remove_index = [];
		
		// NOTE: we go from back to front, so segment info can be removed later correctly
		for (var i = segments.length-1; i >= 0; i--) {
			var info = segments[i];
			if (info['to_del'] && info['start'] < deleteTime) {
				remove_list.push(info['fid']);

				// NOTE: store index first and don't remove it (remove only later if file deletion is successful)
				remove_index.push(i);
			}
		}

		// if nothing to remove
		if (remove_list.length === 0)
			continue;
		
		remove_total += remove_list.length;
		
		for (var i=0; i < remove_list.length; i++) {
			var filepath = SR.Video.Record.getRecordedFilePath(vid, remove_list[i]);
			LOG.sys('removing file: ' + vid + '/' + remove_list[i], l_name);

			// right now we update index record regardless remove is success or failure
			// as files may disappear for other reasons (HD onFull deletion)
			// TODO: should only remove if successful?
			segments.splice(remove_index[i], 1);
			
			// TODO: one case is files are deleted manually or no longer exist
			//		 on HD, perhaps should remove those records in DB at once?
			// 		 to avoid continuous error message every time trying to remove obsolete files
			SR.fs.unlink(filepath, function (err, result) {
				if (err) {
					LOG.error('file remove failed: ', l_name);
					LOG.error(err, l_name);					
				}
			});
		}
		
		// update DB after everything updated successfully
		record.sync(function (err) {
			if (err) 
				LOG.error(err, l_name);
		});		
	}
	
	// return total number of files attempting to remove
	UTIL.safeCall(onDone, null, remove_total);
}

// get a list of fileIDs for a given vid between certain time
var l_getRecordedFiles = function (vid, start, end, onDone) {

	// NOTE: currently we get it from memory, may need to get it from DB if it's too large
	if (l_segments.hasOwnProperty(vid) === false) {
		return UTIL.safeCall(onDone, 'vid invalid');	
	}
	
	var segments = l_segments[vid].segments.done;
	var result = [];

	for (var i=0; i < segments.length; i++) {
		
		// overlap test:
		// (StartA <= EndB)  and  (EndA >= StartB)
		if (start <= segments[i].end && end >= segments[i].start)
			result.push(segments[i]);
	}
	
	var confirmed = {};
	var valid_count = 0;
	
	// check if the supposedly recorded files exist on file system
	// NOTE: we assume the records stored in memory are ordered by creation time
	//		 (that is, the oldest files are at the beginning)
	var checkjob = function (info) {
		return function (onD) {
			
			// check validity of files on system
			var path = SR.Video.Record.getRecordedFilePath(vid, info.fid);
			UTIL.validateFile(path, function (result) {
				// file exists
				if (result)
					valid_count++;				
				confirmed[info.start] = {fid: info.fid, start: info.start, end: info.end, status: result};
				onD(true);
			});
		};
	}

	// check each potential file by using a JobQueue
	var jq = SR.JobQueue.createQueue();
	
	for (var i=0; i < result.length; i++) {
		jq.add(checkjob(result[i]), false);
	}
	
	// last job to return results
	jq.add(function (onAllDone) {
		LOG.warn('getRecordedFiles found ' + valid_count + '/' + Object.keys(confirmed).length + ' files valid for vid: ' + vid, l_name);		
		UTIL.safeCall(onDone, null, confirmed);
		onAllDone(true);
	});
	
	jq.run();
}


function CRecord() {};

// start recording by vid
CRecord.prototype.start = function (vid, onDone) {

	//SR.fs.appendFile('/tmp/del_pre-rec.txt', 'CRecord.prototype.start1: ' + vid + '\n' );
	var obj = SR.Video.Stream.getStreamByVID(vid);
	if (!obj) 
		return UTIL.safeCall(onDone, "stream cannot be found for vid: " + vid);

	var streamObj = l_streamObjects[vid];

	if (!streamObj)
		return UTIL.safeCall(onDone, "SR.Video.Record.start cannot find streamObj for vid: " + vid + ", stream may not have inited");
						
	var recorder = l_createRecorder(streamObj, vid);
	
	if (recorder)
		UTIL.safeCall(onDone, null, recorder);
	else
		UTIL.safeCall(onDone, 'invalid recorder for vid: ' + vid);


	//
	// KMS-specific recording procedure
	//
	
	// var filePath = SR.Video.Record.getRecordedFilePath(vid, fid); 	
	// var uri = "file://" + filePath;	
	// LOG.warn('creating RecorderEndPoint for: ' + uri, l_name);

	// var pipeline = streamObj.pipeline;
	// var player = streamObj.player;

	// //		'mediaProfile': "MP4_VIDEO_ONLY"
	// pipeline.create("RecorderEndpoint", {
			// 'uri': uri
		// },
		// function (error, recorder) {
			// if (error) {
				// return UTIL.safeCall(onDone, error);
			// }
			
			// // start recording
			// LOG.warn('RecorderEndPoint create success, start to record...', l_name);
			
			// // start recorder
			// player.connect(recorder, function (err) {
				// if (err) {
					// return UTIL.safeCall(onDone, err);
				// }
				// LOG.warn('player connecting to recorder success for: ' + uri, l_name);
				// recorder.record(function (err) {
					// if (err) {
						// return UTIL.safeCall(onDone, err);
					// }
					
					// LOG.warn('recorder starts success for: ' + uri, l_name);
					// streamObj.recorder = recorder;
					// l_onRecordSegmentStart(vid, onDone);
				// });
			// });
		// }
	// );
	

};

// stop recording by vid
CRecord.prototype.stop = function (vid, onDone) {

	var obj = SR.Video.Stream.getStreamByVID(vid);
	if (!obj)
		return UTIL.safeCall(onDone, "SR.Video.Record.stop not Find Stream by VID = " + vid);

	var streamObj = l_streamObjects[vid];
	if (!streamObj) 
		return UTIL.safeCall(onDone, "SR.Video.Record.stop not Have steamObj  by VID =" + vid + ", check  stream status. ");
	
	var recorder = streamObj.recorder;
	if (!recorder)
		return UTIL.safeCall(onDone, 'SR.Video.Record.stop recorder does not exist for vid: ' + vid);

	LOG.warn('stopping recorder for [' + vid + ']...', l_name);
	recorder.detach({method: 'file'});
			
	// stop ffmpeg-based recorder
	// TODO: stop KMS-based recorder?
	UTIL.safeCall(onDone);
		
	//
	// KMS-specific
	//
	// close last completed recording
	// recorder.stop(
		// function (err) {
			// if (err) {
				// LOG.error(err, l_name);	
			// }
			
			// LOG.warn('recorder for [' + vid + '] stopped, releaseing RecorderEndpoint...', l_name);
			// recorder.release();	
			// delete streamObj.recorder;

			// l_onRecordSegmentEnd(vid, onDone);			
		// }
	// );
	
};

// write to stdin (for DVR)  { 'streamID': streamID, 'data': data, 'encode': 'binary' }
CRecord.prototype.stdin = function (obj) {
	
	if (l_streamObjects.hasOwnProperty(obj.vid) === false)
		return;
	
	var streamObj = l_streamObjects[obj.vid];			
	if (streamObj.recorder)
		streamObj.recorder.stdinWrite(obj.data, obj.encode);
};

// set path for recorded files
CRecord.prototype.setFilePath = function (vid, path, onDone) {
	LOG.error('obsolete function: setOneRecorderFilePath', l_name);
	LOG.stack();	
	UTIL.safeCall(onDone);
};

CRecord.prototype.setAllFilePath = function (path, onDone) {
	LOG.error('ignore request to change default recording path for now. default path: ' + l_filePath, l_name);
	LOG.error('requested path: ' + path, l_name);
	LOG.stack();
	UTIL.safeCall(onDone);
};

// get filepath for a given recorded file
CRecord.prototype.getRecordedFilePath = function (vid, fid) {
	if (!vid || !fid || vid === 'undefined' || fid === 'undefined') 
		return undefined;
	return l_filePath + vid + '/' + fid + l_fileType;
}

//	NOTE: the mechanism will try to clean up the oldest existing recording first, regardless of streams
//			(that is, any IPcam or DVR's recording can be erased), until the amount of empty space needed
//			(specified in MB) is achieved. However, for each stream, a minimal of X minutes of recordings
//			will be kept (as specified in the 'keep' parameter). For example, if {keep: 10}, that means
//			each stream will have a minimal of 10 minutes of recording that won't be erased.

//	args: {
//		empty:	'number',		// amount of space needed to be left empty (in MB)
//		keep:	'number'		// minimal number of minutes of recording that should be kept for a given stream
//	}
	
//	example usage:
//		SR.Video.Recorder.onFull({
//				empty: 1000,
//				keep: 10
//			}, function (results) {
//				
//			});	
// clean up code when HD is full

CRecord.prototype.onFull = function (args, onDone) {
	
	// set default space required to be 3G, files to keep to be 10 minutes
	args = args || {};
	args.empty = args.empty || 3000;
	args.keep = args.keep || 10;
	
	// go through each stream (vid) in a round-robin fashion (sequentially) and remove the oldest file while 
	// taking count
	// steps:
	//		1. get currently available space
	//		2. traverse existing files and keep erasing oldest file(s) until enough space becomes available
	//			a. check if this stream has the minimal amount of seconds left
	//		3. remove those files & update DB

	var onMarkedFilesCleared = function () {
	
		//LOG.warn('=============================================================', l_name);
		//LOG.warn('all marked files are cleared, checking space availability...', l_name);
		// step1: check remaining space
		
		// required empty space in bytes
		var required_space = args.empty * 1000000;
		//LOG.warn('required space: ' + required_space + ' bytes', l_name);
		//LOG.warn('path: ' + SR.Settings.VIDEO_PATH, l_name);
		
		SR.Standalone.isEnoughDiskSpace({
			path: SR.Settings.VIDEO_PATH,
			B: required_space,
			onDone: function (err, enough, remaining) {
				if (err) {
					LOG.error(err, l_name);
					return;
				}	

				if (enough) {
					LOG.sys('enough space is left (required: ' + required_space + ' bytes)', l_name);
					return;
				}
				
				// NOTE: remaining space is expressed in bytes
				LOG.warn('required (bytes): ' + required_space, l_name);
				LOG.warn('missing  (bytes): ' + remaining, l_name);
								
				// step2: mark files to be deleted
				var found = true;
				var round = 0;
				var deleted_size = 0;
				
				// NOTE: our policy is to delete from oldest, so first put all records into one big object
				// sorting is done automatically as we insert into object
				var sorted = {};
				
				// number of segments that should be kept at a minimal to ensure the 'keep' minutes
				var to_keep = (typeof args.keep === 'number' ? Math.ceil(args.keep / SR.Settings.INTERVAL_VIDEO_RECORDING) : 1);
				LOG.warn('minimally we keep: ' + to_keep + ' minutes for each stream', l_name);

				for (var vid in l_segments) {
					var segments = l_segments[vid].segments.done;

					// if this vid does not have enough recording segments to delete, skip it
					if (segments.length <= to_keep)
						continue;

					var size = segments.length - to_keep;

					// store segments sorted by start time, from the newest up to the ones to keep					
					// map version
					//for (var fid in segments) {
					//	var start = segments[fid].start;
					//	sorted[start] = segments[fid];
					//	if (--size === 0)
					//		break;
					//}
					
					// array version
					for (var i=0; i < size; i++) {
						var start = segments[i].start;
						sorted[start] = segments[i];
					}
				}
				
				LOG.warn('sorted list of files to be deleted:', l_name);
				LOG.warn(sorted, l_name);
				
				// go through each and check whether to delete
				for (var start_time in sorted) {

					// mark this segment for deletion & check if size goal is reached
					// NOTE: changes in memory are not stored to DB until in next step when removal is performed
					sorted[start_time].to_del = true;
					deleted_size += sorted[start_time].size;
					
					// check if space we removed match the required amount
					if (deleted_size + remaining > 0) {
						LOG.warn('delete_size reach requirement: ' + deleted_size);
						break;
					}
				}
					
				// step3: remove those files
				LOG.warn('ready to remove files to make space. expected space released: ' + deleted_size, l_name);
				l_clearRecording(true, function (err, num_deleted) {
					LOG.warn('try to remove a total of: ' + num_deleted + ' files', l_name);
				});
			}
		});	
	
	} // end onMarkedFilesCleared
	
	onMarkedFilesCleared();	
}



//=======================================================================================================
//
//	Playback handling code
//	previously RecordPlayback.js

function CRecordPlayback() {};

// search by record date
CRecordPlayback.prototype.searchDate = function (data, onDone, onFail) {
	
	//data = 
	//{
	//	'iDate':日期(年月),
	//}
	//201507
	//20150730235959
	var that = this;
	var l_iBin = data.iDate * 100000000;
	var l_iEnd = ((data.iDate + 1) * 100000000);
	LOG.warn("CRecordPlayback::searchDate() l_iBin = " + l_iBin + "  l_iEnd = " + l_iEnd);
	//取得資料(>= , <)
	SR.DB.getArray(l_dbRecording, 
		function (logAr) {
			//過濾資料
			var l_obj = {
				'iRecordDateAr': [],
				'strEventAr': []
			};
			//有無錄影陣列	EX:[1,3,4,20]  1,3,4,20號 當天有錄影
			var l_iLoopDay = 1;
			while (l_iLoopDay <= 31) {
				var l_iLoopLog = 0;
				while (l_iLoopLog < logAr.length) {
					// check if this record's start day matches the current search day (l_iLoopDay)
					var l_time = new AeDate(logAr[l_iLoopLog].start);
					if (l_time.iDate == l_iLoopDay) //搜尋日
					{
						// avoid redundancy
						if (l_obj.iRecordDateAr.indexOf(l_iLoopDay) == -1) //沒東西
							l_obj.iRecordDateAr.push(l_iLoopDay);
					}
					// store event types but also avoid redundancy
					if (l_obj.strEventAr.indexOf(logAr[l_iLoopLog].type) == -1) //沒東西
						l_obj.strEventAr.push(logAr[l_iLoopLog].type);
					++l_iLoopLog;
				}
				++l_iLoopDay;
			}
			onDone(l_obj);
		}, onFail,
		{
			'start': {
				"$gte": l_iBin,
				"$lt": l_iEnd
			}
		});
};

// search by device with conditions
CRecordPlayback.prototype.searchRecordDevice = function (data, onDone, onFail) {
	
	//data = 
	//{
	//	'start':日期(年月日 EX:20150701),
	//	'end':日期(年月日 EX:20150701),
	//	'strEventAr':	事件陣列(事件索引陣列)
	//}
	var that = this;
	var l_iBin = data.start * 1000000;
	var l_iEnd = (data.end + 1) * 1000000;
	LOG.warn("CRecordPlayback::searchRecordDevice() l_iBin = " + l_iBin + "  l_iEnd = " + l_iEnd);
	var l_objEvent = {
		"$in": data.strEventAr
	};
	LOG.warn("CRecordPlayback::searchRecordDevice l_objEvent" + l_objEvent);
	//取得資料(>= , <)
	SR.DB.getArray(l_dbRecording, 
		function (logAr) {
			LOG.warn("CRecordPlayback::searchRecordDevice. Record size: " + logAr.length);
			if (logAr.length == 0) {
				LOG.warn("CRecordPlayback::searchRecordDevice() logAr 沒有錄影資料 !! ");
				onDone(null);
				return;
			}
			//過濾資料
			var l_deviceAr = [];
			var l_iLoopLog = 0;
			while (l_iLoopLog < logAr.length) {
				var l_iLoopEvent = 0;
				while (l_iLoopEvent < data.strEventAr.length) {
					if (logAr[l_iLoopLog].type == data.strEventAr[l_iLoopEvent]) {
						if (l_deviceAr.indexOf(logAr[l_iLoopLog].device) == -1) //沒東西
							l_deviceAr.push(logAr[l_iLoopLog].device);
					}
					++l_iLoopEvent;
				}
				++l_iLoopLog;
			}
			onDone(l_deviceAr);
		}, onFail,
		{
			'start': {
				"$gte": l_iBin,
				"$lt": l_iEnd
			},
			'type': l_objEvent
		});
};

// get record log for a given device
CRecordPlayback.prototype.getRecordLog = function (data, onDone, onFail) {
	
	//data = 
	//{
	//'start':日期(年月日 EX:20150701),
	//'end':日期(年月日 EX:20150701),
	//'device':攝影機名稱,
	//}
	LOG.warn('RecordPlayback query input:', 'SR.Video.Playback');
	LOG.warn(data, 'SR.Video.Playback');
	
	var that = this;
	var l_iBin = data.start * 1000000;
	var l_iEnd = (data.end + 1) * 1000000; // add one more day
	LOG.warn("CRecordPlayback::getRecordLog() l_iBin = " + l_iBin + "  l_iEnd = " + l_iEnd);

	
	//取得資料 開始(>= , <)  結束 != 0
	SR.DB.getArray(l_dbRecording, 
		function (logAr) {
			if (logAr.length == 0) {
				LOG.warn("CRecordPlayback::getRecordLog() logAr 沒有錄影資料 !! ");
				onDone(null);
				return;
			}
			
			// pass back only specific info
			var result = [];
			
			for (var i=0; i < logAr.length; i++) {
				LOG.warn(logAr[i]);
				
				var entry = {
					start: 	logAr[i].start,
					end: 	logAr[i].end,
					device: logAr[i].device,
					vid:	logAr[i].vid,
					type: 	logAr[i].type
				};
				// force making it current
				if (entry.end === 0 && logAr[i].now)
					entry.end = logAr[i].now;
			
				LOG.warn('entry', l_name);
				LOG.warn(entry);
				
				result.push(entry);
			}
			onDone(result);
			
		},
		onFail, 
		{
			'start': {
				"$gte": l_iBin,
				"$lt": l_iEnd
			},
		// NOTE: we do not care about end time
		//	'end': {
		//		"$ne": 0
		//	},
			'device': data.device
		}
	);
	
};


SR.Video.Record = new CRecord();
SR.Video.Playback = new CRecordPlayback();


//
// playback handlers
//

// input:
// 	{"iDate":201605}
// 
//	return:
//	{
//		'iRecordDateAr': [],
//		'strEventAr': []
//	};
// find which days (1 ~ 31) have recordings & what type of events exist (TODO: should move elsewhere)
l_handlers.SearchDate = function (event) {

	event.done({
		'objReturn': {
			'iRecordDateAr': [],
			'strEventAr': ['schedule']
		}
	});
	
	// //event.data = 
	// //{
	// //	'iDate':日期(年月),
	// //}
	// //201507
	// //20150730235959
	// LOG.warn("handlerRecordPlayback::SearchDate data");
	// LOG.warn(event.data);
	
	// SR.Video.Playback.searchDate(event.data,
		// function (data) {
			// LOG.warn("handlerRecordPlayback::SearchDate data" + data);
			// //回傳
			// event.done("SearchDate", {
				// 'objReturn': data
			// });
		// },
		// function () {
			// LOG.error("handlerRecordPlayback::SearchDate() 失敗! ");
			// event.done("SearchDate", {
				// 'objReturn': null
			// });
		// });
};

// get a list (array) of stream vid within a query period
SR.API.add('Recording_QueryStreams', {
	start:	'number',
	end:	'number'
}, function (args, onDone) {
	
	// convert from AeDate to timestamp
	// TODO: client to send in timestamp directly	
	var start = (new AeDate(args.start * 1000000)).getTimestamp();
	var end = (new AeDate((args.end+1) * 1000000)).getTimestamp();	
		
	LOG.warn('timestamp start: ' + start + ' end: ' + end);
	
	// go over all recordings to find matches
	var now = (new Date()).getTime();
	
	var result = {};
	for (var i=0; i < l_recordings.length; i++) {
		var record = l_recordings[i];
		
		// NOTE: if this is a currently on-going recording, we'll use 'now' as its end-time
		if (record.end === 0)
			record.end = now;
		
		LOG.warn('[' + record.vid + '] begin: ' + record.begin + ' end: ' + record.end);
		// overlap test:
		// (StartA <= EndB)  and  (EndA >= StartB)
		if (start <= record.end && end >= record.begin)
			result[record.vid] = true;

		// restore back
		if (record.end === now)
			record.end = 0;		
	}
	
	// NOTE: return format should be in array form
	onDone(null, Object.keys(result));
});

// get a list (array) of stream vid within a query period
SR.API.add('Recording_QueryRecords', {
	start:	'number',
	end:	'number',
	vid:	'string'
}, function (args, onDone) {
	
	// convert from AeDate to timestamp
	// TODO: client to send in timestamp directly	
	var start = (new AeDate(args.start * 1000000)).getTimestamp();
	var end = (new AeDate((args.end+1) * 1000000)).getTimestamp();	
	LOG.warn('timestamp start: ' + start + ' end: ' + end);
	
	var vid = args.vid;
	
	// go over all recordings to find matches
	var now = (new Date()).getTime();
	
	var result = [];
	
	for (var i=0; i < l_recordings.length; i++) {
		var record = l_recordings[i];
		if (record.vid !== vid)
			continue;
		
		// NOTE: if this is a currently on-going recording, we'll use 'now' as its end-time
		if (record.end === 0)
			record.end = now;
		
		LOG.warn('[' + record.vid + '] begin: ' + record.begin + ' end: ' + record.end);
		// overlap test:
		// (StartA <= EndB)  and  (EndA >= StartB)
		if (start <= record.end && end >= record.begin) {
			result.push({
				start: 	record.begin,
				end: 	record.end,
				vid:	vid,
				type: 	record.type
			});
		}

		// restore back
		if (record.end === now)
			record.end = 0;		
	}
	
	// NOTE: return format should be in array form
	onDone(null, result);
});

// search for matching streams during a search period
// NOTE: this is made obsolete by Recording_QueryStreams
l_handlers.SearchRecordDevice = function (event) {
	
	var data = event.data;
	
	// convert from AeDate to timestamp
	// TODO: client to send in timestamp directly	
	var start_time = new AeDate(data.start * 1000000);
	var end_time = new AeDate((data.end+1) * 1000000);	
	
	LOG.warn(start_time);
	LOG.warn(end_time);
	
	var start = start_time.getTimestamp();
	var end = end_time.getTimestamp();
	LOG.warn('timestamp start: ' + start + ' end: ' + end);
	
	// go over all recordings to find matches
	var now = (new Date()).getTime();
	
	var result = {};
	for (var i=0; i < l_recordings.length; i++) {
		var record = l_recordings[i];
		
		// NOTE: if this is a currently on-going recording, we'll use 'now' as its end-time
		if (record.end === 0)
			record.end = now;
		
		LOG.warn('[' + record.vid + '] begin: ' + record.begin + ' end: ' + record.end);
		// overlap test:
		// (StartA <= EndB)  and  (EndA >= StartB)
		if (start <= record.end && end >= record.begin)
			result[record.vid] = true;
		
		if (record.end === now)
			record.end = 0;		
	}
	
	// NOTE: return format is array form
	event.done({
		'objReturn': Object.keys(result)
	});
	
	//i_data = 
	//{
	//	'start':日期(年月日 EX:20150701),
	//	'end':日期(年月日 EX:20150701),
	//	'strEventAr':	事件陣列(事件索引陣列)
	//}
	// var data = event.data;
	// LOG.warn("handlerRecordPlayback::SearchRecordDevice data" + data);
	// //------------------------------------------------------------
	// SR.Video.Playback.searchRecordDevice(data,
		// function (data) {
			// LOG.warn("handlerRecordPlayback::SearchRecordDevice data" + data);
			// //回傳
			// event.done("SearchRecordDevice", {
				// 'objReturn': data
			// });
		// },
		// function () {
			// LOG.error("handlerRecordPlayback::SearchRecordDevice() 失敗! ");
			// event.done("SearchRecordDevice", {
				// 'objReturn': null
			// });
		// });
};

// NOTE: this is made obsolete by Recording_QueryRecords
// get the recording log between a duration date, for a given vid
l_handlers.GetRecordLog = function (event) {

	var data = event.data;
	
	// convert from AeDate to timestamp
	var start_time = new AeDate(data.start * 1000000);
	var end_time = new AeDate((data.end+1) * 1000000);	
	
	LOG.warn(start_time);
	LOG.warn(end_time);
	
	var start = start_time.getTimestamp();
	var end = end_time.getTimestamp();
	LOG.warn('timestamp start: ' + start + ' end: ' + end);
	var vid = data.vid;
		
	// go over all recordings to find matches
	var result = [];
	var now = (new Date()).getTime();
	for (var i=0; i < l_recordings.length; i++) {
		var record = l_recordings[i];

		// NOTE: if this is a currently on-going recording, we'll use 'now' as its end-time
		if (record.end === 0)
			record.end = now;		
		
		LOG.warn('start: ' + record.begin + ' end: ' + record.end);
		// overlap test:
		// (StartA <= EndB)  and  (EndA >= StartB)
		if (start <= record.end && end >= record.begin) {
			result.push({
				start: 	record.begin,
				end: 	record.end,
				vid:	vid,
				type: 	record.type
			});
		}
		
		if (record.end === now)
			record.end = 0;			
	}

	event.done({'objReturn': result});
			
	//event.data = 
	//{
	//	'start':日期(年月日 EX:20150701),
	//	'end':日期(年月日 EX:20150701),
	//	'device':攝影機名稱,
	//}
	// LOG.warn("handlerRecordPlayback::GetRecordLog data:");
	// LOG.warn(event.data);
	
	// //------------------------------------------------------------
	// SR.Video.Playback.getRecordLog(event.data,
		// function (data) {
			// LOG.warn("handlerRecordPlayback::GetRecordLog data", l_name);
			// LOG.warn(data, l_name);
			
			// //回傳
			// event.done("GetRecordLog", {
				// 'objReturn': data
			// });
		// },
		// function () {
			// LOG.error("handlerRecordPlayback::GetRecordLog() 失敗! ");
			// event.done("GetRecordLog", {
				// 'objReturn': null
			// });
		// });
};

// get an id array for a given vid record (for replay purpose)
SR.API.add('Recording_GetSegments', {
	start:	'number',
	end:	'number',
	vid:	'string'
}, function (args, onDone) {

	l_getRecordedFiles(args.vid, args.start, args.end, function (err, list) {
		if (err) {
			return onDone(err);
		}
		
		onDone(null, list);
	});
});

//event.data = {
//	start: 	'number', 
//	end: 	'number',
//	vid:	'string'
//};

// get an id array for a given vid record (for replay purpose)
// NOTE: replaced by Recording_GetSegments
l_handlers.GetRecordFiles = function (event) {
	
	var data = event.data;
	
	// convert from AeDate to timestamp
	//var start_time = new AeDate(data.start);
	//var end_time = new AeDate(data.end);

	//l_getRecordedFiles(data.vid, start_time.getTimestamp(), end_time.getTimestamp(), function (err, list) {
	l_getRecordedFiles(data.vid, data.start, data.end, function (err, list) {
		if (err) {
			return event.done({err: err});
		}
		
		event.done({err: 0, data: list});
	});
}

// module init
l_module.start = function (config, onDone) {

	LOG.warn('recorder module started...', l_name);	
	
	// how long to check HD is full (default to 1 minute)
	var check_interval = (typeof config.check_interval === 'number' ? config.check_interval : 1);
	
	// perform onFull check
	setInterval(function () {
		// this will keep clearing pre-recorded videos
		l_clearRecording(function (err, num_deleted) {
			if (num_deleted > 0) {
				LOG.warn('remove ' + num_deleted + ' files total', l_name);
			}
		});
		
		// this will check disk space and try to remove even recorded (kept) videos if space is not enough
		SR.Video.Record.onFull();
		
	}, 1000 * 60 * check_interval);
	
	// store setting for how long each recording segment should be
	if (typeof config.record_interval === 'number') {
		LOG.warn('videos will be recorded as ' + config.record_interval + ' minute blocks', l_name);
		l_recordInterval = config.record_interval;
	}
	UTIL.safeCall(onDone);
}

// module shutdown
l_module.stop = function (onDone) {		
	UTIL.safeCall(onDone);
}

	//
	// KMS-specific recording mechanism (for backup purpose
	//
	
	// var vid;
	// var date = new Date();
	// var min = date.getMinutes();
	// var sec = date.getSeconds();

	// // check whether to start record
	// if ((min + 1) % l_recordInterval === 0 && sec == 59) {

		// // 全部串流 啟動 錄影
		// for (index in l_streamInfo) {
			// obj = l_streamInfo[index];
			// vid = obj.vid;
 
			// SR.Video.Record.start(vid, function (err, obj) {
				// if (err) {
					// LOG.error(err, l_name);
				// }
			// });
		// }
	// } 

	// // whether to stop recording
	// if ((min % l_recordInterval) === 0 && sec === 1) {

		// for (index in l_streamInfo) {
			// obj = l_streamInfo[index];
			// vid = obj.vid;

			// l_stopRecorder(vid, function (err, obj) {
				// if (err) {
					// LOG.error(err, l_name);
				// }
			// });
		// }
	// }


//
//	group management for streams
//

// build a StreamGroup info object with default values (to be stored into DB)
var l_createStreamGroup = function (name) {
	return {
		id:			UTIL.createUUID(),		// unique group id
		name:		name,					// group name
		streams: 	{}, 					// vid
		config: 	{
			rewrite:	true,				// whether to rewrite when full
			voice:		false,				// whether to record voice
			prerecord:	5,					// number of seconds to pre-record in motion recording
			schedule:	[]					// recording schedule record_type (0: empty, 1: schedule, 2: motion)
		}
	};
}

// build a Segment object with default values (to be stored into DB)
var l_createSegment = function (vid, info) {
	var data = {
		vid:		vid,		// unique stream id
		recording:  false,		// default to not recording
		segments: 	{			// info on each segment recorded
			curr: 	[],			// currently in-progress segments
			done:	[]			// segments already closed
		}
	};
	data.segments.curr.push(info);
	return data;
}

SR.DS.init({
	models: {
		'Segments': {
			vid:		'string',		// unique vid for stream
			recording:	'boolean',		// whether this stream is in 'record' mode (keeping its segments)
			segments:	'object',		// segment info (curr & done)
		},
		'Recordings': {
			vid: 		'string',		// id for the stream being recorded
			begin:		'number',		// timestamp when the recording starts
			end: 		'number',		// timestamp when the recording ends
			//now: 		'number',		// timestamp of last valid segment in this recording
			type: 		'string',		// what kind of trigger ['schedule' | 'motion'] 
			//done: 		'boolean'		// whether the recording is finished
		},
		'StreamGroups': {
			id:			'string',
			name:		'string',
			streams:	'object',		// collection of vid (storing in map form)
			config:		'object'		// config for the streaming group including schedule settings
		}
	},
	caches: {
		'Segments': {
			key: 'vid',
			map: l_segments		
		}
	}
}, function (err) {
	if (err) {
		LOG.error(err, l_name);	
	}
	
	// NOTE: l_segments is a map with 'add' and 'remove' functions
	LOG.warn('l_segments inited with size: ' + (Object.keys(l_segments).length - 2), l_name);	
	LOG.warn('l_groups inited with size: ' + l_groups.length, l_name);
	LOG.warn('l_recordings inited with size: ' + l_recordings.length, l_name);
	
	// make sure all segments are closed properly
	l_closeupSegments();
});

// create a new group
SR.API.add('SR_VIDEO_STREAMGROUP_CREATE', {
	name: 'string'		// group name
}, function (args, onDone) {
	
	// TODO: use promise to chain callbacks?
	SR.DS.get({
		name: 'StreamGroups'
	}, function (err, arr) {
		if (err) {
			return UTIL.safeCall(onDone, err);	
		}

		// check for duplicate group creation
		for (var i=0; i < arr.length; i++) {
			if (arr[i].name === args.name) {
				return UTIL.safeCall(onDone, 'stream group [' + args.name + '] already exists!');	
			}
		}

		// add to datastore
		arr.add(l_createStreamGroup(args.name), function (err) {
			UTIL.safeCall(onDone, err, (err ? undefined : 'group [' + args.name + '] created'));
		});
	});
	
});

// remove an existing group
SR.API.add('SR_VIDEO_STREAMGROUP_DESTROY', {
	id: 'string'		// group id
}, function (args, onDone) {
	
	// TODO: use promise to chain callbacks?
	SR.DS.get({
		name: 'StreamGroups'
	}, function (err, arr) {
		if (err) {
			return UTIL.safeCall(onDone, err);	
		}

		// remove from datastore
		arr.remove({id: args.id}, function (err) {
			UTIL.safeCall(onDone, err, (err ? undefined : 'group [' + args.id + '] removed'));
		});
	});
});

// list properties under the group, types can be an array such as ['streams', 'config']
SR.API.add('SR_VIDEO_STREAMGROUP_LIST', {
	types: 	'+array',		// list of types to be selected
	id:		'+string'		// optional parameter (indicated by '+')
}, function (args, onDone) {
	
	// add required fields to result to be selected
	if (!args.types) {
		args.types = [];	
	}
	var select = args.types.concat(['id', 'name']);
	
	SR.DS.get({
		name: 'StreamGroups',
		query: {
			id: args.id		// optionally will query only those matching the 'id'	
		},
		select: select		// we're only interested in certain fields to be returned
	}, onDone);
});


// 'is_delete' indicates to remove an item
// 'is_list' indicates whether the value should be stored in a non-redundent list
// generic add/update/remove certain field (type) in a record
var l_updateRecord = function (args, onDone) {

	LOG.warn('l_updateRecord args:', l_name);
	LOG.warn(args, l_name);
		
	SR.DS.get({
		name: args.name,
		query: {
			id: args.id
		}
	}, function (err, obj) {
		if (err) {
			return UTIL.safeCall(onDone, err);	
		}

		//
		// to add or update
		//
		
		// by default we simply update the array/object/string values or erase it
		var value = args.value;
		
		// if it's a list, then there's special processing
		if (args.is_list === true && typeof args.value === 'string') {

			// first copy existing key/value pairs
			// NOTE: this is very important step as otherwise simply assigning new values won't update it successfully
			value = {};
			for (var key in obj[args.type]) {
				value[key] = obj[args.type][key];	
			}
			
			// add or remove entry to the list
			if (args.is_delete === true) {
				delete value[args.value];
				
				// NOTE: below won't work, we NEED to create an empty {} for updating content
				//delete obj[args.type][args.value];
			} else {
				value[args.value] = true;				
			}
		}

		// update value
		// NOTE: this can in fact be an add / remove of a single item or a list
		obj[args.type] = value;
		
		// sync back to DB
		// NOTE: callback MUST be provided to work properly
		obj.save(function (err) {
			UTIL.safeCall(onDone, err, (err ? undefined : '[' + args.type + '] data update success'));
		});
	});
}							   

// add 'streams' to a StreamGroup, type can be: 'streams'
SR.API.add('SR_VIDEO_STREAMGROUP_ADD', {
	id:		'string',
	type:	'string',	// type of property to store
	value:  ['array', 'object', 'string']
}, function (args, onDone) {
	
	args.name = 'StreamGroups';
	args.is_delete = false;
	args.is_list = true;
	l_updateRecord(args, onDone);
	
});

// remove 'streams' from a StreamGroup, type can be: streams
SR.API.add('SR_VIDEO_STREAMGROUP_REMOVE', {
	id:		'string',
	type:	'string',	// type of property to remove item
	value:  ['array', 'object', 'string']
}, function (args, onDone) {

	args.name = 'StreamGroups';
	args.is_delete = true;
	args.is_list = true;
	l_updateRecord(args, onDone);
});

// type can be: 'name'
// generic update to key/value pairs
SR.API.add('SR_VIDEO_STREAMGROUP_UPDATE', {
	id:		'string',
	type:	'string',	// type of property
	value:  ['array', 'object', 'string']
}, function (args, onDone) {

	args.name = 'StreamGroups';
	args.is_delete = false;
	args.is_list = false;
	l_updateRecord(args, onDone);	
});
