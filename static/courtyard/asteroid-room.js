import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { act, advance } from "../../projects/games/asteroid-farmer/game.mjs";
import { loadGame, saveGame } from "../../projects/games/asteroid-farmer/state.mjs";
import { galleryRoom } from "./gallery-room.js";
import { asteroidModels, outposts } from "./asteroid-models.js";

export function createAsteroidRoom(report = () => {}) {
    const scene = new T.Scene();
    scene.background = new T.Color(0x080f20);
    scene.add(new T.HemisphereLight(0xc5e5ff, 0x715a41, 2.5));
    const sun = new T.DirectionalLight(0xffe2ad, 3);
    sun.position.set(-3, 7, 4);
    scene.add(sun);
    const stars = new Float32Array(600);
    for (let index = 0; index < stars.length; index += 3) {
        const angle = index * 2.39996;
        const r = 3.2 + (index % 7) * 0.35;
        stars[index] = Math.sin(angle) * r;
        stars[index + 1] = 0.6 + (index % 17) * 0.24;
        stars[index + 2] = Math.cos(angle) * r - 0.5;
    }
    const sky = new T.BufferGeometry();
    sky.setAttribute("position", new T.BufferAttribute(stars, 3));
    scene.add(new T.Points(sky, new T.PointsMaterial({ color: 0xe5e4d9, size: 0.065 })));
    const models = asteroidModels(scene);
    const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
    let game;
    let saveEnabled;
    let clock;
    let active = false;
    let warning = "";
    const show = () => {
        models.draw(game);
        report("Asteroid Farmer · " + game.credits + " credits · " + game.fleet + " ships. " + game.message + warning);
    };
    const save = () => {
        if (!saveEnabled) return;
        try {
            saveGame(storage, game, clock);
        } catch (error) {
            saveEnabled = false;
            warning = " Saving unavailable: " + error.message;
        }
    };
    const tick = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - clock) / 1000);
        if (elapsed < 1) return;
        clock += elapsed * 1000;
        advance(game, elapsed, document.hidden || elapsed > 4);
        save();
        show();
    };
    const room = galleryRoom(scene, {
        enter() {
            clock = Date.now();
            const loaded = loadGame(storage, clock);
            game = loaded.game;
            saveEnabled = loaded.saveEnabled;
            warning = loaded.warning ? " Existing save preserved." : "";
            active = true;
            save();
            show();
        },
        leave() {
            tick();
            save();
            active = false;
        },
        update(now) {
            if (!active) return;
            tick();
            models.animate(now, game.fleet);
        },
        select(ray) {
            const order = models.hit(ray);
            if (!order) return false;
            tick();
            const remaining = game.farms[order.index].plots[order.plot];
            const command = order.command === "plot" ? remaining === null ? "plant" : "harvest" : order.command;
            game.message = act(game, order.index, command, order.plot);
            save();
            show();
            return true;
        },
    });
    room.surface.material.color.setHex(0x14243a);
    room.aimSelect = true;
    room.canStand = (x, z) => outposts.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > 1.48);
    return room;
}
