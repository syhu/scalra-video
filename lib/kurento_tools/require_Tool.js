function addScriptJs(i_strFilejs)
{
	document.write('<script type="text/javascript" src="' + i_strFilejs + '"></script>');
}

if (!window.jQuery)
{
	addScriptJs("/lib/kurento_tools/jquery/dist/jquery.min.js");
}

addScriptJs("/lib/kurento_tools/bootstrap/dist/js/bootstrap.min.js");
addScriptJs("/lib/kurento_tools/adapter.js/adapter.js");
addScriptJs("/lib/kurento_tools/kurento-utils/js/kurento-utils.js");
addScriptJs("/lib/sockjs/sockjs.min.js");
addScriptJs("/lib/SR_REST.js");
addScriptJs("/lib/SR_Video.js");
addScriptJs("config.js");
