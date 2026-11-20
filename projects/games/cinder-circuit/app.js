(() => {
  "use strict";

  const {WIDTH,HEIGHT,RULES,createGame,step,capacity,bearing,gap,clamp} = Cinder;
  const byId = id => document.getElementById(id);
  const canvas = byId("board");
  const ctx = canvas.getContext("2d", {alpha:false});
  const background = CinderArt.terrain();
  const sound = CinderSound.createSound();
  const roundEnd = byId("round-end");
  const flightAction = byId("flight-action");
  const restartButton = byId("restart");
  const soundButton = byId("sound");
  const fireButton = byId("fire");
  const dashButton = byId("dash");
  const readouts = Object.fromEntries(["player-score","rival-score","clock","health","breath","cargo","bonus","royal"]
    .map(id=>[id,byId(id)]));
  const keys = new Set();
  const flightKeys = new Set(["KeyA","KeyD","KeyW","KeyS","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"]);
  const gameKeys = new Set([...flightKeys,"Space","ShiftLeft","ShiftRight"]);
  const effects = [];
  const tick = 1/120;
  let game = createGame();
  let mode = "ready";
  let last = performance.now();
  let accumulator = 0;
  let mouse = null;
  let mouseDown = false;
  let touch = null;
  let touchFire = false;
  let dashQueue = false;
  let heldDash = false;
  let pendingDash = false;

  function worldPoint(e) {
    const bounds=canvas.getBoundingClientRect();
    return {x: (e.clientX-bounds.left)*WIDTH/bounds.width, y: (e.clientY-bounds.top)*HEIGHT/bounds.height};
  }

  function clearInput() {
    keys.clear();
    mouseDown = false;
    touch = null;
    touchFire = false;
    dashQueue = false;
    heldDash = false;
    pendingDash = false;
    accumulator = 0;
  }

  function setMode(next) {
    mode = next;
    flightAction.textContent = {ready:"Fly", playing:"Pause", paused:"Resume"}[mode] ?? "";
    flightAction.hidden = mode === "finished";
    restartButton.hidden = mode !== "paused";
    soundButton.hidden = mode !== "paused";
    fireButton.hidden = mode === "paused" || mode === "finished";
    dashButton.hidden = fireButton.hidden;
  }

  function begin() {
    if (mode === "ready") {
      setMode("playing");
      sound.unlock();
      canvas.focus();
    }
  }

  function pause() {
    if (mode !== "playing") return;
    clearInput();
    sound.firing(false);
    setMode("paused");
  }

  function flightActionClick() {
    if (mode === "ready") {
      begin();
    } else if (mode === "playing") {
      pause();
    } else if (mode === "paused") {
      setMode("playing");
      sound.unlock();
      canvas.focus();
    }
  }

  function restart() {
    if (roundEnd.open) roundEnd.close();
    clearInput();
    game = createGame();
    effects.length = 0;
    setMode("playing");
    canvas.focus();
    sound.unlock();
  }

  function finish() {
    setMode("finished");
    clearInput();
    sound.firing(false);
    const [player,rival] = game.dragons;
    byId("winner").textContent = player.score === rival.score ? "A draw" : player.score > rival.score ? "You won" : "The rival won";
    const {sorties,royals,burns,knockouts}=game.stats;
    byId("result").textContent = `${player.score} to ${rival.score} gold · ${sorties} deposits · ${royals} princesses · ${burns} buildings burned · ${knockouts} knockouts`;
    roundEnd.showModal();
  }

  flightAction.addEventListener("click",flightActionClick);
  restartButton.addEventListener("click",restart);
  byId("play-again").addEventListener("click",restart);
  soundButton.addEventListener("click",event=>{
    const enabled=sound.toggle();
    event.currentTarget.textContent=enabled?"Sound on":"Sound off";
    event.currentTarget.setAttribute("aria-pressed",enabled);
  });
  roundEnd.addEventListener("cancel",event=>event.preventDefault());

  window.addEventListener("keydown",event=>{
    if (event.code === "Escape" && !event.repeat && (mode === "playing" || mode === "paused")) {
      event.preventDefault();
      flightActionClick();
    } else if (gameKeys.has(event.code) && (mode === "ready" || mode === "playing")) {
      if (event.target instanceof HTMLButtonElement && event.code === "Space") return;
      event.preventDefault();
      begin();
      keys.add(event.code);
    }
  });
  window.addEventListener("keyup",event=>keys.delete(event.code));
  window.addEventListener("blur",pause);
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) pause(); });

  canvas.addEventListener("pointermove",event=>{
    if (event.pointerType === "mouse") {
      mouse=worldPoint(event);
    } else if (touch?.id===event.pointerId) {
      touch.x=event.clientX;
      touch.y=event.clientY;
    }
  });
  canvas.addEventListener("pointerleave",event=>{
    if (event.pointerType === "mouse" && !mouseDown) mouse = null;
  });
  canvas.addEventListener("pointerdown",event=>{
    if(event.button!==0 || mode==="paused" || mode==="finished") return;
    event.preventDefault();
    begin();
    if (event.pointerType === "mouse") {
      mouse=worldPoint(event);
      mouseDown=true;
    } else if(!touch) {
      touch={id:event.pointerId,originX:event.clientX,originY:event.clientY,x:event.clientX,y:event.clientY};
    }
    canvas.setPointerCapture(event.pointerId);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"]) {
    canvas.addEventListener(type,event=>{
      if(event.pointerType==="mouse") mouseDown=false;
      else if(touch?.id===event.pointerId) touch=null;
    });
  }

  fireButton.addEventListener("pointerdown",event=>{
    event.preventDefault();
    begin();
    touchFire=true;
    event.currentTarget.setPointerCapture(event.pointerId);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"]) {
    fireButton.addEventListener(type,()=>{ touchFire=false; });
  }
  dashButton.addEventListener("click",()=>{
    begin();
    dashQueue=true;
  });

  function axis(value) {
    return Math.abs(value) < .19 ? 0 : Math.sign(value)*(Math.abs(value)-.19)/.81;
  }

  function readInput() {
    const pad=Array.from(navigator.getGamepads?.() ?? []).find(item=>item?.mapping==="standard");
    const rightX=axis(pad?.axes[2] ?? 0), rightY=axis(pad?.axes[3] ?? 0);
    const gamepadFire=Math.hypot(rightX,rightY)>0.15;
    const key=(a,b)=>Number(keys.has(a)||keys.has(b));
    const x=key("KeyD","ArrowRight")-key("KeyA","ArrowLeft")+axis(pad?.axes[0] ?? 0)+(touch?clamp((touch.x-touch.originX)/37,-1,1):0);
    const y=key("KeyS","ArrowDown")-key("KeyW","ArrowUp")+axis(pad?.axes[1] ?? 0)+(touch?clamp((touch.y-touch.originY)/37,-1,1):0);
    const mouseAim=mouse && !touch && !touchFire && gap(mouse,game.dragons[0])>8;
    const aim=gamepadFire ? Math.atan2(rightY,rightX) : mouseAim ? bearing(game.dragons[0],mouse) : null;
    const fire=gamepadFire || mouseDown || touchFire || keys.has("Space");
    const dash=Boolean(pad?.buttons[0]?.pressed || keys.has("ShiftLeft") || keys.has("ShiftRight") || dashQueue);
    dashQueue=false;
    if (mode==="ready" && (Math.abs(x)+Math.abs(y)>.1 || fire || dash)) begin();
    const dashPressed = dash && !heldDash;
    heldDash = dash;
    return {x,y,aim,fire,dash:dashPressed};
  }

  function caption(x,y,text,color) {
    effects.push({x,y,text,color,life:1.5,full:1.5,vx:0,vy:-23});
  }

  function sparks(x,y,color,count) {
    for(let i=0;i<count;i+=1) {
      const a=Math.random()*Math.PI*2,v=15+Math.random()*75,life=.20+Math.random()*.45;
      effects.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-23,color,size:1+Math.random()*2,life,full:life});
    }
  }

  function handleEvents() {
    const player=game.dragons[0];
    for(const {type,x,y,amount,actor} of game.events) {
      const ink=actor===0?"#ffce82":"#a5efe8";
      if(actor===0) sound.event(type);
      switch(type) {
      case "burn": sparks(x,y,"#ffb669",15); break;
      case "royalOpen": sparks(x,y,"#ffc2dc",21); break;
      case "coin": sparks(x,y,ink,4); break;
      case "dash": sparks(x,y,"#e7dbb9",12); break;
      case "hit": sparks(x,y,"#ffae9c",11); break;
      case "fall": caption(x,y-24,"Loot dropped","#ffc0a6"); sparks(x,y,"#fa795b",28); break;
      case "bank": caption(x,y-32,`+${amount}`,ink); sparks(x,y,ink,24); break;
      case "royal": caption(x,y-32,"Princess aboard","#ffd1ea"); break;
      case "royalDeparture": caption(x,y-35,"Royal carriage","#ffd1ea"); break;
      case "upgrade": if(actor===0) caption(x,y-57,RULES.upgradeNames[amount-1],ink); break;
      case "phase": caption(player.x,player.y-40,amount===1?"Towers on alert":"Towers fire faster","#ffc6a2"); break;
      case "finish": finish(); break;
      }
    }
  }

  function updateHud() {
    const [player,rival]=game.dragons;
    const left=Math.ceil(RULES.duration-game.time);
    const show=(id,value)=>{ if(readouts[id].value!==String(value)) readouts[id].value=value; };
    show("player-score",player.score);
    show("rival-score",rival.score);
    show("clock",`${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`);
    readouts.clock.parentElement.classList.toggle("late",left<=30);
    readouts.health.value=player.health;
    readouts.breath.value=player.breath;
    show("cargo",`${player.carry} / ${capacity(player)}`);
    readouts.royal.hidden=!player.royal;
    readouts.bonus.hidden=player.marks.size<2;
    readouts.bonus.textContent=`+${25*clamp(player.marks.size-1,0,3)}%`;
    dashButton.classList.toggle("cooling",player.dash>0);
  }

  function frame(time) {
    const elapsed=clamp((time-last)/1000,0,.25);
    last=time;
    const controls=readInput();
    if (mode==="playing") {
      accumulator+=elapsed;
      // A button edge survives even when a display frame contains no physics step.
      if(controls.dash) pendingDash=true;
      while(accumulator>=tick && mode==="playing") {
        step(game,{...controls,dash:pendingDash},tick);
        pendingDash=false;
        accumulator-=tick;
        handleEvents();
      }
      let liveEffects = 0;
      for(const p of effects) {
        p.x+=p.vx*elapsed;
        p.y+=p.vy*elapsed;
        p.life-=elapsed;
        if (p.life > 0) effects[liveEffects++] = p;
      }
      effects.length = liveEffects;
      sound.firing(mode==="playing" && game.dragons[0].firing);
    }
    updateHud();
    CinderArt.draw(ctx,background,game,time/1000,effects,mouseDown?mouse:null);
    requestAnimationFrame(frame);
  }


  requestAnimationFrame(frame);
})();
