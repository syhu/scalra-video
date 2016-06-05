
// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};

var l_name = 'SR.Video.Stream';

// generic recorder capable of taking stdin & rtsp input, output to: file, broadway, kurento
var l_ffrec = require('./ffmpeg_recorder.js');

// allocator for ffserver resources
var l_ffserverAllocation = new UTIL.Allocate(20);

//
// adjustable settings
//

var l_dbName = "Streams";
SR.DB.useCollections([l_dbName]);

var l_dbLoaded = false;

// info on each stream (persist to DB)
//var l_streamInfo = [];
var l_streamInfo = SR.State.get('SR.Video.streamInfo', 'array');

// gain access to stream objects
var l_streamObjects = SR.State.get('SR.Video.streamObjects');

// mapping from connID to a list of streamIDs associated with this connection
var l_conn2streamID = {};

// mapping from vid to streamID, indexed by vid, then by streamID
var l_vid2streamID = {};


//
// helpers
//

// create a unique streamID
var l_getStreamID = function (vid, connID) {
	return vid + ':' + connID;
}

// extract vid from streamID
var l_getVID = function (streamID) {
	try {
		return streamID.split(':')[0];
	} catch (e) {
		LOG.error(e, l_name);
		return undefined;
	}
}

var l_loadDB = function (onDone) {
				
	try {
		SR.DB.getData(l_dbName, {}, function (obj) {
						  
			if (obj && obj['streamInfo']) {
				for (var i=0; i < obj['streamInfo'].length; i++) {
					l_streamInfo.push(obj['streamInfo'][i]);
				}
			} 
			
			l_dbLoaded = true;
			LOG.warn('----------------------------------------------------------', l_name);
			LOG.warn('DB loaded successfully', l_name);
			UTIL.safeCall(onDone);
		}, function (err) {
			LOG.error(err, l_name);
			UTIL.safeCall(onDone, err);
		});			
	} catch (err) {
		LOG.error(err, l_name);
		UTIL.safeCall(onDone, err);
	}
}

// save states to DB
// NOTE: right now we just dump everything to DB (very inefficient)
// TODO: incremental save
var l_saveDB = exports.saveDB = function (onDone) {

	try {
		SR.DB.updateData(l_dbName, {}, {
				streamInfo:	l_streamInfo
			},
			function (obj) {
				LOG.sys('saved to DB [' + l_dbName + '] success', l_name);
				UTIL.safeCall(onDone);
			},
			function (err) {
				UTIL.safeCall(onDone, err);
				LOG.error(err, l_name);
			}
		);
	} 
	catch (e) {
		UTIL.safeCall(onDone, e);
		LOG.error(e, l_name);
	}
}

// provide default callback 
var l_onSysNotify = function (obj) {
	SR.Video.Stream.onSystemEvent(obj);
};

// re-connect all devices
var l_reconnectDevices = function () {

	LOG.warn('l_reconnectDevices', l_name);
	
	// restore each individual stream
	for (var index in l_streamInfo) {
		l_streamInfo[index]['state'] = null;
		SR.Video.Stream.enable(l_streamInfo[index].vid,
			function (err, obj) {
				if (err) {
					LOG.error(err, l_name);
					l_onSysNotify({
						type: "l_reconnectDevices_Error",
						data: err
					});
					return;
				}
				LOG.warn('reconnect to [' + obj.type + '] success. vid: ' + obj.vid, l_name);
			});
	}
}

// TODO: need to include (or remove) usage of AeDate object

//
// define main stream functions 
//
function CStream() {};

// init different streaming pipelines (KMS, Broadway)
CStream.prototype.init = function (onDone) {
};
// add a new stream source
//	args: {
//		type: 'string',			// ['IPCAM', 'DVR']
//		url:  'string',			// ex. "rtsp://163.22.32.62/live1.sdp", "stdin://DVR-channel-0-high", "stdin://DVR-channel-0-low"
//		pipeline: 'string'  	// ['Kurento', 'Broadway'] (default: 'Kurento')
//		recording: 'boolean' 	// [true, false] (default: true)
//		resolution: 'string'  //['High', 'Low']
//	}
//	returns basic stream info in l_streamInfo

