


function SRVoice () {};

// init voice module
SRVoice.prototype.init = function (onDone) {
	LOG.warn('SR.Voice.init called');
	SR.safeCall(onDone);	
};

// dispose voice module
SRVoice.prototype.dispose = function (onDone) {
	LOG.warn('SR.Voice.dispose called');
	SR.safeCall(onDone);	
};

// subscribe a new voice channel
SRVoice.prototype.listen = function (channel, onDone) {
	
	SR.safeCall(onDone);	
};

// unsubscribe a voice channel
SRVoice.prototype.unlisten = function (channel, onDone) {
	
	SR.safeCall(onDone);	
};

// enable speaking to a given channel
SRVoice.prototype.speak = function (channel, onDone) {
	
	SR.safeCall(onDone);	
};

// disable speaking to a given channel
SRVoice.prototype.mute = function (channel, onDone) {
	
	SR.safeCall(onDone);	
};

// focus listening/speaking on a given channel
SRVoice.prototype.focus = function (channel, onDone) {
	
	SR.safeCall(onDone);	
};


var Voice = new SRVoice();
SR['Voice'] = (typeof Voice === 'object' ? Voice : {});


