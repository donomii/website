import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

const DOOR_WIDTH = 2.6;
const DOOR_HEIGHT = 3.3;
const WALL_THICK = 0.20;
const PLAYER_RADIUS = 0.34;

export const ZONES = [
    {
        id: "courtyard", name: "The Courtyard",
        xMin: -10, xMax: 10, zMin: -14, zMax: 14, cx: 0, cz: 0, yaw: 0,
        height: 0, style: "courtyard", outdoor: true,
        spawnLocal: [0, 8.5], spawnYaw: 0,
    },
    {
        id: "river", name: "Riverbank", buttonId: "river-door",
        xMin: -19, xMax: 19, zMin: 14, zMax: 46, cx: 0, cz: 30, yaw: 0,
        height: 0, style: "outdoor", outdoor: true, ownWalls: true,
        spawnLocal: [0, -13.5], spawnYaw: Math.PI,
    },
    {
        id: "nw_hall", name: "Northwest Gallery",
        xMin: -31, xMax: -10.5, zMin: -13.5, zMax: -7.5, cx: -20.75, cz: -10.5, yaw: 0,
        height: 4.2, style: "hall",
        spawnLocal: [0, 0], spawnYaw: Math.PI / 2,
    },
    {
        id: "datatree", name: "Datatree", buttonId: "datatree-door",
        xMin: -30.5, xMax: -20.5, zMin: -24, zMax: -14, cx: -25.5, cz: -19, yaw: 0,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.3], spawnYaw: 0,
    },
    {
        id: "jump", name: "Jump", buttonId: "jump-door",
        xMin: -41.5, xMax: -31.5, zMin: -17.5, zMax: -7.5, cx: -36.5, cz: -12.5, yaw: Math.PI / 2,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.4], spawnYaw: Math.PI / 2,
    },
    {
        id: "library", name: "Library", buttonId: "library-door",
        xMin: -36.5, xMax: -10.5, zMin: -7, zMax: 7, cx: -23.5, cz: 0, yaw: Math.PI / 2,
        height: 5.0, style: "library", ownWalls: true,
        spawnLocal: [0, 9.5], spawnYaw: Math.PI / 2,
    },
    {
        id: "sw_hall", name: "Southwest Gallery",
        xMin: -32, xMax: -10.5, zMin: 7.5, zMax: 13.5, cx: -21.25, cz: 10.5, yaw: 0,
        height: 4.2, style: "hall",
        spawnLocal: [0, 0], spawnYaw: Math.PI / 2,
    },
    {
        id: "aquarium", name: "Games Aquarium", buttonId: "aquarium-door",
        xMin: -31, xMax: -20, zMin: 14, zMax: 25, cx: -25.5, cz: 19.5, yaw: Math.PI,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.6], spawnYaw: Math.PI,
    },
    {
        id: "lworld", name: "L-World", buttonId: "lworld-door",
        xMin: -42.5, xMax: -32.5, zMin: 7.5, zMax: 17.5, cx: -37.5, cz: 12.5, yaw: Math.PI / 2,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.3], spawnYaw: Math.PI / 2,
    },
    {
        id: "art-deco", name: "Art Deco salon", buttonId: "art-deco-door",
        xMin: 10.5, xMax: 26.5, zMin: -16, zMax: -4, cx: 18.5, cz: -10, yaw: -Math.PI / 2,
        height: 6.5, style: "art_deco", ownWalls: true,
        spawnLocal: [0, 5.1], spawnYaw: -Math.PI / 2,
    },
    {
        id: "e_hall", name: "East Space Hall",
        xMin: 10.5, xMax: 32, zMin: -3.5, zMax: 3.5, cx: 21.25, cz: 0, yaw: 0,
        height: 4.2, style: "hall",
        spawnLocal: [0, 0], spawnYaw: -Math.PI / 2,
    },
    {
        id: "asteroid", name: "Asteroid Farmer", buttonId: "asteroid-door",
        xMin: 27, xMax: 39, zMin: -16.5, zMax: -4, cx: 33, cz: -10.25, yaw: 0,
        height: 5.0, style: "space",
        spawnLocal: [-3.5, 4.5], spawnYaw: 0,
    },
    {
        id: "station", name: "Accumulative Station", buttonId: "station-door",
        xMin: 32.5, xMax: 46.5, zMin: -3.5, zMax: 8.5, cx: 39.5, cz: 2.5, yaw: -Math.PI / 2,
        height: 5.8, style: "station", ownWalls: true,
        spawnLocal: [0, 4.4], spawnYaw: -Math.PI / 2,
    },
    {
        id: "orbit", name: "Stars & Ships", buttonId: "orbit-door",
        xMin: 10.5, xMax: 21, zMin: 4, zMax: 13.5, cx: 15.75, cz: 8.75, yaw: 0,
        height: 4.8, style: "space",
        spawnLocal: [0, 3.1], spawnYaw: 0,
    },
    {
        id: "se_hall", name: "Orbital Studio Hall",
        xMin: 21.5, xMax: 47, zMin: 9.5, zMax: 13.5, cx: 34.25, cz: 11.5, yaw: 0,
        height: 4.2, style: "hall",
        spawnLocal: [0, 0], spawnYaw: -Math.PI / 2,
    },
    {
        id: "solids", name: "Pocket Bonsai", buttonId: "solids-door",
        xMin: 19.5, xMax: 29.5, zMin: 14, zMax: 24, cx: 24.5, cz: 19, yaw: Math.PI,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.3], spawnYaw: Math.PI,
    },
    {
        id: "converter", name: "Map conversion", buttonId: "converter-door",
        xMin: 30, xMax: 40, zMin: 14, zMax: 24, cx: 35, cz: 19, yaw: Math.PI,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.3], spawnYaw: Math.PI,
    },
    {
        id: "program", name: "Zipper studio", buttonId: "program-door",
        xMin: 40.5, xMax: 50.5, zMin: 14, zMax: 24, cx: 45.5, cz: 19, yaw: Math.PI,
        height: 4.6, style: "gallery",
        spawnLocal: [0, 3.3], spawnYaw: Math.PI,
    },
];

