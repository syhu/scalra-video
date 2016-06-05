// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};
var l_name = 'SR.Video.ffmpeg';

//
//	SR.Video handlers (copied from /handlers/video.js)
//
var l_dbVideoChannel = "icVideoChannel";
var l_dbVideoSchedule = 'icVideoSchedule';
SR.DB.useCollections([l_dbVideoChannel, l_dbVideoSchedule]);

//SR.DB.useCollections([l_dbVideoChannel]);

// 
// SR.Schedule (periodic works)
//

SR.Schedule.patchCallback({
	action: "startRecord", 
	callback: function (arg) {
		LOG.warn("schedule: startRecord", l_name);
		LOG.warn(arg, l_name);
		
		if (typeof arg === 'array') {
			for (var id in arg) {
				SR.Video.ffmpeg.record.start({'id': id});
			}
		} 
		else if (typeof arg === 'string') {
			SR.Video.ffmpeg.record.start({id: arg});
		} 
		else {
			LOG.warn("Something wrong with input arg in scheduled startRecord: ", arg);
		}
	}
});

SR.Schedule.patchCallback({
	action:"stopRecord", 
	callback: function (arg) {
		LOG.warn("schedule: stopRecord", l_name);
		LOG.warn(arg, l_name);
		
		if (typeof arg === 'array') {
			for (var id in arg) {
				SR.Video.ffmpeg.record.stop({'id': id});
			}
		} else if (typeof arg === 'string') {
			SR.Video.ffmpeg.record.stop({id: arg});
		} else {
			LOG.warn("Something wrong with input arg in scheduled startRecord: ", arg);
		}
	}
});

l_checkers.SR_VIDEO = {
//	_groups: ["user", "admin"],
//	_permissions: ["videoControl", "videoManagement"]
}