CStream.prototype.new = function (args, onDone) {
	
	//  create a new stream and store into l_streamInfo
	if (!l_dbLoaded)
		return UTIL.safeCall(onDone, "SR.Video.Stream.new DB not yet loaded, please wait");
	
	// basic info
	var obj = undefined;
	
	// assume if it's a string only then it's IPcam's url
	if (typeof(args) === "string") {
		obj = {
			url: args,
			type: "IPCAM"
		};
	}
	else
		obj = args;
		
	// check for invalid object
	if (typeof(obj) !== "object" || typeof obj.type !== 'string' || typeof obj.url !== 'string')
		return UTIL.safeCall(onDone, 'invalid input when creating stream');
		
	// ensure no spaces around URL
	obj.url = obj.url.trim();
		
	// check for redundancy (based on URL) with existing streams
	// TODO: treat lower/upper case the same?
	for (var i=0; i < l_streamInfo.length; i++) {
		if (l_streamInfo[i].type === obj.type && l_streamInfo[i].url === obj.url) {
			LOG.warn('stream already exists, type: ' + obj.type + ' url: ' + obj.url, l_name);
			return UTIL.safeCall(onDone, undefined, l_streamInfo[i]);
		}
	}
	
	// set recording option (default: true)
	obj.recording = (typeof obj.recording === 'boolean' ? obj.recording : true);
	
	// set pipeline (default to Kurento)
	obj.pipeline = args.pipeline || 'Kurento';
	
	// create & store a unique id (vid)
	obj.vid = UTIL.createUUID();

	// store the new stream args 
	LOG.warn('creating new stream: ', l_name);
	LOG.warn(obj, l_name);
	l_streamInfo.push(obj);
	
	l_saveDB(function () {
		// right now we automatically enable the stream
		// TODO: should allow app server to enable?
		SR.Video.Stream.enable(obj.vid, onDone);	
	});
};

// remove a stream source
CStream.prototype.delete = function (vid, onDone) {
	
	// perform disable first
	this.disable(vid, function () {
	
		// clear stream info (also from DB)
		for (var i=0; i < l_streamInfo.length; i++) {
			if (l_streamInfo[i].vid === vid) {
				
				LOG.warn('deleting stream: ', l_name);
				LOG.warn(l_streamInfo[i], l_name);
				
				delete l_streamInfo[i];
				l_streamInfo.splice(i, 1);
				l_saveDB(onDone);
				return;
			}
		}
		UTIL.safeCall(onDone, "invalid vid: " + vid);
	});
};

// get stream info object by vid
CStream.prototype.getStreamByVID = function (vid) {
	for (var i=0; i < l_streamInfo.length; i++)
		if (l_streamInfo[i].vid === vid)
			return l_streamInfo[i];
	return null;
}

