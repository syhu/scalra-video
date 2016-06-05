//  kms.js
//
/*
lobby 指令  log 1 ~ 4 , 1 最簡   4 全部訊息

LOG.show
LOG.sys
LOG.debug
LOG.warn
LOG.error
*/
// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};

var l_name = "SR.KMS";
var l_kmsURL = "ws://localhost:8888/kurento";
var l_kurentoptions = {
	request_timeout: 30000,
	response_timeout: 30000,
	request_timeout: 30000
};

// add helper to show KMS stat in console
SR.Console.add('show-KMS', 'show current KMS server stat', function (para) {

	LOG.warn('trying to show video stat for KMS server');
	for (var rtcID in l_webRtcPool) {
		var webRtc = l_webRtcPool[rtcID];
		
		if (webRtc.videoStats) {
			console.log(rtcID + ':');
			console.log(webRtc.videoStats);
		}
	}
},
'');

var l_ffserverAllocation = new UTIL.Allocate(20);

// module init
l_module.start = function (config, onDone) {
	LOG.warn('KMS module started...');
	
	// TODO: ensure ffmpeg is also closed?	
	l_clearKMS();
	l_clearFFserver();
	
	setInterval(l_periodicCheck, 3000);	
	
	l_checkKMS();
	l_checkFFserver();
	
	UTIL.safeCall(onDone);	
}

// module shutdown
l_module.stop = function (onDone) {
	LOG.warn('KMS module stop...', l_name);
	l_clearKMS();
	l_clearFFserver();
	UTIL.safeCall(onDone);
}

var _exec = require('child_process').exec;

// child_process.spawn(command[, args][, options])
var _spawn = require('child_process').spawn;

var l_kurento = require('kurento-client');

// gain access to stream objects
var l_streamObjects = SR.State.get('SR.Video.streamObjects');

// a streamObject's content
// a record for a single stream (associated with a given URL)
// NOTE: ffmpeg is unique to DVR
//function streamObject() {
//	return {
//		"kurentoClient": null,
//		"pipeline": null,
//		"player": null,
//		"ffmpeg": null,
//		"recorderArr": []
//	};
//}

// storing webrtc objects, indexed by rtcID
var l_webRtcPool = {};

// candidates info for KMS6, indexed by rtcID
var l_candidates = {};


//
// handlers
//

l_handlers.notifyIceCandidate = function (event) {

	// we assume rtcID is vid + connID
	// NOTE: this is streamID as created inside SR.Video.Stream.start()
	// TODO: two places that create the same streamID/rtcID (probably not a good idea..)
	// 	     the reason now is because we don't allow client to create the streamID for now, so 
	//		 notifyIceCandidate does not yet know what the proper rtcID should be when the client first sends it
	var rtcID = event.data.vid + ':' + event.conn.connID;
	
	l_onIceCandidate(rtcID, event.data.ice);
	event.done();
}

//GATHERING VIDEO STATS
//webRtcEndpoint is a valid and connected WebRtcEndpoint instance
//statsType is a string with only two possible values: 'outboundrtp' for gathering stats of streams send out of KMS or 'inboundrtp' for stats of streams received by KMS
//onDone is a function taking as first parameter an error description, or null in case of no error and as second parameter the stats data structure
function l_getWebRtcEndpointVideoStats(webRtcEndpoint, onDone) {
	if (!webRtcEndpoint) 
		return onDone("Cannot get stats from null webRtcEndpoint");

	// here we ask for gathering video stats, for gathering audio stats use "AUDIO" as first parameter.
	webRtcEndpoint.getStats("VIDEO", function (error, stats) {
		if (error)
			return onDone(error);

		for (var key in stats) {
			if (stats.hasOwnProperty(key)) {
				var res = stats[key];
				return onDone(null, res);
			}
		}
		return onDone('Could not find outbound video stats in WebRtcEndpoint stats')
	});
}

