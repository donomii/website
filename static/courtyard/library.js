import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { createDatatreeRoom } from "./datatree.js";

export function createLibrary() {
    const scene = new T.Scene();
    scene.background = new T.Color(0x261c19);
    scene.add(new T.HemisphereLight(0xffe4bf, 0x7b5b60, 2.2));
    const light = new T.DirectionalLight(0xffd7a8, 2.4);
    light.position.set(-3, 9, 6);
    scene.add(light);

    const finish = color => new T.MeshStandardMaterial({ color });
    const plaster = finish(0xab6547);
    const stone = finish(0xc7a984);
    const wood = finish(0x633924);
    const carpet = finish(0x8e4332);
    const bookColors = [0x953d31, 0x575e3e, 0x324f61, 0xb38a4b, 0x70516b].map(finish);
    function box(w, h, d, x, y, z, material) {
        const object = new T.Mesh(new T.BoxGeometry(w, h, d), material);
        object.position.set(x, y, z);
        scene.add(object);
        return object;
    }

    const surface = box(11.6, 0.2, 18, 0, -0.1, 0, stone);
    box(2.5, 0.015, 14.5, 0, 0, 1.2, carpet);
    for (const x of [-5.8, 5.8]) {
        box(0.3, 5, 18, x, 2.5, 0, plaster);
        const shelfX = x - Math.sign(x) * 0.72;
        for (const z of [-2.0, 2.0, 5.8]) {
            box(0.2, 3, 3.2, x - Math.sign(x) * 0.22, 1.5, z, wood);
            for (const y of [0.45, 1.15, 1.85, 2.55]) {
                box(0.95, 0.09, 3.2, shelfX, y, z, wood);
                for (let book = 0; book < 9; book++) {
                    const h = 0.29 + 0.06 * ((book + Math.round(y * 10)) % 5);
                    box(0.63, h, 0.22, shelfX, y + 0.045 + h / 2, z - 1.32 + book * 0.32,
                        bookColors[(book + z + 10) % bookColors.length]);
                }
            }
        }
    }
    box(11.6, 0.25, 18, 0, 5.1, 0, wood);
    box(11.6, 5, 0.3, 0, 2.5, -9, plaster);
    box(4.5, 5, 0.3, -3.55, 2.5, 9, plaster);
    box(4.5, 5, 0.3, 3.55, 2.5, 9, plaster);
    box(2.6, 1.7, 0.3, 0, 4.15, 9, plaster);
    for (const z of [-6, -2, 2, 6]) box(11.6, 0.25, 0.26, 0, 4.65, z, wood);
    for (const x of [-2.0, 2.0]) {
        box(1.35, 0.13, 3.8, x, 0.98, 1.2, wood);
        for (const z of [-0.2, 2.6]) box(0.78, 0.91, 0.24, x, 0.455, z, wood);
    }

    // Mount Datatree interactive archive at the north reading wall alcove.
    const datatree = createDatatreeRoom();
    const archiveBay = new T.Group();
    archiveBay.position.set(0, 0, -5.2);
    scene.add(archiveBay);
    for (const child of [...datatree.scene.children]) {
        if (child.isLight || child === datatree.exit || child === datatree.surface || child.userData?.baySkip) continue;
        archiveBay.add(child);
    }

    const exit = new T.Mesh(new T.TorusGeometry(1, 0.12, 10, 40),
        new T.MeshStandardMaterial({ color: 0xf4bb73, emissive: 0x7a3411 }));
    exit.position.set(0, 1.1, 8.2);
    scene.add(exit);

    const canStand = (x, z) => Math.abs(x) <= 4.15 && Math.abs(z) <= 8.5 && z >= -6.6 &&
        !(Math.abs(Math.abs(x) - 2.0) < 0.95 && Math.abs(z - 1.2) < 2.15);

    return {
        scene,
        surface,
        exit,
        canStand,
        height: () => 0,
        limitX: 5.35,
        limitZ: 8.6,
        select(ray) {
            return datatree.select?.(ray) ?? false;
        },
        contextAt(_lx, lz) {
            if (lz < -1.6) {
                return {
                    key: "datatree",
                    hint: "Library & Archive · Select Datatree branches and leaves on the reading hall wall.",
                    projectHref: "/projects/datatree/index.html",
                };
            }
            return {
                key: "library",
                hint: "Library · Browse the reading hall shelves or explore the Datatree archive ahead.",
                projectHref: null,
            };
        },
    };
}
