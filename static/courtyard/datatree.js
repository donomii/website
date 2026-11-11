import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { ArchiveEntry, fileLimit, parseArchive } from "./archive.js";
import { gamepadMenu, readGamepad } from "./gamepad.js";
import { attachVrInput, vrSessionOptions } from "./xr-input.js";
import { galleryRoom } from "./gallery-room.js";

const archive = {
    "maps.zip": {
        "mediterranean.json": { region: "Mediterranean", layer: "Roads", format: "GeoJSON" },
        "tiles.zip": { "0-0.png": "Map tile, 256 × 256 pixels", "0-1.png": "Map tile, 256 × 256 pixels" },
    },
    "catalogue.json": { title: "Courtyard collection", edition: 1, open: true },
    "readme.txt": "A sample archive for the Datatree exhibit.",
};
const viewport = document.querySelector("#viewport");
const standalone = document.querySelector("#tree-controls") !== null;
const controls = document.querySelector("#tree-controls") ?? document.createElement("nav");
const pathText = document.querySelector("#tree-path") ?? document.createTextNode("");
const valueText = document.querySelector("#tree-value") ?? document.createTextNode("");
const vr = document.querySelector("#vr");
const filePicker = document.querySelector("#tree-file");
const path = [{ name: "exhibits.zip", value: archive }];
const scene = new T.Scene();
scene.background = new T.Color(0x201a18);
const camera = new T.PerspectiveCamera(62, 1, 0.05, 30);
const rig = new T.Group();
camera.position.set(0, 1.6, 2.55);
rig.add(camera);
scene.add(rig);
const tree = new T.Group();
tree.position.set(0, 1.45, -2.4);
scene.add(tree);
scene.add(new T.HemisphereLight(0xffe0b5, 0x87685a, 2.5));
const bronze = new T.MeshStandardMaterial({ color: 0xa98255, roughness: 0.75 });
const floor = new T.Mesh(new T.CircleGeometry(5, 48), new T.MeshStandardMaterial({ color: 0x664936 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0.012;
floor.userData.baySkip = true;
scene.add(floor);
const plaster = new T.MeshStandardMaterial({ color: 0x804b37, roughness: 0.93 });
function stonework(width, height, depth, x, y, z, material) {
    const piece = new T.Mesh(new T.BoxGeometry(width, height, depth), material);
    piece.position.set(x, y, z);
    scene.add(piece);
}
stonework(6.4, 3.65, 0.28, 0, 1.825, -3.3, plaster);
for (const x of [-2.65, 2.65]) {
    stonework(0.32, 3, 0.38, x, 1.5, -3.02, bronze);
    stonework(0.53, 0.17, 0.59, x, 3.04, -3.02, bronze);
}
stonework(5.85, 0.23, 0.42, 0, 3.22, -3.03, bronze);
stonework(4.9, 0.42, 0.9, 0, 0.21, -2.55, bronze);
let renderer;
let selected;
let targets = [];
let page = 0;
let revision = 0;
const pageSize = 3;

function isBranch(value) {
    return typeof value === "object" && value !== null;
}

function label(title, detail, fill) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 208;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 512, 208);
    ctx.strokeStyle = "#d4ad76";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 192);
    ctx.fillStyle = "#fff0d6";
    ctx.textAlign = "center";
    ctx.font = "bold 49px Georgia";
    ctx.fillText(title, 256, 84, 472);
    ctx.font = "34px system-ui";
    ctx.fillText(detail, 256, 152, 472);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map });
}

function plaque(x, y, z, width, title, detail, fill, action) {
    const back = new T.Mesh(new T.BoxGeometry(width + 0.06, 0.48, 0.12), bronze);
    back.position.set(x, y, z);
    tree.add(back);
    const face = new T.Mesh(new T.PlaneGeometry(width, 0.42), label(title, detail, fill));
    face.position.set(x, y, z + 0.063);
    tree.add(face);
    if (action) {
        face.userData.action = action;
        targets.push(face);
    }
}

function branchLine(x, z) {
    const shape = new T.BufferGeometry().setFromPoints([
        new T.Vector3(0, 0.58, -0.22), new T.Vector3(0, 0.32, -0.22),
        new T.Vector3(x, 0.32, z), new T.Vector3(x, 0.10, z),
    ]);
    tree.add(new T.Line(shape, new T.LineBasicMaterial({ color: 0xd5ac77 })));
}

async function open(name, value) {
    const request = ++revision;
    try {
        if (value instanceof ArchiveEntry) value = await value.open();
    } catch (error) {
        if (request === revision) valueText.textContent = error.message;
        return;
    }
    if (request !== revision) return;
    if (isBranch(value)) {
        if (path.length >= 16) {
            valueText.textContent = "This branch exceeds the 16-level gallery limit.";
            return;
        }
        path.push({ name, value });
        selected = undefined;
        page = 0;
    } else {
        selected = { name, value };
    }
    renderTree();
}

function goUp() {
    revision++;
    if (path.length > 1) path.pop();
    selected = undefined;
    page = 0;
    renderTree();
}

function button(text, action) {
    const control = document.createElement("button");
    control.textContent = text;
    control.addEventListener("click", action);
    controls.append(control);
}

