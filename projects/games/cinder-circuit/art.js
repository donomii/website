(() => {
  "use strict";

  const {WIDTH, HEIGHT, TOWNS, RULES, gap} = Cinder;
  const PI = Math.PI;
  const playerInk = "#ffa65e";
  const rivalInk = "#87e0d8";
  const coast = [[-30,68],[114,48],[175,73],[248,64],[340,90],[456,49],[538,71],[614,56],[721,67],[784,38],[905,55],[960,83],[1068,74],[1113,115],[1161,135],[1225,123],[1225,414],[1143,421],[1107,459],[1061,472],[1026,516],[951,536],[948,588],[883,621],[824,620],[770,662],[714,651],[654,680],[563,656],[504,681],[392,646],[332,654],[256,609],[151,635],[94,608],[-30,633]];
  const ridges = [[75,201,47],[127,155,55],[166,220,38],[212,142,55],[244,243,38],[300,160,34],[983,104,29],
    [1063,137,43],[1094,177,50],[1139,150,33],[1114,234,35],[102,492,36],[103,537,45],[128,529,31],[167,543,28],
    [934,193,35],[975,242,43],[1000,337,48],[1048,314,64],[1090,345,31],[991,400,35]];
  const forests = [[148,365,103,51,75],[278,573,104,40,72],[501,107,119,27,66],[606,286,97,39,80],
    [698,383,93,38,55],[791,225,58,38,49],[1049,397,79,31,42],[843,562,91,42,51],[478,397,57,54,46],[600,598,103,52,46]];
  const river = [[530,-30],[520,44],[558,104],[562,154],[531,203],[544,245],[605,275],[651,292],[664,342],[642,391],
    [672,432],[670,477],[716,509],[725,564],[681,618],[710,720]];

  function path(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
  }

  function polygon(ctx, points, color, stroke) {
    path(ctx,points);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function line(ctx, points, color, width) {
    path(ctx,points);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, color, stroke) {
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,0,0,PI*2);
    if (color) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function glow(ctx, x, y, size, color) {
    const gradient = ctx.createRadialGradient(x,y,0,x,y,size);
    gradient.addColorStop(0,color);
    gradient.addColorStop(1,"transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(x-size,y-size,size*2,size*2);
  }

  function label(ctx, value, x, y, color, font = "600 15px Georgia", spacing = "1px") {
    ctx.font = font;
    ctx.letterSpacing = spacing;
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#142422";
    ctx.strokeText(value,x,y);
    ctx.fillStyle = color;
    ctx.fillText(value,x,y);
    ctx.letterSpacing = "0px";
  }

  function terrain(map) {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let state = 1009;
    const rand = () => {
      state = (Math.imul(state,1664525)+1013904223)>>>0;
      return state/4294967296;
    };
    if (map?.palette) {
      paintLandscape(ctx,map,rand);
      return canvas;
    }
    const water = ctx.createLinearGradient(0,0,WIDTH,HEIGHT);
    water.addColorStop(0,"#173b43");
    water.addColorStop(1,"#102931");
    ctx.fillStyle = water;
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    for (let i=0;i<560;i+=1) {
      const x=rand()*WIDTH, y=rand()*HEIGHT, l=3+rand()*22;
      line(ctx,[[x,y],[x+l,y]],i%5===0?"#385a5d66":"#69948925",i%5===0?1.8:1);
    }
    ctx.lineWidth = 16;
    polygon(ctx,coast,"#42574a","#325a59");
    ctx.lineWidth = 4;
    const ground = ctx.createLinearGradient(52,90,1020,601);
    ground.addColorStop(0,"#546353");
    ground.addColorStop(0.48,"#53664f");
    ground.addColorStop(1,"#3b534b");
    polygon(ctx,coast,ground,"#8f9470");
    ctx.save();
    ctx.clip();
    polygon(ctx,[[0,200],[225,69],[404,80],[413,120],[327,198],[272,316],[122,309],[0,363]],"#46564c");
    polygon(ctx,[[240,310],[367,320],[421,263],[512,226],[562,300],[511,345],[623,369],[597,462],[523,492],[388,476],[245,489]],"#627052");
    polygon(ctx,[[900,56],[1200,15],[1220,448],[992,447],[930,359],[958,274],[877,181]],"#40574f");
    polygon(ctx,[[46,521],[138,517],[188,572],[325,587],[415,563],[526,614],[631,683],[11,709]],"#4c5b50");
    polygon(ctx,[[732,423],[813,376],[900,419],[996,502],[885,636],[730,633],[751,562]],"#56674f");
    for(let i=0;i<4800;i+=1) {
      const x=rand()*WIDTH,y=rand()*HEIGHT;
      ctx.fillStyle = i%3===0?"#d9d1a111":"#10292d1b";
      ctx.fillRect(x,y,0.5+rand()*2,0.5+rand()*1.6);
    }
    line(ctx,river,"#344a43",51);
    line(ctx,river,"#718476",44);
    line(ctx,river,"#2a4c52",38);
    line(ctx,river,"#355f62",30);
    line(ctx,river.map(([x,y])=>[x+5,y]),"#51787667",2);
    for(let i=0;i<45;i+=1) {
      const segment = 1+Math.floor(rand()*(river.length-2));
      const [ax,ay]=river[segment-1], [bx,by]=river[segment];
      const t=rand(), x=ax+(bx-ax)*t+(rand()-.5)*25, y=ay+(by-ay)*t;
      line(ctx,[[x-4,y],[x+4,y]],"#bfd7b34a",1);
    }
    for (const [district,town] of TOWNS.entries()) {
      ellipse(ctx,town.x,town.y,74,51,"#9a99613b");
      for(let i=0;i<3;i+=1) {
        const x=town.x-57+i*15, y=town.y+(district%2===0?-44:40)+rand()*10;
        polygon(ctx,[[x-5,y-12],[x+6,y-19],[x+18,y-10],[x+7,y+2]], i%2===0?"#a59b60":"#7e8857","#405445");
        for(let j=0;j<3;j+=1) line(ctx,[[x+j*4-2,y-10-j*2],[x+j*4+7,y-3-j*2]],"#c4ad6b8c",1);
      }
      line(ctx,town.road,"#3e4e3b",9);
      line(ctx,town.road,"#a3976d",5);
      line(ctx,town.road,"#bdae83",1.1);
    }
    for (const points of [[[642,431],[681,436]],[[534,213],[571,213]]]) {
      line(ctx,points,"#283e3a",13);
      line(ctx,points,"#b29c79",9);
      const [[ax,ay],[bx,by]]=points;
      for(let i=1;i<7;i+=1) {
        const x=ax+(bx-ax)*i/7,y=ay+(by-ay)*i/7;
        line(ctx,[[x,y-4],[x,y+4]],"#65543c",1);
      }
    }
    const trees = [];
    for (const [cx,cy,rx,ry,count] of forests) {
      for(let i=0;i<count;i+=1) {
        const angle = rand()*PI*2, r=Math.sqrt(rand()), x=cx+Math.cos(angle)*rx*r,y=cy+Math.sin(angle)*ry*r;
        if (TOWNS.some(town=>gap({x,y},town)<68)) continue;
        const onRoad = TOWNS.some(town=>town.road.slice(1).some(([bx,by],idx)=>{
          const [ax,ay]=town.road[idx], dx=bx-ax,dy=by-ay;
          const t=Cinder.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
          return Math.hypot(x-ax-dx*t,y-ay-dy*t)<13;
        }));
        const inRiver = river.slice(1).some(([bx,by],idx)=>{
          const [ax,ay]=river[idx], dx=bx-ax,dy=by-ay;
          const t=Cinder.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
          return Math.hypot(x-ax-dx*t,y-ay-dy*t)<22;
        });
        if (!onRoad && !inRiver) trees.push({x,y,s:6+rand()*14,t:rand()});
      }
    }
    for (const {x,y,s,t} of trees.sort((a,b)=>a.y-b.y)) {
      ellipse(ctx,x+3,y+2,s*0.51,s*0.20,"#192c2b69");
      for(let i=0;i<3;i+=1) {
        const z=y-s*i*0.28, w=s*(0.47-i*.060);
        polygon(ctx,[[x-w,z],[x,z-s*.69],[x+w,z],[x,z+s*.12]], t<.5?"#2d4d43":"#365749");
        polygon(ctx,[[x-w,z],[x,z-s*.69],[x-s*.03,z+s*.12]],t<.5?"#456755":"#58745a");
      }
    }
    for (const [x,y,s] of [...ridges].sort((a,b)=>a[1]-b[1])) {
      ellipse(ctx,x+3,y+6,s*.83,s*.23,"#20353079");
      polygon(ctx,[[x-s*.83,y],[x-s*.21,y-s*.87],[x+s*.07,y-s],[x+s*.78,y+s*.05],[x+s*.13,y+s*.20]],"#4e6060");
      polygon(ctx,[[x-s*.83,y],[x-s*.21,y-s*.87],[x+s*.07,y-s],[x-s*.13,y-s*.35],[x+s*.13,y+s*.20]],"#71817a");
      polygon(ctx,[[x-s*.21,y-s*.87],[x+s*.07,y-s],[x+s*.39,y-s*.53],[x+s*.02,y-s*.66],[x-s*.11,y-s*.55]],"#aab0a0");
      line(ctx,[[x-s*.65,y],[x-s*.37,y-s*.19],[x-s*.23,y-s*.43]],"#89938a",1.4);
    }
    ctx.restore();
    label(ctx,"S L A T E   S H O A L S",974,596,"#96aaa0","italic 15px Georgia","2px");
    label(ctx,"T H E   C O P P E R   R E A C H",310,346,"#c9c6a36b","italic 15px Georgia","2px");
    const vignette=ctx.createRadialGradient(WIDTH/2,HEIGHT*.44,190,WIDTH/2,HEIGHT*.47,693);
    vignette.addColorStop(0,"#10232600");
    vignette.addColorStop(1,"#0e1e276d");
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    return canvas;
  }

  function paintLandscape(ctx,map,rand) {
    const [water,edge,light,dark,accent] = map.palette;
    const sky = ctx.createLinearGradient(0,0,WIDTH,HEIGHT);
    sky.addColorStop(0,edge);
    sky.addColorStop(1,water);
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    for(let i=0;i<460;i+=1) {
      const x=rand()*WIDTH,y=rand()*HEIGHT;
      line(ctx,[[x,y],[x+4+rand()*20,y-1]],accent+"24",1);
    }
    for (const island of map.islands) {
      const land = ctx.createLinearGradient(70,25,1050,680);
      land.addColorStop(0,light);
      land.addColorStop(1,dark);
      ctx.lineWidth=17;
      polygon(ctx,island,edge,edge);
      ctx.lineWidth=3;
      polygon(ctx,island,land,accent);
      ctx.save();
      ctx.clip();
      for(let i=0;i<1150;i+=1) {
        const x=rand()*WIDTH,y=rand()*HEIGHT;
        ctx.fillStyle=(i%3===0?accent:water)+"25";
        ctx.fillRect(x,y,1+rand()*3,1+rand()*2);
      }
      ctx.restore();
    }
    for(const [x,y,size] of map.ridges) {
      ellipse(ctx,x,y+6,size*.92,size*.29,water+"85");
      polygon(ctx,[[x-size,y],[x-size*.18,y-size],[x+size*.82,y],[x+size*.12,y+size*.21]],dark);
      polygon(ctx,[[x-size,y],[x-size*.18,y-size],[x+size*.02,y-size*.21],[x+size*.12,y+size*.21]],light);
      polygon(ctx,[[x-size*.56,y-size*.54],[x-size*.18,y-size],[x+size*.23,y-size*.59],[x-size*.13,y-size*.68]],accent);
      for(let i=0;i<13;i+=1) {
        const tx=x+(rand()-.5)*size*3.4, ty=y+rand()*size*.85;
        const height=6+rand()*12;
        polygon(ctx,[[tx-height*.42,ty],[tx,ty-height],[tx+height*.42,ty]],edge);
      }
    }
    for (const road of map.roads ?? map.towns.map(town=>town.road)) {
      line(ctx,road,water+"bd",12);
      line(ctx,road,accent+"bc",7);
      line(ctx,road,light,2);
    }
    label(ctx,map.name.toUpperCase(),600,42,accent,"italic 20px Georgia","4px");
  }

  function crown(ctx,x,y,color,size=1) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(size,size);
    polygon(ctx,[[-9,-5],[-5,-1],[0,-8],[5,-1],[9,-5],[7,6],[-7,6]],color,"#372234");
    ctx.restore();
  }

  function lair(ctx,home,drake,time) {
    const color=drake.id===0?playerInk:rivalInk;
    const {x,y}=home;
    glow(ctx,x,y,83,drake.id===0?"#fb863964":"#67d6cd59");
    ctx.lineWidth=1.5;
    ellipse(ctx,x,y,47,36,"#252a2dbb",color+"99");
    ellipse(ctx,x,y,41,30,"#33393b",color+"66");
    ellipse(ctx,x,y,31,22,"#4d4a40",color+"50");
    for(let i=0;i<10;i+=1) {
      const a=i*PI/5+0.2, px=x+Math.cos(a)*37,py=y+Math.sin(a)*29;
      polygon(ctx,[[px-4,py+4],[px-5,py-3],[px,py-10-(i%3)*3],[px+5,py-2],[px+3,py+4]],"#535b5a","#303d40");
    }
    ellipse(ctx,x,y+4,14,9,drake.id===0?"#9e5f3a":"#487c79");
    for(let i=0;i<6;i+=1){
      ellipse(ctx,x+(i%3-1)*7,y+Math.floor(i/3)*5-1,4,2.7,drake.id===0?"#f4c46a":"#a3d8c5");
    }
    ctx.beginPath();
    const ring = drake.bank ? RULES.lairRadius : 52;
    ctx.ellipse(x,y,ring,drake.bank?ring:39,0,-PI/2,-PI/2+PI*2*(drake.bank?Math.min(1,drake.bank/RULES.bankTime):.11+.035*Math.sin(time*3)));
    ctx.strokeStyle=color;
    ctx.lineWidth=2.5;
    ctx.stroke();
    label(ctx,home.name,x,y+56,color);
  }

  function building(ctx,b,town,time) {
    const {x,y}=b;
    ctx.lineWidth=1;
    ellipse(ctx,x+2,y+5,16,7,"#2a2b2696");
    if (b.rebuild) {
      ellipse(ctx,x,y+1,11,8,"#343c34","#786d56");
      line(ctx,[[x-6,y+2],[x+6,y-3]],"#968064",2);
      line(ctx,[[x-4,y-5],[x+5,y+4]],"#514c42",3);
    } else if(b.type==="tower") {
      polygon(ctx,[[x-8,y+6],[x-8,y-14],[x-10,y-14],[x-10,y-23],[x-5,y-23],[x-5,y-20],[x-2,y-20],[x-2,y-24],[x+3,y-24],[x+3,y-20],[x+6,y-20],[x+6,y-23],[x+10,y-23],[x+10,y-14],[x+8,y-14],[x+8,y+5]],"#c5b08a","#4d493b");
      polygon(ctx,[[x+3,y+6],[x+3,y-15],[x+9,y-17],[x+8,y+5]],"#806950");
      line(ctx,[[x-2,y-10],[x-2,y-6]],"#282f2d",2.2);
      line(ctx,[[x+2,y-24],[x+2,y-33]],"#514733",1.5);
      polygon(ctx,[[x+2,y-33],[x+13,y-30],[x+2,y-27]],town.color);
    } else {
      const w=b.type==="hall"?15:11, h=b.type==="hall"?13:10;
      polygon(ctx,[[x-w,y+6],[x-w,y-h],[x+w,y-h],[x+w,y+6],[x+3,y+10]],"#ccb08d","#524637");
      polygon(ctx,[[x+1,y+9],[x+1,y-h],[x+w,y-h],[x+w,y+5]],"#947b5c");
      polygon(ctx,[[x-w-2,y-h+2],[x-4,y-h-10],[x+w-4,y-h-10],[x+w+3,y-h+2],[x+5,y-h+5]],town.color,"#5a3e36");
      line(ctx,[[x-3,y-h-8],[x+4,y-h+3]],"#ffc48286",1);
      ctx.fillStyle="#574337";
      ctx.fillRect(x-5,y+1,4,6);
      ctx.fillStyle="#f3cc85";
      ctx.fillRect(x+7,y-5,3,4);
    }
    if(b.burning>0) {
      glow(ctx,x,y-5,27,"#ff851d89");
      for(let i=0;i<4;i+=1) {
        const dx=(i-1.5)*5, height=7+Math.sin(time*17+i*1.75)*4;
        polygon(ctx,[[x+dx-3,y],[x+dx+Math.sin(time*11+i)*4,y-height-8],[x+dx+4,y]],i%2?"#ffa537":"#ffc76e");
      }
    }
  }

  function wagon(ctx,w,time) {
    if (w.siege) {
      ellipse(ctx,w.x,w.y+6,19,9,"#17192bac");
      ctx.save();
      ctx.translate(w.x,w.y);
      ctx.rotate(w.angle);
      ctx.lineWidth=1.7;
      polygon(ctx,[[-17,-9],[9,-10],[18,0],[9,10],[-17,9]],"#792f45","#f1a48c");
      polygon(ctx,[[-12,-5],[5,-5],[12,0],[5,5],[-12,5]],"#e7836b");
      line(ctx,[[-13,0],[23,0]],"#43263c",3.6);
      ctx.restore();
      if (w.burning) glow(ctx,w.x,w.y,23,"#ffb55d9e");
      return;
    }
    ellipse(ctx,w.x,w.y+3,12,6,"#1d302a91");
    if (w.royal) {
      glow(ctx,w.x,w.y,26,"#fba3cf73");
    } else if (w.rich) {
      glow(ctx,w.x,w.y,19,"#ffcf5b58");
    }
    ctx.save();
    ctx.translate(w.x,w.y);
    ctx.rotate(w.angle);
    ctx.lineWidth=1;
    polygon(ctx,[[-10,-6],[5,-6],[5,6],[-10,6]],w.royal?"#af5a91":"#92744d","#403c34");
    polygon(ctx,[[-9,-5],[4,-5],[4,1],[-9,1]],w.royal?"#f2aecd":w.rich?"#ffe19b":"#d5a76b");
    if (w.rich) line(ctx,[[-5,-5],[-5,2]],"#b56d28",1.2);
    for(const x of [-7,2]) for(const y of [-6,6]) ellipse(ctx,x,y,2.7,1.6,"#332c2a");
    line(ctx,[[5,0],[11,0]],"#e4b98c",1.4);
    ellipse(ctx,12,0,3.7,2.9,w.royal?"#ead8be":"#513e32");
    ctx.restore();
    if(w.royal) crown(ctx,w.x,w.y-18+Math.sin(time*5)*1.8,"#ffc7e6",0.9);
    if(w.burning) glow(ctx,w.x,w.y,16,"#ffb55d9e");
  }

  function dragon(ctx,d,time) {
    const color=d.id===0?playerInk:rivalInk;
    const dark=d.id===0?"#7b382e":"#29575a";
    const light=d.id===0?"#dc7747":"#59aaa4";
    const beat=0.78+Math.sin(time*(Math.abs(d.vx)+Math.abs(d.vy)>40?15:9)+d.id)*0.21;
    const lateralSpeed = -d.vx*Math.sin(d.angle)+d.vy*Math.cos(d.angle);
    const bank = Cinder.clamp(lateralSpeed/RULES.speed,-1,1)*0.18;
    const lift=10+beat*4;
    const tail=Math.sin(time*7+d.id)*3;
    ctx.save();
    if(d.recover>0 || (d.invulnerable>0 && Math.floor(time*23)%2)) ctx.globalAlpha=.56;
    ellipse(ctx,d.x+6,d.y+4,26,12,"#18282691");
    ctx.translate(d.x,d.y-lift);
    ctx.rotate(d.angle);
    ctx.lineWidth=1.25;
    for (const side of [-1,1]) {
      const y=s=>s*beat*side*(1+bank*side);
      polygon(ctx,[[8,y(4)],[10,y(15)],[1,y(28)],[-15,y(36)],[-11,y(25)],[-22,y(24)],[-15,y(15)],[-24,y(13)],[-6,y(3)]],dark,"#1b2728");
      polygon(ctx,[[7,y(5)],[8,y(14)],[-13,y(33)],[-9,y(23)],[-20,y(22)],[-11,y(15)],[-21,y(13)],[-5,y(5)]],light);
      line(ctx,[[7,y(6)],[-4,y(14)],[-13,y(33)]],color,1.1);
      line(ctx,[[-4,y(14)],[-19,y(22)]],color+"9a",1);
    }
    line(ctx,[[-5,0],[-14,1],[-24,tail],[-35,tail-3]],dark,5);
    line(ctx,[[-9,0],[-20,tail],[-34,tail-3]],color,1.4);
    polygon(ctx,[[-34,tail-3],[-40,tail-7],[-38,tail+1]],color);
    polygon(ctx,[[-14,-3],[-4,-6],[8,-4],[12,-6],[21,-4],[24,0],[21,4],[12,6],[8,4],[-4,6],[-14,3]],light,"#3e332e");
    polygon(ctx,[[4,0],[13,-3],[21,-2],[23,0],[20,2],[11,2]],color);
    for(let i=0;i<4;i+=1) line(ctx,[[-12+i*5,0],[-10+i*5,-2]],color,1.15);
    for (const side of [-1,1]) {
      polygon(ctx,[[12,side*4],[8,side*10],[17,side*5]],"#f9dbad","#574536");
      ellipse(ctx,18,side*3,1.6,1,"#fff7d5");
    }
    ctx.restore();
    if (d.royal) crown(ctx,d.x,d.y+13,"#ffc7e6");
  }

  function breath(ctx,d,time) {
    if (!d.firing) return;
    const length=RULES.breathRange+(d.rank>=2?20:0), color=d.id===0?"#ff9e50":"#79dfd6";
    ctx.save();
    ctx.translate(d.x,d.y);
    ctx.rotate(d.angle);
    const mist=ctx.createLinearGradient(14,0,length,0);
    mist.addColorStop(0,color+"bb"); mist.addColorStop(.58,color+"6b"); mist.addColorStop(1,color+"00");
    polygon(ctx,[[11,-4],[length*.52,-length*.19],[length,-length*.33],[length,length*.33],[length*.52,length*.19],[11,4]],mist);
    ctx.globalCompositeOperation="screen";
    for(let i=0;i<30;i+=1) {
      const seed=((i*37)%101)/101, t=(time*(1.5+seed*.5)+i/30)%1;
      const px=15+t*(length-15), py=(seed-.5)*t*length*.67+Math.sin(time*14+i)*t*6;
      const size=(1-t)*2.8+1;
      ctx.globalAlpha=(1-t)*.6+.16;
      ellipse(ctx,px,py,size*(1.28+t),size,i%3===0?"#fff3bf":color);
    }
    ctx.restore();
  }

  function draw(ctx,background,game,time,effects,aim) {
    ctx.lineJoin="round";
    ctx.lineCap="round";
    ctx.drawImage(background,0,0);
    for (const [i,home] of game.map.lairs.entries()) lair(ctx,home,game.dragons[i],time);
    if(game.map.sanctuary) {
      const {x,y,name}=game.map.sanctuary;
      const escort=game.dragons.some(drake=>drake.royal);
      ctx.lineWidth=escort?3.5:2;
      ellipse(ctx,x,y,RULES.lairRadius,RULES.lairRadius,"#e2a8cf28",escort?"#ffc8e8":"#e0abc1");
      crown(ctx,x,y-9,"#ffd5eb",1.9);
      label(ctx,name,x,y+25,"#ffedf7");
    }
    for (const beacon of game.beacons) drawBeacon(ctx,beacon,game.rules);
    if (game.siege) drawKeep(ctx,game.map.lairs[0]);
    for (const town of game.towns) {
      for (const b of [...town.buildings].sort((a,b)=>a.y-b.y)) building(ctx,b,town,time);
      if (town.launch>0) {
        const b=town.buildings[3], t=1-town.launch/RULES.towerWindup;
        if (town.target===0) {
          const locked=town.launch<=RULES.towerLock;
          const length=158+game.phase*23;
          const dx=Math.cos(town.shotAngle), dy=Math.sin(town.shotAngle);
          ctx.setLineDash(locked?[]:[5,7]);
          line(ctx,[[b.x,b.y],[b.x+dx*length,b.y+dy*length]],locked?"#ffa285d9":"#ffa28572",locked?1.7:1.25);
          ctx.setLineDash([]);
        }
        glow(ctx,b.x,b.y-15,19+t*13,"#ff7968cc");
        ctx.lineWidth=1.5;
        ellipse(ctx,b.x,b.y,11+t*18,7+t*12,null,"#ffb084");
      }
      label(ctx,town.name,town.x,town.y+49,"#f2dfba");
    }
    for (const w of game.wagons) wagon(ctx,w,time);
    for (const item of game.loot) {
      ctx.globalAlpha=item.life<3?.47+Math.sin(time*17)*.30:1;
      if(item.royal) {
        glow(ctx,item.x,item.y,32,"#ff9ec48f");
        crown(ctx,item.x,item.y-3+Math.sin(time*7)*2,"#ffd5e8",1.35);
      } else {
        glow(ctx,item.x,item.y,12,"#ffb53b73");
        ctx.lineWidth=1;
        const y=item.y+Math.sin(time*7+item.x)*1.5;
        ellipse(ctx,item.x,y,4.5,3,"#ffcd64","#8d582f");
        line(ctx,[[item.x-2,y-1],[item.x+1,y-1]],"#fff4ae",1);
      }
      ctx.globalAlpha=1;
    }
    for (const bolt of game.bolts) {
      const dx=Math.cos(bolt.angle),dy=Math.sin(bolt.angle);
      line(ctx,[[bolt.x-dx*14,bolt.y-dy*14],[bolt.x+dx*3,bolt.y+dy*3]],"#f5a29d",2.6);
      ellipse(ctx,bolt.x,bolt.y,3,3,"#fff4cd");
    }
    for (const d of game.dragons) breath(ctx,d,time);
    for (const d of [...game.dragons].reverse()) dragon(ctx,d,time);
    if(aim && game.dragons[0].firing) {
      ctx.lineWidth=1.2;
      ellipse(ctx,aim.x,aim.y,7,7,null,"#ffe1a8ad");
    }
    for(const p of effects) {
      ctx.save();
      const opacity=Math.max(0,p.life/p.full);
      ctx.globalAlpha=opacity;
      if (p.text) label(ctx,p.text,p.x,p.y,p.color,"bold 17px Georgia","0.6px");
      else ellipse(ctx,p.x,p.y,p.size*opacity+1,p.size*opacity+1,p.color);
      ctx.restore();
    }
  }

  function drawBeacon(ctx,beacon,rules) {
    const {x,y,owner,claimant,progress,name}=beacon;
    const colors=[playerInk,rivalInk];
    const color=colors[owner] ?? "#dfc7aa";
    const radius=rules.beaconRadius;
    ctx.lineWidth=2;
    ellipse(ctx,x,y,radius,radius,color+"26",color);
    if (claimant!==null) {
      ctx.beginPath();
      ctx.arc(x,y,radius,-PI/2,-PI/2+PI*2*progress/rules.captureTime);
      ctx.lineWidth=5;
      ctx.strokeStyle=colors[claimant];
      ctx.stroke();
    }
    ellipse(ctx,x,y+9,16,7,"#302836");
    line(ctx,[[x,y+9],[x,y-27]],"#302836",4);
    polygon(ctx,[[x,y-25],[x+24,y-19],[x,y-11]],color,"#443041");
    label(ctx,name,x,y+36,"#ffe8ce");
  }

  function drawKeep(ctx,home) {
    const {x,y}=home;
    ctx.lineWidth=2;
    polygon(ctx,[[x-30,y-5],[x-30,y-26],[x-22,y-26],[x-22,y-19],[x-9,y-19],[x-9,y-29],
      [x+9,y-29],[x+9,y-19],[x+22,y-19],[x+22,y-26],[x+30,y-26],[x+30,y-5]],"#7d929e","#e3eddf");
    ellipse(ctx,x,y-7,7,10,"#354657");
  }

  globalThis.CinderArt={terrain,draw};
})();