// TODO: replace with SR.Schedule?
function l_periodicCheck() {

	// periodically retrieve video stats
	for (var rtcID in l_webRtcPool) {
		var webRtc = l_webRtcPool[rtcID];
		
		l_getWebRtcEndpointVideoStats(webRtc, function (err, result) {
			if (err) {
				LOG.error('checking stat for rtcID: ' + rtcID, l_name);
				LOG.error(err, l_name);
				return;
			}
			webRtc.videoStats = result;
		});
	}
}

//
//	Streaming processing
//
var init = exports.init = function (onDone) {
}

// connect to streaming source
/*
	args: {
		vid:		'string',
		data:		'object',
		connID:		'string',
		type:		'string',	['DVR', 'IPCAM']
		url:		'string'
	}
*/
exports.connect = function (args, onDone) {
	
	l_createKMSclient(args.vid, args.url, onDone);
		
	// perform DVR-related tasks
	/*
		NOTE (must execute in following order)
		steps for making DVR work properly:
			1. [SR] start ffmpeg and wait for DVR stream 
			2. [Hydra] DVR connector pipes data to ffserver 
			3. [SR] create KMS PlayerEndpoint to receive data from ffserver as RTSP stream (stream MUST be ready)
			//4. [SR] create KMS RecorderEndpoint for recording

	var vid = args.vid;

	if (args.type == "DVR") {

		var num = l_ffserverAllocation.get(vid) + 1;
		
		if (num === (0)) {
			var err = 'no more DVR channels can be added';
			LOG.error(err, l_name);
			return UTIL.safeCall(onDone, err);
		}
		
		l_startFFmpeg('http://127.0.0.1:48000/dvr_' + num +'.ffm', vid, 
						function () {	// perform onDone
							LOG.warn('ffmpeg creation done...', l_name);
			
							// return first, to allow application server's connector to pipe in DVR data to ffmpeg
							UTIL.safeCall(onReadyToPipe);
						}, 
						function () {	// perform onDataReady
							var url = 'rtsp://127.0.0.1:48001/dvr_' + num +'.mp4';
							l_createKMSclient(vid, url, onDone);
						});
	}
	else if (args.type == "IPCAM") {
		l_createKMSclient(vid, args.url, onDone);
	}
	else
		return UTIL.safeCall(onDone, "Error, unknown type: " + args.type);	
	*/	
}

// close down various aspects in a streamObj
exports.disconnect = function (vid, onDone) {

	var streamObj = l_streamObjects[vid];
	if (!streamObj) 
		return UTIL.safeCall(onDone, "stream not enabled, vid: " + vid);
	
	/* NOTE: we do not use KMS for recording for now
	if (streamObj.recorder) {
		streamObj.recorder.stop(function () {
			streamObj.recorder.release();
		});
	}
	*/
	
	if (streamObj.player)
		streamObj.player.release();
	if (streamObj.pipeline) 
		streamObj.pipeline.release();

	// shutdown the ffmpeg process
	if (streamObj.ffmpeg) {
		// release allocated ffserver resources
		l_ffserverAllocation.release(vid);
		delete streamObj.process;	
	}	
	
	UTIL.safeCall(onDone);
}


// create the kurento-client to connect to video stream & start streaming
// start a WebRTC stream by initiating stream info
/*
	args: {
		vid:		'string',
		data:		'object',
		connID:		'string'
	}
*/
exports.start = function (rtcID, args, onDone) {

	if (rtcID == undefined)
		return UTIL.safeCall(onDone, "rtcID not defined");

	var sdpOffer = args.data;
	var vid = args.vid;
	var connID = args.connID;

	var streamObj = l_streamObjects[vid];
	if (!streamObj)
		return UTIL.safeCall(onDone, "start streamObj is not found, please check or renew stream for vid: " + vid);
	
	var pipeline = streamObj.pipeline;
	var player = streamObj.player;
	if (pipeline == undefined)
		return UTIL.safeCall(onDone, "No Pipeline, please check if stream is created for vid: " + vid);
	if (player == undefined)
		return UTIL.safeCall(onDone, "No Player, please check if stream is created for vid: " + vid);
	
	// create WebRTCEndpoint
	pipeline.create("WebRtcEndpoint", function (error, webRtc) {
		
		if (error)
			return UTIL.safeCall(onDone, error);

		// add candidates to this webrtc 
		if (l_candidates[rtcID]) {
			// add all available candidates
			while (l_candidates[rtcID].length) {
				var candidate = l_candidates[rtcID].shift();
				webRtc.addIceCandidate(candidate);
			}
		}

		// store vid for later proper removal in stop()
		webRtc.vid = vid;		
		l_webRtcPool[rtcID] = webRtc;
		
		l_in2out_filter(pipeline, {
			type: ""
		}, player, webRtc, sdpOffer, onDone, {
			onWSSend: function (obj) {
				// send KMS SRE info
				LOG.warn('notifyIceCandidate:');
				LOG.warn(obj);
				
				SR.EventManager.send('notifyIceCandidate', obj, connID);				
			},
			rtcID: rtcID
		});
	});
}

