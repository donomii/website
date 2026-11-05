import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

function plaque(label, action) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 132;
    const context = canvas.getContext("2d");
    context.fillStyle = "#392922";
    context.fillRect(0, 0, 512, 132);
    context.strokeStyle = "#dbba85";
    context.lineWidth = 6;
    context.strokeRect(9, 9, 494, 114);
    context.font = "44px system-ui";
    context.textAlign = "center";
    context.fillStyle = "#ffedcb";
    context.fillText(label, 256, 82, 475);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(1.65, 0.43),
        new T.MeshBasicMaterial({ map, side: T.DoubleSide }));
    mesh.userData.action = action;
    return mesh;
}

export function galleryRoom(scene, { select, actions = [], actionLift = 0, update, enter, leave } = {}) {
    const surface = new T.Mesh(new T.PlaneGeometry(12, 14).rotateX(-Math.PI / 2),
        new T.MeshBasicMaterial({ color: 0x534238 }));
    surface.position.y = -0.02;
    const exit = plaque("Return", null);
    exit.position.set(0, 1.35, 5.9);
    scene.add(surface, exit);
    const targets = actions.map(([label, action], index) => {
        const target = plaque(label, action);
        target.position.set(index % 2 === 0 ? -2.5 : 2.5, 1.45 + actionLift - Math.floor(index / 2) * 0.52, -0.6);
        scene.add(target);
        return target;
    });
    return {
        scene, surface, exit, update, enter, leave, height: () => 0,
        spawnZ: 3.6, limitX: 5.6, limitZ: 6.6,
        select(ray) {
            const hit = ray.intersectObjects(targets)[0];
            if (hit) {
                hit.object.userData.action();
                return true;
            } else {
                return select?.(ray) ?? false;
            }
        },
    };
}

export async function exhibitDocument(path) {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw new Error(`Could not load exhibit controls (${response.status}).`);
    return new DOMParser().parseFromString(await response.text(), "text/html");
}
