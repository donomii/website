import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { convertPoints } from "./entirety-points.js";
import { exhibitDocument, galleryRoom } from "./gallery-room.js";

const viewport = document.querySelector("#viewport");
const standalone = document.querySelector("#points-input") !== null;
const status = document.querySelector("#conversion-status") ?? document.createTextNode("");
const detail = document.querySelector("#conversion-detail") ?? document.createTextNode("");
const input = document.querySelector("#points-input") ?? document.createElement("textarea");
const pointsLink = document.querySelector("#download-points");
const dataLink = document.querySelector("#download-data");
const scene = new T.Scene();
scene.background = new T.Color(0x20252b);
const camera = new T.PerspectiveCamera(46, 1, 0.05, 30);
const globe = new T.Group();
globe.position.y = 0.25;
globe.rotation.set(0.2, -0.35, 0);
scene.add(globe);
scene.add(new T.HemisphereLight(0xe0f1fb, 0x627080, 2.3));
const earth = new T.Mesh(new T.SphereGeometry(1.48, 48, 32), new T.MeshStandardMaterial({ color: 0x264958 }));
globe.add(earth);
const grid = new T.LineSegments(new T.WireframeGeometry(new T.SphereGeometry(1.5, 24, 14)),
    new T.LineBasicMaterial({ color: 0x4d8190, transparent: true, opacity: 0.5 }));
globe.add(grid);
const pins = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color: 0xffc878, size: 0.11 }));
globe.add(pins);

function showPoints(buffer) {
    const view = new DataView(buffer);
    const positions = [];
    for (let offset = 0; offset < buffer.byteLength; offset += 16) {
        const latitude = T.MathUtils.degToRad(view.getFloat64(offset, true) / 60);
        const longitude = T.MathUtils.degToRad(view.getFloat64(offset + 8, true) / -60);
        positions.push(1.52 * Math.cos(latitude) * Math.sin(longitude),
            1.52 * Math.sin(latitude), 1.52 * Math.cos(latitude) * Math.cos(longitude));
    }
    pins.geometry.dispose();
    pins.geometry = new T.BufferGeometry();
    pins.geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
}

function setDownload(link, buffer) {
    if (link.hasAttribute("href")) URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
    link.hidden = false;
}

function convert() {
    try {
        const { points, attributes, count } = convertPoints(input.value);
        showPoints(points);
        if (standalone) {
            setDownload(pointsLink, points);
            setDownload(dataLink, attributes);
        }
        const first = new DataView(points);
        status.textContent = `${count} converted · ${points.byteLength} point bytes · ${attributes.byteLength} attribute bytes`;
        detail.textContent = `First binary pair: latitude × 60 = ${first.getFloat64(0, true)}; longitude × −60 = ${first.getFloat64(8, true)}.`;
    } catch (error) {
        status.textContent = error.message;
        detail.textContent = "The previous successful conversion is still displayed.";
    }
}

export async function createConverterRoom() {
    input.value = (await exhibitDocument("./converter.html")).querySelector("#points-input").value;
    globe.position.y = 1.55;
    convert();
    return galleryRoom(scene, {
        actions: [["Convert sample", convert], ["Turn globe", () => { globe.rotation.y += Math.PI / 4; }]],
        canStand: (x, z) => Math.hypot(x, z) > 1.75,
        select(ray) {
            if (!ray.intersectObject(earth, true).length) return false;
            globe.rotation.y += Math.PI / 4;
            return true;
        },
    });
}

document.querySelector("#convert")?.addEventListener("click", convert);
if (standalone) convert();
if (standalone) try {
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    viewport.append(renderer.domElement);
    function resize() {
        camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
        camera.position.set(0, 0.15, Math.max(5.8, 4.4 / camera.aspect));
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    resize();
    window.addEventListener("resize", resize);
    const surface = renderer.domElement;
    let pointer;
    surface.addEventListener("pointerdown", event => {
        pointer = [event.clientX, event.clientY];
        surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("lostpointercapture", () => { pointer = null; });
    surface.addEventListener("pointermove", event => {
        if (!pointer) return;
        globe.rotation.y += (event.clientX - pointer[0]) * 0.006;
        globe.rotation.x = T.MathUtils.clamp(globe.rotation.x + (event.clientY - pointer[1]) * 0.006, -1.4, 1.4);
        pointer = [event.clientX, event.clientY];
    });
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
} catch {
    viewport.hidden = true;
}
