import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { gamepadMenu, readGamepad } from "./gamepad.js";

const viewport = document.querySelector("#viewport");
const voyage = document.querySelector("#voyage");
const arrival = document.querySelector("#arrival");
const exhibit = document.querySelector("#exhibit");
const vr = document.querySelector("#vr");
const scene = new T.Scene();
scene.background = new T.Color(0x101923);
const rig = new T.Group();
const camera = new T.PerspectiveCamera(56, 1, 0.05, 70);
camera.position.set(0, 1.62, 3.3);
rig.add(camera);
scene.add(rig, new T.HemisphereLight(0xc7e5f4, 0x86668b, 2.3));
const sun = new T.DirectionalLight(0xffdfb6, 2.5);
sun.position.set(-4, 5, 1);
scene.add(sun);
const chart = new T.Group();
chart.position.set(0, 1.55, -2.85);
scene.add(chart);
const names = window.planetstring?.split(" ") ?? ["Optioceus", "Zensoft"];
const destinations = [
    { name: names[0], color: 0x6eaa9b, radius: 0.49, x: -1.35, y: 0.04, path: "./converter.html", work: "Map conversion bench" },
    { name: names[1], color: 0xbe785c, radius: 0.57, x: 0.02, y: 0.32, path: "./solids.html", work: "Pocket Bonsai Foundry" },
    { name: `${names[1]} Moon`, color: 0x9b9eaf, radius: 0.29, x: 1.37, y: -0.12, path: "./program.html", work: "Zipper sculpture studio" },
];
const targets = [];
let selected = -1;
let route = null;
let renderer;

function plaque(label, detail) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#192b36";
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = "#8fa9b0";
    ctx.lineWidth = 5;
    ctx.strokeRect(9, 9, 494, 174);
    ctx.fillStyle = "#ffe2b8";
    ctx.textAlign = "center";
    ctx.font = "bold 54px Georgia";
    ctx.fillText(label, 256, 80, 462);
    ctx.font = "36px system-ui";
    ctx.fillText(detail, 256, 141, 462);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.Mesh(new T.PlaneGeometry(1.19, 0.39), new T.MeshBasicMaterial({ map: texture }));
}

const starCoords = [];
for (let i = 0; i < 550; i++) {
    starCoords.push((i * 157 % 997 / 997 - 0.5) * 48, (i * 223 % 991 / 991 - 0.5) * 30, -7 - (i * 43 % 19));
}
const stars = new T.BufferGeometry();
stars.setAttribute("position", new T.Float32BufferAttribute(starCoords, 3));
scene.add(new T.Points(stars, new T.PointsMaterial({ color: 0x9eb6c4, size: 0.04 })));

const ship = new T.Group();
const hull = new T.Mesh(new T.ConeGeometry(0.095, 0.29, 4), new T.MeshStandardMaterial({ color: 0xf2c585 }));
hull.rotation.x = Math.PI / 2;
ship.add(hull);
const wings = new T.Mesh(new T.BoxGeometry(0.29, 0.026, 0.12), new T.MeshStandardMaterial({ color: 0x79c6d2 }));
ship.add(wings);
ship.position.set(0, -0.7, 0.47);
chart.add(ship);
voyage.textContent = "The ship is ready to depart.";

function depart(index) {
    const destination = destinations[index];
    selected = index;
    route = { from: ship.position.clone(), to: new T.Vector3(destination.x, destination.y - destination.radius * 0.36, 0.65),
        start: performance.now() };
    ship.lookAt(chart.localToWorld(route.to.clone()));
    voyage.textContent = `En route to ${destination.name}.`;
    arrival.textContent = "";
    exhibit.hidden = true;
    destinations.forEach((entry, i) => entry.button.setAttribute("aria-pressed", String(i === index)));
}

destinations.forEach((entry, index) => {
    const planet = new T.Mesh(new T.SphereGeometry(entry.radius, 32, 20),
        new T.MeshStandardMaterial({ color: entry.color, roughness: 0.88 }));
    planet.position.set(entry.x, entry.y, 0);
    planet.userData.index = index;
    chart.add(planet);
    const band = new T.Mesh(new T.TorusGeometry(entry.radius * 1.16, 0.013, 7, 50),
        new T.MeshStandardMaterial({ color: entry.color, emissive: entry.color, emissiveIntensity: 0.13 }));
    band.rotation.set(1.22, 0.26, -0.12);
    band.position.copy(planet.position);
    chart.add(band);
    const label = plaque(entry.name, entry.work);
    label.position.set(entry.x, entry.y - entry.radius - 0.3, 0.25);
    label.userData.index = index;
    chart.add(label);
    targets.push(planet, label);
    const button = document.createElement("button");
    button.textContent = entry.name;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => depart(index));
    document.querySelector("#destinations").append(button);
    entry.button = button;
});

const ray = new T.Raycaster();
async function hitDestination() {
    const hit = ray.intersectObjects(targets)[0];
    if (!hit) return;
    const index = hit.object.userData.index;
    const session = renderer.xr.getSession();
    if (session && index === selected && !route && !exhibit.hidden) {
        try {
            await session.end();
            window.location.assign(destinations[index].path);
        } catch {
            voyage.textContent = "Exit VR to open the exhibit.";
        }
    } else {
        depart(index);
    }
}

async function setupVr() {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    for (let i = 0; i < 2; i++) {
        const controller = renderer.xr.getController(i);
        rig.add(controller);
        controller.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -5)]),
            new T.LineBasicMaterial({ color: 0xffdfab })));
        controller.addEventListener("select", () => {
            ray.set(controller.getWorldPosition(new T.Vector3()),
                new T.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new T.Quaternion())));
            hitDestination();
        });
    }
    vr.hidden = false;
    vr.addEventListener("click", async () => {
        try {
            await renderer.xr.setSession(await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] }));
        } catch {
            voyage.textContent = "The headset session could not start.";
        }
    });
}

try {
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    viewport.append(renderer.domElement);
    function resize() {
        camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
        camera.position.z = Math.max(3.3, 3.6 / Math.max(0.25, camera.aspect) - 2.85);
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    resize();
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("click", event => {
        const rect = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
            1 - (event.clientY - rect.top) / rect.height * 2), camera);
        hitDestination();
    });
    setupVr().catch(() => { vr.hidden = true; });
    const pollGamepad = readGamepad();
    const useMenu = gamepadMenu("main button, main a[href]");
    renderer.setAnimationLoop(now => {
        const pad = !renderer.xr.isPresenting && pollGamepad();
        if (pad) useMenu(pad);
        if (route) {
            const t = T.MathUtils.clamp((now - route.start) / 1600, 0, 1);
            ship.position.lerpVectors(route.from, route.to, t * t * (3 - 2 * t));
            ship.position.z += Math.sin(t * Math.PI) * 0.28;
            if (t === 1) arrive();
        }
        renderer.render(scene, camera);
    });
} catch {
    viewport.hidden = true;
    setInterval(() => { if (route && performance.now() - route.start >= 1600) arrive(); }, 100);
}

function arrive() {
    const destination = destinations[selected];
    ship.position.copy(route.to);
    voyage.textContent = `Arrived at ${destination.name}.`;
    arrival.textContent = destination.work;
    exhibit.href = destination.path;
    exhibit.hidden = false;
    route = null;
}
