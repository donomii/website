import {RULES} from "./types.js";

// Four straight runs joined by rounded corners; position zero is the roulette end.
export function trackPoint(cell, lane) {
    const position = ((cell % RULES.cells) + RULES.cells) % RULES.cells;
    const side = Math.floor(position / 16);
    const local = position % 16;
    const radius = 2 + (1 - lane) * 1.05;
    const corners = [[10,-6],[10,6],[-10,6],[-10,-6]];
    if (local < 13) {
        const t = local / 13;
        const segments = [
            [-10,-6-radius,10,-6-radius],
            [10+radius,-6,10+radius,6],
            [10,6+radius,-10,6+radius],
            [-10-radius,6,-10-radius,-6]
        ];
        const [x,z,xx,zz] = segments[side];
        return {x:x+(xx-x)*t,z:z+(zz-z)*t};
    } else {
        const angle = -Math.PI/2 + side*Math.PI/2 + (local-13)/3*Math.PI/2;
        const [x,z] = corners[side];
        return {x:x+Math.cos(angle)*radius,z:z+Math.sin(angle)*radius};
    }
}
export function trackHeading(cell, lane) {
    const a = trackPoint(cell-0.025,lane);
    const b = trackPoint(cell+0.025,lane);
    return Math.atan2(b.x-a.x,b.z-a.z);
}

