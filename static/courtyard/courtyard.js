import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { gamepadMenu, readGamepad } from "./gamepad.js";
import { attachVrInput, thumbsticks, vrSessionOptions } from "./xr-input.js";
import {
    ADJACENT, DOOR_ENTRANCES, ZONES, ZONE_MAP,
    buildArchitecture, inDoorway, roomLocalToWorld, worldToRoomLocal, zoneAt,
} from "./world-layout.js";

const viewport = document.querySelector("#viewport");
const status = document.querySelector("#status");
const links = [...document.querySelectorAll("#exhibits a")];
const project = document.querySelector("#project");
const vr = document.querySelector("#vr");
const menuToggle = document.querySelector("#menu-toggle");
const mapChoices = document.querySelector("#map-choices");
const callCreatures = document.querySelector("#call-creatures");
const carveButton = document.querySelector("#carve");
const carvingProgress = document.querySelector("#carving-progress");
const fitButton = document.querySelector("#fit");
const fitProgress = document.querySelector("#fit-progress");
const fitTarget = document.querySelector("#fit-target");
const fitTargetLabel = document.querySelector("#fit-target-label");
const destination = document.querySelector("#destination");
const aim = document.querySelector("#aim");

function setMenu(open) {
    document.body.toggleAttribute("data-menu-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close gallery menu" : "Open gallery menu");
    if (open) menuToggle.focus();
    else viewport.querySelector("canvas")?.focus();
}
menuToggle.addEventListener("click", () => setMenu(!document.body.hasAttribute("data-menu-open")));

const ROOM_SPECS = [
    {
        id: "station",
        buttonId: "station-door",
        focalLocal: [0, 1.3, -1.3],
        projectHref: "../../projects/games/accumulative-station/index.html",
        hint: "Choose a module blueprint on the console, select a room, then a glowing port to extend it.",
        load: () => import("./station-room.js").then(m => m.createStationRoom(msg => { status.textContent = msg; })),
    },
    {
        id: "art-deco",
        buttonId: "art-deco-door",
        focalLocal: [0, 1.6, -1.6],
        hint: "Art Deco salon · Stroll around the celestial armillary sculpture.",
        load: () => import("./art-deco.js").then(m => m.createArtDecoRoom()),
    },
    {
        id: "river",
        buttonId: "river-door",
        focalLocal: [0, 1.0, -3.0],
        hint: "Riverbank · Follow the sandy path through the sunlit trees.",
        load: () => import("./riverbank.js").then(m => m.createRiverbank()),
    },
    {
        id: "library",
        buttonId: "library-door",
        focalLocal: [0, 1.6, -2.0],
        hint: "Library · Browse the reading hall tables and high timbered shelves.",
        load: () => import("./library.js").then(m => m.createLibrary()),
    },
    {
        id: "aquarium",
        buttonId: "aquarium-door",
        focalLocal: [0, 1.2, -1.0],
        projectHref: "../../projects/games/games-aquarium/index.html",
        hint: "Games Aquarium · Select a creature species then tap the tank floor to spawn it.",
        load: () => import("./aquarium-room.js").then(m => m.createAquariumRoom()),
    },
    {
        id: "asteroid",
        buttonId: "asteroid-door",
        focalLocal: [0, 1.2, -0.8],
        projectHref: "../../projects/games/asteroid-farmer/index.html",
        hint: "Asteroid Farmer · Select soil to plant or harvest and structures to build.",
        load: () => import("./asteroid-room.js").then(m => m.createAsteroidRoom(msg => { status.textContent = msg; })),
    },
    {
        id: "datatree",
        buttonId: "datatree-door",
        focalLocal: [0, 1.5, -2.4],
        hint: "Datatree · Select interactive branches and archive nodes on the stone wall.",
        load: () => import("./datatree.js").then(m => m.createDatatreeRoom()),
    },
    {
        id: "jump",
        buttonId: "jump-door",
        focalLocal: [0, 1.3, -1.8],
        hint: "Jump · Original blocky Racket figures jumping and dancing on their own.",
        load: () => import("./jump.js?v=racket-models").then(m => m.createJumpRoom()),
    },
    {
        id: "orbit",
        buttonId: "orbit-door",
        focalLocal: [0, 1.4, -0.8],
        projectHref: "/projects/starsandships/webview.html",
        hint: "Stars & Ships · Select a destination planet to launch an orbital route.",
        load: () => import("./orbit.js").then(m => m.createOrbitRoom(msg => { status.textContent = msg; })),
    },
    {
        id: "converter",
        buttonId: "converter-door",
        focalLocal: [0, 1.55, 0],
        hint: "Map conversion · Select the globe or plaques to turn and convert points.",
        load: () => import("./converter.js").then(m => m.createConverterRoom()),
    },
    {
        id: "solids",
        buttonId: "solids-door",
        focalLocal: [0, 1.2, 0],
        hint: "Pocket Bonsai · Select generation plaques to reshape the voxel solid.",
        load: () => import("./solids.js").then(m => m.createSolidsRoom()),
    },
    {
        id: "program",
        buttonId: "program-door",
        focalLocal: [0, 1.2, 0],
        hint: "Zipper studio · Step, run, or reset the spatial instruction machine.",
        load: () => import("./program.js").then(m => m.createProgramRoom()),
    },
    {
        id: "lworld",
        buttonId: "lworld-door",
        focalLocal: [0, 1.3, -0.9],
        hint: "L-World · Turn the turtle sculpture or open the full editor from the menu.",
        load: () => import("./lworld-gallery.js").then(m => m.createLWorldRoom()),
    },
];

// Framed Entirety map pictures mounted on West & East courtyard gallery walls (no floor rugs).
const galleryMaps = [
    { name: "Mediterranean", x: -9.85, z: -5.2, rotY: Math.PI / 2, image: "/projects/entirety/mediterrainean.png" },
    { name: "Japan", x: -9.85, z: 4.75, rotY: Math.PI / 2, image: "/projects/entirety/japan_with_cells_1.png" },
    { name: "Europe", x: 9.85, z: -5.2, rotY: -Math.PI / 2, image: "/projects/entirety/europe_colour.png" },
    { name: "Africa", x: 9.85, z: 4.75, rotY: -Math.PI / 2, image: "/projects/entirety/africafire.png" },
];

