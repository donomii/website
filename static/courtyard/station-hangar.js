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
    box(4.7, 0.22, 4.6, 0, 0.11, -1.3);
    box(3.8, 0.15, 0.62, 0, 0.65, 1.4);
    for (const x of [-2.36, 2.36]) box(0.025, 0.025, 4.6, x, 0.23, -1.3, trim);
    const points = [];
    for (let i = 0; i < 400; i++) {
        const angle = i * 2.39996;
        points.push(Math.cos(angle) * (17 + i % 11), 1 + i % 29, -9 - Math.abs(Math.sin(angle)) * 30);
    }
    const sky = new T.BufferGeometry();
    sky.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    scene.add(new T.Points(sky, new T.PointsMaterial({ color: 0xe1efff, size: 0.055 })));
    const planet = new T.Mesh(new T.SphereGeometry(12, 48, 24),
        new T.MeshStandardMaterial({ color: 0x296c95, roughness: 0.8 }));
    planet.position.set(9, -7, -34);
    scene.add(planet);
    const exit = box(1.7, 2.8, 0.04, 0, 1.4, 6.7,
        new T.MeshBasicMaterial({ color: 0xa9d2d2 }));
    exit.name = "Courtyard doorway";
    for (const x of [-0.93, 0.93]) box(0.1, 3, 0.15, x, 1.5, 6.7, trim);
    box(1.96, 0.1, 0.15, 0, 3, 6.7, trim);
    return { scene, surface, exit, height: () => 0, spawnZ: 4.4, limitX: 5.3, limitZ: 6.5,
        canStand: (x, z) => Math.abs(x) <= 5.3 && Math.abs(z) <= 6.5 &&
            !(Math.abs(x) < 2.6 && z > -3.85 && z < 1.95) };
}
