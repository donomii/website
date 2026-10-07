import {RULES, STAGES} from "./types.js";
import {createGame, start, tick, steer, nudge, movingObstacle, stageAward, readRecords, bestRecord, createControllerInput} from "./engine.js";
import {createRenderer} from "./render.js";
import {demonstrate} from "./demo.js";

const byId = id => document.getElementById(id);
const renderer = createRenderer(byId("game"));
let game = createGame();
let demo = false;
let sound = false;
let audio = null;
let previous = performance.now();
let accumulator = 0;
let lastStatus = "";
let lastTricks = "";
let lastSoundTime = 0;
let previousScore = 0;
let scoreGain = 0;
let gainUntil = 0;
let musicBeat = -1;
const controllerInput=createControllerInput();
let keyboardLay=false;let touchLay=false;

function pollController() {
    let input;
    try {
        if(typeof navigator.getGamepads!=="function"){throw new Error("Gamepad API unavailable");}else{
            input=controllerInput(navigator.getGamepads(),document.hasFocus() && !document.hidden);
        }
    }catch(error){
        input=controllerInput([]);byId("controller-status").textContent="Controller unavailable in this browser. Use keyboard or open the launcher in another browser.";
    }
    if(input.lost){
        game.paused=["running","chain"].includes(game.status);keyboardLay=false;touchLay=false;game.laying=false;
    }else if(input.start){
        if(game.paused || ["ready","won","lost"].includes(game.status)){primary();}else{pause();}
    }else if(input.retry){demo=false;reset();begin();}
    else if(!demo && input.push){nudge(game);}else if(!demo && input.steer){steer(game,input.steer);}else{input.steer=0;}
    if(input.connected){byId("controller-status").textContent="Controller connected · D-pad / stick: lanes · A / Cross: hold to lay · B / Circle: push · Start: start/pause · Y / Triangle: retry.";}
    else if(input.unsupported){byId("controller-status").textContent="Controller detected without standard mapping. Use keyboard or a standard Xbox/PlayStation-compatible controller.";}
    else if(typeof navigator.getGamepads==="function" && !byId("controller-status").textContent.includes("unavailable")){byId("controller-status").textContent="Connect a USB/Bluetooth controller and press a button. Release controls after connecting; centre the stick between lane changes.";}
    else{input.lay=false;}
    if(!demo){game.laying=!game.paused && game.status==="running" && (keyboardLay || touchLay || input.lay);}else{return;}
}
let savedRun = null;
const recordKey="mr-domino-records-v1";
let records=[];
let recordError="";
try {
    const raw=localStorage.getItem(recordKey);
    records=readRecords(raw);
}catch(error){records=[];recordError="Records unavailable: "+error.message;}

function updateRecords() {
    if(game.status==="won" && !demo && savedRun!==game){
        savedRun=game;
        const award=stageAward(game);const old=records[game.stageIndex];
        records[game.stageIndex]=bestRecord(old,award);
        try {
            if(recordError){throw new Error(recordError);}else{
                const serialized=JSON.stringify(records);readRecords(serialized);localStorage.setItem(recordKey,serialized);
            }
        }catch(error){recordError="Could not save records: "+error.message;}
    }else{savedRun=game.status==="ready" ? null : savedRun;}
    const record=records[game.stageIndex];
    byId("records").textContent=recordError || (record ? "BEST: "+record.score+" · "+record.medal+" · No damage: "+(record.clean ? "earned" : "open")+" · Four-trick chain: "+(record.linked ? "earned" : "open") : "No saved clear yet. Bronze: clear · Silver: one challenge · Gold: both.");
    byId("award").textContent=game.status==="won" ? (demo ? "DEMO · records not saved" : stageAward(game).medal+" MEDAL · No damage: "+(stageAward(game).clean ? "earned" : "missed")+" · Four-trick chain: "+(stageAward(game).linked ? "earned" : "missed")) : "";
}

function impact(kind) {
    const duration=kind==="hit" ? 0.2 : 0.07;
    const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i+=1){samples[i]=(Math.random()*2-1)*Math.exp(-i/samples.length*7);}
    const source=audio.createBufferSource();source.buffer=buffer;
    const filter=audio.createBiquadFilter();filter.type="bandpass";filter.frequency.value=kind==="hit" ? 350 : [1800,2600,1200][game.stageIndex];
    const gain=audio.createGain();gain.gain.value=kind==="hit" ? 0.25 : 0.12;
    source.connect(filter).connect(gain).connect(audio.destination);source.start();
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
}

