/*
todo: 
判斷當磁碟空間即將不足時，自動停止錄影

*/

var streamEnvironment = {};

// constructor
function videoStream (obj) {
	streamEnvironment.status = 'ready';
	streamEnvironment.obj = obj;
	streamEnvironment.source = obj.source; 
	this.obj =obj;
	//getEnvironment({profileName: obj.profileName}); //這一行沒有用，因為物件會在還沒有初始化資料庫時被建立, 這一行要留著用來提醒 
	console.log("instance created");
}

videoStream.prototype.status = function (out) {
	console.log('streamEnvironment.status');
	console.log(streamEnvironment.status);
	console.log('streamEnvironment');
	console.log(streamEnvironment);
	out({'status': streamEnvironment.status});
}

videoStream.prototype.getLiveVideo = function (out) {
	out({liveVideo: streamEnvironment.liveVideo});
}

// require kentlai 
// git clone https://github.com/Kent-Lai/SR_ffmpeg_API.git
require("../SR_ffmpeg_API/imFfmpeg.js");

videoStream.prototype.startRecord = function (out) {
	
	streamEnvironment.imFfmpeg = create_imFfmpeg();

	streamEnvironment.imFfmpeg.on('start', function(commandLine) {
        	streamEnvironment.status = 'recording';
		LOG.event("recording start", {data: "test data"});
        	console.log('Spawned Ffmpeg with command: ' + commandLine);
		if (streamEnvironment.obj.onStart)
			if ( typeof streamEnvironment.obj.onStart === 'function')
				streamEnvironment.obj.onStart(commandLine);
		
	});
    
	streamEnvironment.imFfmpeg.on('codecData', function(data) {
        	console.log('Input is ' + data.audio + ' audio ' + 'with ' + data.video + ' video');
		if (streamEnvironment.obj.onCodecData)
			if ( typeof streamEnvironment.obj.onCodecData === 'function')
				streamEnvironment.obj.onCodecData(data);
	});
    
	streamEnvironment.imFfmpeg.on('progress', function(progress) {
        	//console.log('Processing: ' + progress.percent + '% done');
        	//console.log('Processing: ' + progress + '% done');
		if (streamEnvironment.obj.onProgress)
			if ( typeof streamEnvironment.obj.onProgress === 'function')
				streamEnvironment.obj.onProgress(progress);
	});
    
	streamEnvironment.imFfmpeg.on('error', function(err, stdout, stderr) {
        	streamEnvironment.status = 'error';
		LOG.event("recording error", {data: "test data"});
        	console.log('Cannot process video: ' + err.message);
		if (streamEnvironment.obj.onError)
			if ( typeof streamEnvironment.obj.onError === 'function')
				streamEnvironment.obj.onError(err, stdout, stderr);
	});
    
	streamEnvironment.imFfmpeg.on('end', function() {
        	streamEnvironment.status = 'ready';
		LOG.event("recording stop", {data: "test data"});
        	console.log('Transcoding succeeded !');
		if (streamEnvironment.obj.onEnd)
			if ( typeof streamEnvironment.obj.onEnd === 'function')
				streamEnvironment.obj.onEnd();
	});
  	
	streamEnvironment.imFfmpeg.addInput('rtsp://218.204.223.237:554/live/1/66251FC11353191F/e7ooqwcfbqjoo80j.sdp');
	//streamEnvironment.imFfmpeg.addInput(streamEnvironment.source);
	//var test_index = imFfmpeg.crnt_input_index;
	streamEnvironment.imFfmpeg.addInputOption("-t 100");
	
	streamEnvironment.imFfmpeg.add_output_with_segment_options({segment_time : 5, segment_list : "out_list"}, "./web/out.mp4", function (data) {
		if (data) {
			console.log('trigged when renamed: ' + data);
			LOG.event("recorded file", {filename: data});
			streamEnvironment.liveVideo = data;
		}
	});

	streamEnvironment.imFfmpeg.addOutputOption("-c:v copy");
	var out_nd_index = streamEnvironment.imFfmpeg.crnt_output_index;
	//LOG.warn("seg_opts_begin : " + imFfmpeg._currentOutput.seg_opts_begin + "\n");
        //LOG.warn("seg_opts_end : " + imFfmpeg._currentOutput.seg_opts_end + "\n");
	
    streamEnvironment.imFfmpeg.add_output("./web/out__.mp4");
	streamEnvironment.imFfmpeg.addOutputOption("-c:v copy");
        var out___index = streamEnvironment.imFfmpeg.crnt_output_index;
	// 此處有個問題待解: 如果要放字幕，會導致 cpu loading 太大，無法使用 -c:v copy，而(很嚴重的)造成計算秒數延遲，
		//var dt_args1 = {options : {box : 1, boxcolor : "black@0.2", fontcolor : "white", fontsize : 64, textfile : "wm_text.txt", reload : 1, x : "(w-tw)/2", y : "(h-th-lh)/2"}, outputs : "result"}
        //streamEnvironment.imFfmpeg.draw_text(dt_args1);

        //var dt_args2 = {options : {box : 1, boxcolor : "white@0.2", fontcolor: "black", fontsize : 64, text : "%{localtime}", x : 0, y : 0}, inputs : "add_wm_text", outputs : "result"}
        //streamEnvironment.imFfmpeg.draw_text(dt_args2);

        //streamEnvironment.imFfmpeg.split({options : 2, inputs : "result", outputs : ["cp1", "cp2"]});
        //streamEnvironment.imFfmpeg.map("cp1", out_nd_index);
        //var dup_outputs = [{name : "hello.mp4"}, {name : "hi.mp4", label : "kent"}, {name : "12345.mp4"}];
        //streamEnvironment.imFfmpeg.map("cp2", out___index);
        //var i;
        //for(i = 0; i < dup_outputs.length; i++)
        //{
        //        LOG.warn("dup_outputs " + i + " : " + dup_outputs[i].index + "\n");
        //}
	if (streamEnvironment.status === 'ready')	
	streamEnvironment.imFfmpeg.Run(function(err, stdout, stderr){
                        LOG.warn("stdout : " + stdout + "\n");
                        LOG.warn("stderr : " + stderr + "\n");
                        LOG.warn("err : " + err + "\n");
    });

	out({output: 'recording started'});
}