// Each doorway connects two zones along an axis-aligned boundary.
// axis: "x" means crossing X at wall boundary; "z" means crossing Z at wall boundary.
export const DOORWAYS = [
    { a: "courtyard", b: "river", axis: "z", aBound: 14, bBound: 14, center: 0, width: 3.6, height: 3.6, open: true },
    { a: "courtyard", b: "nw_hall", axis: "x", aBound: -10, bBound: -10.5, center: -10.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "nw_hall", b: "datatree", axis: "z", aBound: -13.5, bBound: -14, center: -25.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "nw_hall", b: "jump", axis: "x", aBound: -31, bBound: -31.5, center: -10.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "courtyard", b: "library", axis: "x", aBound: -10, bBound: -10.5, center: 0, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "courtyard", b: "sw_hall", axis: "x", aBound: -10, bBound: -10.5, center: 10.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "sw_hall", b: "aquarium", axis: "z", aBound: 13.5, bBound: 14, center: -25.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "sw_hall", b: "lworld", axis: "x", aBound: -32, bBound: -32.5, center: 10.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "courtyard", b: "art-deco", axis: "x", aBound: 10, bBound: 10.5, center: -10, width: 2.08, height: 3.29 },
    { a: "courtyard", b: "e_hall", axis: "x", aBound: 10, bBound: 10.5, center: 0, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "e_hall", b: "asteroid", axis: "z", aBound: -3.5, bBound: -4, center: 29.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "e_hall", b: "station", axis: "x", aBound: 32, bBound: 32.65, center: 2.5, width: 1.8, height: 2.96 },
    { a: "courtyard", b: "orbit", axis: "x", aBound: 10, bBound: 10.5, center: 9.25, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "orbit", b: "se_hall", axis: "x", aBound: 21, bBound: 21.5, center: 11.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "se_hall", b: "solids", axis: "z", aBound: 13.5, bBound: 14, center: 24.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "se_hall", b: "converter", axis: "z", aBound: 13.5, bBound: 14, center: 35, width: DOOR_WIDTH, height: DOOR_HEIGHT },
    { a: "se_hall", b: "program", axis: "z", aBound: 13.5, bBound: 14, center: 45.5, width: DOOR_WIDTH, height: DOOR_HEIGHT },
];