// connect with the streaming source (will start recording but not live-view)
// assumes the stream was previously 'new' already
// returns a stream info object (success) or error message (failure)
// NOTE: return value is NOT streamObj
CStream.prototype.enable = function (vid, onDone) {

	LOG.warn("enabling stream, vid: " + vid, l_name);
	
	// check if vid is valid
	var obj = this.getStreamByVID(vid);
	if (!obj)
		return UTIL.safeCall(onDone, 'Error: invalid vid: ' + vid);


	// return existing stream info if already created
	if (l_streamObjects.hasOwnProperty(vid) && l_streamObjects[vid].recorder) {
		LOG.warn('device already enabled or enabling, no need to connect for vid: ' + vid, l_name);
		return UTIL.safeCall(onDone, null, obj);
	}
	
	// start recorder based based on pipeline type
	var source = obj.url;
	
	// convert stdin
	if (source.startsWith('stdin'))
		source = 'stdin';
	
	//LOG.warn('enable source: ' + source, l_name);
	// TODO: should move recorder creation inside 'recorder.js'
	// create a generic recorder
	var recorder = new l_ffrec({
		rtsp_url: source,
		resolution: obj.resolution,
		video_id: vid,
		//segment_time: l_recordInterval * 60,
		//dir: l_filePath + vid + '/',
		//record: fid,
		//broadway_channel: (broadway ? vid : undefined),
		//ffserver_ffm: undefined
	});
	
	// create new streamObj that pulls stream from a streaming source
	var streamObj = {source: source, recorder: recorder};
	l_streamObjects[vid] = streamObj;
		
	// get notified of various ffmpeg closes
	// type: ['source', 'recorder', 'rtsp', 'broadway']
	recorder.on('close', function (type, exitcode) {
		LOG.warn('ffmpeg has been closed for vid: ' + vid + ' type: ' + type, l_name);
		var now = new Date();
		SR.Notify.alert('name', {
				name: 'name',
				event: 'stream_disconnected',
				msg: {
						event: 'stream_disconnected',
						type: type,
						exitcode: exitcode,
						data: {
								year: now.getFullYear(),
								month: now.getMonth(),
								day: now.getDate(),
								hour: now.getHours(),
								minute: now.getMinutes(),
								second: now.getSeconds(),
						},
						stream_id: vid,
						camera_id: 'unknown',
				},
		}, 'notify');
	
		// mark this stream as no longer enabled
		delete streamObj['recorder'];
		streamObj.enabled = false;
		streamObj.close_type = type;
		streamObj.close_exitcode = exitcode;
			
		// TODO: error handling for other types of ffmpeg exit, or should auto-restart ffmpeg?
	})
	
	LOG.warn('stream [' + vid + '] type: ' + obj.type + ' enabled correctly', l_name);
		
	// everything works correctly
	// set stream info as 'enabled' (meaning getting stream from the device)
	// NOTE: need to turn off enabled when writing to DB as enabled is a temp, in-memory item
	streamObj.enabled = true;
	
	l_saveDB(function () {
		UTIL.safeCall(onDone, null, obj);	
	});
	
	// check if we want to start recording
	if (obj.recording) {
		
		SR.Video.Record.start(vid, function (error, recorder) {
			if (error) {
				LOG.error(error, l_name);
			}
		});	
	}
	
};

// disconnect from the streaming source (will stop liveview & recording, if any)
CStream.prototype.disable = function (vid, onDone) {

	LOG.warn("disabling stream, vid: " + vid, l_name);
	
	// perform stopping of all streams first
	if (l_vid2streamID.hasOwnProperty(vid)) {
		var streams = l_vid2streamID[vid];
		for (var streamID in streams)
			this.stop(streamID);
		delete l_vid2streamID[vid];
	};

	if (l_streamObjects.hasOwnProperty(vid)) {
		var streamObj = l_streamObjects[vid];
		
		// stop the ffmpeg_recorder
		if (streamObj.recorder) {
			streamObj.recorder.close();
			delete streamObj.recorder;			
		}
		
		// remove stream object
		delete l_streamObjects[vid];				
	};
	
	// mark as disabled
	// NOTE: data in l_streamInfo may be already be removed
	for (var i in l_streamInfo) {
		if (l_streamInfo[i].vid === vid) {		
			l_saveDB();
			break;
		}
	}
	
	UTIL.safeCall(onDone);	
};


// start streaming to client
// assumes args:
//	args: {
//		vid:		'string',
//		data:		'object',		// pipeline-specific data object (e.g., it's an sdpOffer for Kurento)
//		connID:		'string'
//	}

