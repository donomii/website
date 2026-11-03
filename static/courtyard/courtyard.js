import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

const viewport = document.querySelector("#viewport");
const status = document.querySelector("#status");
const links = [...document.querySelectorAll("#exhibits a")];
const project = document.querySelector("#project");
const vr = document.querySelector("#vr");
const mapDoor = document.querySelector("#map-door");
const roomDoors = [
    { name: "Riverbank", x: 0, z: 10.25, button: document.querySelector("#river-door"),
        load: () => import("./riverbank.js").then(module => module.createRiverbank()) },
    { name: "Library", x: -4, z: 10.25, button: document.querySelector("#library-door"),
        load: () => import("./library.js").then(module => module.createLibrary()) },
];
const mapChoices = document.querySelector("#map-choices");
const callCreatures = document.querySelector("#call-creatures");
const carveButton = document.querySelector("#carve");
const carvingProgress = document.querySelector("#carving-progress");
const fitButton = document.querySelector("#fit");
const fitProgress = document.querySelector("#fit-progress");
const fitTarget = document.querySelector("#fit-target");
const fitTargetLabel = document.querySelector("#fit-target-label");
const maps = [
    { name: "Mediterranean", x: -5.4, z: -4.2, image: "/projects/entirety/mediterrainean.png", ridge: [-9, -9, 2.5] },
    { name: "Japan", x: -5.4, z: 2.4, image: "/projects/entirety/japan_with_cells_1.png", ridge: [4, -2, 3.2] },
];
const exhibits = [
    { x: -6, z: -10, image: "/projects/entirety/world_thumbnail256.png", note: "A world map assembled from large point datasets." },
    { x: -2, z: -10, image: "/projects/javascriptraymarcher/mandelbulb3_256.png", note: "A browser raymarcher for mathematical scenes." },
    { x: 2, z: -10, image: "/projects/starsandships/stars_screenshot.png", note: "An experimental browser space game." },
    { x: 6, z: -10, image: "/projects/creatures/creature.png", note: "A simulation of creatures and movable blocks." },
    { x: 5.6, z: -4.6, image: null, note: "Letter fitting · Choose a reference shape on the left and reconstruct it with solid letters on the right." },
];
const scene = new T.Scene();
scene.background = new T.Color(0x9cc5d7);
scene.fog = new T.Fog(0x9cc5d7, 35, 75);
const rig = new T.Group();
const camera = new T.PerspectiveCamera(66, 1, 0.06, 85);
rig.position.set(0, 0, 8.5);
camera.position.y = 1.68;
scene.add(rig);
rig.add(camera);

const material = color => new T.MeshStandardMaterial({ color, roughness: 0.92 });
const plaster = material(0xbe684a);
const stone = material(0xe5ca9e);
const brick = material(0x9b4837);
const bronze = material(0x765540);
const greenery = [material(0x597340), material(0x425931), material(0x809050)];
const floor = [0xd5b88c, 0xc3a783, 0xe2c49b, 0xbfa180].map(material);
let landscape;
let activeMap = maps[0];
let visibleMap;
let entering = false;
let inLandscape = false;
let navigationVersion = 0;
let creatures;
let creatureRequest;
let carving;
let carvingRequest;
let letterFit;
let fitRequest;

function mesh(geometry, finish, x, y, z) {
    const object = new T.Mesh(geometry, finish);
    object.position.set(x, y, z);
    scene.add(object);
    return object;
}

function box(w, h, d, x, y, z, finish) {
    return mesh(new T.BoxGeometry(w, h, d), finish, x, y, z);
}

function column(x, z) {
    box(0.75, 0.17, 0.75, x, 0.085, z, stone);
    mesh(new T.CylinderGeometry(0.21, 0.28, 3, 12), stone, x, 1.66, z);
    box(0.68, 0.22, 0.68, x, 3.28, z, stone);
}

function arch(x, z) {
    const arch = mesh(new T.TorusGeometry(1.56, 0.18, 6, 20, Math.PI), stone, x, 3.29, z);
    arch.scale.z = 1.5;
}