export const ZONE_MAP = new Map(ZONES.map(zone => [zone.id, zone]));

// Build adjacency graph and doorway positions per zone.
export const ADJACENT = new Map(ZONES.map(zone => [zone.id, new Set()]));
export const DOOR_ENTRANCES = new Map(ZONES.map(zone => [zone.id, []]));

for (const door of DOORWAYS) {
    ADJACENT.get(door.a).add(door.b);
    ADJACENT.get(door.b).add(door.a);
    const mid = (door.aBound + door.bBound) / 2;
    const pos = door.axis === "x" ? new T.Vector3(mid, 1.5, door.center) : new T.Vector3(door.center, 1.5, mid);
    DOOR_ENTRANCES.get(door.a).push({ to: door.b, pos });
    DOOR_ENTRANCES.get(door.b).push({ to: door.a, pos });
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
    for (const zone of ZONES) {
        if (x >= zone.xMin - margin && x <= zone.xMax + margin &&
            z >= zone.zMin - margin && z <= zone.zMax + margin) {
            return zone;
        }
    }
    return null;
}

export function inDoorway(x, z) {
    for (const door of DOORWAYS) {
        const lo = Math.min(door.aBound, door.bBound) - 0.85;
        const hi = Math.max(door.aBound, door.bBound) + 0.85;
        const half = door.width / 2 - PLAYER_RADIUS;
        if (door.axis === "x") {
            if (x >= lo && x <= hi && Math.abs(z - door.center) <= half) return door;
        } else {
            if (z >= lo && z <= hi && Math.abs(x - door.center) <= half) return door;
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
    ctx.font = "38px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(label, 256, 70, 464);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map: texture });
}

export function buildArchitecture(scene) {
    const wallMeshes = [];
    const floorMeshes = [];
    const styleDefs = {
        hall: { wall: 0xb0684b, floor: 0x99795d, ceiling: 0x453128, trim: 0xdab888 },
        gallery: { wall: 0x5c4238, floor: 0x534238, ceiling: 0x2d211c, trim: 0xc29e6d },
        space: { wall: 0x10182a, floor: 0x14243a, ceiling: 0x090f1d, trim: 0x5388a8 },
    };
    const mats = {};
    for (const [style, colors] of Object.entries(styleDefs)) {
        mats[style] = {
            wall: new T.MeshStandardMaterial({ color: colors.wall, roughness: 0.9 }),
            floor: new T.MeshStandardMaterial({ color: colors.floor, roughness: 0.88 }),
            ceiling: new T.MeshStandardMaterial({ color: colors.ceiling, roughness: 0.92 }),
            trim: new T.MeshStandardMaterial({ color: colors.trim, roughness: 0.65 }),
        };
    }

    function addBox(w, h, d, x, y, z, material, isWall = true, isFloor = false) {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        if (isWall) wallMeshes.push(mesh);
        if (isFloor) floorMeshes.push(mesh);
        return mesh;
    }

    function addPlane(w, d, x, y, z, rotX, material, isFloor = false) {
        const mesh = new T.Mesh(new T.PlaneGeometry(w, d), material);
        mesh.position.set(x, y, z);
        mesh.rotation.x = rotX;
        scene.add(mesh);
        if (isFloor) floorMeshes.push(mesh);
        return mesh;
    }

    function buildWallWithDoors(fixedCoord, spanMin, spanMax, axis, wallH, thickness, wallMat, doorsOnSide) {
        const sorted = [...doorsOnSide].sort((a, b) => a.center - b.center);
        let cursor = spanMin;
        for (const door of sorted) {
            const dMin = Math.max(spanMin, door.center - door.width / 2);
            const dMax = Math.min(spanMax, door.center + door.width / 2);
            if (dMin > cursor + 0.02) {
                const len = dMin - cursor;
                const mid = (cursor + dMin) / 2;
                if (axis === "x") addBox(thickness, wallH, len, fixedCoord, wallH / 2, mid, wallMat);
                else addBox(len, wallH, thickness, mid, wallH / 2, fixedCoord, wallMat);
            }
            if (wallH > door.height + 0.05) {
                const lh = wallH - door.height;
                const ly = door.height + lh / 2;
                if (axis === "x") addBox(thickness, lh, dMax - dMin, fixedCoord, ly, (dMin + dMax) / 2, wallMat);
                else addBox(dMax - dMin, lh, thickness, (dMin + dMax) / 2, ly, fixedCoord, wallMat);
            }
            cursor = Math.max(cursor, dMax);
        }
        if (spanMax > cursor + 0.02) {
            const len = spanMax - cursor;
            const mid = (cursor + spanMax) / 2;
            if (axis === "x") addBox(thickness, wallH, len, fixedCoord, wallH / 2, mid, wallMat);
            else addBox(len, wallH, thickness, mid, wallH / 2, fixedCoord, wallMat);
        }
    }

    function doorsForWall(zoneId, axis, bound) {
        return DOORWAYS.filter(door => door.axis === axis && (
            (door.a === zoneId && Math.abs(door.aBound - bound) < 0.01) ||
            (door.b === zoneId && Math.abs(door.bBound - bound) < 0.01)
        ));
    }

    // Build interior shells for halls & enclosed gallery/space rooms with walls placed
    // strictly outside room bounds so corners and adjacent rooms never overlap.
    const t = WALL_THICK;
    for (const zone of ZONES) {
        if (zone.style === "courtyard" || zone.outdoor || zone.ownWalls) continue;
        const m = mats[zone.style];
        const w = zone.xMax - zone.xMin;
        const d = zone.zMax - zone.zMin;
        const cx = (zone.xMin + zone.xMax) / 2;
        const cz = (zone.zMin + zone.zMax) / 2;
        addPlane(w, d, cx, 0, cz, -Math.PI / 2, m.floor, true);
        if (zone.height > 0) addPlane(w, d, cx, zone.height, cz, Math.PI / 2, m.ceiling, false);
        buildWallWithDoors(zone.xMin - t / 2, zone.zMin - t, zone.zMax + t, "x", zone.height, t, m.wall, doorsForWall(zone.id, "x", zone.xMin));
        buildWallWithDoors(zone.xMax + t / 2, zone.zMin - t, zone.zMax + t, "x", zone.height, t, m.wall, doorsForWall(zone.id, "x", zone.xMax));
        buildWallWithDoors(zone.zMin - t / 2, zone.xMin, zone.xMax, "z", zone.height, t, m.wall, doorsForWall(zone.id, "z", zone.zMin));
        buildWallWithDoors(zone.zMax + t / 2, zone.xMin, zone.xMax, "z", zone.height, t, m.wall, doorsForWall(zone.id, "z", zone.zMax));
    }

    // Courtyard outer walls placed strictly outside [-10, 10] x [-14, 14] with non-overlapping corners.
    const courtyardWallMat = new T.MeshStandardMaterial({ color: 0xbe684a, roughness: 0.92 });
    const courtyardStone = new T.MeshStandardMaterial({ color: 0xe5ca9e, roughness: 0.92 });
    const ct = 0.24;
    // North wall (z = [-14.5, -14.0]) and proud cornice/stringcourse ledges
    addBox(20, 5.6, 0.5, 0, 2.8, -14.25, courtyardWallMat);
    for (const height of [0.42, 3.58, 5.43]) addBox(19.98, 0.22, 0.14, 0, height, -13.92, courtyardStone);
    // West wall (x = [-10.24, -10.0]) & East wall (x = [10.0, 10.24])
    buildWallWithDoors(-10 - ct / 2, -14.5, 14 + ct, "x", 4.2, ct, courtyardWallMat, doorsForWall("courtyard", "x", -10));
    buildWallWithDoors(10 + ct / 2, -14.5, 14 + ct, "x", 4.2, ct, courtyardWallMat, doorsForWall("courtyard", "x", 10));
    // South wall (z = [14.0, 14.24]) with central Garden Archway to Riverbank
    buildWallWithDoors(14 + ct / 2, -10, 10, "z", 4.2, ct, courtyardWallMat, doorsForWall("courtyard", "z", 14));

    // Span occupied by each zone's wall along the doorway axis (interior surface to exterior surface).
    function wallInterval(zone, axis, bound) {
        if (zone.id === "courtyard") return bound < 0 ? [bound - ct, bound] : [bound, bound + ct];
        if (zone.id === "library") return [-10.65, -10.35];
        if (zone.id === "art-deco") return [10.3, 10.5];
        if (zone.id === "station") return [32.525, 32.775];
        if (zone.outdoor || zone.ownWalls) return null;
        const minBound = axis === "x" ? zone.xMin : zone.zMin;
        return Math.abs(bound - minBound) < 0.01 ? [bound - t, bound] : [bound, bound + t];
    }

    // Disjoint doorway thresholds, jamb/lintel casings (flush inside opening), and wall-proud signage.
    const frameMat = new T.MeshStandardMaterial({ color: 0xdcc094, roughness: 0.75 });
    const thresholdMat = new T.MeshStandardMaterial({ color: 0x9b8064, roughness: 0.85 });
    const frameT = 0.09;
    for (const door of DOORWAYS) {
        const zoneA = ZONE_MAP.get(door.a);
        const zoneB = ZONE_MAP.get(door.b);
        const spanA = wallInterval(zoneA, door.axis, door.aBound);
        const spanB = wallInterval(zoneB, door.axis, door.bBound);
        const bounds = [spanA, spanB].filter(Boolean).flat();
        const tunnelLo = Math.min(...bounds);
        const tunnelHi = Math.max(...bounds);
        const mid = (tunnelLo + tunnelHi) / 2;
        const depth = tunnelHi - tunnelLo;
        const frameDepth = depth + 0.02;
        const jambH = door.height - frameT;
        const dir = door.axis === "x"
            ? (Math.sign(zoneB.cx - zoneA.cx) || 1)
            : (Math.sign(zoneB.cz - zoneA.cz) || 1);
        const signAPlane = (dir > 0 ? tunnelLo : tunnelHi) - dir * 0.025;
        const signBPlane = (dir > 0 ? tunnelHi : tunnelLo) + dir * 0.025;
        const signOffset = 0.004;
        const placeSign = (label, planeCoord, rotY) => {
            const sign = new T.Mesh(new T.PlaneGeometry(1.9, 0.42), doorwaySign(label));
            if (door.axis === "x") sign.position.set(planeCoord, door.height + 0.34, door.center);
            else sign.position.set(door.center, door.height + 0.34, planeCoord);
            sign.rotation.y = rotY;
            scene.add(sign);
        };
        if (door.axis === "x") {
            addBox(depth, 0.014, door.width - 2 * frameT - signOffset, mid, 0.007, door.center, thresholdMat, false, true);
            for (const s of [-1, 1]) {
                addBox(frameDepth, jambH, frameT, mid, jambH / 2, door.center + s * (door.width / 2 - frameT / 2), frameMat);
            }
            addBox(frameDepth, frameT, door.width, mid, door.height - frameT / 2, door.center, frameMat);
            placeSign(zoneB.name, signAPlane, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
            placeSign(zoneA.name, signBPlane, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        } else {
            addBox(door.width - 2 * frameT - signOffset, 0.014, depth, door.center, 0.007, mid, thresholdMat, false, true);
            for (const s of [-1, 1]) {
                addBox(frameT, jambH, frameDepth, door.center + s * (door.width / 2 - frameT / 2), jambH / 2, mid, frameMat);
            }
            addBox(door.width, frameT, frameDepth, door.center, door.height - frameT / 2, mid, frameMat);
            placeSign(zoneB.name, signAPlane, dir > 0 ? Math.PI : 0);
            placeSign(zoneA.name, signBPlane, dir > 0 ? 0 : Math.PI);
        }
    }

    return { wallMeshes, floorMeshes };
}