const exhibits = [
    { x: -6, z: -13.72, image: "/projects/entirety/world_thumbnail256.png", note: "Entirety · Explore Mediterranean, Japan, Europe, and Africa gallery maps on the side walls." },
    { x: -2, z: -13.72, image: "/projects/javascriptraymarcher/mandelbulb3_256.png", note: "Raymarcher · Watch golden rays chip away stone to reveal the hidden torus." },
    { x: 2, z: -13.72, image: "/projects/starsandships/stars_screenshot.png", note: "Stars & Ships · Walk through the East Space Hall doorway to dispatch the orbital craft." },
    { x: 6, z: -13.72, image: "/projects/creatures/creature.png", note: "Creatures · Fox and Bunny explore the courtyard — call them over to meet them." },
    { x: 4.5, z: -4.75, image: null, note: "Letter fitting · Choose a reference shape on the left and reconstruct it with solid letters on the right." },
];

const scene = new T.Scene();
const skyColor = new T.Color(0x9cc5d7);
const riverColor = new T.Color(0xe8c5a5);
const indoorColor = new T.Color(0x161210);
const spaceColor = new T.Color(0x060c18);
const outdoorFog = new T.Fog(0x9cc5d7, 38, 86);
const riverFog = new T.Fog(0xe8c5a5, 36, 80);
scene.background = skyColor.clone();
scene.fog = outdoorFog;

const rig = new T.Group();
const camera = new T.PerspectiveCamera(66, 1, 0.06, 115);
rig.position.set(0, 0, 8.5);
camera.position.y = 1.68;
scene.add(rig);
rig.add(camera);

const matCache = color => new T.MeshStandardMaterial({ color, roughness: 0.92 });
const stone = matCache(0xe5ca9e);
const brick = matCache(0x9b4837);
const bronze = matCache(0x765540);
const frameWood = new T.MeshStandardMaterial({ color: 0x3b281d, roughness: 0.68 });
const matCream = new T.MeshStandardMaterial({ color: 0xeadcc5, roughness: 0.9 });
const greenery = [matCache(0x597340), matCache(0x425931), matCache(0x809050)];
const floorTilesPalette = [0xd5b88c, 0xc3a783, 0xe2c49b, 0xbfa180].map(matCache);

const arch = buildArchitecture(scene);
const wallMeshes = [...arch.wallMeshes];
const floorMeshes = [...arch.floorMeshes];

const obstacles = [];
const roomLight = new T.PointLight(0xfff0dd, 0, 26, 1.1);
roomLight.position.set(0, 3.8, 0);
scene.add(roomLight);

function addMesh(geometry, finish, x, y, z) {
    const object = new T.Mesh(geometry, finish);
    object.position.set(x, y, z);
    scene.add(object);
    return object;
}

function addBox(w, h, d, x, y, z, finish) {
    return addMesh(new T.BoxGeometry(w, h, d), finish, x, y, z);
}

function column(x, z) {
    addBox(0.75, 0.17, 0.75, x, 0.085, z, stone);
    addMesh(new T.CylinderGeometry(0.21, 0.28, 3, 12), stone, x, 1.66, z);
    addBox(0.68, 0.22, 0.68, x, 3.28, z, stone);
    obstacles.push({ kind: "circle", x, z, r: 0.65 });
}

function archSpan(x, z) {
    const arc = addMesh(new T.TorusGeometry(1.56, 0.18, 6, 20, Math.PI), stone, x, 3.29, z);
    arc.scale.z = 1.5;
}

function planter(x, z) {
    addMesh(new T.CylinderGeometry(0.46, 0.32, 0.65, 12), brick, x, 0.325, z);
    addMesh(new T.CylinderGeometry(0.055, 0.08, 1.2, 7), bronze, x, 1.12, z);
    for (let layer = 0; layer < 3; layer++) {
        addMesh(new T.DodecahedronGeometry(0.49 - layer * 0.08), greenery[layer],
            x + (layer % 2) * 0.12, 1.48 + layer * 0.38, z);
    }
    obstacles.push({ kind: "circle", x, z, r: 0.75 });
}

function plaqueMaterial(title) {
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
    ctx.font = "40px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(title, 256, 71, 454);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: texture });
}