function planter(x, z) {
    mesh(new T.CylinderGeometry(0.46, 0.32, 0.65, 12), brick, x, 0.325, z);
    mesh(new T.CylinderGeometry(0.055, 0.08, 1.2, 7), bronze, x, 1.12, z);
    for (let layer = 0; layer < 3; layer++) {
        mesh(new T.DodecahedronGeometry(0.49 - layer * 0.08), greenery[layer],
            x + (layer % 2) * 0.12, 1.48 + layer * 0.38, z);
    }
}

function courtyard() {
    scene.add(new T.HemisphereLight(0xfff0cc, 0xa36751, 2.1));
    const sun = new T.DirectionalLight(0xffd6a1, 2.5);
    sun.position.set(-9, 13, 6);
    scene.add(sun);
    const tiles = new T.InstancedMesh(new T.BoxGeometry(0.986, 0.15, 0.986), material(0xffffff), 19 * 24);
    const placement = new T.Matrix4();
    let index = 0;
    for (let x = -9; x <= 9; x++) {
        for (let z = -12; z <= 11; z++) {
            tiles.setMatrixAt(index, placement.makeTranslation(x, -0.09, z));
            tiles.setColorAt(index, floor[Math.abs(x * 13 + z * 7) % 4].color);
            index++;
        }
    }
    scene.add(tiles);
    box(19, 5.6, 0.5, 0, 2.8, -12, plaster);
    box(0.5, 4.2, 23, -9.5, 2.1, -0.5, plaster);
    box(0.5, 4.2, 23, 9.5, 2.1, -0.5, plaster);
    for (const height of [0.42, 3.58, 5.43]) {
        box(19, 0.22, 0.64, 0, height, -11.94, stone);
    }
    for (const x of [-8, -4, 0, 4, 8]) column(x, -10.7);
    for (const x of [-6, -2, 2, 6]) arch(x, -10.7);
    for (const x of [-8, 8]) {
        box(1.45, 0.35, 17, x, 3.54, -1.9, stone);
        for (const z of [-7, -3, 1, 5]) column(x, z);
        for (const z of [-5, -0.5, 4, 8]) planter(x + (x < 0 ? 0.9 : -0.9), z);
    }
    const basin = new T.CylinderGeometry(1.25, 1.4, 0.35, 12);
    mesh(basin, stone, 0, 0.175, -1);
    mesh(new T.CylinderGeometry(1.1, 1.1, 0.04, 32), material(0x539496), 0, 0.36, -1);
    mesh(new T.CylinderGeometry(0.16, 0.24, 0.65, 12), stone, 0, 0.63, -1);
    mesh(new T.SphereGeometry(0.22, 14, 10), bronze, 0, 1.02, -1);
    for (const x of [-3.7, 3.7]) {
        box(2.1, 0.2, 0.7, x, 0.66, -1, stone);
        for (const dx of [-0.78, 0.78]) box(0.22, 0.55, 0.54, x + dx, 0.275, -1, stone);
    }
    for (const entry of maps) {
        box(4.55, 0.05, 2.85, entry.x, 0.015, entry.z, brick);
        entry.rug = mesh(new T.PlaneGeometry(4.25, 2.45),
            new T.MeshBasicMaterial({ color: 0xc29864, side: T.DoubleSide }), entry.x, 0.042, entry.z);
        entry.rug.rotation.x = -Math.PI / 2;
    }
}

function plaque(title) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#392922";
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = "#dbba85";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 492, 92);
    ctx.fillStyle = "#ffedcb";
    ctx.font = "42px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(title, 256, 71, 454);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: texture });
}

