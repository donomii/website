import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { galleryRoom } from "./gallery-room.js";

const viewport = document.querySelector("#scene");
const select = document.querySelector("#theme");
const cameraButton = document.querySelector("#camera");
const status = document.querySelector("#tracking");
const renderer = viewport ? new T.WebGLRenderer({ antialias: true }) : null;
if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    viewport.append(renderer.domElement);
}
const camera = new T.PerspectiveCamera();
const scene = new T.Scene();
const scenery = new T.Group();
scene.add(scenery, new T.HemisphereLight(0xffe0b2, 0x696281, 2.6));
const sun = new T.DirectionalLight(0xffce98, 2.4);
sun.position.set(-4, 6, 3);
scene.add(sun);

function box(color, x, y, z, width, height, depth) {
    const object = new T.Mesh(new T.BoxGeometry(width, height, depth), new T.MeshStandardMaterial({ color }));
    object.position.set(x, y, z);
    scenery.add(object);
}

function build(theme) {
    for (const object of [...scenery.children]) {
        object.geometry.dispose();
        object.material.dispose();
        scenery.remove(object);
    }
    const frame = theme === "bookshelf" ? 0x573326 : 0x9d795d;
    scene.background = new T.Color(0x8298a1);
    box(0x9c8a78, 0, -1.38, -5, 12, 0.22, 12);
    box(0xc69774, 0, 0, -10, 10, 3, 0.35);
    for (const side of [-1, 1]) {
        box(frame, side * 2.9, 0, 0, 0.54, 3.3, 0.45);
        for (let depth = 2; depth <= 8; depth += 2) {
            const x = side * (theme === "bookshelf" ? 1.65 : 3.2);
            box(depth % 4 ? 0x995d43 : 0x7e5149, x, 0.15, -depth, 0.85, 3, 1.85);
            box(0xe8ad60, x - side * 0.44, 0.65, -depth, 0.08, 0.65, 0.55);
        }
    }
    for (const y of [-1.51, 1.51]) box(frame, 0, y, 0, 6.3, 0.4, 0.45);
    if (theme === "grate") {
        for (let i = -4; i <= 4; i++) box(0x2e3332, i * 0.56, 0, -0.12, 0.08, 2.9, 0.12);
    } else if (theme === "window") {
        box(frame, 0, 0, 0, 0.09, 2.65, 0.22);
        box(frame, 0, 0, 0, 5.4, 0.09, 0.22);
    } else {
        for (let i = -2; i <= 2; i++) box(0x6c5146, i * 0.46, -1.25, -4, 0.39, 0.09, 7);
    }
    render();
}

let x = 0, y = 0;
function look(nextX, nextY) {
    x = T.MathUtils.clamp(nextX, -1, 1);
    y = T.MathUtils.clamp(nextY, -1, 1);
    render();
}

function render() {
    if (!renderer) return;
    const distance = 4;
    const halfHeight = 1.75;
    const halfWidth = halfHeight * viewport.clientWidth / Math.max(1, viewport.clientHeight);
    camera.position.set(x * 1.3, y * 0.85, distance);
    const near = 0.1;
    const scale = near / distance;
    // Keep the projection plane fixed at the front of the scene as the eye moves.
    camera.projectionMatrix.makePerspective(
        (-halfWidth - camera.position.x) * scale, (halfWidth - camera.position.x) * scale,
        (halfHeight - camera.position.y) * scale, (-halfHeight - camera.position.y) * scale,
        near, 40);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    renderer.render(scene, camera);
}

let stream = null;
let generation = 0;
const video = document.createElement("video");
video.muted = true;
video.playsInline = true;

function stopCamera(message) {
    generation++;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    cameraButton.textContent = "Use camera tracking";
    status.textContent = message;
}

async function track() {
    const current = ++generation;
    cameraButton.textContent = "Stop camera tracking";
    status.textContent = "Waiting for camera access.";
    try {
        const detector = new globalThis.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const candidate = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320 }, audio: false });
        if (current !== generation) {
            candidate.getTracks().forEach(track => track.stop());
            return;
        }
        stream = candidate;
        video.srcObject = stream;
        await video.play();
        while (current === generation) {
            const faces = await detector.detect(video);
            if (current !== generation) return;
            const bounds = faces[0]?.boundingBox;
            if (bounds) {
                look(x * 0.65 + (1 - 2 * (bounds.x + bounds.width / 2) / video.videoWidth) * 0.7,
                    y * 0.65 + (1 - 2 * (bounds.y + bounds.height / 2) / video.videoHeight) * 0.7);
                status.textContent = "Camera tracking on. Video stays in this tab.";
            } else {
                status.textContent = "No face in view. Move the pointer or use the arrow keys.";
            }
            await new Promise(resolve => setTimeout(resolve, 80));
        }
    } catch {
        if (current === generation) stopCamera("Camera tracking unavailable. Use the pointer or arrow keys.");
    }
}

cameraButton?.addEventListener("click", () => {
    if (cameraButton.textContent === "Stop camera tracking") {
        stopCamera("Camera tracking off. Use the pointer or arrow keys.");
    } else if (!globalThis.FaceDetector || !navigator.mediaDevices?.getUserMedia) {
        status.textContent = "This browser has no camera face detection. Use the pointer or arrow keys.";
    } else {
        track();
    }
});
if (renderer) window.addEventListener("pagehide", () => stopCamera("Camera tracking off."));
select?.addEventListener("change", () => build(select.value));
document.querySelector("#center")?.addEventListener("click", () => look(0, 0));
viewport?.addEventListener("pointermove", event => {
    const rect = viewport.getBoundingClientRect();
    look(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
});
viewport?.addEventListener("keydown", event => {
    const moves = { ArrowLeft: [-0.14, 0], ArrowRight: [0.14, 0], ArrowUp: [0, 0.14], ArrowDown: [0, -0.14] };
    const delta = moves[event.key];
    if (delta) {
        event.preventDefault();
        look(x + delta[0], y + delta[1]);
    }
});
if (renderer) {
    new ResizeObserver(() => {
        renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
        render();
    }).observe(viewport);
    build(select.value);
}

export function createThemelabRoom() {
    scenery.position.y = 1.28;
    build("window");
    return galleryRoom(scene, {
        actions: [["Window", () => build("window")], ["Grate", () => build("grate")],
            ["Bookshelf", () => build("bookshelf")]],
    });
}

