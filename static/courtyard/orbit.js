import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { gamepadMenu, readGamepad } from "./gamepad.js";
import { galleryRoom } from "./gallery-room.js";

const viewport = document.querySelector("#viewport");
const voyage = document.querySelector("#voyage");
const arrival = document.querySelector("#arrival") ?? document.createTextNode("");
const standalone = voyage !== null;
const destinationsNav = standalone ? document.querySelector("#destinations") : null;

// Faction palette matching stars.pde (Neutral, Bob, Tom, Harry).
const PLAYERS = [
    { name: "Neutral", color: 0xb6bac4, emissive: 0x3b404c },
    { name: "Bob", color: 0xff2b2b, emissive: 0x6e0909 },
    { name: "Tom", color: 0x14b838, emissive: 0x054f16 },
    { name: "Harry", color: 0x3377ff, emissive: 0x0e2a7a },
];

const FALLBACK_PLANETS = [
    "OPTIOCEUS", "ZENSOFT", "MEPHUSS", "DANT", "ORIGIGION", "GURURIAN", "ZADICT",
    "HELIODEN", "SYNTHEBULB", "ORANGIMA", "GEOCATE", "THEOHONG", "DEOFIRTH",
    "LOCADE", "PORTANOID", "CANT", "NANOROPE", "CANOLEROS", "ARTISOFT", "XYLOZE",
];

const FALLBACK_SHIPS = [
    "Buccaneer's Howl", "Plunderer's Executioner", "Posideon's Hoard", "Buccaneer's Treasure",
    "Calypso's Hangman", "Dragon's Anger", "Hades' Rage", "Neptune's Raider",
    "Pirate's Plunder", "Midnight Transmitter (MT-995)", "Repair Trawler (RT-8224)",
    "Tesla Lynx (TL-39)", "Dolemur Phoenix (DP-997)", "System Tanker (IT-704)",
    "Ice Ares (IA-279)", "Antimatter Feror (AF-483)", "Light Ares (LA-39)",
    "Patrol Laudus (AUPAL-144)", "Void Scavenger", "System Sentry (SS-580)",
];

function shuffled(list) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function planetPool() {
    const raw = typeof window.planetstring === "string"
        ? window.planetstring.trim().split(/\s+/).filter(Boolean)
        : [];
    return shuffled(raw.length ? raw : FALLBACK_PLANETS);
}

function shipPool() {
    const raw = typeof window.shipstring === "string"
        ? window.shipstring.split(",").map(s => s.trim()).filter(Boolean)
        : [];
    return shuffled(raw.length ? raw : FALLBACK_SHIPS);
}

function mergeGeometries(parts) {
    const nonIndexed = parts.map(({ geo, matrix }) => {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        if (matrix) g.applyMatrix4(matrix);
        if (!g.getAttribute("normal")) g.computeVertexNormals();
        return g;
    });
    const totalVerts = nonIndexed.reduce((sum, g) => sum + g.getAttribute("position").count, 0);
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    let offset = 0;
    for (const g of nonIndexed) {
        const pos = g.getAttribute("position").array;
        const norm = g.getAttribute("normal").array;
        positions.set(pos, offset);
        normals.set(norm, offset);
        offset += pos.length;
        g.dispose();
    }
    const merged = new T.BufferGeometry();
    merged.setAttribute("position", new T.BufferAttribute(positions, 3));
    merged.setAttribute("normal", new T.BufferAttribute(normals, 3));
    merged.computeBoundingSphere();
    return merged;
}

// Convert stars.pde drawStar() (central ball + 9 radial triangles + white outline) into 3D.
function buildStarGeometry() {
    const parts = [];
    const up = new T.Vector3(0, 1, 0);
    const core = new T.IcosahedronGeometry(0.088, 1);
    parts.push({ geo: core });

    const spikeTemplate = new T.ConeGeometry(0.032, 0.118, 4);
    const dirs = [];
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        dirs.push(new T.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const tilt = Math.PI / 4;
    const ringR = Math.cos(tilt);
    const ringY = Math.sin(tilt);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        dirs.push(new T.Vector3(Math.cos(a) * ringR, ringY, Math.sin(a) * ringR));
        const b = ((i + 0.5) / 6) * Math.PI * 2;
        dirs.push(new T.Vector3(Math.cos(b) * ringR, -ringY, Math.sin(b) * ringR));
    }
    dirs.push(new T.Vector3(0, 1, 0), new T.Vector3(0, -1, 0));

    const quat = new T.Quaternion();
    const pos = new T.Vector3();
    const scale = new T.Vector3(1, 1, 1);
    for (const dir of dirs) {
        quat.setFromUnitVectors(up, dir);
        pos.copy(dir).multiplyScalar(0.132);
        parts.push({ geo: spikeTemplate, matrix: new T.Matrix4().compose(pos, quat, scale) });
    }

    const merged = mergeGeometries(parts);
    core.dispose();
    spikeTemplate.dispose();
    return merged;
}