function mosaic(index) {
    const palette = [
        [0x345856, 0x7d9b81, 0xc6b58d],
        [0x673d42, 0xb67457, 0xe4b17c],
        [0x343e60, 0x65798e, 0xd0ac74],
        [0x566244, 0x8a9760, 0xcfb88a],
    ][index];
    const tiles = new T.InstancedMesh(new T.PlaneGeometry(0.112, 0.112),
        new T.MeshBasicMaterial(), 20 * 14);
    const transform = new T.Matrix4();
    const color = new T.Color();
    for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 20; x++) {
            const cell = y * 20 + x;
            const diamond = Math.abs(x - 9.5) + Math.abs(y - 6.5);
            const band = diamond === 6 || x === 0 || y === 0 || x === 19 || y === 13 ? 2 :
                Math.floor(diamond / 2) % 2;
            tiles.setMatrixAt(cell, transform.makeTranslation((x - 9.5) * 0.118, (y - 6.5) * 0.118, 0));
            tiles.setColorAt(cell, color.setHex(palette[band]).multiplyScalar(0.93 + (cell % 7) * 0.017));
        }
    }
    return tiles;
}

function mountExhibits() {
    exhibits.forEach((entry, index) => {
        if (index === 4) {
            entry.marker = mesh(new T.RingGeometry(0.29, 0.35, 30),
                new T.MeshBasicMaterial({ color: 0xe9ab68, side: T.DoubleSide }), entry.x, 0.012, entry.z + 1.3);
            entry.marker.rotation.x = -Math.PI / 2;
            return;
        }
        box(2.7, 2.1, 0.19, entry.x, 2.12, -11.7, stone);
        entry.panel = mesh(new T.PlaneGeometry(2.36, 1.68), new T.MeshBasicMaterial({ color: 0x725c4e }),
            entry.x, 2.17, -11.59);
        entry.mosaic = mosaic(index);
        entry.mosaic.position.set(entry.x, 2.17, -11.58);
        scene.add(entry.mosaic);
        mesh(new T.PlaneGeometry(2.43, 0.52), plaque(links[index].textContent),
            entry.x, 0.82, -11.58);
        entry.marker = mesh(new T.RingGeometry(0.28, 0.34, 30),
            new T.MeshBasicMaterial({ color: 0xe9ab68, side: T.DoubleSide }), entry.x, 0.012, -8.4);
        entry.marker.rotation.x = -Math.PI / 2;
    });
}

function loadExhibit(entry) {
    if (entry.requested || !entry.image) return;
    entry.requested = true;
    new T.TextureLoader().load(entry.image, texture => {
        texture.colorSpace = T.SRGBColorSpace;
        const ratio = texture.image.width / texture.image.height;
        entry.panel.scale.set(Math.min(1, ratio * 1.68 / 2.36), Math.min(1, 2.36 / (ratio * 1.68)), 1);
        entry.panel.material.color.setHex(0xffffff);
        entry.panel.material.map = texture;
        entry.panel.material.needsUpdate = true;
        entry.mosaic.visible = false;
    }, undefined, () => { entry.requested = false; });
}

function loadMap(entry) {
    if (!entry.texture) {
        entry.texture = new T.TextureLoader().loadAsync(entry.image).then(texture => {
            texture.colorSpace = T.SRGBColorSpace;
            entry.rug.material.map = texture;
            entry.rug.material.color.setHex(0xffffff);
            entry.rug.material.needsUpdate = true;
            return texture;
        }).catch(error => {
            entry.texture = null;
            throw error;
        });
    }
    return entry.texture;
}

function visitMap(entry) {
    navigationVersion++;
    rig.position.set(entry.x, 0, entry.z + 2.4);
    yaw = pitch = 0;
    camera.rotation.set(0, 0, 0);
    loadMap(entry).catch(() => {});
}

let yaw = 0;
let pitch = 0;
let active = -1;
const keys = new Set();
function loadCreatures() {
    if (!creatureRequest) {
        creatureRequest = import("./creatures.js").then(module => module.createCreatures(scene))
            .then(result => { creatures = result; })
            .catch(error => {
                console.warn("Could not load courtyard creatures", error);
                if (active === 3 && !inLandscape) status.textContent = "Creatures could not load. Select Creatures to retry.";
                creatureRequest = null;
            });
    }
    return creatureRequest;
}

