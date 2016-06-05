
//防止重覆定義
this.__AE_LOG_JS;
if (this.__AE_LOG_JS === undefined)
{
    this.__AE_LOG_JS = true;
    //歷史紀錄
    function Log() { };
    /// <summary>記錄程式歷程</summary>
    /// <param name="i_str">歷程字串</param>
    Log.prototype.Text = function(i_str)
    {
        if (typeof require === 'undefined')
            document.write(i_str + '<br/>');
        else
            LOG.debug(i_str, "T");
    };
    /// <summary>警告: 發生錯誤 不可處理運行.</summary>
    /// <param name="i_str">警告字串</param>
    Log.prototype.Error = function(i_str)
    {
        if (typeof require === 'undefined')
            document.write("錯誤: " + i_str + '<br/>');
        else
            LOG.error(i_str, "E");
    };
    /// <summary>警告: 發生錯誤 可作處理繼續運行.</summary>
    /// <param name="i_str">警告字串</param>
    Log.prototype.Warning = function(i_str)
    {
        if (typeof require === 'undefined')
            document.write("警告: " + i_str + '<br/>');
        else
            LOG.warn(i_str, "W");
    };


    /// <summary>JSON</summary>
    /// <param name="i_str">字串</param>
    /// <param name="i_obj">物件</param>
    Log.prototype.Json = function(i_str, i_obj)
    {
        if (typeof require !== 'undefined')
        {
            var l_obj = {};
            for (var item in i_obj)
                if (typeof i_obj[item] !== 'function')
                    l_obj[item] = i_obj[item];
            LOG.warn(i_str + " = " + JSON.stringify(l_obj), "J");
        }
    };
    /// <summary>Obj</summary>
    /// <param name="i_str">字串</param>
    /// <param name="i_obj">物件</param>
    Log.prototype.Obj = function(i_str, i_obj)
    {
        var obj_str = '';
        for (var key in i_obj)
            obj_str += (key + ': ' + i_obj[key] + '\n');

        if (typeof require !== 'undefined')
            LOG.warn(i_str + " = \n" + obj_str, "Log.Obj");
    };

    /// <summary>Obj</summary>
    /// <param name="i_str">字串</param>
    /// <param name="i_obj">物件</param>
    Log.prototype.ObjData = function (i_str, i_obj)
    {
        var obj_str = '';
        for (var key in i_obj)
            if (typeof i_obj[key] !== 'function')
                obj_str += (key + ': ' + i_obj[key] + '\n');

        if (typeof require !== 'undefined')
            LOG.warn(i_str + " = \n" + obj_str, "Log.Obj");
    };

    if (typeof require !== 'undefined')
    {
        global.log =  new Log();
    }
}