// Convert stars.pde drawShip() (nose triangle, rect fuselage, swept delta wings) into 3D (+Z forward).
function buildShipGeometry() {
    const parts = [];
    const body = new T.BoxGeometry(0.10, 0.052, 0.22);
    parts.push({ geo: body, matrix: new T.Matrix4().makeTranslation(0, 0, -0.005) });

    const ridge = new T.BoxGeometry(0.058, 0.034, 0.13);
    parts.push({ geo: ridge, matrix: new T.Matrix4().makeTranslation(0, 0.032, 0.015) });

    const nose = new T.ConeGeometry(0.064, 0.105, 4);
    const noseMat = new T.Matrix4()
        .makeTranslation(0, 0, 0.156)
        .multiply(new T.Matrix4().makeScale(1, 0.62, 1))
        .multiply(new T.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new T.Matrix4().makeRotationY(Math.PI / 4));
    parts.push({ geo: nose, matrix: noseMat });

    const wingExtrude = { depth: 0.02, bevelEnabled: false };
    const rightShape = new T.Shape();
    rightShape.moveTo(0.068, 0.115);
    rightShape.lineTo(0.195, 0.115);
    rightShape.lineTo(0.068, -0.015);
    rightShape.closePath();
    const rightWing = new T.ExtrudeGeometry(rightShape, wingExtrude);
    const wingFix = new T.Matrix4()
        .makeTranslation(0, -0.01, 0)
        .multiply(new T.Matrix4().makeRotationX(-Math.PI / 2));
    parts.push({ geo: rightWing, matrix: wingFix });

    const leftShape = new T.Shape();
    leftShape.moveTo(-0.068, 0.115);
    leftShape.lineTo(-0.068, -0.015);
    leftShape.lineTo(-0.195, 0.115);
    leftShape.closePath();
    const leftWing = new T.ExtrudeGeometry(leftShape, wingExtrude);
    parts.push({ geo: leftWing, matrix: wingFix });

    const pylon = new T.BoxGeometry(0.042, 0.018, 0.05);
    for (const sx of [-0.062, 0.062]) {
        parts.push({ geo: pylon, matrix: new T.Matrix4().makeTranslation(sx, 0, -0.06) });
    }

    const finShape = new T.Shape();
    finShape.moveTo(-0.115, 0.024);
    finShape.lineTo(-0.115, 0.088);
    finShape.lineTo(-0.015, 0.024);
    finShape.closePath();
    const fin = new T.ExtrudeGeometry(finShape, { depth: 0.016, bevelEnabled: false });
    const finMat = new T.Matrix4()
        .makeTranslation(0.008, 0, 0)
        .multiply(new T.Matrix4().makeRotationY(-Math.PI / 2));
    parts.push({ geo: fin, matrix: finMat });

    const merged = mergeGeometries(parts);
    for (const g of [body, ridge, nose, rightWing, leftWing, pylon, fin]) g.dispose();
    return merged;
}

function starLabelSprite(name, owner, modelScale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 84;
    const ctx = canvas.getContext("2d");
    const hex = `#${PLAYERS[owner].color.toString(16).padStart(6, "0")}`;
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.textAlign = "left";
    const textWidth = Math.min(244, ctx.measureText(name).width);
    const lineEnd = Math.min(312, 58 + textWidth + 8);

    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 72);
    ctx.lineTo(42, 48);
    ctx.lineTo(lineEnd, 48);
    ctx.stroke();

    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(42, 48, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#08101c";
    ctx.fillText(name, 52, 38, 256);
    ctx.fillText(name, 54, 38, 256);
    ctx.fillText(name, 53, 37, 256);
    ctx.fillText(name, 53, 39, 256);
    ctx.fillStyle = "#f2f6fa";
    ctx.fillText(name, 53, 38, 256);

    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mat = new T.SpriteMaterial({ map: texture, transparent: true, opacity: 0.92, depthWrite: false });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(0.56 * modelScale, 0.147 * modelScale, 1);
    sprite.position.set(0.27 * modelScale, 0.14 * modelScale, 0);
    return sprite;
}