function mosaicMesh(index) {
    const palette = [
        [0x345856, 0x7d9b81, 0xc6b58d],
        [0x673d42, 0xb67457, 0xe4b17c],
        [0x343e60, 0x65798e, 0xd0ac74],
        [0x566244, 0x8a9760, 0xcfb88a],
    ][index % 4];
    const tiles = new T.InstancedMesh(new T.PlaneGeometry(0.112, 0.112), new T.MeshBasicMaterial(), 20 * 14);
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

function buildCourtyard() {
    scene.add(new T.HemisphereLight(0xfff0cc, 0xa36751, 2.0));
    const sun = new T.DirectionalLight(0xffd6a1, 2.35);
    sun.position.set(-9, 13, 6);
    scene.add(sun);

    const subfloor = new T.Mesh(new T.PlaneGeometry(20, 28).rotateX(-Math.PI / 2), matCache(0x8d7258));
    subfloor.position.y = -0.025;
    scene.add(subfloor);
    floorMeshes.push(subfloor);

    const tiles = new T.InstancedMesh(new T.BoxGeometry(0.986, 0.14, 0.986), matCache(0xffffff), 21 * 29);
    const placement = new T.Matrix4();
    let idx = 0;
    for (let x = -10; x <= 10; x++) {
        for (let z = -14; z <= 14; z++) {
            tiles.setMatrixAt(idx, placement.makeTranslation(x, -0.085, z));
            tiles.setColorAt(idx, floorTilesPalette[Math.abs(x * 13 + z * 7) % 4].color);
            idx++;
        }
    }
    scene.add(tiles);

    // North arcade colonnade framing the 4 showcase panels.
    for (const x of [-8, -4, 0, 4, 8]) column(x, -12.4);
    for (const x of [-6, -2, 2, 6]) archSpan(x, -12.4);

    // West & East colonnades aligned so every doorway & gallery map bay remains wide open.
    for (const x of [-7.8, 7.8]) {
        addBox(1.1, 0.32, 25.8, x, 3.54, 0, stone);
        for (const z of [-12.4, -8.0, -2.4, 2.4, 7.1, 12.6]) column(x, z);
    }
    for (const x of [-8.7, 8.7]) {
        for (const z of [-8.3, -2.1, 2.1, 6.7]) planter(x, z);
    }

    // Central limestone fountain.
    addMesh(new T.CylinderGeometry(1.25, 1.4, 0.35, 12), stone, 0, 0.175, -1);
    addMesh(new T.CylinderGeometry(1.1, 1.1, 0.04, 32), matCache(0x539496), 0, 0.36, -1);
    addMesh(new T.CylinderGeometry(0.16, 0.24, 0.65, 12), stone, 0, 0.63, -1);
    addMesh(new T.SphereGeometry(0.22, 14, 10), bronze, 0, 1.02, -1);
    obstacles.push({ kind: "circle", x: 0, z: -1, r: 1.6 });

    // Flanking garden benches.
    for (const x of [-3.7, 3.7]) {
        addBox(2.1, 0.2, 0.7, x, 0.66, -1, stone);
        for (const dx of [-0.78, 0.78]) addBox(0.22, 0.55, 0.54, x + dx, 0.275, -1, stone);
        obstacles.push({ kind: "box", x, z: -1, hx: 1.28, hz: 0.62 });
    }

    // Obstacle reservations for main-room carving & letter-fit pedestals.
    obstacles.push({ kind: "circle", x: -2, z: -10.6, r: 0.92 });
    obstacles.push({ kind: "box", x: 4.5, z: -4.75, hx: 1.35, hz: 0.78 });

    // Mount framed Entirety Map Gallery pictures along the West & East courtyard walls.
    for (const [index, entry] of galleryMaps.entries()) {
        const holder = new T.Group();
        holder.position.set(entry.x, 0, entry.z);
        holder.rotation.y = entry.rotY;
        const frame = new T.Mesh(new T.BoxGeometry(3.75, 2.38, 0.12), frameWood);
        frame.position.set(0, 2.08, 0.04);
        const matte = new T.Mesh(new T.BoxGeometry(3.48, 2.12, 0.03), matCream);
        matte.position.set(0, 2.08, 0.095);
        entry.panel = new T.Mesh(new T.PlaneGeometry(3.26, 1.9), new T.MeshBasicMaterial({ color: 0xc29864 }));
        entry.panel.position.set(0, 2.08, 0.114);
        entry.panel.userData.galleryMap = entry;
        entry.mosaic = mosaicMesh(index);
        entry.mosaic.scale.set(1.36, 1.12, 1);
        entry.mosaic.position.set(0, 2.08, 0.116);
        const label = new T.Mesh(new T.PlaneGeometry(2.35, 0.48), plaqueMaterial(`Entirety · ${entry.name}`));
        label.position.set(0, 0.62, 0.04);
        holder.add(frame, matte, entry.panel, entry.mosaic, label);
        scene.add(holder);
    }

    // Mount North Wall showcase frames & plaques.
    exhibits.forEach((entry, index) => {
        if (index === 4) return;
        addBox(2.7, 2.1, 0.19, entry.x, 2.12, entry.z, stone);
        entry.panel = addMesh(new T.PlaneGeometry(2.36, 1.68), new T.MeshBasicMaterial({ color: 0x725c4e }),
            entry.x, 2.17, entry.z + 0.11);
        entry.mosaic = mosaicMesh(index);
        entry.mosaic.position.set(entry.x, 2.17, entry.z + 0.12);
        scene.add(entry.mosaic);
        addMesh(new T.PlaneGeometry(2.43, 0.5), plaqueMaterial(links[index].textContent),
            entry.x, 0.78, entry.z + 0.12);
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
            const ratio = texture.image.width / texture.image.height;
            entry.panel.scale.set(Math.min(1, ratio * 1.9 / 3.26), Math.min(1, 3.26 / (ratio * 1.9)), 1);
            entry.panel.material.map = texture;
            entry.panel.material.color.setHex(0xffffff);
            entry.panel.material.needsUpdate = true;
            entry.mosaic.visible = false;
            return texture;
        }).catch(error => {
            entry.texture = null;
            throw error;
        });
    }
    return entry.texture;
}

// Material state helpers for smooth look-based fading without overwriting dynamic opacities.
function collectMaterials(root) {
    const map = new Map();
    root.traverse(obj => {
        if (!obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
            if (!map.has(mat)) map.set(mat, { mat, origTransparent: mat.transparent, origOpacity: mat.opacity ?? 1 });
        }
    });
    return [...map.values()];
}

function applyFade(state, nextFade) {
    state.fade = nextFade;
    const clamped = nextFade <= 0.01 ? 0 : nextFade >= 0.99 ? 1 : nextFade;
    state.group.visible = clamped > 0;
    if (Math.abs(clamped - state.appliedFade) < 0.002) return;
    if (state.appliedFade >= 0.999 && clamped < 0.999) {
        for (const item of state.materials) {
            item.origTransparent = item.mat.transparent;
            item.origOpacity = item.mat.opacity ?? 1;
        }
    }
    for (const item of state.materials) {
        if (clamped >= 0.999) {
            item.mat.transparent = item.origTransparent;
            item.mat.opacity = item.origOpacity;
        } else if (clamped > 0) {
            item.mat.transparent = true;
            item.mat.opacity = item.origOpacity * clamped;
        }
    }
    state.appliedFade = clamped;
}

// Room management in one continuous world.
const roomStates = new Map();
for (const spec of ROOM_SPECS) {
    const zone = ZONE_MAP.get(spec.id);
    const [fx, fz] = roomLocalToWorld(zone, spec.focalLocal[0], spec.focalLocal[2]);
    roomStates.set(spec.id, {
        spec,
        zone,
        button: document.getElementById(spec.buttonId),
        focalWorld: new T.Vector3(fx, spec.focalLocal[1], fz),
        promise: null,
        room: null,
        group: null,
        materials: [],
        fade: 0,
        appliedFade: 1,
        active: false,
    });
}

