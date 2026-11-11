import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { exhibitDocument, galleryRoom } from "./gallery-room.js?v=20261111";

const viewport = document.querySelector("#viewport");
const standalone = document.querySelector("#solid-status") !== null;
const status = document.querySelector("#solid-status") ?? document.createTextNode("");
const rule = document.querySelector("#rule") ?? document.createElement("textarea");
const depth = document.querySelector("#depth") ?? document.createElement("input");
const scene = new T.Scene();
scene.background = new T.Color(0x29211d);
const camera = new T.PerspectiveCamera(45, 1, 0.05, 30);
scene.add(new T.HemisphereLight(0xffdfb1, 0x917563, 2.4));
const sun = new T.DirectionalLight(0xffd3a0, 2.5);
sun.position.set(3, 5, 2);
scene.add(sun);
const turntable = new T.Mesh(new T.CylinderGeometry(1.25, 1.35, 0.16, 44),
    new T.MeshStandardMaterial({ color: 0x8b624a }));
turntable.position.y = -0.085;
scene.add(turntable);
const finish = new T.MeshStandardMaterial({ color: 0xc1844c, roughness: 0.78 });
const object = new T.Mesh(new T.BufferGeometry(), finish);
scene.add(object);

const yAxis = new T.Vector3(0, 1, 0);
const axes = {
    Y: new T.Vector3(0, 0, 1), y: new T.Vector3(0, 0, -1),
    P: new T.Vector3(1, 0, 0), p: new T.Vector3(-1, 0, 0),
    R: yAxis, r: new T.Vector3(0, -1, 0),
};

function branches(text, generations) {
    if (text.length > 12000) throw new Error("The rule text exceeds 12,000 characters.");
    const tokens = text.trim().split(/\s+/);
    let balance = 0;
    for (const token of tokens) {
        if (!["F", "X", "[", "]", "s", ...Object.keys(axes)].includes(token)) throw new Error(`Unknown token: ${token}`);
        if (token === "[") balance++;
        if (token === "]" && --balance < 0) throw new Error("A closing bracket has no matching opening bracket.");
    }
    if (balance !== 0) throw new Error("Close every opened bracket.");
    let commands = ["X"];
    for (let i = 0; i < generations; i++) {
        const expandedCount = commands.reduce((count, token) => count + (token === "X" ? tokens.length : 1), 0);
        if (expandedCount > 5000) throw new Error("The expanded rule exceeds 5,000 commands.");
        commands = commands.flatMap(token => token === "X" ? tokens : [token]);
    }
    const result = [];
    const stack = [];
    let point = new T.Vector3();
    let direction = new T.Quaternion();
    let scale = 1;
    const rotation = new T.Quaternion();
    for (const token of commands) {
        if (token === "F" || token === "X") {
            const end = point.clone().addScaledVector(yAxis.clone().applyQuaternion(direction), scale * 0.7);
            if (scale >= 0.04) result.push({ start: point, end, radius: 0.13 * scale });
            point = end;
        } else if (token === "[") {
            stack.push({ point: point.clone(), direction: direction.clone(), scale });
        } else if (token === "]") {
            ({ point, direction, scale } = stack.pop());
        } else if (token === "s") {
            scale *= 0.69;
        } else {
            direction.multiply(rotation.setFromAxisAngle(axes[token], token.toUpperCase() === "R" ? 0.97 : 0.55));
        }
    }
    if (!result.length) throw new Error("The rule produces no solid branches.");
    return result;
}