// Original stage motifs, synthesized locally. Simulation time keeps pauses silent.
function music() {
    const beat=Math.floor(game.time*(game.stageIndex===0 ? 4 : game.stageIndex===1 ? 4.5 : 5));
    if(!sound || !audio || game.paused || !["running","chain"].includes(game.status)){
        musicBeat=beat;
    }else if(beat!==musicBeat){
        musicBeat=beat;
        const motifs=[[0,4,7,9,7,4,2,7],[0,7,3,10,7,3,5,2],[0,2,7,5,10,7,2,5]];
        const root=[220,196,174.61][game.stageIndex];
        playNote(root*2**(motifs[game.stageIndex][beat%8]/12),"triangle",0.025,0.13);
        if(beat%2===0){playNote(root/2*2**((beat%8<4 ? 0 : 5)/12),"sine",0.04,0.2);}else{return;}
    }else{return;}
}

function playNote(frequency,type,volume,duration,endFrequency=frequency) {
    const oscillator=audio.createOscillator();const gain=audio.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency,audio.currentTime+duration);
    gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+duration);
    oscillator.connect(gain).connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+duration);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}

function tone(kind) {
    if (!sound || !audio || kind==="resume" || (audio.currentTime - lastSoundTime < 0.035 && !["trick","win","hit","reset"].includes(kind))) {
        return;
    } else {
        lastSoundTime = audio.currentTime;
        if(kind==="fall" || kind==="lay"){
            impact(kind);playNote(kind==="fall" ? 720 : 520,"triangle",0.035,0.065,180);return;
        }else if(kind==="trick" || kind==="win"){
            [1,1.25,1.5,2].forEach(ratio=>playNote(330*ratio,"triangle",0.035,0.4));return;
        }else if(kind==="hit" || kind==="reset"){
            impact("hit");
            playNote(140,"sawtooth",0.055,0.22,35);return;
        }else{lastSoundTime=audio.currentTime;}
        const notes = {lay:330, fall:450+game.chain*9, trick:880, hit:100, reset:130, win:1100, push:240, heal:740};
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = kind === "trick" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(notes[kind] || 300,audio.currentTime);
        gain.gain.setValueAtTime(kind === "lay" ? 0.035 : 0.08,audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.16);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime+0.17);
        oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
}

function reset(stageIndex = game.stageIndex, score = game.startScore) {
    keyboardLay=false;touchLay=false;
    game = createGame(stageIndex,score);
    accumulator = 0;
    previousScore = score;
    scoreGain = 0;
    gainUntil = 0;
    musicBeat = -1;
    lastStatus = "";
    lastTricks = "";
    byId("stage").value = String(stageIndex);
    byId("place").textContent = game.stage.place;
    byId("stage-name").textContent = game.stage.name;
    update();
}

function begin(asDemo = false) {
    demo = asDemo;
    start(game);
    lastStatus = "";
    update();
}

function primary() {
    if (game.paused) {
        game.paused = false;
    } else if (game.status === "won") {
        const next = game.stageIndex+1;
        reset(next < STAGES.length ? next : 0,next < STAGES.length ? game.score : 0);
        begin();
    } else if (game.status === "lost") {
        reset();
        begin();
    } else {
        begin();
    }
    byId("primary").blur();
}

function overlay() {
    const status = game.paused ? "paused" : game.status;
    if (status === lastStatus) {
        return;
    } else {
        lastStatus = status;
        byId("overlay").hidden = ["running","chain"].includes(status);
        byId("start-controls").hidden = status !== "ready";
        byId("demo").hidden = status !== "ready";
        byId("results").hidden = !["won","lost"].includes(status);
        byId("results").textContent = "Dominoes: "+game.points.dominoes+" · Trick bonuses: "+game.points.tricks+" · Stamina bonus: "+game.points.stamina+" · Stage total: "+(game.score-game.startScore)+" · Overall: "+game.score;
    }
    const variants = {
        ready:[game.stage.place,game.stage.name,game.stage.lesson+" "+game.stage.description,"START GAME"],
        paused:["TAKE A BREATHER.","TIME STANDS STILL.","Running and stamina are paused. Press P or Resume to continue.","RESUME"],
        won:[demo ? "DEMONSTRATION COMPLETE" : "STAGE CLEAR!","WHAT A<br>CHAIN REACTION.",game.activated.size + " tricks. Best chain: " + game.bestChain + " dominoes. Score includes your remaining stamina bonus.",game.stageIndex === STAGES.length-1 ? "PLAY AGAIN" : "NEXT STAGE"],
        lost:["OUT OF STAMINA.","TRY AGAIN!","Connect the numbered switches. Red rings restart the next chain after a trick. Orange R tiles erase your work.","TRY AGAIN"]
    };
    const text = variants[status];
    if (text) {
        byId("overlay-kicker").textContent = text[0];
        byId("overlay-title").innerHTML = text[1];
        byId("overlay-text").textContent = text[2];
        byId("primary").textContent = text[3];
    } else {
        byId("overlay-kicker").textContent = "KEEP RUNNING";
    }
}

