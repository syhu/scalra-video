/* todo:
	auto-reconnect when disconnected
*/
var child_process = require("child_process");
var fs = require("fs");
var path = require("path");
var l_name = 'ffmpeg_recorder';


// collect all ffmpeg parameters here
var l_getPara = function (that, args) {
	
	return {
		
		hub: [
			'-y', 
			'-i', that.rtsp_url, 
			'-vcodec','copy',
			'-acodec','copy',
			'-f', 
			'h264', '-', 
			'-metadata', 'comment="hub"'
		],
		
		stdin_high: [
			'-pix_fmt', 'yuv420p',
			'-map','0',
			'-preset', 'ultrafast',
			'-tune', 'zerolatency',
			// '-profile:v', 'baseline',
			'-x264opts', 'crf=23:vbv-maxrate=10000:vbv-bufsize=10000:intra-refresh=1:slice-max-size=36000:keyint=30:ref=1',
			'-pass', '1',
			'-bf', '0',
			'-flags',
			'-loop',
			'-wpredp', '0',
			'-an',
			'-f', 'h264',
			'-',
			'-metadata', 'comment="broadway_high stdin"'
		],
		
		rtsp_high: [
			/* para set1
						'-pix_fmt', 'yuv420p',
						'-map','0',
						'-preset', 'ultrafast',
						'-tune', 'zerolatency',
						// '-profile:v', 'baseline',
						'-x264opts', 'crf=23:vbv-maxrate=10000:vbv-bufsize=10000:intra-refresh=1:slice-max-size=36000:keyint=30:ref=1',
						'-pass', '1',
						'-bf', '0',
						'-flags',
						'-loop',
						'-wpredp', '0',
						'-an',
						'-f', 'h264',
						'-',*/
			'-pix_fmt', 'yuv420p',
			'-map','0',
			'-preset', 'ultrafast',
			'-tune', 'zerolatency',
			// '-profile:v', 'baseline',
			'-x264opts', 'crf=23:vbv-maxrate=10000:vbv-bufsize=10000:intra-refresh=1:slice-max-size=36000:keyint=30:ref=1',
			'-pass', '1',
			'-bf', '0',
			'-flags',
			'-loop',
			'-wpredp', '0',
			'-an',
			'-f', 'h264',
			'-',	
			'-metadata', 'comment="broadway_high rtsp"'
		],
		
		stdin_low: [
			'-pix_fmt', 'yuv420p',
			'-map','0',
			'-preset', 'ultrafast',
			'-tune', 'zerolatency',
			// '-profile:v', 'baseline',
			'-x264opts', 'crf=23:vbv-maxrate=10000:vbv-bufsize=10000:intra-refresh=1:slice-max-size=36000:keyint=30:ref=1',
			'-pass', '1',
			'-bf', '0',
			'-flags',
			'-loop',
			'-wpredp', '0',
			'-an',
			'-vf', 'scale=176:120',
			'-f', 'h264',
			'-',
			'-metadata', 'comment="broadway_low stdin"'
		],
		
		rtsp_low: [
			'-pix_fmt', 'yuv420p',
			'-map','0',
			'-preset', 'ultrafast',
			'-tune', 'zerolatency',
			// '-profile:v', 'baseline',
			'-x264opts', 'crf=23:vbv-maxrate=10000:vbv-bufsize=10000:intra-refresh=1:slice-max-size=36000:keyint=30:ref=1',
			'-pass', '1',
			'-bf', '0',
			'-flags',
			'-loop',
			'-wpredp', '0',
			'-an',
			'-vf', 'scale=176:120',
			'-f', 'h264',
			'-',
			'-metadata', 'comment="broadway_low rtsp"'
		],
		
		stdin_ffserver: [
			'-pix_fmt', 'yuv420p', 
			'-map', '0', 
			'-preset', 'ultrafast',
			'-tune', 'zerolatency',
			// '-profile:v', 'baseline',
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
			args.ffm_url || that.ffserver_ffm,
			'-metadata', 'comment="ffserver stdin"'
		],
		
		rtsp_ffserver: [
			'-vcodec', 'copy',
			'-acodec', 'copy',
			'-f', 'h264',
			'-',
			args.ffm_url || that.ffserver_ffm,
			'-metadata', 'comment="ffserver rtsp"'
		],
		
		stdin_file: [
			'-vcodec', 'copy',
			'-acodec', 'copy',
			'-bsf:a', 'aac_adtstoasc',
			'-force_key_frames', '\"expr:gte(t,n_forced*9)\"',
			'-flags', '-global_header',
			'-segment_time', args.segment_time || that.segment_time,
			'-f', 'segment',
			'-segment_atclocktime','1',
			'-segment_time_delta','0.5',
			'-reset_timestamps','1',
//			save_path,
			'-metadata','comment="file stdin"'
		],
		
		rtsp_file: [
			'-vcodec', 'copy', '-acodec', 'copy',
			'-segment_time', args.segment_time || that.segment_time,
			'-f', 'segment',
			'-segment_atclocktime','1',
			'-segment_time_delta','0.5',
			'-reset_timestamps','1',
//			save_path,
			'-metadata','comment="file"'
		]	
	}
}