function mountRoom(state, room) {
    const { zone } = state;
    const group = new T.Group();
    group.position.set(zone.cx, 0, zone.cz);
    group.rotation.y = zone.yaw;
    group.visible = false;
    scene.add(group);

    for (const child of [...room.scene.children]) {
        if (child.isLight) continue;
        if (child === room.exit) continue;
        if (!zone.ownWalls && child === room.surface) continue;
        group.add(child);
    }

    if (zone.ownWalls && room.surface) floorMeshes.push(room.surface);
    if (["art-deco", "library", "station"].includes(zone.id)) {
        group.updateMatrixWorld(true);
        const box = new T.Box3();
        group.traverse(obj => {
            if (!obj.isMesh || obj === room.surface) return;
            box.setFromObject(obj);
            if (box.max.y - box.min.y >= 2.2) wallMeshes.push(obj);
        });
    }

    state.room = room;
    state.group = group;
    state.materials = collectMaterials(group);
    state.appliedFade = 1;
    applyFade(state, 0);
}

function loadZone(id) {
    const state = roomStates.get(id);
    if (!state) return Promise.resolve(null);
    if (!state.promise) {
        state.promise = state.spec.load().then(room => {
            mountRoom(state, room);
            return state;
        }).catch(err => {
            console.warn(`Could not load room ${id}`, err);
            state.promise = null;
            return null;
        });
    }
    return state.promise;
}

// Main courtyard interactive exhibits + look-based pause/fade wrappers.
let carvingState = null;
let fitState = null;
let creaturesState = null;
let carvingRequest = null;
let fitRequest = null;
let creatureRequest = null;

function createExhibitFadeState(group, api, focalPos) {
    const state = {
        group,
        api,
        focalWorld: focalPos,
        materials: collectMaterials(group),
        fade: 0,
        appliedFade: 1,
    };
    applyFade(state, 0);
    return state;
}

function loadCarving() {
    if (!carvingRequest) {
        carvingRequest = import("./carving.js").then(async m => {
            const api = await m.createCarving(scene, exhibits[1].x, -10.6);
            carvingState = createExhibitFadeState(api.group, api, new T.Vector3(exhibits[1].x, 1.3, -10.6));
            return carvingState;
        }).catch(err => {
            console.warn("Could not load carving exhibit", err);
            carvingRequest = null;
            return null;
        });
    }
    return carvingRequest;
}

function loadLetterFit() {
    if (!fitRequest) {
        fitRequest = import("./letter-fit.js").then(m => {
            const api = m.createLetterFit(scene);
            fitState = createExhibitFadeState(api.group, api, new T.Vector3(4.5, 1.1, -4.75));
            return fitState;
        }).catch(err => {
            console.warn("Could not load letter fitting", err);
            fitRequest = null;
            return null;
        });
    }
    return fitRequest;
}

function loadCreatures() {
    if (!creatureRequest) {
        creatureRequest = import("./creatures.js").then(m => m.createCreatures(scene)).then(api => {
            creaturesState = createExhibitFadeState(api.group, api, new T.Vector3(0, 0.5, 4.2));
            return creaturesState;
        }).catch(err => {
            console.warn("Could not load creatures", err);
            creatureRequest = null;
            return null;
        });
    }
    return creatureRequest;
}

// Navigation & smooth sliding collision across the continuous world.
let yaw = 0;
let pitch = 0;
let activeExhibit = -1;
let activeZoneId = "courtyard";
let visibleMapName = null;
let rightMove = false;
const keys = new Set();

function zoneCanStand(zone, x, z, allowLoadedOnly = true) {
    if (!zone) return false;
    if (zone.id === "courtyard") {
        if (Math.abs(x) > 9.4 || Math.abs(z) > 13.4) return false;
        for (const ob of obstacles) {
            if (ob.kind === "circle" && Math.hypot(x - ob.x, z - ob.z) < ob.r) return false;
            if (ob.kind === "box" && Math.abs(x - ob.x) < ob.hx && Math.abs(z - ob.z) < ob.hz) return false;
        }
        return true;
    }
    const margin = zone.outdoor ? 0.45 : 0.52;
    if (x < zone.xMin + margin || x > zone.xMax - margin || z < zone.zMin + margin || z > zone.zMax - margin) {
        return false;
    }
    const st = roomStates.get(zone.id);
    if (st?.room?.canStand) {
        const [lx, lz] = worldToRoomLocal(zone, x, z);
        if (st.room.canStand(lx, lz) === false) return false;
    } else if (!allowLoadedOnly && st) {
        return true;
    }
    return true;
}

function canStandWorld(x, z) {
    if (inDoorway(x, z)) return true;
    for (const zone of ZONES) {
        if (x >= zone.xMin && x <= zone.xMax && z >= zone.zMin && z <= zone.zMax) {
            return zoneCanStand(zone, x, z);
        }
    }
    return false;
}

function heightAt(x, z) {
    const riverZone = ZONE_MAP.get("river");
    if (x >= riverZone.xMin && x <= riverZone.xMax && z >= riverZone.zMin && z <= riverZone.zMax) {
        const riverRoom = roomStates.get("river")?.room;
        if (riverRoom) {
            const [lx, lz] = worldToRoomLocal(riverZone, x, z);
            return riverRoom.height(lx, lz);
        }
    }
    return 0;
}

function moveRig(distance, forward, right, heading) {
    if (distance === 0 || (forward === 0 && right === 0)) return;
    const speed = distance / Math.max(1, Math.hypot(forward, right));
    const dx = speed * (right * Math.cos(heading) - forward * Math.sin(heading));
    const dz = -speed * (right * Math.sin(heading) + forward * Math.cos(heading));
    const nx = rig.position.x + dx;
    const nz = rig.position.z + dz;
    let tx = rig.position.x;
    let tz = rig.position.z;
    if (canStandWorld(nx, nz)) {
        tx = nx;
        tz = nz;
    } else if (canStandWorld(nx, rig.position.z)) {
        tx = nx;
    } else if (canStandWorld(rig.position.x, nz)) {
        tz = nz;
    } else {
        return;
    }
    rig.position.set(tx, heightAt(tx, tz), tz);
}