function update() {
    updateRecords();
    byId("score").textContent = String(game.score);
    byId("laid-count").textContent = String(game.dominoes.size);
    byId("energy").textContent = String(Math.ceil(game.stamina));
    byId("meter").style.height = game.stamina/RULES.stamina*100 + "%";
    byId("meter").style.background = game.stamina < 22 ? "#df7a62" : "#cbd181";
    byId("lap").textContent = (demo ? "DEMO · " : "") + "LAP " + String(game.lap).padStart(2,"0");
    byId("lane").textContent = RULES.laneNames[game.lane] + " LANE";
    byId("toast").textContent = game.noticeTime > 0 ? game.notice : demo && game.status === "running" ? "DEMONSTRATION · watch the lane changes. R to play." : game.laying ? "Lay around obstacles. Circle back to score!" : "Hold SPACE to lay · return next lap to topple and score.";
    byId("toast").dataset.kind = game.noticeTime > 0 ? game.noticeKind : "guide";
    document.querySelector(".playfield").classList.toggle("damaged",game.stun > 0);
    updateFeedback();
    byId("toast").hidden = game.paused || ["ready","won","lost"].includes(game.status);
    byId("chain-badge").hidden = game.status !== "chain";
    byId("chain-count").textContent = game.chain+" · ×"+Math.max(1,game.combo);
    const trickState = [...game.activated].join(",") + "/" + game.stageIndex;
    if (trickState !== lastTricks) {
        lastTricks = trickState;
        byId("tricks").innerHTML = game.stage.tricks.map((trick,i) => '<div class="trick ' + (game.activated.has(i) ? 'done' : '') + '" title="' + (i+1) + ': ' + trick.name + ' — ' + RULES.laneNames[trick.lane] + ' lane"><span class="number"><span>' + (game.activated.has(i) ? '✓' : i+1) + '</span></span><strong>' + trick.name + '</strong></div>').join("");
    } else {
        byId("tricks").ariaLabel = game.activated.size + " of 4 tricks complete";
    }
    game.events.splice(0).forEach(event=>tone(event.kind));
    byId("pause").title = game.paused ? "Resume the game (P)" : "Pause the game (P)";
    overlay();
}

function updateFeedback() {
    if (game.score > previousScore) {
        scoreGain = (game.time < gainUntil ? scoreGain : 0) + game.score - previousScore;
        gainUntil = game.time + 1.2;
    } else {
        scoreGain = game.time < gainUntil ? scoreGain : 0;
    }
    previousScore = game.score;
    byId("score-gain").textContent = "+"+scoreGain;
    byId("score-gain").hidden = scoreGain === 0 || !["running","chain"].includes(game.status);
    const cell = game.position % RULES.cells;
    const moving=movingObstacle(game);
    const upcoming = [...game.stage.hazards,...game.stage.resets,{cell:moving.cell,lane:Math.round(moving.lane)}].find(tile=>
        tile.lane===game.lane && (tile.cell-cell+RULES.cells)%RULES.cells < 5 &&
        (tile.cell-cell+RULES.cells)%RULES.cells > 0.15);
    byId("hazard-warning").hidden = !upcoming || game.status!=="running" || game.paused;
    const target = game.stage.tricks.map((tile,index)=>({tile,index,distance:(tile.cell-cell+RULES.cells)%RULES.cells}))
        .filter(t=>!game.activated.has(t.index)).sort((a,b)=>a.distance-b.distance)[0];
    byId("route-hint").textContent = target ? "SWITCH "+(target.index+1)+" · "+RULES.laneNames[target.tile.lane]+" LANE" : "ALL TRICKS COMPLETE";
    byId("route-hint").hidden = !["running","chain"].includes(game.status) || game.paused;
}

