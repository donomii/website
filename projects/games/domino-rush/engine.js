import {RULES, STAGES, CONTROLLER} from "./types.js";

export function createControllerInput() {
    let identity=null;let armed=false;let previous={start:false,push:false,retry:false,direction:0};
    return (pads,focused=true)=>{
        const available=Array.from(pads).filter(p=>p && p.connected && p.mapping==="standard");
        const pad=available.find(p=>p.index+":"+p.id===identity) ?? available[0];
        const next=pad ? pad.index+":"+pad.id : null;
        const lost=identity!==null && identity!==next;
        if(identity!==next || !focused){armed=false;identity=next;}else{identity=next;}
        const down=index=>!!pad?.buttons[index]?.pressed;
        const axis=pad?.axes[0] ?? 0;
        const left=down(CONTROLLER.left) || axis < -CONTROLLER.deadzone;
        const right=down(CONTROLLER.right) || axis > CONTROLLER.deadzone;
        const direction=left===right ? 0 : left ? -1 : 1;
        const held={start:down(CONTROLLER.start),push:down(CONTROLLER.push),retry:down(CONTROLLER.retry),direction};
        const lay=down(CONTROLLER.lay);
        const active=armed && focused && !!pad;
        const result={connected:!!pad,lost,unsupported:!pad && Array.from(pads).some(p=>p && p.connected),lay:active && lay,
            start:active && held.start && !previous.start,push:active && held.push && !previous.push,retry:active && held.retry && !previous.retry,
            steer:active && direction!==previous.direction ? direction : 0};
        if(focused && pad && !lay && !held.start && !held.push && !held.retry && direction===0){armed=true;}else{armed=active;}
        previous=held;return result;
    };
}

export function createGame(stageIndex = 0, score = 0) {
    if (!Number.isInteger(stageIndex) || !STAGES[stageIndex] || !Number.isFinite(score) || score < 0) {
        throw new Error("Cannot start stage: expected a valid stage index and nonnegative score.");
    } else {
        return {
            stageIndex, stage: STAGES[stageIndex], score, startScore: score, status: "ready",
            position: 0, lane: 1, displayLane: 1, stamina: RULES.stamina, time: 0,
            dominoes: new Map(), waves: [], activated: new Set(), healthUsed: new Set(),
            chain: 0, bestChain: 0, combo: 0, lap: 1, laying: false, paused: false,
            stun: 0, events: [], message: "Lay a trail. Come around again. Give it a push.",
            effect: null, effectTime: 0, serial: 0, effectStarted: [null,null,null,null],
            points: {dominoes: 0, tricks: 0, stamina: 0}, lastLaid: null, chainBreak: null,
            notice: "", noticeKind: "", noticeTime: 0, hits: 0, resets: 0, pushTime: -1
        };
    }
}

export const tileKey = (cell, lane) => cell + ":" + lane;
export const wrap = value => ((value % RULES.cells) + RULES.cells) % RULES.cells;
export function movingObstacle(game) {
    const mover=game.stage.mover;
    return {cell:mover.cell,lane:mover.from+(mover.to-mover.from)*(1-Math.cos(game.time/mover.period*Math.PI*2))/2};
}
export function stageAward(game) {
    const cleared=game.status==="won";
    const clean=cleared && game.hits===0 && game.resets===0;
    const linked=cleared && game.combo===4;
    return {medal:!cleared ? "NONE" : clean && linked ? "GOLD" : clean || linked ? "SILVER" : "BRONZE",clean,linked,score:game.score-game.startScore};
}
export function readRecords(raw) {
    const records=raw===null ? [] : JSON.parse(raw);
    if(!Array.isArray(records) || records.length>STAGES.length || records.some(r=>r!==null && (!Number.isSafeInteger(r.score) || r.score<0 || !["BRONZE","SILVER","GOLD"].includes(r.medal) || typeof r.clean!=="boolean" || typeof r.linked!=="boolean"))){
        throw new Error("Invalid saved record format; expected up to three stage scores, medals and challenge flags. Records were not changed.");
    }else{return records;}
}
export function bestRecord(old,award) {
    const ranks=["BRONZE","SILVER","GOLD"];
    return {score:Math.max(old?.score ?? 0,award.score),medal:ranks[Math.max(ranks.indexOf(old?.medal),ranks.indexOf(award.medal))],clean:award.clean || !!old?.clean,linked:award.linked || !!old?.linked};
}

export function start(game) {
    if (game.status === "ready") {
        game.status = "running";
        enterTile(game, 0);
        emit(game,"resume",game.stage.lesson);
    } else {
        game.message = "Press R to retry this stage.";
    }
}

