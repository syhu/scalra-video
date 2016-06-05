// module object
var l_module = exports.module = {};

// a pool for all message handlers
var l_handlers = exports.handlers = {};
var l_checkers = exports.checkers = {};
var l_api = exports.api = {};
var l_name = 'SR.Video.RecordTrigger';

// dependency
// TODO: move below to become part of SR
require('./Core/AeEventSender.js');
require("./Core/AeTimeTrigger.js");
require('./Core/AeDate.js');

// module init/stop
// module init
l_module.start = function (config, onDone) {
	LOG.warn('RecordTrigger module started...');	
	UTIL.safeCall(onDone);
}

// module shutdown
l_module.stop = function (onDone) {
	UTIL.safeCall(onDone);
}

// TODO: hide all globals

var l_name = 'RecordTrigger';
var l_dbName = 'RecordTrigger';
var l_dbRecordLog = 'Recording';

var camLib = require('./cameraLib.js');

global.g_baseEditAr2 = [
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

global.g_dayTime = [
	0, 30, 100, 130, 200, 230, 300, 330, 400, 430, 500, 530,
	600, 630, 700, 730, 800, 830, 900, 930, 1000, 1030, 1100, 1130,
	1200, 1230, 1300, 1330, 1400, 1430, 1500, 1530, 1600, 1630, 1700, 1730,
	1800, 1830, 1900, 1930, 2000, 2030, 2100, 2130, 2200, 2230, 2300, 2330
];

//錄影日期
function CRecordSchedule() {
	this.groupID = -1, 	//群組ID
		this.start = 0, //開始時間	星期幾點幾分(EX: 11230 星期一12:30)
		this.end = 0, 	//結束時間	星期幾點幾分(EX: 11230 星期一12:30)
		this.iType = 1 	//錄影狀態(1:不錄影 2:持續錄影 3:事件錄影)
};

//新資料
CRecordSchedule.prototype.saveToDB = function (onDone, onFail) {
	//新增資料
	DB.insertValue(l_dbName, this,
		function () {
			onDone();
		}, onFail);
};

//錄影群組設定
function CRecordSetting() {
	this.groupID = -1, //群組ID
	this.iScheduleAr2 = g_baseEditAr2;
	this.iPreRecordSec = 0, //預錄影秒數(單位:秒)
	this.bRewrite = true, //停止錄影 xor 複寫覆蓋(true:複寫覆蓋  false:停止錄影)
	this.bVoiceRecord = true //錄音
};
//
CRecordSetting.prototype.get = function (groupID, onDone, onFail) {
	if (groupID != undefined)
		this.groupID = groupID;
	//取得不到，就依現有資料直接新增
	DB.selectOrInsertValue('RecordSetting', {
		'groupID': this.groupID
	}, this, onDone, onFail);
};
//更新資料
CRecordSetting.prototype.update = function (onDone, onFail) {
	DB.updateValue('RecordSetting', {
		'groupID': this.groupID
	}, this, onDone, onFail);
};
//=======================================================================================================
//事件觸發
function CRecordTrigger() {};
//陣列轉換(一日)
CRecordTrigger.prototype.changeDay = function (i_objData, i_iLoopDay, dataAr2, iCount, onDone, onFail) {
	var that = this;
	//主要檢查開始的部分------------------------------------------
	if (iCount == 0) //一天的開頭
	{
		var l_day = i_iLoopDay + 1;
		//LOG.warn("CRecordTrigger::changeDay() 一天的開頭 第" + iCount + "格 開始時間 = " + ((l_day * 10000) + g_dayTime[iCount]) );
		i_objData.start = (l_day * 10000) + g_dayTime[iCount];
		i_objData.iType = dataAr2[i_iLoopDay][iCount];
	} else if (dataAr2[i_iLoopDay][iCount] != dataAr2[i_iLoopDay][iCount - 1]) //上一格不一樣
	{
		var l_day = i_iLoopDay + 1;
		//LOG.warn("CRecordTrigger::changeDay() 上一格不一樣 第" + iCount + "格 開始時間 = " + ((l_day * 10000) + g_dayTime[iCount]));
		i_objData.start = (l_day * 10000) + g_dayTime[iCount];
		i_objData.iType = dataAr2[i_iLoopDay][iCount];
	}
	//主要檢查結束的部分------------------------------------------
	if (iCount == (dataAr2[i_iLoopDay].length - 1)) //一天的結尾
	{
		var l_day = i_iLoopDay + 2; //跨日
		if (l_day >= 8)
			l_day = 1;
		i_objData.end = (l_day * 10000); //隔天0點
		i_objData.saveToDB(
			function () {
				//LOG.warn("CRecordTrigger::changeDay() 轉換 第" + iCount + "格 排程設定  處理成功! ");
				++iCount;

				if (iCount == dataAr2[i_iLoopDay].length) {
					onDone(0);
					return;
				} else {
					that.changeDay(i_objData, i_iLoopDay, dataAr2, iCount, onDone, onFail);
				}
			}, onFail);
	} else if ((dataAr2[i_iLoopDay][iCount] != dataAr2[i_iLoopDay][iCount + 1])) //下一格不一樣
	{
		var l_day = i_iLoopDay + 1;
		i_objData.end = (l_day * 10000) + g_dayTime[iCount + 1];
		i_objData.saveToDB(
			function () {
				//LOG.warn("CRecordTrigger::changeDay() 轉換 第" + iCount + "格 排程設定  處理成功! ");
				++iCount;

				if (iCount == dataAr2[i_iLoopDay].length) {
					onDone(0);
					return;
				} else {
					that.changeDay(i_objData, i_iLoopDay, dataAr2, iCount, onDone, onFail);
				}
			}, onFail);
	} else {
		//LOG.warn("CRecordTrigger::changeDay() 轉換 第" + iCount + "筆 排程設定  處理成功! ");
		++iCount;

		if (iCount == dataAr2[i_iLoopDay].length) {
			onDone(0);
			return;
		} else {
			that.changeDay(i_objData, i_iLoopDay, dataAr2, iCount, onDone, onFail);
		}
	}
};
//陣列轉換(一周)
CRecordTrigger.prototype.changeWeek = function (i_objData, dataAr2, iCount, onDone, onFail) {
	var that = this;
	var l_iLoop = 0;
	that.changeDay(i_objData, iCount, dataAr2, l_iLoop,
		function () {
			//LOG.warn("CRecordTrigger::changeWeek() 轉換 第" + iCount + "天 排程設定  處理成功! ");
			++iCount;

			if (iCount == dataAr2.length) {
				onDone(0);
				return;
			} else {
				that.changeWeek(i_objData, dataAr2, iCount, onDone, onFail);
			}
		}, onFail);
};
//陣列轉換
CRecordTrigger.prototype.changeDate = function (groupID, data, onDone, onFail) {
	var that = this;
	var l_iLoopDay = 0;
	var l_objData = new CRecordSchedule();
	l_objData.groupID = groupID;
	LOG.warn("CRecordTrigger::changeDate data.iScheduleAr2.length = " + data.iScheduleAr2.length);
	this.changeWeek(l_objData, data.iScheduleAr2, l_iLoopDay,
		function () {
			onDone(0);
		}, onFail);
};

//設定錄影排程
CRecordTrigger.prototype.setSchedule = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':群組,
	'iScheduleAr2':	時間排程	二維陣列int[7,48]	( 7天 , 24小時 *2 )
	}
	*/
	var that = this;
	/*
	合併成一筆資料,並且要先讀出舊的記錄,不然只設定二維舊會遺失其他資訊
	用[群組名稱]先讀取舊的資料陣列(隨便取一筆)
	*有東西->修改錄影設定的二維->刪除錄影日期群組全部的記錄->轉換新的二維資料
	*沒東西->新增錄影設定->使用預設二維資料
	*/
	//檢查
	DB.selectArray(l_dbName, {
			'groupID': data.groupID
		},
		function (idataAr) {
			var l_objSetting = new CRecordSetting();
			if (idataAr.length > 0) //有東西
			{
				//讀取設定
				l_objSetting.get(data.groupID,
					function (ii_objSetting) {
						l_objSetting.iScheduleAr2 = data.iScheduleAr2;
						l_objSetting.update(
							function () {
								//刪除群組全部的記錄
								DB.deleteValue(l_dbName, {
										'groupID': data.groupID
									},
									function () {
										that.changeDate(data.groupID, data,
											function () {
												that.checkNowRecord(
													function () {
														onDone(0);
													}, onFail);
											}, onFail); //轉換資料
									}, onFail);
							}, onFail);
					}, onFail);
			} else //沒東西
			{
				//讀取設定
				l_objSetting.get(data.groupID,
					function (ii_objSetting) {
						l_objSetting.iScheduleAr2 = data.iScheduleAr2;
						l_objSetting.update(
							function () {
								that.changeDate(data.groupID, {
										'iScheduleAr2': data.iScheduleAr2
									},
									function () {
										that.checkNowRecord(
											function () {
												onDone(0);
											}, onFail);
									}, onFail); //轉換資料
							}, onFail);
					}, onFail);
			}
		}, onFail);
};
//設定二維之後 檢查是否有當下需要開始錄影
CRecordTrigger.prototype.checkNowRecord = function (onDone, onFail) {
	var that = this;
	var l_time = new AeDate();
	var l_iday = l_time.iDay;
	if (l_iday == 0)
		l_iday = 7;

	var l_iNow = (l_time.iHours * 100) + l_time.iMinutes;

	//檢查
	LOG.warn("CRecordTrigger::checkNowRecord() l_iNow = " + l_iNow);
	DB.selectArray(l_dbName, {
			'start': {
				"$lte": (l_iday * 10000) + l_iNow
			},
			'end': {
				"$gt": (l_iday * 10000) + l_iNow
			},
			'iType': 2
		},
		function (idataAr) { //跨周的問題-所以在找了一次
			DB.selectArray(l_dbName, {
					'start': {
						"$lte": (l_iday * 10000) + l_iNow
					},
					'end': 10000,
					'iType': 2
				},
				function (idataWeekEndAr) {
					var l_iLoop = 0;
					while (l_iLoop < idataWeekEndAr.length) {
						idataAr.push(idataWeekEndAr[l_iLoop]);
						++l_iLoop;
					}
					//LOG.debug("CRecordTrigger::checkNowRecord idataAr", idataAr);
					if (idataAr.length > 0) //有東西
					{
						//要遞回處理取得群組設備
						var l_groupDeviceAr = [];
						var l_iCountTrigger = 0;
						that.getGroupDevice(idataAr, l_iCountTrigger, l_groupDeviceAr,
							function (ii_objDeviceAr) {
								//LOG.debug("CRecordTrigger::checkNowRecord ii_objDeviceAr", ii_objDeviceAr);
								//遞回處理設備名稱轉換VID(要接Hydra的API)
								var l_deviceVidAr = [];
								var l_iCountDevice = 0;
								that.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
									function (ii_objVidAr) {
										LOG.debug("CRecordTrigger::checkNowRecord ii_objVidAr", ii_objVidAr);
										//要遞回處理啟動設備錄影
										var l_iCountVid = 0;
										//setInterval(function(){ console.log(ii_objVidAr); },5000);
										that.setRecordStart("一般錄影", false, l_iNow * 100, ii_objVidAr, l_iCountVid,
											function (ii_return) {
												//記錄錄影LOG
												onDone(0);
											}, onFail);
									}, onFail);
							}, onFail);
					} else
						onDone(0);
				}, onFail);
		}, onFail);
};
//設定二維之後 檢查是否有當下需要停止錄影
CRecordTrigger.prototype.checkNowStopRecord = function (data, onDone, onFail) {
	var that = this;
	var l_time = new AeDate();
	var l_iday = l_time.iDay;
	if (l_iday == 0)
		l_iday = 7;
	//LOG.warn("CRecordTrigger::checkNowRecord() l_time.iDay = " + l_time.iDay);
	var l_iNow = (l_time.iHours * 100) + l_time.iMinutes;
	//搜尋
	DB.selectArray(l_dbName, {
			'start': {
				"$lte": (l_iday * 10000) + l_iNow
			},
			'end': {
				"$gt": (l_iday * 10000) + l_iNow
			},
			'iType': 1,
			'groupID': data.groupID
		},
		function (idataAr) { //跨周的問題-所以在找了一次
			DB.selectArray(l_dbName, {
					'start': {
						"$lte": (l_iday * 10000) + l_iNow
					},
					'end': 10000,
					'iType': 1
				},
				function (idataWeekEndAr) {
					var l_iLoop = 0;
					while (l_iLoop < idataWeekEndAr.length) {
						idataAr.push(idataWeekEndAr[l_iLoop]);
						++l_iLoop;
					}
					LOG.debug("CRecordTrigger::checkNowStopRecord idataAr", idataAr);
					if (idataAr.length > 0) //有東西
					{
						//要遞回處理取得群組設備
						var l_groupDeviceAr = [];
						var l_iCountTrigger = 0;
						that.getGroupDevice(idataAr, l_iCountTrigger, l_groupDeviceAr,
							function (ii_objDeviceAr) {
								LOG.debug("CRecordTrigger::checkNowStopRecord ii_objDeviceAr", ii_objDeviceAr);
								//遞回處理設備名稱轉換VID(要接Hydra的API)
								var l_deviceVidAr = [];
								var l_iCountDevice = 0;
								that.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
									function (ii_objVidAr) {
										LOG.debug("CRecordTrigger::checkNowStopRecord ii_objVidAr", ii_objVidAr);
										//要遞回處理結束設備錄影
										var l_iCountVid = 0;
										that.setRecordStop("一般錄影", l_iNow * 100, ii_objVidAr, l_iCountVid,
											function (ii_return) {
												onDone(0);
											}, onFail);
									}, onFail);
							}, onFail);
					} else {
						LOG.warn("CRecordTrigger::checkNowStopRecord 沒有正在錄影的LOG !!");
						onDone(0);
					}
				}, onFail);
		}, onFail);
};
//設定預錄影秒數
CRecordTrigger.prototype.setPreRecordSec = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':群組ID,
	'iPreRecordSec':	預錄影秒數	單位:秒
	}
	*/
	var that = this;
	//讀取設定
	var l_objSetting = new CRecordSetting();
	l_objSetting.get(data.groupID,
		function (ii_objSetting) {
			l_objSetting.iPreRecordSec = data.iPreRecordSec;
			l_objSetting.update(
				function () {
					onDone(0);
				}, onFail);
		}, onFail);
};

