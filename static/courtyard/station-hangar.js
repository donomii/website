import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

export function stationHangar() {
    const scene = new T.Scene();
    scene.background = new T.Color(0x060d1b);
    scene.add(new T.HemisphereLight(0xd9eeff, 0x253e47, 2.6));
    const key = new T.DirectionalLight(0xffedd3, 3.1);
    key.position.set(-4, 6, 5);
    const fill = new T.DirectionalLight(0x8ecbf2, 1.5);
    fill.position.set(4, 3, -5);
    scene.add(key, fill);
    const steel = new T.MeshStandardMaterial({ color: 0x253c4e, metalness: 0.4, roughness: 0.6 });
    const trim = new T.MeshStandardMaterial({ color: 0x67c9de, emissive: 0x174350 });
    function box(w, h, d, x, y, z, material = steel) {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
    }
    const surface = new T.Mesh(new T.PlaneGeometry(12, 14).rotateX(-Math.PI / 2),
        new T.MeshStandardMaterial({ color: 0x101e2d, roughness: 0.6, metalness: 0.18 }));
    scene.add(surface);
    const grid = new T.GridHelper(12, 24, 0x46616d, 0x203642);
    grid.position.y = 0.006;
    scene.add(grid);
    for (const x of [-5.8, 5.8]) {
        box(0.25, 5.8, 14, x, 2.9, 0);
        for (const z of [-6.5, -2.2, 2.2, 6.5]) {
            box(0.38, 5.8, 0.38, x, 2.9, z);
            box(0.04, 3.5, 0.04, x - Math.sign(x) * 0.22, 2.2, z, trim);
        }
    }
    for (const z of [-6.5, 6.5]) box(11.8, 0.35, 0.4, 0, 5.7, z);
    box(11.8, 0.25, 14, 0, 5.9, 0);
    box(4.725, 5.8, 0.25, -3.3125, 2.9, 6.85);
    box(4.725, 5.8, 0.25, 3.3125, 2.9, 6.85);
    box(1.9, 2.8, 0.25, 0, 4.4, 6.85);
    box(4.7, 0.22, 4.6, 0, 0.11, -1.3);
    box(3.8, 0.15, 0.62, 0, 0.65, 1.4);
    for (const x of [-2.36, 2.36]) box(0.025, 0.025, 4.6, x, 0.23, -1.3, trim);
    const spaceMat = new T.MeshBasicMaterial({ color: 0x050b16, side: T.DoubleSide });
    function spacePanel(w, h, x, y, z, rx = 0, ry = 0) {
        const panel = new T.Mesh(new T.PlaneGeometry(w, h), spaceMat);
        panel.position.set(x, y, z);
        panel.rotation.set(rx, ry, 0);
        scene.add(panel);
    }
    // Deep-space viewport bay behind the hangar opening (clear of adjacent rooms).
    for (const side of [-1, 1]) spacePanel(6, 7, side * 5.9, 2.9, -9.5, 0, Math.PI / 2);
    spacePanel(11.8, 6, 0, 5.9, -9.5, Math.PI / 2, 0);
    spacePanel(11.8, 6, 0, -0.05, -9.5, Math.PI / 2, 0);
    for (const side of [-1, 1]) spacePanel(36, 36, side * 14, 2, -30.5, 0, Math.PI / 2);
    spacePanel(28, 36, 0, 20, -30.5, Math.PI / 2, 0);
    spacePanel(28, 36, 0, -16, -30.5, Math.PI / 2, 0);
    spacePanel(28, 36, 0, 2, -48.5, 0, 0);
    const points = [];
    for (let i = 0; i < 400; i++) {
        const angle = i * 2.39996;
        points.push(Math.cos(angle) * (4 + i % 9), -4 + i % 21, -14 - Math.abs(Math.sin(angle)) * 31);
    }
    const sky = new T.BufferGeometry();
    sky.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    scene.add(new T.Points(sky, new T.PointsMaterial({ color: 0xe1efff, size: 0.055 })));
    const planet = new T.Mesh(new T.SphereGeometry(10, 48, 24),
        new T.MeshStandardMaterial({ color: 0x296c95, roughness: 0.8 }));
    planet.position.set(3, -5, -34);
    scene.add(planet);
    const exit = box(1.7, 2.8, 0.04, 0, 1.4, 6.7,
        new T.MeshBasicMaterial({ color: 0xa9d2d2 }));
    exit.name = "Courtyard doorway";
    for (const x of [-0.93, 0.93]) {
        const jamb = new T.Mesh(new T.BoxGeometry(0.1, 3, 0.15), trim);
        jamb.position.set(x, 0.1, 0);
        exit.add(jamb);
    }
    const lintel = new T.Mesh(new T.BoxGeometry(1.96, 0.1, 0.15), trim);
    lintel.position.set(0, 1.6, 0);
    exit.add(lintel);
    return { scene, surface, exit, height: () => 0, spawnZ: 4.4, limitX: 5.3, limitZ: 6.5,
        canStand: (x, z) => Math.abs(x) <= 5.3 && Math.abs(z) <= 6.5 &&
            !(Math.abs(x) < 2.6 && z > -3.85 && z < 1.95) };
}
