export const species = {
    builder: "#79d3a8", breaker: "#e9b779", hunter: "#f1879d",
};
export const width = 32;
export const height = 19;
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const key = (x, y) => x + width * y;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

export function createWorld() {
    const world = { agents: [], blocks: new Set(), tick: 0, built: 0, broken: 0, caught: 0 };
    for (let y = 6; y <= 12; y++) {
        if (y !== 9) world.blocks.add(key(15, y));
    }
    for (const [type, x, y] of [
        ["builder", 6, 6], ["builder", 5, 12], ["builder", 11, 8],
        ["breaker", 22, 11], ["breaker", 26, 6], ["hunter", 29, 14],
    ]) spawn(world, type, x, y);
    return world;
}

export function spawn(world, type, x, y) {
    if (!Object.hasOwn(species, type) || world.agents.length >= 40 || !free(world, x, y)) return false;
    world.agents.push({ type, x, y, stun: 0, phase: world.agents.length % 5 });
    return true;
}

export function placeBlock(world, x, y) {
    if (!free(world, x, y)) return false;
    world.blocks.add(key(x, y));
    return true;
}

function free(world, x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && inside(x, y) && !world.blocks.has(key(x, y)) &&
        !world.agents.some(agent => agent.x === x && agent.y === y);
}

function neighbors(agent, tick) {
    const offset = (tick + agent.phase) % directions.length;
    return directions.map((_, index) => {
        const [dx, dy] = directions[(offset + index) % directions.length];
        return { x: agent.x + dx, y: agent.y + dy };
    });
}

function nearest(agent, entries) {
    return entries.reduce((best, candidate) =>
        !best || distance(agent, candidate) < distance(agent, best) ? candidate : best, null);
}

function move(agent, spot) {
    agent.x = spot.x;
    agent.y = spot.y;
}

export function stepWorld(world) {
    world.tick++;
    for (const agent of world.agents) {
        if (agent.stun > 0) {
            agent.stun--;
            continue;
        }
        const near = neighbors(agent, world.tick);
        const openings = near.filter(({ x, y }) => free(world, x, y));
        if (agent.type === "builder") {
            const threat = nearest(agent, world.agents.filter(other => other.type === "hunter"));
            if (threat && distance(agent, threat) <= 4 && openings.length) {
                move(agent, openings.reduce((best, spot) => distance(spot, threat) > distance(best, threat) ? spot : best));
            } else if ((world.tick + agent.phase) % 4 === 0 && openings.length > 1) {
                const [spot] = openings;
                world.blocks.add(key(spot.x, spot.y));
                world.built++;
                move(agent, openings[1]);
            } else if (openings.length) {
                move(agent, openings[0]);
            }
        } else if (agent.type === "breaker") {
            const target = nearest(agent, [...world.blocks].map(cell => ({ x: cell % width, y: Math.floor(cell / width) })));
            if (target && distance(agent, target) === 1) {
                world.blocks.delete(key(target.x, target.y));
                world.broken++;
            } else if (openings.length) {
                move(agent, target ? nearest(target, openings) : openings[0]);
            }
        } else {
            const prey = nearest(agent, world.agents.filter(other => other.type === "builder" && other.stun === 0));
            if (prey && distance(agent, prey) === 1) {
                prey.stun = 5;
                world.caught++;
            } else if (openings.length) {
                move(agent, prey ? nearest(prey, openings) : openings[0]);
            }
        }
    }
}
