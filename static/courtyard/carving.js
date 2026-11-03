import * as T from "three";

const cells = 15;
const side = 1.5;
const size = side / cells;
const half = side / 2;
const radius = 0.42;
const tube = 0.19;

function torusDistance(x, y, z) {
    return Math.hypot(Math.hypot(x, y) - radius, z) - tube;
}

function trace(origin, direction) {
    const limit = side + size;
    let travel = 0;
    for (let step = 0; step < 96 && travel < limit; step++) {
        const distance = torusDistance(
            origin.x + direction.x * travel,
            origin.y + direction.y * travel,
            origin.z + direction.z * travel,
        );
        if (distance < 0.001) return travel;
        travel += distance;
    }
    return limit;
}

export function createCarving(scene, x, z) {
    const exhibit = new T.Group();
    exhibit.position.set(x, 1.57, z);
    scene.add(exhibit);

    const block = new T.InstancedMesh(new T.BoxGeometry(size * 0.97, size * 0.97, size * 0.97),
        new T.MeshStandardMaterial({ roughness: 0.93 }), cells ** 3);
    block.instanceMatrix.setUsage(T.DynamicDrawUsage);
    exhibit.add(block);
    const base = new T.Mesh(new T.BoxGeometry(1.8, 0.8, 1.8),
        new T.MeshStandardMaterial({ color: 0x967053, roughness: 0.95 }));
    base.position.y = -1.17;
    exhibit.add(base);

    const beamGeometry = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
    const beamPositions = beamGeometry.attributes.position;
    const beam = new T.Line(beamGeometry, new T.LineBasicMaterial({ color: 0xffd878, depthTest: false }));
    beam.frustumCulled = false;
    beam.visible = false;
    exhibit.add(beam);

    const colors = new T.Color();
    const matrix = new T.Matrix4();
    const hidden = new T.Matrix4().makeScale(0, 0, 0);
    const origin = new T.Vector3();
    const direction = new T.Vector3();
    const faces = [[2, 1], [2, -1], [0, 1], [0, -1], [1, 1], [1, -1]];
    const rayCount = faces.length * cells ** 2;
    const indexOf = (x, y, z) => x + cells * (y + cells * z);
    const center = index => (index + 0.5) * size - half;
    let nextRay = 0;
    let removed = 0;
    let active = false;

    function reset() {
        for (let z = 0; z < cells; z++) {
            for (let y = 0; y < cells; y++) {
                for (let x = 0; x < cells; x++) {
                    const index = indexOf(x, y, z);
                    block.setMatrixAt(index, matrix.makeTranslation(center(x), center(y), center(z)));
                    block.setColorAt(index, colors.setHex(0xd2a276).multiplyScalar(0.83 + (index % 11) * 0.025));
                }
            }
        }
        block.instanceMatrix.needsUpdate = true;
        block.instanceColor.needsUpdate = true;
        nextRay = 0;
        removed = 0;
        beam.visible = false;
    }

    function fire(index) {
        const [axis, sign] = faces[Math.floor(index / (cells ** 2))];
        const row = Math.floor(index / cells) % cells;
        const column = index % cells;
        const a = (axis + 1) % 3;
        const b = (axis + 2) % 3;
        origin.setComponent(axis, sign * (half + size));
        origin.setComponent(a, center(column));
        origin.setComponent(b, center(row));
        direction.set(0, 0, 0).setComponent(axis, -sign);
        const stop = trace(origin, direction);
        const voxel = [0, 0, 0];
        voxel[a] = column;
        voxel[b] = row;
        for (let depth = 0; depth < cells && (depth + 1.5) * size < stop; depth++) {
            voxel[axis] = sign > 0 ? cells - depth - 1 : depth;
            const cell = indexOf(...voxel);
            block.getMatrixAt(cell, matrix);
            if (matrix.elements[0] !== 0) {
                block.setMatrixAt(cell, hidden);
                removed++;
            }
        }
        const endpoint = origin.clone().addScaledVector(direction, stop);
        beamPositions.setXYZ(0, origin.x, origin.y, origin.z);
        beamPositions.setXYZ(1, endpoint.x, endpoint.y, endpoint.z);
        beamPositions.needsUpdate = true;
        beam.visible = true;
    }

    reset();
    return {
        start() {
            reset();
            active = true;
        },
        update() {
            if (active) {
                for (let batch = 0; batch < 5 && nextRay < rayCount; batch++) fire(nextRay++);
                block.instanceMatrix.needsUpdate = true;
                active = nextRay < rayCount;
                beam.visible = active;
            }
            return { active, nextRay, rayCount, removed };
        },
    };
}