// SR.Video
l_handlers.SR_VIDEO = function (event) {
	
	//console.log(event);
	switch (event.data.action) {
		case "setChannel":
			if (event.data.name && event.data.in && event.data.out) {
				SR.Video.ffmpeg.setChannel({
					name: event.data.name, 
					in: [event.data.in], 
					out: [event.data.out], 
					//parameter: [event.data.parameter],
					desc: event.data.desc, 
					onDone: function (arg) {
						event.done(event.data.action, arg);
					}
				});
			}
			else {
				SR.Video.ffmpeg.setChannel({desc: "test", in:['rtsp://218.204.223.237:554/live/1/66251FC11353191F/e7ooqwcfbqjoo80j.sdp'], out:["out1"]});
				SR.Video.ffmpeg.setChannel({desc: "test1", in:['rtsp://218.204.223.237:554/live/1/0547424F573B085C/gsfp90ef4k0a6iap.sdp'], out:["out2"]});
				SR.Video.ffmpeg.setChannel({desc: "test2", in:['rtsp://163.22.32.118/live1.sdp'], out:["out3"]});
				event.done(event.data.action, {"status": "ok"});
			}
			break;
			
		case "deleteChannel":
			SR.Video.ffmpeg.deleteChannel({id: event.data.id});
			event.done(event.data.action, {"status": "ok"});
			break;

		case 'customChannelOption':
			//console.log("in customChannelOption");
			//console.log(event.data);
			var p = {};
			try {
				p = JSON.parse(event.data.parameter);
			}
			catch (e) {
				e = e || "no error";
				arg.onDone(event.data.action, {"status": e});
			}
			LOG.warn(p , l_name);
			SR.Video.ffmpeg.channel.custom({id: event.data.id, option: p, onDone: function(x) {
				event.done(event.data.action, {"status": x});
			} });
			break;
			
		case "startStream":
			event.done(event.data.action, SR.Video.ffmpeg.stream.start({id: event.data.id}));
			break;
			
		case "stopStream":
			event.done(event.data.action, SR.Video.ffmpeg.stream.stop({id: event.data.id}));
			break;
			
		case "startRecord":
			event.done(event.data.action, SR.Video.ffmpeg.record.start({id: event.data.id}));
			break;
			
		case "stopRecord":
			event.done(event.data.action, SR.Video.ffmpeg.record.stop({id: event.data.id}));
			break;

		case 'storedConvert':
			LOG.warn(event.data , l_name);

			var query = event.data;
			query.onDone = function (result) {
		    	event.done(event.data.action,result);
			};

			SR.Video.ffmpeg.stored.convert(query);

		break;

		case 'storedConvertedDownload':
			event.done('SR_RESOURCE', {address: event.data.filename, header: {}});
			//SR.Video.ffmpeg.stored.convert({});

		break;

		case 'clearConverted':
			event.done(event.data.action, SR.Video.ffmpeg.stored.clearConverted(event.data));
		break;

		case 'storedConvertingStatus':
			event.done(event.data.action, SR.Video.ffmpeg.stored.convertingStatus());
		break;

		case 'oldestAvailable':
			event.done(event.data.action, SR.Video.ffmpeg.stored.oldestAvailable());
		break;

		case "getChannel":
			SR.Video.ffmpeg.getChannel({id: event.data.id, onDone: function (xx) {
					event.done(event.data.action,{channel: xx});
				} });
			break;

////////////////////////////////////////////////////////////
		case "query":
			LOG.debug("in SR_VIDEO?action=query", l_name);
			var query = {event_data: event.data, onDone: function (argu) {
				//console.log("argu");
				//console.log(argu);
				var arg = [];
				if (typeof(argu) === 'string') {
					arg = argu;
				} 
				else {
					var prev = 0;
					for (var i in argu) {
						//console.log("i " + i + " argu[i]:" );
						//console.log(argu[i]);
						if ( argu[i] && argu[i].file && typeof(argu[i].file) === 'string' && argu[i].file.match(/_.[0-9]*-[0-9]*\./) !== null ) {
							var item = {file: argu[i].file, };
							if (argu[i].stat == undefined) item.end = new Date();
							else item.end = new Date(argu[i].stat.mtime);

							if (arg[i-1] && arg[i-1].end ) {
								item.start = arg[i-1].end;
								//console.log("a");
							}
							else {
								item.start = new Date(item.end);
								item.start.setSeconds(item.end.getSeconds() -5);
								//item.start.setMinutes(item.end.getMinutes() -5);
								//console.log("b");
							} 
							arg.push(item);
						}
					}
				}

				if (event.data.listOnly && event.data.listOnly === 'true' ) {
					event.done(event.data.action,{list: arg});
				}
				else {
                    //console.log("list arg");
                    //console.log(arg);
                    if (typeof(arg) === 'string') {
					    event.done(event.data.action,{list: arg});
                    }
                    else if (typeof(arg) === 'object') {
						if (arg.length < 3) return;
						//for (var i in arg) console.log(arg[i]);
						var xx = {};
                        if ( event.data.live && event.data.live === 'true') {
							if (arg[0] && arg[0].file)
    					    xx = { address: arg[arg.length -1].file, header: {'current': arg[arg.length -1].file, 'list': arg}};
                        }
                        else {
							if (arg[0] && arg[0].file)
    					    xx = { address: arg[0].file, header: {'current': arg[0].file, 'list': arg}};
                        }
                        LOG.debug("xx", l_name);
                        LOG.debug(xx, l_name);
		    		    event.done("SR_RESOURCE", xx);
                    }
				}
			}}; //end of var query =

			if ( event.data.live && event.data.live === 'true') {
				query.start = new Date();
				query.end = new Date(query.start);
				query.start.setMinutes(query.end.getMinutes()-1);
			}
			else {
				query.start = new Date(event.data.year, parseInt(event.data.month)-1, event.data.day, event.data.hour, event.data.minute, event.data.second, 0 );
				query.end = new Date(event.data.year, parseInt(event.data.month)-1, event.data.day, parseInt(event.data.hour)+1, parseInt(event.data.minute) , event.data.second, 0 );
			} 

			SR.Video.ffmpeg.query(query);
		break;
////////////////////////////////////////////////////////////////
        case 'retrieve':
			var path = SR.Video.Record.getRecordedFilePath(event.data.vid, event.data.fid);
			LOG.warn('retriving path: ' + path, l_name);
			event.done("SR_RESOURCE", {address: path, 
									   header: {}
			});
        break;
////////////////////////////////////////////////////////////////
				
		case "queryLiveBinaryByCameraId":
			LOG.warn(event.data , l_name);
			SR.DB.getData(l_dbVideoChannel, {camera_id: event.data.camera_id}, function(dat){
				LOG.warn("dat" , l_name);
				LOG.warn(dat , l_name);
				if ( dat.id ) {
					LOG.warn("dat.id channel id" , l_name);
					LOG.warn(dat.id , l_name);
					
				}
				else {
					
				}
			}, function(dat){
				event.done(event.data.action,{error: "DB failure"});
			}		);
			event.done(event.data.action,{});
			return;
			break;

		case "queryLiveBinary":
			//console.log("in queryLiveBinary /////////////////////////////////////////////////");
			SR.Video.ffmpeg.queryLive({id: event.data.id, type: event.data.type, num: event.data.num, onDone: function (re) {
				//console.log("re %j", re);
				if (typeof re.num === 'string') {
					re.num = parseInt(re.num);
				}
				if ( re.video ){ 
					//console.log("reply a binary file");
					var xx = { address: re.video, header: {'video-num':re.num}};
					event.done("SR_RESOURCE", xx);
					//console.log(xx);
				}
				else {
					//console.log("file not yet generated");
					event.done("readStreaming", {status: ['err', 'nomore']});
				}
			}});
			break;

		case "queryLive":
			SR.Video.ffmpeg.queryLive({id: event.data.id, type: event.data.type, onDone: function (re) {
				for (var i in re) delete re[i].stat;
				event.done(event.data.action, re);
				//console.log("re %j", re);
				//console.log(re);
			}});
			break;


		case 'camera_id2channel_id':

			break;

		case "playStored":
			if ( ! event.data.id && ! event.data.camera_id ) {
				event.done(event.data.action, {error: "no id and no camera_id"});
				return;
			}

			var start = new Date(event.data.year, parseInt(event.data.month)-1, event.data.day, event.data.hour, event.data.minute, event.data.second, 1 );
			var end = new Date(event.data.year, parseInt(event.data.month)-1, event.data.day, parseInt(event.data.hour), parseInt(event.data.minute)+1 , event.data.second, 1 );

			var query = {
				path: 'swap', 
				sortOption: "ctime", 
				rexmatch: new RegExp(event.data.id + "\/" + event.data.id), 
				reverse: false, 
				mtime: { start: start, end: end},
				outputFilenameOnly: true, 
				limit: 100,
				onDone: function (result) {
					if (result.length >1) {
						event.done('SR_RESOURCE', {address: result[0], header: {'video-num': event.data.num}, addition: result});
					}
					else {
						event.done("readStreaming", {status: ['err', 'nomore']});
					}
				}
			};
			
			switch (event.data.type) {
				case 'originalVideo':
					query.path = 'swap';
				break;
				case 'snapshot':
					query.path = 'web/snapshot';
				break;
				default:
				break;
			}
			LOG.warn(query , l_name);

			UTIL.findFiles(query);

			break;

			var path = event.data.id + "/" + event.data.id + "-startTS" + event.data.date + "-EndTS";
			if ( ! event.data.type ) {
				LOG.warn("no given type" , l_name);
				event.done("readStreaming", {status: ['err', 'nomore']});
				return;
			}
			switch (event.data.type) {
				case 'originalVideo':
					path = UTIL.userSettings("cacheAddress") + path + "-video-" + event.data.num + ".mp4";
				break;
				case 'snapshot':
					path = UTIL.userSettings("snapshotAddress") + path + "-image-" + event.data.num + ".jpg";
				break;
				default:
				break;
			}
			//console.log(UTIL.userSettings("snapshotAddress"));
			//console.log(UTIL.userSettings("cacheAddress"));
			//console.log("------------------- path: " + path);
			event.done('SR_RESOURCE', {address: path, header: {'video-num': event.data.num}});
			
			break;

		case "retrieveBinary":
			var path = event.data.id + "/" + event.data.id + "-startTS" + event.data.date + "-EndTS";
			if ( ! event.data.type ) {
				LOG.warn("no given type" , l_name);
				event.done("readStreaming", {status: ['err', 'nomore']});
				return;
			}
			switch (event.data.type) {
				case 'originalVideo':
					path = UTIL.userSettings("cacheAddress") + path + "-video-" + event.data.num + ".mp4";
				break;
				case 'snapshot':
					path = UTIL.userSettings("snapshotAddress") + path + "-image-" + event.data.num + ".jpg";
				break;
				default:
				break;
			}
			//console.log(UTIL.userSettings("snapshotAddress"));
			//console.log(UTIL.userSettings("cacheAddress"));
			//console.log("------------------- path: " + path);
			event.done('SR_RESOURCE', {address: path, header: {'video-num': event.data.num}});
			break;

		case "queryStored":
			if ( ! event.data.id) {
				event.done(event.data.action, {error: "no id"});
				return;
			}
			var limit = undefined;
			if ( event.data.limit && parseInt(event.data.limit) > 0 && parseInt(event.data.limit) < 1000 ) {
				limit = parseInt(event.data.limit);
			}

			var start = new Date(event.data.startYear, parseInt(event.data.startMonth)-1, event.data.startDay, event.data.startHour, event.data.startMinute, event.data.startSecond, 1 );
			var end = new Date(event.data.endYear, parseInt(event.data.endMonth)-1, event.data.endDay, event.data.endHour, event.data.endMinute, event.data.endSecond, 1 );

			var query = {
				path: 'swap', 
				sortOption: "ctime", 
				rexmatch: new RegExp(event.data.id + "\/" + event.data.id), 
				reverse: false, 
				mtime: { start: start, end: end},
				outputFilenameOnly: true, 
				limit: limit || 1000,
				onDone: function (result) {
					event.done(event.data.action, result);
				}
			};
			
			if (event.data.reverse && event.data.reverse === 'true') {
				query.reverse = true;
			}
			else {
				query.reverse = false;
			}

			switch (event.data.type) {
				case 'originalVideo':
					query.path = 'swap';
				break;
				case 'snapshot':
					query.path = 'web/snapshot';
				break;
				default:
				break;
			}
			LOG.warn(query , l_name);

			UTIL.findFiles(query);


			break;
	 //var startDateTime = [2014, 12, 22, 15, 55, 15];
	 //var endDateTime = [2014, 12, 22, 17, 29, 53];
			SR.Video.ffmpeg.queryStored(
				{ startDateTime: [ 
					parseInt( event.data.startYear ), 
					parseInt( event.data.startMonth ), 
					parseInt( event.data.startDay ), 
					parseInt( event.data.startHour), 
					parseInt( event.data.startMinute), 
					parseInt( event.data.startSecond)],
					endDateTime: [
					parseInt( event.data.endYear ), 
					parseInt( event.data.endMonth ), 
					parseInt( event.data.endDay ), 
					parseInt( event.data.endHour), 
					parseInt( event.data.endMinute), 
					parseInt( event.data.endSecond)],
			id: event.data.id, type: event.data.type, onDone: function (re) {
				//console.log("re %j", re);
				event.done(event.data.action, re);
			}});
			
			break;
				
		case "getOldestSearchable":
			event.done(event.data.action, SR.Video.ffmpeg.getOldestSearchable({}));
			break;

		case "getStatus":
			event.done(event.data.action, SR.Video.ffmpeg.getStatus({}));
			break;

		case "setSchedule":
			SR.Schedule.setTask({id: event.data.scheduleId, name: event.data.scheduleName, cycle: event.data.cycle, monthday: parseInt(event.data.monthday), weekday: event.data.weekday, hour: parseInt(event.data.hour), minute: parseInt(event.data.minute), do: event.data.channelId, description: event.data.description, /*callback: l_startRecord({}),*/ action: event.data.scheduleAction, onDone: function (arg) {

				var schedule = SR.Schedule.getStatus();
				LOG.debug(schedule, 'SR.Schedule');
				var taskPair = {};
				for (var i in schedule) {
					if (schedule[i].do) {
						if (! taskPair[schedule[i].do]) taskPair[schedule[i].do] = {};
						if (schedule[i].action === 'stopRecord') 
							taskPair[schedule[i].do].stopRecord = schedule[i];
						else if (schedule[i].action === 'startRecord') 
							taskPair[schedule[i].do].startRecord = schedule[i];

					}
				}
				LOG.debug(" ==== taskPair ====", 'SR.Schedule');
				LOG.debug(taskPair, 'SR.Schedule');
				for (var i in taskPair) {
					if (taskPair[i].startRecord && taskPair[i].stopRecord) {
						LOG.debug(" ==== " + i + "is a Pair ====", 'SR.Schedule');
						if (SR.Schedule.checkRange({start:taskPair[i].startRecord, end:taskPair[i].stopRecord}))
							SR.Schedule.triggerTask(i);

					}
				}

				event.done(event.data.action, {result: arg});
			}	});
			break;

		case "deleteSchedule": 
			SR.Schedule.deleteTask({id: event.data.scheduleId, onDone: function (arg) {
				event.done(event.data.action, {result: arg});
			}});
			break;

		case "suspendSchedule":
			SR.Schedule.suspendTask({id: event.data.scheduleId, onDone: function (arg) {
				event.done(event.data.action, {result: arg});
			}});
			break;

		case "resumeSchedule":
			SR.Schedule.resumeTask({id: event.data.scheduleId, onDone: function (arg) {
				event.done(event.data.action, {result: arg});
			}});
			break;

		case "listSchedule":
			event.done(event.data.action, {schedule: SR.Schedule.getStatus()});
			break;
			
		case 'ffmpegVerboseOn':
			SR.Video.ffmpeg.debug({action: 'ffmpegVerboseOn'});
			event.done(event.data.action, {});
			break;
		
		case 'ffmpegVerboseOff':
			SR.Video.ffmpeg.debug({action:'ffmpegVerboseOff'});
			event.done(event.data.action, {});
			break;
			
		case 'daemonStart':
			l_daemon({action:"start"});
			event.done(event.data.action, {});
			break;
			
		case 'daemonStop':
			l_daemon({action:"stop"});
			event.done(event.data.action, {});
			break;
			
		case 'daemonVerboseOn':
			l_daemon({action:"verboseOn"});
			event.done(event.data.action, {});
			break;
			
		case 'daemonVerboseOff':
			l_daemon({action:"verboseOff"});
			event.done(event.data.action, {});
			break;
			
		default:
			event.done("action=??", {"error": "Please assign a valid action."});
			break;
	}
}

SR.Callback.onStart(function () {
	l_daemon({action:"start"});
});

///////////////////////////////////////////////////////

var schedulePool = {};
SR.DB.useCollections([l_dbVideoSchedule]);

