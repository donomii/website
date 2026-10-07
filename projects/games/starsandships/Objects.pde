
class Planet {
  float x, y;
  int owner;
  String name;
  float[] resources;

  Planet(float x, float y, int owner, String name, float[] resources) {
    this.x = x;
    this.y = y;
    this.owner = owner;
    this.name = name;
    this.resources = resources;
  }
}


class Ship {
  String name;
  int speed;
  int owner;
  float x, y;
  float destX, destY;

  Ship(String name, int speed, int owner, float x, float y, float destX, float destY) {
    this.name = name;
    this.speed = speed;
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.destX = destX;
    this.destY = destY;
  }
}

class TitleScreen {
  float[] starsX = new float[100];
  float[] starsY = new float[100];
  
  TitleScreen() {
    for(int i=0; i<100; i++) {
        starsX[i] = random(width);
        starsY[i] = random(height);
    }
  }

  void draw() {
    background(0);
    
    // Draw background stars
    stroke(255);
    strokeWeight(2);
    for(int i=0; i<100; i++) {
        point(starsX[i], starsY[i]);
    }
    
    // Draw Title
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(width / 10); // Responsive Text Size
    text("Stars and Ships", width/2, height/3);
    
    // Draw Prompt
    textSize(width / 20);
    if (frameCount % 60 < 30) { // Blink effect
        text("Click to Start", width/2, height/2 + height/4);
    }
    
    // Draw a little ship animation
    pushMatrix();
    translate(width/2, height/2);
    rotate(frameCount * 0.05);
    scale(2.0);
    
    noFill();
    stroke(0, 255, 0); // Green ship
    strokeWeight(2);
    triangle(0,-20, 10, 10, -10, 10);
    
    popMatrix();
  }
}