export function steer(game, direction) {
    if (game.status === "running" && !game.paused && [-1, 1].includes(direction)) {
        const anchor = game.laying && game.lastLaid?.position === Math.floor(game.position) ? game.lastLaid.lane : game.lane;
        game.lane = Math.max(0, anchor-1, Math.min(RULES.lanes - 1, anchor+1, game.lane + direction));
    } else {
        return false;
    }
    return true;
}

function emit(game, kind, text, index = -1) {
    game.events.push({id: ++game.serial, kind, text, index});
    game.message = text;
    if (["hit","heal","reset","trick","resume","win"].includes(kind)) {
        game.notice = text;
        game.noticeKind = kind;
        game.noticeTime = RULES.noticeDuration;
    } else {
        return;
    }
}

function schedule(game, cell, lane, delay) {
    const domino = game.dominoes.get(tileKey(wrap(cell), lane));
    if (domino && domino.fallenAt === null && !domino.queued) {
        domino.queued = true;
        game.waves.push({cell: wrap(cell), lane, delay});
    } else {
        return false;
    }
    return true;
}

export function push(game, cell, lane) {
    if (game.status === "running" && schedule(game, cell, lane, 0)) {
        game.status = "chain";
        game.pushTime = game.time;
        game.chain = 0;
        game.chainBreak = null;
        game.combo = 0;
        game.laying = false;
        emit(game, "push", "Here we go!");
        return true;
    } else {
        return false;
    }
}

export function nudge(game) {
    const cell = wrap(Math.floor(game.position));
    if (game.paused) {
        return false;
    } else {
        return push(game, cell, game.lane) || push(game, cell + 1, game.lane);
    }
}

function resolveTileEffects(game, cell) {
    const stage = game.stage;
    const onTile = tile => tile.cell === cell && tile.lane === game.lane;
    const key = tileKey(cell, game.lane);
    const mover=movingObstacle(game);
    if (stage.resets.some(onTile)) {
        game.resets += 1;
        game.dominoes.clear();
        game.activated.clear();
        game.effectStarted.fill(null);game.effectTime=0;game.chainBreak=null;game.lastLaid=null;
        game.stamina = Math.max(0, game.stamina - RULES.resetCost);
        emit(game, "reset", "RESET! -"+RULES.resetCost+" stamina · trails and tricks cleared.");
    } else if (stage.hazards.some(onTile) || (mover.cell===cell && Math.abs(mover.lane-game.lane)<0.6)) {
        game.hits += 1;
        game.stun = 0.65;
        game.stamina = Math.max(0, game.stamina - RULES.hitCost);
        emit(game, "hit", "OUCH! -"+RULES.hitCost+" stamina · change lanes to dodge!");
    } else if (stage.health.some(onTile) && !game.healthUsed.has(key)) {
        game.healthUsed.add(key);
        const recovered = Math.min(RULES.heal, RULES.stamina-game.stamina);
        game.stamina += recovered;
        emit(game, "heal", "+"+Math.round(recovered)+" stamina!");
    } else {
        return;
    }
}

function enterTile(game, cell) {
    resolveTileEffects(game, cell);
    const stage = game.stage;
    const onTile = tile => tile.cell === cell && tile.lane === game.lane;
    const key = tileKey(cell, game.lane);
    if (game.dominoes.has(key)) {
        push(game, cell, game.lane);
    } else if (game.laying && game.stun<=0 && !stage.resets.some(onTile) && !stage.hazards.some(onTile)) {
        game.dominoes.set(key, {cell, lane: game.lane, fallenAt: null, queued: false});
        game.lastLaid = {position: Math.floor(game.position), lane: game.lane};
        game.events.push({id: ++game.serial, kind: "lay", text: "", index: -1});
    } else {
        return;
    }
}