function loadCarving() {
    if (!carvingRequest) {
        carvingRequest = import("./carving.js")
            .then(module => { carving = module.createCarving(scene, exhibits[1].x, -9.55); })
            .catch(error => {
                console.warn("Could not load the carving exhibit", error);
                if (active === 1 && !inLandscape) status.textContent = "The carving could not load. Select Raymarcher to retry.";
                carvingRequest = null;
            });
    }
    return carvingRequest;
}

function visit(index) {
    navigationVersion++;
    if (inLandscape) leaveMap();
    const entry = exhibits[index];
    if (index === 0) {
        visitMap(maps[0]);
    } else if (index === 3) {
        rig.position.set(3.6, 0, 7.8);
        loadCreatures();
    } else if (index === 1) {
        rig.position.set(entry.x, 0, -6.5);
        loadCarving();
    } else if (index === 4) {
        rig.position.set(entry.x, 0, -0.8);
        loadLetterFit();
    } else {
        rig.position.set(entry.x, 0, -8.4);
    }
    yaw = 0;
    pitch = 0;
    camera.rotation.set(0, 0, 0);
    loadExhibit(entry);
}

async function enterMap(entry = visibleMap || maps[0]) {
    if (entering || inLandscape) return;
    entering = true;
    const version = navigationVersion;
    try {
        if (!entry.landscape) {
            if (entry.load) {
                entry.landscape = await entry.load();
            } else {
                const [map, module] = await Promise.all([loadMap(entry), import("./landscape.js")]);
                entry.landscape = module.createLandscape(map, entry.ridge);
            }
        }
        if (version !== navigationVersion) return;
        activeMap = entry;
        landscape = entry.landscape;
        inLandscape = true;
        callCreatures.hidden = true;
        carveButton.hidden = true;
        carvingProgress.hidden = true;
        fitButton.hidden = fitProgress.hidden = fitTargetLabel.hidden = true;
        mapChoices.hidden = true;
        for (const room of roomDoors) room.button.hidden = true;
        mapDoor.hidden = false;
        landscape.scene.add(rig);
        rig.position.set(0, landscape.height(0, 8), 8);
        yaw = 0;
        pitch = -0.16;
        status.textContent = `${entry.load ? entry.name : `Entirety · ${entry.name} relief`}. Walk to the bronze ring to return.`;
        mapDoor.textContent = "Return to courtyard";
    } catch {
        if (version === navigationVersion) status.textContent = `${entry.name} could not load. Try again.`;
    } finally {
        entering = false;
    }
}

function leaveMap() {
    inLandscape = false;
    scene.add(rig);
    if (activeMap.load) {
        rig.position.set(activeMap.x, 0, 8.5);
        yaw = pitch = 0;
        camera.rotation.set(0, 0, 0);
        for (const room of roomDoors) room.button.hidden = false;
    } else {
        visitMap(activeMap);
    }
    active = null;
    mapDoor.textContent = "Enter the map";
}

function updateExhibit() {
    if (inLandscape) return;
    const nearbyMap = maps.find(entry => Math.hypot(entry.x - rig.position.x, entry.z - rig.position.z) < 3.2);
    const nearCreatures = rig.position.x > 1.8 && rig.position.z > 0.5;
    const nearFit = Math.hypot(exhibits[4].x - rig.position.x, exhibits[4].z - rig.position.z) < 4;
    const index = nearbyMap ? 0 : nearFit ? 4 : nearCreatures ? 3 : exhibits.findIndex(entry =>
        Math.hypot(entry.x - rig.position.x, entry.z - rig.position.z) < 3.6);
    callCreatures.hidden = index !== 3;
    carveButton.hidden = index !== 1;
    carvingProgress.hidden = index !== 1;
    fitButton.hidden = fitProgress.hidden = fitTargetLabel.hidden = index !== 4;
    if (index === active && nearbyMap === visibleMap) return;
    active = index;
    visibleMap = nearbyMap;
    links.forEach((link, i) => link.setAttribute("aria-current", String(i === index)));
    project.hidden = index < 0;
    mapDoor.hidden = index !== 0;
    mapChoices.hidden = index !== 0;
    mapDoor.textContent = `Enter ${(nearbyMap || maps[0]).name} map`;
    status.textContent = index === 0 ? `Entirety · Step onto the ${(nearbyMap || maps[0]).name} rug to explore its relief.` :
        index === 3 ? "Creatures roam between the entrance and the fountain. Call them over to meet them." :
        index === 1 ? "Raymarcher · Watch rays remove stone until they reach a hidden torus." :
        index < 0 ? "Choose an exhibit to visit." : exhibits[index].note;
    if (index >= 0) {
        project.href = links[index].href;
        loadExhibit(exhibits[index]);
        if (index === 0) loadMap(nearbyMap || maps[0]).catch(() => {});
        if (index === 3) loadCreatures();
        if (index === 1) loadCarving();
        if (index === 4) loadLetterFit();
    }
}

