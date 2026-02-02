
//forceToTop doesn't always fire correctly if we call it from onLoad(), so we try multiple times after loading.  This should hide the address bar on mobile devices.
var tries = 5;
function forceToTop() {
	window.scrollTo(0, 1);


	if (tries-- > 0) { setTimeout("forceToTop()", 1000); }



	if (navigator.userAgent.match(/Android/i)) {
		window.scrollTo(0, 1);
	}
}


//Fullscreen canvas for mobile devices
function fullSizeCanvas(aName) {
	var canvas = document.getElementById(aName);
	if (canvas && canvas.getContext) {
		var ctx = canvas.getContext('2d');
		ctx.canvas.width = window.innerWidth;
		canvasWidth = window.innerWidth
		canvasHeight = window.innerHeight
		ctx.canvas.height = window.innerHeight;
		//Update game world boundaries to match new canvas size
		xmax = window.innerWidth * 4;
		ymax = window.innerHeight * 4;

		//playSound();
		//actuallyPlay();
	}
}

//Half size coanvas for embedding into website
function halfSizeCanvas(aName) {
	var canvas = document.getElementById(aName);
	if (canvas && canvas.getContext) {
		var ctx = canvas.getContext('2d');
		ctx.canvas.width = window.innerWidth / 2.0;
		canvasWidth = window.innerWidth / 2.0;
		canvasHeight = window.innerHeight / 2.0;
		ctx.canvas.height = window.innerHeight / 2.0;
		ymax = canvasWidth;
		xmax = canvasWidth;
		//playSound();
		//actuallyPlay();
	}
}
