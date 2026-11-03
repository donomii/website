import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { learnLoop, poseAt } from "./dance-loop.js";

const viewport = document.querySelector("#viewport");
const status = document.querySelector("#jump-status");
const recordButton = document.querySelector("#record");
const replayButton = document.querySelector("#replay");
const loopButton = document.querySelector("#loop");
const vrButton = document.querySelector("#vr");
const scene = new T.Scene();
scene.background = new T.Color(0x292124);
const camera = new T.PerspectiveCamera(56, 1, 0.05, 40);
camera.position.set(0, 1.68, 4.6);
const rig = new T.Group();
rig.add(camera);
scene.add(rig);
scene.add(new T.HemisphereLight(0xffe1bd, 0x826478, 2.8));
const light = new T.DirectionalLight(0xffdabb, 2.8);
light.position.set(-3, 5, 1);
scene.add(light);

const stage = new T.Group();
stage.position.z = -2.1;
scene.add(stage);
const material = color => new T.MeshStandardMaterial({ color, roughness: 0.86 });
const wood = material(0x85543e);
const trim = material(0xdab37d);
const brass = material(0xf3bc70);
const teal = material(0x408a8e);
const plum = material(0x8e5075);
const pedestal = new T.Mesh(new T.CylinderGeometry(1.48, 1.58, 0.22, 48), wood);
pedestal.position.y = -0.12;
stage.add(pedestal);
const ring = new T.Mesh(new T.RingGeometry(1.29, 1.32, 64), trim);
ring.rotation.x = -Math.PI / 2;
stage.add(ring);
const wall = new T.Mesh(new T.BoxGeometry(7.1, 3.9, 0.24), material(0x78434a));
wall.position.set(0, 1.85, -1.4);
stage.add(wall);
const signCanvas = document.createElement("canvas");
signCanvas.width = 768;
signCanvas.height = 160;
const signTexture = new T.CanvasTexture(signCanvas);
signTexture.colorSpace = T.SRGBColorSpace;
const sign = new T.Mesh(new T.PlaneGeometry(2.8, 0.58), new T.MeshBasicMaterial({ map: signTexture }));
sign.position.set(0, 3.09, -1.25);
sign.visible = false;
stage.add(sign);
let signText;
function updateSign() {
    sign.visible = renderer.xr.isPresenting;
    if (!sign.visible || signText === status.textContent) return;
    signText = status.textContent;
    const ctx = signCanvas.getContext("2d");
    ctx.fillStyle = "#37252d";
    ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe4bb";
    ctx.font = "32px system-ui";
    ctx.fillText(signText, 384, 63, 720);
    ctx.font = "27px system-ui";
    ctx.fillText("Grip: record / stop     Trigger: loop / stop", 384, 115);
    signTexture.needsUpdate = true;
}
for (const x of [-2.1, 2.1]) {
    const column = new T.Mesh(new T.CylinderGeometry(0.19, 0.24, 3.45, 16), trim);
    column.position.set(x, 1.64, -1.04);
    stage.add(column);
}

const up = new T.Vector3(0, 1, 0);
const sphere = new T.SphereGeometry(1, 16, 12);
const cylinder = new T.CylinderGeometry(1, 1, 1, 12);
const V = (x, y, z = 0) => new T.Vector3(x, y, z);
function piece(geometry, finish) {
    const mesh = new T.Mesh(geometry, finish);
    stage.add(mesh);
    return mesh;
}
function limb(object, a, b, radius) {
    const delta = b.clone().sub(a);
    object.position.copy(a).lerp(b, 0.5);
    object.quaternion.setFromUnitVectors(up, delta.clone().normalize());
    object.scale.set(radius, delta.length(), radius);
}
function joint(object, position, radius) {
    object.position.copy(position);
    object.scale.setScalar(radius);
}
const torso = piece(cylinder, teal);
const head = piece(sphere, brass);
const limbs = [-1, 1].map(side => ({
    side,
    arm: piece(cylinder, plum), forearm: piece(cylinder, teal),
    thigh: piece(cylinder, plum), shin: piece(cylinder, teal),
    elbow: piece(sphere, brass), hand: piece(sphere, brass), knee: piece(sphere, brass), foot: piece(sphere, wood),
}));

