// FIXME: There seems to be no way to get these from the JS Date class.
// FIXME: Globalisation/localisation.
function toMonthName(monthIndex) {
	var monthNames = [
	    'january',
	    'february',
	    'march',
	    'april',
	    'may',
	    'june',
	    'july',
	    'august',
	    'september',
	    'october',
	    'november',
	    'december'
	];
	if (monthIndex < 0 || monthIndex >= monthNames.length) {
		throw 'Month index ' + monthIndex + ' not in range [0..' + (monthNames.length - 1) + ']';
	}
	return monthNames[monthIndex];
}

/**
 * Convert a time duration in milliseconds into a more human-readable form
 * TODO: Internationalised month support
 */
function humanReadableDuration(millis, smallestUnit) {
	var i, isPast = (millis < 0), res = '', tuple;
	millis = Math.abs(millis);
	// Decompose into units, from largest to smallest
	for (i = 0; i < humanReadableDuration.tuples.length; i++) {
		tuple = humanReadableDuration.tuples[i];
		if (tuple.unit < smallestUnit) {
			break;
		}
		tuple.n = Math.floor(millis / tuple.unit);
		millis = millis % tuple.unit;
	}
	// Form string from non-zero units
	for (i = 0; i < humanReadableDuration.tuples.length; i++) {
		tuple = humanReadableDuration.tuples[i];
		if (tuple.unit < smallestUnit) {
			break;
		}
		if (tuple.n) {
			if (res) {
				res += ', ';
			}
			res += tuple.n + ' ' + tuple.name;
			if (tuple.n !== 1) {
				res += 's';
			}
		}
	}
	if (!res) {
		res = 'now';
	} else if (isPast) {
		res += ' ago';
	}
	return res;
}
humanReadableDuration.oneMillisecond = 1;
humanReadableDuration.oneSecond = 1000 * humanReadableDuration.oneMillisecond;
humanReadableDuration.oneMinute = 60 * humanReadableDuration.oneSecond;
humanReadableDuration.oneHour = 60 * humanReadableDuration.oneMinute;
humanReadableDuration.oneDay = 24 * humanReadableDuration.oneHour;
humanReadableDuration.oneYear = 365.25 * humanReadableDuration.oneDay;
humanReadableDuration.tuples = [
	{ unit: humanReadableDuration.oneYear,        name: 'year' },
	{ unit: humanReadableDuration.oneDay,         name: 'day' },
	{ unit: humanReadableDuration.oneHour,        name: 'hour' },
	{ unit: humanReadableDuration.oneMinute,      name: 'minute' },
	{ unit: humanReadableDuration.oneSecond,      name: 'second' },
	{ unit: humanReadableDuration.oneMillisecond, name: 'millisecond' }
];
