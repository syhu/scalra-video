//防止重覆定義
this.__COMMON_EVENT_JS;
if (this.__COMMON_EVENT_JS === undefined)
{
    this.__COMMON_EVENT_JS = true;
    /*
        可以新增事件處理
        讓每個子系統都可以使用這些觸發事件
    */
    //發佈事件
    function EventSender()
    {
        this.funAr = [];
    };
    //發佈
    //object i_data: 物件 或 變數
    EventSender.prototype.publish = function (i_data)
    {
        var l_funAr = this.funAr;
        var l_iLoop = 0;
        while (l_iLoop < l_funAr.length)
        {
            l_funAr[l_iLoop](i_data);
            ++l_iLoop;
        }
    }
    //註冊事件
    //function i_fun:   函式指標
    //bool i_bFront:    是否由前加入
    EventSender.prototype.register = function (i_fun, i_bFront)
    {
        if (typeof i_fun !== 'function')
            return;

        if (i_bFront == true)
            this.funAr.unshift(i_fun);
        else
            this.funAr.push(i_fun);
    }
    //註銷事件
    //function i_fun:   函式指標
    EventSender.prototype.unregister = function (i_fun)
    {
        if (typeof i_fun !== 'function')
            return;

        var l_funAr = this.funAr;
        var l_iLoop = 0;
        while (l_iLoop < l_funAr.length)
        {
            if (l_funAr[l_iLoop] == i_fun)
            {
                l_funAr.slice(l_iLoop, 1);
                break;
            }
            ++l_iLoop;
        }
    }
    
    //公開物件
    if (typeof require !== 'undefined')
    {
        global.EventSender = EventSender;
    }
}