// release the webRTC resource
exports.stop = function (rtcID, onDone) {
	
	LOG.warn('stopWebRtc for: rtcID [' + rtcID + ']', l_name);
	var errmsg = undefined;
	
	if (typeof (rtcID) != 'string') {
		errmsg = "stopWebRtc: incorrect input rtcID";
		LOG.error(errmsg, l_name);
		onDone({error: errmsg});
		return;
	}
	
	LOG.warn('l_webRtcPool before size: ' + Object.keys(l_webRtcPool).length, l_name);
	var vid = undefined;
	if (l_webRtcPool.hasOwnProperty(rtcID)) {
		var webrtc = l_webRtcPool[rtcID];
		vid = webrtc.vid;
		webrtc.release();
		delete l_webRtcPool[rtcID];
	}
	LOG.warn('l_webRtcPool after size: ' + Object.keys(l_webRtcPool).length, l_name);

	UTIL.safeCall(onDone, errmsg, {vid: vid, streamID: rtcID, size: Object.keys(l_webRtcPool).length});
}

exports.listWebRtc = function (arg) {
	LOG.warn(l_webRtcPool, l_name);
}

// pipe in data to ffmpeg's stdin (used for DVR streaming)
exports.stdin = function (response) {
	var vid = response.vid;
		
	var streamObj = l_streamObjects[vid];
	if (!streamObj || !streamObj.ffmpeg) 
		return;

	try {
		streamObj.ffmpeg.stdin.write(response.data, response.encode);
	}
	catch (e) {
		LOG.error("FFMPEG stdin.write error");
		LOG.error(e, l_name);
	}
}

//
// internal functions
//

// perform all KMS-related stuff
// NOTE: it's important that ffmpeg already starts to pipe data to FIFO 
// so that RecorderEndpoint can be created properly (PlayerEndpoint can be created before ffmpeg)
// but to simplify, here we try to create MediaPipeline / PlayerEndpoint all at once
var l_createKMSclient = function (vid, url, onDone) {

	l_kurento(l_kmsURL, l_kurentoptions, function (error, kurentoClient) {
		if (error)
			return UTIL.safeCall(onDone, error);

		kurentoClient.on('disconnect', function (err) {
			LOG.warn("kurentoClient::disconnect", l_name);
			// TODO: try to auto-reconnect?			
		});

		kurentoClient.create('MediaPipeline', function (err, pipeline) {
			if (err) {
				pipeline.release();
				return UTIL.safeCall(onDone, err);
			}
			
			LOG.warn('creating PlayerEndpoint for: ' + url, l_name);
			pipeline.create("PlayerEndpoint", {
					"uri": url
			//		"useEncodedMedia": true					
				}, 
				function (err, player) {
					if (err) {
						pipeline.release();
						return UTIL.safeCall(onDone, err);
					}

					// start streaming
					LOG.warn('start to play stream, vid: ' + vid, l_name);
					player.play(function (err) {
						if (err) {
							pipeline.release();
							LOG.error('PlayerEndpoint play detects error:', l_name);
							LOG.error(err, l_name);
							return UTIL.safeCall(onDone, err);
						}
						
						// everything works correctly
						LOG.warn('PlayerEndpoint create success, storing a new streamObj for vid: ' + vid, l_name);
						l_streamObjects[vid].kurentoClient = kurentoClient;
						l_streamObjects[vid].pipeline = pipeline;
						l_streamObjects[vid].player = player;
						
						// store rtsp stream, for recording purpose
						l_streamObjects[vid].rtsp = url;
						
						UTIL.safeCall(onDone, null, l_streamObjects[vid]);
					});
				}
			);
		});
	});
}

