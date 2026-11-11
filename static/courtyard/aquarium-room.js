import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { createWorld, height, spawn, species, stepWorld, width } from "../../projects/games/games-aquarium/aquarium.mjs";
import { galleryRoom } from "./gallery-room.js";

const CELL = 0.13;
const TANK_Y = 0.88;
const TANK_Z = -0.95;
const TICK_MS = 230;
const MAX_AGENTS = 40;
const halfWidth = width * CELL / 2;
const halfDepth = height * CELL / 2;

function tankMesh(scene, geometry, color, x, y, z) {
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color, roughness: 0.7 }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
}

function tankSurface(scene) {
    tankMesh(scene, new T.BoxGeometry(2 * halfWidth + 0.2, TANK_Y, 2 * halfDepth + 0.2),
        0x253a43, 0, TANK_Y / 2 - 0.015, TANK_Z);
    const floor = tankMesh(scene, new T.PlaneGeometry(2 * halfWidth, 2 * halfDepth).rotateX(-Math.PI / 2),
        0x234d56, 0, TANK_Y, TANK_Z);
    floor.name = "Aquarium tank";
    for (const side of [-1, 1]) {
        tankMesh(scene, new T.BoxGeometry(2 * halfWidth + 0.2, 0.11, 0.09),
            0x8ba6a5, 0, TANK_Y + 0.035, TANK_Z + side * (halfDepth + 0.055));
        tankMesh(scene, new T.BoxGeometry(0.09, 0.11, 2 * halfDepth),
            0x8ba6a5, side * (halfWidth + 0.055), TANK_Y + 0.035, TANK_Z);
    }
    return floor;
}

function tankReadout(scene) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 288;
    const ctx = canvas.getContext("2d");
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const board = new T.Mesh(new T.PlaneGeometry(3.3, 0.93), new T.MeshBasicMaterial({ map: texture }));
    board.position.set(0, 1.62, -2.38);
    scene.add(board);
    return (world, paused, selected, message) => {
        ctx.fillStyle = "#142e35";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#9bbbbb";
        ctx.lineWidth = 5;
        ctx.strokeRect(9, 9, 1006, 270);
        ctx.fillStyle = "#e2f4ed";
        ctx.textAlign = "center";
        ctx.font = "bold 55px system-ui";
        ctx.fillText("Games Aquarium", 512, 74);
        ctx.font = "32px system-ui";
        ctx.fillText(`${paused ? "Paused" : "Running"} · Tick ${world.tick} · ${world.agents.length} creatures`, 512, 128);
        ctx.fillText(`${world.built} built · ${world.broken} broken · ${world.caught} caught`, 512, 177);
        ctx.fillStyle = species[selected];
        ctx.fillText(`Place ${selected} · ${message}`, 512, 234, 960);
        texture.needsUpdate = true;
    };
}

function occupants(scene) {
    const make = (geometry, name, color, count) => {
        const mesh = new T.InstancedMesh(geometry, new T.MeshStandardMaterial({ color }), count);
        mesh.name = name;
        mesh.frustumCulled = false;
        scene.add(mesh);
        return mesh;
    };
    const agents = {
        builder: make(new T.IcosahedronGeometry(CELL * 0.43, 1), "Aquarium builders", species.builder, MAX_AGENTS),
        breaker: make(new T.BoxGeometry(CELL * 0.75, CELL * 0.7, CELL * 0.75), "Aquarium breakers", species.breaker, MAX_AGENTS),
        hunter: make(new T.ConeGeometry(CELL * 0.47, CELL, 4), "Aquarium hunters", species.hunter, MAX_AGENTS),
    };
    const walls = make(new T.BoxGeometry(CELL * 0.91, CELL * 0.85, CELL * 0.91), "Aquarium walls", 0x8eb2b8, width * height);
    const matrix = new T.Matrix4();
    const place = (mesh, x, y, lift, scale) => {
        matrix.makeScale(scale, scale, scale);
        matrix.setPosition((x + 0.5) * CELL - halfWidth, TANK_Y + lift, TANK_Z + (y + 0.5) * CELL - halfDepth);
        mesh.setMatrixAt(mesh.count++, matrix);
    };
    return world => {
        for (const mesh of [walls, ...Object.values(agents)]) mesh.count = 0;
        for (const cell of world.blocks) place(walls, cell % width, Math.floor(cell / width), CELL * 0.425, 1);
        for (const agent of world.agents) place(agents[agent.type], agent.x, agent.y, CELL * 0.5, agent.stun ? 0.55 : 1);
        for (const mesh of [walls, ...Object.values(agents)]) mesh.instanceMatrix.needsUpdate = true;
    };
}

export function createAquariumRoom() {
    const scene = new T.Scene();
    scene.background = new T.Color(0x192a33);
    scene.add(new T.HemisphereLight(0xd9f4f3, 0x566568, 2.1));
    const light = new T.DirectionalLight(0xf5e5c5, 2.6);
    light.position.set(-2, 5, 3);
    scene.add(light);
    const tank = tankSurface(scene);
    const drawWorld = occupants(scene);
    const drawReadout = tankReadout(scene);
    let world = createWorld();
    let paused = false;
    let selected = "builder";
    let message = "Select an empty cell";
    let lastTick;
    const show = () => {
        drawWorld(world);
        drawReadout(world, paused, selected, message);
    };
    const choose = type => {
        selected = type;
        message = "Select an empty cell";
        show();
    };
    const advance = () => {
        stepWorld(world);
        show();
    };
    show();
    const room = galleryRoom(scene, {
        actionLift: 1.05,
        actions: [
            ["Run / pause", () => { paused = !paused; lastTick = undefined; show(); }],
            ["Step when paused", () => { if (paused) advance(); }],
            ["Builder", () => choose("builder")],
            ["Breaker", () => choose("breaker")],
            ["Hunter", () => choose("hunter")],
            ["Reset tank", () => { world = createWorld(); lastTick = undefined; message = "Tank reset"; show(); }],
        ],
        update(now) {
            if (paused) return;
            if (lastTick === undefined) lastTick = now;
            if (now - lastTick >= TICK_MS) {
                lastTick = now;
                advance();
            }
        },
        enter() { lastTick = undefined; },
        select(ray) {
            const hit = ray.intersectObject(tank)[0];
            if (!hit) return false;
            const local = (tank.parent ?? scene).worldToLocal(hit.point.clone());
            const x = Math.floor((local.x + halfWidth) / CELL);
            const y = Math.floor((local.z - TANK_Z + halfDepth) / CELL);
            message = spawn(world, selected, x, y) ? "Creature placed" : "Cell occupied or tank full";
            show();
            return true;
        },
    });
    room.canStand = (x, z) => Math.abs(x) > halfWidth + 0.25 || Math.abs(z - TANK_Z) > halfDepth + 0.25;
    return room;
}
