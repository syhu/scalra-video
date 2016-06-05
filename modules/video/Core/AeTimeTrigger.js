
//防止重覆定義
this.__AE_TIME_TRIGGER_JS;
if (this.__AE_TIME_TRIGGER_JS === undefined)
{
    this.__AE_TIME_TRIGGER_JS = true;

    //時間觸發器
    function TimeTrigger()
    {
        //每秒鐘 觸發
        this.evtSec = new EventSender();
        //每分鐘 整點觸發 回傳分鐘
        this.evtMin = new EventSender();
        //每小時 整點觸發 回傳小時
        this.evtHour = new EventSender();
        //每天 整點觸發 回傳日期
        this.evtDate = new EventSender();
        //每星期 整點觸發 回傳星期
        this.evtDay = new EventSender();
        //每月 整點觸發 回傳月
        this.evtMonth = new EventSender();
    };
    //每秒鐘 觸發
    TimeTrigger.prototype.addSec = function (o_onDone)
    {
        this.evtSec.register(o_onDone);
    };
    //每分鐘 整點觸發
    TimeTrigger.prototype.addMin = function (o_onDone)
    {
        this.evtMin.register(o_onDone);
    };
    //每小時 整點觸發
    TimeTrigger.prototype.addHour = function (o_onDone)
    {
        this.evtHour.register(o_onDone);
    };
    //每天 整點觸發
    TimeTrigger.prototype.addDate = function (o_onDone)
    {
        this.evtDate.register(o_onDone);
    };
    //每星期 整點觸發
    TimeTrigger.prototype.addDay = function (o_onDone)
    {
        this.evtDay.register(o_onDone);
    };
    //每月 整點觸發
    TimeTrigger.prototype.addMonth = function (o_onDone)
    {
        this.evtMonth.register(o_onDone);
    };

    if (typeof require !== 'undefined')
    {
        global.timeTrigger = new TimeTrigger();
    }

    //每秒鐘觸發
    setInterval(function ()
    {
        var l_date = new Date();
        timeTrigger.evtSec.publish(l_date.getSeconds());
        if (l_date.getSeconds() == 0)
        {
            timeTrigger.evtMin.publish(l_date.getMinutes());
            if (l_date.getMinutes() == 0)
            {
                //CollectGarbage();   //記憶體釋放
                timeTrigger.evtHour.publish(l_date.getHours());
                if(l_date.getHours() == 0)
                {
                    timeTrigger.evtDate.publish(l_date.getDate());
                    timeTrigger.evtDay.publish(l_date.getDay());
                    if(l_date.getDate() == 1)
                    {
                        timeTrigger.evtMonth.publish(l_date.getMonth()+1);
                    }
                }
            }
        }
    }, 1000);
}