function fall(game, wave) {
    const domino = game.dominoes.get(tileKey(wave.cell, wave.lane));
    if (!domino || domino.fallenAt !== null) {
        return;
    } else {
        domino.fallenAt = game.time;
        game.chain += 1;
        game.bestChain = Math.max(game.bestChain, game.chain);
        game.score += 10 * Math.max(1, game.combo);
        game.points.dominoes += 10 * Math.max(1, game.combo);
        game.events.push({id: ++game.serial, kind: "fall", text: "", index: -1});
    }
    const trickIndex = game.stage.tricks.findIndex(t => t.cell === wave.cell && t.lane === wave.lane);
    if (trickIndex >= 0 && !game.activated.has(trickIndex)) {
        const trick = game.stage.tricks[trickIndex];
        game.activated.add(trickIndex);
        game.combo += 1;
        game.score += 500 * game.combo;
        game.points.tricks += 500 * game.combo;
        game.effectStarted[trickIndex] = game.time;
        game.effect = trickIndex;
        game.effectTime = 2.5;
        emit(game, "trick", trick.name+" +"+(500*game.combo)+" · TRICK COMBO ×"+game.combo+"! "+trick.action, trickIndex);
        if (trick.hint !== null) {
            schedule(game, trick.hint, trick.nextLane, RULES.trickDelay);
        } else {
            game.message = trick.action;
        }
    } else {
        game.bestChain = Math.max(game.bestChain, game.chain);
    }
    // Adjacent lanes can connect; a jump across two lanes breaks a trail.
    for (let lane = Math.max(0, wave.lane - 1); lane <= Math.min(2, wave.lane + 1); lane += 1) {
        schedule(game, wave.cell + 1, lane, RULES.toppleDelay);
    }
}

function markChainBreak(game, last) {
    const trick = game.stage.tricks.find(t => t.cell===last.cell && t.lane===last.lane);
    const cell = trick?.hint ?? wrap(last.cell+1);
    const lane = trick?.nextLane ?? last.lane;
    const obstacle = [...game.stage.hazards,...game.stage.resets].some(t=>t.cell===cell && t.lane===lane);
    const reason = obstacle ? "Obstacle blocks the trail — weave around it." : trick?.hint != null ? "Empty continuation ring — lay a trail from here." : "Gap in the trail — connect the next tile in a neighbouring lane.";
    return {cell,lane,reason,until: game.time+RULES.noticeDuration+Math.max(game.effectTime, RULES.fallDuration+RULES.fallenHoldDuration)};
}

function updateChain(game, dt) {
    const due = [];
    game.waves = game.waves.filter(wave => {
        wave.delay -= dt;
        if (wave.delay <= 0) {
            due.push(wave);
            return false;
        } else {
            return true;
        }
    });
    due.forEach(wave => fall(game, wave));
    game.chainBreak = due.length > 0 && game.waves.length === 0 && game.activated.size < game.stage.tricks.length
        ? markChainBreak(game, due[due.length-1]) : game.chainBreak;
    const stillFalling = [...game.dominoes.values()].some(domino =>
        domino.fallenAt !== null && game.time - domino.fallenAt < RULES.fallDuration + RULES.fallenHoldDuration);
    if (game.waves.length === 0 && game.effectTime <= 0 && !stillFalling) {
        if (game.activated.size === game.stage.tricks.length) {
            game.status = "won";
            game.points.stamina = Math.round(game.stamina * 25);
            game.score += game.points.stamina;
            emit(game, "win", "Nobody can stop a good chain reaction.");
        } else {
            game.status = "running";
            for (const [key, domino] of game.dominoes) {
                if (domino.fallenAt !== null) {
                    game.dominoes.delete(key);
                } else {
                    domino.queued = false;
                }
            }
            emit(game, "resume", game.chainBreak ? "CHAIN STOPPED · "+game.chainBreak.reason : "Chain ended. Keep running — the remaining tricks are still waiting.");
        }
    } else {
        game.bestChain = Math.max(game.bestChain, game.chain);
    }
}

export function tick(game, dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.1) {
        throw new Error("Cannot advance game: expected a timestep between 0 and 0.1 seconds.");
    } else if (game.paused || !["running", "chain"].includes(game.status)) {
        return;
    } else {
        game.time += dt;
        game.effectTime = Math.max(0, game.effectTime - dt);
        game.noticeTime = Math.max(0, game.noticeTime - dt);
        game.displayLane += (game.lane - game.displayLane) * Math.min(1, dt * 14);
    }
    if (game.status === "chain") {
        updateChain(game, dt);
    } else {
        game.stamina = Math.max(0, game.stamina - dt * RULES.drain);
        if (game.stamina <= 0) {
            game.status = "lost";
            emit(game, "lose", "Out of stamina. Even Mr. Domino needs a breather.");
        } else if (game.stun > 0) {
            game.stun = Math.max(0, game.stun - dt);
        } else {
            const before = Math.floor(game.position);
            game.position += dt * RULES.speed * game.stage.pace;
            game.lap = Math.floor(game.position / RULES.cells) + 1;
            if (Math.floor(game.position) > before) {
                enterTile(game, wrap(Math.floor(game.position)));
            } else {
                game.position = Math.max(0, game.position);
            }
        }
    }
}