CStream.prototype.start = function (args, onDone) {
		
	var that = this;
	var vid = args.vid;
	var connID = args.connID;
	
	var obj = this.getStreamByVID(vid);
	if (!obj) {
		return UTIL.safeCall(onDone, "streamInfo cannot be found (stream not new?) by vid: " + vid);	
	}
		
	if (l_streamObjects.hasOwnProperty(vid) === false) {
		return UTIL.safeCall(onDone, "streamObj cannot be found (stream not enabled?) by vid: " + vid);
	}
	
	var streamObj = l_streamObjects[vid];
	if (!streamObj.recorder) {
		return UTIL.safeCall(onDone, 'recorder object missing for vid [' + vid + ']');
	}
	
	// create unique server-side streamID (also serve as rtcID for KMS)
	var streamID = l_getStreamID(vid, connID);

	//
	// connect to streaming source
	//

	// once source is connected, return a valid streamID to caller (possibly back to client)
	var onConnected = function (err, result) {

		// NOTE: for DVR onDone is already called and may be invalid here
		// as when enabling DVR streams, we need to return first for application level to start pipe in connector's data
		// before kurento-client can start
		// TODO: find a better, more elegant approach?	

		if (!err) {
			if (l_vid2streamID[vid].hasOwnProperty(streamID) === false) {
				// record vid -> streamID mapping (used when later performing delete)		
				l_vid2streamID[vid][streamID] = result;
				LOG.warn('vid [' + vid + '] stream [' + streamID + '] connected successfully', l_name);
			} else {
				// previously connected, simply get result object
				LOG.warn('vid [' + vid + '] stream [' + streamID + '] already connected', l_name);
				result = l_vid2streamID[vid][streamID];
			}
		}
		
		// NOTE: result here is an sdpAnswer object for Kurento
		UTIL.safeCall(onDone, err, streamID, result, obj);	
	}

	// check whether this is the first start request (init connection to streaming source)
	var connect_source = (l_vid2streamID.hasOwnProperty(vid) === false);
	
	LOG.warn('check whether to connect video source for vid [' + vid + ']: ' + connect_source);
	if (!connect_source) {
		return onConnected();
	}
	
	// create new mapping from vid to streamID
	l_vid2streamID[vid] = {};
			
	if (obj.pipeline === 'Broadway') {
	
		// resolution info for Broadway
		var resolution = undefined;	
	
		// extract resolution info, if available
		if (streamObj.recorder.info) {
			var info = streamObj.recorder.info;
			
			LOG.warn('info for vid [' + vid + ']:', l_name);
			LOG.warn(info, l_name);
			
			try {
				// TODO: should simplify this
				var match = info.video.match("....x....");			
				var resolution_string = match[0];
				LOG.warn(resolution_string.split("x")[0]);
				LOG.warn(resolution_string.split("x")[0].split(" ")[resolution_string.split("x")[0].split(" ").length - 1]);
				resolution = {
					"width": resolution_string.split("x")[0].split(" ")[resolution_string.split("x")[0].split(" ").length - 1],
					"height": resolution_string.split("x")[1].split(",")[0]
				}
			}	
			catch (err) {
				LOG.error(err, l_name);
			}
		}
		
		LOG.warn("pipeline is Broadway, resolution: " + obj.resolution + ' dimension: ' + resolution);
		
		var method = (obj.resolution === 'High' ? 'broadway-high-res' : 'broadway');
		
		// attach to source
		streamObj.recorder.attach({method: method, channel: vid}, function (err) {
			UTIL.safeCall(onConnected, err, resolution);
		});
	}
	else if (obj.pipeline === 'Kurento') {
		
		// 1. attach a rtsp output to recorder's ffmpeg_hub
		var num = l_ffserverAllocation.get(vid) + 1;
				
		if (num === (0)) {
			var err = 'no more DVR channels can be added';
			LOG.error(err, l_name);
			return UTIL.safeCall(onDone, err);
		}
								
		streamObj.recorder.attach({method: 'ffserver', ffm_url: 'http://127.0.0.1:48000/dvr_' + num + '.ffm'}, function (err) {

			// for DVR we return first, to allow DVR connector to pipe data to stdin
			if (obj.type === 'DVR') {
				UTIL.safeCall(onDone);
				onDone = undefined;
			}

			// 2. init KMS's connection to (local) rtsp source
			args.url = 'rtsp://127.0.0.1:48001/dvr_' + num +'.mp4';	
			SR.KMS.connect(args, function () {

				// create a WebRTCEndpoint, will return sdpAnswer object in onConnected callback	
				SR.KMS.start(streamID, args, onConnected);				
			});
		});
	}
	else {
		return UTIL.safeCall(onDone, 'unknown pipeline: ' + obj.pipeline);
	}
};

