import * as T from "three";

// Crawl of the Beholder VR Tabletop Exhibit
// Reuses the complete original JavaScript codebase of Crawl of the Beholder
// by mounting a 3D diorama, interactive 3D control console, and retro scrying screen
// on a carved marble table in the Roman Courtyard.

const COTB_BASE = "/projects/games/crawlofthebeholder/";
const COTB_SCRIPTS = [
    "src/resources.generated.js",
    "src/vaults.generated.js",
    "src/monster_flavour.generated.js",
    "src/lore.generated.js",
    "src/runtime/engine/core.js",
    "src/runtime/engine/monster_traits.js",
    "src/runtime/engine/combat_math.js",
    "src/runtime/engine/messages_and_visibility.js",
    "src/runtime/engine/floor_marks.js",
    "src/runtime/engine/monster_ai.js",
    "src/runtime/engine/party/combat.js",
    "src/runtime/engine/party/movement.js",
    "src/runtime/engine/party/traversal.js",
    "src/runtime/engine/party/interaction.js",
    "src/runtime/engine/party/fixtures.js",
    "src/runtime/engine/party/inventory.js",
    "src/runtime/engine/items/elements.js",
    "src/runtime/engine/party/items.js",
    "src/runtime/engine/items/use.js",
    "src/runtime/engine/party/turn.js",
    "src/runtime/render/classic_graphics.js",
    "src/runtime/render/viewport_rendering.js",
    "src/runtime/render/ui_chrome.js",
    "src/runtime/engine/classes.js",
    "src/runtime/engine/dcss_layouts.js",
    "src/runtime/engine/expedition_layouts.js",
    "src/runtime/engine/mapgen.js",
    "src/runtime/io/persistence.js",
    "src/runtime/config/difficulty.js",
    "src/runtime/config/deities.js",
    "src/runtime/config/portraits.js",
    "src/runtime/systems/reactions.js",
    "src/runtime/systems/economy.js",
    "src/runtime/systems/inventory_extras.js",
    "src/runtime/systems/talents.js",
    "src/runtime/systems/boss_monsters.js",
    "src/runtime/systems/shops.js",
    "src/runtime/systems/npcs.js",
    "src/runtime/systems/hidden_passages.js",
    "src/runtime/render/sound.js",
    "src/runtime/systems/bestiary.js",
    "src/runtime/systems/wanderers.js",
    "src/runtime/systems/quests.js",
    "src/runtime/systems/campaign.js",
    "src/runtime/systems/fishing.js",
    "src/runtime/systems/graves.js",
    "src/runtime/systems/delving.js",
    "src/runtime/systems/combat_extras.js",
    "src/runtime/systems/milestones.js",
    "src/runtime/systems/locks.js",
    "src/runtime/systems/floor_hazards.js",
    "src/runtime/systems/allies.js",
    "src/runtime/systems/engineering.js",
    "src/runtime/systems/ecology.js",
    "src/runtime/systems/mastery.js",
    "src/runtime/systems/exploration.js",
    "src/runtime/systems/theme_rooms.js",
    "src/runtime/systems/alchemy.js",
    "src/runtime/systems/weather.js",
    "src/runtime/systems/arcane.js",
    "src/runtime/systems/enchanting.js",
    "src/runtime/systems/events.js",
    "src/runtime/systems/corruption.js",
    "src/runtime/systems/relics.js",
    "src/runtime/systems/siege.js",
    "src/runtime/systems/bloodlines.js",
    "src/runtime/systems/gadgets.js",
    "src/runtime/systems/cartography.js",
    "src/runtime/systems/lore.js",
    "src/runtime/systems/artefacts.js",
    "src/runtime/systems/mutations.js",
    "src/runtime/systems/camping.js",
    "src/runtime/systems/leylines.js",
    "src/runtime/systems/contracts.js",
    "src/runtime/systems/herbalism.js",
    "src/runtime/systems/divination.js",
    "src/runtime/systems/necromancy.js",
    "src/runtime/systems/runes.js",
    "src/runtime/systems/harvesting.js",
    "src/runtime/systems/totems.js",
    "src/runtime/systems/resonance.js",
    "src/runtime/systems/spirits.js",
    "src/runtime/systems/cooking.js",
    "src/runtime/systems/bardic.js",
    "src/runtime/systems/psionics.js",
    "src/runtime/systems/timewarp.js",
    "src/runtime/systems/mining.js",
    "src/runtime/systems/smithing.js",
    "src/runtime/systems/morale.js",
    "src/runtime/systems/constellations.js",
    "src/runtime/systems/charms.js",
    "src/runtime/render/mobile.js",
    "src/runtime/render/vr_feedback.js",
    "src/runtime/render/vr.js",
    "src/runtime/systems/short_expedition.js",
    "src/runtime/systems/game_modes.js",
    "src/runtime/io/dev_options.js",
    "src/runtime/io/input.js"
];

let cotbLoadPromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const fullUrl = src.startsWith("http") || src.startsWith("/") ? src : COTB_BASE + src;
        const existing = document.querySelector(`script[src="${fullUrl}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") return resolve();
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", reject);
            return;
        }
        const s = document.createElement("script");
        s.src = fullUrl;
        s.async = false;
        s.onload = () => {
            s.dataset.loaded = "true";
            resolve();
        };
        s.onerror = (e) => reject(new Error(`Failed to load script ${fullUrl}: ${e}`));
        document.head.appendChild(s);
    });
}

function patchResources(obj, seen = new Set()) {
    if (!obj || typeof obj !== "object" || seen.has(obj)) return;
    seen.add(obj);
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === "string") {
            if ((val.startsWith("vendor/") || val.startsWith("art/")) && !val.startsWith(COTB_BASE)) {
                obj[key] = COTB_BASE + val;
            }
        } else if (typeof val === "object" && val !== null) {
            patchResources(val, seen);
        }
    }
}

async function ensureCotBEngine() {
    if (!cotbLoadPromise) {
        cotbLoadPromise = (async () => {
            for (const relPath of COTB_SCRIPTS) {
                await loadScript(relPath);
            }
            if (window.CotBResources) {
                patchResources(window.CotBResources);
            }
            return window.CotBRuntime;
        })();
    }
    return cotbLoadPromise;
}

function updateGeometryFromVerts(geom, verts) {
    if (!verts || verts.length === 0) {
        geom.setAttribute("position", new T.BufferAttribute(new Float32Array(0), 3));
        geom.setAttribute("uv", new T.BufferAttribute(new Float32Array(0), 2));
        geom.setAttribute("color", new T.BufferAttribute(new Float32Array(0), 3));
        return;
    }
    const count = verts.length / 16;
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const colors = new Float32Array(count * 3);
    for (let i = 0, p = 0, u = 0, c = 0; i < verts.length; i += 16) {
        positions[p++] = verts[i];
        positions[p++] = verts[i + 1];
        positions[p++] = verts[i + 2];
        uvs[u++] = verts[i + 3];
        uvs[u++] = verts[i + 4];
        colors[c++] = verts[i + 5];
        colors[c++] = verts[i + 6];
        colors[c++] = verts[i + 7];
    }
    geom.setAttribute("position", new T.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new T.BufferAttribute(uvs, 2));
    geom.setAttribute("color", new T.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
}

export async function createBeholderExhibit(scene, posX = -5.8, posZ = -3.5) {
    await ensureCotBEngine();

    // 1. Core Headless Game Context
    const viewportDiv = document.createElement("div");
    viewportDiv.style.width = "400px";
    viewportDiv.style.height = "260px";
    viewportDiv.getBoundingClientRect = () => ({
        width: 400,
        height: 260,
        left: 0,
        top: 0,
        right: 400,
        bottom: 260
    });

    const dummyEls = new Map();
    const customDoc = {
        getElementById: (id) => {
            if (id === "viewport") return viewportDiv;
            if (!dummyEls.has(id)) {
                dummyEls.set(id, document.createElement("div"));
            }
            return dummyEls.get(id);
        },
        createElement: (...args) => document.createElement(...args),
        head: document.head,
        body: document.body
    };

    const ctx = window.CotBRuntime.createCoreContext(window.CotBResources, customDoc);

    // Intercept image loader to guarantee correct root prefix on courtyard page
    const origImageEntry = ctx.imageEntry;
    ctx.imageEntry = function (src, allowClassicFallback = true) {
        if (typeof src === "string" && !src.startsWith("data:") && !src.startsWith("http") && !src.startsWith("/")) {
            src = COTB_BASE + src;
        }
        return origImageEntry(src, allowClassicFallback);
    };

    // Install all engine systems
    for (const [k, fn] of Object.entries(window.CotBRuntime)) {
        if (k.startsWith("install") && typeof fn === "function") {
            fn(ctx);
        }
    }

    if (typeof ctx.vrPark2dRendering === "function") {
        ctx.vrPark2dRendering();
    }

    ctx.beginRun({});

    // 2. Physical 3D Table Assembly
    const group = new T.Group();
    group.position.set(posX, 0, posZ);
    // Face East (+X toward courtyard center, player stands at ~ -4.3, looking West)
    group.rotation.y = Math.PI / 2;
    scene.add(group);

    const matWood = new T.MeshStandardMaterial({ color: 0x271912, roughness: 0.65, metalness: 0.1 });
    const matMarble = new T.MeshStandardMaterial({ color: 0xe0d2be, roughness: 0.88 });
    const matBronze = new T.MeshStandardMaterial({ color: 0x8a623a, roughness: 0.42, metalness: 0.65 });
    const matGold = new T.MeshStandardMaterial({ color: 0xd9a84e, roughness: 0.32, metalness: 0.75 });

    // Tabletop Slab (2.2m wide, 1.55m deep, 0.08m thick at y = 0.78)
    const slab = new T.Mesh(new T.BoxGeometry(2.2, 0.08, 1.55), matWood);
    slab.position.set(0, 0.78, 0);
    group.add(slab);

    // Marble Inlay for the diorama area
    const inlay = new T.Mesh(new T.BoxGeometry(1.48, 0.015, 1.08), matMarble);
    inlay.position.set(0, 0.825, -0.16);
    group.add(inlay);

    // Bronze Rim Borders
    const rimFront = new T.Mesh(new T.BoxGeometry(2.24, 0.09, 0.05), matBronze);
    rimFront.position.set(0, 0.785, 0.78);
    const rimBack = new T.Mesh(new T.BoxGeometry(2.24, 0.09, 0.05), matBronze);
    rimBack.position.set(0, 0.785, -0.78);
    const rimLeft = new T.Mesh(new T.BoxGeometry(0.05, 0.09, 1.55), matBronze);
    rimLeft.position.set(-1.11, 0.785, 0);
    const rimRight = new T.Mesh(new T.BoxGeometry(0.05, 0.09, 1.55), matBronze);
    rimRight.position.set(1.11, 0.785, 0);
    group.add(rimFront, rimBack, rimLeft, rimRight);

    // 4 Ornate Carved Classical Legs
    const legGeom = new T.CylinderGeometry(0.075, 0.055, 0.74, 16);
    const legCapGeom = new T.BoxGeometry(0.18, 0.06, 0.18);
    for (const [lx, lz] of [[-0.98, -0.66], [0.98, -0.66], [-0.98, 0.66], [0.98, 0.66]]) {
        const leg = new T.Mesh(legGeom, matWood);
        leg.position.set(lx, 0.37, lz);
        const capTop = new T.Mesh(legCapGeom, matBronze);
        capTop.position.set(lx, 0.73, lz);
        const capBot = new T.Mesh(legCapGeom, matBronze);
        capBot.position.set(lx, 0.03, lz);
        group.add(leg, capTop, capBot);
    }

    // Lower Stretcher Shelf
    const shelf = new T.Mesh(new T.BoxGeometry(1.85, 0.03, 1.2), matWood);
    shelf.position.set(0, 0.22, 0);
    group.add(shelf);

    // Bronze Front Nameplate
    const nameplateCanvas = document.createElement("canvas");
    nameplateCanvas.width = 1024;
    nameplateCanvas.height = 160;
    const npCtx = nameplateCanvas.getContext("2d");
    npCtx.fillStyle = "#1e140d";
    npCtx.fillRect(0, 0, 1024, 160);
    npCtx.strokeStyle = "#c8963e";
    npCtx.lineWidth = 8;
    npCtx.strokeRect(10, 10, 1004, 140);
    npCtx.fillStyle = "#ffdf96";
    npCtx.font = "bold 52px Georgia, serif";
    npCtx.textAlign = "center";
    npCtx.fillText("⚔ CRAWL OF THE BEHOLDER ⚔", 512, 68);
    npCtx.font = "italic 32px Georgia, serif";
    npCtx.fillStyle = "#d4b578";
    npCtx.fillText("Tabletop VR Dungeon Crawl · Point & Click to Play", 512, 118);
    const npTex = new T.CanvasTexture(nameplateCanvas);
    const npMat = new T.MeshBasicMaterial({ map: npTex });
    const nameplate = new T.Mesh(new T.PlaneGeometry(1.4, 0.22), npMat);
    nameplate.position.set(0, 0.74, 0.81);
    group.add(nameplate);

    // 3. 3D Dungeon Diorama Meshes
    const dioramaGroup = new T.Group();
    dioramaGroup.position.set(0, 0.835, -0.16);
    group.add(dioramaGroup);

    const atlasCanvas = ctx.vrAtlasCanvas();
    const atlasTex = new T.CanvasTexture(atlasCanvas);
    atlasTex.magFilter = T.NearestFilter;
    atlasTex.minFilter = T.NearestFilter;
    atlasTex.generateMipmaps = false;
    atlasTex.colorSpace = T.SRGBColorSpace;

    const solidMat = new T.MeshStandardMaterial({
        map: atlasTex,
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.05
    });
    const transMat = new T.MeshStandardMaterial({
        map: atlasTex,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.04,
        roughness: 0.85,
        depthWrite: false
    });
    const dollMat = new T.MeshStandardMaterial({
        map: atlasTex,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.04,
        roughness: 0.85,
        depthWrite: false,
        side: T.DoubleSide
    });

    const solidGeom = new T.BufferGeometry();
    const transGeom = new T.BufferGeometry();
    const dollsGeom = new T.BufferGeometry();

    const solidMesh = new T.Mesh(solidGeom, solidMat);
    const transMesh = new T.Mesh(transGeom, transMat);
    const dollsMesh = new T.Mesh(dollsGeom, dollMat);
    dioramaGroup.add(solidMesh, transMesh, dollsMesh);

    // Invisible board plane for raycasting dungeon clicks
    const boardMesh = new T.Mesh(
        new T.PlaneGeometry(1.46, 1.06),
        new T.MeshBasicMaterial({ visible: false })
    );
    boardMesh.rotation.x = -Math.PI / 2;
    boardMesh.position.set(0, 0.836, -0.16);
    group.add(boardMesh);

    let dioramaScale = 0.05;
    let dirtyDiorama = true;

    function rebuildDiorama() {
        const archModel = ctx.vrStructureModel();
        const maxDim = Math.max(archModel.width || 24, archModel.height || 24);
        dioramaScale = Math.min(0.065, 1.35 / maxDim);
        dioramaGroup.scale.set(dioramaScale, dioramaScale, dioramaScale);

        const arch = ctx.vrEmitArchitecture(archModel);
        updateGeometryFromVerts(solidGeom, arch.solid);
        updateGeometryFromVerts(transGeom, arch.translucent);

        rebuildDolls();
        atlasTex.needsUpdate = true;
        dirtyDiorama = false;
    }

    function rebuildDolls(nowMs = performance.now()) {
        const dollModel = ctx.vrDollModel();
        const headRel = [0, 1.4, 1.8];
        const dolls = ctx.vrEmitDolls(dollModel, headRel, "billboard", nowMs);
        const combined = [...(dolls.solid || []), ...(dolls.translucent || [])];
        updateGeometryFromVerts(dollsGeom, combined);
    }

    // 4. Tactile 3D Buttons & Controls Apron
    const interactiveButtons = [];
    const bolster = new T.Group();
    bolster.position.set(-0.25, 0.83, 0.46);
    bolster.rotation.x = -0.28; // Tilted toward player
    group.add(bolster);

    const buttonBevelGeom = (w, h, d) => new T.BoxGeometry(w, h, d);

    function createTactileButton({ label, sublabel, color, textColor, w = 0.12, h = 0.035, d = 0.11, x = 0, z = 0, onTrigger }) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const bCtx = canvas.getContext("2d");
        bCtx.fillStyle = color;
        bCtx.fillRect(0, 0, 256, 256);
        bCtx.strokeStyle = "#f3d59b";
        bCtx.lineWidth = 10;
        bCtx.strokeRect(8, 8, 240, 240);
        bCtx.textAlign = "center";
        bCtx.fillStyle = textColor || "#ffffff";
        bCtx.font = "bold 72px sans-serif";
        bCtx.fillText(label, 128, sublabel ? 115 : 150);
        if (sublabel) {
            bCtx.font = "bold 34px sans-serif";
            bCtx.fillStyle = "#ffedcb";
            bCtx.fillText(sublabel, 128, 190);
        }
        const tex = new T.CanvasTexture(canvas);
        const mat = new T.MeshStandardMaterial({
            map: tex,
            roughness: 0.45,
            metalness: 0.2
        });
        const btn = new T.Mesh(buttonBevelGeom(w, h, d), mat);
        btn.position.set(x, h / 2, z);

        const basePlate = new T.Mesh(
            buttonBevelGeom(w + 0.015, 0.012, d + 0.015),
            matBronze
        );
        basePlate.position.set(x, 0.006, z);
        bolster.add(basePlate, btn);

        const baseY = btn.position.y;
        let depressing = false;

        btn.userData = {
            onTrigger: () => {
                if (depressing) return;
                depressing = true;
                btn.position.y = baseY - 0.012;
                setTimeout(() => {
                    btn.position.y = baseY;
                    depressing = false;
                }, 130);
                onTrigger();
            }
        };

        interactiveButtons.push(btn);
        return btn;
    }

    // D-Pad Movement Cluster
    // Top row: Turn Left, Forward, Turn Right
    createTactileButton({
        label: "↰",
        sublabel: "Turn L",
        color: "#28343f",
        x: -0.13,
        z: -0.065,
        onTrigger: () => {
            ctx.handleAction("turnLeft");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "↑",
        sublabel: "Step",
        color: "#1d4734",
        textColor: "#6effb4",
        x: 0,
        z: -0.065,
        onTrigger: () => {
            ctx.handleAction("moveForward");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "↱",
        sublabel: "Turn R",
        color: "#28343f",
        x: 0.13,
        z: -0.065,
        onTrigger: () => {
            ctx.handleAction("turnRight");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });

    // Bottom row: Strafe Left, Back, Strafe Right
    createTactileButton({
        label: "←",
        sublabel: "Left",
        color: "#2a282f",
        x: -0.13,
        z: 0.065,
        onTrigger: () => {
            ctx.handleAction("moveLeft");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "↓",
        sublabel: "Back",
        color: "#3d2b28",
        x: 0,
        z: 0.065,
        onTrigger: () => {
            ctx.handleAction("moveBack");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "→",
        sublabel: "Right",
        color: "#2a282f",
        x: 0.13,
        z: 0.065,
        onTrigger: () => {
            ctx.handleAction("moveRight");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });

    // Action Buttons Cluster (Attack, Door/Stairs, Wait, Ability, Auto-explore)
    createTactileButton({
        label: "⚔",
        sublabel: "Attack",
        color: "#6e1c18",
        textColor: "#ffdb66",
        w: 0.18,
        x: 0.32,
        z: -0.065,
        onTrigger: () => {
            ctx.handleAction("attack");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "🚪",
        sublabel: "Interact",
        color: "#54391e",
        w: 0.18,
        x: 0.32,
        z: 0.065,
        onTrigger: () => {
            ctx.handleAction("interact");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "💤",
        sublabel: "Wait",
        color: "#26354a",
        w: 0.16,
        x: 0.51,
        z: -0.065,
        onTrigger: () => {
            ctx.handleAction("wait");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "★",
        sublabel: "Skill",
        color: "#6b4716",
        textColor: "#ffe17d",
        w: 0.16,
        x: 0.51,
        z: 0.065,
        onTrigger: () => {
            ctx.handleAction("signature");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });
    createTactileButton({
        label: "🧭",
        sublabel: "Explore",
        color: "#184238",
        w: 0.16,
        x: 0.69,
        z: 0.0,
        onTrigger: () => {
            ctx.handleAction("autoExplore");
            dirtyDiorama = true;
            scheduleScreenRender();
        }
    });

    // Game Mode Totems along the left flank of the table
    const totemsGroup = new T.Group();
    totemsGroup.position.set(-0.95, 0.83, 0);
    group.add(totemsGroup);

    const totemModes = [
        { key: "standard", label: "Standard", color: 0xffffff, gem: 0xe6e6fa },
        { key: "sprint", label: "Sprint", color: 0xcc2222, gem: 0xff3b30 },
        { key: "foresight", label: "Tactics", color: 0x8e44ad, gem: 0xaf52de },
        { key: "oldschool", label: "Wireframe", color: 0x00bc8c, gem: 0x30d158 },
        { key: "tempo", label: "Tempo", color: 0xf39c12, gem: 0xff9f0a },
        { key: "cardcrawl", label: "Cards", color: 0x2980b9, gem: 0x0a84ff }
    ];

    const totemGeom = new T.CylinderGeometry(0.035, 0.045, 0.07, 12);
    const gemGeom = new T.OctahedronGeometry(0.024, 0);

    totemModes.forEach((tm, i) => {
        const tz = (i - 2.5) * 0.16;
        const base = new T.Mesh(totemGeom, matBronze);
        base.position.set(0, 0.035, tz);

        const gemMat = new T.MeshStandardMaterial({
            color: tm.gem,
            emissive: tm.gem,
            emissiveIntensity: 0.45,
            roughness: 0.2,
            metalness: 0.8
        });
        const gem = new T.Mesh(gemGeom, gemMat);
        gem.position.set(0, 0.085, tz);

        // Plaque
        const pCanvas = document.createElement("canvas");
        pCanvas.width = 128;
        pCanvas.height = 48;
        const pCtx = pCanvas.getContext("2d");
        pCtx.fillStyle = "#1e130c";
        pCtx.fillRect(0, 0, 128, 48);
        pCtx.fillStyle = "#ffde9e";
        pCtx.font = "bold 20px sans-serif";
        pCtx.textAlign = "center";
        pCtx.fillText(tm.label, 64, 32);
        const pTex = new T.CanvasTexture(pCanvas);
        const pMesh = new T.Mesh(new T.PlaneGeometry(0.09, 0.034), new T.MeshBasicMaterial({ map: pTex }));
        pMesh.rotation.x = -Math.PI / 4;
        pMesh.position.set(0.045, 0.03, tz);

        const totemHolder = new T.Group();
        totemHolder.add(base, gem, pMesh);
        totemsGroup.add(totemHolder);

        base.userData = {
            onTrigger: () => {
                gem.scale.set(1.4, 1.4, 1.4);
                setTimeout(() => gem.scale.set(1, 1, 1), 200);
                if (typeof ctx.restartInGameMode === "function") {
                    ctx.restartInGameMode(tm.key);
                }
                dirtyDiorama = true;
                scheduleScreenRender();
            }
        };
        gem.userData = base.userData;
        interactiveButtons.push(base, gem);
    });

    // 5. Retro Screen / Scrying Console
    const screenGroup = new T.Group();
    // Mounted on right flank of table angled toward the player
    screenGroup.position.set(0.72, 0.98, 0.32);
    screenGroup.rotation.y = -0.38;
    screenGroup.rotation.x = -0.25;
    group.add(screenGroup);

    // Screen wooden / bronze frame
    const frameMesh = new T.Mesh(new T.BoxGeometry(0.48, 0.36, 0.03), matWood);
    const screenBevel = new T.Mesh(new T.BoxGeometry(0.44, 0.32, 0.035), matBronze);
    screenGroup.add(frameMesh, screenBevel);

    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 512;
    screenCanvas.height = 384;
    const sCtx = screenCanvas.getContext("2d");
    const screenTex = new T.CanvasTexture(screenCanvas);
    screenTex.magFilter = T.LinearFilter;
    screenTex.minFilter = T.LinearFilter;

    const screenMesh = new T.Mesh(
        new T.PlaneGeometry(0.42, 0.30),
        new T.MeshBasicMaterial({ map: screenTex })
    );
    screenMesh.position.z = 0.02;
    screenGroup.add(screenMesh);

    let screenRenderTimer = null;
    function scheduleScreenRender() {
        if (screenRenderTimer) return;
        screenRenderTimer = setTimeout(() => {
            screenRenderTimer = null;
            renderScreen();
        }, 16);
    }

    function renderScreen() {
        if (!sCtx) return;
        // Background
        sCtx.fillStyle = "#0c0e12";
        sCtx.fillRect(0, 0, 512, 384);

        // Header
        sCtx.fillStyle = "#161b24";
        sCtx.fillRect(0, 0, 512, 44);
        sCtx.fillStyle = "#ffdd80";
        sCtx.font = "bold 20px Georgia, serif";
        sCtx.textAlign = "left";
        const floorObj = ctx.currentFloor ? ctx.currentFloor() : null;
        const floorName = floorObj?.name || "Spiral Entry";
        const floorIdx = (ctx.state?.floorIndex || 0) + 1;
        sCtx.fillText(`⚔ Floor ${floorIdx}: ${floorName}`, 12, 28);

        const dirNames = ["North ↑", "East →", "South ↓", "West ←"];
        const curDir = dirNames[ctx.state?.dir || 0] || "North";
        sCtx.fillStyle = "#9ad2ff";
        sCtx.font = "bold 16px monospace";
        sCtx.textAlign = "right";
        sCtx.fillText(curDir, 500, 28);

        // Party Health Bars (Left column)
        const party = ctx.state?.party || [];
        const partyY = 56;
        sCtx.textAlign = "left";
        party.forEach((member, idx) => {
            const my = partyY + idx * 46;
            sCtx.fillStyle = "#1e2430";
            sCtx.fillRect(12, my, 220, 40);
            sCtx.strokeStyle = "#384357";
            sCtx.lineWidth = 2;
            sCtx.strokeRect(12, my, 220, 40);

            // Name & Class
            sCtx.fillStyle = "#ffffff";
            sCtx.font = "bold 15px sans-serif";
            sCtx.fillText(member.name || `Hero ${idx + 1}`, 20, my + 18);
            sCtx.fillStyle = "#b5c4db";
            sCtx.font = "12px sans-serif";
            sCtx.fillText(member.class || "Adventurer", 150, my + 18);

            // Health bar
            const hp = Math.max(0, member.hp ?? 20);
            const maxHp = Math.max(1, member.maxHp ?? 20);
            const ratio = Math.min(1, hp / maxHp);
            sCtx.fillStyle = "#331515";
            sCtx.fillRect(20, my + 24, 150, 10);
            sCtx.fillStyle = ratio > 0.5 ? "#2ecc71" : ratio > 0.25 ? "#f39c12" : "#e74c3c";
            sCtx.fillRect(20, my + 24, Math.floor(150 * ratio), 10);

            sCtx.fillStyle = "#ffffff";
            sCtx.font = "bold 11px monospace";
            sCtx.fillText(`${hp}/${maxHp}`, 178, my + 33);
        });

        // Retro Viewport / First Person Render (Right column)
        sCtx.fillStyle = "#12141a";
        sCtx.fillRect(244, 56, 256, 180);
        sCtx.strokeStyle = "#c8963e";
        sCtx.lineWidth = 3;
        sCtx.strokeRect(244, 56, 256, 180);

        try {
            if (typeof ctx.renderViewport === "function") {
                ctx.renderViewport();
            }
        } catch (_) {}

        const vpCanvas = viewportDiv.querySelector("canvas");
        if (vpCanvas && vpCanvas.width > 0 && vpCanvas.height > 0) {
            sCtx.drawImage(vpCanvas, 246, 58, 252, 176);
        } else {
            // Retro wireframe placeholder if first-person canvas is waiting
            sCtx.fillStyle = "#1e2a38";
            sCtx.fillRect(246, 58, 252, 176);
            sCtx.fillStyle = "#6be0a4";
            sCtx.font = "16px monospace";
            sCtx.textAlign = "center";
            sCtx.fillText("FIRST-PERSON EYE", 372, 140);
            sCtx.font = "12px sans-serif";
            sCtx.fillStyle = "#8eaec9";
            sCtx.fillText("Step or tap to look through", 372, 165);
        }

        // Bottom Message Log Box
        sCtx.fillStyle = "#13161c";
        sCtx.fillRect(12, 248, 488, 124);
        sCtx.strokeStyle = "#433527";
        sCtx.lineWidth = 2;
        sCtx.strokeRect(12, 248, 488, 124);

        sCtx.fillStyle = "#ffdf96";
        sCtx.font = "italic 15px Georgia, serif";
        sCtx.textAlign = "left";
        const rawMsg = ctx.state?.message || "You stand at the dungeon threshold. Beware the shadows.";
        // Word wrap message
        const words = rawMsg.split(" ");
        let line = "";
        let lineY = 276;
        for (const w of words) {
            const test = line + w + " ";
            if (sCtx.measureText(test).width > 460) {
                sCtx.fillText(line, 24, lineY);
                line = w + " ";
                lineY += 22;
                if (lineY > 350) break;
            } else {
                line = test;
            }
        }
        if (line && lineY <= 350) sCtx.fillText(line, 24, lineY);

        // Turn & Stats line at bottom
        sCtx.fillStyle = "#8ea3bf";
        sCtx.font = "12px monospace";
        const turn = ctx.state?.turnCount || 0;
        const gold = ctx.state?.gold || 0;
        sCtx.fillText(`Turn: ${turn}   Gold: ${gold}   Level: ${ctx.state?.level || 1}`, 24, 360);

        screenTex.needsUpdate = true;
    }

    // Initial render
    rebuildDiorama();
    renderScreen();

    // 6. Direct Diorama Board Raycast Interaction
    const scratchVec = new T.Vector3();

    function handleBoardClick(point) {
        dioramaGroup.worldToLocal(scratchVec.copy(point));
        const archModel = ctx.vrStructureModel();
        const halfW = (archModel.width || 24) / 2;
        const halfH = (archModel.height || 24) / 2;
        const tx = Math.floor(scratchVec.x + halfW);
        const ty = Math.floor(scratchVec.z + halfH);

        if (typeof ctx.mapContains === "function" && ctx.mapContains(tx, ty)) {
            const isSolid = typeof ctx.solidAt === "function" ? ctx.solidAt(tx, ty) : false;
            const dx = tx - ctx.state.x;
            const dy = ty - ctx.state.y;

            if (isSolid) {
                if (Math.abs(dx) + Math.abs(dy) === 1 && typeof ctx.closedDoorAt === "function" && ctx.closedDoorAt(tx, ty)) {
                    ctx.handleAction("interact");
                    dirtyDiorama = true;
                    scheduleScreenRender();
                    return true;
                }
                return false;
            }

            const monster = typeof ctx.monsterAt === "function" ? ctx.monsterAt(tx, ty) : null;
            if (monster && Math.abs(dx) + Math.abs(dy) === 1) {
                ctx.handleAction("attack");
                dirtyDiorama = true;
                scheduleScreenRender();
                return true;
            }

            if (dx === 0 && dy === 0) {
                ctx.handleAction("wait");
                dirtyDiorama = true;
                scheduleScreenRender();
                return true;
            }

            if (Math.abs(dx) + Math.abs(dy) === 1) {
                if (typeof ctx.moveBy === "function") {
                    ctx.moveBy(dx, dy);
                } else {
                    ctx.handleAction("moveForward");
                }
            } else if (typeof ctx.travelTo === "function") {
                ctx.travelTo(tx, ty);
            }
            dirtyDiorama = true;
            scheduleScreenRender();
            return true;
        }
        return false;
    }

    let lastDollUpdate = 0;

    return {
        group,
        targets: [...interactiveButtons, boardMesh],
        boardMesh,
        select(ray) {
            // Check tactile buttons first
            const buttonHits = ray.intersectObjects(interactiveButtons, false);
            if (buttonHits.length > 0) {
                const btn = buttonHits[0].object;
                if (btn.userData?.onTrigger) {
                    btn.userData.onTrigger();
                    return true;
                }
            }
            // Check direct diorama click
            const boardHits = ray.intersectObject(boardMesh, false);
            if (boardHits.length > 0) {
                return handleBoardClick(boardHits[0].point);
            }
            return false;
        },
        update(dt, xr, renderer) {
            const now = performance.now();
            if (dirtyDiorama) {
                rebuildDiorama();
            } else if (now - lastDollUpdate > 150) {
                rebuildDolls(now);
                lastDollUpdate = now;
            }
            if (ctx.vrAtlasNeedsUpdate && ctx.vrAtlasNeedsUpdate()) {
                atlasTex.needsUpdate = true;
            }
        },
        canStand(x, z) {
            // Player cannot walk through the physical table
            return Math.hypot(x - posX, z - posZ) >= 1.25;
        },
        context: ctx,
        api: {
            stepForward: () => { ctx.handleAction("moveForward"); dirtyDiorama = true; scheduleScreenRender(); },
            attack: () => { ctx.handleAction("attack"); dirtyDiorama = true; scheduleScreenRender(); }
        }
    };
}