async function goToZone(zoneId) {
    setMenu(false);
    const zone = ZONE_MAP.get(zoneId);
    if (!zone) return;
    const [wx, wz] = roomLocalToWorld(zone, ...zone.spawnLocal);
    yaw = zone.spawnYaw ?? 0;
    pitch = -0.06;
    rig.position.set(wx, heightAt(wx, wz), wz);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    const st = roomStates.get(zoneId);
    if (!st) return;
    if (!st.room) status.textContent = st.spec.hint;
    await loadZone(zoneId);
    if (st.room && st.group && zoneAt(rig.position.x, rig.position.z, 0.75)?.id === zoneId) {
        rig.position.set(wx, heightAt(wx, wz), wz);
        applyFade(st, 1);
        if (!st.active) {
            st.active = true;
            st.room.enter?.();
        }
    }
}

function visitMap(entry) {
    setMenu(false);
    const standDist = 3.6;
    const wx = entry.x + Math.sin(entry.rotY) * standDist;
    const wz = entry.z + Math.cos(entry.rotY) * standDist;
    rig.position.set(wx, 0, wz);
    yaw = entry.rotY;
    pitch = 0.04;
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    loadMap(entry).catch(() => {});
    activeExhibit = 0;
    project.href = links[0].href;
    project.hidden = false;
    status.textContent = `Entirety · ${entry.name} map mounted in the courtyard gallery.`;
}

function visitExhibit(index) {
    setMenu(false);
    const entry = exhibits[index];
    if (index === 0) {
        visitMap(galleryMaps[0]);
        return;
    }
    if (index === 1) {
        rig.position.set(entry.x, 0, -7.2);
        loadCarving().then(st => { if (st && !st.api.started) st.api.start(); });
    } else if (index === 2) {
        rig.position.set(entry.x, 0, -10.5);
    } else if (index === 3) {
        rig.position.set(3.4, 0, 7.4);
        loadCreatures();
    } else if (index === 4) {
        rig.position.set(entry.x, 0, -1.6);
        loadLetterFit();
    }
    yaw = 0;
    pitch = 0;
    camera.rotation.set(0, 0, 0, "YXZ");
    loadExhibit(entry);
}

// Look vectors and visibility/pausing computation.
const viewPos = new T.Vector3();
const viewDir = new T.Vector3();
const viewQuat = new T.Quaternion();
const tmpVec = new T.Vector3();

function updateViewVectors(renderer, frame) {
    rig.updateMatrixWorld(true);
    if (renderer.xr.isPresenting && frame) {
        const pose = frame.getViewerPose(renderer.xr.getReferenceSpace());
        if (pose) {
            viewPos.copy(pose.transform.position).applyMatrix4(rig.matrixWorld);
            viewQuat.copy(pose.transform.orientation).premultiply(rig.quaternion);
            viewDir.set(0, 0, -1).applyQuaternion(viewQuat).normalize();
            return;
        }
    }
    camera.getWorldPosition(viewPos);
    camera.getWorldDirection(viewDir);
}

function isLookedAt(point, minDot = 0.22, nearDist = 2.8, maxDist = 28) {
    tmpVec.copy(point).sub(viewPos);
    const dist = tmpVec.length();
    if (dist > maxDist) return false;
    if (dist <= nearDist) return true;
    return tmpVec.divideScalar(dist).dot(viewDir) >= minDot;
}

function updateEnvironment(zone, dt) {
    const id = zone?.id ?? "courtyard";
    const isSpace = ["station", "asteroid", "orbit", "e_hall", "se_hall"].includes(id);
    const targetBg = id === "courtyard" ? skyColor : id === "river" ? riverColor : isSpace ? spaceColor : indoorColor;
    scene.background.lerp(targetBg, Math.min(1, dt * 6));
    scene.fog = id === "courtyard" ? outdoorFog : id === "river" ? riverFog : null;

    if (zone && !zone.outdoor) {
        roomLight.position.set(zone.cx, Math.min(zone.height - 0.5, 4.0) || 3.6, zone.cz);
        roomLight.intensity = T.MathUtils.lerp(roomLight.intensity, 1.45, Math.min(1, dt * 6));
    } else {
        roomLight.intensity = T.MathUtils.lerp(roomLight.intensity, 0, Math.min(1, dt * 6));
    }
}

const ctxPoint = new T.Vector3();

