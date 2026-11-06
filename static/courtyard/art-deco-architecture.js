import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

function batches(scene) {
    const groups = new Map();
    const cube = new T.BoxGeometry(1, 1, 1);
    const matrix = new T.Matrix4();
    const rotation = new T.Quaternion();
    const up = new T.Vector3(0, 1, 0);
    function put(material, position, size, quaternion = new T.Quaternion()) {
        const list = groups.get(material) ?? [];
        matrix.compose(position, quaternion, size);
        list.push(matrix.clone());
        groups.set(material, list);
    }
    return {
        box(material, w, h, d, x, y, z) {
            put(material, new T.Vector3(x, y, z), new T.Vector3(w, h, d));
        },
        bar(material, from, to, width = 0.035) {
            const direction = to.clone().sub(from);
            rotation.setFromUnitVectors(up, direction.clone().normalize());
            put(material, from.clone().add(to).multiplyScalar(0.5),
                new T.Vector3(width, direction.length(), width), rotation);
        },
        finish() {
            for (const [material, transforms] of groups) {
                const mesh = new T.InstancedMesh(cube, material, transforms.length);
                transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
                mesh.name = "Deco architecture · " + material.name;
                mesh.computeBoundingSphere();
                scene.add(mesh);
            }
        },
    };
}