function drawPose(pose) {
    const hip = V(0, pose.hip);
    const neck = V(0, pose.hip + 0.58);
    limb(torso, hip, neck, 0.2);
    joint(head, V(0, pose.hip + 0.77), 0.17);
    limbs.forEach((parts, index) => {
        const { side } = parts;
        const shoulder = V(side * 0.25, neck.y - 0.05);
        const hand = V(...pose.hands[index]);
        const elbow = shoulder.clone().lerp(hand, 0.47).add(V(side * 0.12, -0.11, -0.13));
        const leg = V(side * 0.15, hip.y);
        const foot = V(side * 0.24, pose.foot + 0.07, 0.1);
        const knee = leg.clone().lerp(foot, 0.48).add(V(0, 0, pose.bend));
        limb(parts.arm, shoulder, elbow, 0.072);
        limb(parts.forearm, elbow, hand, 0.058);
        limb(parts.thigh, leg, knee, 0.092);
        limb(parts.shin, knee, foot, 0.073);
        joint(parts.elbow, elbow, 0.078);
        joint(parts.hand, hand, 0.085);
        joint(parts.knee, knee, 0.092);
        joint(parts.foot, foot, 0.11);
        parts.foot.scale.z = 0.17;
    });
}

const clamp = T.MathUtils.clamp;
const defaultHands = () => [[-0.53, 1.29, 0.12], [0.53, 1.29, 0.12]];
function demoPose(seconds) {
    const wave = Math.sin(seconds * Math.PI / 1.12);
    const lift = Math.max(0, wave) ** 2 * 0.48;
    const dip = Math.max(0, -wave) * 0.23;
    return { hip: 0.91 + lift - dip, foot: lift, bend: 0.14 + dip,
        hands: [-1, 1].map(side => [side * (0.53 + wave * 0.16), 1.35 + lift + wave * 0.47, 0.2]) };
}

let mode = "demo";
let recording = [];
let learnedLoop = null;
let startedAt = 0;
let lastSample = 0;
let desktopHand = null;
let calibration = null;
let renderer;
const controllers = [];

function livePose(frame) {
    const hands = defaultHands();
    let hip = 0.91;
    let foot = 0;
    if (renderer.xr.isPresenting) {
        const viewer = frame?.getViewerPose(renderer.xr.getReferenceSpace());
        if (viewer) {
            const p = viewer.transform.position;
            if (!calibration) calibration = V(p.x, p.y, p.z);
            const delta = clamp(p.y - calibration.y, -0.45, 0.55);
            hip += delta;
            foot = Math.max(0, delta - 0.12);
            for (const controller of controllers) {
                const input = controller.userData.input;
                const pose = input?.gripSpace && frame.getPose(input.gripSpace, renderer.xr.getReferenceSpace());
                if (pose) {
                    const hand = pose.transform.position;
                    const index = input.handedness === "left" ? 0 : 1;
                    hands[index] = [clamp(hand.x - p.x, -1, 1),
                        clamp(1.68 + hand.y - calibration.y, 0.4, 2.75), clamp(p.z - hand.z, -0.3, 0.65)];
                }
            }
        }
    } else if (desktopHand) {
        hands[1] = desktopHand;
    }
    return { hip, foot, bend: 0.15 + Math.max(0, 0.91 - hip), hands };
}

function stopRecording() {
    mode = "live";
    recordButton.textContent = "Record movement";
    replayButton.disabled = recording.length < 2;
    learnedLoop = learnLoop(recording);
    loopButton.disabled = !learnedLoop;
    status.textContent = replayButton.disabled ? "Recording was too short." : "Movement captured. Replay to see the figure imitate it.";
}