// Read-only shared prototype geometries reused by every Stars & Ships instance.
const starGeo = buildStarGeometry();
const starEdgesGeo = new T.EdgesGeometry(starGeo, 24);
const shipGeo = buildShipGeometry();
const shipEdgesGeo = new T.EdgesGeometry(shipGeo, 22);
const hitGeo = new T.SphereGeometry(0.26, 10, 8);
const exhaustGeo = new T.BoxGeometry(0.014, 0.014, 0.09);
const haloGeo = new T.TorusGeometry(0.28, 0.012, 8, 36);

function formatStarDetail(star) {
    const owner = PLAYERS[star.owner].name;
    const [tr, la, cu, fa, mi, sp] = star.resources.map(v => Math.round(v));
    return `${star.name} (${owner}) · Transuranics ${tr} · Lanthinides ${la} · Custard ${cu} · Factories ${fa} · Mines ${mi} · Spatulas ${sp}`;
}

function createSectorSimulation({
    starCount = 20,
    shipCount = 20,
    halfX = 3.75,
    minY = 0.72,
    maxY = 3.65,
    halfZ = 3.45,
    minSpacing = 1.05,
    modelScale = 1,
    speedScale = 1,
    navElement = null,
    onSelect = null,
} = {}) {
    const group = new T.Group();

    // Per-sector materials so Courtyard look-fading never affects separate room instances.
    const ownerMats = PLAYERS.map(p => new T.MeshStandardMaterial({
        color: p.color,
        emissive: p.emissive,
        emissiveIntensity: 0.45,
        roughness: 0.44,
        metalness: 0.16,
    }));
    const starEdgeMat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72 });
    const shipEdgeMat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.52 });
    const exhaustMat = new T.MeshBasicMaterial({ color: 0xffe4a0 });
    const invisiblePickMat = new T.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
    });

    const haloRing = new T.Mesh(haloGeo, new T.MeshBasicMaterial({ color: 0xfff0b8 }));
    haloRing.scale.setScalar(modelScale);
    haloRing.visible = false;
    group.add(haloRing);

    const routeGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, 0.01)]);
    const routeLine = new T.Line(routeGeo, new T.LineBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.85 }));
    routeLine.visible = false;
    group.add(routeLine);

    const stars = [];
    const ships = [];
    const targets = [];
    let selectedStar = -1;
    let selectedShip = -1;
    let lastNow = 0;

    const randomVolumePos = out => out.set(
        (Math.random() * 2 - 1) * halfX,
        minY + Math.random() * (maxY - minY),
        (Math.random() * 2 - 1) * halfZ,
    );

    const chooseOtherStar = excludeIndex => {
        if (stars.length <= 1) return 0;
        let pick = Math.floor(Math.random() * stars.length);
        if (pick === excludeIndex) pick = (pick + 1 + Math.floor(Math.random() * (stars.length - 1))) % stars.length;
        return pick;
    };

    const syncRouteLine = () => {
        if (selectedShip < 0 || selectedShip >= ships.length || !stars.length) {
            routeLine.visible = false;
            return;
        }
        const ship = ships[selectedShip];
        const dest = stars[ship.destIndex];
        const pos = routeGeo.getAttribute("position");
        pos.setXYZ(0, ship.group.position.x, ship.group.position.y, ship.group.position.z);
        pos.setXYZ(1, dest.group.position.x, dest.group.position.y, dest.group.position.z);
        pos.needsUpdate = true;
        routeLine.visible = true;
    };

    const selectStar = index => {
        if (index < 0 || index >= stars.length) return;
        selectedStar = index;
        const star = stars[index];
        haloRing.position.copy(star.group.position);
        haloRing.visible = true;

        const shipIndex = selectedShip >= 0 ? selectedShip : 0;
        const ship = ships[shipIndex];
        if (ship) {
            selectedShip = shipIndex;
            ship.destIndex = index;
            syncRouteLine();
        }
        stars.forEach((entry, i) => entry.button?.setAttribute("aria-pressed", String(i === index)));
        onSelect?.({ kind: "star", star, ship, detail: formatStarDetail(star) });
    };

    const selectShip = index => {
        if (index < 0 || index >= ships.length) return;
        selectedShip = index;
        const ship = ships[index];
        const dest = stars[ship.destIndex];
        syncRouteLine();
        onSelect?.({ kind: "ship", ship, star: dest, detail: `${ship.name} (${PLAYERS[ship.owner].name}) → ${dest.name}` });
    };

    const populate = () => {
        for (const s of stars) group.remove(s.group);
        for (const sh of ships) group.remove(sh.group);
        stars.length = 0;
        ships.length = 0;
        targets.length = 0;
        navElement?.replaceChildren();

        const pNames = planetPool();
        const sNames = shipPool();
        const candidate = new T.Vector3();

        for (let i = 0; i < starCount; i++) {
            let bestPos = randomVolumePos(new T.Vector3());
            let gap = minSpacing;
            for (let attempt = 0; attempt < 60; attempt++) {
                randomVolumePos(candidate);
                if (attempt > 35) gap = minSpacing * 0.7;
                if (stars.every(other => other.group.position.distanceTo(candidate) >= gap)) {
                    bestPos.copy(candidate);
                    break;
                }
            }

            const owner = i < 4 ? i : Math.floor(Math.random() * 4);
            const name = pNames[i % pNames.length];
            const resources = Array.from({ length: 6 }, () => Math.random() * 20);
            const starGroup = new T.Group();
            starGroup.position.copy(bestPos);

            const body = new T.Group();
            body.scale.setScalar(modelScale);
            body.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            body.add(new T.Mesh(starGeo, ownerMats[owner]), new T.LineSegments(starEdgesGeo, starEdgeMat));

            const pick = new T.Mesh(hitGeo, invisiblePickMat);
            pick.scale.setScalar(modelScale);
            pick.userData.starIndex = i;
            targets.push(pick);

            starGroup.add(body, pick, starLabelSprite(name, owner, modelScale));
            group.add(starGroup);

            let button = null;
            if (navElement) {
                button = document.createElement("button");
                button.textContent = name;
                button.setAttribute("aria-pressed", "false");
                button.addEventListener("click", () => selectStar(i));
                navElement.append(button);
            }

            stars.push({
                index: i,
                name,
                owner,
                resources,
                group: starGroup,
                body,
                spinSpeed: (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 5) * 0.08),
                button,
            });
        }

        const dir = new T.Vector3();
        const up = new T.Vector3(0, 1, 0);
        const initLook = new T.Matrix4();

        for (let i = 0; i < shipCount; i++) {
            const owner = i < 4 ? i : Math.floor(Math.random() * 4);
            const name = sNames[i % sNames.length];
            const startPos = randomVolumePos(new T.Vector3());
            const destIndex = chooseOtherStar(-1);

            const shipGroup = new T.Group();
            shipGroup.position.copy(startPos);

            const visual = new T.Group();
            visual.scale.setScalar(modelScale);
            const exhaust = new T.Group();
            exhaust.position.set(0, 0, -0.125);
            for (const sx of [-0.036, 0, 0.036]) {
                const beam = new T.Mesh(exhaustGeo, exhaustMat);
                beam.position.set(sx, 0, -0.045);
                exhaust.add(beam);
            }
            visual.add(new T.Mesh(shipGeo, ownerMats[owner]), new T.LineSegments(shipEdgesGeo, shipEdgeMat), exhaust);

            const pick = new T.Mesh(hitGeo, invisiblePickMat);
            pick.scale.setScalar(modelScale);
            pick.userData.shipIndex = i;
            targets.push(pick);

            shipGroup.add(visual, pick);
            const destPos = stars[destIndex].group.position;
            dir.subVectors(destPos, startPos);
            if (dir.lengthSq() > 1e-6) {
                initLook.lookAt(destPos, startPos, up);
                shipGroup.quaternion.setFromRotationMatrix(initLook);
            }
            group.add(shipGroup);

            ships.push({
                index: i,
                name,
                owner,
                group: shipGroup,
                exhaust,
                destIndex,
                speed: (0.72 + Math.random() * 0.45) * speedScale,
                phase: Math.random() * Math.PI * 2,
            });
        }

        selectedStar = -1;
        selectedShip = -1;
        haloRing.visible = false;
        syncRouteLine();
    };

    const moveDir = new T.Vector3();
    const lookMat = new T.Matrix4();
    const targetQuat = new T.Quaternion();
    const worldUp = new T.Vector3(0, 1, 0);
    const arriveDist = 0.24 * modelScale;

    const update = (nowMs, fixedDt = null) => {
        const dt = fixedDt !== null ? Math.min(0.05, Math.max(0, fixedDt))
            : lastNow === 0 ? 0.016 : Math.min(0.05, Math.max(0.001, (nowMs - lastNow) / 1000));
        lastNow = nowMs;
        const tSec = nowMs * 0.001;

        for (const star of stars) {
            star.body.rotation.y += star.spinSpeed * dt;
            star.body.rotation.x += star.spinSpeed * 0.35 * dt;
        }
        if (haloRing.visible) {
            haloRing.rotation.x = tSec * 1.4;
            haloRing.rotation.y = tSec * 2.1;
        }
        for (const ship of ships) {
            let target = stars[ship.destIndex]?.group.position;
            if (!target) continue;
            moveDir.subVectors(target, ship.group.position);
            if (moveDir.length() <= arriveDist) {
                ship.destIndex = chooseOtherStar(ship.destIndex);
                target = stars[ship.destIndex].group.position;
                moveDir.subVectors(target, ship.group.position);
            }
            const remaining = moveDir.length();
            if (remaining > 1e-4) {
                const step = Math.min(remaining, ship.speed * dt);
                ship.group.position.addScaledVector(moveDir, step / remaining);
                lookMat.lookAt(target, ship.group.position, worldUp);
                targetQuat.setFromRotationMatrix(lookMat);
                ship.group.quaternion.slerp(targetQuat, Math.min(1, dt * 5.2));
            }
            ship.exhaust.scale.z = 0.72 + Math.sin(tSec * 14 + ship.phase) * 0.32;
        }
        if (selectedShip >= 0) syncRouteLine();
    };

    const selectRay = raycaster => {
        const hits = raycaster.intersectObjects(targets, false);
        if (!hits.length) return false;
        const { starIndex, shipIndex } = hits[0].object.userData;
        if (typeof starIndex === "number") {
            selectStar(starIndex);
            return true;
        }
        if (typeof shipIndex === "number") {
            selectShip(shipIndex);
            return true;
        }
        return false;
    };

    const resetClock = () => {
        lastNow = performance.now();
    };

    populate();

    return { group, targets, stars, ships, update, selectRay, selectStar, resetClock };
}