export function createDecoArchitecture(scene) {
    const material = (name, color, metalness, roughness, emissive = 0x000000) => {
        const value = new T.MeshStandardMaterial({ color, metalness, roughness, emissive });
        value.name = name;
        return value;
    };
    const gold = material("brushed brass", 0xc8a55e, 0.64, 0.3);
    const ivory = material("ivory stone", 0xe0d6bd, 0.08, 0.35);
    const black = material("black onyx", 0x151d21, 0.22, 0.27);
    const green = material("emerald lacquer", 0x164744, 0.22, 0.38);
    const velvet = material("peacock velvet", 0x235658, 0.02, 0.86);
    const glass = material("warm opal glass", 0xffe6b4, 0.04, 0.4, 0x71552b);
    const b = batches(scene);
    function object(geometry, finish, x, y, z) {
        const mesh = new T.Mesh(geometry, finish);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
    }
    function fan(x, y, z, radius, turn = 0) {
        const point = (r, angle) => new T.Vector3(x + Math.cos(angle) * r * Math.cos(turn),
            y + Math.sin(angle) * r, z - Math.cos(angle) * r * Math.sin(turn));
        for (let ray = 0; ray <= 16; ray++) {
            const angle = ray * Math.PI / 16;
            b.bar(gold, point(radius * 0.22, angle), point(radius * (ray % 2 ? 0.87 : 1), angle), 0.035);
        }
        for (const r of [radius * 0.22, radius * 0.92, radius]) {
            const arc = object(new T.TorusGeometry(r, 0.018, 5, 48, Math.PI), gold, x, y, z);
            arc.rotation.y = turn;
        }
    }
    const surface = object(new T.PlaneGeometry(12, 16).rotateX(-Math.PI / 2), black, 0, 0, 0);
    surface.name = "Deco salon floor";
    const tileGeometry = new T.BoxGeometry(0.49, 0.012, 0.49);
    for (let parity = 0; parity < 2; parity++) {
        const tiles = new T.InstancedMesh(tileGeometry, parity ? ivory : black, 384);
        const matrix = new T.Matrix4();
        let count = 0;
        for (let x = 0; x < 24; x++) {
            for (let z = 0; z < 32; z++) {
                if ((x + z) % 2 !== parity) continue;
                matrix.makeTranslation(-5.75 + x * 0.5, -0.001, -7.75 + z * 0.5);
                tiles.setMatrixAt(count++, matrix);
            }
        }
        tiles.name = "Deco checkerboard";
        tiles.computeBoundingSphere();
        scene.add(tiles);
    }
    b.box(black, 3.5, 0.012, 15.6, 0, 0.01, 0);
    for (const x of [-1.76, 1.76, -5.65, 5.65]) b.box(gold, 0.035, 0.015, 15.3, x, 0.018, 0);
    for (const z of [-7.65, 7.65]) b.box(gold, 11.3, 0.015, 0.035, 0, 0.018, z);
    for (const x of [-6.1, 6.1]) b.box(green, 0.2, 6.5, 16.2, x, 3.25, 0);
    b.box(green, 12.2, 6.5, 0.2, 0, 3.25, -8.1);
    for (const x of [-3.57, 3.57]) b.box(green, 5.05, 6.5, 0.2, x, 3.25, 8.1);
    b.box(green, 2.1, 3.2, 0.2, 0, 4.9, 8.1);
    b.box(black, 12.2, 0.2, 16.2, 0, 6.6, 0);
    for (const height of [0.18, 1.15, 5.5, 5.72, 6.3]) {
        for (const x of [-5.97, 5.97]) b.box(gold, 0.045, 0.035, 16, x, height, 0);
        for (const z of [-7.97, 7.97]) b.box(gold, 12, 0.035, 0.045, 0, height, z);
    }
    for (const x of [-5.72, 5.72]) {
        for (const z of [-6.4, -2.2, 2.2, 6.4]) {
            b.box(black, 0.52, 4.6, 0.6, x, 2.3, z);
            for (const offset of [-0.18, -0.09, 0, 0.09, 0.18]) {
                b.box(gold, 0.035, 4.1, 0.04, x + offset, 2.3, z + 0.32);
            }
            for (let tier = 0; tier < 3; tier++) {
                b.box(ivory, 0.62 + tier * 0.16, 0.16, 0.76 + tier * 0.12, x, 4.62 + tier * 0.18, z);
            }
        }
    }
    for (const side of [-1, 1]) {
        const x = side * 5.94;
        for (const z of [-4.3, 0, 4.3]) {
            b.box(black, 0.035, 3.55, 2.8, x, 3.1, z);
            for (const edge of [-1.42, 1.42]) b.box(gold, 0.06, 3.6, 0.035, x - side * 0.03, 3.1, z + edge);
            for (const y of [1.3, 4.9]) b.box(gold, 0.06, 0.035, 2.86, x - side * 0.03, y, z);
            fan(x - side * 0.06, 2.35, z, 1.18, Math.PI / 2);
            for (const offset of [-0.22, 0, 0.22]) b.box(gold, 0.05, 0.75, 0.025, x - side * 0.06, 1.94, z + offset);
        }
        b.box(black, 1.48, 0.24, 3.15, side * 4.1, 0.38, 2.5);
        b.box(velvet, 1.42, 0.3, 2.95, side * 4.1, 0.64, 2.5);
        b.box(velvet, 0.24, 0.85, 3.05, side * 4.72, 0.98, 2.5);
        for (const z of [0.95, 4.05]) b.box(gold, 1.5, 0.1, 0.12, side * 4.1, 0.93, z);
    }
    for (let tier = 0; tier < 4; tier++) {
        const w = 5.2 - tier * 0.45;
        const h = 5.0 - tier * 0.35;
        b.box(tier % 2 ? black : gold, w, h, 0.1, 0, 2.9, -7.92 + tier * 0.055);
    }
    fan(0, 2.45, -7.64, 2.0);
    object(new T.CylinderGeometry(0.55, 0.55, 0.06, 48).rotateX(Math.PI / 2), gold, 0, 2.45, -7.58);
    for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) b.box(gold, 0.035, 1.45, 0.06, x, 1.7, -7.59);
    for (const z of [-6.2, -2, 2.2, 6.2]) {
        b.box(gold, 3.6, 0.12, 0.45, 0, 6.05, z);
        for (const x of [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25]) {
            b.box(glass, 0.22, 0.48 + (1.25 - Math.abs(x)) * 0.32, 0.25, x, 5.72, z);
        }
    }
    const centerZ = -1.6;
    for (let tier = 0; tier < 3; tier++) {
        object(new T.CylinderGeometry(1 - tier * 0.16, 1 - tier * 0.16, 0.16, 8),
            tier === 1 ? gold : black, 0, 0.08 + tier * 0.16, centerZ);
    }
    object(new T.CylinderGeometry(0.35, 0.48, 0.7, 8), ivory, 0, 0.8, centerZ);
    const sculpture = new T.Group();
    sculpture.name = "Brass armillary";
    sculpture.position.set(0, 2.0, centerZ);
    scene.add(sculpture);
    for (let index = 0; index < 3; index++) {
        const ring = new T.Mesh(new T.TorusGeometry(0.75 + index * 0.1, 0.025, 8, 64), gold);
        ring.rotation.set(index * Math.PI / 3, index * Math.PI / 4, index * Math.PI / 5);
        sculpture.add(ring);
    }
    const core = new T.Mesh(new T.OctahedronGeometry(0.37), gold);
    sculpture.add(core);
    for (const side of [-1, 1]) {
        for (const z of [-5.4, 5.9]) {
            const x = side * 4.7;
            object(new T.CylinderGeometry(0.32, 0.23, 0.55, 8), black, x, 0.275, z);
            object(new T.TorusGeometry(0.32, 0.02, 5, 8).rotateX(Math.PI / 2), gold, x, 0.55, z);
            object(new T.CylinderGeometry(0.035, 0.06, 1.4, 7), gold, x, 1.25, z);
            const leaves = new T.InstancedMesh(new T.SphereGeometry(1, 8, 4), green, 9);
            const matrix = new T.Matrix4();
            for (let leaf = 0; leaf < 9; leaf++) {
                const angle = leaf * Math.PI * 2 / 9;
                const position = new T.Vector3(x + Math.sin(angle) * 0.32, 1.88, z + Math.cos(angle) * 0.32);
                const rotation = new T.Quaternion().setFromEuler(new T.Euler(0.8, angle, 0));
                matrix.compose(position, rotation, new T.Vector3(0.12, 0.6, 0.035));
                leaves.setMatrixAt(leaf, matrix);
            }
            scene.add(leaves);
        }
    }
    for (const x of [-1.13, 1.13]) {
        b.box(gold, 0.15, 3.3, 0.16, x, 1.65, 7.9);
        b.box(ivory, 0.08, 3.25, 0.2, x + Math.sign(x) * 0.15, 1.625, 7.9);
    }
    b.box(gold, 2.4, 0.15, 0.18, 0, 3.28, 7.9);
    const exit = object(new T.PlaneGeometry(2.1, 3.2), new T.MeshBasicMaterial({ color: 0xafd0ce, side: T.DoubleSide }), 0, 1.6, 7.99);
    exit.name = "Courtyard doorway";
    b.finish();
    const canStand = (x, z) => Math.abs(x) <= 5.35 && Math.abs(z) <= 7.5 &&
        Math.hypot(x, z - centerZ) > 1.22 &&
        !(Math.abs(Math.abs(x) - 4.1) < 1.0 && Math.abs(z - 2.5) < 1.85) &&
        ![-1, 1].some(side => [-5.4, 5.9].some(pz => Math.hypot(x - side * 4.7, z - pz) < 0.58));
    return { surface, exit, sculpture, canStand };
}