/*
	args: {
		rtsp_url:			'string',	// url for rtsp source
		segment_time:		'number',	// how long each segment is (seconds)
		dir:				'string',	// where to store segments
		broadway_channel:	'string',	// channel name to publish broadway streams
		record:				'string',	// prefix of file(s) to record
		ffserver_ffm:		'string',	// ffserver input
	}		
*/

function ffrec (args) {
	
	// NOTE: variable 'that' must sit within this function (not outside of), otherwise it will become a 
	//		 singleton variable (globally there's only ONE copy), which will cause problems 
	//		 when there are many instances of ffrec
	var that = this;
	var self = this;

	if (!args) {
		return;
	}
	
	// for direct rtsp streams
	if (typeof(args) == 'string') {
		that.rtsp_url = args;
	} else {
		
		// convert 'stdin' to ffmpeg internal parameter
		if (args.rtsp_url === 'stdin')
			args.rtsp_url = 'pipe:0';

		that.rtsp_url = args.rtsp_url || 'pipe:0';
	}

	that.segment_time = args.segment_time || 60;
	that.dir = args.dir || __dirname;
	that.video_id = args.video_id || args.vid;
	that.resolution = args.resolution || args.res;
	
	//that.ffmpeg_args = ['-y', '-loglevel', 'fatal', '-i', that.rtsp_url];

	that.broadway_channel = args.broadway_channel;
	that.record = args.record;
	that.ffserver_ffm = args.ffserver_ffm;
	
	// flag to indicate pause state (default to true)
	that.paused = true;
	
	// build parameters
	that.ffmpeg_para = l_getPara(that, args);
	
	////////////////////////////////////// ffmpeg_hub
	that.ffmpeg_hub = child_process.spawn('ffmpeg', that.ffmpeg_para['hub']);

	that.received_message_previous = 0;
	that.received_message_current = 1;
	setInterval(function(){
		//console.log("current_length:" + that.received_message_current + " previous:" + that.received_message_previous);
		if (that.received_message_previous === that.received_message_current) {
			LOG.error("video timeout: " + that.video_id + " " + that.resolution + " " + that.rtsp_url);
		} else {
			that.received_message_previous = that.received_message_current;
			//console.log(that );
		}
	}, 30 * 1000);
	
	that.ffmpeg_hub.stdout.on('data', function (data, encoding){

		that.received_message_current =+ data.length;

		// NOTE: pause flag does not affect file recording
		if (that.ffmpeg_attach_file && that.ffmpeg_attach_file.stdin.writable) {
			that.ffmpeg_attach_file.stdin.write(data, encoding);
		}
		if (!that.paused && that.ffmpeg_attach_broadway && that.ffmpeg_attach_broadway.stdin.writable) {
			that.ffmpeg_attach_broadway.stdin.write(data, encoding);
		}
		if (!that.paused && that.ffmpeg_attach_ffserver && that.ffmpeg_attach_ffserver.stdin.writable) {
			that.ffmpeg_attach_ffserver.stdin.write(data, encoding);
		}
	});
	
	that.ffmpeg_hub.stderr.on('data', function(data){
		// fs.appendFile('/tmp/ffhub.log', data, function(){});
	});
	
	that.ffmpeg_hub.on('close', function(code) {
		if (that.close_callback && typeof(that.close_callback) === 'function') {
			that.close_callback('source');
			delete that.ffmpeg_hub;
		}
	});

	//
	// pre-spawning ffmpeg for broadway pipelines
	//
	
	//////////////////////////////////////////////////// broadway pipelines
	var attach_ffmpeg_args = ['-y', '-loglevel', 'debug', '-i', 'pipe:0'];

	LOG.warn("URL:" + this.rtsp_url);

	if (args.resolution === 'High') {
		LOG.warn("spawning high-res broadway");

		try {
			if (this.rtsp_url === 'pipe:0') {
				this.ffmpeg_attach_broadway = child_process.spawn('ffmpeg', attach_ffmpeg_args.concat(that.ffmpeg_para['stdin_high']));
			} else {					
				this.ffmpeg_attach_broadway = child_process.spawn('ffmpeg', attach_ffmpeg_args.concat(that.ffmpeg_para['rtsp_high']));
			}
			
		} catch (err) {
			LOG.error(err);
		}
	}

	if (args.resolution === 'Low') {
		LOG.warn("spawning low-res broadway");
		
		if (this.rtsp_url === 'pipe:0') {
			this.ffmpeg_attach_broadway = child_process.spawn('ffmpeg', attach_ffmpeg_args.concat(that.ffmpeg_para['stdin_low']));
		} else {
			this.ffmpeg_attach_broadway = child_process.spawn('ffmpeg', attach_ffmpeg_args.concat(that.ffmpeg_para['rtsp_low']));
		}
	}
	
	this.ffmpeg_attach_broadway.stdout.on('data', function (data) {

		// we publish the processed streaming data to any number of potentially interested clients
		if (typeof(self.broadway_channel) === 'string') {
			if (SR && SR.Comm && typeof(SR.Comm.publish) == 'function') {
				// SR.Comm.publish(self.broadway_channel, data.toString('base64')); // FIXME: using binary data
				SR.Comm.publish(self.broadway_channel, data);
			}
		}
	});
	
	this.ffmpeg_attach_broadway.stderr.on('error', function (err) {
		// console.log(err);
	});
	
	this.ffmpeg_attach_broadway.stderr.on('data', function (err) {
		// console.log(err);
	});
	
	this.ffmpeg_attach_broadway.on('close', function (code) {
		if (typeof(this.close_callback) === 'function') {
			this.close_callback('broadway');
			delete this.ffmpeg_attach_broadway;
			LOG.error('abnormal: ffmpeg for broadway stream is closed.');
			process.exit(99);
		}
	});

}

