import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { readGamepad } from "./gamepad.js?v=20261111";
import { attachVrInput, vrSessionOptions } from "./xr-input.js?v=20261111";
import { galleryRoom } from "./gallery-room.js?v=20261111";

const viewport = document.querySelector("#viewport");
const standalone = document.querySelector("#jump-status") !== null;
const status = document.querySelector("#jump-status") ?? document.createTextNode("The original Racket figures are moving on their own.");
const paletteButton = document.querySelector("#palette");
const toggleButton = document.querySelector("#toggle");
const vrButton = document.querySelector("#vr");

const PALETTES = [
    [0x1fa81f, 0x8d9e34],
    [0xb808aa, 0xb8840e],
    [0xb34c4e, 0x0cc218],
    [0xd87c9e, 0x9e0cc2],
    [0xd9d836, 0x767892],
];

const scene = new T.Scene();
scene.background = new T.Color(0x292124);
const camera = new T.PerspectiveCamera(56, 1, 0.05, 40);
camera.position.set(0, 1.62, 4.5);
const rig = new T.Group();
rig.add(camera);
scene.add(rig);
scene.add(new T.HemisphereLight(0xffe8cc, 0x62505d, 2.2));
const keyLight = new T.DirectionalLight(0xfff0d8, 2.4);
keyLight.position.set(-2.5, 6, 3.5);
scene.add(keyLight);

const stage = new T.Group();
stage.position.set(0, 0, -1.25);
scene.add(stage);

const unitCube = new T.BoxGeometry(1, 1, 1);
const u = 0.24;

function makeBoxPart(parent, sx, sy, sz, x, y, z, material) {
    const mesh = new T.Mesh(unitCube, material);
    mesh.scale.set(u * sx, u * sy, u * sz);
    mesh.position.set(u * x, u * y, u * z);
    parent.add(mesh);
    return mesh;
}

// Articulated blocky Racket figure modeled after projects/jump/jumping.rkt.
function createRacketFigure(color) {
    const material = new T.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04 });
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);

    makeBoxPart(body, 2.3, 2.7, 1.0, 0, 0.2, 0, material);
    makeBoxPart(body, 2.2, 0.75, 0.96, 0, -1.52, 0, material);
    makeBoxPart(body, 0.96, 0.96, 0.96, 0, 2.02, 0, material);

    function makeArm(side) {
        const shoulder = new T.Group();
        shoulder.position.set(side * 1.18 * u, 1.05 * u, 0);
        body.add(shoulder);
        makeBoxPart(shoulder, 1.5, 0.85, 0.85, side * 0.75, 0, 0, material);
        const elbow = new T.Group();
        elbow.position.set(side * 1.45 * u, 0, 0);
        shoulder.add(elbow);
        makeBoxPart(elbow, 1.5, 0.85, 0.85, side * 0.75, 0, 0, material);
        return { side, shoulder, elbow };
    }

    function makeLeg(side) {
        const hip = new T.Group();
        hip.position.set(side * 0.62 * u, -1.85 * u, 0);
        body.add(hip);
        makeBoxPart(hip, 0.86, 1.25, 0.86, 0, -0.625, 0, material);
        const knee = new T.Group();
        knee.position.set(0, -1.2 * u, 0);
        hip.add(knee);
        makeBoxPart(knee, 0.86, 1.25, 0.86, 0, -0.625, 0, material);
        return { hip, knee };
    }

    const armL = makeArm(-1);
    const armR = makeArm(1);
    const legL = makeLeg(-1);
    const legR = makeLeg(1);
    stage.add(root);

    return { root, body, material, armL, armR, legL, legR };
}

const figures = [
    { fig: createRacketFigure(PALETTES[0][0]), baseX: -0.78, baseZ: 0.05, facing: 0.22, speed: 1.0, phase: 0 },
    { fig: createRacketFigure(PALETTES[0][1]), baseX: 0.78, baseZ: -0.15, facing: -0.22, speed: 1.08, phase: 1.7 },
];

function poseFigure(entry, t) {
    const { fig, baseX, baseZ, facing, speed, phase } = entry;
    const p = t * speed + phase;
    const beat = p * 2.6;
    const wave = Math.sin(beat);
    const hop = Math.max(0, wave) ** 1.35 * 0.48;
    const kick = Math.sin(beat * 0.5);

    fig.body.rotation.set(Math.sin(beat * 0.5 + 0.4) * 0.14, 0, Math.cos(beat * 0.5) * 0.12);

    // Expressive Racket arm swings & asymmetric elbow bends.
    const lRaise = Math.sin(p * 2.1 + 0.5) * 0.85 + 0.15;
    const rRaise = Math.sin(p * 2.6 - 0.6) * 0.9 + 0.25;
    fig.armL.shoulder.rotation.set(0, Math.sin(p * 1.4) * 0.65, -lRaise);
    fig.armL.elbow.rotation.set(0, -0.45 - Math.max(0, Math.cos(p * 2.2)) * 0.95, 0);

    fig.armR.shoulder.rotation.set(0, -Math.sin(p * 1.7 + 1.0) * 0.65, rRaise);
    fig.armR.elbow.rotation.set(0, 0.45 + Math.max(0, Math.sin(p * 2.5)) * 0.95, 0);

    // Kicking legs & knee bends synced with hops.
    const lHipX = -0.35 * Math.max(0, kick) - hop * 0.55;
    const rHipX = -0.35 * Math.max(0, -kick) - hop * 0.45;
    const lKneeX = Math.max(0.08, (Math.sin(beat + 0.7) * 0.5 + 0.5) * 1.05);
    const rKneeX = Math.max(0.08, (Math.sin(beat - 2.2) * 0.5 + 0.5) * 1.05);
    fig.legL.hip.rotation.set(lHipX, 0, -0.08 - hop * 0.25);
    fig.legL.knee.rotation.set(lKneeX, 0, 0);
    fig.legR.hip.rotation.set(rHipX, 0, 0.08 + hop * 0.25);
    fig.legR.knee.rotation.set(rKneeX, 0, 0);

    // Keep lowest foot clear of the floor while hopping vertically and swaying smoothly.
    const thigh = 1.2 * u;
    const shin = 1.25 * u;
    const hipY = 1.85 * u;
    const leftDrop = hipY + thigh * Math.cos(lHipX) + shin * Math.cos(lHipX + lKneeX);
    const rightDrop = hipY + thigh * Math.cos(rHipX) + shin * Math.cos(rHipX + rKneeX);
    const floorOffset = Math.max(leftDrop, rightDrop, 3.2 * u);

    fig.root.position.set(
        baseX + Math.sin(p * 0.95) * 0.26,
        floorOffset + hop,
        baseZ + Math.cos(p * 0.8) * 0.26,
    );
    fig.root.rotation.y = facing + Math.sin(p * 1.15) * 0.55;
}