//參考網頁http://lmws.net/making-directory-along-with-missing-parents-in-node-js
SR.path = require('path');

SR.fs.mkdirParent = function (dirPath, mode, callback) {
	//Call the standard fs.mkdir
	SR.fs.mkdir(dirPath, mode, function (error) {
		//When it fail in this way, do the custom steps
		if (error && error.errno === 34) {
			//Create all the parents recursively
			SR.fs.mkdirParent(SR.path.dirname(dirPath), mode, callback);
			//And then the directory
			SR.fs.mkdirParent(dirPath, mode, callback);
		}
		//Manually run the callback since we used our own callback to do all these
		callback && callback(error);
	});
};

//滿碟設定
CRecordTrigger.prototype.setHardDiskFull = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':群組ID,
	'bRewrite':	停止錄影 xor 複寫覆蓋	(true:複寫覆蓋  false:停止錄影)
	}
	*/
	var that = this;
	//讀取設定
	var l_objSetting = new CRecordSetting();
	l_objSetting.get(data.groupID,
		function (ii_objSetting) {
			l_objSetting.bRewrite = data.bRewrite;
			l_objSetting.update(
				function () {
					onDone(0);
				}, onFail);
		}, onFail);
};
//設定錄音
CRecordTrigger.prototype.setVoiceRecord = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':群組ID,
	'bVoiceRecord':	錄音
	}
	*/
	var that = this;
	//讀取設定
	var l_objSetting = new CRecordSetting();
	l_objSetting.get(data.groupID,
		function (ii_objSetting) {
			l_objSetting.bVoiceRecord = data.bVoiceRecord;
			l_objSetting.update(
				function () {
					onDone(0);
				}, onFail);
		}, onFail);
};
//設定錄影資料(整份)
CRecordTrigger.prototype.setGroupRecordSetting = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':群組ID,
	'iScheduleAr2':	時間排程	二維陣列int[7,48]	( 7天 , 24小時 *2 )
	'iPreRecordSec':	預錄影秒數	單位:秒
	'bRewrite':	停止錄影 xor 複寫覆蓋	(true:複寫覆蓋  false:停止錄影)
	'bVoiceRecord':	錄音
	}
	*/
	var that = this;
	//檢查
	DB.selectArray(l_dbName, {
			'groupID': data.groupID
		},
		function (idataAr) {
			var l_objSetting = new CRecordSetting();
			if (idataAr.length > 0) //有東西
			{
				//讀取設定
				l_objSetting.get(data.groupID,
					function (ii_objSetting) {
						l_objSetting.iScheduleAr2 = data.iScheduleAr2;
						l_objSetting.iPreRecordSec = data.iPreRecordSec;
						l_objSetting.bRewrite = data.bRewrite;
						l_objSetting.bVoiceRecord = data.bVoiceRecord;
						l_objSetting.update(
							function () {
								//刪除群組全部的記錄
								DB.deleteValue(l_dbName, {
										'groupID': data.groupID
									},
									function () {
										that.changeDate(data.groupID, data,
											function () {
												that.checkNowRecord(
													function () {
														that.checkNowStopRecord(data,
															function () {
																onDone(0);
															}, onFail);
													}, onFail);
											}, onFail); //轉換資料
									}, onFail);
							}, onFail);
					}, onFail);
			} else //沒東西
			{
				//讀取設定
				l_objSetting.get(data.groupID,
					function (ii_objSetting) {
						l_objSetting.iScheduleAr2 = data.iScheduleAr2;
						l_objSetting.iPreRecordSec = data.iPreRecordSec;
						l_objSetting.bRewrite = data.bRewrite;
						l_objSetting.bVoiceRecord = data.bVoiceRecord;
						l_objSetting.update(
							function () {
								that.changeDate(data.groupID, {
										'iScheduleAr2': data.iScheduleAr2
									},
									function () {
										that.checkNowRecord(
											function () {
												that.checkNowStopRecord(data,
													function () {
														onDone(0);
													}, onFail);
											}, onFail);
									}, onFail); //轉換資料
							}, onFail);
					}, onFail);
			}
		}, onFail);

	//----------------------
};
//取得錄影設定資料
CRecordTrigger.prototype.getGroupRecordSetting = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':群組ID,
	}
	*/
	var that = this;
	//讀取設定
	var l_objSetting = new CRecordSetting();
	l_objSetting.get(data.groupID,
		function (ii_objSetting) {
			onDone(ii_objSetting);
		}, onFail);
};

