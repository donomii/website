import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { createDecoArchitecture } from "./art-deco-architecture.js?v=20261112";

export function createArtDecoRoom() {
    const scene = new T.Scene();
    scene.background = new T.Color(0x101b20);
    const ambient = new T.HemisphereLight(0xffe9c4, 0x193c3a, 2.3);
    scene.add(ambient);
    const warm = new T.DirectionalLight(0xffe4b1, 3.1);
    warm.position.set(-3, 5.8, 5);
    const fill = new T.DirectionalLight(0xb9d9d5, 1.4);
    fill.position.set(4, 4, -6);
    scene.add(warm, fill);
    const room = createDecoArchitecture(scene);
    return {
        scene,
        surface: room.surface,
        exit: room.exit,
        canStand: room.canStand,
        aimSelect: true,
        height: () => 0,
        spawnZ: 5.1,
        limitX: 5.35,
        limitZ: 7.5,
        select: room.select,
        contextAt(lx, lz) {
            if (lx > 1.2 && Math.abs(lz) < 2.8) {
                return { key: "deco-panel", hint: room.panelSummary(), projectHref: null };
            }
            return null;
        },
        update(now) { room.sculpture.rotation.y = now / 18000; },
    };
}
