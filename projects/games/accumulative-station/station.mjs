export const types = {
    Habitat: "#76c6b7", Laboratory: "#ad9ddf", Greenhouse: "#a6c679", Observatory: "#e4b77e",
};
export const ports = {
    East: [1, 0, 0], West: [-1, 0, 0], North: [0, -1, 0],
    South: [0, 1, 0], Up: [0, 0, 1], Down: [0, 0, -1],
};
export const moduleLimit = 96;
const keyOf = position => position.join(",");

export function createStation() {
    return { modules: [{ position: [0, 0, 0], type: "Habitat", links: [] }] };
}

export function connect(station, index, port, type) {
    const source = station.modules[index];
    if (!source || !Object.hasOwn(ports, port) || !Object.hasOwn(types, type)) {
        return { error: "Choose a module type and a valid port." };
    }
    const position = source.position.map((value, axis) => value + ports[port][axis]);
    let target = station.modules.findIndex(module => keyOf(module.position) === keyOf(position));
    let built = false;
    if (target === -1) {
        if (station.modules.length >= moduleLimit) return { error: "This prototype supports 96 modules." };
        target = station.modules.length;
        station.modules.push({ position, type, links: [] });
        built = true;
    } else if (source.links.includes(target)) {
        return { error: "That port already has a tube." };
    }
    source.links.push(target);
    station.modules[target].links.push(index);
    return { target, built };
}

export function createInhabitant(index, start) {
    return { index, from: start, to: start, previous: -1, phase: 0, trips: 0 };
}

export function walk(station, crew, milliseconds) {
    if (crew.from === crew.to) {
        const { links } = station.modules[crew.from];
        const next = links.filter(link => link !== crew.previous);
        const choices = next.length ? next : links;
        if (choices.length) crew.to = choices[(crew.index + crew.trips) % choices.length];
    }
    if (crew.from !== crew.to) {
        crew.phase += milliseconds / (1550 + crew.index % 4 * 180);
        if (crew.phase >= 1) {
            crew.previous = crew.from;
            crew.from = crew.to;
            crew.phase = 0;
            crew.trips++;
        }
    }
    return station.modules[crew.from].position.map((value, axis) =>
        value + (station.modules[crew.to].position[axis] - value) * crew.phase);
}