//遞迴觸發事件錄影啟動
CRecordTrigger.prototype.setEventRecord = function (dataAr, i_time, i_iNow, iCount, onDone, onFail) {
	var that = this;
	var l_iday = i_time.iDay;
	if (l_iday == 0)
		l_iday = 7;
	DB.selectArray(l_dbName, {
			'groupID': dataAr[iCount].groupID,
			'start': {
				"$lte": (l_iday * 10000) + i_iNow
			},
			'end': {
				"$gt": (l_iday * 10000) + i_iNow
			},
			'iType': 3
		},
		function (idataAr) {
			//跨周的問題-所以在找了一次
			DB.selectArray(l_dbName, {
					'start': {
						"$lte": (l_iday * 10000) + i_iNow
					},
					'end': 10000,
					'iType': 1
				},
				function (idataWeekEndAr) {
					var l_iLoop = 0;
					while (l_iLoop < idataWeekEndAr.length) {
						idataAr.push(idataWeekEndAr[l_iLoop]);
						++l_iLoop;
					}
					//LOG.debug("CRecordTrigger::setEventRecord idataAr", idataAr);
					if (idataAr.length > 0) //有東西
					{
						//要遞回處理取得群組設備
						var l_groupDeviceAr = [];
						var l_iCountTrigger = 0;
						that.getGroupDevice(idataAr, l_iCountTrigger, l_groupDeviceAr,
							function (ii_objDeviceAr) {
								//LOG.debug("CRecordTrigger::setEventRecord ii_objDeviceAr", ii_objDeviceAr);
								//遞回處理設備名稱轉換VID(要接Hydra的API)
								var l_deviceVidAr = [];
								var l_iCountDevice = 0;
								that.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
									function (ii_objVidAr) {
										LOG.debug("CRecordTrigger::setEventRecord ii_objVidAr", ii_objVidAr);
										//要遞回處理啟動設備錄影
										var l_iCountVid = 0;
										var l_time = new AeDate();
										var l_iNow = (l_time.iHours * 100) + l_time.iMinutes;
										that.setRecordStart(dataAr[iCount].type, dataAr[iCount].toFTP, l_iNow * 100, ii_objVidAr, l_iCountVid,
											function (ii_return) {
												LOG.warn("CRecordTrigger::setEventRecord() 啟動 第" + iCount + "個 事件 群組錄影  處理成功! ");
												++iCount;

												if (iCount == dataAr.length) {
													onDone(0);
													return;
												} else {
													that.setEventRecord(dataAr, i_time, i_iNow, iCount, onDone, onFail);
												}
											}, onFail);
									}, onFail);
							}, onFail);
					} else
						onDone(0);
				}, onFail);
		}, onFail);
};
//遞迴觸發事件錄影結束
CRecordTrigger.prototype.setEventRecordEnd = function (dataAr, i_time, i_iNow, iCount, onDone, onFail) {
	var that = this;
	//因為事件結束時有可能超過預設區段，所以要用LOG來作搜尋
	//var l_iday = i_time.iDay;
	//if (l_iday == 0)
	//    l_iday = 7;
	//DB.selectArray(l_dbName, { 'groupID': dataAr[iCount].groupID, 'start': { "$lte": (l_iday * 10000) + i_iNow }, 'end': { "$gt": (l_iday * 10000) + i_iNow }, 'iType': 3 },
	DB.selectArray(l_dbRecordLog, {
			'groupID': dataAr[iCount].groupID,
			'type': dataAr[iCount].type,
			'end': 0
		},
		function (idataAr) {
			//LOG.debug("CRecordTrigger::setEventRecordEnd idataAr", idataAr);
			if (idataAr.length > 0) //有東西
			{
				//要遞回處理取得群組設備
				var l_groupDeviceAr = [];
				var l_iCountTrigger = 0;
				that.getGroupDevice(idataAr, l_iCountTrigger, l_groupDeviceAr,
					function (ii_objDeviceAr) {
						//LOG.debug("CRecordTrigger::setEventRecordEnd ii_objDeviceAr", ii_objDeviceAr);
						//遞回處理設備名稱轉換VID(要接Hydra的API)
						var l_deviceVidAr = [];
						var l_iCountDevice = 0;
						that.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
							function (ii_objVidAr) {
								LOG.debug("CRecordTrigger::setEventRecordEnd ii_objVidAr", ii_objVidAr);
								//要遞回處理啟動設備錄影
								var l_iCountVid = 0;
								var l_time = new AeDate();
								var l_iNow = (l_time.iHours * 100) + l_time.iMinutes;
								that.setRecordStop(dataAr[iCount].type, l_iNow * 100, ii_objVidAr, l_iCountVid,
									function (ii_return) {
										LOG.warn("CRecordTrigger::setEventRecordEnd() 結束 第" + iCount + "個 事件 群組錄影  處理成功! ");
										++iCount;

										if (iCount == dataAr.length) {
											onDone(0);
											return;
										} else {
											that.setEventRecordEnd(dataAr, i_time, i_iNow, iCount, onDone, onFail);
										}
									}, onFail);
							}, onFail);
					}, onFail);
			} else
				onDone(0);
		}, onFail);
};
//事件觸發錄影
CRecordTrigger.prototype.onEventRecord = function (dataAr, onDone, onFail) {
	/*
	dataAr = 
	{
	//設備事件[]
	}
	用{群組,星期,時間,事件觸發}搜尋事件
	*/
	var that = this;
	var l_time = new AeDate();
	var l_iNow = (l_time.iHours * 100) + l_time.iMinutes;
	var l_iCount = 0;
	that.setEventRecord(dataAr, l_time, l_iNow, l_iCount,
		function (ii_return) {
			onDone(0);
		}, onFail);
};
//事件觸發結束錄影
CRecordTrigger.prototype.onEventRecordEnd = function (dataAr, onDone, onFail) {
	/*
	dataAr = 
	{
	//設備事件[]
	}
	用{群組,星期,時間,事件觸發}搜尋事件
	*/
	var that = this;
	var l_time = new AeDate();
	var l_iNow = (l_time.iHours * 100) + l_time.iMinutes;
	var l_iCount = 0;
	that.setEventRecordEnd(dataAr, l_time, l_iNow, l_iCount,
		function (ii_return) {
			onDone(0);
		}, onFail);
};
//錄影LOG
CRecordTrigger.prototype.saveStartLog = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':-1,//群組
	'type':	"",//事件名稱	
	'start':開始時間	年月日時分秒,
	'device': "",//設備名稱
	'vid': "",//影像ID
	'done': false,      //檔案結尾是否完成
	'toFTP': false,          //是否要上傳
	}
	*/
	var l_obj = {
		'groupID': data.groupID,	//群組
		'type': data.type, 			//事件名稱	
		'start': data.start, 		//發生時間	年月日時分秒
		'end': 0, 					//結束時間	年月日時分秒
		'device': data.device, 		//設備名稱
		'vid': data.vid, 			//影像ID
		'done': data.done,			//檔案結尾是否完成
		'toFTP': data.toFTP 		//是否要上傳
	}
	var that = this;
	//新增資料
	DB.insertValue(l_dbRecordLog, l_obj,
		function () {
			onDone(0);
		}, onFail);
};
//錄影LOG
CRecordTrigger.prototype.saveStopLog = function (data, onDone, onFail) {
	/*
	data = 
	{
	'groupID':-1,//群組
	'type':	"",//事件名稱	
	'end':	結束時間 年月日時分秒
	'device': "",//設備名稱
	'vid': "",//影像ID
	}
	1217 1442

	1200 1230
	1230 1300
	1300 1330
	1330 1400
	1400 1430
	1430 1500
	*/
	var l_time = new AeDate();
	var l_end = data.end * 100;

	var that = this;
	//搜尋
	DB.selectValue(l_dbRecordLog, {
			'groupID': data.groupID,
			'type': data.type,
			'end': 0,
			'device': data.device,
			'vid': data.vid
		},
		function (idata) {
			if (idata != null) {
				idata.end = data.end;

				DB.updateValue(l_dbRecordLog, {
						'groupID': data.groupID,
						'type': data.type,
						'start': idata.start,
						'device': data.device,
						'vid': data.vid
					}, idata,
					function () {
						onDone(0);
					}, onFail);
			} else {
				onDone(0);
			}
		}, onFail);
};
//遞回處理取得群組設備
CRecordTrigger.prototype.getGroupDevice = function (dataAr, iCount, i_returnAr, onDone, onFail) {
	var that = this;
	SR.Account.group.listDeviceId(dataAr[iCount],
		function (ii_deviceAr) {
			LOG.warn("CRecordTrigger::getGroupDevice ii_deviceAr");
			LOG.warn(ii_deviceAr);
			LOG.warn("CRecordTrigger::getGroupDevice() 取得 第" + iCount + "個 群組設備表  處理成功! ");
			
			if (!ii_deviceAr) {
				LOG.error('empty device array!', l_dbName);
				onDone(i_returnAr);
				return;
			}

			var l_iLoop = 0;
			while (l_iLoop < ii_deviceAr.length) {
				i_returnAr.push({
					'groupID': dataAr[iCount].groupID,
					'device': ii_deviceAr[l_iLoop],
					'vid': ""
				});
				++l_iLoop;
			}
			++iCount;

			if (iCount == dataAr.length) {
				onDone(i_returnAr);
				return;
			} else {
				that.getGroupDevice(dataAr, iCount, i_returnAr, onDone, onFail);
			}
		}, onFail);
};

