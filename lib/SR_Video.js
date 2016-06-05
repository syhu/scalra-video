
/*
var Video = {
	init: function (config, onDone) {
		console.log('SR.Video.init called');
		if (typeof onDone === 'function')
			onDone();
	},
	
	dispose: function (onDone) {
		console.log('SR.Video.dispose called');
		if (typeof onDone === 'function')
			onDone();		
	}
};
*/
// maximum number of allowable canvasStream for a given resolution width+height pair
// (if exceed this number then will re-cycle /re-use existing ones)
// TODO: have this parameter be auto-detectable by client capability?
var l_maxStreams = 16;

var _webRtcPeerArr = {};

// store server's candidate to client-side SDK
function setIceCandidate(data) {

	console.log('setIceCandidate called with data:');
	console.log(data);
	
	var streamID = data.rtcID;
	var webRtcPeer = _webRtcPeerArr[streamID];
	if (webRtcPeer) {
		webRtcPeer.addIceCandidate(data.candidate);
	}
	else {
		console.error('no webrtc peer found to add icecandidate locally!');	
	}
}

function proceesError(jqXHR, textStatus, error) {
	console.log("SR_VIDEO_POST ERROR");
	console.log(jqXHR);
	console.log(textStatus);
	console.log(error);
}

//////////// 以上  網路連線處理
/////////////////////////////


function CVideo() {};
//
CVideo.prototype.init = function (onDone) {
	console.log('SR.Video.init called');
	SR.safeCall(onDone);	
};
//
CVideo.prototype.dispose = function (onDone) {
	console.log('SR.Video.dispose called');
	SR.safeCall(onDone);	
};

SR['Video'] = new CVideo();

//=========================================================

function CStream() {};
//
CStream.prototype.onError = function (error) {
	console.log(error);
};

// create a new stream
CStream.prototype.new = function (info, onDone) {
	SR.sendEvent('Stream_new', info,
		function (data) {
			onDone('Stream_new', data);
		});
};

// delete an existing stream based on streamID (vid)
CStream.prototype.delete = function (vid, onDone) {
	SR.sendEvent('Stream_delete', {"vid": vid},
		function (data) {
			onDone('Stream_delete', data);
		});
};

// counters on number of streams already created, indexed by resolution type string (e.g., '176x120'), 
// to allow checks on whether streams of a particular kind is exceeding stream size limit
var l_typeCount = {};

// keep reference of canvasStreams (used by Broadway), indexed by vid
var l_streams = {};

// find a canvasStream that can be reused
var l_findReusableCanvas = function (res_type) {

	var replaced_vid = undefined;
	var last_update = new Date();
	
	// look for the oldest
	for (var v in l_streams) {
		
		// skip mismatched resolutions
		if (l_streams[v].res_type !== res_type) {
			continue;
		}
		
		var info = l_streams[v];
		
		// skip those with invalid canvasStream (possibly already replaced before)
		if (typeof info.cs === 'undefined') {
			//console.log('[' + v + '] does not have a valid canvasStream, skip it...');
			continue;
		}
			
		// if canvas if no longer active, return it
		if (info.active === false) {
			console.log('inactive canvas found, replace old stream [' + v + ']')
			replaced_vid = v;
			break;
		}
		
		// identify oldest created canvas
		//console.log('compare: creation [' + info.time + '] with  [' + last_update + ']');
		if (info.time <= last_update) {
			console.log('earlier stream [' + v + '] found. created @ [' + info.time + '] vs. current earliest [' + last_update + ']');				
			last_update = info.time;
			replaced_vid = v;
		}
	}
	
	if (!replaced_vid) {
		console.error('no replacable vid found!');
		return undefined;
	}
	
	// we'll use an existing canvasStream object to receive new streaming
	var cs = l_streams[replaced_vid].cs;
	if (typeof cs === 'undefined') {
		console.error('canvasStream for [' + replaced_vid + '] is already invalid!');
		return cs;
	}

	// remove the old stream or just temporarily suspend the stream depending on whether it's still active
	if (l_streams[replaced_vid].active) {
		console.log('temporily disable cansvasStream object for [' + replaced_vid + ']');
		l_streams[replaced_vid].cs = undefined;							
	} else {
		console.log('remove streamInfo fully for stopped stream [' + replaced_vid + ']');
		delete l_streams[replaced_vid];	
	}
	//console.log('typeof cs: ' + typeof cs);
	return cs;
}