l_handlers.SR_VIDEO_SCHEDULE = function (event) {
	LOG.warn(event.data , l_name);
	switch (event.data.action){
		case 'setSchedule':

			//todo: check input

			var data = {
				id: event.data.id,
				cycle: event.data.cycle,
				monthday: parseInt(event.data.monthday),					
				weekday: event.data.weekday, 
				hour: parseInt(event.data.hour), 
				minute: parseInt(event.data.minute),
				do: event.data.do,
				suspend: false,
				description: event.data.description,
				latestExecuted: new Date(), 
				created: new Date(),
			};
			SR.Schedule.setTask(data); 
		break;

		case 'deleteSchedule':
		break;

		case 'getStatus':
				event.done("schedule", SR.Schedule.getStatus({}));
				return;
		break;
	}
	event.done("",{});


}

/* Note:
所有設定都寫入資料庫，並以資料庫為準，好處是當主機重開機時可讀回原來資料，另一方面多台主機時靠此資料庫同步大家的設定
但資料庫存取是有瓶頸的，不適合直接做計算，因此可以周期性或有需要的時候，把資料庫的內容讀一份暫存到記憶體，並且在記憶體處理。
因此，資料在放入資料庫前要先完整檢查正確性，以後從資料庫讀出就不再詳細檢查了，以維持效率和安全。
把資料庫讀到記憶體的動作應該自動完成，而不是讓使用者觸發了什麼 handler 之後去讀取。
因為使用者不去觸發，通常程式該做的事情還是要做。
*/

//-------------------------------------------------


//
//	SR.Video API
//

// default settings can be modified 
var ffmpegAutoReconnectThreshold = 3; // 自動重新連接 ffmpeg 失敗超過此值，即發通知
var maxListNum = 100;
var maxCacheNum = 5;

var conf = {
	path: {
		jpg: "store" + SR.Settings.SLASH + "jpg",
		mp4: "store" + SR.Settings.SLASH + "mp4",
		store: "store",
	},
	diskInsufficientAction: 'deleteOld',
	spareSpace: 3000, //spareThreshold: 7000, 
	criticalSpace: 2000, //criticalThreshold: 3000,
	callbackPool: {},
	diskFullAction: "deleteOld",
	convertingJob: {},
	//streamingQueues: {},
};


exports.getStreamingQueues = function (arg) {
	return conf.streamingQueues;
}

/////////////////////////////////
//// input: {action: }
////
/////////////////////////////////
exports.setDiskFullAction = function (arg) {
	if (!arg) {
		LOG.debug("in setDiskFullAction: no arg", l_name);
		return false;
	}

	if (!arg.action) {
		LOG.debug("in setDiskFullAction: no arg.action", l_name)
		return false;
	}

	switch (arg.action) {
		case 'deleteOld':
			conf.diskFullAction = arg.action;
			return true;
			break;

		case 'stopAll':
			conf.diskFullAction = arg.action;
			return true;
			break;

		default:
			LOG.debug("arg.action should be either deleteOld or stopAll", l_name);
			return false;
			break;
	}
}


var l_enabled = true;

var fs = require('fs');

//-----------------------------------------
// define local variables
//
//-----------------------------------------

// reference to video object
//var l_videoStreamPool = {}; // stores all channel
var l_videoStreamPool = SR.State.get('l_videoStreamPool');
var l_debug = {};
var l_status = {};

var spawn = require('child_process').spawn,
	exec = require('child_process').exec;

SR.Callback.onStart(function () {
	// make sure we have proper directories created
	exec("mkdir -pv " + conf.path.jpg + " " + conf.path.mp4, function (err, stdout, stderr) {});
});	
	
//-----------------------------------------
// define local functions
//
//-----------------------------------------
var l_videoLossEvent = function (arg) {
	LOG.debug("The video loss event is triggered. channel id: " + arg, l_name);
};

// test:$ fallocate -l 3G gentoo_root.img
conf.callbackPool.onNotify = function (arg) {
	LOG.debug("in SR.Video default onNotify, you can override this callback function. arg", l_name);
	LOG.debug(arg, l_name);
	return true;
}


exports.setNotify = function (arg) {
	if (!arg) {
		LOG.debug("no arg", l_name);
		return false;
	}

	if (!arg.onNotify || typeof(arg.onNotify) !== 'function') {
		LOG.debug("no onNotify", l_name);
		return false;
	}

	conf.callbackPool.onNotify = arg.onNotify;
	//LOG.debug( "================= SR.Video.ffmpeg.setNotify() is done.", l_name);
	return true;
}


exports.preserve = function (arg) {
	if (!arg) {
		LOG.debug("no arg", l_name);
		return false;
	}

	if (!arg.id) {
		LOG.debug("no id", l_name);
		return false;
	}

	if (!l_videoStreamPool[arg.id]) {
		LOG.debug("The assigned channel id does not exist.", l_name);
		return false;
	}

	if (!arg.action) {
		LOG.debug("in preserve: no arg.action", l_name);
		return false;
	}

	switch (arg.action) {
		case 'start':
			l_videoStreamPool[arg.id].preserve = true;
			return true;
			break;

		case 'stop':
			l_videoStreamPool[arg.id].preserve = false;
			return true;
			break;

		case 'get':
			return l_videoStreamPool[arg.id];
			break;

		default:
			break;
	}

}



exports.registerNotifyCallback = function (arg) {
	if (typeof(arg.onNotify) === 'function') {
		l_videoLossEvent = arg.onNotify;
	}
}


var l_pushStreaming = function (arg) {
	//status === streaming : to delete
	//status === recording : to preserve

	if (!l_videoStreamPool[arg.channelId]) return;
	obj = {
		status: l_videoStreamPool[arg.channelId].status,
		filename: arg.filename
	};


	if (l_videoStreamPool[arg.channelId].incoming) {
		l_videoStreamPool[arg.channelId].incoming.push(obj);
	}

	//LOG.debug( l_videoStreamPool[arg.channelId].incoming.length);
	if (l_videoStreamPool[arg.channelId].incoming && l_videoStreamPool[arg.channelId].incoming.length > 19) {

		for (var i in l_videoStreamPool[arg.channelId].incoming) {
			//LOG.debug( "i: " + i + " " + l_videoStreamPool[arg.channelId].incoming[i].status + " " + (parseInt(i)+1) + " " + l_videoStreamPool[arg.channelId].incoming[i].status);
			//if (l_videoStreamPool[arg.channelId].incoming[i+1].status === 'recording' ) LOG.debug( 'c');
			//else LOG.debug( 'd');
			if (l_videoStreamPool[arg.channelId].incoming[i].status === 'streaming') {
				if (l_videoStreamPool[arg.channelId].incoming[(parseInt(i) + 1)] && l_videoStreamPool[arg.channelId].incoming[(parseInt(i) + 1)].status === 'recording') {
					//LOG.debug( 'a');
					//LOG.debug( "defined as pre-recording");
					l_videoStreamPool[arg.channelId].incoming[i].status = 'pre-recording';
				} else {
					//LOG.debug( 'b');
				}
			} else {
				//LOG.debug( "do nothing");
			}
		}

		switch (l_videoStreamPool[arg.channelId].incoming[0].status) {
			case 'streaming':
				var x = l_videoStreamPool[arg.channelId].incoming.shift();
				setTimeout(function () {
					fs.unlink(x.filename, function (err) {
						if (err) //throw err;
							setTimeout(function () {
							fs.unlink(x.filename, function (err2) {});
						}, 2000);
					});
				}, 500);
				break;
			case 'pre-recording':
				var x = l_videoStreamPool[arg.channelId].incoming.shift();
				break;
			case 'recording':
				var x = l_videoStreamPool[arg.channelId].incoming.shift();
				break;
			default:
				LOG.error('error: video.js172', l_name);
				//process.exit(99);
				break;
		}
	}
};

var l_checkStreaming = function (id) {
	var formatData = {}
	if (l_videoStreamPool[id]) {
		formatData.connect = 1;
	} else {
		formatData.connect = 0;
	}
	return formatData;
};

var l_getCollection = function (clt_name, onFail) {}

var l_db_setChannel = function (data) {

	LOG.debug("l_db_setChannel: ", l_name);
	LOG.debug(data, l_name);

	// filtering??
	var x = {};
	if (data.id) {
		x.id = data.id
	};
	if (data.camera_id) {
		x.camera_id = data.camera_id
	};
	if (data.desc) {
		x.desc = data.desc
	};
	if (data.in) {
		x.in = data.in
	};
	if (data.out) {
		x.out = data.out
	};
	if (data.name) {
		x.name = data.name
	};
	if (data.status) {
		x.status = data.status
	};
	if (data.option) {
		x.option = data.option
	};

	SR.DB.updateData(l_dbVideoChannel, {
			id: data.id
		}, x,
		function () {
			//l_videoStreamPool[data.id] = x; //problem: clean the running ffmpeg process
			//LOG.debug( "db setdata success, l_videoStreamPool cache updated");
		},
		function () {
			LOG.debug("db setdata not success", l_name);
		});
}

var l_partiallyUpdate = function (origin, update) {
	if (Object.keys(update).length > 0) {
		for (var key in update) {
			if (update[key] || update[key] === '' || update[key] === 0) {
				origin[key] = update[key];
			};
		};
	};
};


function getTimestamp() {
	var date = new Date();
	var hour = date.getHours();
	hour = (hour < 10 ? "0" : "") + hour;
	var min = date.getMinutes();
	min = (min < 10 ? "0" : "") + min;
	var sec = date.getSeconds();
	sec = (sec < 10 ? "0" : "") + sec;
	var year = date.getFullYear();
	var month = date.getMonth() + 1;
	month = (month < 10 ? "0" : "") + month;
	var day = date.getDate();
	day = (day < 10 ? "0" : "") + day;
	return year + "" + month + "" + day + "-" + hour + "" + min + "" + sec;
}