let paletteIndex = 0;
let paused = false;
let elapsed = 0;
let previous;
let renderer;
const vrInputs = [];

function applyPalette(index) {
    paletteIndex = (index + PALETTES.length) % PALETTES.length;
    const [a, b] = PALETTES[paletteIndex];
    figures[0].fig.material.color.setHex(a);
    figures[1].fig.material.color.setHex(b);
    status.textContent = paused ? "Figures paused · Select Switch colors or Resume." : "Figures jumping on their own.";
}

function nextPalette() {
    applyPalette(paletteIndex + 1);
}

function togglePause() {
    paused = !paused;
    previous = undefined;
    if (toggleButton) toggleButton.textContent = paused ? "Resume movement" : "Pause movement";
    status.textContent = paused ? "Figures paused." : "Figures jumping on their own.";
}

function updateFigures(now) {
    const dt = previous === undefined ? 0 : Math.min(0.08, Math.max(0, (now - previous) / 1000));
    previous = now;
    if (!paused) elapsed += dt;
    for (const entry of figures) poseFigure(entry, elapsed);
}

figures.forEach(entry => poseFigure(entry, 0));

export function createJumpRoom() {
    const meshes = [];
    for (const { fig } of figures) {
        fig.root.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
    }
    return galleryRoom(scene, {
        actions: [["Switch colors", nextPalette], ["Pause / resume", togglePause]],
        canStand: (x, z) => !(Math.abs(x) < 1.85 && z < 0.1 && z > -2.55),
        select(ray) {
            if (ray.intersectObjects(meshes, false).length > 0) {
                nextPalette();
                return true;
            }
            return false;
        },
        update(now) {
            updateFigures(now);
        },
        enter() {
            paused = false;
            previous = undefined;
        },
        leave() {
            previous = undefined;
        },
    });
}

async function setupVr() {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    for (let i = 0; i < 2; i++) {
        const input = attachVrInput(renderer.xr, rig, i, false);
        vrInputs.push(input);
        const controller = input.ray;
        controller.addEventListener("squeezestart", nextPalette);
        controller.addEventListener("selectstart", togglePause);
    }
    vrButton.hidden = false;
    vrButton.addEventListener("click", async () => {
        try {
            const session = await navigator.xr.requestSession("immersive-vr", vrSessionOptions);
            await renderer.xr.setSession(session);
        } catch {
            status.textContent = "The headset session could not start.";
        }
    });
}

if (standalone) try {
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    viewport.append(renderer.domElement);
    function resize() {
        camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    resize();
    window.addEventListener("resize", resize);
    const surface = renderer.domElement;
    let dragging = null;
    surface.addEventListener("pointerdown", event => {
        surface.setPointerCapture(event.pointerId);
        dragging = { id: event.pointerId, x: event.clientX, moved: 0 };
    });
    surface.addEventListener("pointermove", event => {
        if (dragging?.id !== event.pointerId) return;
        const dx = event.clientX - dragging.x;
        dragging.moved += Math.abs(dx);
        dragging.x = event.clientX;
        stage.rotation.y += dx * 0.008;
    });
    surface.addEventListener("pointerup", event => {
        if (dragging?.id === event.pointerId && dragging.moved < 6) nextPalette();
        dragging = null;
    });
    paletteButton?.addEventListener("click", nextPalette);
    toggleButton?.addEventListener("click", togglePause);
    setupVr().catch(() => { if (vrButton) vrButton.hidden = true; });
    const pollGamepad = readGamepad();
    renderer.setAnimationLoop(now => {
        for (const input of vrInputs) input.update();
        const pad = !renderer.xr.isPresenting && pollGamepad();
        if (pad) {
            if (Math.abs(pad.axes[0]) > 0.1) stage.rotation.y += pad.axes[0] * 0.03;
            if (pad.pressed[0]) togglePause();
            else if (pad.pressed[2] || pad.pressed[3]) nextPalette();
        }
        updateFigures(now);
        renderer.render(scene, camera);
    });
} catch {
    status.textContent = "WebGL is unavailable. The original Racket demo is linked below.";
    if (paletteButton) paletteButton.disabled = true;
    if (toggleButton) toggleButton.disabled = true;
}
