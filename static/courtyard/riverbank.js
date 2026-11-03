import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

export function createRiverbank() {
    const scene = new T.Scene();
    scene.background = new T.Color(0xe8c5a5);
    scene.fog = new T.FogExp2(0xe8c5a5, 0.024);
    scene.add(new T.HemisphereLight(0xffecd7, 0x647967, 2.4));
    const sun = new T.DirectionalLight(0xffcf91, 2.8);
    sun.position.set(-9, 8, -5);
    scene.add(sun);

    function height(x, z) {
        const river = x + 8 + 1.7 * Math.sin(z * 0.15);
        const channel = 1.1 * (1 - T.MathUtils.smoothstep(Math.abs(river), 3, 4.8));
        return 0.35 * Math.sin(x * 0.25) * Math.cos(z * 0.18) - channel;
    }

    const ground = new T.PlaneGeometry(56, 32, 112, 64).rotateX(-Math.PI / 2);
    const points = ground.attributes.position;
    const colors = [];
    const grass = new T.Color(0x687e44);
    const path = new T.Color(0xd3a87b);
    const color = new T.Color();
    for (let i = 0; i < points.count; i++) {
        const x = points.getX(i);
        const z = points.getZ(i);
        points.setY(i, height(x, z));
        color.copy(path).lerp(grass, T.MathUtils.smoothstep(Math.abs(x), 1.05, 1.6));
        colors.push(color.r, color.g, color.b);
    }
    ground.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    ground.computeVertexNormals();
    const surface = new T.Mesh(ground, new T.MeshStandardMaterial({ vertexColors: true }));
    scene.add(surface);

    const water = new T.Mesh(new T.PlaneGeometry(13, 120).rotateX(-Math.PI / 2),
        new T.MeshStandardMaterial({ color: 0x38797a, roughness: 0.32 }));
    water.position.set(-8, -0.43, 0);
    scene.add(water);

    const trunk = new T.CylinderGeometry(0.09, 0.13, 1.2, 7);
    const crown = new T.IcosahedronGeometry(0.85, 1);
    const bark = new T.MeshStandardMaterial({ color: 0x644631 });
    const leaves = new T.MeshStandardMaterial({ color: 0x355236 });
    for (const [x, z] of [[-2.7, 3], [2.4, -1], [-3, -5], [3.3, -9], [4, -14],
        [-15, 2], [-16, -4], [-15, -10], [9, -7], [13, -13], [7, 4]]) {
        const y = height(x, z);
        const stem = new T.Mesh(trunk, bark);
        const top = new T.Mesh(crown, leaves);
        stem.position.set(x, y + 0.6, z);
        top.position.set(x, y + 1.85, z);
        top.scale.set(0.7, 2.2, 0.7);
        scene.add(stem, top);
    }

    const exit = new T.Mesh(new T.TorusGeometry(1, 0.12, 10, 40),
        new T.MeshStandardMaterial({ color: 0xf4bb73, emissive: 0x7a3411 }));
    exit.position.set(0, height(0, 12) + 1.1, 12);
    scene.add(exit);
    return { scene, surface, exit, height };
}