ffrec.prototype.on = function (type, callback) {

	switch(type){
	case 'info':
		if (typeof(callback) === 'function') {
			this.info_callback = callback;
		}
	break;
	case 'segment_start':
		if (typeof(callback) === 'function') {
			this.segment_start_callback = callback;
			//console.log("reg start seg");
		}
	break;
	case 'segment_end':
		if (typeof(callback) === 'function') {
			this.segment_end_callback = callback;
			//console.log("reg end seg");
		}
	break;
	case 'stdout':
		if (typeof(callback) === 'function') {
			this.stdout_callback = callback;
			//console.log("reg close");
		}
	break;
	case 'close':
		if (typeof(callback) === 'function') {
			this.close_callback = callback;
			//console.log("reg close");
		}
	break;
	default:
	break;
	}
}

ffrec.prototype.close = function () {
	//console.log('kill');
	
	// close all ffmpeg
	this.detach();
	this.paused = true;

	try {
	
		if (this.ffmpeg_hub) {
			this.ffmpeg_hub.stdin.pause();
			process.kill(this.ffmpeg_hub.pid, "SIGHUP");		
		}
	
		if (this.ffmpeg_attach_broadway) {
			this.ffmpeg_attach_broadway.stdin.pause();
			process.kill(this.ffmpeg_attach_broadway.pid, "SIGHUP");
		}		
	
		if (this.ffmpeg_attach_ffserver) {	
			this.ffmpeg_attach_ffserver.stdin.pause();
			process.kill(this.ffmpeg_attach_ffserver.pid, "SIGHUP");
		}
		
	} catch (err) {
		LOG.error(err);
	}
	
	delete this.ffmpeg_hub;
	delete this.ffmpeg_attach_broadway;
	delete this.ffmpeg_ffserver_broadway;
}