////////////////////////////////
// Find the longest common starting substring in a set of strings
// input: ["strings"]
// output: string
////////////////////////////////
function sharedStart(array) {
	var A = array.slice(0).sort(),
		word1 = A[0],
		word2 = A[A.length - 1],
		L = word1.length,
		i = 0;
	while (i < L && word1.charAt(i) === word2.charAt(i)) {
		i++;
	}

	return word1.substring(0, i);
}


///////////////////////////// stable
// clean 'null' elements for an array
// input: array
// output: array
/////////////////////////////
function cleanArray(actual) {
	var newArray = new Array();
	for (var i = 0; i < actual.length; i++) {
		if (actual[i]) {
			newArray.push(actual[i]);
		}
	}
	return newArray;
}

///////////////////////////////// stable
// to check whether available partition space is sufficient or insufficient
// input: {videoDisk: ["mount point"], spare: number (MB), onDone: callback function}
// output:	
/////////////////////////////////
var checkDisk = function (cmd) {
	if (!cmd) {
		LOG.debug("error: cmd is necessary", l_name);
		return;
	}

	if (!cmd.videoDisk) {
		LOG.debug("error: no videoDisk", l_name);
		return;
	}

	if (typeof cmd.videoDisk !== 'object') {
		LOG.debug("error: videoDisk should be an array", l_name);
		return;
	}

	if (!cmd.spare) {
		LOG.debug("error: no spare", l_name);
		return;
	}
	//LOG.debug( typeof cmd.spare);
	if (typeof cmd.spare !== 'number') {
		LOG.debug("error: spare shoud be a number", l_name);
		return;
	}

	return;
	exec("df --block-size=M",
		function (error, stdout, stderr) {
			//LOG.debug( stdout);
			var list = stdout.split("\n");
			for (var i in list) {
				if (list[i] || typeof(list[i]) === 'string') {
					list[i] = cleanArray(list[i].split(" "));
				}
				//LOG.debug( "found / : " + list[i].indexOf("/"));
				for (var j in cmd.videoDisk) {
					if (list[i].indexOf(cmd.videoDisk[j]) == 5) {
						var partition = list[i][5];
						var remainingSpace = parseInt(list[i][3].replace("M", ""));
						//LOG.debug( partition + " remaining disk space: " + remainingSpace);
						//LOG.debug( typeof(remainingSpace) + " " + typeof(cmd.spare) + " " + typeof(cmd.critical));
						//LOG.debug( (remainingSpace) + " " + (cmd.spare) + " " + (cmd.critical));
						// 這裡要寫判斷是否空間不足
						if (remainingSpace < cmd.spare) {
							// 若空間不足，則執行 callback function
							//LOG.debug( "onInsufficientSpace");
							if (cmd && cmd.onInsufficientSpace && typeof cmd.onInsufficientSpace === 'function') {
								//LOG.debug( "running callback");
								cmd.onInsufficientSpace(partition);
							}
						} else if (remainingSpace < cmd.critical) {
							// 若空間不足，則執行 callback function
							//LOG.debug( "onCritical");
							if (cmd && cmd.onCritical && typeof cmd.onCritical === 'function') {
								//LOG.debug( "running callback");
								cmd.onCritical(partition);
							}
						} else {
							//LOG.debug( "enough space: " + list[i][5]);
						}
					}
				}
			}

			//LOG.debug( list);
		});

}




////////////////////////////////////// stable
// setChannel
// input: { id: channel_id "optional", in: ["rtsp://..."], out: ["output_filename"], descritpion: "", name: "" }
// output: true if success | false if not success | channel_id if new 
//////////////////////////////////////
exports.setChannel = function (data) {
	LOG.debug("SR.Video.ffmpeg.setChannel====================", l_name);
	LOG.debug(data, l_name);

	if (!data) {
		LOG.debug("no arg", l_name);
		return false;
	}

	//	if (!data.id ) {
	//		LOG.debug( "no arg.id");
	//		return false;
	//	}

	if (!data.in) {
		LOG.debug("no arg.in", l_name);
		return false;
	}


	//todo: 檢查是否已經有完全一樣內容的物件


	//todo: partial update
	if (data.id) {
		if (l_videoStreamPool[data.id]) {
			//delete l_videoStreamPool[data.id];
			//l_videoStreamPool[data.id] = {};
			//l_videoStreamPool[data.id] = data;
			l_partiallyUpdate(l_videoStreamPool[data.id], data);
			l_db_setChannel(l_videoStreamPool[data.id]); // problem
			data.onDone({
				id: data.id,
				message: "updated"
			});
			return true;
		} else {
			LOG.warn("incorrect id of channel", l_name);
			data.onDone({
				error: "id is invalid"
			});
			return false;
		}
	} else {
		if (data.options == "allowDuplication" || data.in[0] == 'stdin') {} else {
			// to check if
			for (var i in l_videoStreamPool) {
				if (l_videoStreamPool[i].hasOwnProperty('in') && data.hasOwnProperty('in') && l_videoStreamPool[i].in[0] === data.in[0]) {
					LOG.debug("duplicated input!", l_name);
					if (data.onDone && typeof data.onDone === 'function') {
						data.onDone({
							error: "duplicate"
						});
					}
					return false;
				}
			}
		}

		// to create a new channel
		var id = UTIL.createUUID();
		data.id = id;
		data.errorCount = 0;
		l_videoStreamPool[id] = data;
		l_db_setChannel(l_videoStreamPool[id]);
		if (data.onDone && typeof data.onDone === 'function') {
			data.onDone({
				id: data.id,
				message: "created"
			});
		}
		return id;
	}
}


/////////////////////////////////////// stable
// sync channel information from DB to memory and get available channels
// input: {id: channel_id}
// output {"channel information"} | false if not success | undefined if not exists | {"all channel information"} if channel_id not assigned
///////////////////////////////////////
var getChannel = exports.getChannel = function (channel_data) {
	//LOG.debug( "in exports.getChannel");

	if (!channel_data) {
		LOG.debug("no args", l_name);
		return false;
	}

	if (!channel_data.onDone) {
		LOG.debug("xxxxxxxxxxx no .onDone", l_name);
		return false;
	}

	if (!typeof channel_data.onDone === 'function') {
		LOG.debug("xxxxxxxxxxx .onDone is not a function", l_name);
		return false;
	}


	if (channel_data.id && typeof channel_data.id === 'string') {
		if (l_videoStreamPool[channel_data.id]) {
			channel_data.onDone(l_videoStreamPool[channel_data.id]);
		} else {
			l_reloadChannelCache(
				function () {
					if (l_videoStreamPool[channel_data.id]) {
						channel_data.onDone(l_videoStreamPool[channel_data.id]);
					} else {
						channel_data.onDone({});
					}
				}
			);
		}
	} else if (channel_data.in && typeof channel_data.in === 'string') {
		SR.DB.getArray(
			l_dbVideoChannel,
			function (db_data) {
				channel_data.onDone(db_data);
			},
			function (db_data) {
				LOG.debug("fail = query channel", l_name);
				LOG.debug(db_data, l_name);
				return false;
			}, {
				"in": {
					$in: [channel_data.in]
				}
			}
		);
	} else {
		l_reloadChannelCache(
			function () {
				channel_data.onDone(l_videoStreamPool);
			}
		);
	}
}


///////////////////////////////////////
// reload (sync) channel information from DB to memory
// input: onDone, passthroughData
// output passthroughData
///////////////////////////////////////
var l_reloadChannelCache = exports.reloadChannelCache = function (onDone, passthroughData) {

	if (typeof onDone !== 'function') {
		LOG.error("onDone is not a function", l_name);
		return false;
	}

	// load channel data from db
	SR.DB.getArray(
		l_dbVideoChannel,
		function (db_data) {
			//LOG.debug( "data restoring: %j", db_data);
			for (var i in db_data) {
				//LOG.debug( i);
				//LOG.debug( db_data[i]);
				l_videoStreamPool[db_data[i].id] = db_data[i];
				delete l_videoStreamPool[db_data[i].id]._id;
			}

			onDone(passthroughData);
		},
		function (db_data) {
			LOG.debug("fail = data restoring", l_name);
			LOG.debug(db_data, l_name);
			return false;
		}
	);
}


/////////////////////////////////////// stable
// delete a single channel 
// input: {id: "channel_id"} 
// output: true if success | false if not success
///////////////////////////////////////
exports.deleteChannel = function (data) {
	if (!data) {
		LOG.debug("no args", l_name);
		return false;
	}


	if (!data.id) {
		LOG.debug("id must be assigned", l_name);
		return;
	}

	if (!typeof data.id === 'string') {
		LOG.debug("id must be a string", l_name);
		return;
	}

	if (!l_videoStreamPool[data.id]) {
		LOG.debug("channel id does not exist", l_name);
		return;
	}

	if (l_videoStreamPool[data.id].status === "recording") {
		LOG.debug("Still Recording, going to l_record.stop() for ", data);
		l_record.stop(data);
		LOG.debug("Recording stopped for ", data);
	}

	if (l_videoStreamPool[data.id].status === "streaming") {
		LOG.debug("Still Streaming, going to l_stream.stop() for ", data);
		l_stream.stop(data);
		LOG.debug("Streaming stopped for ", data);
	}


	delete l_videoStreamPool[data.id];

	SR.DB.deleteData(l_dbVideoChannel,
		function (re) {
			LOG.debug("deleteData success", l_name);
		},
		function (re) {
			LOG.debug("deleteData fail", l_name);
		}, {
			id: data.id
		});
}


