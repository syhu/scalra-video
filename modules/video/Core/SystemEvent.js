//防止重覆定義
this.__SYSTEM_EVENT_JS;
if (this.__SYSTEM_EVENT_JS === undefined)
{
    this.__SYSTEM_EVENT_JS = true;

    //Server事件處理
    function ServerEvent()
    {
        //開起Server事件
        this.evtServerOpen = new EventSender();
        //關閉Server事件
        this.evtServerClose = new EventSender();
        //用戶連線事件
        this.evtUserOn = new EventSender();
        //用戶斷線事件
        this.evtUserOff = new EventSender();
    };
    //Server開啟
    ServerEvent.prototype.addServerOpen = function(i_onDone)
    {
        this.evtServerOpen.register(i_onDone);
    };
    //Server關閉
    ServerEvent.prototype.addServerClose = function(i_onDone)
    {
        this.evtServerClose.register(i_onDone);
    };
    //新增用戶連線
    //int i_connId:  連線編號
    ServerEvent.prototype.addUserOn = function(i_onDone)
    {   //由後面加入
        this.evtUserOn.register(i_onDone);
    };
    //用戶斷線
    //int i_connId:  連線編號
    ServerEvent.prototype.addUserOff = function(i_onDone)
    {   //由前端加入
        this.evtUserOff.register(i_onDone, true);
    };
    //---------------------------------------------------------------
    //Server開啟
    ServerEvent.prototype.onServerOpen = function()
    {
        this.evtServerOpen.publish();
    };
    //Server關閉
    ServerEvent.prototype.onServerClose = function()
    {
        this.evtServerClose.publish();
    };
    //用戶連線
    //int i_connId:  連線編號
    ServerEvent.prototype.onUserOn = function(i_conn)
    {
        if (i_conn == undefined)
            return;
        this.evtUserOn.publish(i_conn);
    };
    //用戶斷線
    //int i_connId:  連線編號
    ServerEvent.prototype.onUserOff = function(i_conn)
    {
        if (i_conn == undefined)
            return;
        this.evtUserOff.publish(i_conn);
    };
 
    //公開物件
    if (typeof require !== 'undefined')
    {
        global.sysEvent = new ServerEvent();
    }

    SR.Callback.onStart(function ()
    {
        log.Text(' sysEvent.onServerOpen');
        sysEvent.onServerOpen();
    });

    SR.Callback.onStop(function ()
    {
        log.Text('sysEvent.onServerClose');
        sysEvent.onServerClose();
    });

    SR.Callback.onConnect(function (connObj)
    {
        log.Text("sysEvent.onUserOn() 用戶上線 connObj.connID = " + connObj.connID);
        sysEvent.onUserOn(connObj);
    });

    SR.Callback.onDisconnect(function (connObj)
    {
        log.Text("sysEvent.onUserOff() 用戶離線 connObj.connID = " + connObj.connID);
        sysEvent.onUserOff(connObj);
    });
}