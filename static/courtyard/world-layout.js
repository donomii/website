import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

export const OCTAGON_APOTHEM = 15.0;
export const OCTAGON_SIDE_HALF = OCTAGON_APOTHEM * Math.tan(Math.PI / 8);

const COURTYARD_THICK = 0.24;
const COURTYARD_HEIGHT = 4.2;
const WALL_THICK = 0.20;
const DOOR_GAP = 0.48;
const DOOR_WIDTH = 2.6;
const DOOR_HEIGHT = 3.3;
const PLAYER_RADIUS = 0.34;

export function faceFrame(faceIndex) {
    const theta = faceIndex * Math.PI / 4;
    return {
        faceIndex,
        theta,
        nx: Math.sin(theta),
        nz: Math.cos(theta),
        tx: Math.cos(theta),
        tz: -Math.sin(theta),
    };
}

function makeFaceZone({
    id, name, buttonId, faceIndex, width, depth, height, style,
    ownWalls = false, outdoor = false, yawOffset = 0,
    doorWidth = DOOR_WIDTH, doorHeight = DOOR_HEIGHT, open = false,
    tunnelHi = OCTAGON_APOTHEM + DOOR_GAP, signInner = OCTAGON_APOTHEM + DOOR_GAP + 0.04,
    spawnLocal, spawnYaw,
}) {
    const frame = faceFrame(faceIndex);
    const startDist = open ? OCTAGON_APOTHEM : OCTAGON_APOTHEM + DOOR_GAP;
    const centerDist = startDist + depth / 2;
    const yaw = (faceIndex === 0 && outdoor) ? 0 : (frame.theta + Math.PI + yawOffset);
    return {
        id,
        name,
        buttonId,
        faceIndex,
        frame,
        cx: frame.nx * centerDist,
        cz: frame.nz * centerDist,
        halfW: width / 2,
        halfD: depth / 2,
        width,
        depth,
        height,
        style,
        ownWalls,
        outdoor,
        yaw,
        doorWidth,
        doorHeight,
        open,
        tunnelLo: OCTAGON_APOTHEM,
        tunnelHi,
        signInner,
        spawnLocal: spawnLocal ?? [0, depth / 2 - 2.8],
        spawnYaw: spawnYaw ?? yaw,
    };
}

export const ZONES = [
    {
        id: "courtyard",
        name: "The Courtyard",
        apothem: OCTAGON_APOTHEM,
        cx: 0,
        cz: 0,
        yaw: 0,
        height: 0,
        style: "courtyard",
        outdoor: true,
        spawnLocal: [0, 10.2],
        spawnYaw: 0,
    },
    // Face 0 (South +Z): Outdoor Riverbank through open garden archway
    makeFaceZone({
        id: "river",
        name: "Riverbank",
        buttonId: "river-door",
        faceIndex: 0,
        width: 38,
        depth: 32,
        height: 0,
        style: "outdoor",
        outdoor: true,
        ownWalls: true,
        doorWidth: 3.6,
        doorHeight: 3.6,
        open: true,
        tunnelHi: OCTAGON_APOTHEM + COURTYARD_THICK,
        signInner: OCTAGON_APOTHEM + COURTYARD_THICK + 0.04,
        spawnLocal: [0, -13.2],
        spawnYaw: Math.PI,
    }),
    // Face 2 (East +X): Combined Space Hangar (Accumulative Station + Asteroid Farmer)
    makeFaceZone({
        id: "space",
        name: "Space Hangar",
        buttonId: "space-door",
        faceIndex: 2,
        width: 12,
        depth: 16,
        height: 5.8,
        style: "space",
        ownWalls: true,
        signInner: OCTAGON_APOTHEM + DOOR_GAP + 0.28,
        spawnLocal: [0, 5.2],
    }),
    // Face 3 (Northeast): Generative Workshop (Pocket Bonsai + Zipper Studio + Map Conversion)
    makeFaceZone({
        id: "workshop",
        name: "Sculpture & Code Studio",
        buttonId: "workshop-door",
        faceIndex: 3,
        width: 12,
        depth: 16,
        height: 4.8,
        style: "gallery",
        spawnLocal: [0, 5.2],
    }),
    // Face 4 (North -Z): Art Deco Salon
    makeFaceZone({
        id: "art-deco",
        name: "Art Deco salon",
        buttonId: "art-deco-door",
        faceIndex: 4,
        width: 12,
        depth: 16,
        height: 6.5,
        style: "art_deco",
        ownWalls: true,
        doorWidth: 2.08,
        doorHeight: 3.29,
        tunnelHi: OCTAGON_APOTHEM + DOOR_GAP - 0.02,
        signInner: OCTAGON_APOTHEM + DOOR_GAP + 0.04,
        spawnLocal: [0, 5.2],
    }),
    // Face 5 (Northwest): Games & Worlds Hall (Games Aquarium + Jump + L-World)
    makeFaceZone({
        id: "games",
        name: "Games & Worlds",
        buttonId: "games-door",
        faceIndex: 5,
        width: 12,
        depth: 16,
        height: 4.8,
        style: "gallery",
        spawnLocal: [0, 5.2],
    }),
    // Face 6 (West -X): Library & Datatree Archive Hall
    makeFaceZone({
        id: "library",
        name: "Library & Datatree",
        buttonId: "library-door",
        faceIndex: 6,
        width: 11.6,
        depth: 18,
        height: 5.0,
        style: "library",
        ownWalls: true,
        signInner: OCTAGON_APOTHEM + DOOR_GAP + 0.19,
        spawnLocal: [0, 6.2],
    }),
];

