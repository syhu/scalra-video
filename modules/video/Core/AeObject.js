
//防止重覆定義
this.__AETHER_OBJ_JS;
if (this.__AETHER_OBJ_JS === undefined)
{
    this.__AETHER_OBJ_JS = true;

    //特殊函式
    function Aether() { };
    //取得OBJ
    Aether.prototype.toObj = function(i_data)
    {
        if (i_data === undefined)
            return {};
        var l_obj = {};
        for (var item in i_data)
        {
            if (typeof i_data[item] !== 'function')
                l_obj[item] = i_data[item];
        }
        return l_obj;
    };
    //取得OBJ
    Aether.prototype.toObjFull = function (i_data)
    {
        if (i_data === undefined)
            return {};
        var l_obj = {};
        for (var item in i_data)
            l_obj[item] = i_data[item];
        return l_obj;
    };
    //取得OBJ成員數量
    //object i_obj: 物件
    //return int:   成員數量
    Aether.prototype.getObjLength = function(i_obj)
    {
        var l_iCount = 0;
        for (var i in i_obj)
            ++l_iCount;
        return l_iCount;
    };
    //複製資料 - 相同資料覆蓋
    Aether.prototype.copyObj = function(i_objTarget, i_objOrigin, i_strText)
    {
        if (i_strText != undefined)
            log.Text(i_strText);
        if (i_objOrigin == null || i_objOrigin == undefined)
            return false;
        if (i_objTarget == null || i_objTarget == undefined)
            return false;
        var l_bOk = true;
        for (var i in i_objOrigin)
        {
            if (i == undefined)
            {
                log.Warning("Aether::copyObj() i = " + i);
                l_bOk = false;
            } else if (i_objTarget[i] == undefined)
            {
                log.Warning("Aether::copyObj() i_objTarget[" + i + "] = " + i_objTarget[i]);
                l_bOk = false;
            } else if (typeof i_objTarget[i] == "object")
            {
                this.copyObj(i_objTarget[i], i_objOrigin[i]);
            }else
                i_objTarget[i] = i_objOrigin[i];
        }

        return l_bOk;
    };
    //覆蓋資料 - 不同資料新增
    Aether.prototype.overObj = function (i_objTarget, i_objOrigin, i_strText)
    {
        if (i_strText != undefined)
            log.Text(i_strText);
        if (i_objOrigin == null || i_objOrigin == undefined)
            return false;
        if (i_objTarget == null || i_objTarget == undefined)
            return false;
        var l_bOk = true;
        for (var i in i_objOrigin)
        {
            if (i == undefined)
            {
                log.Warning("Aether::overObj i = " + i);
                l_bOk = false;
            } else
            {
                i_objTarget[i] = i_objOrigin[i];
            }
        }

        return l_bOk;
    };
    //複製任意物件...失敗品
    Aether.prototype.clone = function (copy, obj)
    {
        // Handle the 3 simple types, and null or undefined
        if (null == obj || "object" != typeof obj) return obj;

        // Handle Date
        if (obj instanceof Date)
        {
            copy = new Date();
            copy.setTime(obj.getTime());
            return copy;
        }

        // Handle Array
        if (obj instanceof Array)
        {
            for (var i = 0, len = obj.length; i < len; i++)
            {
                copy[i] = this.clone(obj[i]);
            }
            return copy;
        }

        // Handle Object
        if (obj instanceof Object)
        {
            for (var attr in obj)
            {
                if (obj.hasOwnProperty(attr))
                    copy[attr] = this.clone(obj[attr]);
            }
            return copy;
        }
        throw new Error("Unable to copy obj! Its type isn't supported.");
    };
    //複製陣列 - 共用同一份記憶體
    Aether.prototype.copyPtrAr = function (i_targetAr, i_originAr, i_strText)
    {   //初始化
        i_targetAr.length = 0;
        //將指標存入
        var l_iInx = 0;
        while (l_iInx < i_originAr.length)
        {
            i_targetAr[l_iInx] = i_originAr[l_iInx];
            ++l_iInx;
        }
    };
    //複製陣列 - 不同一份記憶體
    Aether.prototype.copyAr = function (i_targetAr, i_originAr, i_strText)
    {
        //初始化
        i_targetAr.length = 0;
        //將指標存入
        var l_iInx = 0;
        while (l_iInx < i_originAr.length)
        {
            i_targetAr[l_iInx] = this.toObjFull(i_originAr[l_iInx]);
            ++l_iInx;
        }
    };
    //新創目前時間
    Aether.prototype.newDate = function()
    {
        return (new Date()).toLocaleString();
    };

    //將字串切割為數字陣列
    Aether.prototype.fromStrToNumAr = function(i_str)
    {
        var l_intAr = [];
        var l_charAr = i_str.split("");
        var l_str = "";
        var l_iLoop = 0;
        while (l_iLoop < l_charAr.length)
        {
            switch (l_charAr[l_iLoop])
            {
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    l_str += l_charAr[l_iLoop];
                    break;
                default:
                    if (l_str != "")
                    {
                        var l_iNum = parseInt(l_str, 10);
                        if (isNaN(l_iNum))
                            l_iNum = 0;
                        l_intAr.push(l_iNum);
                        l_str = "";
                    }
                    break;
            }
            ++l_iLoop;
        }

        return l_intAr;
    };
    //給與系統訊息
    //參考用法 aether.sendSystemMsg(i_event, "Login_Guest", "遊客DB寫入失敗.", 2);
    Aether.prototype.sendSystemMsg = function(i_evt, i_strPacket, i_strData, i_iType)
    {
        //取得封包開頭
        var l_strHandler = (i_strPacket.split("_"))[0];
        switch (i_iType)
        {
            case 0: //一般訊息
                log.Text("s_HandlerPool::" + i_strPacket + " " + i_strData);
                i_evt.done(l_strHandler + "_Text", { 'strText': i_strData });
                break;
            case 1: //警告訊息
                log.Warning("s_HandlerPool::" + i_strPacket + " " + i_strData);
                i_evt.done(l_strHandler + "_Warning", { 'strText': i_strData });
                break;
            case 2: //錯誤訊息
                log.Error("s_HandlerPool::" + i_strPacket + " " + i_strData);
                i_evt.done(l_strHandler + "_Error", { 'strText': i_strData });
                break;
            default:
                i_evt.done();
                break;
        }
    };
    //發送封包
    //string i_strPAcket:   封包名稱
    //object i_obj:         封包內容
    //string i_connId:      連線編號
    Aether.prototype.send = function (i_strPacket, i_obj, i_connId)
    {
        SR.EventManager.send(i_strPacket, i_obj,
            [SR.Conn.getConnObject(i_connId)]);
    };
    //關閉連線
    //string i_connId:      連線編號
    Aether.prototype.closeConn = function (i_connId)
    {
        var l_conn = SR.Conn.getConnObject(i_connId);
        if (l_conn != undefined || l_conn != null)
            l_conn.close();
    }
    //遠端lobby server呼叫
    //string i_strObjName:  公開物件名稱
    //string i_strFunName:  函式名稱
    //object i_objData:     封包內容
    //function o_onDone:    返回資料的函式
    //reference: aether.callLobby('objTest', 'getTest', {'strTest': "test"}, function(i_data) {})
    Aether.prototype.callLobby = function (i_strObjName, i_strFunName, i_objData, o_onDone)
    {
        if (o_onDone != undefined)
            SR.AppConnector.remoteAction(i_strObjName, i_strFunName, [i_objData, o_onDone]);
        else
            SR.AppConnector.remoteAction(i_strObjName, i_strFunName, [i_objData]);
    };
    //遠端app server呼叫
    //string i_strAppName:  App名稱
    //string i_strPacket:   封包名稱
    //object i_objData:     封包內容
    //function o_onDone:    返回資料的函式
    //bool i_bFirst:        是否只傳一次
    //reference: aether.callApp('app', 'Packet_Test', {'strTest': "test"}, function(i_data) {})
    Aether.prototype.callApp = function (i_strAppName, i_strPacket, i_objData, o_onDone, i_bOne)
    {
        var l_appObjAr = SR.AppConn.queryAppServers();
        for (var l_key in l_appObjAr)
        {
            if (l_appObjAr[l_key].name == i_strAppName)
            {
                SR.RPC.remoteEvent(l_key, i_strPacket, i_objData, o_onDone);
                if (i_bOne == true)
                    break;
            }
        }
    };
    //發送Email資料
    Aether.prototype.sendEmail = function (i_data, o_onDone, o_onFail)
    {
        //var l_data = {
        //    'from': "黑貓俱樂部 <blackcat@gamespores.com.tw>",
        //    'subject': "黑貓俱樂部 提取密碼通知",
        //    'text': "親愛的玩家您好~ \n這是您的密碼：" + i_data.strPassword + "\n小秘書祝您～天天開心發大財喔~",
        //    'to': i_data.strAccount
        //};
        UTIL.emailText(i_data, o_onDone, o_onFail);
    };
    //取得Server資訊
    //return object = {
    //    "id": "",     //Server唯一識別碼
    //    "owner": "",  //開發者名稱
    //    "project": "",//專案名稱
    //    "name": "",   //Server名稱
    //    "type": "app",//類型 lobby or app
    //    "IP": "000.000.000.000",//所在位置
    //    "port": 00000           //佔用通道
    //}
    Aether.prototype.getServerInfo = function ()
    {
        return SR.Settings.SERVER_INFO;
    };
    //取得Server名稱
    Aether.prototype.getServerName = function ()
    {
        return SR.Settings.SERVER_INFO.name;
    };

    if (typeof require !== 'undefined')
    {
        global.aether = new Aether();
    }
}