export function createStarsExhibit(parentScene, x, z, report) {
    const sector = createSectorSimulation({
        starCount: 20,
        shipCount: 20,
        halfX: 1.75,
        minY: 0.85,
        maxY: 3.10,
        halfZ: 1.55,
        minSpacing: 0.62,
        modelScale: 0.72,
        speedScale: 0.68,
        onSelect({ kind, star, ship, detail }) {
            if (kind === "star") report?.(`${detail} · Routing ${ship?.name ?? "craft"}`);
            else report?.(detail);
        },
    });
    sector.group.position.set(x, 0, z);
    parentScene.add(sector.group);
    return {
        group: sector.group,
        targets: sector.targets,
        update(dt) {
            sector.update(performance.now(), dt);
        },
        select(ray) {
            return sector.selectRay(ray);
        },
    };
}

export function createOrbitRoom(report) {
    const scene = new T.Scene();
    scene.background = new T.Color(0x060c18);

    const dustCoords = [];
    for (let i = 0; i < 420; i++) {
        dustCoords.push(
            ((i * 157 % 997) / 997 - 0.5) * 9.4,
            0.25 + ((i * 223 % 991) / 991) * 4.2,
            ((i * 43 % 977) / 977 - 0.5) * 8.6,
        );
    }
    const dustGeo = new T.BufferGeometry();
    dustGeo.setAttribute("position", new T.Float32BufferAttribute(dustCoords, 3));
    scene.add(new T.Points(dustGeo, new T.PointsMaterial({ color: 0x9eb6c4, size: 0.036 })));

    const sector = createSectorSimulation({
        onSelect({ detail }) {
            report?.(detail);
        },
    });
    scene.add(sector.group);

    const room = galleryRoom(scene, {
        enter: sector.resetClock,
        update: now => sector.update(now),
        select: sector.selectRay,
    });
    room.aimSelect = true;
    return room;
}