//遞回處理設備名稱轉換VID(要接Hydra的API)
// TODO: change to non-recursive approach
CRecordTrigger.prototype.getDeviceVid = function (dataAr, iCount, i_returnAr, onDone, onFail) {
	var that = this;
	LOG.warn(dataAr, 'RecordTrigger.getDeviceVid');
	
	// check if dataAr has valid data
	if (dataAr.length <= iCount) {
		var err = 'empty array';
		LOG.error(err, 'RecordTrigger.getDeviceVid');
		return UTIL.safeCall(onFail, err);			
	}
	
	// get data from DB 'camera'
	// TODO: probably no need for this query as this is only to lookup vid from deviceID in DB 'camera'
	camLib.getCameraData(dataAr[iCount].device,
		function (err, ii_deviceInfo) {
			if (err) {
				LOG.error(err);
				return UTIL.safeCall(onFail, err);
			}
			
			LOG.warn("CRecordTrigger::getDeviceVid returns " + iCount + "th device info successful!");

			// TODO: need to make it consistent for both IPcam & DVR
			// current inconsistency results from different data structure for DVR & IPcam in 'camera' DB
			if (ii_deviceInfo.type === 'onvif') {
				i_returnAr.push({
					'groupID': dataAr[iCount].groupID,
					'device': dataAr[iCount].device,
					'vid': ii_deviceInfo.data.streamHigh,
					//'vid': ii_deviceInfo.data.streamID[0]
				});					
			}
			// for DVR
			// NOTE: we should produce one entry for EACH DVR channel
			else {
				for (var i=0; i < ii_deviceInfo.child.length; i++) {
					i_returnAr.push({
						'groupID': dataAr[iCount].groupID,
						'device': dataAr[iCount].device,
						'vid': ii_deviceInfo.child[i].streamID
					});						
				}
			}
			
			++iCount;

			if (iCount == dataAr.length) {
				onDone(i_returnAr);
				return;
			} else {
				that.getDeviceVid(dataAr, iCount, i_returnAr, onDone, onFail);
			}
		});
};

