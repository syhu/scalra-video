
//防止重覆定義
this.__AE_DATE_JS;
if (this.__AE_DATE_JS === undefined)
{
    this.__AE_DATE_JS = true;

    //時間
    function AeDate(i_date)
    {
        //日期物件
        this.date = new Date();
        //年份
        this.iYear = 1970;
        //月份
        this.iMonth = 1;
        //日期
        this.iDate = 1;
        //星期
        this.iDay = 0;
        //小時
        this.iHours = 0;
        //分鐘
        this.iMinutes = 0;
        //秒鐘
        this.iSeconds = 0;
        //毫秒
        this.iMilliseconds = 0;


        if (i_date != undefined)
            this.into(i_date);
        else
            this.create();
    };
    //初始化
    AeDate.prototype.into = function(i_data)
    {
        if (typeof i_data == "number")
        {
            this.iYear = Math.floor(i_data / 10000000000);
            //this.iYear %= 100;//年表示 1999 =  99
            //this.iYear += 100;//年表示 2014 = 104
            i_data %= 10000000000;
            this.iMonth = Math.floor(i_data / 100000000);
            --this.iMonth;//月份從 0 起頭
            i_data %= 100000000;
            this.iDate = Math.floor(i_data / 1000000);
            i_data %= 1000000;
            this.iHours = Math.floor(i_data / 10000);
            i_data %= 10000;
            this.iMinutes = Math.floor(i_data / 100);
            i_data %= 100;
            this.iSeconds = i_data;

            //日期物件
            this.date = new Date(this.iYear, this.iMonth, this.iDate,
                this.iHours, this.iMinutes, this.iSeconds, 0);
        }

        this.reset();
    };
    //重新設定
    AeDate.prototype.reset = function()
    {
        this.iYear = this.date.getFullYear();
        this.iMonth = this.date.getMonth() + 1;
        this.iDate = this.date.getDate();
        this.iDay = this.date.getDay();
        this.iHours = this.date.getHours();
        this.iMinutes = this.date.getMinutes();
        this.iSeconds = this.date.getSeconds();
        this.iMilliseconds = this.date.getMilliseconds();
    };
    //創造
    AeDate.prototype.create = function()
    {
        var l_data = this.date = new Date();
        this.reset();
    };
    //取得日期
    AeDate.prototype.getDate = function()
    {
        return this.iMonth + "/" + this.iDate;
    };
    //取得日期(包含年份)
    AeDate.prototype.getFullDate = function()
    {
        return this.iYear + "/" + this.getDate();
    };
    //取得日期(包含年份)
    AeDate.prototype.getDateNum = function()
    {
        var l_iNum = this.iYear * 10000;
        l_iNum += this.iMonth * 100;
        l_iNum += this.iDate;
        return l_iNum;
    };
    //取得時間
    AeDate.prototype.getTimeNum = function ()
    {
        var l_iNum = this.iHours * 10000;
        l_iNum += this.iMinutes * 100;
        l_iNum += this.iSeconds;
        return l_iNum;
    };
    //取得日期 + 時間
    AeDate.prototype.getFullDateNum = function ()
    {
        var l_iNum = this.getDateNum() * 1000000;
        l_iNum += this.getTimeNum();
        return l_iNum;
    };
    //取得日期 + 時間 + 毫秒
    AeDate.prototype.getFullTimesDateNum = function ()
    {
        var l_iNum = this.getFullDateNum() * 1000;
        l_iNum += this.iMilliseconds;
        return l_iNum;
    };
    //取得時間
    AeDate.prototype.getTime = function()
    {
        return this.iHours + ":" + this.iMinutes;
    };
    //取得時間(包含秒)
    AeDate.prototype.getFullTime = function()
    {
        return this.getTime() + ":" + this.iSeconds;
    };
    //取得時間(包含毫秒)
    AeDate.prototype.getFullTimes = function()
    {
        return this.getFullTime() + "." + this.iMilliseconds;
    };
    //取得完整資訊
    AeDate.prototype.getFull = function()
    {
        return this.getFullDate() + " " + this.getFullTime();
    };
    //取得完整資訊(包含毫秒)
    AeDate.prototype.getFulls = function()
    {
        return this.getFullDate() + " " + this.getFullTimes();
    };
	// get timestamp number
    AeDate.prototype.getTimestamp = function()
    {
        return this.date.getTime();
    };	
    //加毫秒
    AeDate.prototype.addMilliseconds = function(i_iNum)
    {
        this.date.setMilliseconds(this.date.getMilliseconds() + i_iNum);
        this.reset();
    };
    //用毫秒設定
    AeDate.prototype.setMilliseconds = function(i_iNum)
    {
        this.date.setTime(i_iNum);
        this.reset();
    };	
    //加秒
    AeDate.prototype.addSeconds = function(i_iNum)
    {
        this.date.setSeconds(this.date.getSeconds() + i_iNum);
        this.reset();
    };
    //加分
    AeDate.prototype.addMinutes = function(i_iNum)
    {
        this.date.setMinutes(this.date.getMinutes() + i_iNum);
        this.reset();
    };
    //加時
    AeDate.prototype.addHours = function(i_iNum)
    {
        this.date.setHours(this.date.getHours() + i_iNum);
        this.reset();
    };
    //加星期
    AeDate.prototype.addWeek = function(i_iNum)
    {
        this.date.setDate(this.date.getDate() + i_iNum*7);
        this.reset();
    };
    //加日期
    AeDate.prototype.addDate = function(i_iNum)
    {
        this.date.setDate(this.date.getDate() + i_iNum);
        this.reset();
    };
    //加月
    AeDate.prototype.addMonth = function(i_iNum)
    {
        this.date.setMonth(this.date.getMonth() + i_iNum);
        this.reset();
    };
    //加年
    AeDate.prototype.addYear = function(i_iNum)
    {
        this.date.setYear(this.date.getYear() + i_iNum);
        this.reset();
    };
    //靜態函式 - 取得日期數字
    AeDate['getAeDateNum'] = function ()
    {
        return (new AeDate()).getDateNum();
    };
    //靜態函式 - 取得時間數字
    //20140705125959
    AeDate['getFullAeDateNum'] = function ()
    {
        return (new AeDate()).getFullDateNum();
    };
    //靜態函式 - 時間數字加法 取得分鐘 ...wait
    AeDate['addFullAeDateNum'] = function (i_iTimeA, i_iTimeB)
    {
        var l_iTime = 0;
        return l_iTime;
    };
    //靜態函式 - 數字轉字串
    AeDate['toStringFromNumber'] = function (i_iTime)
    {
        var l_strTime = "";
        l_strTime += Math.floor(i_iTime / 10000000000);
        l_strTime += "-";
        i_iTime %= 10000000000;
        l_strTime += Math.floor(i_iTime / 100000000);
        l_strTime += "-";
        i_iTime %= 100000000;
        l_strTime += Math.floor(i_iTime / 1000000);
        l_strTime += " ";
        i_iTime %= 1000000;
        l_strTime += Math.floor(i_iTime / 10000);
        l_strTime += ":";
        i_iTime %= 10000;
        l_strTime += Math.floor(i_iTime / 100);
        l_strTime += ":";
        i_iTime %= 100;
        l_strTime += i_iTime;

        return l_strTime;
    };
    //靜態函式 - 時間數字減法 = i_iTimeB - i_iTimeA
    //int i_iTimeA: 開始時間
    //int i_iTimeB: 結束時間
    //string i_strType: 回傳時間單位 預設"minute"  "second", "minute", "hour", "day"
    //return int: 回傳單位時間數字
    AeDate['subFullAeDateNum'] = function (i_iTimeA, i_iTimeB, i_strType)
    {
        if (i_strType == undefined)
            i_strType = "minute";
        var l_strA = AeDate.toStringFromNumber(i_iTimeA);
        var l_strB = AeDate.toStringFromNumber(i_iTimeB);
        var l_iTime = l_GetDateDiff(l_strA, l_strB, i_strType);
        log.Text("AeDate::subFullAeDateNum"
            + " l_strA = " + l_strA + " l_strB = " + l_strB
            + " l_iTime = " + l_iTime);

        return l_iTime;
    };

    //Ex: var result = l_GetDateDiff("2010-02-26 16:00:00", "2011-07-02 21:48:40", "day");
    var l_GetDateDiff = function (startTime, endTime, diffType)
    {
        //将xxxx-xx-xx的时间格式，转换为 xxxx/xx/xx的格式
        startTime = startTime.replace(/\-/g, "/");
        endTime = endTime.replace(/\-/g, "/");
        	 
        //将计算间隔类性字符转换为小写
        diffType = diffType.toLowerCase();
        var sTime = new Date(startTime);//开始时间
        var eTime = new Date(endTime);  //结束时间
        //作为除数的数字
        var divNum = 1;
        switch (diffType)
        {
        	case "second":
        	    divNum = 1000;
        	    break;
        	case "minute":
        	    divNum = 1000 * 60;
        	    break;
        	case "hour":
        	    divNum = 1000 * 3600;
        	    break;
        	case "day":
        	    divNum = 1000 * 3600 * 24;
        	    break;
        	default:
        	    break;
        }

        return parseInt((eTime.getTime() - sTime.getTime()) / parseInt(divNum));
    }
	         
    if (typeof require !== 'undefined')
    {
        global.AeDate = AeDate;
    }
}