// start to play stream
CStream.prototype.start = function (vid, onDone) {

	var that = this;
		
	// TODO: remove or simplify this
	// determine stream type based on vid
	SR.sendEvent('Stream_query', {vid: vid}, function (data) {
	
		var streamObj = data.streamObj;
		
		console.log('query streamObj result: ');
		console.log(streamObj);
		
		// check for error or invalid stream objects returned
		if (typeof data.error === 'string') {
			var errmsg = data.error;
			console.error(errmsg);
			return SR.safeCall(onDone, errmsg);
		}
		
		if (typeof streamObj !== 'object' || 
			typeof streamObj.type !== 'string' || 
			typeof streamObj.pipeline !== 'string' ||
			typeof streamObj.resolution !== 'string') {
			var errmsg = 'invalid streamObj for vid: ' + vid;
			SR.Error(errmsg);
			return SR.safeCall(onDone, errmsg);		
		}
		
		// streamInfo:
		//	{	
		//		type: 'string', 			// 'IPCAM', 'DVR'
		//	 	pipeline: 'string', 		// 'Broadway', 'Kurento'
		//		res_type: 'string', 		// '1920x1080', '176x120'
		//		cs: 'object'				// canvasStream object
		//		active: 'boolean',			// [true | false]
		//		time: 'number'				// timestamp for canvas creation
		//	}
		//
		var streamInfo = {
			type: streamObj.type,				
			pipeline: streamObj.pipeline,		
			//res_type: streamObj.resolution		// 'High' 'Low'
		};
		
		console.log('stream info for vid [' + vid + ']:');
		console.log(streamInfo);
		
		if (streamInfo.pipeline === "Broadway") {
		
			// return immediately if the stream is already started
			if (l_streams.hasOwnProperty(vid) && l_streams[vid].active) {
				canvas = l_streams[vid].cs.getCanvas();
				return SR.safeCall(onDone, undefined, canvas);
			}
			
			// create a new canvas object
			SR.sendEvent('Stream_start', {"vid": vid}, function (data) {
				console.log('Stream_start result:');
				console.log(data);
				
				if (data.result) { // high resolution only
					console.log(data.result.width + 'x' + data.result.height);
					streamInfo.resolution = data.result;
				} else {
					console.log('default resolution to: 176x120');
					streamInfo.resolution = {
						"width": 176,
						"height": 120
					}
				}
				var res_type = streamInfo.res_type = streamInfo.resolution.width + 'x' + streamInfo.resolution.height;
				if (l_typeCount.hasOwnProperty(res_type) === false)
					l_typeCount[res_type] = 0;
				
				// canvas object to be returned
				var canvas;
																
				// for new streams
				if (l_typeCount[res_type] < l_maxStreams) {

					l_typeCount[res_type]++;
				
					// allocate a new canvasStream
					var canvasstream = new canvasStream({"vid": vid, "resolution": streamInfo.resolution});
					canvas = canvasstream.getCanvas();
					
					// record type
					canvas.type = 'canvas';
					
					// record canvasStream
					// TODO: make it generic/general to cover Kurento streams as well?
					streamInfo.cs = canvasstream;
					
				} else {
					// we need to re-cycle canvasStreams
					// vid of canvasStream to be replaced
					console.log('canvas limit [' + l_maxStreams + '] reached, need to recycle canvas');
					
					var cs = l_findReusableCanvas(res_type);
					
					if (cs) {
						// store new record and remove previous stream info
						streamInfo.cs = cs;
						canvas = cs.getCanvas();
						cs.change(vid);
						console.log('new streamInfo:');
						console.log(streamInfo);			
					} else {
						console.error('cannot find valid canvasStream to replace');	
					}
				}
				
				// valid canvas created or found
				if (canvas) {
					streamInfo.active = true;
					streamInfo.time = new Date();
					l_streams[vid] = streamInfo;
					console.log('canvasStream found or created for [' + vid + '] with cs type: ' + typeof streamInfo.cs);
					
					SR.safeCall(onDone, undefined, canvas);
				} else {
					SR.safeCall(onDone, 'cannot start with valid canvas for vid: ' + vid);
				}
			});
		// for IPcam we assume it's video tag object 
		// TODO: this assumption may not be correct
		} else {
			var $video = $('<video class="active" poster="./img/transparent-1px.png" width="100%" height="100%" muted="muted" autoplay="" style="background: url(/web/img/spinner.gif) 50% 50% no-repeat transparent;"></video>');
			
			// record type
			var vidobj = $video[0];
			vidobj.type = 'video';

			that.KMS_start(vid, vidobj, function (err, obj) {	
				SR.safeCall(onDone, err, vidobj);
			});
		}
	});
}