//要遞回處理啟動設備錄影
CRecordTrigger.prototype.setRecordStart = function (i_type, i_toFTP, i_start, dataAr, iCount, onDone, onFail) {
	var that = this;
	//------------------------------------------------------
	//讀取設定
	var l_objSetting = new CRecordSetting();
	l_objSetting.get(dataAr[iCount].groupID,
		function (ii_objSetting) {
			SR.Video.Record.start(dataAr[iCount].vid,
				function (i_strError, ii_return) {
					if (i_strError == null) {
						//LOG.debug("CRecordTrigger::setRecordStart Record ii_return", ii_return);
						var toFTP = false;
						var l_iMin = 0;
						var l_iSec = 0;
						if (i_type != "一般錄影") //事件錄影
						{
							if (ii_objSetting.iPreRecordSec > 600)
								ii_objSetting.iPreRecordSec = 600;
							if (ii_objSetting.iPreRecordSec > 60) {
								l_iMin = Math.floor(ii_objSetting.iPreRecordSec / 60);
								l_iSec = ii_objSetting.iPreRecordSec % 60;
							} else {
								l_iSec = ii_objSetting.iPreRecordSec;
							}
							toFTP = i_toFTP;
						}
						var l_timeNow = new AeDate();
						var l_iTimeA = (l_timeNow.getDateNum() * 1000000) + i_start;
						var l_time = new AeDate(l_iTimeA);
						l_time.addMinutes(-l_iMin); //計算預錄影時間
						l_time.addSeconds(-l_iSec);
						var l_iFullTime = l_time.getFullDateNum();
						LOG.warn("CRecordTrigger::setRecordStart() 啟動 第" + iCount + "個 設備錄影  處理成功! ");
						that.saveStartLog({
								'groupID': dataAr[iCount].groupID,
								'type': i_type,
								'start': l_iFullTime,
								'device': dataAr[iCount].device,
								'vid': dataAr[iCount].vid,
								'done': false,
								'toFTP': toFTP
							},
							function () {
								++iCount;

								if (iCount == dataAr.length) {
									onDone(0);
									return;
								} else {
									that.setRecordStart(i_type, i_toFTP, i_start, dataAr, iCount, onDone, onFail);
								}
							},
							function () {
								LOG.warn("CRecordTrigger::setRecordStart() 錄影LOG 新增失敗 第" + iCount + "個 vid = " + dataAr[iCount]);
								++iCount;

								if (iCount == dataAr.length) {
									onDone(0);
									return;
								} else {
									that.setRecordStart(i_type, i_toFTP, i_start, dataAr, iCount, onDone, onFail);
								}
							});
					} else {
						LOG.warn("CRecordTrigger::setRecordStart() 錄影啟動 失敗 第" + iCount + "個 vid = " + dataAr[iCount] + " Error = " + i_strError);
						++iCount;

						if (iCount == dataAr.length) {
							onDone(0);
							return;
						} else {
							that.setRecordStart(i_type, i_toFTP, i_start, dataAr, iCount, onDone, onFail);
						}
					}
				}
			);
		}, onFail);
};
//要遞回處理結束設備錄影
CRecordTrigger.prototype.setRecordStop = function (i_type, i_end, dataAr, iCount, onDone, onFail) {
	var that = this;
	/*
	錄影的結束-要偵測是否有其他正在錄影中
	是 -> 只記LOG
	否 -> 停止錄影 -> 記錄LOG
	*/
	var l_timeNow = new AeDate();
	var l_iFullTime = (l_timeNow.getDateNum() * 1000000) + i_end;
	//搜尋
	DB.selectArray(l_dbRecordLog, {
			'end': 0,
			'device': dataAr[iCount].device,
			'vid': dataAr[iCount].vid
		},
		function (idataAr) {
			if (idataAr.length > 1) //有其他錄影執行中
			{
				LOG.warn("CRecordTrigger::setRecordStop() [有其他錄影執行中]");
				that.saveStopLog({
						'groupID': dataAr[iCount].groupID,
						'type': i_type,
						'end': l_iFullTime,
						'device': dataAr[iCount].device,
						'vid': dataAr[iCount].vid,
					},
					function () {
						LOG.warn("CRecordTrigger::setRecordStop() [有其他錄影執行中] 結束 第" + iCount + "個 設備錄影[只記LOG]  處理成功! ");
						++iCount;

						if (iCount == dataAr.length) {
							onDone(0);
							return;
						} else {
							that.setRecordStop(i_type, i_end, dataAr, iCount, onDone, onFail);
						}
					},
					function () {
						LOG.warn("CRecordTrigger::setRecordStop() 錄影LOG 新增失敗 第" + iCount + "個 vid = " + dataAr[iCount]);
						++iCount;

						if (iCount == dataAr.length) {
							onDone(0);
							return;
						} else {
							that.setRecordStop(i_type, i_end, dataAr, iCount, onDone, onFail);
						}
					});
			} else if (idataAr.length == 1 && idataAr[0].groupID == dataAr[iCount].groupID && idataAr[0].type == i_type) //自己的資料
			{
				LOG.warn("CRecordTrigger::setRecordStop() 只有自己錄影中");
				SR.Video.Record.stop(dataAr[iCount].vid,
					function (i_strError, ii_return) {
						if (i_strError == null) {
							LOG.debug("CRecordTrigger::setRecordStop Record ii_return", ii_return);
							that.saveStopLog({
									'groupID': dataAr[iCount].groupID,
									'type': i_type,
									'end': l_iFullTime,
									'device': dataAr[iCount].device,
									'vid': dataAr[iCount].vid,
								},
								function () {
									LOG.warn("CRecordTrigger::setRecordStop() 結束 第" + iCount + "個 設備錄影  處理成功! ");
									++iCount;

									if (iCount == dataAr.length) {
										onDone(0);
										return;
									} else {
										that.setRecordStop(i_type, i_end, dataAr, iCount, onDone, onFail);
									}
								},
								function () {
									LOG.warn("CRecordTrigger::setRecordStop() 錄影LOG 新增失敗 第" + iCount + "個 vid = " + dataAr[iCount]);
									++iCount;

									if (iCount == dataAr.length) {
										onDone(0);
										return;
									} else {
										that.setRecordStop(i_type, i_end, dataAr, iCount, onDone, onFail);
									}
								});
						} else {
							LOG.warn("CRecordTrigger::setRecordStart() 錄影結束 失敗 第" + iCount + "個 vid = " + dataAr[iCount] + " Error = " + i_strError);
							++iCount;

							if (iCount == dataAr.length) {
								onDone(0);
								return;
							} else {
								that.setRecordStop(i_type, i_end, dataAr, iCount, onDone, onFail);
							}
						}
					});
			} else {
				LOG.warn("CRecordTrigger::setRecordStop() [異常 沒有對應錄影資訊] 結束 第" + iCount + "個 設備錄影  處理成功! ");
				++iCount;

				if (iCount == dataAr.length) {
					onDone(0);
					return;
				} else {
					that.setRecordStop(i_type, i_end, dataAr, iCount, onDone, onFail);
				}
			}
		}, onFail);
};