export const ZONE_MAP = new Map(ZONES.map(zone => [zone.id, zone]));

export const DOORWAYS = ZONES.filter(z => z.id !== "courtyard").map(zone => ({
    a: "courtyard",
    b: zone.id,
    zone,
    frame: zone.frame,
    midDist: (zone.tunnelLo + zone.tunnelHi) / 2,
    width: zone.doorWidth,
    height: zone.doorHeight,
    open: zone.open,
}));

export const ADJACENT = new Map(ZONES.map(zone => [zone.id, new Set()]));
export const DOOR_ENTRANCES = new Map(ZONES.map(zone => [zone.id, []]));

for (const door of DOORWAYS) {
    ADJACENT.get(door.a).add(door.b);
    ADJACENT.get(door.b).add(door.a);
    const pos = new T.Vector3(door.frame.nx * door.midDist, 1.5, door.frame.nz * door.midDist);
    DOOR_ENTRANCES.get(door.a).push({ to: door.b, pos });
    DOOR_ENTRANCES.get(door.b).push({ to: door.a, pos });
}

export function inOctagon(x, z, apothem) {
    return Math.max(Math.abs(x), Math.abs(z), (Math.abs(x) + Math.abs(z)) * Math.SQRT1_2) <= apothem;
}

export function roomLocalToWorld(zone, lx, lz) {
    const cos = Math.cos(zone.yaw);
    const sin = Math.sin(zone.yaw);
    return [zone.cx + lx * cos + lz * sin, zone.cz - lx * sin + lz * cos];
}

export function worldToRoomLocal(zone, wx, wz) {
    const dx = wx - zone.cx;
    const dz = wz - zone.cz;
    const cos = Math.cos(zone.yaw);
    const sin = Math.sin(zone.yaw);
    return [dx * cos - dz * sin, dx * sin + dz * cos];
}

export function zoneAt(x, z, margin = 0) {
    if (inOctagon(x, z, OCTAGON_APOTHEM + margin)) return ZONE_MAP.get("courtyard");
    for (const zone of ZONES) {
        if (zone.id === "courtyard") continue;
        const [lx, lz] = worldToRoomLocal(zone, x, z);
        if (Math.abs(lx) <= zone.halfW + margin && Math.abs(lz) <= zone.halfD + margin) {
            return zone;
        }
    }
    return null;
}