//l_appObjAr =
//{
//    "B705D492-68A5-423C-AFCA-971A7A14BB83":
//        {
//            "id": "B705D492-68A5-423C-AFCA-971A7A14BB83",
//            "owner": "yooho",
//            "project": "YoohoFarm",
//            "name": "fishing",
//            "type": "app",
//            "local_name": "悠活漁池",
//            "IP": "211.78.245.158",
//            "port": 40000,
//            "connID": "9EDD7E56-E698-48AB-819D-8DB91EDB3A5C",
//            "locationID": "2B5CAB0A-3737-45EC-BB88-821EE87B7255",
//            "usercount": 1
//        }
//}

//    //物件轉成方法成員
//    //this i_ObjTarget: 目標元件
//    //obj i_objOrigin:  來源物件
//    function NewFunctionMember(i_ObjTarget, i_objOrigin) {
//        for (var i in i_objOrigin) {
//            if (typeof (i_objOrigin[i]) == "function") {
//                log.Text("NewFunctionMember() i = " + i);
//                i_ObjTarget[i] = i_objOrigin[i];
//            }
//        }
//        log.Json("NewFunctionMember() i_ObjTarget = ", l_ObjTarget);
//    };

//使用 Object 加速搜尋速度:
//新建:var obj = new Object(); 或 var obj = {};
//增加:obj[key] = value; (key為string or 常數)
//刪除:delete obj[key];
//遍歷:for ( var key in obj ) obj[key];

