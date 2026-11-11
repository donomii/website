import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { connect, createInhabitant, createStation, walk } from "../../projects/games/accumulative-station/station.mjs";
import { act, advance } from "../../projects/games/asteroid-farmer/game.mjs";
import { loadGame, saveGame } from "../../projects/games/asteroid-farmer/state.mjs";
import { asteroidModels, outposts } from "./asteroid-models.js";
import { stationHangar } from "./station-hangar.js";
import { stationModels } from "./station-models.js";

/**
 * Shared Space Hangar housing Accumulative Station on the left bay and
 * Asteroid Farmer on the right bay overlooking the deep-space viewport.
 */
export function createSpaceRoom(report = () => {}) {
    const room = stationHangar({ combined: true });
    const { scene, platformGroup } = room;

    // 1. Left bay: Accumulative Station
    const stModel = stationModels(platformGroup);
    const station = createStation();
    const crew = [];
    let stSelection = 0;
    let stType = "Habitat";
    let stMessage = "";
    let stSummary = "";

    // 2. Right bay: Asteroid Farmer
    const astBay = new T.Group();
    astBay.position.set(2.9, 0, -0.7);
    astBay.scale.setScalar(0.64);
    scene.add(astBay);
    const astModels = asteroidModels(astBay, { boardPos: [0.6, 3.5, -3.2], boardRotY: -0.35 });
    const storage = { getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) };
    let game;
    let saveEnabled = false;
    let clock = Date.now();
    let warning = "";
    let astSummary = "Asteroid Farmer · Select soil to plant or harvest and structures to build.";

    let active = false;
    let previous;
    let focusSide = null; // null | "station" | "asteroid"
    let playerX = 0;

    const showStation = (forceReport = false) => {
        const crewCount = Math.min(24, station.modules.filter(m => m.type === "Habitat").length * 3);
        while (crew.length < crewCount) crew.push(createInhabitant(crew.length, stSelection));
        stModel.draw(station, stSelection, stType);
        const tubes = station.modules.reduce((c, m) => c + m.links.length, 0) / 2;
        const total = station.modules.length;
        const base = `${total} ${total === 1 ? "module" : "modules"} · ${tubes} ${tubes === 1 ? "tube" : "tubes"} · ${crew.length} crew`;
        stSummary = `Station · ${base}${stMessage ? ". " + stMessage : ""}`;
        if (forceReport || focusSide === "station" || (!focusSide && playerX <= 0)) report(stSummary);
    };

    const showAsteroid = (forceReport = false) => {
        if (!game) return;
        astModels.draw(game);
        astSummary = `Asteroid Farmer · ${game.credits} credits · ${game.fleet} ships. ${game.message}${warning}`;
        if (forceReport || focusSide === "asteroid" || (!focusSide && playerX > 0)) report(astSummary);
    };

    const saveAsteroid = () => {
        if (!saveEnabled || !game) return;
        try {
            saveGame(storage, game, clock);
        } catch (error) {
            saveEnabled = false;
            warning = " Saving unavailable: " + error.message;
        }
    };

    const tickAsteroid = () => {
        if (!game) return;
        const now = Date.now();
        const elapsed = Math.floor((now - clock) / 1000);
        if (elapsed < 1) return;
        clock += elapsed * 1000;
        advance(game, elapsed, document.hidden || elapsed > 4);
        saveAsteroid();
        showAsteroid();
    };

    showStation();

    return {
        ...room,
        aimSelect: true,
        canStand(x, z) {
            if (Math.abs(x) > 5.3 || Math.abs(z) > 7.5) return false;
            // Station platform obstacle
            const sx = (x + 3.1) / 0.72;
            const sz = (z + 1.2) / 0.72;
            if (Math.abs(sx) < 2.6 && sz > -3.85 && sz < 1.95) return false;
            // Asteroid mounds obstacles
            const ax = (x - 2.9) / 0.64;
            const az = (z + 0.7) / 0.64;
            if (!outposts.every(([ox, oz]) => Math.hypot(ax - ox, az - oz) > 1.5)) return false;
            return true;
        },
        enter() {
            active = true;
            previous = undefined;
            clock = Date.now();
            const loaded = loadGame(storage, clock);
            game = loaded.game;
            saveEnabled = loaded.saveEnabled;
            warning = loaded.warning ? " Existing save preserved." : "";
            saveAsteroid();
            showStation();
            showAsteroid();
        },
        leave() {
            tickAsteroid();
            saveAsteroid();
            active = false;
            previous = undefined;
        },
        update(now) {
            if (!active) return;
            const elapsed = previous === undefined ? 0 : Math.max(0, Math.min(100, now - previous));
            previous = now;
            const positions = crew.map(member => walk(station, member, elapsed));
            stModel.animate(station, crew, positions, now, elapsed);
            tickAsteroid();
            astModels.animate(now, game?.fleet ?? 0);
        },
        select(ray) {
            const stOrder = stModel.hit(ray);
            if (stOrder) {
                focusSide = "station";
                if (stOrder.kind === "type") {
                    stType = stOrder.type;
                    stMessage = `${stType} blueprint selected.`;
                } else if (stOrder.kind === "module") {
                    stSelection = stOrder.index;
                    stMessage = `Module ${stSelection + 1} selected.`;
                } else {
                    const result = connect(station, stSelection, stOrder.port, stType);
                    if (result.error) {
                        stMessage = result.error;
                    } else {
                        stSelection = result.target;
                        stMessage = result.built ? `${stType} attached through ${stOrder.port}.` : "Loop closed with a tube.";
                    }
                }
                showStation(true);
                return true;
            }
            const astOrder = astModels.hit(ray);
            if (astOrder && game) {
                focusSide = "asteroid";
                tickAsteroid();
                const remaining = game.farms[astOrder.index].plots[astOrder.plot];
                const command = astOrder.command === "plot" ? (remaining === null ? "plant" : "harvest") : astOrder.command;
                game.message = act(game, astOrder.index, command, astOrder.plot);
                saveAsteroid();
                showAsteroid(true);
                return true;
            }
            return false;
        },
        contextAt(lx) {
            playerX = lx;
            const side = lx <= 0 ? "station" : "asteroid";
            if (Math.abs(lx) > 0.6) focusSide = null;
            const activeSide = focusSide ?? side;
            if (activeSide === "asteroid") {
                return {
                    key: "asteroid",
                    hint: astSummary,
                    projectHref: "../../projects/games/asteroid-farmer/index.html",
                };
            }
            return {
                key: "station",
                hint: stSummary || "Station · Choose a module blueprint, select a room, then a glowing port to extend it.",
                projectHref: "../../projects/games/accumulative-station/index.html",
            };
        },
    };
}