// stop streaming to client
// TODO: refactor redundant codes?
CStream.prototype.stop = function (streamID, onDone) {

	// lookup vid from streamID
	// TODO: better approach to lookup?
	var vid = l_getVID(streamID);
	
	if (!vid) {
		return UTIL.safeCall(onDone, 'no vid found for streamID: ' + streamID);
	}

	var obj = this.getStreamByVID(vid);

	if (!obj) {
		return UTIL.safeCall(onDone, "streamInfo cannot be found by vid: " + vid);
	}

	if (l_streamObjects.hasOwnProperty(vid) === false) {
		return UTIL.safeCall(onDone, "streamObj cannot be found by vid: " + vid);
	}

	var streamObj = l_streamObjects[vid];
	if (!streamObj.recorder) {
		return UTIL.safeCall(onDone, 'recorder not found for vid: ' + vid);
	}
	
	if (l_vid2streamID.hasOwnProperty(vid) === false) {
		return UTIL.safeCall(onDone, 'client stream list does not exist for vid: ' + vid + ' (likely due to all client streams have stopped)');		
	}
	
	delete l_vid2streamID[vid][streamID];
	var num_streams = Object.keys(l_vid2streamID[vid]).length;
	LOG.warn('stopping stream: ' + streamID + ' vid: ' + vid + ' streams left: ' + num_streams, l_name);		

	if (obj.pipeline === 'Broadway') {
		if (num_streams === 0) {
			delete l_vid2streamID[vid];

			// detach from recorder
			streamObj.recorder.detach({method: 'broadway'});
		}
		UTIL.safeCall(onDone);
	}
	else if (obj.pipeline === 'Kurento') {
	
		// close WebRTCEndpoint
		SR.KMS.stop(streamID, function (err, result) {
			
			if (err) {
				LOG.error(err, l_name);
				return UTIL.safeCall(onDone);
			}
			
			// keep count of whether this is the last to remove, 
			// if so, then we should remove the PlayerEndpoint for KMS
			if (result.size !== 0) {
				return UTIL.safeCall(onDone);
			}
			
			// need to remove this, so next time when performing start, connect() will be called
			delete l_vid2streamID[result.vid];

			SR.KMS.disconnect(result.vid, function () {
				
				// detach from recorder
				streamObj.recorder.detach({method: 'ffserver'});					
				UTIL.safeCall(onDone);
			});							
		});	
	}
};

// pause the current stream
CStream.prototype.pause = function (streamID, onDone) {

	// TODO: make all these into single function
	// lookup vid from streamID
	var vid = l_getVID(streamID);

	if (!vid || l_streamObjects.hasOwnProperty(vid) === false || !l_streamObjects[vid].recorder) {
		return UTIL.safeCall(onDone, 'cannot find valid video object for streamID [' + streamID + ']');
	}
	
	LOG.sys('checking whether to pause/unpause vid: ' + vid);
			
	var recorder = l_streamObjects[vid].recorder;
		
	if (recorder.isPaused() === false) {
		LOG.warn('pausing: ' + vid, l_name);
		recorder.pause();
	} 

	UTIL.safeCall(onDone, null);
}

// unpause the current stream
CStream.prototype.unpause = function (streamID, onDone) {

	// TODO: make all these into single function
	// lookup vid from streamID
	var vid = l_getVID(streamID);

	if (!vid || l_streamObjects.hasOwnProperty(vid) === false || !l_streamObjects[vid].recorder) {
		return UTIL.safeCall(onDone, 'cannot find valid video object for streamID [' + streamID + ']');
	}
	
	LOG.sys('checking whether to pause/unpause vid: ' + vid);
			
	var recorder = l_streamObjects[vid].recorder;
	
	if (recorder.isPaused() === true) {
		LOG.warn('unpausing: ' + vid, l_name);
		recorder.unpause();
	}
	UTIL.safeCall(onDone, null);	
}


