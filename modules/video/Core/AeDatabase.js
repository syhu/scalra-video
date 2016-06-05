//防止重覆定義
this.__AE_DATABASE_JS;
if (this.__AE_DATABASE_JS === undefined)
{
    this.__AE_DATABASE_JS = true;

    //目前資料列表
    var s_collestionList = {};
    //設定可供存取的資料列表
    var s_useCollections = function (i_strName, i_data, o_onDone)
    {
        if(s_collestionList[i_strName] == undefined)
        {
            s_collestionList[i_strName] = true;
            log.Text('s_useCollections() add Collections name = ' + i_strName);
            //SR.DB.useCollections([i_strName]);
            //SR.DB.addCollection('FastList_NameInx', function (result) {});
            SR.DB.addCollection(i_strName, 
                function(result)
                {
                    o_onDone(aether.toObj(i_data));
                });
        }else
            o_onDone(aether.toObj(i_data));
    };
    //設定可供存取的資料列表
    var s_useCollectionsNoDate = function (i_strName, o_onDone)
    {
        if (s_collestionList[i_strName] == undefined)
        {
            s_collestionList[i_strName] = true;
            LOG.sys('s_useCollectionsNoDate() add Collections name = ' + i_strName);
            SR.DB.addCollection(i_strName,
                function (result)
                {
                    o_onDone();
                });
        } else
            o_onDone();
    };
    //公用資料庫操作指令
    function AeDatabase() {};
    //編號字串轉物件
    //string i_str: 文字編碼
    //return obj:   編碼物件
    AeDatabase.prototype.toObjId = function(i_str) {
        return SR.DB.toObjectID(i_str);
    };
    //Object 轉 JSON
    //object i_obj:     物件
    //return string:    回傳JSON
    AeDatabase.prototype.ObjToJSON = function(i_obj) {
        return JSON.stringify(i_obj);
    };
    //新增資料
    //string i_strCollection:   資料列表名稱
    //object i_objData:         資料物件
    //function o_onDone():      成功處理函式
    //function o_onFail():      失敗處理函式
    AeDatabase.prototype.insertValue = function(i_strCollection, i_objData, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollections(i_strCollection, i_objData,
            function (ii_objData)
            {   //新增一筆資料 到列表中
                SR.DB.setData(i_strCollection, ii_objData, o_onDone, o_onFail);
            });
    };
    //更新資料
    //string i_strCollection:   資料列表名稱
    //object i_objWhere:        搜尋條件
    //object i_objData:         更新項目
    //function o_onDone():      成功處理函式
    //function o_onFail():      失敗處理函式
    AeDatabase.prototype.updateValue = function(i_strCollection, i_objWhere, i_objData, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollections(i_strCollection, i_objData,
            function (ii_objData)
            {   //查詢資料        
                //尋找資料內容是否有更新項目
                //是則覆寫 否則 新增
                // get data first based on condition
                SR.DB.updateData(i_strCollection, i_objWhere, ii_objData, o_onDone, o_onFail);
            });
    };
    //加/減值某筆資料
    //string i_strCollection:   資料列表名稱
    //object i_objWhere:        搜尋條件
    //object i_objData:         加/減值項目
    //function o_onDone():      成功處理函式
    //function o_onFail():      失敗處理函式
    AeDatabase.prototype.incrementValue = function (i_strCollection, i_objWhere, i_objData, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollections(i_strCollection, i_objData,
            function (ii_objData)
            {   // get data first based on condition
                SR.DB.incrementData(i_strCollection, i_objWhere, ii_objData, o_onDone, o_onFail);
            });
        
    };
    //重寫資料
    //string i_strCollection:   資料列表名稱
    //object i_objWhere:        搜尋條件
    //object i_objData:         資料物件
    //function o_onDone():      成功處理函式
    //function o_onFail():      失敗處理函式
    AeDatabase.prototype.rewriteValue = function (i_strCollection, i_objWhere, i_objData, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollections(i_strCollection, i_objData,
            function (ii_objData)
            {   //查詢資料
                //將資料清除再寫入
                SR.DB.deleteData(i_strCollection,
                    //尋找資料內容是否有更新項目
                    //是則覆寫 否則 新增 
                    // if delete is successful, attempt to insert new (but with same "_id")
                    function ()
                    {
                        // if UUID exists, re-use
                        if (i_objWhere.hasOwnProperty('_id'))
                            ii_objData._id = i_objWhere._id;

                        SR.DB.setData(i_strCollection, ii_objData, o_onDone, o_onFail);
                    },
                 o_onFail, i_objWhere);
            });
    };
    //刪除資料
    //string i_strCollection:   資料列表名稱
    //object i_objWhere:        搜尋條件
    //function o_onDone():      成功處理函式
    //function o_onFail():      失敗處理函式
    AeDatabase.prototype.deleteValue = function (i_strCollection, i_objWhere, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollectionsNoDate(i_strCollection,
            function ()
            {   //查詢資料
                //刪除資料
                SR.DB.deleteData(i_strCollection, o_onDone, o_onFail, i_objWhere);
            });

    };
    //取得特定條件 單筆資料
    //string i_strCollection:       資料列表名稱
    //obj i_objWhere:               搜尋條件
    //function o_onDone(i_data):    成功處理函式
    //function o_onFail():          失敗處理函式
    AeDatabase.prototype.selectValue = function (i_strCollection, i_objWhere, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollectionsNoDate(i_strCollection,
            function ()
            {   //查詢搜尋條件
                //取得第一筆資料
                //之後相同條件省略
                //沒有則回傳空值
                SR.DB.getData(i_strCollection, i_objWhere,
                    function (i_data)
                    {
                        if (i_data != null && i_data._id != undefined)
                            delete i_data['_id'];
                        o_onDone(i_data);
                    },
                o_onFail);
            });
    };
    //取得特定條件 多筆資料
    //string i_strCollection:           資料列表名稱
    //object i_objWhere:                搜尋條件
    //function o_onDone(object i_dataAr):成功處理函式
    //function o_onFail():              失敗處理函式
    AeDatabase.prototype.selectArray = function (i_strCollection, i_objWhere, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollectionsNoDate(i_strCollection,
            function ()
            {   //查詢搜尋條件
                //取得符合條件的多筆資料
                //沒有 則回傳空值
                SR.DB.getArray(i_strCollection,
                    function (i_dataAr)
                    {
                        if (i_dataAr != null)
                        {
                            for (var l_key in i_dataAr)
                                if (i_dataAr[l_key]._id != undefined)
                                    delete i_dataAr[l_key]['_id'];
                        } else
                            i_dataAr = [];
                        if (o_onDone != undefined)
                            o_onDone(i_dataAr);
                    },
                o_onFail, i_objWhere);
            });
    };
    //取得資料列表 所有資料
    //string i_strCollection:               資料列表名稱
    //function o_onDone(object[] i_dataAr): 成功處理函式
    //function o_onFail():                  失敗處理函式
    AeDatabase.prototype.fromArray = function (i_strCollection, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollectionsNoDate(i_strCollection,
            function ()
            {   //取得整份列表資料
                SR.DB.getArray(i_strCollection,
                    function (i_dataAr)
                    {
                        if (i_dataAr != null)
                        {
                            for (var l_key in i_dataAr)
                                if (i_dataAr[l_key]._id != undefined)
                                    delete i_dataAr[l_key]['_id'];
                        } else
                            i_dataAr = [];
                        o_onDone(i_dataAr);
                    },
                o_onFail);
            });

    };
    //取得資料列表 最後一筆資料 (目前不能用 裡面邏輯有誤)
    //string i_strCollection:           資料列表名稱
    //function o_onDone(object i_data): 成功處理函式
    //function o_onFail():              失敗處理函式
    AeDatabase.prototype.fromValueEnd = function (i_strCollection, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollectionsNoDate(i_strCollection,
            function ()
            {   //取得整份列表資料
                SR.DB.getArray(i_strCollection,
                    function (i_data)
                    {
                        if (i_data != null)
                        {
                            if (i_data._id != undefined)
                                delete i_data['_id'];
                            o_onDone(i_data);
                        }
                    },
                o_onFail);
            });
    };
    //取得資料 取得不到 則新創資料
    //string i_strCollection:   資料列表名稱
    //object i_objWhere:        搜尋條件
    //object i_objData:         創造資料物件
    //function o_onDone(i_data):成功處理函式
    //function o_onFail():      失敗處理函式
    AeDatabase.prototype.selectOrInsertValue = function (i_strCollection, i_objWhere, i_objData, o_onDone, o_onFail)
    {
        var that = this;
        this.selectValue(i_strCollection, i_objWhere,
            function (i_data)
            {   //假如沒有資料則新創
                if (i_data == null)
                {   //將搜尋值更新至物件中
                    for (var l_key in i_objWhere)
                        i_objData[l_key] = i_objWhere[l_key];
                    that.insertValue(i_strCollection, i_objData, 
                        function ()
                        {
                            if (o_onDone != undefined)
                                o_onDone(i_objData);
                        },
                    o_onFail);
                } else
                {
                    for (var l_key in i_data)
                        i_objData[l_key] = i_data[l_key];
                    if (o_onDone != undefined)
                        o_onDone(i_objData);
                }
            },function()
            {
                if (o_onFail != undefined)
                    o_onFail();
            }
        );
    };
    //取得列表個數
    //function o_onDone(int count): 成功處理函式
    //function o_onFail():          失敗處理函式
    AeDatabase.prototype.getCollectionCount = function (i_strCollection, o_onDone, o_onFail)
    {
        //設定可供存取的資料列表
        s_useCollectionsNoDate(i_strCollection,
            function ()
            {   //取得列表個數
                SR.DB.count(i_strCollection, o_onDone, o_onFail);
            });
    };
    
    //公開物件
    if (typeof require !== 'undefined')
        global.DB = new AeDatabase();
}


/*
    開發紀事 20140428
        1.優化使用流程 可自動新增列表使用權
        2.讀取DB資料 將_id排除 此資料沒作用
*/