function updateContextUI(zone) {
    const inCourtyard = !zone || zone.id === "courtyard";
    const st = zone ? roomStates.get(zone.id) : null;
    if (!inCourtyard) {
        callCreatures.hidden = carveButton.hidden = carvingProgress.hidden = true;
        fitButton.hidden = fitProgress.hidden = fitTargetLabel.hidden = true;
        mapChoices.hidden = true;
        activeExhibit = -1;
        visibleMapName = null;
        if (zone.id !== activeZoneId) {
            activeZoneId = zone.id;
            links.forEach(link => link.setAttribute("aria-current", "false"));
            if (st) {
                if (st.spec.projectHref) {
                    project.href = st.spec.projectHref;
                    project.hidden = false;
                } else {
                    project.hidden = true;
                }
                status.textContent = st.spec.hint;
            } else {
                project.hidden = true;
                status.textContent = `${zone.name} · Follow the corridor into the surrounding rooms.`;
            }
        }
        return;
    }

    activeZoneId = "courtyard";
    const nearbyMap = galleryMaps.find(m => Math.hypot(m.x - rig.position.x, m.z - rig.position.z) < 4.8 &&
        isLookedAt(ctxPoint.set(m.x, 2.0, m.z), 0.15, 2.2, 6.0));
    const nearCarve = Math.hypot(-2 - rig.position.x, -10.6 - rig.position.z) < 3.6 &&
        isLookedAt(ctxPoint.set(-2, 1.3, -10.6), 0.12, 2.2, 5.0);
    const nearFit = Math.hypot(4.5 - rig.position.x, -4.75 - rig.position.z) < 3.8 &&
        isLookedAt(ctxPoint.set(4.5, 1.1, -4.75), 0.12, 2.2, 5.0);
    const nearCreatures = rig.position.z > 0.5 && Math.hypot(rig.position.x, rig.position.z - 4.2) < 5.0;
    const northHit = exhibits.findIndex((e, i) => i < 4 && Math.hypot(e.x - rig.position.x, e.z - rig.position.z) < 4.2);
    const index = nearbyMap ? 0 : nearCarve ? 1 : nearFit ? 4 : northHit >= 0 ? northHit : nearCreatures ? 3 : -1;

    callCreatures.hidden = index !== 3;
    carveButton.hidden = index !== 1;
    carvingProgress.hidden = index !== 1;
    fitButton.hidden = fitProgress.hidden = fitTargetLabel.hidden = index !== 4;
    mapChoices.hidden = index !== 0;

    const nearbyName = nearbyMap?.name ?? null;
    if (index === activeExhibit && nearbyName === visibleMapName) return;
    activeExhibit = index;
    visibleMapName = nearbyName;
    links.forEach((link, i) => link.setAttribute("aria-current", String(i === index)));
    project.hidden = index < 0;
    if (index >= 0) {
        project.href = links[index].href;
        loadExhibit(exhibits[index]);
    }
    status.textContent = index === 0 ? `Entirety Gallery · Viewing the ${nearbyMap?.name ?? "Mediterranean"} map.` :
        index === 1 ? "Raymarcher · Orbiting UFOs zap away the stone block until they reveal a hidden torus." :
        index === 3 ? "Creatures roam between the entrance and the fountain. Call them over to meet them." :
        index < 0 ? "Walk or teleport through open doorways to explore every room, or inspect the courtyard exhibits." :
        exhibits[index].note;
}

function updateRoomsAndExhibits(now, frame, dt, frameMs, renderer) {
    const currentZone = zoneAt(rig.position.x, rig.position.z, 0) || zoneAt(rig.position.x, rig.position.z, 0.75);
    updateEnvironment(currentZone, dt);
    updateContextUI(currentZone);
    const currentId = currentZone?.id ?? "courtyard";
    const adj = ADJACENT.get(currentId) || new Set();
    const doorsHere = DOOR_ENTRANCES.get(currentId) || [];

    aim.hidden = !(currentZone && roomStates.get(currentZone.id)?.room?.aimSelect && !renderer.xr.isPresenting);

    // Trigger on-demand loading for current zone and looked-at adjacent rooms.
    if (roomStates.has(currentId)) loadZone(currentId);
    for (const neighborId of adj) {
        if (!roomStates.has(neighborId)) continue;
        if (doorsHere.some(d => d.to === neighborId && isLookedAt(d.pos, 0.14, 4.0, 24))) {
            loadZone(neighborId);
        }
    }

    const fadeStep = dt * 5.2;
    for (const st of roomStates.values()) {
        if (!st.room || !st.group) continue;
        const inThis = currentId === st.zone.id;
        const seeDoor = adj.has(st.zone.id) && doorsHere.some(d => d.to === st.zone.id && isLookedAt(d.pos, 0.10, 4.0, 24));
        const focalLook = inThis ? isLookedAt(st.focalWorld, 0.22, 3.2, 42) : seeDoor;

        // Keep structural shell intact while standing inside ownWalls rooms; otherwise fade out when looking away.
        const targetFade = st.zone.ownWalls ? (inThis || seeDoor ? 1 : 0) : (focalLook ? 1 : 0);
        const nextFade = st.fade < targetFade ? Math.min(targetFade, st.fade + fadeStep) :
            Math.max(targetFade, st.fade - fadeStep);
        applyFade(st, nextFade);

        const shouldRun = focalLook && nextFade > 0.05;
        if (shouldRun && !st.active) {
            st.active = true;
            st.room.enter?.();
        } else if (!shouldRun && st.active) {
            st.active = false;
            st.room.leave?.();
        }
        if (st.active) st.room.update?.(now, frame, renderer.xr, renderer);
    }

    // Main-courtyard exhibit pause & fade logic.
    const nearCourtyard = currentId === "courtyard" || adj.has("courtyard");
    const courtyardDoorLook = currentId !== "courtyard" &&
        doorsHere.some(d => d.to === "courtyard" && isLookedAt(d.pos, 0.12, 4.0, 22));

    if (carvingState) {
        const active = nearCourtyard && (currentId === "courtyard" ? isLookedAt(carvingState.focalWorld, 0.22, 3.2, 28) : courtyardDoorLook);
        const nextFade = active ? Math.min(1, carvingState.fade + fadeStep) : Math.max(0, carvingState.fade - fadeStep);
        applyFade(carvingState, nextFade);
        if (active && nextFade > 0.05) {
            if (!carvingState.api.started) carvingState.api.start();
            const stats = carvingState.api.update(dt);
            carveButton.disabled = stats.active;
            const progress = stats.nextRay === 0 ? "" : `${stats.nextRay}/${stats.rayCount} rays · ${stats.removed} chips`;
            if (carvingProgress.value !== progress) carvingProgress.value = progress;
        }
    }

    if (fitState) {
        const active = nearCourtyard && (currentId === "courtyard" ? isLookedAt(fitState.focalWorld, 0.22, 3.2, 26) : courtyardDoorLook);
        const nextFade = active ? Math.min(1, fitState.fade + fadeStep) : Math.max(0, fitState.fade - fadeStep);
        applyFade(fitState, nextFade);
        if (active && nextFade > 0.05) {
            const { running, letters, error, initial, examined, worstMs, meanFrameMs } = fitState.api.update(frameMs);
            fitButton.disabled = running;
            const progress = examined === 0 ? "" :
                `${letters || "Sampling"} · voxel error ${initial} → ${error} · ${examined} candidates · worst CPU step ${worstMs.toFixed(1)} ms · mean frame interval ${meanFrameMs.toFixed(1)} ms`;
            if (fitProgress.value !== progress) fitProgress.value = progress;
        }
    }

    if (creaturesState) {
        const positions = creaturesState.api.positions?.() ?? [];
        const lookingAtCreature = positions.length
            ? positions.some(pos => isLookedAt(pos, 0.20, 3.8, 28))
            : isLookedAt(creaturesState.focalWorld, 0.20, 4.0, 26);
        const active = nearCourtyard && (currentId === "courtyard" ? lookingAtCreature : courtyardDoorLook);
        const nextFade = active ? Math.min(1, creaturesState.fade + fadeStep) : Math.max(0, creaturesState.fade - fadeStep);
        applyFade(creaturesState, nextFade);
        if (active && nextFade > 0.05) creaturesState.api.update(now / 1000, dt);
    }
}

