
	window.scrollTo(0,1);
    function getVal(an_id) {
    	return document.getElementById(an_id).value;
}
    function deleteParent(elem) {
        var target = elem.parentNode;
        target.parentNode.removeChild(target);
}

    function load_events() {
      var json = localStorage['Events.events'];
      var eventList = new Array;
			try {
				eventList = JSON.parse(json);
			} catch (err1) {
				console.log("Corrupt saved data: ", json);
				localStorage.removeItem('Events.events');
			}
	for(i=0;i<eventList.length;i++) {
	  var newDate = new Date(eventList[i].time);
	  var obj=document.getElementById('event_template').cloneNode(true);
	  obj.style.display = 'block';
	  obj.firstChild.innerHTML = 'Starting...';
	  obj.firstChild.nextSibling.innerHTML = newDate;
	  obj.lastChild.innerHTML=eventList[i].text;
	  document.getElementById('display').appendChild(obj);
	  javascript_countdown = new countdown_obj();
	  newTimer(newDate, obj.firstChild);sortEvents();
	}
	
	
    }

    function save_events () {
      var some_events=new Array;
      var eventList = document.getElementById('display').childNodes;
      var i;
      for(i=0;i<eventList.length;i++) {	
	  try {
	    var e1 = eventList.item(i);
	    var t1 = e1.firstChild.nextSibling.innerHTML;
	    var m1 = e1.lastChild.innerHTML;
	    some_events.push( { "time" : t1 , "text" : m1  } );
	  } catch (err1) {
	  
	  }
      }
      some_events.shift();
      some_events.shift();
      localStorage['Events.events'] = JSON.stringify(some_events);
    }
    
    function hideAll() {
        hideEle('display_pane');
        hideEle('create_event');
        hideEle('examine');
}
    function hideEle(an_id) {
    	document.getElementById(an_id).style.display = "none";
}
    function showEle(an_id) {
    	document.getElementById(an_id).style.display = "block";
}
    function setClick(element) {
    	document.getElementById("display").onclick = function (){alert('foo');};
}


    function getInputDate() {
    myDate = getVal("year")+"/" + ( 1+ parseInt(getVal("month"))) + "/" + getVal("day") + " " +
    getVal("hour") + ":" + getVal("minute");
    return myDate;
}

    function sortEvents() {
      var eventList = document.getElementById('display').childNodes;
      var i;
      for(i=0;i<eventList.length-1;i++) {
      try {
      var e1 = eventList.item(i);
      var e2 = eventList.item(i+1);
      var t1 = e1.firstChild.nextSibling.innerHTML;
      var t2 = e2.firstChild.nextSibling.innerHTML; 
      if (calcSecs(new Date(t1)) > calcSecs(new Date(t2))) {
	  e2.parentNode.removeChild(e2);
	  e1.parentNode.insertBefore(e2, e1);
      }
      } catch (err) {
      }
      }
    }

    function show_create_box () {
    var today=new Date();

    var s=today.getSeconds();
    document.getElementById("hour").value=today.getHours();
	var min = today.getMinutes();
	var rem = min % 5;
	min = min-rem;
    document.getElementById("minute").value=min;
    document.getElementById("day").value=today.getDate();
    document.getElementById("month").value=today.getMonth();
	document.getElementById("year").value=today.getFullYear();
	hideEle('display_pane');showEle('create_event');
}
    function startSort() {
        sortEvents();
        setTimeout("startSort();", 5000);
}

  function show_display () {
    hideAll();
    showEle('display_pane');
  }

  function startListeners() {
    document.addEventListener("deviceready", onDevReady, false);
}

function onDevReady() { 
    document.addEventListener("backbutton", backKeyDown, false);
}

function backKeyDown() {
   show_display();
}

function switch_style ( css_title )
{
// You may use this script on your site free of charge provided
// you do not remove this notice or the URL below. Script from
// http://www.thesitewizard.com/javascripts/change-style-sheets.shtml
  var i, link_tag ;
  for (i = 0, link_tag = document.getElementsByTagName("link") ;
    i < link_tag.length ; i++ ) {
    if ((link_tag[i].rel.indexOf( "stylesheet" ) != -1) &&
      link_tag[i].title) {
      link_tag[i].disabled = true ;
      if (link_tag[i].title == css_title) {
        link_tag[i].disabled = false ;
      }
    }
   
  }
}