// get a list of current streams
CStream.prototype.getList = function (vid) {

	// get all streams if vid is not provided
	if (!vid) {
		return l_streamInfo;
	} 
	
	var returnArr = [];
	var obj = this.getStreamByVID(vid);
	if (obj)
		returnArr.push(obj);
	
	return returnArr;
};

// get a particular given stream info by vid
CStream.prototype.getById = function (vid) {
	return this.getStreamByVID(vid);
};


//觸發用
CStream.prototype.onSystemEvent = function (i_obj) {
	
	//i_obj.type = "名稱還沒定"
	//i_obj.data =  "VID 超過 限制 被砍檔案"   
	
	
	//switch (i_obj.type) {
	//	case "名稱還沒定": //滿碟觸發
	//		console.log(i_obj.data);
			//RecordTrigger.allStop();
	//		break;
	//}
	
	// we just print for now
	//LOG.debug(i_obj, l_name);
};

// write to stdin (for DVR)  { 'vid': 'xxxx', 'data': data, 'encode': 'binary' }
CStream.prototype.stdin = function (i_obj) {
	return SR.Video.Record.stdin(i_obj);
};

const url = require('url');
	
// check if we need to convert a private IP to public one (if different)
CStream.prototype.checkIP = function (publicIP, rtsp) {
	//console.log(rtsp);
	var urlx = url.parse(rtsp);
	var new_rtsp = rtsp.replace(urlx['hostname'],publicIP)
	//console.log("new_rtspXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
	//console.log(new_rtsp);
	return new_rtsp;
	var obj = url.parse(rtsp);
	LOG.warn(obj);
};

var path = require('path');

// FIXME: need a real implementation
// Snapshot for Video Stream
CStream.prototype.snapshot = function (streamID, onDone) {
	var vid = l_getVID(streamID);	// lookup vid from streamID

	if (!vid || l_streamObjects.hasOwnProperty(vid) === false || !l_streamObjects[vid].recorder) {
		return UTIL.safeCall(onDone, 'cannot find valid video object for streamID [' + streamID + ']');
	}
	
	// FIXME: need a real implementation
	var url = 'https://sosmemphis.org/wp-content/uploads/2015/10/door-open.jpg';
	url = UTIL.getServerDomain();
	l_streamObjects[vid].recorder.getSnapshot({}, function (snapshot) {
		if (snapshot.length <=2) {
			return UTIL.safeCall(onDone, 'no valid snapshot now.');
		}
		var snapshot_filename = snapshot[snapshot.length-2];
		var target_dir = path.resolve(path.parse(snapshot_filename)['dir'], '..', 'jpg');
		require('child_process').exec('cp -av ' + snapshot_filename + ' ' + target_dir);
		var target_filename = '' + target_dir + '/' + path.parse(snapshot_filename)['base'];

		url += 'event/download_file?filename=' + target_filename;
		if (typeof onDone === 'function') {
 			UTIL.safeCall(onDone, url)
		}
		return url;
	});
}

l_handlers.download_file = function (event) {
	event.done('SR_RESOURCE', {address: event.data.filename, header: {}});
}

// this is a test handler. feel free to be deleted if there's no problem in CStream.prototype.snapshot.
l_handlers.cp_file = function (event) {
	SR.Video.Stream.snapshot(event.data.streamID, function () {
		event.done({url: arguments});
	});
	return;
}


//
// system-wide init
//

SR.Callback.onStart(function () {
});


//
// make functions public
//
SR.Video.Stream = new CStream();

//
// connection management
//

// remove all streams upon disconnection
SR.Callback.onDisconnect(function (conn) {

	if (l_conn2streamID.hasOwnProperty(conn.connID)) {
		var list = l_conn2streamID[conn.connID];

		for (var streamID in list) {
			SR.Video.Stream.stop(streamID);
		}

		// clear everything
		delete l_conn2streamID[conn.connID];
		l_conn2streamID[conn.connID] = undefined;
	}
});