export function inDoorway(x, z) {
    for (const door of DOORWAYS) {
        const { frame, midDist, zone } = door;
        const halfTunnel = (zone.tunnelHi - zone.tunnelLo) / 2 + 0.85;
        const dx = x - frame.nx * midDist;
        const dz = z - frame.nz * midDist;
        const along = dx * frame.nx + dz * frame.nz;
        const across = dx * frame.tx + dz * frame.tz;
        if (Math.abs(along) <= halfTunnel && Math.abs(across) <= door.width / 2 - PLAYER_RADIUS) {
            return door;
        }
    }
    return null;
}

function doorwaySign(label) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#2b1f1a";
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = "#dbba85";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 96);
    ctx.fillStyle = "#ffedcb";
    ctx.font = "36px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(label, 256, 70, 464);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: texture });
}

export function buildArchitecture(scene) {
    const wallMeshes = [];
    const floorMeshes = [];
    const galleryMat = {
        wall: new T.MeshStandardMaterial({ color: 0x5c4238, roughness: 0.9 }),
        floor: new T.MeshStandardMaterial({ color: 0x534238, roughness: 0.88 }),
        ceiling: new T.MeshStandardMaterial({ color: 0x2d211c, roughness: 0.92 }),
    };

    function addBox(parent, w, h, d, x, y, z, material, isWall = true, isFloor = false) {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        if (isWall) wallMeshes.push(mesh);
        if (isFloor) floorMeshes.push(mesh);
        return mesh;
    }

    function addPlane(parent, w, d, x, y, z, rotX, material, isFloor = false) {
        const mesh = new T.Mesh(new T.PlaneGeometry(w, d), material);
        mesh.position.set(x, y, z);
        mesh.rotation.x = rotX;
        parent.add(mesh);
        if (isFloor) floorMeshes.push(mesh);
        return mesh;
    }

    function buildWallSegment(parent, fixedZ, spanHalf, wallH, thickness, wallMat, door) {
        if (!door) {
            addBox(parent, spanHalf * 2, wallH, thickness, 0, wallH / 2, fixedZ, wallMat);
            return;
        }
        const halfDoor = door.width / 2;
        const sideLen = spanHalf - halfDoor;
        if (sideLen > 0.02) {
            for (const s of [-1, 1]) {
                addBox(parent, sideLen, wallH, thickness, s * (halfDoor + sideLen / 2), wallH / 2, fixedZ, wallMat);
            }
        }
        if (wallH > door.height + 0.05) {
            const lh = wallH - door.height;
            addBox(parent, door.width, lh, thickness, 0, door.height + lh / 2, fixedZ, wallMat);
        }
    }

    // Build interior shells for enclosed multi-exhibit gallery rooms aligned to their octagon faces.
    const t = WALL_THICK;
    for (const zone of ZONES) {
        if (zone.id === "courtyard" || zone.outdoor || zone.ownWalls) continue;
        const roomGroup = new T.Group();
        roomGroup.position.set(zone.cx, 0, zone.cz);
        roomGroup.rotation.y = zone.yaw;
        scene.add(roomGroup);
        addPlane(roomGroup, zone.width, zone.depth, 0, 0, 0, -Math.PI / 2, galleryMat.floor, true);
        addPlane(roomGroup, zone.width, zone.depth, 0, zone.height, 0, Math.PI / 2, galleryMat.ceiling, false);
        addBox(roomGroup, t, zone.height, zone.depth + 2 * t, -zone.halfW - t / 2, zone.height / 2, 0, galleryMat.wall);
        addBox(roomGroup, t, zone.height, zone.depth + 2 * t, zone.halfW + t / 2, zone.height / 2, 0, galleryMat.wall);
        addBox(roomGroup, zone.width, zone.height, t, 0, zone.height / 2, -zone.halfD - t / 2, galleryMat.wall);
        buildWallSegment(roomGroup, zone.halfD + t / 2, zone.halfW, zone.height, t, galleryMat.wall, {
            width: zone.doorWidth,
            height: zone.doorHeight,
        });
        roomGroup.updateMatrixWorld(true);
    }

    // Build the 8 Courtyard Octagon exterior walls and dressed sandstone corner piers.
    const courtyardWallMat = new T.MeshStandardMaterial({ color: 0xbe684a, roughness: 0.92 });
    const courtyardStone = new T.MeshStandardMaterial({ color: 0xe5ca9e, roughness: 0.92 });
    const frameMat = new T.MeshStandardMaterial({ color: 0xdcc094, roughness: 0.75 });
    const thresholdMat = new T.MeshStandardMaterial({ color: 0x9b8064, roughness: 0.85 });
    const doorByFace = new Map(DOORWAYS.map(d => [d.zone.faceIndex, d]));
    const wallSpanHalf = OCTAGON_SIDE_HALF - 0.11;
    const frameT = 0.09;

    for (let k = 0; k < 8; k++) {
        const frame = faceFrame(k);
        const faceGroup = new T.Group();
        faceGroup.rotation.y = frame.theta;
        scene.add(faceGroup);

        const door = doorByFace.get(k) ?? null;
        buildWallSegment(faceGroup, OCTAGON_APOTHEM + COURTYARD_THICK / 2, wallSpanHalf,
            COURTYARD_HEIGHT, COURTYARD_THICK, courtyardWallMat, door);

        if (!door) {
            for (const h of [0.36, COURTYARD_HEIGHT - 0.16]) {
                addBox(faceGroup, OCTAGON_SIDE_HALF * 1.92, 0.2, 0.1, 0, h, OCTAGON_APOTHEM - 0.05, courtyardStone, false);
            }
        } else {
            const tunnelLo = door.zone.tunnelLo;
            const tunnelHi = door.zone.tunnelHi;
            const mid = (tunnelLo + tunnelHi) / 2;
            const depth = tunnelHi - tunnelLo;
            const jambH = door.height - frameT;

            addBox(faceGroup, door.width - 2 * frameT - 0.004, 0.014, depth, 0, 0.007, mid, thresholdMat, false, true);
            for (const s of [-1, 1]) {
                addBox(faceGroup, frameT, jambH, depth + 0.02, s * (door.width / 2 - frameT / 2), jambH / 2, mid, frameMat);
            }
            addBox(faceGroup, door.width, frameT, depth + 0.02, 0, door.height - frameT / 2, mid, frameMat);

            const courtyardSign = new T.Mesh(new T.PlaneGeometry(1.9, 0.42), doorwaySign(door.zone.name));
            courtyardSign.position.set(0, door.height + 0.34, tunnelLo - 0.03);
            courtyardSign.rotation.y = Math.PI;
            faceGroup.add(courtyardSign);

            const returnSign = new T.Mesh(new T.PlaneGeometry(1.9, 0.42), doorwaySign("The Courtyard"));
            returnSign.position.set(0, door.height + 0.34, door.zone.signInner);
            faceGroup.add(returnSign);
        }

        // Corner sandstone pier covering the octagon vertex joint cleanly.
        const cornerAngle = (k + 0.5) * Math.PI / 4;
        const cornerDist = (OCTAGON_APOTHEM + COURTYARD_THICK / 2) / Math.cos(Math.PI / 8);
        const pier = new T.Mesh(new T.BoxGeometry(0.46, COURTYARD_HEIGHT + 0.18, 0.46), courtyardStone);
        pier.position.set(Math.sin(cornerAngle) * cornerDist, (COURTYARD_HEIGHT + 0.18) / 2, Math.cos(cornerAngle) * cornerDist);
        pier.rotation.y = cornerAngle;
        scene.add(pier);
        wallMeshes.push(pier);
        faceGroup.updateMatrixWorld(true);
    }

    scene.updateMatrixWorld(true);
    return { wallMeshes, floorMeshes };
}