/////////////////////////////////////////
//
//
//
// SR.Video.ffmpeg.stdinWrite({id: , onData: function (arg) {} });
/////////////////////////////////////////
exports.stdinWrite = function stdinWrite(arg) {
	//LOG.debug( arg);
	if (!arg) {
		LOG.debug("no assigned arg ", l_name);
		return;
	}

	if (!arg.id) {
		LOG.debug("no assigned id ", l_name);
		return;
	}

	if (!l_videoStreamPool[arg.id]) {
		LOG.debug("not existing: " + arg.id, l_name);
		return;
	}

	arg.encode = arg.encode || 'binary';

	if (l_videoStreamPool[arg.id].process && l_videoStreamPool[arg.id].process.stdin) {
		//LOG.debug( "stdin --> ffmpeg");
		l_videoStreamPool[arg.id].process.stdin.write(arg.data, arg.encode);
	}

}



//////////////////////////////////////
// to start stream for a video channel 
// input: {id : 'id_string'}
// output: 
/////////////////////////////////////
var l_startStream = function (data) {
	if (!l_videoStreamPool[data.id]) {
		LOG.debug("The assigned channel id does not exist.", l_name);
		return false;
	}
	var url;
	if (l_videoStreamPool[data.id].hasOwnProperty('in')) {
		url = l_videoStreamPool[data.id].in[0];
	}
	//LOG.debug( "url");
	//LOG.debug( url);
	if (url === undefined || url === null) {
		LOG.debug("error: no input source", l_name);
		return;
	}

	if (!typeof url === 'string') {
		LOG.debug("url is not a string", l_name);
		return;
	}

	// 假設已有 stream 存在
	if (l_videoStreamPool[data.id] && l_videoStreamPool[data.id].process) {
		LOG.debug("already actived: " + data.id, l_name);
		return;
		//l_videoStreamPool[data.id].process.kill('SIGHUP');
	};

	if (l_videoStreamPool[data.id] && !l_videoStreamPool[data.id].incoming) {
		l_videoStreamPool[data.id].incoming = [];
	}

	var timestamp = getTimestamp();
	var mkdircmd = "mkdir -pv " + conf.path.jpg + SR.Settings.SLASH + data.id + " " + conf.path.mp4 + SR.Settings.SLASH + data.id;
	exec(mkdircmd, function (error, stdout, stderr) {});

	var commandDVR = {
		// ffmpeg 指令來源
		ffmpeg: 'avconv',
		// 影像輸入指令
		input: [
			'-y',
			'-loglevel', 'debug',
			'-c', 'h264', // ?
			'-f', 'm4v',
			'-i', 'pipe:0',
			// '-force_key_frames', '0,0.1',
			'-force_key_frames', 'expr:gte(t,n_forced*5)',
		],
		// 影像輸出指令
		output: [
			[
				// 前端串流用
				// '-c', 'copy', // ?
				//			'-map', '1:0', // 只取影像，若要取聲音請改成 0
				//'-map', '0',
				//			'-b:v', '128k',
				//'-vcodec', 'libx264',
				//			'-r', '20',
				//'-f', 'segment',
				//'-reset_timestamps', '1',
				//'-segment_time', '5', // 間隔 5 秒
				//			'-segment_atclocktime', '1',
				//'-segment_wrap', '100',
				//'-segment_list',  cacheAddress + data.id + "-xxx",
				//'-segment_list_size', '4',
				//'-segment_list_type', 'flat',
				//'-segment_list_flags', 'live',
				//'-segment_format', 'mp4',
				//cacheAddress + data.id + '/' + data.id + '_startTS' + timestamp + '-EndTS-video-%00001d.mp4',
				//'swap/' + '_%01d.mp4'
				//'-probesize','100000',
				//'-analyzeduration','100000',
			],
			[
				// 前端串流用
				// '-c', 'copy', // ?
				//			'-map', '1:0', // 只取影像，若要取聲音請改成 0
				'-map', '0',
				//			'-b:v', '128k',
				'-vcodec', 'libx264',
				//			'-r', '20',
				'-f', 'segment',
				'-reset_timestamps', '1',
				'-segment_time', '5', // 間隔 5 秒
				//			'-segment_atclocktime', '1',
				'-segment_wrap', '100',
				'-segment_list', conf.path.mp4 + SR.Settings.SLASH + data.id + "-segment_list",
				'-segment_list_size', '4',
				'-segment_list_type', 'flat',
				'-segment_list_flags', 'live',
				'-segment_format', 'mp4',
				//'-strftime', '1', 
				conf.path.mp4 + SR.Settings.SLASH + data.id + SR.Settings.SLASH + data.id + '_%01d.mp4',
				//'swap/' + '_%01d.mp4'
				//'-probesize','100000',
				//'-analyzeduration','100000',
			],
			[ // 前端顯示用 
				'-r', '1',
				'-f', 'image2',
				'-strftime', '1',
				conf.path.jpg + SR.Settings.SLASH + data.id + SR.Settings.SLASH + data.id + '_%Y%m%d-%H%M%S.jpg',
			]
		]
	};

	// 合併以上的指令陣列
	var optionDVR = commandDVR.input;
	for (var key in commandDVR.output) {
		optionDVR = optionDVR.concat(commandDVR.output[key]);
	};

	var command = 'ffmpeg';
	var option = [
		// 影像輸入指令
		'-y',
		'-loglevel', 'debug',
		'-rtsp_transport', 'tcp', // To force TCP is stable.
		'-i', l_videoStreamPool[data.id].in[0],
		'-force_key_frames', '0,0.1',
		// 影像輸出指令
		// // 前端串流用
		'-c', 'copy',
		//'-map', '0:0', // 只取影像，若要取聲音請改成 0
		//'-map','0', // 有取聲音， but 比較不穩
		//'-map', '0:0',
		'-f', 'ssegment',
		'-segment_time', '5', // 間隔 5 秒
		'-reset_timestamps', '1',
		'-segment_atclocktime', '1',
		'-segment_format', 'mp4',
		//'-segment_wrap', maxListNum,
		//'-segment_list', cacheAddress + data.id + "-segment_list",
		//'-segment_list_size', maxCacheNum - 1,
		//'-segment_list_type', 'flat',
		//'-segment_list_flags', 'live',
		//'-strftime', '1', 
		conf.path.mp4 + SR.Settings.SLASH + data.id + SR.Settings.SLASH + data.id + '_%01d.mp4',
		// 前端顯示用 
		'-r', '1',
		'-f', 'image2',
		'-strftime', '1',
		conf.path.jpg + SR.Settings.SLASH + data.id + SR.Settings.SLASH + data.id + '_%Y%m%d-%H%M%S.jpg',
	];

	var rtsp = true;
	if (url.match(/^rtsp:\/\//)) {
		rtsp = true;
	} else {
		rtsp = false;
		option = optionDVR;
	}

	l_videoStreamPool[data.id].defaultOption = option;

	l_videoStreamPool[data.id].ffmpegCommand = command + " " + option.join(' ');
	LOG.debug("ffmpeg command: " + command + " " + option.join(' '), l_name);
	//LOG.debug( "ffmpeg command: " + command + " " + option.join(' '));

	// 產生 ffmpeg 的 child process 並放入 l_videoStreamPool 中
	l_videoStreamPool[data.id].process = spawn(command, option);
	l_videoStreamPool[data.id].timestamp = timestamp

	var rename4date = function (arg) {
		//LOG.debug(  arg);
		var ts = UTIL.getDateTimeTS();
		var source = arg.filename;

		var target = '';
		if (source.indexOf(".mp4") > -1) {
			target = source.replace(/_.*\.mp4/, '_' + ts + ".mp4");
		} else if (source.indexOf(".jpg") > -1) {
			target = source.replace(/_.*\.jpg/, '_' + ts + ".jpg");
		} else {
			LOG.debug("input ERROR: " + source, l_name);
		}

		fs.rename(source, target, function (err) {
			if (err) {
				LOG.error(err);
				
				setTimeout(function () {
					//just for windows
					fs.rename(source, target, function (err) {
						if (err) {} else {
							l_pushStreaming({
								filename: target,
								channelId: data.id
							});
						}
					});
				}, 1200);
			} else {
				//LOG.debug( "success: " + source + " -> " + target );
				l_pushStreaming({
					filename: target,
					channelId: data.id
				});
			}
		});
		//}
	}


	// 正常資訊輸出
	l_videoStreamPool[data.id].process.stdout.on('data', function (dat) {
		//fs.appendFile(cacheAddress + data.id + "-ffmpeg-stdout", dat, function (err) { });
		//LOG.debug( 'stdout: ' + dat);
	});

	// 錯誤資訊輸出
	l_videoStreamPool[data.id].process.stderr.on('data', function (dat) {
		//todo: There is no error output if ffmpeg is not well installed. Should be done.

		//LOG.debug( 'stderr: ' + dat);
		fs.appendFile(conf.path.jpg + SR.Settings.SLASH + data.id + "-ffmpeg-stderr", dat, function (err) {});

		// to detect current filename when ffmpeg creates a new segment
		var da = dat.toString('utf8');
		if (da.indexOf(data.id) > -1 && da.indexOf("segment:") > -1 && da.indexOf("ended") > -1) {
			fs.appendFile(conf.path.jpg + SR.Settings.SLASH + data.id + "-ffmpeg-segment", da, function (err) {});
			var d = da.match(/segment:.*ended/);
			if (d && typeof(d) === 'object' && d[0]) {
				var filename = d[0].replace(/^segment:'/, '').replace(/' count:.* ended$/, '');
				//LOG.debug( '-' + filename + '-');
				rename4date({
					filename: filename,
					id: data.id
				});
			}
		}

		//for input format, codec detection

		if (l_videoStreamPool[data.id] && l_videoStreamPool[data.id].inputFormat) {

		} else {
			if (l_videoStreamPool[data.id]) l_videoStreamPool[data.id].inputFormat = {};
			else return;
		}

		if (da.indexOf("video codec set to:") > -1) {
			var vcodec = da;
			vcodec = vcodec.match(/video codec set to: .*\n/);
			if (vcodec && vcodec[0]) {
				vcodec = vcodec[0];
				vcodec = vcodec.replace('video codec set to: ', '').replace('\n', '');
				//LOG.debug( "------ video codec: " + vcodec);
				//l_videoStreamPool[data.id].inputFormat.vcodec = vcodec;
			}
		}

		if (da.indexOf("audio codec set to:") > -1) {
			var acodec = da;
			acodec = acodec.match(/audio codec set to: .*\n/);
			if (acodec && acodec[0]) {
				acodec = acodec[0];
				acodec = acodec.replace('audio codec set to: ', '').replace('\n', '');
				//LOG.debug( "------ video codec: " + vcodec);
				//l_videoStreamPool[data.id].inputFormat.acodec = acodec;
			}
		}

		if (da.indexOf(" Stream #0") > -1) {
			//LOG.debug( " Stream #0 da");
			var fps = da.match(/[0-9]* fps,/);
			//LOG.debug( fps);
			if (fps && typeof(fps) === "object" && fps[0]) {
				fps = fps[0].replace(' fps,', '');
				fps = parseInt(fps);
			}
			//LOG.debug( "------------ fps: " + fps);
			//LOG.debug( fps);
			if (!l_videoStreamPool[data.id].inputFormat.fps || l_videoStreamPool[data.id].inputFormat.fps < fps) {
				l_videoStreamPool[data.id].inputFormat.fps = fps;
			}

			var resolution = da.match(/ [0-9]*x[0-9]*,/);
			if (resolution && typeof(resolution) === 'object' && resolution[0]) {
				resolution = resolution[0].replace(' ', '').replace(',', '');
			}
			//LOG.debug( "------------- resolution: " + resolution);
			//LOG.debug( resolution);
			l_videoStreamPool[data.id].inputFormat.resolution = resolution;
		}

	});

	// ffmpeg child process 關閉時自動清除變數中的資料
	l_videoStreamPool[data.id].process.on('close', function (code) {
		LOG.warn('stream: ' + data.id + ' is down (cleaup and closing inotifywait)', l_name);

		//LOG.event();
		var pid = this.pid;
		try {
			for (var key in l_videoStreamPool) {
				//LOG.debug( ">>>>>> key %j", l_videoStreamPool[key]);
				//LOG.debug( ">>>>>> key " + key + " " + " " + pid);
				if (l_videoStreamPool[key] && l_videoStreamPool[key].process && l_videoStreamPool[key].process.pid)
					if (l_videoStreamPool[key].process.pid === pid) {
						// cleanup inotifywait
						if (l_videoStreamPool[key].inotifywait) {
							LOG.debug("closing inotifywait", l_name);
							//~ l_videoStreamPool[key].inotifywait.close( function (err) { if (err){LOG.debug( "Error when closing inotifywait: " + err)}} );
							//~ l_videoStreamPool[key].inotifywait.close();
							l_videoStreamPool[key].inotifywait.kill();
							delete l_videoStreamPool[key].inotifywait;
						};
						delete l_videoStreamPool[key].process;
					} else {
						//LOG.debug( "l_videoStreamPool[key].process.pid" + l_videoStreamPool[key].process.pid);
					};
			};
		} catch (e) {
			LOG.debug("error: process on close", l_name);
			LOG.debug(e, l_name);
		}
	});

	return true;
	
}

//////////////////////////////////////
//query : start, end time, cam_id, //for playback 
// input: {id: "channel_id", type: "snapshot | originalVideo | highResolution | lowResoluation", start: {year: 2014, month: 11, day: 11, hour: 11, minute: 11, second: 12}, end: {year: 2014, month: 12, day: 23, hour: 10, minute: 10, second: 10}
// output: {file: ["filename with url", ""], start: ["video's starting time"], length:["time length of video"] } 
//////////////////////////////////////
exports.queryStored = function (data) {

	if (!data) {
		LOG.debug("no args", l_name);
		return false;
	}

	if (!data.id) {
		LOG.debug("no arg.id", l_name);
		return false;
	}
	LOG.debug("in queryStored", l_name);
	LOG.debug(data, l_name);
	if (!data.onDone || typeof data.onDone !== 'function') {
		LOG.debug("incorrect callback must be assigned", l_name);
		return;
	}

	UTIL.findFiles({
		path: snapshotAddress + data.id,
		option: "mtime",
		onDone: function (result) {

		}
	});
	return;
}


////////////////////////////////////////
// query live snapshot or video 
// input: {id: ["channel_id"], type: "snapshot"}
// output: {["uri for snapshot or video"]} 
////////////////////////////////////////
exports.queryLive = function (data) {
	LOG.debug(data)

	if (!data) {
		LOG.debug("no args", l_name);
		return false;
	}

	if (!data.id) {
		LOG.debug("no arg.id", l_name);
		return false;
	}

	if (!data.type) {
		LOG.debug("no arg.type", l_name);
		return false;
	}

	if (!data.onDone) {
		LOG.debug("callback must be assigned", l_name);
		return;
	}

	if (!typeof data.onDone === 'function') {
		LOG.debug("callback function must be assigned", l_name);
		return;
	}

	switch (data.type) {

		case 'snapshot':
			//LOG.debug( "in queryLive snapshot--------");

			UTIL.findFiles({
				path: snapshotAddress + data.id,
				option: "ctime",
				rexmatch: /startTS/,
				reverse: true,
				outputArray: true,
				onDone: function (result) {
					//LOG.debug( "result");
					data.onDone(result);
				}
			});

			return;
			var cmd = 'ls -t ' + snapshotAddress + '' + data.id + "/" + data.id + "-" + "startTS" + l_videoStreamPool[data.id].timestamp + '*image*.jp*g | head ';
			//LOG.debug( cmd, l_name);
			exec(cmd,
				function (err, stdout, stderr) {
					//LOG.debug( "stdout" + stdout);
					var list = stdout.split('\n');
					LOG.debug(list);
					data.onDone({
						snapshotLive: list[1]
					});
				});
			break;

		case 'originalVideo':
			if (!l_videoStreamPool[data.id]) {
				LOG.debug("no assigned channel: " + data.id, l_name);
				return;
			}

			if (!l_videoStreamPool[data.id].timestamp) {
				LOG.debug("no timestamp", l_name);
				return;
			}

			// 這裡分成二種情況: 1)如果沒有指定 num 直接找倒數第二新檔; 2)如果有指定 num 則要判斷此檔之存在且非最新檔

			var cmd = 'ls -t ' + cacheAddress + '' + data.id + "/" + data.id + "-" + "startTS" + l_videoStreamPool[data.id].timestamp + '*video*.mp4 | head -5 ';
			//LOG.debug( "cmd:" + cmd);
			var assigned = cacheAddress + '' + data.id + "/" + data.id + "-" + "startTS" + l_videoStreamPool[data.id].timestamp + '-EndTS-video-' + data.num + '.mp4';
			//LOG.debug( "assigned: " + assigned);
			exec(cmd,
				function (err, stdout, stderr) {
					//LOG.debug( "stdout" + stdout);
					var list = stdout.split('\n');
					//LOG.debug( "list");
					//LOG.debug( list);
					var number = [];
					var position = 0;
					for (var i in list) {
						if (list[i]) {
							number[i] = list[i].match(/-video-.*.mp4/);
							number[i] = number[i][0].replace("-video-", "").replace(".mp4", "");

							if (assigned === list[i]) {
								position = i;
							}
						}
					}
					//LOG.debug( "number " + position);
					//LOG.debug( number);

					//LOG.debug( "num: " + number);
					var result = {};
					if (data.num) {
						// 為了防止取到 ffmpeg 仍在寫的檔案， list[0] 要避免使用
						if (position === 0) {
							result = {};
						} else if (position > 0) {
							result = {
								video: list[position],
								num: data.num,
								position: position
							};
							//LOG.debug( "result", l_name);
							//LOG.debug( result, l_name);
						}
						data.onDone(result);
					} else {
						result = {
							video: list[1],
							num: number[1],
							position: 1
						};
						//LOG.debug( "result", l_name);
						//LOG.debug( result, l_name);
						data.onDone(result);
					}
				});
			break;

		default:
			break;
	}


	if (data.id) {
		if (l_videoStreamPool[data.id]) {
			if (l_videoStreamPool[data.id].process) {

			} else {

			}
		} else {
			LOG.debug("The channel does not exist.", l_name);
			return false;
		}
	} else {
		LOG.debug("The channel id must be assigned.", l_name);
		return false;
	}


}


//////////////////////////////////
//
//
//
//////////////////////////////////
exports.query = function (arg) {
	LOG.debug("in SR.Video.ffmpeg.query arg:", l_name);
	LOG.debug(arg, l_name);

	if (!arg) {
		LOG.debug("no args", l_name);
		return false;
	}

	if (!arg.event_data) {
		LOG.debug("no arg.event_data", l_name);
		return false;
	}

	if (!arg.event_data.id) {
		LOG.debug("no arg.event_data.id", l_name);
		return false;
	}

	if (!arg.event_data.format) {
		LOG.debug("no arg.event_data.format", l_name);
		return false;
	}

	if (!arg.onDone) {
		LOG.debug("callback must be assigned", l_name);
		return;
	}

	if (!typeof arg.onDone === 'function') {
		LOG.debug("callback function must be assigned", l_name);
		return;
	}
	//if ( ! l_videoStreamPool[arg.id] ) {
	//	LOG.debug( "The assigned channel id does not exist.");
	//	return false;
	//}

	var query = {
		path: 'swap',
		sortOption: "mtime",
		rexmatch: new RegExp(arg.event_data.id + ".*" + arg.event_data.id),
		reverse: false,
		mtime: {
			start: arg.start,
			end: arg.end
		},
		outputFilenameOnly: false,
		limit: 500,
		onDone: function (result) {
			LOG.debug("============================= video result", l_name);
			LOG.debug(result, l_name);
			if (result.length > 1) {} else {
				result = "no result";
				//LOG.debug( "no result");
			}
			arg.onDone(result);
		}
	};

	switch (arg.event_data.format) {
		case 'jpg':
			query.path = conf.path.jpg;
			break;

		case 'mp4':
			query.path = conf.path.mp4;
			break;

		default:
			arg.onDone({
				error: "invalid format"
			});
			return false;
			break;
	}
	LOG.debug(new Date(), l_name);
	LOG.debug(query, l_name);

	UTIL.findFiles(query);
}


///////////////////////////////////////////
// set caption text for a channel
// input: {id: "channel_id", caption:["caption text"] }
// output: true if success | false if not success 
///////////////////////////////////////////
exports.setCaptionText = function (data) {}


///////////////////////////////////////////
// get caption text for a channel
// input: {id: "channel_id"}
//
///////////////////////////////////////////
exports.getCaptionText = function (data) {}


/////////////////////////////////////////
// return the oldest searchable video file
// 
/////////////////////////////////////////
exports.getOldestSearchable = function (arg) {
	return l_status.oldest;
}

var l_channel = exports.channel = {
	custom: function (arg) {
		LOG.debug("in SR.Video.ffmpeg.channel.custom.option", l_name);
		LOG.debug(arg, l_name);

		if (!arg) {
			LOG.debug("no arg", l_name);
			return false;
		}

		if (!arg.id) {
			LOG.debug("no arg.id", l_name);
			return false;
		}

		if (!arg.onDone) {
			LOG.debug("no arg.onDone", l_name);
			return false;
		}

		if (typeof(arg.onDone) !== 'function') {
			LOG.debug("The given arg.onDone is not a function.", l_name);
			return false;
		}


		if (!l_videoStreamPool[arg.id]) {
			LOG.debug("The assigned channel id does not exist.", l_name);
			return false;
		}
		l_partiallyUpdate(l_videoStreamPool[arg.id], arg);
		l_db_setChannel(l_videoStreamPool[arg.id]);

		arg.onDone();
		return true;
	},
}

////////////////////////////////////////////
//
//
//
////////////////////////////////////////////
var l_record = exports.record = {
	start: function (data) {
		LOG.debug("SR.Video.ffmpeg.record.start", l_name);
		if (!data) {
			LOG.debug("no arg", l_name);
			return false;
		}

		if (!data.id) {
			LOG.debug("no arg.id", l_name);
			return false;
		}

		if (!l_videoStreamPool[data.id]) {
			LOG.debug("The assigned channel id does not exist.", l_name);
			return false;
		}
		// to start preserve recording files
		l_videoStreamPool[data.id].status = "recording";
		l_db_setChannel(l_videoStreamPool[data.id]);
		LOG.debug(l_videoStreamPool);
		l_startStream(data);
	},
	stop: function (data) {
		LOG.debug("SR.Video.ffmpeg.record.stop", l_name);
		if (!data) {
			LOG.debug("no arg", l_name);
			return false;
		}

		if (!data.id) {
			LOG.debug("no arg.id", l_name);
			return false;
		}
		if (!l_videoStreamPool[data.id]) {
			LOG.debug("The assigned channel id does not exist.", l_name);
			return false;
		}
		// to start delete recording files
		l_videoStreamPool[data.id].status = "streaming";
		l_db_setChannel(l_videoStreamPool[data.id]);
		LOG.debug(l_videoStreamPool);
	},
	schedule: function (arg) {
		LOG.debug("SR.Video.ffmpeg.record.schedule", l_name);
	},
};

////////////////////////////////////////////
//
//
////////////////////////////////////////////
// NOTE: this is ffmpeg-based stream management
var l_stream = exports.stream = {
	/////////////////////////////////////// stable
	// starting a streaming for a channel
	// input: {id: "channel_id"}
	// output: true if success | false if not success 
	///////////////////////////////////////
	start: function (data) {
		LOG.debug("SR.Video.ffmpeg.stream.start", l_name);
		LOG.debug(data);
		if (!data) {
			LOG.debug("no arg", l_name);
			return false;
		}

		if (!data.id) {
			LOG.debug("no arg.id", l_name);
			return false;
		}

		if (!data.id) {
			LOG.debug("id must be assigned", l_name);
			return false;
		}

		if (typeof data.id !== 'string') {
			LOG.debug("error: id input must be a string", l_name);
			return false;
		} else if (!l_videoStreamPool[data.id]) {
			LOG.debug("error: profile is not existing", l_name);
			LOG.debug(l_videoStreamPool[data.id], l_name);
			return false;
		}

		l_videoStreamPool[data.id].status = "streaming";
		l_db_setChannel(l_videoStreamPool[data.id]);

		l_startStream(data);
		return true;
	},
	////////////////////////////////////// stable
	// stop a video streaming 
	// input: {id: channel_id}
	// output: true if exists a channel_id | false if exists no channel_id
	//////////////////////////////////////
	stop: function (data) {
		LOG.debug("SR.Video.ffmpeg.stream.stop", l_name);
		//stopStream(arg);
		//LOG.debug( data);
		if (!data) {
			LOG.debug("no arg", l_name);
			return false;
		}

		if (!data.id) {
			LOG.debug("id must be assigned", l_name);
			return false;
		}

		if (!l_videoStreamPool[data.id]) {
			LOG.debug("id does not exist", l_name);
			return false;
		}

		if (l_videoStreamPool[data.id].status === "recording") {
			LOG.debug("Still Recording, going to l_record.stop() for ", data);
			l_record.stop(data);
			LOG.debug("Recording stopped for ", data);
		}

		// 刪除 ffmpeg/inotifywait child process
		l_videoStreamPool[data.id].status = "off";
		l_db_setChannel(l_videoStreamPool[data.id]);
		if (l_videoStreamPool[data.id] && l_videoStreamPool[data.id].process && l_videoStreamPool[data.id].process.kill) {
			l_videoStreamPool[data.id].process.kill('SIGHUP');
		}
		if (l_videoStreamPool[data.id] && l_videoStreamPool[data.id].inotifywait) {
			LOG.debug("closing inotifywait");
			l_videoStreamPool[data.id].inotifywait.kill();
			delete l_videoStreamPool[data.id].inotifywait;
		}

		return true;
	},
	schedule: function (arg) {
		LOG.debug("SR.Video.ffmpeg.stream.schedule", l_name);

	},
};



///////////////////////////////////////////
// to stop all streaming channels
// 
//
///////////////////////////////////////////
var stopAllStream = exports.stopAllStream = function (data) {
	LOG.debug("to stop ALL streaming", l_name);
	for (var i in l_videoStreamPool) {
		if (l_videoStreamPool[i].status) {
			LOG.debug("to stop " + i, l_name);
			l_stream.stop({
				id: i
			});
		}
	}
}


// listGenerate -> convert -> 


l_convert = exports.stored = {
	convert: function (arg) {
		// to make a list.txt 
		//UTIL.
		LOG.debug("in SR.Video.ffmpeg.stored.list arg:", l_name);
		LOG.debug(arg, l_name);

		if (!arg) {
			LOG.debug("no arg", l_name);
			return false;
		}

		if (!arg.id) {
			LOG.debug("no arg.id", l_name);
			return false;
		}

		if (!arg.onDone) {
			LOG.debug("no arg.onDone", l_name);
			return false;
		}


		if (typeof(arg.onDone) !== 'function') {
			LOG.debug("The given onDone is not a function.", l_name);
			return false;
		}

		//if ( ! l_videoStreamPool[arg.id] ) {
		//	LOG.debug( "The assigned channel id does not exist.");
		//	return false;
		//}


		var query = {
			path: conf.path.mp4,
			sortOption: "mtime",
			rexmatch: new RegExp(arg.id + ".*" + arg.id),
			reverse: false,
			mtime: {
				start: arg.start,
				end: arg.end
			},
			outputFilenameOnly: true,
			limit: 1500,
			onDone: function (result) {
				var out = "";
				for (var i in result) out += "file '" + result[i] + "'\n";
				LOG.debug(out, l_name);
				SR.fs.writeFile('exportAVI.txt', out, function (err, written, string) {
					if (err) throw err;
					LOG.debug('converting video...', l_name);
					var cmd = conf.path.store + SR.Settings.SLASH + 'outputAVI' + current.toString() + '.avi';
					cmd = cmd.replace('(', '');
					cmd = cmd.replace(')', '');
					cmd = cmd.replace(':', '');
					cmd = cmd.replace(':', '');
					cmd = cmd.replace('+', '');
					cmd = cmd.replace(/ /gi, '');
					arg.onDone({
						list: result,
						output: cmd
					});
					var outputFilename = cmd;
					conf.convertingJob[outputFilename] = {
						status: "converting"
					};

					cmd = 'ffmpeg -f concat -i exportAVI.txt ' + cmd;
					LOG.debug(cmd, l_name + "_exportAVI");
					exec(cmd, function (err, stdout, stderr) {
						if (err) conf.convertingJob[outputFilename].status = "error";
						else conf.convertingJob[outputFilename].status = "converted";
						LOG.debug(stdout, l_name + "_exportAVI");
						LOG.debug(stderr, l_name + "_exportAVI");
					});
				});
			}
		};

		query.mtime.start = new Date(arg.year, parseInt(arg.month) - 1, arg.day, arg.hour, arg.minute, arg.second, 0);
		query.mtime.end = new Date(arg.year, parseInt(arg.month) - 1, arg.day, arg.hour, arg.minute, arg.second, 0);
		query.mtime.end.setMinutes(query.mtime.end.getMinutes() + parseInt(arg.length));
		var current = new Date();

		LOG.debug(new Date(), l_name);
		LOG.debug(query, l_name);

		UTIL.findFiles(query);
	},

	convertingStatus: function (arg) {
		fs.readdir(conf.path.store, function (err, files) {
			if (err) throw err;
			for (var i in files) {
				var regex = new RegExp(/\.avi$/);
				if (regex.test(files[i]) && !conf.convertingJob.hasOwnProperty(conf.path.store + SR.Settings.SLASH + files[i]))
					conf.convertingJob[conf.path.store + SR.Settings.SLASH + files[i]] = {
						status: "old"
					};
			}

		});
		return conf.convertingJob;


	},

	clearConverted: function (arg) {
		//to delete temp files.
		if (!arg) return {
			code: 1,
			verbose: "The given arg is invalid."
		};

		if (!arg.filename) return {
			code: 1,
			verbose: "The given arg.filename is invalid."
		};

		if (!conf.convertingJob[arg.filename]) return {
			code: 1,
			verbose: "The given filename is not existing."
		};

		SR.fs.unlink(arg.filename, function (err) {
			if (err) return {
				code: 1,
				verbose: "error: The given file cannot be deleted."
			};
			else return {
				code: 0,
				verbose: "The given file was deleted."
			};
			LOG.debug("The given file was deleted.", l_name);
		});
	},

	oldestAvailable: function (arg) {
		var basedir = conf.path.mp4;
		var structure = {};
		var x = new Date();

		var channelDir = SR.fs.readdirSync(basedir);
		LOG.debug(channelDir, l_name);
		for (var i in channelDir) {
			//structure[channelDir] = {files: vfiles};
			var vfiles = SR.fs.readdirSync(SR.path.join(basedir, channelDir[i]));
			structure[channelDir[i]] = {};
			for (var j in vfiles) {
				var fullFile = SR.path.join(basedir, channelDir[i], vfiles[j])
					//LOG.debug( fullFile, l_name);
					//continue;
				var rex = new RegExp(/_[0-9]*-[0-9]*.mp4$/);
				if (rex.test(fullFile)) {
					//LOG.debug( fullFile);
					var stat = SR.fs.statSync(fullFile);
					if (structure[channelDir[i]].oldestMtime) {
						//LOG.debug( fullFile + ' - ' + (x.getTime() - stat.mtime.getTime()));
						if (structure[channelDir[i]].oldestMtime.getTime() > stat.mtime.getTime()) {
							structure[channelDir[i]].oldestMtime = stat.mtime;
							structure[channelDir[i]].oldestFilename = fullFile;
						}
					} else {
						structure[channelDir[i]].oldestMtime = stat.mtime;
						structure[channelDir[i]].oldestFilename = fullFile;
					}
				} else {
					//var stat = SR.fs.statSync(fullFile);
					//LOG.debug( fullFile);
					//fs.unlink(fullFile, function (err) {
					//});
				}
			}
		}
		return structure;
	},

	export: function (arg) {


	},
	import: function (arg) {

	}
}


////////////////////////////////////
// to run some functions automatically
// input: "start" | "stop" 
// output: true if success | false if not success
////////////////////////////////////
var daemonX = {};
var l_daemon = function (data) {
	
	if (!data) {
		LOG.error("no arg", l_name);
		return false;
	}
	if (!data.action) {
		LOG.error("no arg.action", l_name);
		return false;
	}

	switch (data.action) {
		case 'start':
			daemonX.schedule = setInterval(function () {
				switch (l_enabled) {
					case false:
						//LOG.debug( "SR.Video.ffmpeg. is disabled.", l_name);
						return;
						break;

					case true:
						//LOG.debug( "SR.Video.ffmpeg. is enabled.");
						break;

					default:
						//LOG.debug( "SR.Video.ffmpeg. switch is broken.");
						break;
				}
				//LOG.debug( "daemon" + new Date());

				// 目前記憶體中 channel 數量
				var numberOfChannel = Object.keys(l_videoStreamPool).length;
				//LOG.debug( "number of channel: " + Object.keys(l_videoStreamPool).length);
				if (Object.keys(l_videoStreamPool).length == 0) {
					getChannel({
						onDone: function (arg) {}
					});
					return;
				}

				// 自動檢查 錄影 schedule 時間到了 


				// 自動檢查 磁碟空間接近不足 
				SR.Standalone.isEnoughDiskSpace({
					path: conf.path.mp4,
					M: 4096,
					onDone: function (err, enough, remaining) {
						if (err) {
							LOG.debug("error: please check SR.Standalone.isEnoughDiskSpace(", l_name);
						} else {
							l_status.diskSpace = {
								enough: enough,
								remaining: remaining
							};

							if (!enough) {
								LOG.debug("------- The remaining disk space is not enough. (delete old files)", l_name);
								LOG.debug(remaining);
								switch (conf.diskFullAction) {
									case 'deleteOld':
										var xx = {
											path: conf.path.store,
											sortOption: 'mtime',
											limit: 1000,
											outputFilenameOnly: true,
											onDone: function (result) {

												fs.appendFile(conf.path.store + '/deleted-log.txt', "\n--------------------\n" + '\n' + result, function (err) {});
												for (var i in result) {
													LOG.debug("to delete:" + result[i]);
													fs.unlink(result[i], function (err) {
														if (err) throw err;
														LOG.debug('deleted: ' + result[i]);
													});
												}
											}
										};
										LOG.debug(xx);
										UTIL.findFiles(xx);

										break;
									case 'stopAll':
										stopAllStream({});

										break;
									default:
										break;
								}

								if (remaining < -1024) {
									LOG.debug("------- The remaining disk space is not enough. (stop all streaming)", l_name);
									stopAllStream({});
								}
							}
						}
					}
				});

				// 自動清除 cache 

				// 自動重新連接本來應該連著的 channel 
				for (var key in l_videoStreamPool) {
					// 略過 DVR
					if (l_videoStreamPool[key].status && (l_videoStreamPool[key].status === 'streaming' || l_videoStreamPool[key].status === 'recording') && l_videoStreamPool[key].hasOwnProperty('in') && !l_videoStreamPool[key].process) {
						LOG.debug("auto-reconnecting " + key + " " + l_videoStreamPool[key].status + " " + l_videoStreamPool[key].autoReconnectCount, l_name);
						l_startStream({
							id: key
						});
						//todo: 如果以前重連失敗, 現在又重連成功, 則通知成功 

						if (typeof l_videoStreamPool[key].autoReconnectCount === 'number') {
							if (l_videoStreamPool[key].autoReconnectCount > ffmpegAutoReconnectThreshold) {
								// 自動重連數次失敗即通知，但只通知一次即可
								//l_videoLossEvent(l_videoStreamPool[key]);
								conf.callbackPool.onNotify({
									notify: "videoLoss",
									id: key
								});
								l_videoStreamPool[key].autoReconnectCount = 0;
							} else {
								l_videoStreamPool[key].autoReconnectCount++;
							}
						} else if (typeof l_videoStreamPool[key].autoReconnectCount === 'undefined') {
							l_videoStreamPool[key].autoReconnectCount = 0;
						}
					}
				}

			}, 7000);
			LOG.warn("SR.Video daemon started...", l_name);
			break;

		case 'stop':
			clearInterval(daemonX.schedule);
			LOG.warn("SR.Video daemon stopped...", l_name);
			break;

		default:
			LOG.warn("{ start | stop }", l_name);
			break;
	}
}


//////////////////////////////////// stable
// just for debug purpose 
// input: {action: "action"}
// output: none
////////////////////////////////////
exports.debug = function (data) {
	if (!data) {
		LOG.debug("no arg", l_name);
		return false;
	}
	if (!data.action) {
		LOG.debug("no arg.action", l_name);
		return false;
	}
	switch (data.action) {
		case 'ffmpegVerboseOn':
			LOG.debug("ffmpegVerbose on", l_name);
			l_debug.ffmpegVerbose = true;
			break;
		case 'ffmpegVerboseOff':
			LOG.debug("ffmpegVerbose off", l_name);
			l_debug.ffmpegVerbose = false;
			break;
		case 'show':
			LOG.debug(l_debug, l_name);
			LOG.debug(l_status, l_name);
			break;
		case 'verboseOn':
			l_debug.verbose = true;
			break;
		case 'verboseOff':
			l_debug.verbose = false;
			break;
		default:
			break;
	}
}

/*
待解問題:
磁碟空間不足執行刪檔或停止 由於舊檔會不斷被刪，因此要記錄目前可查詢的最舊檔日期

*/

// module init
l_module.start = function (config, onDone) {
	LOG.warn('video/ffmpeg module started...', l_name);
	UTIL.safeCall(onDone);
}

// module shutdown
l_module.stop = function (onDone) {
	UTIL.safeCall(onDone);
}

// make this global	
SR.Video.ffmpeg = exports;