function pause() {
    if (["running","chain"].includes(game.status)) {
        game.paused = !game.paused;
        game.laying = false;
        keyboardLay=false;touchLay=false;
        update();
    } else {
        byId("pause").blur();
    }
}

byId("primary").addEventListener("click",primary);
byId("demo").addEventListener("click",()=>begin(true));
byId("stage").addEventListener("change",event=>reset(Number(event.target.value),0));
byId("pause").addEventListener("click",pause);
byId("retry").addEventListener("click",()=>{demo=false;reset();begin();});
byId("fullscreen").addEventListener("click",async()=>{
    try {
        if(document.fullscreenElement){await document.exitFullscreen();}
        else{await document.querySelector(".cabinet").requestFullscreen();}
    }catch(error){
        byId("fullscreen").title="Full screen could not open: "+error.message;
        byId("fullscreen").querySelector("small").textContent="Unavailable in this browser";
    }
});
byId("sound").addEventListener("click",async()=>{
    sound = !sound;
    if (sound) {
        audio = audio || new AudioContext();
        await audio.resume();
        tone("heal");
    } else {
        lastSoundTime = 0;
    }
    byId("sound").innerHTML = "♪ <span>Sound: " + (sound ? "on" : "off") + "<small>" + (sound ? "mute music + effects" : "enable music + effects") + "</small></span>";
});
document.addEventListener("click",event=>{
    const button = event.target.closest("button");
    if (button) { button.blur(); } else { return; }
});
document.addEventListener("keydown",event=>{
    if (event.target instanceof HTMLSelectElement || (event.target instanceof HTMLButtonElement && ["Space","Enter"].includes(event.code))) {
        return;
    } else if (["Space","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter","KeyP","KeyR","KeyX","Escape"].includes(event.code)) {
        event.preventDefault();
    } else {
        return;
    }
    if (event.code === "Space") { keyboardLay = !demo && !game.paused && game.status === "running"; }
    else if (event.repeat) { return; }
    else if (event.code === "Enter" && (game.paused || ["ready","won","lost"].includes(game.status))) { primary(); }
    else if (["KeyP","Escape"].includes(event.code)) { pause(); }
    else if (event.code === "KeyR") { demo=false;reset();begin(); }
    else if (!demo && ["ArrowLeft","ArrowUp"].includes(event.code)) { steer(game,-1); }
    else if (!demo && ["ArrowRight","ArrowDown"].includes(event.code)) { steer(game,1); }
    else if (!demo && event.code === "KeyX") { nudge(game); }
    else { update(); }
});
document.addEventListener("keyup",event=>{
    if (event.code === "Space") { keyboardLay=false; } else { return; }
});
window.addEventListener("blur",()=>{
    keyboardLay=false;touchLay=false;
    controllerInput([],false);
    game.laying = false;
    if (["running","chain"].includes(game.status)) { game.paused=true;update(); } else { return; }
});
byId("outside").addEventListener("pointerdown",event=>{event.preventDefault();steer(game,-1);});
byId("inside").addEventListener("pointerdown",event=>{event.preventDefault();steer(game,1);});
byId("lay").addEventListener("pointerdown",event=>{
    event.preventDefault();
    event.target.setPointerCapture(event.pointerId);
    touchLay = !demo && !game.paused && game.status === "running";
});
for (const name of ["pointerup","pointercancel","lostpointercapture"]) {
    byId("lay").addEventListener(name,()=>{touchLay=false;});
}
function frame(now) {
    pollController();
    const dt = Math.min(0.1,(now-previous)/1000);
    previous = now;
    accumulator += dt;
    while (accumulator >= 1/60) {
        if (demo && game.status === "running" && !game.paused) { demonstrate(game); } else { game.laying = game.laying && !game.paused; }
        tick(game,1/60);
        accumulator -= 1/60;
    }
    renderer.render(game,game.time);
    music();
    update();
    requestAnimationFrame(frame);
}
reset();
if (new URLSearchParams(location.search).get("demo") === "1") { begin(true); } else { demo = false; }
requestAnimationFrame(frame);