// group setting check when HD full
CRecordTrigger.prototype.checkGroupSetting = function (dataAr, iCount, i_returnAr, onDone, onFail) {
	var that = this;
	
	// check the settings for a recording group
	var l_objSetting = new CRecordSetting();
	l_objSetting.get(dataAr[iCount].groupID,
		function (ii_objSetting) {

			LOG.warn("CRecordTrigger::checkGroupSetting() 取得Log 第" + iCount + "個 群組設定 groupID = " + dataAr[iCount].groupID + " bRewrite = " + l_objSetting.bRewrite);
		
			// check if it's "stop when full" for this group
			if (l_objSetting.bRewrite == false)
				i_returnAr.push(dataAr[iCount]);
					
			// store the 'RecordSetting' of this group (those that need to be stopped)  
			++iCount;

			if (iCount == dataAr.length) {
				onDone(i_returnAr);
				return;
			} 

			// keep checking
			that.checkGroupSetting(dataAr, iCount, i_returnAr, onDone, onFail);

		}, onFail);
};

// HD full processing
CRecordTrigger.prototype.onHardDiskFull = function (onDone, onFail) {
	var that = this;
	var l_time = new AeDate();
	var l_iTimeSearch = (l_time.iHours * 100) + (l_time.iMinutes);
	LOG.warn("CRecordTrigger::onHardDiskFull l_iTimeSearch = " + l_iTimeSearch);
	
	// find all currently on-going (i.e., end: 0) recording sessions
	DB.selectArray(l_dbRecordLog, {
			'end': 0
		},
		function (idataAr) {
			LOG.debug("CRecordTrigger::onHardDiskFull idataAr", idataAr);
			
			// if no recording found
			if (idataAr.length === 0) {
				LOG.warn("CRecordTrigger::onHardDiskFull no on-going recording!!");
				return onDone(0);
			} 
			
			// find the recording group(s)
			var l_logAr = [];
			var l_iCountLog = 0;
			
			that.checkGroupSetting(idataAr, l_iCountLog, l_logAr,
				// NOTE: here the returned value is an array of entries in 'RecordSetting' with matching groupID
				function (ii_objLogAr) {
					LOG.debug("CRecordTrigger::onHardDiskFull ii_objLogAr", ii_objLogAr);
					if (ii_objLogAr.length === 0) {
						LOG.warn("CRecordTrigger::onHardDiskFull no recording group that needs stopping!!");
						return onDone(0);
					}

					// get all devices within this group, to stop them
					var l_groupDeviceAr = [];
					var l_iCountTrigger = 0;
					that.getGroupDevice(ii_objLogAr, l_iCountTrigger, l_groupDeviceAr,
						function (ii_objDeviceAr) {
							LOG.debug("CRecordTrigger::onHardDiskFull ii_objDeviceAr", ii_objDeviceAr);
							
							//遞回處理設備名稱轉換VID(要接Hydra的API)
							var l_deviceVidAr = [];
							var l_iCountDevice = 0;
							that.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
								function (ii_objVidAr) {
									LOG.debug("CRecordTrigger::onHardDiskFull ii_objVidAr", ii_objVidAr);
									
									//要遞回處理結束設備錄影
									var l_iCountVid = 0;
									that.setRecordStop("一般錄影", l_iTimeSearch * 100, ii_objVidAr, l_iCountVid,
										function (ii_return) {
											onDone(0);
										}, onFail);
								}, onFail);
						}, onFail);
				}, onFail)
		}, onFail);
};

/*	
	curr_file sample:
	{ 
		start: 1450478024942,
		end: 1450478040063,
		to_del: false,
		vid: '4C8014CF-1C67-4E2A-B395-E4665F9EE70B',	
		fid: '201512190633428560000000'
	}
	
	recording sample:
	[{
	  "device": "D106E33D-8B84-499A-98D9-33644ADA2F47",
	  "done": false,
	  "end": NumberInt(0),
	  "groupID": NumberInt(1),
	  "now": 20151219054900,
	  "start": 20151219023000,
	  "toFTP": false,
	  "type": "一般錄影",
	  "vid": "5B10C9B1-974A-41B7-B6BF-41474F30BA68"
	}]
	
*/
// check if we need to update / close an ongoing recording session (update to DB)
CRecordTrigger.prototype.updateRecordLog = function (curr_file, recording, onDone) {
	var that = this;	
	
	// convert time (js timestamp -> AeDate format, EX:20150731235959)
	var file_start = new AeDate();
	file_start.setMilliseconds(curr_file.start);
	var file_end = new AeDate();
	file_end.setMilliseconds(curr_file.end);
		
	var file = {
		start: file_start.getFullDateNum(),
		end:   file_end.getFullDateNum()
	};
	
	LOG.warn('file: ', l_name);
	LOG.warn(file);
	LOG.warn('recording: ', l_name);
	LOG.warn(recording);

	// update recording info with the close time of current file
	// NOTE: this allows query results be returned even when recording is still happening
	if (recording.end === 0)
		recording.now = file.end;

/*
Sample Recording Cases

rec.start  recording (3hr)  rec.end
  <==========================>
|-1-|  |-2-|                |-3-|
|---------------4---------------|  

1) file.start <= rec.start && file.end >= rec.start
2) file.start >= rec.start && file.end <= rec.end
3) file.start <= rec.end   && file.end >= rec.end
4) file.start < rec.start  && file.end >= rec.end

(StartA <= EndB)  and  (EndA >= StartB)
file.start <= rec.end && file.end >= rec.start
*/		
	// check if the saved file falls within the duration of this recording entry
	// ref: http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
	// logic: file.start <= recording.end && file.end >= recording.start
	if (file.start <= recording.end && file.end >= recording.start) {

		LOG.warn('overlap exists. file.end: ' + file.end + ' recording.end: ' + recording.end, l_name);
		
		if (file.end >= recording.end) {
			LOG.warn('recording is done for vid[' + recording.vid + '] start: ' + recording.start + ' end: ' + recording.end, l_name);
			LOG.warn('last file in this recording is: ' + curr_file.fid, l_name);
			
			// TODO: shouldn't we update the end time for the recording as well?
			recording.done = true;
		}
	}
	
	// save recording to DB
	DB.updateValue(l_dbRecordLog, {
			'vid': recording.vid,
			'device': recording.device,
			'start': recording.start,
			'groupID': recording.groupID
		}, 
		recording, 
		// update success
		function () {
			UTIL.safeCall(onDone, null, recording);
		},
		// update fail		
		function (err) {
			UTIL.safeCall(onDone, err);
		});
};

