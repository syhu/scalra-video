//---------------------------------------------//
//  2015.07.14: 新增透過id取得串流位置         //
//                                             //
//---------------------------------------------//
/*
 * 
 *
 */

// db name
var dbName = 'camera';

exports.getNameById = function (id, onDone) {
	if (typeof onDone !== 'function') {
		LOG.error('getCameraNameById: onDone error');
		return 'error';
	}
	var err = false;
	SR.DB.getData(dbName, {
			_id: id
		},
		function (data) {
			if (data) {
				onDone(err, data.name);
			} else {
				err = true;
				onDone(err, 'DB error');
			}
		},
		function (errMsg) {
			err = true;
			onDone(err, 'DB error');
		});
};

exports.cameraCount = function (onDone) {
	if (typeof onDone !== 'function') {
		LOG.error('CameraCount: onDone error');
		return 'error';
	}
	var err = false;
	SR.DB.getArray(dbName,
		function (data) {
			var count = 0;
			for (var k in data) {
				if (data[k].type === 'onvif') {
					count++;
				} else if (data[k].type === 'dvr') {
					count += data[k].child.length;
				}
			}
			onDone(err, count);
		},
		function () {
			err = true;
			onDone(err, 'DB error');
		}, {}
	);
};
exports.getCameraData = function (id, onDone) {

	if (typeof onDone !== 'function') {
		LOG.error('onDone error');
		return 'error';
	}
	var err = false;
	SR.DB.getData(
		dbName, {
			_id: id
		},
		function (data) {
			if (data) {
				onDone(err, data);
			} else {
				onDone(err, {});
			}
		},
		function (error) {
			err = 'DBfail';
			onDone(err, error);
		}
	);
};