if (standalone) {
    const scene = new T.Scene();
    scene.background = new T.Color(0x060c18);
    const rig = new T.Group();
    const camera = new T.PerspectiveCamera(56, 1, 0.05, 80);
    rig.add(camera);
    scene.add(rig, new T.HemisphereLight(0xc7e5f4, 0x3b425e, 2.4));
    const sun = new T.DirectionalLight(0xffdfb6, 2.3);
    sun.position.set(-4, 6, 3);
    scene.add(sun);

    const dustCoords = [];
    for (let i = 0; i < 420; i++) {
        dustCoords.push(
            ((i * 157 % 997) / 997 - 0.5) * 9.4,
            0.25 + ((i * 223 % 991) / 991) * 4.2,
            ((i * 43 % 977) / 977 - 0.5) * 8.6,
        );
    }
    const dustGeo = new T.BufferGeometry();
    dustGeo.setAttribute("position", new T.Float32BufferAttribute(dustCoords, 3));
    scene.add(new T.Points(dustGeo, new T.PointsMaterial({ color: 0x9eb6c4, size: 0.036 })));

    const sector = createSectorSimulation({
        navElement: destinationsNav,
        onSelect({ kind, star, ship, detail }) {
            if (kind === "star") {
                voyage.textContent = `${star.name} (${PLAYERS[star.owner].name})${ship ? ` · Routing ${ship.name}` : ""}`;
                arrival.textContent = detail;
            } else {
                voyage.textContent = detail;
                arrival.textContent = "Click any star to reroute this ship, or let the fleet patrol freely.";
            }
        },
    });
    scene.add(sector.group);
    voyage.textContent = "20 ships flying autonomously between 20 3D stars.";

    const center = new T.Vector3(0, 2.15, 0);
    const ray = new T.Raycaster();
    let camYaw = 0;
    let camPitch = 0.14;
    let camDist = 7.4;

    function updateStandaloneCamera() {
        const cp = Math.cos(camPitch);
        camera.position.set(
            center.x + Math.sin(camYaw) * cp * camDist,
            center.y + Math.sin(camPitch) * camDist,
            center.z + Math.cos(camYaw) * cp * camDist,
        );
        camera.lookAt(center);
    }

    try {
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
        updateStandaloneCamera();

        let dragging = false;
        let moved = 0;
        let lastX = 0;
        let lastY = 0;
        renderer.domElement.addEventListener("pointerdown", e => {
            dragging = true;
            moved = 0;
            lastX = e.clientX;
            lastY = e.clientY;
            renderer.domElement.setPointerCapture(e.pointerId);
        });
        renderer.domElement.addEventListener("pointermove", e => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            moved += Math.hypot(dx, dy);
            lastX = e.clientX;
            lastY = e.clientY;
            camYaw -= dx * 0.006;
            camPitch = T.MathUtils.clamp(camPitch + dy * 0.005, -0.75, 0.95);
            updateStandaloneCamera();
        });
        renderer.domElement.addEventListener("pointerup", e => {
            if (!dragging) return;
            dragging = false;
            if (moved < 6) {
                const rect = renderer.domElement.getBoundingClientRect();
                ray.setFromCamera(
                    new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1,
                        1 - (e.clientY - rect.top) / rect.height * 2),
                    camera,
                );
                sector.selectRay(ray);
            }
        });
        renderer.domElement.addEventListener("wheel", e => {
            e.preventDefault();
            camDist = T.MathUtils.clamp(camDist + e.deltaY * 0.004, 3.2, 12.5);
            updateStandaloneCamera();
        }, { passive: false });

        const pollGamepad = readGamepad();
        const useMenu = gamepadMenu("main button, main a[href]");
        renderer.setAnimationLoop(now => {
            const pad = pollGamepad();
            if (pad) useMenu(pad);
            sector.update(now);
            renderer.render(scene, camera);
        });
    } catch {
        viewport.hidden = true;
        setInterval(() => sector.update(performance.now()), 50);
    }
}