// Unified interaction handler (desktop click, crosshair Space/A, and XR select).
function interactAlongRay(ray) {
    const wallDist = ray.intersectObjects(wallMeshes, false)[0]?.distance ?? Infinity;

    // 1. Current or adjacent active room selection.
    const currentZone = zoneAt(rig.position.x, rig.position.z, 0.45);
    const activeRoom = currentZone && roomStates.get(currentZone.id);
    if (activeRoom?.room?.select?.(ray)) return true;

    // 2. Courtyard interactive objects (blocked behind solid walls).
    if (carvingState?.fade > 0.1) {
        const hit = ray.intersectObjects(carvingState.api.targets, false)[0];
        if (hit && hit.distance < wallDist) {
            carvingState.api.start();
            status.textContent = "Raymarcher · Firing rays at stone to carve the torus.";
            return true;
        }
    }

    if (fitState?.fade > 0.1) {
        const hit = ray.intersectObjects(fitState.api.targets, false)[0];
        if (hit && hit.distance < wallDist) {
            if (hit.object === fitState.api.targets[1]) {
                const kind = fitState.api.toggleTarget();
                fitTarget.value = kind;
                status.textContent = `Letter fitting · Switched reference shape to ${kind}.`;
            } else {
                fitState.api.start();
                status.textContent = "Letter fitting · Searching solid letter strokes to match the target.";
            }
            return true;
        }
    }

    const mapPanels = galleryMaps.map(m => m.panel).filter(Boolean);
    const mapHit = ray.intersectObjects(mapPanels, false)[0];
    if (mapHit && mapHit.distance < wallDist) {
        const entry = mapHit.object.userData.galleryMap;
        visitMap(entry);
        return true;
    }

    const exhibitPanels = exhibits.map(e => e.panel).filter(Boolean);
    const exhibitHit = ray.intersectObjects(exhibitPanels, false)[0];
    if (exhibitHit && exhibitHit.distance < wallDist) {
        const idx = exhibits.findIndex(e => e.panel === exhibitHit.object);
        if (idx >= 0) {
            visitExhibit(idx);
            return true;
        }
    }

    return false;
}

function selectCenter() {
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(), camera);
    interactAlongRay(ray);
}

function bindDesktop(renderer) {
    const surface = renderer.domElement;
    surface.tabIndex = 0;
    let pointer = null;
    surface.addEventListener("contextmenu", event => event.preventDefault());
    surface.addEventListener("pointerdown", event => {
        surface.focus();
        if (event.button === 2) rightMove = true;
        else rightMove = Boolean(event.buttons & 2);
        pointer = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY, distance: 0 };
        surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("pointermove", event => {
        if (pointer?.id !== event.pointerId) return;
        rightMove = Boolean(event.buttons & 2);
        pointer.distance += Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
        yaw += (rightMove ? -1 : 1) * (event.clientX - pointer.x) * 0.004;
        pitch = T.MathUtils.clamp(pitch + (event.clientY - pointer.y) * 0.004, -1.25, 1.25);
        pointer.x = event.clientX;
        pointer.y = event.clientY;
    });
    surface.addEventListener("pointerup", event => {
        rightMove = Boolean(event.buttons & 2);
        if (pointer?.id !== event.pointerId || pointer.button !== 0 || pointer.distance > 5) return;
        const rect = surface.getBoundingClientRect();
        const ray = new T.Raycaster();
        ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
            1 - (event.clientY - rect.top) / rect.height * 2), camera);
        interactAlongRay(ray);
    });
    const clearPointer = () => {
        pointer = null;
        rightMove = false;
    };
    surface.addEventListener("lostpointercapture", clearPointer);
    surface.addEventListener("pointercancel", clearPointer);
    window.addEventListener("keydown", event => {
        if (event.code === "Escape") {
            event.preventDefault();
            if (!event.repeat) setMenu(!document.body.hasAttribute("data-menu-open"));
            return;
        }
        if (event.target === surface && event.code === "Space") {
            event.preventDefault();
            if (!event.repeat) selectCenter();
            return;
        }
        if (event.target instanceof HTMLSelectElement) return;
        const key = event.key.toLowerCase();
        if (event.altKey || event.metaKey || event.ctrlKey || !["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) return;
        keys.add(key);
        event.preventDefault();
    });
    window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => {
        keys.clear();
        rightMove = false;
    });
    links.forEach((link, index) => link.addEventListener("click", event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        visitExhibit(index);
    }));
}