function loadLetterFit() {
    if (!fitRequest) {
        fitRequest = import("./letter-fit.js").then(module => { letterFit = module.createLetterFit(scene); })
            .catch(error => {
                console.warn("Could not load letter fitting", error);
                if (active === 4 && !inLandscape) status.textContent = "Letter fitting could not load. Select the exhibit to retry.";
                fitRequest = null;
            });
    }
    return fitRequest;
}

function bindDesktop(renderer) {
    const surface = renderer.domElement;
    let pointer = null;
    surface.addEventListener("pointerdown", event => {
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("pointermove", event => {
        if (pointer?.id !== event.pointerId) return;
        yaw -= (event.clientX - pointer.x) * 0.004;
        pitch = T.MathUtils.clamp(pitch - (event.clientY - pointer.y) * 0.004, -1.25, 1.25);
        pointer.x = event.clientX;
        pointer.y = event.clientY;
    });
    surface.addEventListener("lostpointercapture", () => { pointer = null; });
    window.addEventListener("keydown", event => {
        if (event.target instanceof HTMLSelectElement) return;
        const key = event.key.toLowerCase();
        if (event.altKey || event.metaKey || event.ctrlKey || !["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) return;
        keys.add(key);
        event.preventDefault();
    });
    window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => keys.clear());
    links.forEach((link, index) => link.addEventListener("click", event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        visit(index);
    }));
}

function walk(dt) {
    const forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
    const right = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
    const speed = dt * 3.4 / Math.max(1, Math.hypot(forward, right));
    const nextX = rig.position.x + speed * (right * Math.cos(yaw) - forward * Math.sin(yaw));
    const nextZ = rig.position.z - speed * (right * Math.sin(yaw) + forward * Math.cos(yaw));
    if (inLandscape) {
        const limitX = landscape.limitX ?? 27.5;
        const x = T.MathUtils.clamp(nextX, -limitX, limitX);
        const limitZ = landscape.limitZ ?? 15.5;
        const z = T.MathUtils.clamp(nextZ, -limitZ, limitZ);
        rig.position.set(x, landscape.height(x, z), z);
        if (Math.hypot(x, z - 12) < 0.75) leaveMap();
    } else {
        const x = T.MathUtils.clamp(nextX, -7.7, 7.7);
        const z = T.MathUtils.clamp(nextZ, -10.1, 10.5);
        if (Math.hypot(x, z + 1) > 1.5) rig.position.set(x, 0, z);
        const steppedOn = maps.find(entry => Math.abs(x - entry.x) < 1.5 && Math.abs(z - entry.z) < 0.65);
        if (steppedOn && (forward || right)) enterMap(steppedOn);
        else if (forward || right) {
            const room = roomDoors.find(entry => Math.hypot(x - entry.x, z - entry.z) < 0.65);
            if (room) enterMap(room);
        }
    }
    camera.rotation.set(pitch, yaw, 0, "YXZ");
}

async function bindVR(renderer) {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    for (let i = 0; i < 2; i++) {
        const controller = renderer.xr.getController(i);
        const beam = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -12)]),
            new T.LineBasicMaterial({ color: 0xffdf9f }));
        controller.add(beam);
        rig.add(controller);
        controller.addEventListener("select", () => {
            const ray = new T.Raycaster(controller.getWorldPosition(new T.Vector3()),
                new T.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new T.Quaternion())));
            if (inLandscape) {
                const hit = ray.intersectObjects([landscape.exit, landscape.surface])[0];
                if (hit?.object === landscape.exit) leaveMap();
                else if (hit) rig.position.copy(hit.point);
            } else {
                const hit = ray.intersectObjects([...roomDoors.map(entry => entry.marker), ...maps.map(entry => entry.rug),
                    ...exhibits.flatMap(entry => [entry.marker, entry.panel].filter(Boolean))])[0];
                const map = maps.find(entry => entry.rug === hit?.object);
                const room = roomDoors.find(entry => entry.marker === hit?.object);
                if (room) enterMap(room);
                else if (map) enterMap(map);
                else if (hit) {
                    const index = exhibits.findIndex(entry => [entry.marker, entry.panel].includes(hit.object));
                    if (index === 1 && active === 1 && carving) carving.start();
                    else if (index === 4 && active === 4 && letterFit) letterFit.start();
                    else visit(index);
                }
            }
        });
    }
    vr.hidden = false;
    vr.addEventListener("click", async () => {
        try {
            const session = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });
            await renderer.xr.setSession(session);
        } catch (error) {
            status.textContent = `VR could not start: ${error.message}`;
        }
    });
}