/* example of stream info (stored in l_streamInfo)

//	{ 
//		vid: '3CB9AEDF-B147-46F3-9118-0D885FFF7370', 
//		url: 'rtsp://163.22.32.118/live1.sdp', 
//		type: 'IPCAM', 
//		to_rec: false, 
//		state: null, 
//		enabled: true 
//	}
*/	

// start ffmpeg 
var l_startFFmpeg = function (url, vid, onDone, onDataReady) {
	
	// TODO: error handling to start ffmpeg
	
	// start ffmpeg to pipe DVR data to ffserver (so KMS can read as rtsp stream)
	// NOTE: it's very important to start ffmpeg before starting kurento client's RecorderEndPoint
	//		 otherwise it will not get data to create it properly

	LOG.warn('******************************************' + url, l_name);
	LOG.warn('starting ffmpeg to piple DVR data to: ' + url, l_name);

	// NOTE: we currently rely on screen output to determine if stream is ready, so loglevel must be at least 'info'
	// ref: http://superuser.com/questions/326629/how-can-i-make-ffmpeg-be-quieter-less-verbose
	// TODO: may need to find a better way
	var ffmpeg = _spawn('ffmpeg', [
						'-loglevel', 'info',
						// '-loglevel', 'fatal',
						'-i', 'pipe:0',	
						'-pix_fmt', 'yuv420p', 
						'-map', '0', 
						'-preset', 'ultrafast',
						'-tune', 'zerolatency',
						'-profile:v', 'baseline',
						'-x264opts', 'crf=23:vbv-maxrate=10000:vbv-bufsize=10000:intra-refresh=1:slice-max-size=36000:keyint=30:ref=1',
						'-pass', '1',
						'-bf', '0',
						'-flags',
						'-loop',
						'-wpredp', '0',
						'-an',
						//'-y', 		
						//'-isync', 
						//'-vcodec', 'copy',
						//'-level', '3.0',
						url]);

	ffmpeg.stdout.on('close', function (err) {
		LOG.warn("ffmpeg stopped", l_name);
		if (l_streamObjects.hasOwnProperty(vid))
			delete l_streamObjects[vid].ffmpeg;
	});

	ffmpeg.stdout.on('data', function (msg) {
		LOG.sys("ffmpeg stdout: " + msg, l_name);
	});	

	ffmpeg.stderr.on('data', function (output) {

		LOG.sys("ffmpeg stderr: " + output, l_name);

		//FIXME: reconnect if mosiac pictures
		//FIXME: reconnect if > 10 seconds
		
		// check to notify onDataReady (called once)
		if (typeof(onDataReady) === 'function') {

			var out = output.toString();	
			if (out.indexOf('frame=') === 0) {
				LOG.warn("===================== DVR streaming start piping ===================", l_name);
				UTIL.safeCall(onDataReady);
				onDataReady = undefined;	
			}
		}
	});

	// error handling / recovery
	ffmpeg.on('error', function (err) {
		LOG.error('ffmpeg error:', l_name);
		LOG.error(err, l_name);
	});

	// store ffmpeg for future reference
	// NOTE: we can add ffmpeg directly as streamObj is already stored into l_streamObjects
	l_streamObjects[vid].ffmpeg = ffmpeg;
	
	// we return immediately after spawning (call only once)
	if (typeof(onDone) === 'function') {
		LOG.warn("======================= ffmpeg started ====================", l_name);
		UTIL.safeCall(onDone);
		onDone = undefined;
	}	
}

