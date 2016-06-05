/* 
en(arg); 6位 0-9 A-Z
de(arg); XXXX-XXXX-XXXX-XXXX 16 位 0-9 A-Z
en() = 把第一位 md5sum 
(rand1 + rand2 + rand3) mod 10 -
*/

var crypto = require('crypto');

// generate hash value for a input string 
var hashString = function (arg) {
	var algorithm = arg.algorithm || 'md5'; //can be 'sha1', 'md5', 'sha256', 'sha512'
	var output_encoding = arg.output_encoding || 'hex'; //can be 'hex', 'binary' or 'base64'
	var input_encoding = arg.input_encoding || 'binary'; //can be 'utf8', 'ascii' or 'binary'
	var sum = crypto.createHash(algorithm);
	if (typeof(arg) === 'object') sum.update(arg.input, input_encoding);
	else if (typeof(arg) === 'string') sum.update(arg);
	return sum.digest(output_encoding).toUpperCase();
}

// generate a random "number"
var getRandomNumberString = function (arg){
	var length = arg.length || 6;
	var randomNumberString = '';
	
	for (;;){
		randomNumberString += (Math.random()*100000000000000).toString();
		randomNumberString = randomNumberString.replace('.','');
		if(randomNumberString.length > length) break;
	}
	
	return randomNumberString.substring(0,length);
}

// bytewise hex computation {s1: string, s2: string, operator: add|sub}
var computeHex = function (arg) {
	if (!arg) return;
	if (!arg.s1 || !arg.s2 || !arg.operator) return;
	if (arg.s1.length != arg.s2.length) return;
	var s1 = [];
	var s2 = [];
	var s9 = [];
	var result = []; // result array 
	for (var i = 0 ; i < arg.s1.length; i++ ) s1.push(parseInt(arg.s1.substring(i, i+1), 16));
	for (var i = 0 ; i < arg.s2.length; i++ ) s2.push(parseInt(arg.s2.substring(i, i+1), 16));
	
	switch (arg.operator.toLowerCase()) {
		case 'add':
			for (var i = 0 ; i < s1.length ; i++) s9[i] = s1[i] + s2[i];
		break;
		case 'sub':
			for (var i = 0 ; i < s1.length ; i++) s9[i] = s1[i] - s2[i];
		break;
		default:
		break;
	}

	for (var i = 0 ; i < s9.length ; i++) {
		if (s9[i] >= 0 && s9[i] <=9) result[i] = s9[i].toString(16);
		else if (s9[i] === -1) result[i] = 'F';
		else if (s9[i] === -2) result[i] = 'E';
		else if (s9[i] === -3) result[i] = 'D';
		else if (s9[i] === -4) result[i] = 'C';
		else if (s9[i] === -5) result[i] = 'B';
		else if (s9[i] === -6) result[i] = 'A';
		else if (s9[i] === -7) result[i] = '9';
		else if (s9[i] === -8) result[i] = '8';
		else if (s9[i] === -9) result[i] = '7';
		else if (s9[i] === -10) result[i] = '6';
		else if (s9[i] === -11) result[i] = '5';
		else if (s9[i] === -12) result[i] = '4';
		else if (s9[i] === -13) result[i] = '3';
		else if (s9[i] === -14) result[i] = '2';
		else if (s9[i] === -15) result[i] = '1';
		else if (s9[i] === -16) result[i] = '0';
		else if (s9[i] === 10) result[i] = 'A';
		else if (s9[i] === 11) result[i] = 'B';
		else if (s9[i] === 12) result[i] = 'C';
		else if (s9[i] === 13) result[i] = 'D';
		else if (s9[i] === 14) result[i] = 'E';
		else if (s9[i] === 15) result[i] = 'F';
		else if (s9[i] === 16) result[i] = '0';
		else if (s9[i] === 17) result[i] = '1';
		else if (s9[i] === 18) result[i] = '2';
		else if (s9[i] === 19) result[i] = '3';
		else if (s9[i] === 20) result[i] = '4';
		else if (s9[i] === 21) result[i] = '5';
		else if (s9[i] === 22) result[i] = '6';
		else if (s9[i] === 23) result[i] = '7';
		else if (s9[i] === 24) result[i] = '8';
		else if (s9[i] === 25) result[i] = '9';
		else if (s9[i] === 26) result[i] = 'A';
		else if (s9[i] === 27) result[i] = 'B';
		else if (s9[i] === 28) result[i] = 'C';
		else if (s9[i] === 29) result[i] = 'D';
		else if (s9[i] === 30) result[i] = 'E';
		else if (s9[i] === 31) result[i] = 'F';
		else if (s9[i] === 32) result[i] = '0';
	}
	
	//console.log(s1);
	//console.log(s2);
	//console.log(s9);
	//console.log(result);
	var re = result.toString().replace(/,/g,'');
	return re;
}

var spliter = function (arg) {
	var input = arg.input || "";
	var period = arg.period || 4;
	var i = input.split("");
	
	//var arr = content.split("");
	//arr.splice(18, 0, "$");
	//arr.join("");
	
	return i;
}
//===========================================================
function PwRecovery()
{
};

PwRecovery.prototype.en = function (arg)
{
    if (!arg) return;
    var len = arg.length || 6;
    var pad = arg.pad || "";
    if (!arg.len || typeof (arg.len) != 'number') return;
    var x = getRandomNumberString({ length: len });
    var key = x.substring(0, 1);
    var msg = x.substring(1) + pad;
    var keyHash = hashString(key);
    var puzzle = keyHash.substring(0, msg.length);
    //console.log(x);
    //console.log(key + " " + keyHash);
    //console.log(msg + " " + puzzle);
    return key + "" + computeHex({ s1: msg, s2: puzzle, operator: "add" });
}

PwRecovery.prototype.de = function (arg)
{
    var key = arg.substring(0, 1);
    var cipher = arg.substring(1);
    var keyHash = hashString(key);
    var puzzle = keyHash.substring(0, cipher.length);
    return key + "" + computeHex({ s1: cipher, s2: puzzle, operator: "sub" });
}

//公開物件
if (typeof require !== 'undefined')
{
    global.pwRecovery = new PwRecovery;
}

//var sn = en(9);
//var plain = de(sn);
//console.log("sn=" + sn + " plain=" + plain);
