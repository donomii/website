//Processing code for drawing the canvas and handling input

//Default settings for width and height.  Overriden on startup.
ymax = height*4;
xmax = width * 8;

//We have to do manual dragging
dragging = false;

//User can "zoom out" to see the full map, or in to see the local view.
viewscale = 2;
overview=false;

//Name, speed, owner
ship = [["Explorer", 10, 1]];
shipPos = [1,2,3,4,5,6,7,8,9,10];
planet=[1,2,3,4,5,6,7,8,9,10];
resources=[1,2,3,4,5,6,7,8,9,10];

//Name, flag colour
player=[["Neutral", #AAAAAA], ["Bob", #FF0000], ["Tom", #009900], ["Harry", #0000FF]  ];


X = 20;
Y = 20;
offSetX=0;
offSetY=0;
swirlie = new Swirlie();

//The currently selected move target
PlanetX = 200;
PlanetY = 200;

function makePlanets () {
	for(i=0;i<10;i++) {
		//PositionX, PositionY, owner, planetname
		planet[i] = [Math.random()*xmax, Math.random()*ymax, int(Math.random()*4), nextPlanet()];
		resources[i] = [Math.random()*20, Math.random()*20,Math.random()*20,Math.random()*20,Math.random()*20];
	}
}

function makeShips () {
	for(i=0;i<10;i++) {
			//PositionX, PositionY, owner, shipname
			shipPos[i] = [Math.random()*xmax, Math.random()*ymax, Math.random()*xmax, Math.random()*ymax ];
			ship[i] = [ nextShip(),int(Math.random()*4)];
	}
}


selected_ship = -1;
HandleBox handlebox;

void setup(){  
	background(48);
	size( 320, 460 );  

	strokeWeight( 10 );  
	frameRate( 15 );  
	X = width / 2;  
	Y = height / 2;  
	nX = X;  
	nY = Y;    
	makePlanets(); 
	makeShips(); 
	handlebox = new HandleBox();
	handlebox.visible=true;
}  

void drawOutlineText(astring, xpos, ypos){
if(!overview){
	fill(0)	
	text(astring, xpos+1, ypos);
	text(astring, xpos, ypos+1);
	text(astring, xpos, ypos-1);
	text(astring, xpos-1, ypos);
	}
}



function moveCost(a_number) {
	return int(a_number/10);
}


//Are two points within dist of each other?
boolean closeTo(x1,y1,x2,y2,dist) {
	if(Math.abs(x1-x2) < dist){
		if(Math.abs(y1-y2) < dist){
			return true;}}
	return false;
}

void mouseClicked() {
	if (mouseButton == RIGHT) { 
		toggleOverview();
	} else {
		console.log("mouseclick at "+mouseX + "," + mouseY);
		var selected=false;
		//deselect();
		
			for(i=0;i<10;i++) {
				my p = planet[i];
				if(Math.abs(p[0]-(mouseX-offSetX)) < 15){
						if(Math.abs(p[1]-(mouseY-offSetY)) < 15){
						
							select_planet(i); selected=true;swirlie.visible=true;
							console.log("planet " + i + " chosen");
						} }
			}
			if(selected==false) { deselect(); }

			PlanetX = mouseX-offSetX;
			PlanetY = mouseY-offSetY;
			//selected_ship = -1;
			//Currently ship selection is disabled
			for(i=0;i<10;i++)
					{
						my ship = shipPos[i];
						if(Math.abs(ship[0]-(mouseX-offSetX)) < 15){
								if(Math.abs(ship[1]-(mouseY-offSetY)) < 15){
									if (selected_ship==i) {
											selected_ship=-1;
											console.log("ship " + i + " deselected");
										} else {
											selected_ship=i; selected=true;console.log("ship " + i + " chosen");
										} } } }
									
			//if((selected==false)&&(dragging==false)) { toggleOverview();}
	}
	dragging = false;
}

void mouseDragged() 
{
	deltaX = mouseX-pmouseX;
	deltaY = mouseY-pmouseY
	offSetX = offSetX+deltaX;
	offSetY = offSetY+deltaY;
	if((deltaX+deltaY)>5){dragging = true}
}



void toggleOverview() {
	//alert("mouse: " + mouseX + " " + mouseY );
	if(overview){
	
	viewscale=2.0;
	offSetX=-mouseX*4.0;offSetY=-mouseY*4.0;

	} else {
	viewscale=0.5;
	offSetX=0;offSetY=0;
			
	}
overview=!overview;
}

void deselect() {
	swirlie.visible = false;
	handlebox.visible=false;
}

void select_planet(num)
{
	newnum = int(num);
	
	if (newnum>-1){
		swirlie.selected = num;
		swirlie.x = planet[num][0] + offSetX;
		swirlie.y = planet[num][1] +offSetY;
		}
	//update_planetbars();
	handlebox.visible=true;	
}


//Library classes

//Draws a swirling selector around the currently selected planet or ship
class Swirlie
{
	int num = 20;
	int x=0;
	int y=0;
	float mx[] = new float[num];
	float my[] = new float[num];
	booleon overrideColours = true;
	boolean visible = false;
	int owner = 0;

	float r=20;
	// Angle and angular velocity, accleration
	float theta;
	float theta_vel=5;
	Int selected=1;


	void Swirlie()
	{}

	void moveTo ( newX, newY, newSelected ) {
		x = newX;
		y = newY;
		selected = newSelected;
	}

	void redraw()
	{
		if(visible) {
			drawHalo(x,y,x,y,owner);
			if (true) {
				if(overrideColours){
					fill(255);
					stroke(255);
				}
				// Reads throught the entire array
				// and shifts the values to the left
				for(int i=1; i<num; i++) {
					mx[i-1] = mx[i];
					my[i-1] = my[i];
				} 
				// Convert polar to cartesian
				float dx = r * cos(theta);
				float dy = r * sin(theta);
				theta += theta_vel;
				// Add the new values to the end of the array
				mx[num-1] = dx+x;
				my[num-1] = dy+y;
				for(int i=0; i<num; i++) {
					ellipse(mx[i], my[i], i/2/2, i/2/2);
				}
			}
		}
	}
}




// HandleBox graphics by Casey Reas and Ben Fry
// modified a little...
//Draws a set of graph bars under a planet to show the resources on the planet
class HandleBox
{
	Handle[] handles;
	int num=7;
	boolean visible=false;

	HandleBox() {
	
		//  size(200, 200);
		//num = height/15;
		handles = new Handle[num];
		int hsize = 10;
		for(int i=0; i<num; i++) {
			handles[i] = new Handle(
					100 
					, 200+i*15, 
					0 //50-hsize/2
					, 10, handles);
		}
		handles[1].description = "Transuranics";
		handles[2].description = "Lanthinides";
		handles[3].description = "Custard";
		handles[4].description = "Factories";
		handles[5].description = "Mines";
		handles[6].description = "Spatulas";
		

	}


	void setPos (newx, newy)
	{
		for(int i=1; i<num; i++) {
			handles[i].x = newx+20;
			handles[i].y = newy+i*15+30;
		}

	}

	void redraw()
	{
		if(visible){ 
			for(int i=1; i<num; i++) {
				handles[i].update();
				handles[i].display();
			}
		}

		//  fill(255);
		//  rect(0, 0, width/2, height);
	}

	void setBar(index, newLength)
	{
	
		//document.getElementById('planetdiv'+index).innerHTML = newLength;
		handles[int(index)].length=newLength;}



}


//The individual graph line for the resource display
class Handle
{
	int x, y;
	int boxx, boxy;
	int length;
	int size;
	boolean over;
	boolean press;
	boolean locked = false;
	boolean otherslocked = false;
	Handle[] others;
	String description = "Undefined";

	Handle(int ix, int iy, int il, int is, Handle[] o)
	{
		x = ix;
		y = iy;
		length = il;
		size = is;
		boxx = x+length - size/2;
		boxy = y - size/2;
		others = o;
	}

	void update() 
	{
		boxx = x-length-size;
		boxy = y - size/2;

	}




	void display() 
	{
		fill(255);
		stroke(255);
		line(x, y, x-length, y);
		rect(boxx, boxy, size, size);
		txtX = x+10;
		txtY = boxy+size;
		drawOutlineText(description, txtX, txtY);
		fill(255);
		text(description, txtX, txtY);
		if(over || press) {
			line(boxx, boxy, boxx+size, boxy+size);
			line(boxx, boxy+size, boxx+size, boxy);
		}

	}
}


//Draw shapes

//Draw a circle around the selected ship
void drawHalo(x,y,destx,desty,owner)
	{
		my playerColour = player[owner][1];
		pushMatrix();
		strokeWeight(2);
		stroke(playerColour);
		translate(x,y);
		//Put a circle around the ship
		fill("#050505");
		ellipse(-2,0,40,40);
		popMatrix();
	}

//Draw a bright red arrow to the ship's destination
void drawArrow(x,y,destx,desty,owner,bp_cost)
	{
		pushMatrix();
		strokeWeight(1);
		translate(x,y);
		//The line around the fleet name
		line(0,0,20,28);
		line(20,28,75,28);
		len = sqrt(sq(x-destx) + sq (y-desty))-20;
		if(len>30){
			float a = atan2(y-desty, x-destx);
			if (owner == "PLAYERNAME")
				{ fill(70, 255, 70);stroke(70, 255, 70);}
			else 
				{fill(255,70,70);stroke(255,70,70);}
			fill(player[owner][1]);
			//line(0,0,destx-x,desty-y);
			
			//Rotate to point to the destination
			rotate(a+PI/2);
			//Draw a nice thick line and arrow to the destination
			rect(-10, 0, 20, len-15);
			triangle(-15, len-15, 15, len-15, 0, len);
			//Put a circle around the ship
			ellipse(0,0,40,40);
			text(" "+moveCost(len), 0, len);
			//text(bp_cost+" ("+owner+")", xpos, ypos);
		}
		popMatrix();
	}
//Clear the canvas
void Clear() { fill(0);rect(0,0,xmax,ymax);}

void draw(){  
		pushMatrix();
		Clear();
		scale(viewscale/2);
		
		//The default ship bounces from planet to planet
		

			if(closeTo(X,Y,PlanetX,PlanetY, 30)){
				//Pick a new planet
				var p = int(Math.random()*10);
				PlanetX = planet[p][0];
				PlanetY = planet[p][1];
			}
		

//Draw the selected ship halo
			if(selected_ship>-1){
				my x = offSetX+shipPos[selected_ship][0];
				my y = offSetY+shipPos[selected_ship][1];
				my destx = offSetX+PlanetX;
				my desty = offSetY+PlanetY;
				//drawArrow(x,y,destx,desty, 1, "250");
				drawHalo(x,y,destx,desty,ship[selected_ship][1])
				//drawShip(x,y,selected_ship, true);
			}
			
			//Draw the star halo
			swirlie.moveTo(offSetX+PlanetX,offSetY+PlanetY);
			swirlie.redraw();
			
			//Draw all stars
			var i=0;
			for(i=0;i<10;i++) {
				var pdata = planet[i];
				drawStar(offSetX+pdata[0],offSetY+pdata[1],pdata[3], pdata[2]);
			}
			
			//Special selected ship movement
			if (false) {
			//Move ship by a small amount
			var ratio = min(Math.abs(X-PlanetX)/Math.abs(Y-PlanetY), 10);
			var inv_ratio = min(10, 1/ratio);
			X=X+-ratio*(X-PlanetX)/Math.abs(X-PlanetX);
			Y=Y+-inv_ratio*(Y-PlanetY)/Math.abs(Y-PlanetY);
			drawShip(offSetX+X,offSetY+Y,0, false );
}
			for(i=0;i<shipPos.length;i++) {
				var xx = shipPos[i][0];
				var yy = shipPos[i][1];
				var destx =shipPos[i][2];
				var desty =shipPos[i][3];
				if(closeTo(xx,yy,destx,desty, 30)){
					//Pick a new planet
					var p = int(Math.random()*10);
					shipPos[i][2] = planet[p][0];
					shipPos[i][3] = planet[p][1];
				}

				var ratio = min(Math.abs(xx-destx)/Math.abs(yy-desty), 10)/10.0;
				var inv_ratio = min(10, 1/ratio)/10.0;
				shipPos[i][0]=xx+-ratio*(xx-destx)/Math.abs(xx-destx);
				shipPos[i][1]=yy+-inv_ratio*(yy-desty)/Math.abs(yy-desty);
				
				if (keyPressed){
					drawArrow(offSetX+shipPos[i][0],offSetX+shipPos[i][1],shipPos[i][2],shipPos[i][3], 1, "250");
					drawHalo(offSetX+shipPos[i][0],offSetX+shipPos[i][1],destx,desty,ship[i][1])
				}
				
				drawShip(offSetX+shipPos[i][0],offSetY+shipPos[i][1],i);
			}
			

		

			//if(X>200 || Y>200){X=20;Y=20;playSound();}
	

		popMatrix();
	}



void drawText(astring, xpos, ypos){
	if(!overview){
	text(astring, xpos, ypos);
	}
}

//Vector commands for ship
void drawShip(x,y,shipnum, showDetails)
	{
		my playerColour = player[ship[shipnum][1]][1];
		//console.log("Drawing ship number ", shipnum);
		pushMatrix();
		//deltax = 1*sign(destx-x);
		//deltay = 1*sign(desty-y);
		//x=x+deltax;
		//y=y+deltay;
		translate(-5, 5);
		translate(x,y);
		scale(0.5);
		//if(closeTo(x,y,PlanetX,PlanetY,50)){
		//	scale(0.5);
		//}
		//Body
		noFill();
		stroke(playerColour);
		strokeWeight(1);
		fill(playerColour);
		if(overview){
			rect(0, 0, 10, -21);
		} else {
			triangle(0,-21,5,-26,10,-21);
			rect(0, 0, 10, -21);
			//Wings
			//noFill();
			//stroke(255);
			triangle(0-2,0,0-10,0,0-2,0-10);
			triangle(0+12,0,0+20,0,0+12,0-10);
			//Exhaust
			line(0,0+3,0,0+10);
			line(0+5,0+3,0+5,0+10);
			line(0+10,0+3,0+10,0+10);
			//if(!closeTo(x,y,PlanetX,PlanetY)){
			if (showDetails){
				drawShipDetail(shipnum);
			}
		}
		popMatrix();
	}
	
void drawShipDetail(shipnum) {
	pushMatrix();
	scale(2.0);
	fill(0)
	xpos = int(0)+25;
	ypos = int(0)+20;
	line(12.5,12.5,xpos,ypos+5);
	line(xpos,ypos+5,xpos+50,ypos+5);
	drawOutlineText(ship[shipnum][0] + " ("+ship[shipnum][1]+ ")", xpos, ypos);
	fill(200)
	drawText(ship[shipnum][0] + " (" + player[ship[shipnum][1]][0] + ")" , xpos, ypos);
	popMatrix();
}

//Vector commands to draw star
void drawStar(x, y, name, owner) {
	pushMatrix();
	translate(x,y);
	stroke(255);
	strokeWeight(1);
	xpos = 25;
	ypos = 20;
	pushMatrix();
	translate(xpos, ypos);
	//scale(0.5);
	drawOutlineText(name, 0, 0);
	fill(200)
	drawText(name, 0, 0);
	popMatrix();
	if(owner == "PLAYERNAME")
		{fill(50,200,50);}
	else 
		{fill(200,50,50);}
	fill(player[owner][1]);
	stroke(player[owner][1]);
	line(11,11,xpos,ypos+5);
	line(xpos,ypos+5,xpos+50,ypos+5);
	ellipse(0, 0, 10, 10);
	for (i=0; i<9; i++)
	{
		rotate(40*PI/180);
		triangle(-2, 9, 2, 9, 0, 15);
	}
	popMatrix();
}







