import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { islands, seedPrice } from "../../projects/games/asteroid-farmer/game.mjs";

export const outposts = [[0, 0], [-2.7, -2.6], [2.7, -2.6]];

function mesh(parent, geometry, color, x, y, z) {
    const object = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.8 }));
    object.position.set(x, y, z);
    parent.add(object);
    return object;
}

function label(parent, width, x, y, z) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const object = new T.Mesh(new T.PlaneGeometry(width, width * 160 / 768), new T.MeshBasicMaterial({ map, side: T.DoubleSide }));
    object.position.set(x, y, z);
    parent.add(object);
    let previous;
    return { object, draw(text) {
        if (text === previous) return;
        previous = text;
        context.fillStyle = "#11202e";
        context.fillRect(0, 0, 768, 160);
        context.fillStyle = "#f4e6c7";
        context.font = "bold 54px system-ui";
        context.textAlign = "center";
        context.fillText(text, 384, 100, 730);
        map.needsUpdate = true;
        object.name = text;
    } };
}

export function asteroidModels(scene) {
    const targets = [];
    const farms = outposts.map(([x, z], index) => {
        const group = new T.Group();
        group.position.set(x, 0, z);
        scene.add(group);
        mesh(group, new T.CylinderGeometry(1.25, 0.48, 0.8, 9), 0x65594f, 0, 0.72, 0);
        const name = label(group, 2, 0, 2.6, -0.65);
        name.draw(islands[index].name);
        const commandTarget = (object, command, plot) => {
            object.userData.order = { index, command, plot };
            targets.push(object);
        };
        const plots = Array.from({ length: islands[index].soil }, (_, plot) => {
            const px = (plot - (islands[index].soil - 1) / 2) * 0.66;
            const soil = mesh(group, new T.BoxGeometry(0.55, 0.1, 0.6), 0x493726, px, 1.16, 0.2);
            const crop = mesh(group, new T.ConeGeometry(0.19, 0.55, 6), 0x76bc65, px, 1.45, 0.2);
            const title = label(group, 0.62, px, 1.23, 0.56);
            for (const object of [soil, crop, title.object]) commandTarget(object, "plot", plot);
            return { soil, crop, title };
        });
        const depot = mesh(group, new T.BoxGeometry(0.4, 0.45, 0.4), 0x6db5c3, -0.7, 1.4, -0.6);
        const turret = mesh(group, new T.CylinderGeometry(0.12, 0.24, 0.5, 8), 0xe1b65b, 0, 1.42, -0.65);
        const barrel = mesh(turret, new T.BoxGeometry(0.1, 0.1, 0.48), 0xe1b65b, 0, 0.18, 0.16);
        const ship = mesh(group, new T.ConeGeometry(0.21, 0.55, 4).rotateX(Math.PI / 2), 0x99ccea, 0.7, 1.45, -0.6);
        const builds = [depot, turret, ship].map((object, slot) => {
            const command = ["depot", "turret", "fleet"][slot];
            commandTarget(object, command);
            if (command === "turret") commandTarget(barrel, command);
            const title = label(group, 0.75, (slot - 1) * 0.76, 1.9, -0.65);
            commandTarget(title.object, command);
            return { object, title };
        });
        const claim = mesh(group, new T.TorusGeometry(0.44, 0.085, 8, 24), index === 1 ? 0x78d6c2 : 0xff7766, 0, 1.7, 0.45);
        const claimTitle = label(group, 1.7, 0, 2.15, 0.45);
        for (const object of [claim, claimTitle.object]) commandTarget(object, index === 1 ? "colony" : "attack");
        return { group, plots, builds, claim, claimTitle };
    });
    const fleet = Array.from({ length: 12 }, () => mesh(scene,
        new T.ConeGeometry(0.09, 0.3, 4).rotateX(Math.PI / 2), 0xa6d9ec, 0, 0, 0));
    const board = label(scene, 3.4, -3.5, 2.7, 0);
    const result = label(scene, 3.4, -3.5, 2.15, 0);
    const instructions = label(scene, 3.4, -3.5, 1.6, 0);
    for (const sign of [board, result, instructions]) sign.object.rotation.y = Math.PI / 3;
    instructions.draw("Soil: plant / harvest · Blueprints: build");
    return {
        targets,
        draw(game) {
            for (const [index, view] of farms.entries()) {
                const farm = game.farms[index];
                for (const [plot, value] of farm.plots.entries()) {
                    const { soil, crop, title } = view.plots[plot];
                    soil.visible = title.object.visible = farm.owner;
                    crop.visible = farm.owner && value !== null;
                    crop.scale.y = value === null ? 1 : 0.35 + (12 - value) / 12 * 0.65;
                    crop.position.y = 1.21 + 0.275 * crop.scale.y;
                    crop.material.color.setHex(value === 0 ? 0xefcd59 : 0x76bc65);
                    title.draw(value === null ? seedPrice(game) ? "Plant · 1 cr" : "Free seed" : value === 0 ? "Harvest +4" : value + "s");
                }
                for (const [slot, build] of view.builds.entries()) {
                    build.object.visible = build.title.object.visible = farm.owner;
                    build.object.material.transparent = true;
                    build.object.material.opacity = slot === 0 && farm.depot || slot === 1 && farm.turret > 0 ? 1 : 0.48;
                    build.title.draw(slot === 0 ? farm.depot ? "Depot active" : "Depot · 7 cr" :
                        slot === 1 ? "Turret " + farm.turret + "/3 · 5 cr" : "Ship · 4 cr");
                }
                view.claim.visible = view.claimTitle.object.visible = !farm.owner;
                view.claimTitle.draw(index === 1 ? "Settle · 8 cr" : "Raid · " + game.rivalHull + " hull");
            }
            board.draw(game.credits + " credits · " + game.fleet + " ships · " +
                (game.rivalHull ? "Raid in " + game.raidIn + "s" : "Archipelago secured"));
            result.draw(game.message);
        },
        animate(time, count) {
            fleet.forEach((ship, index) => {
                ship.visible = index < count;
                const angle = time / 3000 + index * 2.4;
                ship.position.set(Math.sin(angle) * 1.65, 2.15 + Math.sin(angle * 2) * 0.1, Math.cos(angle) * 1.5);
                ship.rotation.y = angle + Math.PI / 2;
            });
        },
        hit(ray) {
            scene.updateMatrixWorld(true);
            return ray.intersectObjects(targets, false).find(hit => {
                for (let object = hit.object; object; object = object.parent) {
                    if (!object.visible) return false;
                }
                return true;
            })?.object.userData.order;
        },
    };
}