// KMS-specific start
CStream.prototype.KMS_start = function (vid, video, onDone) {
	
	var that = this;

	console.log("startWebRTC");
	console.log("vid =" + vid);
	
	// client procedure:
	// 1. create WebRtcPeer 	(kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly)
	// 2. generate Offer		(webrtcPeer.generateOffer)
	// 3. Stream_start event
	var webrtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly({
		remoteVideo: video,
		onicecandidate: function (candidate) {

			// NOTE: last parameter indicates that the callback 'setIceCandidate' shouldn't be removed
			SR.sendEvent('notifyIceCandidate', {vid: vid, ice: candidate}, 
						 function (data) {
							 webrtcPeer.addIceCandidate(data.candidate);
						 }, undefined, true);
		}
	},
	function (err) {
		if (err) {
			console.error(err);
			return SR.safeCall(that.onDone, err);
		}
		webrtcPeer.generateOffer(
			function (error, sdpOffer) {
				
				if (error) {
					console.log('generateOffer error: ');
					console.error(error);
					return SR.safeCall(onDone, error);
				}

				SR.sendEvent('Stream_start', {
						"vid": vid,
						"data": sdpOffer
				}, 
				/*
					data: {
						error:		'string',	(or undefined if no error)						
						streamID: 	'string',
						result: 	'object'
					}
				*/
				function (data) {
					
					// show error, if any
					if (data.error) {
						console.log('Stream_start error for vid: ' + vid);
						console.error(data.error);
					}
					else
						console.log('Stream_start return successfully for vid: ' + vid);
					
					var streamID = data.streamID;			
					console.log('streamID received: ' + streamID);

					// data.result contains sdpAnswer
					webrtcPeer.processAnswer(data.result, function (err) {
						
						console.log('webrtc process answer returned, store webrtcPeer...');	
						if (err)
							console.error(err);
						
						webrtcPeer.vid = vid;
						_webRtcPeerArr[streamID] = webrtcPeer;
						
						console.log('calling SR.Video.Stream.start onDone');
						// NOTE: we're not sure if by this time returning the video object is ready to show
						SR.safeCall(onDone, null, video);				
					});
				});
			}
		);
	});
};


