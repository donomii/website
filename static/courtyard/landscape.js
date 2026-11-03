import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

export function createLandscape(map, [ridgeX, ridgeZ, rise]) {
    const scene = new T.Scene();
    scene.background = new T.Color(0x9fc6d8);
    scene.fog = new T.FogExp2(0x9fc6d8, 0.018);
    scene.add(new T.HemisphereLight(0xf9ead0, 0x557a85, 2.7));
    const light = new T.DirectionalLight(0xffdfaf, 2.6);
    light.position.set(-20, 16, 4);
    scene.add(light);

    function height(x, z) {
        const waves = 0.38 * Math.sin(x * 0.26) * Math.cos(z * 0.23);
        const ridge = rise * Math.exp(-((x - ridgeX) ** 2 / 64 + (z - ridgeZ) ** 2 / 21));
        return waves + ridge;
    }

    const ground = new T.PlaneGeometry(56, 32, 112, 64);
    ground.rotateX(-Math.PI / 2);
    const points = ground.attributes.position;
    for (let i = 0; i < points.count; i++) {
        points.setY(i, height(points.getX(i), points.getZ(i)));
    }
    ground.computeVertexNormals();
    const surface = new T.Mesh(ground, new T.MeshStandardMaterial({ map, roughness: 1 }));
    scene.add(surface);

    const water = new T.Mesh(new T.PlaneGeometry(190, 190), new T.MeshStandardMaterial({ color: 0x4e899c }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.48;
    scene.add(water);

    const exit = new T.Mesh(new T.TorusGeometry(1, 0.1, 9, 38),
        new T.MeshStandardMaterial({ color: 0xf4bb73, emissive: 0x7a3411, side: T.DoubleSide }));
    exit.position.set(0, height(0, 12) + 1.05, 12);
    scene.add(exit);
    return { scene, surface, exit, height };
}