/*

}

//可以在連線中 新增屬性
event.session['iUserId'] = 12345;
//只有socket才有
event.conn[iUserId] = 12345;
*/
//UTIL.getSystemInfo() 可看 socket 連線數
///core/console.js 內可看 'info' 指令怎樣實作
//var list = SR.Comm.list(); 抓 channel 內的訂閱者數

//var i_data = {
//    'from': "黑貓俱樂部 <blackcat@gamespores.com.tw>",
//    'subject': "黑貓俱樂部 提取密碼通知",
//    'text': "親愛的玩家您好~ \n這是您的密碼：" + i_data.strPassword + "\n小秘書祝您～天天開心發大財喔~",
//    'to': i_data.strAccount
//};

//電子信箱認證 功能
//l_handlers.VERIFY_EMAIL = function (event)
//{
//    var email = event.data.email;
//    var url = SR.Notify.getVerifyURL(
//     {
//         successURL: 'http://src.scalra.com:8080/test/demo/lobby/web/token_success.html',
//         failURL: 'http://src.scalra.com:8080/test/demo/lobby/web/token_fail.html',
//         invalidURL: 'http://src.scalra.com:8080/test/demo/lobby/web/token_invalid.html',
//     },
//     function (result)
//     {
//         // mark verified...
//         LOG.warn('verify URL click result: ');
//         LOG.warn(result);
//     },
//     {
//         onetime: true,
//         timeout: 3600
//     }
//    );
//    UTIL.emailText({
//        to: email,
//        type: 'html',
//        subject: 'Verify Your E-mail',
//        text: 'To verify, please click: <a href="' + url + '">' + url + '</a>'
//    });
//    event.done('VERIFY_EMAIL_R', { url: url });
//}

//SR.Settings
//app_info = {
//    "id": "73B9BDAF-B0FE-4BC7-86DE-C554A22F0998",
//    "name": "fruit_silver",
//    "englocation": "fruit_silver",
//    "lllocation": "水果盤 銀幣",
//    "IP": "211.78.245.158",
//    "port": 40249,
//    "connID": "B66B0A81-2EB3-40EF-9026-51BDA90A1074",
//    "locationID": "16A897FC-5F8C-4B6E-B190-B5441F4D2958",
//    "usercount": 0
//}
//

//UTIL.getSystemInfo() = {
//    "gid":1016,
//    "uid":1016,
//    "arch":"x64",
//    "platform":"linux",
//    "node_ver":"v0.10.26",
//    "start_time":"2014-10-20T08:22:38.257Z",
//    "uptime":1.364033748395741,
//    "hostname":"MC-GameDev-01",
//    "mem_total":2104442880,
//    "mem_free":278646784,
//    "mem_proc":"{rss: 28573696,heapTotal: 20686848, heapUsed: 13274560 }",
//        "net_in":51,
//        "net_out":202,
//        "conn_count":1,
//        "cpu_load":[2.6572265625,2.375,2.33056640625],
//        "cpus":[
//            {
//                "model":"Intel(R) Xeon(R) CPU           E5620  @ 2.40GHz",
//                "speed":2394,
//                "times":
//                    {
//                        "user":5342303800,
//                        "nice":806000,
//                        "sys":495544800,
//                        "idle":46998599300,
//                        "irq":5900
//                    }
//            }]
//}

//SR.Settings.SERVER_INFO = {
//    "id": "33FA74BF-4E89-4B67-8D15-A84515B22E57",
//    "owner": "yooho",
//    "project": "YoohoFarm",
//    "name": "fishing",
//    "type": "app",
//    "IP": "211.78.245.158",
//    "port": 40017
//}