// 
// handlers
//
// create a new stream
l_handlers.Stream_new = function (event) {
	
	SR.Video.Stream.new(event.data, function (error, o_obj) {
		var errmsg = 0;
		
		if (error) {
			errmsg = "Stream_new  ERROR " + error;
			LOG.error(errmsg);  
		}	
		event.done({error: errmsg, data: o_obj}) ;
	});
}

// remove an existing stream (based on vid)
l_handlers.Stream_delete = function (event) {
	var vid = event.data.vid ;
	SR.Video.Stream.delete(vid, function (err, state) {
		var returnError = 0;
		
		if (err) {
			LOG.error(err, l_name);
			returnError = "Stream_delete ERROR " + err;
		}
		else {
			LOG.warn("Stream_delete vid = " + vid, l_name);
		}
		event.done({error: returnError, state: state}) ;
	});	
}

// start a streaming session from server to client

//	data: {
//		data:	'object',		// 'sdpOffer' for 'KMS'
//		vid: 	'string',
//	}

l_handlers.Stream_start = function (event) {

	// add connID as part of the parameters
	var connID = event.conn.connID;
	event.data.connID = connID;

	// NOTE: streamID is created within the start() method
	// NOTE: l_conn2streamID is handled/maintained here instead of inside the Stream.start API 
	// TODO: move l_conn2streamID handling inside the Stream.start API?
	SR.Video.Stream.start(event.data, function (err, streamID, result, obj) {
		
		if (err) {
			LOG.error(err, l_name);
			return event.done({error: err});
		}
						
		// record connID -> streamID mapping if stream start is successful
		if (l_conn2streamID.hasOwnProperty(connID) === false) {
			l_conn2streamID[connID] = {};
		}
		
		l_conn2streamID[connID][streamID] = event.data.vid;

		// returns a unique streamID to client
		event.done({error: err, streamID: streamID, result: result});		
		
		//
		// check whether to pause all low-res streaming for this connection
		//		
		// NOTE: video obj is passed back in callback, mainly to determine resolution (to decide whether to pause)
		// TODO: should probably remove this logic (allow front-end to do it?)		
		var to_pause = (obj.resolution === 'High');
	
		// loop through all streams associated with this connection			
		var list = l_conn2streamID[connID];
		
		for (var stream_id in list) {
			
			// skip self and pause/unpause all else
			if (stream_id === streamID) {
				continue;
			}

			if (to_pause)
				SR.Video.Stream.pause(stream_id);
			else
				SR.Video.Stream.unpause(stream_id);			
		}
	});
}

// stop a video stream (release server-side resources)
l_handlers.Stream_stop = function (event) {

	// NOTE: the streamID passed in from client is actually a vid
	// TODO: fix client-side parameter to make naming consistent?
	var connID = event.conn.connID;	
	var streamID = l_getStreamID(event.data.streamID, connID);
	
	// remove from l_conn2streamID's list
	if (l_conn2streamID.hasOwnProperty(connID)) {
		var list = l_conn2streamID[connID];
		
		if (list.hasOwnProperty(streamID)) {
			delete list[streamID];
		}
	}	
	
	SR.Video.Stream.stop(streamID, function (result) {
		LOG.warn('Server resource released for streamID: ' + streamID, l_name);	
		event.done({result: result});
	});
}

SR.DB.useCollections('RecordSetting');