// create in2out filter
function l_in2out_filter(i_pipeline, filterObj, i_inWebRTC, i_outWebRTC, sdpOffer, onDone, config) {
	var onWSSend = config.onWSSend;
	var rtcID = config.rtcID;

	var filterType = filterObj.type;
	var command = "";

	switch (filterType) {

		case "vf":
			command = "videoflip method=vertical-flip";
			break;

		case "hf":
			command = "videoflip method=horizontal-flip";
			break;
			
		case "ccw":
			command = "videoflip method=counterclockwise";
			break;
			
		case "cw":
			command = "videoflip method=clockwise";
			break;
			
		case "wh":
			command = "capsfilter caps=video/x-raw,width=" + filterType.width + ",height=" + filterType.height;
			break;
			
		case "fr":
			command = "capsfilter caps=video/x-raw,framerate=" + filterType.sec + "/1";
			break;
			
		default:
			l_playWebRtc_InToOut(i_inWebRTC, i_outWebRTC, sdpOffer, onDone, config);
			return;
	}

	i_pipeline.create('GStreamerFilter', {
		command: command,
		filterType: 'VIDEO'
	}, function (error, gstFilter) {
		i_inWebRTC.connect(gstFilter, function (error) {
			if (error) {
				LOG.error(error, l_name);
				// TODO: to return early when error?
			}
			
			gstFilter.connect(i_outWebRTC, function (error) {
				if (error) {
					LOG.error(error, l_name);
					// TODO: to return early when error?
				}
				
				i_outWebRTC.processOffer(sdpOffer, function (error, sdpAnswer) {
					
					if (error) {
						LOG.error(error, l_name);
						// TODO: to return early when error?
					}					
					
					i_outWebRTC.on('OnIceCandidate', function (event) {
						var candidate = l_kurento.register.complexTypes.IceCandidate(event.candidate);
						var sendObj = {
							rtcID: rtcID,
							candidate: candidate
						};
						onWSSend(sendObj);
					});

					//   一定在一連線之後 啟動
					i_outWebRTC.gatherCandidates(function (error) {
						LOG.error(error, l_name);
						// TODO: to return?
					});
					
					return UTIL.safeCall(onDone, error, sdpAnswer);
				});
			});
		});
	});
}

function l_playWebRtc_InToOut(i_inWebRTC, i_outWebRTC, sdpOffer, onDone, config) {

	var onWSSend = config.onWSSend;
	var rtcID = config.rtcID;

	i_inWebRTC.connect(i_outWebRTC, function (error) {
		if (error) {
			LOG.error('i_inWebRTC.connect', l_name);
			LOG.error(error, l_name);
			return UTIL.safeCall(onDone, error);
		}

		i_outWebRTC.processOffer(sdpOffer, function (error, sdpAnswer) {
			if (error) {
				LOG.error('i_outWebRTC.processOffer', l_name);
				LOG.error(error, l_name);
				return UTIL.safeCall(onDone, error);
			}

			i_outWebRTC.on('OnIceCandidate', function (event) {
				var candidate = l_kurento.register.complexTypes.IceCandidate(event.candidate);
				var sendObj = {
					rtcID: rtcID,
					candidate: candidate
				};
				UTIL.safeCall(onWSSend, sendObj);
			});

			//   一定一在連線之後 啟動
			i_outWebRTC.gatherCandidates(function (error) {
				if (error) {
					return UTIL.safeCall(onDone, error);
				}
			});

			UTIL.safeCall(onDone, error, sdpAnswer);
		});
	});
}

// store IceCandidate into the webrtc object
var l_onIceCandidate = function (rtcID, ice_candidate) {

	var candidate = l_kurento.register.complexTypes.IceCandidate(ice_candidate);
	
	// if webrtc object is already created, simply add candidate to it
	if (l_webRtcPool[rtcID])
		l_webRtcPool[rtcID].addIceCandidate(candidate);
	// otherwise, we store the candidate for use later, until the webrtc object is created
	else {
		if (!l_candidates[rtcID])
			l_candidates[rtcID] = [];
		l_candidates[rtcID].push(candidate);
	}
}
		
