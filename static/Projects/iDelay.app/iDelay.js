
//Attempts to hide url bar on iphone
var tries = 5;
function forceToTop(){
	window.scrollTo(0,1);
	if(tries-- > 0) {setTimeout("forceToTop()",1000);}
}

   function calcSecs(targetDate) {
      eventDate = targetDate;
  var target = new Date(targetDate);
  var now = new Date();
  var diff = new Date(target-now);
  var secs = Math.floor(diff.valueOf()/1000);
  return secs;
}

 function countdown_obj() {
	var time_left = 10; //number of seconds for countdown
	var output_element_id = 'javascript_countdown_time';
    var output_element = "";
	var keep_counting = 1;
	var no_time_left_message = 'Done!';
    var eventDate = "";



	function countdown() {
        time_left = calcSecs(eventDate);
		if(time_left < 2) {
			keep_counting = 0;
		}
 
		time_left = time_left - 1;
	}
 
	function add_leading_zero(n) {
		if(n.toString().length < 2) {
			return '0' + n;
		} else {
			return n;
		}
	}
 
	function format_output() {
		var hours, minutes, seconds;
		seconds = time_left % 60;
		minutes = Math.floor(time_left / 60) % 60;
		hours = Math.floor(time_left / 3600);
 
		seconds = add_leading_zero( seconds );
		minutes = add_leading_zero( minutes );
		hours = add_leading_zero( hours );
 
		return hours + ':' + minutes + ':' + seconds;
	}
 
	function show_time_left() {
		output_element.innerHTML = format_output();//time_left;
	}
 
	function no_time_left() {
		output_element.innerHTML = no_time_left_message;
	}
 
    this.count = function () {
			countdown();
			show_time_left();
		}
		
	this.timer = function () {
			this.count();
 
			if(keep_counting) {
				//setTimeout("this.timer();", 1000);
			} else {
				no_time_left();
			}
		}
		//Kristian Messer requested recalculation of time that is left
		function setTimeLeft(t) {
			time_left = t;
			if(keep_counting == 0) {
				this.timer();
			}
		}
		function init(t, element_id) {
			time_left = calcSecs(t);
			output_element_id = element_id;
            output_element = document.getElementById(output_element_id);
			this.timer();
		}
		this.init_with_elem = function (t, element_id) {
			time_left = calcSecs(t);
            eventDate = t;
			output_element = element_id;

			this.timer();
		}

	
};

	function add_leading_zero(n) {
		if(n.toString().length < 2) {
			return '0' + n;
		} else {
			return n;
		}
	}
 

function format_output(time_left) {
		var hours, minutes, seconds;
		seconds = time_left % 60;
		minutes = Math.floor(time_left / 60) % 60;
		hours = Math.floor(time_left / 3600);
 
		seconds = add_leading_zero( seconds );
		minutes = add_leading_zero( minutes );
		hours = add_leading_zero( hours );
 
		return hours + ':' + minutes + ':' + seconds;
	}

 var javascript_countdown = new countdown_obj();
var timers = new Array();
function newTimer(secs, elem) {
var timer = new countdown_obj(); 
timers.push([elem, secs]);
//alert(timers);
timer.init_with_elem(secs, elem.firstChild);    
}

    function startTimers() {
        var i;
        for(i=0;i<timers.length;i++) { var a = timers[i]; a[0].innerHTML = format_output(calcSecs(a[1])-calcSecs(new Date()));}
        setTimeout("startTimers();", 1000);
}

//time to countdown in seconds, and element ID
//javascript_countdown.init(3673, 'timespan');

