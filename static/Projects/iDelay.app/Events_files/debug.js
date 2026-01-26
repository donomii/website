/**
 * Debugging output for JavaScript.
 * matthew 2011/12/2
 */

/**
 * Polyfill for Function.prototype.bind, present from ECMAScript 5.
 * Modified version (IE8 resistant) of one found in Mozilla Developer Network:
 * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind
 */
if (!Function.prototype.bind) {
	Function.prototype.bind = function (oThis) {
		// IE8 thinks some builtin functions are objects rather than functions
		if (typeof(this) !== "function" && typeof(this) !== "object") {
			// closest thing possible to the ECMAScript 5 internal IsCallable function
			throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
		}
		var aArgs = Array.prototype.slice.call(arguments, 1),
			fToBind = this,
			fNOP = function () {},
			fBound = function () {
				// Workaround: fToBind may not be a Function, so may lack an 'apply' member
				return Function.prototype.apply.call(
					fToBind,
					this instanceof fNOP && oThis ? this : oThis,
					aArgs.concat(Array.prototype.slice.call(arguments))
				);
			};
		fNOP.prototype = this.prototype;
		fBound.prototype = new fNOP();
		return fBound;
	};
}

/**
 * If true, and if unable to output debug messages unobtrusively, fall back to
 * showing such messages using alert(). If false, attempt to output debug
 * messages unobtrusively, or if that fails, silently throw the messages away.
 */
var showDebugAlerts = true;
var maxAlertCount = 5;

function limitInvocations(thisObj, func, limit) {
	var count = 0;
	return (function() {
		var args;
		if (++count > limit) {
			return;
		}
		// Workaround: Function.apply cannot use 'arguments' as-is in older JS engines
		args = Array.prototype.slice.call(arguments);
		// Workaround: f may not be a Function, so may lack an 'apply' member
		return Function.prototype.apply.call(func, thisObj, args);
	});
}
	
function getFuncName(func) {
	var m;
	if ('name' in func) {
		return func.name;
	}
	m = func.toString().match(/function[ \t\r\n]+([^ \t\r\n(]+)[ \t\r\n]*\(/);
	if (m) {
		return m[1];
	}
	return undefined;
}

var origWindowAlert = window.alert;
function alertWithCallerName(str) {
	var callerName = '';
	if (!callerName && alertWithCallerName.caller) {
		callerName = getFuncName(alertWithCallerName.caller);
	}
	if (!callerName && arguments.caller) {
		callerName = getFuncName(arguments.caller);
	}
	if (!callerName) {
		callerName = '(anonymous function)';
	}
	origWindowAlert(callerName + ': ' + str);
}
window.alert = alertWithCallerName;

/**
 * In Firefox 7.0.1 {Win32|Win64|Linux}, console.log displays any arguments in the
 * web console, JSON-encoding them as necessary.
 * In Internet Explorer, it displays in the script tab of the
 * developer tools window, but it only works when the 'developer tools' window
 * is open at the time that console.log is called.
 */
function getDebugFunc() {
	if ('object' === typeof(console) && 'undefined' !== typeof(console.log)) {
		// Workaround: console.log may not be a Function, so may lack a 'bind' member
		return Function.prototype.bind.call(console.log, console);
	} else if (showDebugAlerts) {
		return limitInvocations(window, alert, maxAlertCount);
	}
	return function() {
		// Nowhere unobtrusive to output these data. Drop them on the floor.
	};
}

function argsToString(args) {
	var str = '';
	for ( var i = 0; i < args.length; i++) {
		if ('string' == typeof (args[i])) {
			str += args[i];
		} else if ('function' == typeof (JSON.stringify)) {
			/**
			 * This either hangs, or takes impossibly long to run.
			 * Consequently, it is disabled.
			 */
			/*
			if ('function' == typeof (JSON.decycle)) {
				str += JSON.stringify(JSON.decycle(args[i]));
			} else {
				str += JSON.stringify(args[i]);
			}
			*/
			str += JSON.stringify(args[i]);
		} else {
			str += args[i];
		}
	}
	return str;
}

/**
 * Display a list of JavaScript objects of arbitrary type.
 * 
 * @param objs
 *            Any number of any type of argument - variadic.
 */
var debug = getDebugFunc();

function debugEvent(funcName, event) {
	if (event) {
		debug(funcName + ': event=' + event.type + '; target=' + event.target
				+ '; currentTarget=' + event.currentTarget);
	} else {
		debug(funcName + ': event=null');
	}
}
