// Kurento-Media-Server 6.0 server manager demo
var util = require('util');
var kurento = require('kurento-client');
var kurentoClient = null;

// Recover kurentoClient for the first time.
function getKurentoClient(callback) {
    if (kurentoClient !== null) return callback(null, kurentoClient);

    kurento('ws://localhost:8888/kurento', function(error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " );
            return callback("Could not find media server at address. Exiting with error " + error);
        }

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

getKurentoClient(function(error, kurentoClient) {
    if (error) return callback(error);
	introspectionExample(kurentoClient);
});


function introspectionExample(kurentoClient) {
  if (!kurentoClient) {
    return console.error('Cannot instrospect using undefined or null kurentoClient');
  }

  //ServerManager is an object with the ability of providing introspection information.
  kurentoClient.getServerManager(function(error, serverManager) {
    if (error) return console.error('Error recovering ServerManager: ' + error);

	serverManager.getInfo(function(err, info){
		//console.log(err);
		//console.log(util.inspect(info,{showHidden: true, depth: null}));
	});

	serverManager.getSessions(function(err, info){
		//console.log(err);
		//console.log(util.inspect(info,{showHidden: true, depth: null}));
	});

    //This call returns an array of pipelines containing all existing pipelines in the KMS instance.
    serverManager.getPipelines(function(error, pipelines) {
      if (error) return console.error('Error gathering list of pipelines: ' + error);

	

      console.log("This KMS instance currently holds " + pipelines.length + ' pipelines');
		//console.log(util.inspect(pipelines,{showHidden: true, depth: null}));

      //Get through all pipelines and explore the media elements they comprise.
      for (var i = 0; i < pipelines.length; i++) {
        instrospectPipeline(pipelines[i]);
      }
    });
  });
}

function instrospectPipeline(pipeline) {
  if (!pipeline) return console.error('Cannot instrospect undefined or null pipeline');

	//release a specific pipeline
	if(pipeline.id === process.argv[2]) {
		console.log("Releasing pipeline: " + process.argv[2]);
		pipeline.release();
	}
  //console.log('Introspecting pipeline with ID ' + pipeline.id);


  //This call returns an array with all the MediaObjects in the pipeline.
  pipeline.getChilds(function(error, children) {
      if (error) return console.error('Error gathering list of pipelines: ' + error);

      console.log('\nThis pipeline ' + pipeline.id + ' has ' + children.length + ' media objects inside');

      for (var i = 0; i < children.length; i++) {
        var mediaObject = children[i];

        console.log('MediaObjectID: ' + mediaObject.id);
        if (mediaObject.id.indexOf('WebRtcEndpoint') > -1) {
          //console.log('(WebRtcEndpoint)');
        } else if (mediaObject.id.indexOf('PlayerEndpoint') > -1 || mediaObject.id.indexOf('RecorderEndpoint') > -1) {
          //console.log('(PlayerEndpoint)');
		  mediaObject.getUri(function(err, uri){
		    if(error) console.log('Error recovering uri ' + error);
			else console.log('URI: ' + uri + " mediaObject.id: " + mediaObject.id.split("/")[0]); 
		  });
        } else {
          //console.log('We do not have any specific handler for this media object type');
        }

      }
    });
  }