// this will stop the stream (release webrtc resources)
// TODO: only one sendEvent is needed / used (obviously)
CStream.prototype.stop = function (vid, onDone) {


	if (l_streams.hasOwnProperty(vid) === false) {
		var errmsg = 'no stream info for vid: ' + vid;
		SR.Error(errmsg);
		return SR.safeCall(onDone, errmsg);
	}	
	
	var streamInfo = l_streams[vid];
		
	if (streamInfo.pipeline === "Broadway") {
				
		// make canvasStream non-functional and mark this stream as 'inactive'
		// NOTE: however, the stream info would still exist here, its canvasStream is still valid,
		// until another new stream is started that takes over its canvasStream
		// only then will this stream's vid be removed from l_streams		
		streamInfo.cs.remove();
		streamInfo.active = false;
		
		SR.sendEvent('Stream_stop', {streamID: vid}, function (){
			SR.safeCall(onDone);
		});
	}
	else {
		// NOTE: it's possible to stop the wrong one when there are multiple ones
		// TODO: need to fix this bug
		for (var streamID in _webRtcPeerArr) {
			if (vid === _webRtcPeerArr[streamID].vid) {
				
				delete l_types[vid];
				
				console.log("stopping stream: " + vid + ' streamID: ' + streamID);
				
				SR.sendEvent('Stream_stop', {streamID: streamID}, function () {
					SR.safeCall(onDone);
				});		
				return;
			}
		}
		var errmsg = "webRTCpeer cannot be found for vid=" + vid;
		SR.safeCall(onDone, errmsg);
	}
};

var l_validateStreamID = function (streamIDs) {

	// first make input format uniform (treat both string and array as array)
	var streams = [];
	
	if (typeof streamIDs === 'string') {
		streams.push(streamIDs);
	}
	else if (streamIDs instanceof Array) {
		streams = streamIDs;
	}

	// then check if the stream has been properly initialized
	var validStreams = [];
	for (var i=0; i < streams.length; i++) {
		try {
			var vid = streams[i].split(':')[0];
			if (l_streams.hasOwnProperty(vid) === false) {
				console.log('stream [' + vid + '] not yet initialized, cannot be paused/unpaused');
				continue;  
			}
			// also skipped those already stopped
			if (l_streams[vid].active === false) {
				console.log('stream [' + vid + '] already stopped, cannot be paused/unpaused, need to start first');
				continue;
			}
			validStreams.push(vid);
		} catch (e) {
			console.error(e);			
		}
	}
	return validStreams;
}

// pause a stream
CStream.prototype.pause = function (streamIDs, onDone) {
	var streams = l_validateStreamID(streamIDs);
	
	SR.sendEvent('Stream_pause', {streamID: streams}, function (result) {		
		SR.safeCall(onDone, result.error);
	});
}

// unpause a stream
CStream.prototype.unpause = function (streamIDs, onDone) {
	var streams = l_validateStreamID(streamIDs);
	SR.sendEvent('Stream_unpause', {streamID: streams}, function (result) {
		if (!result.error) {
			// resume subscription on client side
			// NOTE: if canvasStream was previosly 'borrowed' by other active streams, may need to 're-borrow' back			
			for (var i=0; i < streams.length; i++) {
				try {
					var vid = streams[i];
					console.log('unpausing vid [' + vid + '], check if we need to restore canvasStream...');
					if (l_streams.hasOwnProperty(vid) === false) {
						console.error('stream info for [' + vid + '] cannot be found!');
						continue;  
					}						
						
					var info = l_streams[vid];
					
					if (typeof info.cs === 'undefined') {
						console.log('canvasStream removed.. restore it...');

						var cs = l_findReusableCanvas(info.res_type);
						
						if (cs) {
							// store new record and remove previous stream info
							info.cs = cs;
							
							// update time
							// NOTE: this is very important so that the restored canvas won't be re-claimed by other streams any time soon
							info.time = new Date();
							cs.change(vid);	
							console.log('canvas restored for stream:');
							console.log(info);
						}						
					}
				}
				catch (e) {
					console.error(e);	
				}
			}
		}
		SR.safeCall(onDone, result.error);
	});
}

