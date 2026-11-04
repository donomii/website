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
    look(0, 0);
    cameraButton.textContent = "Use camera tracking";
    status.textContent = message;
}

async function faceTracker() {
    if (globalThis.FaceDetector) {
        const detector = new globalThis.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        return { async bounds() { return (await detector.detect(video))[0]?.boundingBox; } };
    }
    const library = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21";
    const { FaceDetector, FilesetResolver } = await import(library + "/vision_bundle.mjs");
    const files = await FilesetResolver.forVisionTasks(library + "/wasm");
    const detector = await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" },
        runningMode: "VIDEO",
    });
    return {
        bounds() {
            const box = detector.detectForVideo(video, performance.now()).detections[0]?.boundingBox;
            return box && { x: box.originX, y: box.originY, width: box.width, height: box.height };
        },
        close() { detector.close(); },
    };
}

async function track() {
    const current = ++generation;
    cameraButton.textContent = "Stop camera tracking";
    status.textContent = "Waiting for camera access.";
    let detector;
    try {
        const candidate = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320 }, audio: false });
        if (current !== generation) {
            candidate.getTracks().forEach(track => track.stop());
            return;
        }
        stream = candidate;
        video.srcObject = stream;
        await video.play();
        if (current !== generation) return;
        status.textContent = "Starting face tracking.";
        detector = await faceTracker();
        while (current === generation) {
            const bounds = await detector.bounds();
            if (current !== generation) return;
            if (bounds) {
                look(x * 0.65 + (1 - 2 * (bounds.x + bounds.width / 2) / video.videoWidth) * 0.7,
                    y * 0.65 + (1 - 2 * (bounds.y + bounds.height / 2) / video.videoHeight) * 0.7);
                status.textContent = "Camera tracking on. Video stays in this tab.";
            } else {
                if (x !== 0 || y !== 0) look(0, 0);
                status.textContent = "No face in view.";
            }
            await new Promise(resolve => setTimeout(resolve, 80));
        }
    } catch {
        if (current === generation) stopCamera("Camera tracking unavailable.");
    } finally {
        detector?.close?.();
    }
}

cameraButton?.addEventListener("click", () => {
    if (cameraButton.textContent === "Stop camera tracking") {
        stopCamera("Camera tracking off.");
    } else if (!navigator.mediaDevices?.getUserMedia) {
        status.textContent = "Camera access is unavailable in this browser.";
    } else {
        track();
    }
});
if (renderer) window.addEventListener("pagehide", () => stopCamera("Camera tracking off."));
select?.addEventListener("change", () => build(select.value));
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