function renderTree() {
    controls.replaceChildren();
    const current = path[path.length - 1];
    pathText.textContent = path.map(entry => entry.name).join(" / ");
    valueText.textContent = selected ? `${selected.name} = ${String(selected.value).slice(0, 4096)}` : "";
    for (const child of [...tree.children]) {
        child.geometry.dispose();
        if (child.material !== bronze) {
            child.material.map?.dispose();
            child.material.dispose();
        }
        tree.remove(child);
    }
    targets = [];
    plaque(0, 0.82, -0.22, 1.85, current.name, "CONTAINER", "#744637");
    if (path.length > 1) {
        plaque(-1.5, 0.82, 0.05, 0.9, "← Up", "PARENT", "#70533d", goUp);
        button("Up to parent", goUp);
    }
    const all = Object.entries(current.value);
    const pages = Math.ceil(all.length / pageSize);
    const entries = all.slice(page * pageSize, (page + 1) * pageSize);
    function turnPage(offset) {
        revision++;
        page += offset;
        selected = undefined;
        renderTree();
    }
    if (page > 0) {
        const previous = () => turnPage(-1);
        plaque(-1.3, -0.76, 0.2, 0.64, "←", "PREV", "#70533d", previous);
        button("Previous page", previous);
    }
    if (page + 1 < pages) {
        const next = () => turnPage(1);
        plaque(1.3, -0.76, 0.2, 0.64, "→", "NEXT", "#70533d", next);
        button("Next page", next);
    }
    if (pages > 1) pathText.textContent += ` · page ${page + 1}/${pages}`;
    entries.forEach(([name, value], i) => {
        const x = (i - (entries.length - 1) / 2) * 1.25;
        const z = Math.abs(x) * 0.15;
        const action = () => open(name, value);
        branchLine(x, z);
        const branch = value instanceof ArchiveEntry ? value.kind === "zip" || value.kind === "json" : isBranch(value);
        plaque(x, -0.17, z, 1.17, name.slice(0, 90), branch ? "OPEN BRANCH" : "READ VALUE",
            branch ? "#455d52" : "#625141", action);
        button(name, action);
    });
    if (selected) plaque(0, -0.76, 0.2, 1.87, selected.name.slice(0, 90), String(selected.value).slice(0, 160), "#53466a");
}

function openRoot(name, value) {
    path.splice(0, path.length, { name, value });
    selected = undefined;
    page = 0;
    renderTree();
}

function snapshotTree(text) {
    const snapshot = JSON.parse(text);
    if (snapshot?.datatree_snapshot !== 1) throw new Error("Choose a version 1 Datatree snapshot.");
    let count = 0;
    function branch(rows, depth) {
        if (!Array.isArray(rows) || depth > 12) throw new Error("Invalid or too deeply nested Datatree resources.");
        const result = Object.create(null);
        for (const row of rows) {
            if (++count > 5000 || typeof row?.name !== "string" || typeof row.kind !== "string" ||
                !Number.isSafeInteger(row.size)) throw new Error("Invalid resource or more than 5,000 Datatree resources.");
            let name = row.name;
            for (let suffix = 2; Object.hasOwn(result, name); suffix++) name = `${row.name} (${suffix})`;
            result[name] = row.children === undefined
                ? `${row.kind}, ${row.size < 0 ? "size unknown" : `${row.size} bytes`}`
                : branch(row.children, depth + 1);
        }
        return result;
    }
    return branch(snapshot.resources, 1);
}

filePicker?.addEventListener("change", async () => {
    const file = filePicker.files[0];
    if (!file) return;
    const request = ++revision;
    filePicker.value = "";
    try {
        const snapshot = file.name.toLowerCase().endsWith(".json");
        if (snapshot && file.size > 4 * 1024 * 1024) throw new Error("Choose a Datatree snapshot of at most 4 MiB.");
        if (!snapshot && file.size > fileLimit) throw new Error("Choose a ZIP of at most 16 MiB.");
        const value = snapshot ? snapshotTree(await file.text()) : parseArchive(new Uint8Array(await file.arrayBuffer()));
        if (request === revision) openRoot(file.name, value);
    } catch (error) {
        if (request === revision) valueText.textContent = error.message;
    }
});
document.querySelector("#tree-sample")?.addEventListener("click", () => {
    revision++;
    openRoot("exhibits.zip", archive);
});

const ray = new T.Raycaster();
function selectTarget(pointer = ray) {
    const hit = pointer.intersectObjects(targets)[0];
    if (hit) hit.object.userData.action();
    return Boolean(hit);
}

export function createDatatreeRoom() {
    return galleryRoom(scene, {
        select: selectTarget,
        canStand: (x, z) => Math.hypot(x, z) <= 4.7 && z > -1.9,
    });
}

const vrInputs = [];

async function setupVr() {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    for (let i = 0; i < 2; i++) {
        const input = attachVrInput(renderer.xr, rig, i);
        vrInputs.push(input);
        const controller = input.ray;
        controller.addEventListener("select", () => {
            if (!controller.visible) return;
            ray.set(controller.getWorldPosition(new T.Vector3()),
                new T.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new T.Quaternion())));
            selectTarget();
        });
    }
    vr.hidden = false;
    vr.addEventListener("click", async () => {
        try {
            const session = await navigator.xr.requestSession("immersive-vr", vrSessionOptions);
            await renderer.xr.setSession(session);
        } catch {
            valueText.textContent = "The headset session could not start.";
        }
    });
}

if (standalone) try {
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    viewport.append(renderer.domElement);
    function resize() {
        camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
        camera.position.z = Math.max(2.55, 3.6 / Math.max(0.25, camera.aspect) - 2.4);
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    resize();
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("click", event => {
        const rect = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
            1 - (event.clientY - rect.top) / rect.height * 2), camera);
        selectTarget();
    });
    setupVr().catch(() => { vr.hidden = true; });
    const pollGamepad = readGamepad();
    const useMenu = gamepadMenu("main button, main a[href]");
    renderer.setAnimationLoop(() => {
        for (const input of vrInputs) input.update();
        const pad = !renderer.xr.isPresenting && pollGamepad();
        if (pad) useMenu(pad);
        renderer.render(scene, camera);
    });
} catch {
    viewport.hidden = true;
}
renderTree();
