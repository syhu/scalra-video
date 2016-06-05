/*
//
//
// video.js
//
// video streaming
//
todo:
	
*/
// requires
// TODO: remove AeX dependency
require('./video/Core/AeDatabase.js');
require('./video/Core/AeDate.js');
require('./video/Core/AeLog.js');
require('./video/Core/AeObject.js');
require('./video/Core/AeEventSender.js');
require('./video/Core/SystemEvent.js');
require("./video/Core/AeTimeTrigger.js");
require("./video/Core/pw_recovery.js");

// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};
var l_name = 'SR.Video';

// set video-related path
SR.Settings.VIDEO_PATH = SR.Settings.FRONTIER_PATH + '/../store/';
//SR.Settings.VIDEO_EXT = '.webm';
SR.Settings.VIDEO_EXT = '.mp4';

var l_videoStreamPool = SR.State.get('l_videoStreamPool');

//
// exported API
//

///////////////////////////////////// stable
// get active channels and inactive channels
// input: {}
// output: {active: ["channel_id"], inactive: ["channel_id"]}
/////////////////////////////////////
exports.getStatus = function () {
	var stat = {
		active: [],
		inactive: [],
		detail: {},
		video_status: l_status,
		diskFullAction: conf.diskFullAction
	};
	for (var key in l_videoStreamPool) {
		if (l_videoStreamPool[key].process) {
			stat.active.push(key);
			stat.detail[key] = {};
			for (var key2 in l_videoStreamPool[key]) {
				if (key2 !== 'process') {
					stat.detail[key][key2] = l_videoStreamPool[key][key2];
				}
			}
		} else {
			stat.inactive.push(key);
		}
	}
	setTimeout(function () {
		LOG.debug("l_videoStreamPool", l_name);
		LOG.debug(l_videoStreamPool, l_name);
	}, 3000);
	return stat;
}


// module init
l_module.start = function (config, onDone) {
	LOG.warn('video module started...', l_name);
	
	// load sub-modules	
	SR.Module.load({dir: 'video/',
					name: ['recorder', 'stream', 'ffmpeg', 'record_trigger'], 
					config: config});
	
	UTIL.safeCall(onDone);
}

// module shutdown
l_module.stop = function (onDone) {
	UTIL.safeCall(onDone);
}

// make this global	
SR.Video = exports;