// when a file is finished recording
/*

data sample:
{ 
	start: 1450478024942,
	end: 1450478040063,
	to_del: false,
	vid: '4C8014CF-1C67-4E2A-B395-E4665F9EE70B',	
	fid: '201512190633428560000000'
}

*/
CRecordTrigger.prototype.onFileRecorded = function (data) {
	LOG.sys("========= onFileRecorded ========  data", l_name);
	LOG.sys(data, l_name);
	
	//-------------------------------------------------------
	var that = this;
	
	var onDone = function (err, recording) {
		if (err) {
			LOG.error(err, l_name);
			return;
		}
	
		LOG.warn('record for [' + recording.vid + '] (' + recording.start + ', ' + recording.end + ') updated in DB!', l_name);
		
		// perform FTP upload if rec is done
		// TODO: probably this is buggy
		if (recording.done && recording.toFTP) {
			Event.getFTPSetting(
				function (ftpSetting) {
					var config = {
						host: ftpSetting.strHost,
						user: ftpSetting.strUser,
						password: ftpSetting.strPassword
					};
					
					var filepath = [{
						local: data.path,
						remote: ftpSetting.strPath + data.fid + data.fileType
					}];
					
					// FTP上傳
					SR.Notify.ftpUpload(config, filepath,
										function (err) {
											if (err) {
												LOG.error("CRecordTrigger::onFileRecorded err", l_name);
												LOG.error(err, l_name);
												return;
											} 
											LOG.warn("CRecordTrigger::onFileRecorded() FTP_Upload OK!", l_name);
										});
				},
				function () {
					LOG.error("CRecordTrigger::onFileRecorded() get FTP setting failed! ", l_name);
				}
			);
		}
	};

	DB.selectArray(l_dbRecordLog, {
			'vid': data.vid,
			'done': false
		},
		function (logArray) {
			if (logArray.length == 0) {
				LOG.sys("No scheduled recording in place for vid: " + data.vid, l_name);
				return;
			}
			
			LOG.warn(logArray.length + ' unfinished recordings found for vid: ' + data.vid, l_name);
			
			// find the latest-started one to keep update it, close all others
			var start = 0;
			var index = 0;
			for (var i=0; i < logArray.length; i++) {
				if (logArray[i].start > start) {
					start = logArray[i].start;
					index = i;
				}
			}		
			// update latest & close all others (left unclosed probably due to server crash/close)
			for (var i=0; i < logArray.length; i++) {
				if (i === index)
					RecordTrigger.updateRecordLog(data, logArray[index], onDone);
				else {
					logArray[i].end = logArray[i].now;
					logArray[i].done = true;
					RecordTrigger.updateRecordLog(data, logArray[i], onDone);
				}
			}
		},
		function () {
			LOG.error("CRecordTrigger::onFileRecorded() selectArray DB error!! ", l_name);
		}
	);
};
//觸發刪除群組
CRecordTrigger.prototype.onDeleteGroup = function (data, onDone, onFail) {
	var that = this;
	//移除
	DB.deleteValue('RecordSetting', {
			'groupID': data.groupID
		},
		function () { //移除
			DB.deleteValue(l_dbName, {
					'groupID': data.groupID
				},
				function () { //移除
					onDone(0); //
				}, onFail); //資料庫發生搜尋錯誤
		}, onFail); //資料庫發生搜尋錯誤
};

//
// handlers
//

//設定錄影排程
l_handlers.SetSchedule = function (i_event) {
	var error = false;
	var l_data = {};
	var l_connId = i_event.conn.connID;
	if (typeof i_event.data.iScheduleAr2 === 'string' && i_event.data.iScheduleAr2) {
		try {
			l_data.iScheduleAr2 = JSON.parse(i_event.data.iScheduleAr2);
		}
		catch (err) {
			error = true;
		};
	}
	l_data.groupID = parseInt(i_event.data.groupID);
	/*
	l_data = 
	{
	    'groupID':群組,
	    'iScheduleAr2':	時間排程	二維陣列int[7,48]	( 7天 , 24小時 *2 )
	}
	*/
	//log.Json("handlerRecord::SetSchedule l_data", l_data);
	//------------------------------------------------------------
	if (error) {
		i_event.done("SetSchedule", {
			'err': 'jsonType'
		});
		return;
	}
	RecordTrigger.setSchedule(l_data,
		function (ii_data) {
			log.Json("handlerRecord::SetSchedule ii_data", ii_data);
			//回傳
			i_event.done("SetSchedule", {
				'iReturn': ii_data
			});
		},
		function () {
			log.Error("handlerRecord::SetSchedule() 失敗! ");
			i_event.done("SetSchedule", {
				'iReturn': 1
			});
		}
	);
};
//設定預錄影秒數
l_handlers.SetPreRecordSec = function (i_event) {
	var l_data = i_event.data;
	var l_connId = i_event.conn.connID;
	//轉型
	l_data.groupID = parseInt(l_data.groupID);
	l_data.iPreRecordSec = parseInt(l_data.iPreRecordSec);
	/*
	i_data = 
	{
	    'groupID':群組ID,
	    'iPreRecordSec':預錄影秒數	單位:秒
	}
	*/
	//log.Json("handlerRecord::SetPreRecordSec l_data", l_data);
	//------------------------------------------------------------
	RecordTrigger.setPreRecordSec(l_data,
		function (ii_data) {
			log.Json("handlerRecord::SetPreRecordSec ii_data", ii_data);
			//回傳
			i_event.done("SetPreRecordSec", {
				'iReturn': ii_data
			});
		},
		function () {
			log.Error("handlerRecord::SetPreRecordSec() 失敗! ");
			i_event.done("SetPreRecordSec", {
				'iReturn': 1
			});
		}
	);
};

//滿碟設定
l_handlers.SetHardDiskFull = function (i_event) {
	var l_data = i_event.data;
	var l_connId = i_event.conn.connID;
	//轉型
	l_data.groupID = parseInt(l_data.groupID);
	/*
	i_data = 
	{
	    'groupID':群組ID,
	    'bRewrite':	停止錄影 xor 複寫覆蓋	(true:複寫覆蓋  false:停止錄影)
	}
	*/
	//log.Json("handlerRecord::SetHardDiskFull l_data", l_data);
	//------------------------------------------------------------
	RecordTrigger.setHardDiskFull(l_data,
		function (ii_data) {
			log.Json("handlerRecord::SetHardDiskFull ii_data", ii_data);
			//回傳
			i_event.done("SetHardDiskFull", {
				'iReturn': ii_data
			});
		},
		function () {
			log.Error("handlerRecord::SetHardDiskFull() 失敗! ");
			i_event.done("SetHardDiskFull", {
				'iReturn': 1
			});
		}
	);
};
//設定錄音
l_handlers.SetVoiceRecord = function (i_event) {
	var l_data = i_event.data;
	var l_connId = i_event.conn.connID;
	//轉型
	l_data.groupID = parseInt(l_data.groupID);
	/*
	i_data = 
	{
	    'groupID':群組ID,
	    'bVoiceRecord':	錄音
	}
	*/
	//log.Json("handlerRecord::SetVoiceRecord l_data", l_data);
	//------------------------------------------------------------
	RecordTrigger.setVoiceRecord(l_data,
		function (ii_data) {
			log.Json("handlerRecord::SetVoiceRecord ii_data", ii_data);
			//回傳
			i_event.done("SetVoiceRecord", {
				'iReturn': ii_data
			});
		},
		function () {
			log.Error("handlerRecord::SetVoiceRecord() 失敗! ");
			i_event.done("SetVoiceRecord", {
				'iReturn': 1
			});
		}
	);
};
//設定錄影資料(整份)
l_handlers.SetGroupRecordSetting = function (i_event) {
	var l_data = i_event.data;
	var l_connId = i_event.conn.connID;
	if (typeof i_event.data.iScheduleAr2 === 'string') {
		try {
			l_data.iScheduleAr2 = JSON.parse(i_event.data.iScheduleAr2);
		}
		catch (err) {
			i_event.done({
				'err': 'jsonType'
			});
			return;
		};
	}
	
	//轉型
	l_data.groupID = parseInt(l_data.groupID);
	l_data.iPreRecordSec = parseInt(l_data.iPreRecordSec);
	
	/*
	i_data = 
	{
	    'groupID':群組ID,
	    'iScheduleAr2':	時間排程	二維陣列int[7,48]	( 7天 , 24小時 *2 )
	    'iPreRecordSec':	預錄影秒數	單位:秒
	    'bRewrite':	停止錄影 xor 複寫覆蓋	(true:複寫覆蓋  false:停止錄影)
	    'bVoiceRecord':	錄音
	}
	*/
	//log.Json("handlerRecord::GetGroupRecordSetting l_data", l_data);
	//------------------------------------------------------------
	RecordTrigger.setGroupRecordSetting(l_data,
		function (ii_data) {
			log.Json("handlerRecord::SetGroupRecordSetting ii_data", ii_data);
			//回傳
			i_event.done("SetGroupRecordSetting", {
				'iReturn': ii_data
			});
			//console.log("going to checkNowRecord@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
			//RecordTrigger.checkNowRecord(function(){console.log("checkNowRecord done!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");});
		},
		function () {
			log.Error("handlerRecord::SetGroupRecordSetting() 失敗! ");
			i_event.done("SetGroupRecordSetting", {
				'iReturn': 1
			});
		}
	);
};

