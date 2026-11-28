(() => {
  "use strict";

  const {WIDTH,HEIGHT,RULES,VARIANTS,createGame,step,capacity,bearing,gap,clamp} = Cinder;
  const byId = id => document.getElementById(id);
  const canvas = byId("board");
  const ctx = canvas.getContext("2d", {alpha:false});
  const sound = CinderSound.createSound();
  const roundEnd = byId("round-end");
  const flightAction = byId("flight-action");
  const restartButton = byId("restart");
  const variantSelect = byId("raid-variant");
  const variantIds = Object.keys(VARIANTS);
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
  let game = createGame(new URLSearchParams(location.search).get("mode"));
  let background = CinderArt.terrain(game.map);
  let mode = "ready";
  let last = performance.now();
  let accumulator = 0;
  let mouse = null;
  let mouseDown = false;
  let touch = null;
  let touchFire = false;
  let dashQueue = false;
  let heldDash = false;
  let heldStart = false;
  let heldVariant = 0;
  let gamepadAllowed = true;
  let pendingDash = false;

  for (const id of variantIds) {
    const variant = VARIANTS[id];
    const option = new Option(variant.name,id);
    option.title = variant.description;
    variantSelect.add(option);
  }
  updateVariant();

  function updateVariant() {
    variantSelect.value = game.variant;
    variantSelect.title = `${VARIANTS[game.variant].description} Gamepad: LB / RB to choose a raid before takeoff.`;
    canvas.setAttribute("aria-label",game.map.name+" dragon raiding map");
    const [scores,player,rival] = {
      classic:["Banked gold","Your banked gold","Rival's banked gold"],
      "crown-chase":["Princesses delivered","Your princess deliveries","Rival's princess deliveries"],
      "banner-raid":["Majority control time","Your control seconds","Rival's control seconds"],
      siege:["Frostgate defenses","Keep health percent","Current siege wave"]
    }[game.variant];
    const scoreboard = readouts["player-score"].closest(".scoreboard");
    scoreboard.setAttribute("aria-label",scores);
    scoreboard.dataset.variant = game.variant;
    for (const [id,title] of [["player-score",player],["rival-score",rival]]) {
      readouts[id].setAttribute("aria-label",title);
      readouts[id].parentElement.title = title;
    }
    const escort = game.variant === "crown-chase";
    readouts.cargo.parentElement.hidden = game.variant !== "classic" && !escort;
    readouts.cargo.parentElement.title = escort ? "Carry the princess to Crown Abbey" : "Unbanked gold and deposit bonus";
    readouts.cargo.setAttribute("aria-label",escort ? "Princess aboard" : "Carried gold");
    byId("cargo-label").textContent = escort ? "Escort" : "Cargo";
  }

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
    variantSelect.disabled = mode !== "ready";
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

  function resetRound(id) {
    if (roundEnd.open) roundEnd.close();
    clearInput();
    const map = game.map;
    game = createGame(id);
    if (game.map !== map) background = CinderArt.terrain(game.map);
    effects.length = 0;
    setMode("ready");
    updateVariant();
  }

  function restart() {
    resetRound(game.variant);
    begin();
  }

  function chooseVariant(id) {
    resetRound(id);
    const url = new URL(location.href);
    if (game.variant === "classic") url.searchParams.delete("mode");
    else url.searchParams.set("mode",game.variant);
    try {
      history.replaceState(null,"",url);
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
    }
  }

  function finish() {
    setMode("finished");
    clearInput();
    sound.firing(false);
    const [player,rival] = game.dragons;
    const {sorties,royals,burns,knockouts}=game.stats;
    if (game.siege) {
      byId("winner").textContent = game.outcome===0 ? "Frostgate held" : "Frostgate fell";
      byId("result").textContent = `${game.siege.health}% walls · ${game.siege.destroyed} engines destroyed · wave ${game.siege.wave}/${game.siege.waves}`;
    } else {
      byId("winner").textContent = player.score === rival.score ? "A draw" : player.score > rival.score ? "You won" : "The rival won";
      const total = `${player.score} to ${rival.score}`;
      byId("result").textContent = {
        classic:`${total} gold · ${sorties} deposits · ${royals} princesses · ${burns} buildings burned · ${knockouts} knockouts`,
        "crown-chase":`${total} princesses delivered`,
        "banner-raid":`${total} seconds holding a majority`
      }[game.variant];
    }
    roundEnd.showModal();
  }

  flightAction.addEventListener("click",flightActionClick);
  restartButton.addEventListener("click",restart);
  byId("play-again").addEventListener("click",restart);
  byId("choose-raid").addEventListener("click",()=>{
    resetRound(game.variant);
    variantSelect.focus();
  });
  variantSelect.addEventListener("change",()=>chooseVariant(variantSelect.value));
  soundButton.addEventListener("click",event=>{
    const enabled=sound.toggle();
    event.currentTarget.textContent=enabled?"Sound on":"Sound off";
    event.currentTarget.setAttribute("aria-pressed",enabled);
  });
  roundEnd.addEventListener("cancel",event=>event.preventDefault());

  window.addEventListener("keydown",event=>{
    if (event.target === variantSelect) return;
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
  window.addEventListener("pointerdown",sound.unlock,{once:true});
  window.addEventListener("keydown",sound.unlock,{once:true});
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

  function stick(axes, offset, deadZone) {
    const x = axes[offset] ?? 0;
    const y = axes[offset+1] ?? 0;
    const length = Math.hypot(x,y);
    const scale = length > deadZone ? (Math.min(length,1)-deadZone)/((1-deadZone)*length) : 0;
    return {x:x*scale, y:y*scale};
  }

  function readPad(pad) {
    const standard = pad.mapping === "standard";
    const pressed = index => Boolean(pad.buttons[index]?.pressed);
    const move = stick(pad.axes,0,.18);
    if (standard && !move.x && !move.y) {
      move.x = Number(pressed(15))-Number(pressed(14));
      move.y = Number(pressed(13))-Number(pressed(12));
    }
    const aim = standard || pad.axes.length === 4 ? stick(pad.axes,2,.25) : {x:0,y:0};
    const aiming = Boolean(aim.x || aim.y);
    return {...move, aim:aiming?Math.atan2(aim.y,aim.x):null,
      fire:aiming || pressed(standard?7:1), dash:pressed(0), start:pressed(9), variant:Number(pressed(5))-Number(pressed(4))};
  }

  function pollPad() {
    if (!gamepadAllowed || !navigator.getGamepads) return null;
    try {
      for (const pad of navigator.getGamepads()) {
        if (!pad?.connected || (pad.mapping !== "standard" && (pad.mapping !== "" || pad.axes.length < 2))) continue;
        const state = readPad(pad);
        if (state.x || state.y || state.fire || state.dash || state.start || state.variant) return state;
      }
      return null;
    } catch (error) {
      // An embedded page can be denied the API while keyboard and touch still work.
      if (error.name !== "SecurityError") throw error;
      gamepadAllowed = false;
      return null;
    }
  }

  function readInput() {
    const pad = pollPad();
    const start = Boolean(pad?.start);
    const startPressed = start && !heldStart;
    heldStart = start;
    const variantDirection = pad?.variant ?? 0;
    if (variantDirection && variantDirection !== heldVariant && !document.hidden && (mode === "ready" || mode === "finished")) {
      const next = (variantIds.indexOf(game.variant)+variantDirection+variantIds.length)%variantIds.length;
      chooseVariant(variantIds[next]);
    }
    heldVariant = variantDirection;
    if (startPressed && !document.hidden) {
      if (mode === "finished") restart();
      else flightActionClick();
    }
    const key=(a,b)=>Number(keys.has(a)||keys.has(b));
    const x=key("KeyD","ArrowRight")-key("KeyA","ArrowLeft")+(pad?.x ?? 0)+(touch?clamp((touch.x-touch.originX)/37,-1,1):0);
    const y=key("KeyS","ArrowDown")-key("KeyW","ArrowUp")+(pad?.y ?? 0)+(touch?clamp((touch.y-touch.originY)/37,-1,1):0);
    const mouseAim=mouse && !touch && !touchFire && gap(mouse,game.dragons[0])>8;
    const aim=pad?.fire ? pad.aim : mouseAim ? bearing(game.dragons[0],mouse) : null;
    const fire=Boolean(pad?.fire || mouseDown || touchFire || keys.has("Space"));
    const dash=Boolean(pad?.dash || keys.has("ShiftLeft") || keys.has("ShiftRight") || dashQueue);
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
      case "fall": caption(x,y-24,game.variant==="classic"?"Loot dropped":"Knocked out","#ffc0a6"); sparks(x,y,"#fa795b",28); break;
      case "bank": caption(x,y-32,`+${amount}`,ink); sparks(x,y,ink,24); break;
      case "royal": caption(x,y-32,"Princess aboard","#ffd1ea"); break;
      case "royalDeparture": caption(x,y-35,"Royal carriage","#ffd1ea"); break;
      case "upgrade": if(actor===0) caption(x,y-57,RULES.upgradeNames[amount-1],ink); break;
      case "phase": caption(player.x,player.y-40,amount===1?"Towers on alert":"Towers fire faster","#ffc6a2"); break;
      case "capture": sparks(x,y,ink,22); break;
      case "breach": caption(x,y-30,`−${amount}% walls`,"#ffb3a1"); sparks(x,y,"#fa795b",26); break;
      case "finish": finish(); break;
      }
    }
  }

  function updateHud() {
    const [player,rival]=game.dragons;
    const left=Math.ceil(game.rules.duration-game.time);
    const show=(id,value)=>{ if(readouts[id].value!==String(value)) readouts[id].value=value; };
    const suffix = game.variant==="banner-raid" ? "s" : "";
    const goal = game.rules.target ? `/${game.rules.target}${suffix}` : "";
    show("player-score",game.siege ? `${game.siege.health}%` : player.score+goal);
    show("rival-score",game.siege ? `${game.siege.wave}/${game.siege.waves}` : rival.score+goal);
    show("clock",`${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`);
    readouts.clock.parentElement.classList.toggle("late",left<=30);
    readouts.health.value=player.health;
    readouts.breath.value=player.breath;
    show("cargo",game.variant==="crown-chase" ? player.royal ? "To Crown Abbey" : "—" : `${player.carry} / ${capacity(player)}`);
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
