/*
	voice.js

	multi-party voice module
	history:
		2016-04-02	init
	
*/

// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};
var l_name = 'SR.Voice';


//
// exported API
//

// module init
l_module.start = function (config, onDone) {
	LOG.warn('voice module started...', l_name);	
	
	// handle signaling server
	var server_type = (config.secured === true ? 'HTTPS' : 'HTTP');
	
	if (SR.REST.server.hasOwnProperty(server_type) === false) {
		var errmsg = server_type + ' server not yet created';
		LOG.error(errmsg, l_name);
		return UTIL.safeCall(onDone, errmsg);
	}
	
	var server = SR.REST.server[server_type];
	
	// get an instance of http or https server
	require('./voice/Signaling-Server.js')(server, function (socket) {
		try {
			var params = socket.handshake.query;
	
			// "socket" object is totally in your own hands!
			// do whatever you want!
	
			// in your HTML page, you can access socket as following:
			// connection.socketCustomEvent = 'custom-message';
			// var socket = connection.getSocket();
			// socket.emit(connection.socketCustomEvent, { test: true });
	
			if (!params.socketCustomEvent) {
				params.socketCustomEvent = 'custom-message';
			}
	
			socket.on(params.socketCustomEvent, function(message) {
				try {
					socket.broadcast.emit(params.socketCustomEvent, message);
				} catch (e) {}
			});
		} catch (e) {}
	});

	UTIL.safeCall(onDone);
}

// module shutdown
l_module.stop = function (onDone) {
	UTIL.safeCall(onDone);
}

// make this global	
SR.Voice = exports;
