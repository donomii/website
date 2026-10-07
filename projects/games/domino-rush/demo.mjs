import {steer, wrap} from "./engine.mjs";
import {RULES} from "./types.mjs";

const plans = new WeakMap();

// Find a safe lap that passes every switch and continuation ring.
// One lane change per cell also keeps placed dominoes close enough to connect.
export function planRoute(stage) {
    const required = new Map([[0,1],[RULES.cells-1,1]]);
    for (const trick of stage.tricks) {
        required.set(trick.cell,trick.lane);
        if (trick.hint !== null) { required.set(trick.hint,trick.nextLane); } else { continue; }
    }
    const blocked = new Set([...stage.hazards,...stage.resets].map(t=>t.cell+":"+t.lane));
    for(let lane=stage.mover.from;lane<=stage.mover.to;lane+=1){blocked.add(stage.mover.cell+":"+lane);}
    let paths = [{lane:1,cost:0,route:[1]}];
    for (let cell=1;cell<RULES.cells;cell+=1) {
        const next=[];
        for (let lane=0;lane<RULES.lanes;lane+=1) {
            if (blocked.has(cell+":"+lane) || (required.has(cell) && required.get(cell)!==lane)) {
                continue;
            } else {
                const choices=paths.filter(p=>Math.abs(p.lane-lane)<=1).map(p=>({
                    lane,cost:p.cost+(p.lane===lane ? 0 : 1)+Math.abs(lane-1)*0.01,route:[...p.route,lane]
                })).sort((a,b)=>a.cost-b.cost);
                if (choices.length>0) { next.push(choices[0]); } else { continue; }
            }
        }
        paths=next;
    }
    if (paths.length===0) {
        throw new Error("Cannot demonstrate "+stage.name+": no safe connected route through its switches and rings.");
    } else {
        return paths.sort((a,b)=>a.cost-b.cost)[0].route;
    }
}

// Demonstrate a planned route using the same controls as the player.
export function demonstrate(game) {
    if (!plans.has(game.stage)) { plans.set(game.stage,planRoute(game.stage)); } else { game.laying=false; }
    const nextCell=wrap(Math.floor(game.position)+1);
    const lane=plans.get(game.stage)[nextCell];
    if (game.lane!==lane) { steer(game,Math.sign(lane-game.lane)); } else { game.lane=lane; }
    // Stop laying after one lap, then run into the first trail.
    game.laying=game.position<63 && game.stage.tricks.some((trick,i)=>{
        const from=i===0 ? 1 : game.stage.tricks[i-1].hint;
        return nextCell>=from && nextCell<=trick.cell;
    });
}