function start() {
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
    courtyard();
    mountExhibits();
    for (const room of roomDoors) {
        room.marker = new T.Mesh(new T.TorusGeometry(1, 0.12, 10, 40), stone);
        room.marker.position.set(room.x, 1.1, room.z);
        scene.add(room.marker);
        room.button.addEventListener("click", () => enterMap(room));
    }
    bindDesktop(renderer);
    mapDoor.addEventListener("click", () => { if (inLandscape) leaveMap(); else enterMap(); });
    mapChoices.querySelectorAll("button").forEach(button =>
        button.addEventListener("click", () => visitMap(maps[Number(button.dataset.map)])));
    callCreatures.addEventListener("click", async () => {
        await loadCreatures();
        if (creatures && active === 3 && !inLandscape) creatures.call(rig.position);
    });
    carveButton.addEventListener("click", async () => {
        await loadCarving();
        if (active === 1 && !inLandscape) carving?.start();
    });
    fitButton.addEventListener("click", async () => {
        await loadLetterFit();
        if (active === 4 && !inLandscape) letterFit?.start();
    });
    fitTarget.addEventListener("change", async () => {
        await loadLetterFit();
        letterFit?.setTarget(fitTarget.value);
    });
    bindVR(renderer).catch(() => { vr.hidden = true; });
    let previous = performance.now();
    renderer.setAnimationLoop(now => {
        const frameMs = Math.max(0, now - previous);
        const dt = Math.min(0.05, frameMs / 1000);
        previous = now;
        if (!renderer.xr.isPresenting) walk(dt);
        updateExhibit();
        if (!inLandscape) creatures?.update(now / 1000, dt);
        if (!inLandscape && active === 1 && carving) {
            const { active: working, nextRay, rayCount, removed } = carving.update();
            carveButton.disabled = working;
            const progress = nextRay === 0 ? "" : `${nextRay}/${rayCount} rays · ${removed} chips`;
            if (carvingProgress.value !== progress) carvingProgress.value = progress;
        }
        if (!inLandscape && active === 4 && letterFit) {
            const { running, letters, error, initial, examined, worstMs, meanFrameMs } = letterFit.update(frameMs);
            fitButton.disabled = running;
            const progress = examined === 0 ? "" :
                `${letters || "Sampling"} · voxel error ${initial} → ${error} · ${examined} candidates · worst CPU step ${worstMs.toFixed(1)} ms · mean frame interval ${meanFrameMs.toFixed(1)} ms`;
            if (fitProgress.value !== progress) fitProgress.value = progress;
        }
        renderer.render(inLandscape ? landscape.scene : scene, camera);
    });
}

try {
    start();
} catch (error) {
    status.textContent = "3D is unavailable here. The exhibit links open the projects directly.";
    console.error(error);
}