videoStream.prototype.stopRecord = function (out) {
	if (streamEnvironment.status === 'recording')	
		streamEnvironment.imFfmpeg.kill();
	out({output: 'recording stopped'});
}

// 記錄錄影資料
videoStream.prototype.setRecordedVideo = function (obj) {
	LOG.warn("setRecordedVideo trigged..");
	
	//SR.DB.setData("recordedVideo", obj, function(){}, function(){}); 
	SR.DB.updateData("recordedVideo", {"video_filename": obj.video_filename}, obj, function(){}, function(){});
	SR.DB.getData("recordedVideo", {}, function(data){console.log(data);}, function(){});
	SR.DB.count("recordedVideo", function(data){ console.log(data);}, function(){});
}

// 利用 event 查錄影資料 
videoStream.prototype.findVideoByEvent = function (obj) {
	
	
}

// 利用時間查錄影資料 
videoStream.prototype.findVideoByTime = function (obj) {
	SR.DB.getData("recordedVideo", obj, function(data){console.log(data);}, function(){});
	
}

// 給一段時間區間找錄影資料
videoStream.prototype.findVideoByPeriod = function (obj) {
	
	
}


// 記錄 camera information 
videoStream.prototype.setCameraInfo = function (input){
	SR.DB.setData("camera_info", 
				  {"serial number":input.sn, 
				   "camera number": input.name, 
				   "camera position": input.position,
				   "memo": input.position}, function(){},function(){});

}

// 取得 camera info 
videoStream.prototype.getCameraInfo = function (){
	return '';
}

// 設定基本環境
var setEnvironment = function (obj, onDone) {
	console.log(obj);
	SR.DB.updateData("streamEnvironment", {"profileName": obj.profileName}, obj, 
					 function(){onDone({status: "environment updated"});}, 
					 function(){});
}

var getEnvironment = function (obj, onDone) {
	if (! obj.profileName) obj.profileName = "default";
	SR.DB.getData("streamEnvironment", {"profileName": obj.profileName}, 
				  function(data){
					  console.log('getEnvironment');
					  streamEnvironment.savedProfile = data;
					  onDone(data);
					  //streamEnvironment.getEnvironment = data;
				  }, 
				  function(){});
}

videoStream.prototype.getEnvironment = getEnvironment;
videoStream.prototype.setEnvironment = setEnvironment;
global.videoStream = videoStream;