l_handlers.test_alert = function (event) {
	event.done();
	return;

	SR.DB.getArray('camera', function(r1){
		//to get camera_id by video_id
		var camera_id = undefined;
		for (var i in r1) {
			if (r1[i]['data']['streamHigh'] === '1A598514-F120-40FF-BCC4-BE549D9F89A5') {
				camera_id = (r1[i]['_id']);
			}
		}		
		console.log(camera_id);
		var group_id = undefined;
		SR.DB.getArray('GroupDevice', function(r2){
			//to get group_id by camera_id
			group_id = r2[0].groupID;
			//console.log(group_id);
			SR.DB.getArray('RecordSetting',function(r3){
				//to get schedule_plan by group_id
				var schedule_plan = (r3[0].iScheduleAr2);
				var now = new Date();
				console.log(now.getDay());
				console.log(now.getHours());
				console.log(now.getMinutes());
				var x = now.getDay();
				var y = now.getHours()*2;
				if (now.getMinutes()>30) y++;
				console.log(schedule_plan[x][y]);
			},function(){},{groupID: group_id});
		},function(){},{device: camera_id})
	}, function(r){},{});
	event.done();
	return;
	var now = new Date();
	SR.Notify.alert('name', 
		{	
			name: 'name', 
			event: "alert", 
			msg: {
				event: 'stream_fail',
				ch: 'ch', 
				data: { 
					time: {
						year: now.getFullYear(),
						month: now.getMonth(),
						day: now.getDate(),
						hour: now.getHours(),
						minute: now.getMinutes(),
						second: now.getSeconds(),
					}
				}
			},
			camera_id: "xxx"
		}, 'notify');
	event.done();
}

// pause a stream (server does not send streaming data to client while pausing)
// TODO: combine redundent code in pause & unpause
l_handlers.Stream_pause = function (event) {
	
	var streams = [];
	
	if (typeof event.data.streamID === 'string') {
		streams.push(event.data.streamID);
	}
	else if (event.data.streamID instanceof Array) {
		streams = event.data.streamID;
	}
	
	// pause each
	var errmsg = '';
	for (var i=0; i < streams.length; i++) { 
		SR.Video.Stream.pause(streams[i], function (err) {
			if (err) {
				errmsg += (err + '\n');
			}
		});
	}
	
	if (errmsg === '')
		errmsg = null;
	
	event.done({error: errmsg});
}

// unpause a stream (server resumes streaming to client)
l_handlers.Stream_unpause = function (event) {

	var streams = [];
	
	if (typeof event.data.streamID === 'string') {
		streams.push(event.data.streamID);
	}
	else if (event.data.streamID instanceof Array) {
		streams = event.data.streamID;
	}
	
	// pause each
	var errmsg = '';
	for (var i=0; i < streams.length; i++) { 
		SR.Video.Stream.unpause(streams[i], function (err) {
			if (err) {
				errmsg += (err + '\n');
			}
		});
	}
	
	if (errmsg === '')
		errmsg = null;
	
	event.done({error: errmsg});
}


l_handlers.listRtc = function (event) {
	SR.KMS.listRtc();
	event.done();
}

// get a list of currently active streams
l_handlers.Stream_list = function (event) {
	var returnError  = 0 ;
	
	var l_streamAr = SR.Video.Stream.getList();
	event.done({error: returnError, streamAr: l_streamAr }) ;
}

l_handlers.Stream_query = function (event) {
	var vid = event.data.vid; 
	var err  = 0;
		
	var streamObj = SR.Video.Stream.getById(vid);
	if (!streamObj)
		err = 'not found by vid: ' + vid;
	
	event.done({'error': err, streamObj: streamObj}) ;
}


l_handlers.getSnapshot = function (event) {
	var vid = event.data.vid || "";
	//console.log(l_streamObjects[vid]);
	if (l_streamObjects[vid]) {
		l_streamObjects[vid].recorder.getSnapshot({}, function (snapshot) {
			//console.log("getSnapshot");
			//console.log(snapshot);
			var domain = UTIL.getServerDomain();
			event.done({queue: snapshot, snapshot: snapshot[snapshot.length-2], domain: domain});
		});
	} else {
		event.done({'error':'invalid vid'});
	}
}


// module init
l_module.start = function (config, onDone) {
	LOG.warn('stream module started...', l_name);
		
	SR.Video.Stream.init();
			
	// load info from DB
	l_loadDB(function (err) {

		UTIL.safeCall(onDone);

		if (err) {
			LOG.error(err, l_name);
			return;
		}
		l_reconnectDevices();	
	});
	
	UTIL.safeCall(onDone);
}




// module shutdown
l_module.stop = function (onDone) {
	UTIL.safeCall(onDone);
}