const sides = [
    [[1, 0, 0], [[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],
    [[-1, 0, 0], [[0,0,1],[0,1,1],[0,1,0],[0,0,0]]],
    [[0, 1, 0], [[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],
    [[0, -1, 0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
    [[0, 0, 1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],
    [[0, 0, -1], [[0,1,0],[1,1,0],[1,0,0],[0,0,0]]],
];

function solid(segments) {
    const bounds = new T.Box3();
    for (const { start, end, radius } of segments) {
        const pad = new T.Vector3(radius, radius, radius);
        bounds.expandByPoint(start.clone().sub(pad)).expandByPoint(start.clone().add(pad));
        bounds.expandByPoint(end.clone().sub(pad)).expandByPoint(end.clone().add(pad));
    }
    const extent = bounds.getSize(new T.Vector3());
    const size = Math.max(extent.x, extent.y, extent.z) / 56;
    const min = bounds.min.clone().addScalar(-size);
    const [nx, ny, nz] = extent.toArray().map(axis => Math.min(56, Math.ceil(axis / size)) + 2);
    const index = (x, y, z) => x + nx * (y + ny * z);
    const voxels = new Uint8Array(nx * ny * nz);
    const sample = new T.Vector3();
    const offset = new T.Vector3();
    for (const { start, end, radius } of segments) {
        const lo = start.clone().min(end).addScalar(-radius).sub(min).divideScalar(size).floor();
        const hi = start.clone().max(end).addScalar(radius).sub(min).divideScalar(size).floor();
        const direction = end.clone().sub(start);
        const squaredLength = direction.lengthSq();
        for (let z = lo.z; z <= hi.z; z++) {
            for (let y = lo.y; y <= hi.y; y++) {
                for (let x = lo.x; x <= hi.x; x++) {
                    sample.set(x + 0.5, y + 0.5, z + 0.5).multiplyScalar(size).add(min);
                    offset.copy(sample).sub(start);
                    const along = T.MathUtils.clamp(offset.dot(direction) / squaredLength, 0, 1);
                    if (offset.addScaledVector(direction, -along).lengthSq() <= radius ** 2) voxels[index(x, y, z)] = 1;
                }
            }
        }
    }
    const positions = [];
    let count = 0;
    for (let z = 1; z < nz - 1; z++) {
        for (let y = 1; y < ny - 1; y++) {
            for (let x = 1; x < nx - 1; x++) {
                if (!voxels[index(x, y, z)]) continue;
                count++;
                for (const [[dx, dy, dz], corners] of sides) {
                    if (voxels[index(x + dx, y + dy, z + dz)]) continue;
                    for (const corner of [0, 1, 2, 0, 2, 3]) {
                        const [cx, cy, cz] = corners[corner];
                        positions.push((x + cx) * size - extent.x / 2, (y + cy - 1) * size,
                            (z + cz) * size - extent.z / 2);
                    }
                }
            }
        }
    }
    if (!count) throw new Error("The branches are too thin for the preview grid.");
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return { geometry, count };
}

function build() {
    try {
        if (!depth.checkValidity()) throw new Error("Generations must be a whole number from 0 to 4.");
        const segments = branches(rule.value, depth.valueAsNumber);
        const { geometry, count } = solid(segments);
        geometry.computeBoundingBox();
        const dimensions = geometry.boundingBox.getSize(new T.Vector3());
        object.geometry.dispose();
        object.geometry = geometry;
        object.scale.setScalar(2.15 / Math.max(dimensions.x, dimensions.y, dimensions.z));
        status.textContent = `${segments.length} branches · ${count.toLocaleString()} filled voxels`;
    } catch (error) {
        status.textContent = error.message;
    }
}

export async function createSolidsRoom() {
    const source = await exhibitDocument("./solids.html");
    rule.value = source.querySelector("#rule").value;
    depth.type = "number";
    depth.min = "0";
    depth.max = "4";
    depth.value = source.querySelector("#depth").value;
    turntable.position.y = 0.08;
    object.position.y = 0.16;
    build();
    return galleryRoom(scene, {
        actions: [["Fewer generations", () => { depth.value = Math.max(0, Number(depth.value) - 1); build(); }],
            ["More generations", () => { depth.value = Math.min(4, Number(depth.value) + 1); build(); }]],
        canStand: (x, z) => Math.hypot(x, z) > 1.6,
    });
}

if (standalone) try {
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    viewport.append(renderer.domElement);
    function resize() {
        camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    resize();
    window.addEventListener("resize", resize);
    let yaw = 0.65;
    let pitch = 0.23;
    let previous;
    const surface = renderer.domElement;
    surface.addEventListener("pointerdown", event => {
        previous = [event.clientX, event.clientY];
        surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("lostpointercapture", () => { previous = null; });
    surface.addEventListener("pointermove", event => {
        if (!previous) return;
        yaw -= (event.clientX - previous[0]) * 0.006;
        pitch = T.MathUtils.clamp(pitch + (event.clientY - previous[1]) * 0.006, 0.03, 1.35);
        previous = [event.clientX, event.clientY];
    });
    document.querySelector("#build").addEventListener("click", build);
    build();
    renderer.setAnimationLoop(() => {
        const distance = Math.max(4.8, 3.1 / camera.aspect);
        camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, 1 + Math.sin(pitch) * distance,
            Math.cos(yaw) * Math.cos(pitch) * distance);
        camera.lookAt(0, 1, 0);
        renderer.render(scene, camera);
    });
} catch {
    status.textContent = "WebGL is unavailable. The Pocket Bonsai project is linked below.";
    document.querySelector("#build").disabled = true;
}