//取得錄影設定資料
l_handlers.GetGroupRecordSetting = function (i_event) {
	var l_data = i_event.data;
	var l_connId = i_event.conn.connID;
	//轉型
	l_data.groupID = parseInt(l_data.groupID);
	/*
	i_data = 
	{
	    'groupID':群組ID,
	}
	*/
	//log.Json("handlerRecord::GetGroupRecordSetting l_data", l_data);
	//------------------------------------------------------------
	RecordTrigger.getGroupRecordSetting(l_data,
		function (ii_data) {
			log.Json("handlerRecord::GetGroupRecordSetting ii_data", ii_data);
			//回傳
			i_event.done("GetGroupRecordSetting", {
				'objReturn': ii_data
			});
		},
		function () {
			log.Error("handlerRecord::GetGroupRecordSetting() 失敗! ");
			i_event.done("GetGroupRecordSetting", {
				'objReturn': null
			});
		}
	);
};

//取得通用錄影設定資料
l_handlers.GetCommonRecordSetting = function (i_event) {
	var l_data = i_event.data;
	var l_connId = i_event.conn.connID;
	/*
	i_data = 
	{
	}
	*/
	//log.Json("handlerRecord::GetCommonRecordSetting l_data", l_data);
	//------------------------------------------------------------
	RecordTrigger.getCommonRecordSetting(l_data,
		function (ii_data) {
			log.Json("handlerRecord::GetCommonRecordSetting ii_data", ii_data);
			//回傳
			i_event.done("GetCommonRecordSetting", {
				'objReturn': ii_data
			});
		},
		function () {
			log.Error("handlerRecord::GetCommonRecordSetting() 失敗! ");
			i_event.done("GetCommonRecordSetting", {
				'objReturn': null
			});
		}
	);
};


//公開物件
global.CRecordSchedule = CRecordSchedule();
global.CRecordSetting = CRecordSetting();
global.RecordTrigger = new CRecordTrigger();

//計時器evtMin
timeTrigger.evtMin.register(function (i_iTime) {
	LOG.warn("CRecordTrigger (Minute): " + i_iTime, l_name);
	
	if (i_iTime == 0 || i_iTime == 30) //半小時
	{
		var l_time = new AeDate();
		var l_iday = l_time.iDay;
		if (l_iday == 0)
			l_iday = 7;
		var l_iTimeSearch = (l_time.iHours * 100) + l_time.iMinutes;
		//----------------------
		LOG.warn("CRecordTrigger::evtMin  iDay = " + l_iday + " l_iTimeSearch = " + l_iTimeSearch);
		//偵測啟動錄影-------------------------------------------------------------
		//搜尋列表(星期幾 幾點幾分 持續錄影)
		DB.selectArray(l_dbName, {
				'start': (l_iday * 10000) + l_iTimeSearch,
				'iType': 2
			},
			function (idataAr) {
				//LOG.debug("CRecordTrigger::evtMin idataAr", idataAr);
				if (idataAr.length > 0) //有東西
				{
					//要遞回處理取得群組設備
					var l_groupDeviceAr = [];
					var l_iCountTrigger = 0;
					RecordTrigger.getGroupDevice(idataAr, l_iCountTrigger, l_groupDeviceAr,
						function (ii_objDeviceAr) {
							//LOG.debug("CRecordTrigger::evtMin ii_objDeviceAr", ii_objDeviceAr);
							//遞回處理設備名稱轉換VID(要接Hydra的API)
							var l_deviceVidAr = [];
							var l_iCountDevice = 0;
							RecordTrigger.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
								function (ii_objVidAr) {
									LOG.warn("CRecordTrigger::evtMin ii_objVidAr", 'RecordTrigger');
									LOG.warn(ii_objVidAr, 'RecordTrigger');
									
									//要遞回處理啟動設備錄影
									var l_iCountVid = 0;
									RecordTrigger.setRecordStart("一般錄影", false, l_iTimeSearch * 100, ii_objVidAr, l_iCountVid,
										function (ii_return) {},
										function () {});
								},
								function () {});
						},
						function () {});
				} else {
					LOG.warn("CRecordTrigger::evtMin 無排程啟動錄影 iDay = " + l_iday + " 時間 = " + l_iTimeSearch);
				}
			},
			function () {});
		//偵測結束錄影-------------------------------------------------------------
		//搜尋列表(星期幾 幾點)
		DB.selectArray(l_dbName, {
				'end': (l_iday * 10000) + l_iTimeSearch,
				'iType': 2
			},
			function (idataAr) {
				//LOG.debug("CRecordTrigger::evtMin idataAr", idataAr);
				if (idataAr.length > 0) //有東西
				{
					//要遞回處理取得群組設備
					var l_groupDeviceAr = [];
					var l_iCountTrigger = 0;
					RecordTrigger.getGroupDevice(idataAr, l_iCountTrigger, l_groupDeviceAr,
						function (ii_objDeviceAr) {
							//LOG.debug("CRecordTrigger::evtMin ii_objDeviceAr", ii_objDeviceAr);
							//遞回處理設備名稱轉換VID(要接Hydra的API)
							var l_deviceVidAr = [];
							var l_iCountDevice = 0;
							RecordTrigger.getDeviceVid(ii_objDeviceAr, l_iCountDevice, l_deviceVidAr,
								function (ii_objVidAr) {
									LOG.debug("CRecordTrigger::evtMin ii_objVidAr", ii_objVidAr);
									//要遞回處理結束設備錄影
									var l_iCountVid = 0;
									RecordTrigger.setRecordStop("一般錄影", l_iTimeSearch * 100, ii_objVidAr, l_iCountVid,
										function (ii_return) {},
										function () {});
								},
								function () {});
						},
						function () {});
				} else {
					LOG.warn("CRecordTrigger::evtMin 無排程結束錄影 iDay = " + l_iday + " 時間 = " + l_iTimeSearch);
				}
			},
			function () {});
	}
});

SR.Callback.onStart(function () {
	SR.Video.Record.onRecorderStop(RecordTrigger.onFileRecorded);
});
