import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { Zipper } from "../../projects/languages/zipper/zipper.js";

const viewport = document.querySelector("#viewport");
const status = document.querySelector("#program-status");
const editor = document.querySelector("#program");
const step = document.querySelector("#step");
const run = document.querySelector("#run");
const reset = document.querySelector("#reset");
const scene = new T.Scene();
scene.background = new T.Color(0x241e24);
const camera = new T.PerspectiveCamera(46, 1, 0.05, 40);
const plinth = new T.Group();
scene.add(plinth);
scene.add(new T.HemisphereLight(0xffe1c4, 0x806779, 2.6));
const sun = new T.DirectionalLight(0xffce9f, 2.3);
sun.position.set(-3, 4, 4);
scene.add(sun);
const base = new T.Mesh(new T.CylinderGeometry(1.5, 1.6, 0.16, 48),
    new T.MeshStandardMaterial({ color: 0x74503e }));
base.position.y = -0.08;
plinth.add(base);
const sculpture = new T.Group();
plinth.add(sculpture);
const unit = 0.43;
const cube = new T.BoxGeometry(unit * 0.97, unit * 0.97, unit * 0.97);
const finishes = new Map(Object.entries({ bronze: 0xa65f3a, gold: 0xe0ae54, teal: 0x429c97 })
    .map(([name, color]) => [name, new T.MeshStandardMaterial({ color, roughness: 0.72 })]));
const cells = new Map();
let machine;
let source;
let busy = false;

function place(name, args, signal) {
    if (signal.aborted) throw new Error("The sculpture was reset.");
    if (name !== "block" || args.length !== 4 || args.some(arg => arg.kind !== "literal")) {
        throw new Error("This exhibit only exposes block(x, y, z, colour).");
    }
    const [x, y, z, color] = args.map(arg => arg.value);
    if (![x, y, z].every(Number.isInteger) || Math.abs(x) > 3 || y < 0 || y > 5 ||
        Math.abs(z) > 3 || !finishes.has(color)) {
        throw new Error("Block coordinates must be integers (x/z −3 to 3, y 0 to 5) and use a listed colour.");
    }
    const key = `${x},${y},${z}`;
    const existing = cells.get(key);
    if (existing) {
        existing.material = finishes.get(color);
    } else {
        const mesh = new T.Mesh(cube, finishes.get(color));
        mesh.position.set(x * unit, (y + 0.5) * unit, z * unit);
        sculpture.add(mesh);
        cells.set(key, mesh);
    }
    return { kind: "literal", value: null };
}

function buildMachine() {
    const next = editor.value;
    if (next.length > 6000) throw new Error("The exhibit accepts up to 6,000 characters.");
    const replacement = new Zipper(next, { callHost: place, stepLimit: 240 });
    machine = replacement;
    source = next;
    sculpture.clear();
    cells.clear();
    status.textContent = "Ready · Step or Run.";
}

async function execute(all) {
    if (busy) return;
    busy = true;
    step.disabled = run.disabled = reset.disabled = editor.disabled = true;
    try {
        if (!machine || source !== editor.value) buildMachine();
        do {
            const state = await machine.step();
            status.textContent = `${state.steps} rewrites · ${cells.size} blocks · ${state.message}`;
            if (!all || state.status !== "ready") break;
            await new Promise(resolve => requestAnimationFrame(resolve));
        } while (true);
    } catch (error) {
        status.textContent = error.message;
    } finally {
        busy = false;
        step.disabled = run.disabled = reset.disabled = editor.disabled = false;
    }
}

step.addEventListener("click", () => execute(false));
run.addEventListener("click", () => execute(true));
reset.addEventListener("click", () => {
    try { buildMachine(); } catch (error) { status.textContent = error.message; }
});

try {
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    viewport.append(renderer.domElement);
    function resize() {
        camera.aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
        camera.position.set(0, 1.75, Math.max(5.5, 4 / camera.aspect));
        camera.lookAt(0, 0.8, 0);
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
    resize();
    window.addEventListener("resize", resize);
    renderer.setAnimationLoop(time => {
        plinth.rotation.y = 0.24 + Math.sin(time / 2800) * 0.35;
        renderer.render(scene, camera);
    });
} catch {
    viewport.hidden = true;
}
execute(true);