function walk(dt, [strafe = 0, travel = 0, lookX = 0, lookY = 0] = []) {
    yaw -= lookX * dt * 2;
    pitch = T.MathUtils.clamp(pitch - lookY * dt * 2, -1.25, 1.25);
    const forward = Number(rightMove || keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown")) - travel;
    const right = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft")) + strafe;
    moveRig(dt * 3.4, forward, right, yaw);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
}

const up = new T.Vector3(0, 1, 0);
let turnReady = true;

function walkVr(renderer, frame, dt) {
    const pose = frame?.getViewerPose(renderer.xr.getReferenceSpace());
    if (!pose) return;
    const [strafe, travel, turn] = thumbsticks(frame.session.inputSources);
    const deadZone = value => Math.sign(value) * Math.max(0, Math.abs(value) - 0.18) / 0.82;
    if (Math.abs(turn) < 0.3) turnReady = true;
    if (turnReady && Math.abs(turn) >= 0.65) {
        turnReady = false;
        const delta = -Math.sign(turn) * Math.PI / 6;
        const offset = new T.Vector3().copy(pose.transform.position).setY(0).applyAxisAngle(up, rig.rotation.y);
        rig.position.add(offset).sub(offset.clone().applyAxisAngle(up, delta));
        rig.rotation.y += delta;
    }
    if (Math.abs(strafe) > 0.18 || Math.abs(travel) > 0.18) {
        const facing = new T.Vector3(0, 0, -1).applyQuaternion(pose.transform.orientation);
        const heading = Math.atan2(-facing.x, -facing.z) + rig.rotation.y;
        moveRig(dt * 1.7, -deadZone(travel), deadZone(strafe), heading);
    }
}

async function bindVR(renderer, inputs) {
    if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) return;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
    for (let i = 0; i < 2; i++) {
        const input = attachVrInput(renderer.xr, rig, i);
        inputs.push(input);
        const controller = input.ray;
        controller.addEventListener("select", () => {
            if (!controller.visible) return;
            const ray = new T.Raycaster(controller.getWorldPosition(new T.Vector3()),
                new T.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new T.Quaternion())));
            if (interactAlongRay(ray)) return;

            const wallHit = ray.intersectObjects(wallMeshes, false)[0];
            const wallDist = wallHit?.distance ?? Infinity;
            const floorHit = ray.intersectObjects(floorMeshes, false)[0];
            if (floorHit && floorHit.distance < wallDist && ray.ray.direction.y < -0.02 &&
                canStandWorld(floorHit.point.x, floorHit.point.z)) {
                rig.position.set(floorHit.point.x, heightAt(floorHit.point.x, floorHit.point.z), floorHit.point.z);
            }
        });
    }
    vr.hidden = false;
    vr.addEventListener("click", async () => {
        try {
            const session = await navigator.xr.requestSession("immersive-vr", vrSessionOptions);
            turnReady = true;
            session.addEventListener("end", () => { rig.rotation.y = 0; }, { once: true });
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

    buildCourtyard();
    exhibits.forEach(loadExhibit);
    galleryMaps.forEach(entry => loadMap(entry).catch(() => {}));

    for (const [index, link] of links.entries()) {
        destination.add(new Option(link.textContent, "exhibit:" + index));
    }
    for (const st of roomStates.values()) {
        destination.add(new Option(st.zone.name, st.spec.buttonId));
        st.button?.addEventListener("click", () => goToZone(st.zone.id));
    }
    destination.add(new Option("Asteroid Farmer · 2D", "../../projects/games/asteroid-farmer/index.html"));
    destination.add(new Option("Accumulative Station · 2D", "../../projects/games/accumulative-station/index.html"));
    destination.add(new Option("Games Aquarium · 2D", "../../projects/games/games-aquarium/index.html"));
    destination.add(new Option("L-World · original editor", "./lworld-room.html"));

    document.querySelector("#visit").addEventListener("click", () => {
        setMenu(false);
        const byRoom = [...roomStates.values()].find(st => st.spec.buttonId === destination.value);
        if (byRoom) goToZone(byRoom.zone.id);
        else if (destination.value.startsWith("exhibit:")) visitExhibit(Number(destination.value.split(":")[1]));
        else location.href = destination.value;
    });

    const requestedRoom = new URLSearchParams(location.search).get("room");
    if (requestedRoom && roomStates.has(requestedRoom)) {
        goToZone(requestedRoom);
    } else {
        loadCarving();
        loadCreatures();
        loadLetterFit();
    }

    mapChoices.querySelectorAll("button").forEach(button =>
        button.addEventListener("click", () => visitMap(galleryMaps[Number(button.dataset.map)])));

    callCreatures.addEventListener("click", async () => {
        await loadCreatures();
        if (creaturesState) creaturesState.api.call(rig.position);
    });
    carveButton.addEventListener("click", async () => {
        await loadCarving();
        carvingState?.api.start();
    });
    fitButton.addEventListener("click", async () => {
        await loadLetterFit();
        fitState?.api.start();
    });
    fitTarget.addEventListener("change", async () => {
        await loadLetterFit();
        fitState?.api.setTarget(fitTarget.value);
    });

    bindDesktop(renderer);
    const inputs = [];
    bindVR(renderer, inputs).catch(() => { vr.hidden = true; });
    const pollGamepad = readGamepad();
    const useMenu = gamepadMenu("#menu-toggle, main button, main a[href], #destination");

    let previous = performance.now();
    renderer.setAnimationLoop((now, frame) => {
        const frameMs = Math.max(0, now - previous);
        const dt = Math.min(0.05, frameMs / 1000);
        previous = now;

        if (renderer.xr.isPresenting) {
            for (const input of inputs) input.update();
            walkVr(renderer, frame, dt);
        } else {
            const pad = pollGamepad();
            walk(dt, pad?.axes);
            if (pad) {
                if (pad.pressed[9]) setMenu(!document.body.hasAttribute("data-menu-open"));
                if (document.activeElement === renderer.domElement && pad.pressed[0]) selectCenter();
                else if (document.activeElement === destination && [0, 14, 15].some(idx => pad.pressed[idx])) {
                    if (pad.pressed[0]) document.querySelector("#visit").click();
                    else destination.selectedIndex = (destination.selectedIndex + (pad.pressed[14] ? -1 : 1) + destination.length) % destination.length;
                } else {
                    useMenu(pad);
                }
            }
        }

        updateViewVectors(renderer, frame);
        updateRoomsAndExhibits(now, frame, dt, frameMs, renderer);
        renderer.render(scene, camera);
    });
}

try {
    start();
} catch (error) {
    setMenu(true);
    document.querySelector("#destinations").hidden = true;
    document.querySelector("#exhibits").parentElement.hidden = false;
    for (const st of roomStates.values()) {
        if (st.button) st.button.hidden = true;
    }
    status.textContent = "3D is unavailable here. The exhibit links open the projects directly.";
    console.error(error);
}