ffrec.prototype.stdinWrite = function (data, encoding) {
	if (this.ffmpeg_hub && typeof(this.ffmpeg_hub.stdin.write) === 'function')
		this.ffmpeg_hub.stdin.write(data, encoding);
}


ffrec.prototype.attach = function (args, onDone) {
	var self = this;
	var that = this;
	
	//LOG.stack();
	var ffmpeg_args = ['-y', '-loglevel', 'debug', '-i', 'pipe:0'];
	// console.log(typeof(this.ffmpeg_hub.stdout.on));
	
	switch (args.method) {

	case 'broadway-high-res':
		this.broadway_channel = args.channel || '_default_';
		this.paused = false;
		UTIL.safeCall(onDone);			
		break;

	case 'broadway':
		this.broadway_channel = args.channel || '_default_';
		this.paused = false;
		UTIL.safeCall(onDone);
		break;

	case 'ffserver':
		LOG.warn("attaching ffserver:");
		if (this.rtsp_url === 'pipe:0') {
			this.ffmpeg_attach_ffserver = child_process.spawn('ffmpeg', ffmpeg_args.concat(that.ffmpeg_para['stdin_ffserver']));
		} else {
			this.ffmpeg_attach_ffserver = child_process.spawn('ffmpeg', ffmpeg_args.concat(that.ffmpeg_para['rtsp_ffserver']));
		}
		
		this.ffmpeg_attach_ffserver.stderr.on('data', function (data) {
			// fs.appendFile('/tmp/ffserver_ffm.log', data, function(){});
			var msg = data.toString();
			//console.log(/frame=/.test(msg));
			if (/frame=/.test(msg)) {
				if (typeof(onDone) === 'function') {
					onDone();
					onDone = undefined;
				}
			}
		});

		this.ffmpeg_attach_ffserver.on('close', function(code) {
			if (this.close_callback && typeof(this.close_callback) === 'function') {
				this.close_callback('rtsp');
				delete this.ffmpeg_attach_ffserver;
			}
		});

		break;

	case 'file':
		LOG.warn("attaching file:");
		var that = this;
		var save_path = path.resolve(args.dir, args.filename_prefix + '%07d.mp4');	
		var snapshot = ['-r','2','-f', 'image2', path.resolve(args.dir, args.filename_prefix + 'snapshot%07d.jpg')];
		
		if (!this.info) {
			this.info = {};
		}
	
		if (this.rtsp_url === 'pipe:0') {
			this.ffmpeg_attach_file = child_process.spawn('ffmpeg', ffmpeg_args.concat(that.ffmpeg_para['stdin_file'], [save_path],snapshot));
		} else {
			this.ffmpeg_attach_file = child_process.spawn('ffmpeg', ffmpeg_args.concat(that.ffmpeg_para['rtsp_file'], [save_path],snapshot));
		}

		this.snapshot_queue = [];
		fs.watch(args.dir, {presistent: true, recursive: true}, function (event, filename) {
			if (event === 'rename') return;
			if (filename.match(/.*jpg$/i)) {
				if (that.snapshot_queue[that.snapshot_queue.length-1] != filename) {
					that.snapshot_queue.push(path.resolve(args.dir,filename));
				}
				if (that.snapshot_queue.length >11) {
					var knock_out = that.snapshot_queue.shift();
					fs.stat(knock_out, function (err, stat) {
						if (!err) {
							fs.unlink(knock_out);
						}
					});
				}
				return;
			} else if (filename.match(/.*mp4$/i)) {
				return;
			} else {}
		});

		var del_old_snapshot = function (filename) {
			fs.stat(path.resolve(args.dir, filename), function (err, stat) {
				if (err) return;
				var mtime = new Date(stat.mtime);
				if (mtime < new Date(new Date() - 1*60000)) {
					fs.unlink(path.resolve(args.dir, filename));
				} else {
				}
			});
		}

		fs.readdir(args.dir, function (err, files) {
			if (err) return;
			for (var i in files) {
				var filename = files[i].slice(0);
				if (filename.match(/.*jpg$/i)) {
					del_old_snapshot(filename);
				}
			}
		});

		// NOTE: this is possibly some intensive processing of ffmpeg output, should find someone to remove it
		this.ffmpeg_attach_file.stderr.on('data', function (data) {
			//console.log(args.toString() + '\n');
			var stderr = data.toString('utf8').split('\n');
			// fs.appendFile('/tmp/ffmpeg_recorder.log', stderr);

			//console.log(stderr);
			//LOG.sys(stderr, l_name);

			for (var i in stderr) {
				// to recognize video information
				if (stderr[i].indexOf('Stream') > -1 && stderr[i].indexOf('Video') > -1) {
					if (!that.info.video) {
						//console.log(stderr[i]);
						that.info.video = stderr[i];
					}
				} else if (stderr[i].indexOf('Stream') > -1 && stderr[i].indexOf('Audio') > -1) {
					if (!that.info.audio) {
						//console.log(stderr[i]);
						that.info.audio = stderr[i];
						if (that.info_callback && typeof(that.info_callback) === 'function') {
							that.info_callback(that.info);
						}
					}
				}

				// to recognize segmentations
				if (stderr[i].indexOf('segment:') > -1) {
					var stder = stderr[i].match(/segment:.*' /);
					var stde = stder[0].replace(/'/ig,'').replace("segment:",'');

					if (stderr[i].indexOf('starts') > -1) {
						if (that.previous_start != stde) {
							UTIL.safeCall(that.segment_start_callback, UTIL.parsePath(stde));
						}
						that.previous_start = stde;
					}
					else if (stderr[i].indexOf('ended') > -1) {
						if (that.previous_end != stde) {
							UTIL.safeCall(that.segment_end_callback, UTIL.parsePath(stde));
						}
						that.previous_end = stde;
					}
				}
			}

		});
		this.ffmpeg_attach_file.on('close', function(code) {
			if (this.close_callback && typeof(this.close_callback) === 'function') {
				this.close_callback('recorder');
				delete that.ffmpeg_attach_file;
			}
		});
		break;
	default:
		console.log("wrong output");
		break;
	}
}

ffrec.prototype.detach = function (args) {

	if (args && args.method === 'broadway_high_res') {
		this.paused = true;
		return;
	} else if (args && args.method === 'broadway') {
		this.paused = true;
		return;
	}

	// setup the names to be detached
	// NOTE: if no arguments are given, we assume to detach ALL existing
	var names = (args && typeof args.method === 'string') ? [args.method] : ['broadway', 'ffserver', 'file'];
	
	for (var i=0; i < names.length; i++) {
		var name = names[i];
		var ffmpeg_name = 'ffmpeg_attach_' + name;
		
		if (this[ffmpeg_name] && this[ffmpeg_name].stdin) {
			LOG.warn('detaching ' + name, l_name);
			this[ffmpeg_name].stdin.pause();

			// this[ffmpeg_name].kill();
			try {
				process.kill(this[ffmpeg_name].pid, "SIGHUP");
			} catch (err) {
				LOG.error(err, l_name);
			}
			delete this[ffmpeg_name];
		}
	}
}

// get current pause state
ffrec.prototype.isPaused = function (args, onDone) {
	return this.paused;
	UTIL.safeCall(onDone, this.paused);
}

ffrec.prototype.pause = function (args, onDone) {
	this.paused = true;
	UTIL.safeCall(onDone);
}

ffrec.prototype.unpause = function (args, onDone) {
	this.paused = false;
	UTIL.safeCall(onDone);
}

ffrec.prototype.getSnapshot = function (args, onDone) {
	UTIL.safeCall(onDone, this.snapshot_queue);
}

module.exports = ffrec;
