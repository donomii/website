import { connect, createInhabitant, createStation, walk } from "../../projects/games/accumulative-station/station.mjs";
import { stationHangar } from "./station-hangar.js?v=20261111";
import { stationModels } from "./station-models.js?v=20261111";

export function createStationRoom(report = () => {}) {
    const room = stationHangar();
    const model = stationModels(room.scene);
    const station = createStation();
    const crew = [];
    let selection = 0;
    let type = "Habitat";
    let active = false;
    let previous;
    let message = "";
    const show = () => {
        const crewCount = Math.min(24, station.modules.filter(module => module.type === "Habitat").length * 3);
        while (crew.length < crewCount) crew.push(createInhabitant(crew.length, selection));
        model.draw(station, selection, type);
        const tubes = station.modules.reduce((count, module) => count + module.links.length, 0) / 2;
        const total = station.modules.length;
        const summary = [total + (total === 1 ? " module" : " modules"), tubes + (tubes === 1 ? " tube" : " tubes"), crew.length + " crew"].join(" · ");
        report("Station · " + summary + (message ? ". " + message : ""));
    };
    show();
    return {
        ...room, aimSelect: true,
        enter() { active = true; previous = undefined; show(); },
        leave() { active = false; previous = undefined; },
        update(now) {
            if (!active) return;
            const elapsed = previous === undefined ? 0 : Math.max(0, Math.min(100, now - previous));
            previous = now;
            const positions = crew.map(member => walk(station, member, elapsed));
            model.animate(station, crew, positions, now, elapsed);
        },
        select(ray) {
            const order = model.hit(ray);
            if (!order) return false;
            if (order.kind === "type") {
                type = order.type;
                message = type + " blueprint selected.";
            } else if (order.kind === "module") {
                selection = order.index;
                message = "Module " + (selection + 1) + " selected.";
            } else {
                const result = connect(station, selection, order.port, type);
                if (result.error) {
                    message = result.error;
                } else {
                    selection = result.target;
                    message = result.built ? type + " attached through " + order.port + "." : "Loop closed with a tube.";
                }
            }
            show();
            return true;
        },
    };
}