function toggleRecord() {
    if (mode === "record") {
        stopRecording();
    } else {
        recording = [];
        learnedLoop = null;
        startedAt = performance.now();
        lastSample = -Infinity;
        calibration = null;
        mode = "record";
        recordButton.textContent = "Stop recording";
        replayButton.disabled = true;
        loopButton.disabled = true;
        loopButton.textContent = "Loop the dance";
        status.textContent = "Recording movement for up to 12 seconds.";
    }
}

function replay() {
    if (mode === "record" || recording.length < 2) return;
    mode = "replay";
    loopButton.textContent = "Loop the dance";
    startedAt = performance.now();
    status.textContent = "Replaying the recorded movement.";
}

function toggleLoop() {
    if (mode === "record" || !learnedLoop) return;
    if (mode === "loop") {
        mode = "live";
        loopButton.textContent = "Loop the dance";
        status.textContent = "Dance loop stopped.";
    } else {
        mode = "loop";
        startedAt = performance.now();
        loopButton.textContent = "Stop loop";
        const seconds = (learnedLoop.period / 1000).toFixed(2);
        status.textContent = learnedLoop.repeated ? `Looping a detected ${seconds}-second repeat.` :
            `Looping the full ${seconds}-second recording.`;
    }
}

async function setupVr() {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    for (let i = 0; i < 2; i++) {
        const controller = renderer.xr.getController(i);
        rig.add(controller);
        controllers.push(controller);
        controller.addEventListener("connected", event => { controller.userData.input = event.data; });
        controller.addEventListener("disconnected", () => { controller.userData.input = null; });
        controller.addEventListener("squeezestart", toggleRecord);
        controller.addEventListener("selectstart", toggleLoop);
    }
    vrButton.hidden = false;
    vrButton.addEventListener("click", async () => {
        try {
            const session = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });
            await renderer.xr.setSession(session);
            calibration = null;
            mode = "live";
            status.textContent = "Move your hands to pose the figure.";
            session.addEventListener("end", () => {
                if (mode === "record") stopRecording();
                mode = "demo";
                loopButton.textContent = "Loop the dance";
            });
        } catch {
            status.textContent = "The headset session could not start.";
        }
    });
}

try {
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
    function move(event) {
        const box = surface.getBoundingClientRect();
        desktopHand = [clamp(((event.clientX - box.left) / box.width - 0.5) * 3.8, -1, 1),
            clamp((1 - (event.clientY - box.top) / box.height) * 2.8, 0.4, 2.65), 0.15];
    }
    surface.addEventListener("pointerdown", event => {
        surface.setPointerCapture(event.pointerId);
        if (mode !== "record") mode = "live";
        loopButton.textContent = "Loop the dance";
        move(event);
    });
    surface.addEventListener("pointermove", event => { if (surface.hasPointerCapture(event.pointerId)) move(event); });
    recordButton.addEventListener("click", toggleRecord);
    replayButton.addEventListener("click", replay);
    loopButton.addEventListener("click", toggleLoop);
    document.querySelector("#demo").addEventListener("click", () => {
        if (mode === "record") stopRecording();
        mode = "demo";
        loopButton.textContent = "Loop the dance";
        status.textContent = "The figure is playing its built-in jump.";
    });
    setupVr().catch(() => { vrButton.hidden = true; });
    renderer.setAnimationLoop((now, frame) => {
        const elapsed = Math.max(0, now - startedAt);
        const pose = mode === "demo" ? demoPose(now / 1000) : mode === "replay" ? poseAt(recording, elapsed) :
            mode === "loop" ? learnedLoop.pose(elapsed) : livePose(frame);
        if (mode === "record" && elapsed - lastSample >= 1000 / 30) {
            recording.push({ time: elapsed, pose });
            lastSample = elapsed;
        }
        if (mode === "record" && elapsed >= 12000) stopRecording();
        if (mode === "replay" && elapsed >= recording[recording.length - 1].time) {
            mode = "live";
            status.textContent = "Replay finished.";
        }
        drawPose(pose);
        updateSign();
        renderer.render(scene, camera);
    });
} catch {
    status.textContent = "WebGL is unavailable. The original Racket demo is linked below.";
    recordButton.disabled = true;
    document.querySelector("#demo").disabled = true;
}
