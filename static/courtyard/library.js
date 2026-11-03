import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

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
    const surface = box(14, 0.2, 26, 0, -0.1, 0, stone);
    box(2.8, 0.015, 23, 0, 0, 0, carpet);
    for (const x of [-7, 7]) {
        box(0.3, 5, 26, x, 2.5, 0, plaster);
        const shelfX = x * 0.84;
        for (const z of [-9, -5, -1, 3, 7]) {
            box(0.2, 3, 3.2, x * 0.9, 1.5, z, wood);
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
    for (const z of [-13, 13]) box(14, 5, 0.3, 0, 2.5, z, plaster);
    for (const z of [-10, -6, -2, 2, 6, 10]) box(14, 0.25, 0.26, 0, 4.65, z, wood);
    for (const x of [-2.8, 2.8]) {
        box(1.5, 0.13, 4.8, x, 0.98, -5, wood);
        for (const z of [-6.8, -3.2]) box(0.85, 0.91, 0.24, x, 0.455, z, wood);
    }

    const exit = new T.Mesh(new T.TorusGeometry(1, 0.12, 10, 40),
        new T.MeshStandardMaterial({ color: 0xf4bb73, emissive: 0x7a3411 }));
    exit.position.set(0, 1.1, 12);
    scene.add(exit);
    return { scene, surface, exit, height: () => 0, limitX: 6.55, limitZ: 12.65 };
}