//取得串流列表
// TODO: two different callbacks for the same event 'Stream_getList'
CStream.prototype.getList = function (onDone, vid) {
	if (vid === undefined) {
		console.log('no vid provided for getList');
		return;
	}

	SR.sendEvent('Stream_getList', {
			"vid": vid
		},
		function (data) {
			onDone('Stream_getList', data);
		});
	
};
//取得指定串流資料
CStream.prototype.getById = function (vid, onDone) {
	SR.sendEvent('Stream_getById', {
			"vid": vid
		},
		function (data) {
				onDone('Stream_getById', data);
				return true;
		});
};


//
// Record-related functions
//
function CRecord() {};
//開始錄影
CRecord.prototype.start = function (vid, onDone) {
	SR.sendEvent('Record_start', {
			"vid": vid
		},
		function (data) {
			onDone('Record_start', data);
		});
};
//結束錄影
CRecord.prototype.stop = function (vid, onDone) {
	SR.sendEvent('Record_stop', {
			"vid": vid
		},
		function (data) {
			onDone('Record_stop', data);
		});
};
//取得錄影檔案列表
CRecord.prototype.getList = function (onDone) {
	SR.sendEvent('Record_getList', {},
		function (data) {
			onDone('Record_getList', data);
		});
};
//取得特定錄影檔案資料
CRecord.prototype.getById = function (vid, onDone) {
	SR.sendEvent('Record_getById', {
			"vid": vid
		},
		function (data) {
			onDone('Record_getById', res);
		});
};
///////////////////////  以上  錄製

//SR.Video = (typeof Video === 'object' ? Video : {});

SR.Video.Stream = new CStream();
SR.Video.Record = new CRecord();

//
// lib for Broadway
//

// need: 
//  - ./Broadway/Player/Decoder.js
//  - ./Broadway/Player/YUVWebGLCanvas.js
//  - ./Broadway/Player/Player.js
// usage:
// 	var liveStream = new canvasStream(vid);
//	var canvas = liveStream.getCanvas();

// parameter:
//	info: {
//		vid: 'string',
//		resolution: {
//			width: 'number',
//			height: 'number'
//		}
//	}
//
var canvasStream = function (info) {

	var self = this;	
	
	// not used at all?
	//var decoder = new Decoder();	

	// TODO: check resolution correctness
	console.log("creating canvasStream with resolution: " + info.resolution.width + 'x' + info.resolution.height);

	this.player = new Player({
		useWorker: true,
		workerFile: "/lib/Broadway/Player/Decoder.js",
		webgl: true,
		size: info.resolution
	});
	
	this.received_message_previous = 0;
	this.received_message_current = 1;
	setInterval(function (){
		if (self.received_message_previous === self.received_message_current) {
			console.error("video timeout: " + info.vid);
		} else {
			self.received_message_previous = self.received_message_current;
		}
	}, 30*1000);

//	var toUint8Array = function (parStr) {
//		var raw = window.atob(parStr);
//		var rawLength = raw.length;
//		var array = new Uint8Array(new ArrayBuffer(rawLength));
//		var i;
//		for (i = 0; i < rawLength; i++) {
//			array[i] = raw.charCodeAt(i);
//		}
//		return array;
//	};

	var onMessage = function (data, ch) {
		self.received_message_current =+ data.length;
		// console.log(data.length);
		try {
			// console.log(data);
			// self.player.decode(toUint8Array(data));
			if (typeof(data.data) === "undefined") {
				self.player.decode(data); // node v0.10.x
			} else {
				self.player.decode(data.data);
			}
		} catch (err) {
			console.error(err);
		}
	};
	
	this.init = function (vid) {
		self.vid = vid;	
		SR.subscribe(vid, 0, onMessage);
	};
	
	this.getCanvas = function () {
		return self.player.canvas;
	}
		
	// remove current stream from streaming
	this.remove = function () {
		// TODO: removal should confirm with server?
		SR.unsubscribe(self.vid);
	}
	
	// change display content to that of a different vid
	this.change = function (vid) {
		self.remove();
		self.init(vid);
	}

	// connect to initial vid
	this.init(info.vid);
}