function l_checkFFserver() {

	_exec("ps cax | grep ffserver", function (err, data) {
		LOG.warn('checkKMS data:', l_name);
		LOG.warn(data, l_name);
		
		if (data === '') {
			l_startFFserver();
		}
	});
}

var l_FFserver = undefined;
var l_FFstarted = false;

// TODO: combine managing ffmpeg & ffserver into same code
function l_startFFserver() {
	
	LOG.warn('starting FF server...', l_name);
	l_FFserver = _spawn('ffserver', ['-f','ffserver.conf'], {cwd: __dirname });

	l_FFserver.stderr.on('data', function (data) {
		if (UTIL.userSettings('KMS', 'enable_log') === true) {
			SR.fs.appendFile(l_filePath + 'FF.log', data, function (err) {
				if (err) 
					LOG.err(err, l_name);
			});
		}
	});

	l_FFserver.stdout.on('close', function (err) {
		LOG.warn("FFserver stopped", l_name);
		l_FFserver = undefined;
	});

	l_FFserver.stderr.on('data', function (data) {
		LOG.warn("FFserver: " + data, l_name);
	});

	l_FFserver.stderr.on('err', function (err) {
		LOG.warn("FFserver: " + err, l_name);
	});

	l_FFserver.on('error', function (err) {
		LOG.error('FF server error:', l_name);
		LOG.error(err, l_name);
	});
}

function l_clearFFserver() {
	_exec("killall -9 ffmpeg", function () {});
	_exec("killall -9 ffserver", function () {});
	l_FFserver = undefined;
}

// check if KMS server exists, if not then start one
function l_checkKMS() {

	_exec("ps cax | grep kurento", function (err, data) {
		LOG.warn('checkKMS data:', l_name);
		LOG.warn(data, l_name);
		
		if (data === '') {
			l_startKMS();
		}
	});
}

// 啟動KMS  
var l_KMSserver = undefined;

function l_startKMS(onDone) {

	// DEBUG 使用， 沒有加入 下面那一行， 遠端無法執行 spawn 
	// TODO: modify KMS start to non-debug mode?
	process.env.LC_ALL = "C";
	process.env.G_MESSAGES_DEBUG = "all";
	process.env.GST_DEBUG = "6,Kurento*:5";

	var comm = "kurento-media-server";
	
	LOG.warn('starting KMS server...', l_name);
	l_KMSserver = _spawn(comm, [], {
		cwd: undefined,
		env: process.env
	});
	
	l_KMSserver.stderr.on('data', function (data) {
		// log KMS messages
		if (UTIL.userSettings('KMS', 'enable_log') === true) {
			SR.fs.appendFile(l_filePath + 'KMS.log', data, function (err) {
				if (err) 
					LOG.err(err, l_name);
			});
		}
		
		// check to reconnect devices
		if (typeof onDone === 'function' && l_KMSserver.pid > 1024) {
			LOG.warn("KMS started", l_name);
			UTIL.safeCall(onDone);
			onDone = undefined;
		}
	});
	
	l_KMSserver.stdout.on('close', function (err) {
		LOG.warn("KMS stopped", l_name);
		l_KMSserver = undefined;
	});
	
	l_KMSserver.on('error', function (err) {
		LOG.error('KMS server error:', l_name);
		LOG.error(err, l_name);
	});
}

function l_clearKMS() {

	for (var vid in l_streamObjects) {
		var obj = l_streamObjects[vid];

		/*
		if (obj.recorder) {
			obj.recorder.stop();
			obj.recorder.release();
		}
		*/
		
		if (obj.player) 
			obj.player.release();
		if (obj.pipeline) 
			obj.pipeline.release();

		if (obj.ffmpeg) 
			delete obj.ffmpeg.process;
	}
	
	_exec("killall -9 kurento-media-server", function () {});
	
	l_KMSserver = undefined;
}

SR.Callback.onCrash(function (e) {
	LOG.error('=== onCrash ===', l_name);
	LOG.error(e, l_name);

	l_clearKMS();
	l_clearFFserver();
});

// TODO: should remove this usage (hide KMS from more abstract layers)
SR.KMS = exports;

// register this module
//SR.Module.add('KMS', l_module);
