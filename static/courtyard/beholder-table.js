import * as T from "three";

// Crawl of the Beholder VR Tabletop Exhibit
// Embeds the actual Crawl of the Beholder VR tabletop diorama, shaders, normal-mapped
// tile atlas, 3D paper dolls, floating damage numbers, 3D mode totems/cards, and
// floating VR panes directly onto a table in the Roman Courtyard.

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
    "src/runtime/render/vr_feedback.js?v=3",
    "src/runtime/render/vr.js?v=0.5.54",
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

// Verbatim CotB VR shaders adapted to Three.js ShaderMaterial built-in matrices.
const COTB_THREE_VERT = `
attribute vec3 aPos;
attribute vec2 aUv;
attribute vec4 aColor;
attribute vec3 aTangent;
attribute vec3 aBitangent;
attribute float aHasNormal;
varying vec2 vUv;
varying vec4 vColor;
varying vec3 vTangent;
varying vec3 vBitangent;
varying float vHasNormal;
void main() {
    vUv = aUv;
    vColor = aColor;
    mat3 modelBasis = mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz);
    vTangent = normalize(modelBasis * aTangent);
    vBitangent = normalize(modelBasis * aBitangent);
    vHasNormal = aHasNormal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(aPos, 1.0);
}
`;

const COTB_THREE_FRAG = `
uniform sampler2D uTex;
uniform sampler2D uNormalTex;
uniform vec3 uLightDir;
uniform float uCutoff;
varying vec2 vUv;
varying vec4 vColor;
varying vec3 vTangent;
varying vec3 vBitangent;
varying float vHasNormal;
void main() {
    vec4 color = texture2D(uTex, vUv) * vColor;
    if (color.a < uCutoff) discard;
    if (vHasNormal > 0.5) {
        vec3 mapped = texture2D(uNormalTex, vUv).rgb * 2.0 - 1.0;
        vec3 tileUp = normalize(-vBitangent);
        vec3 surfaceNormal = normalize(cross(vTangent, tileUp));
        vec3 worldNormal = normalize(vTangent * mapped.x + tileUp * mapped.y + surfaceNormal * mapped.z);
        float diffuse = max(dot(worldNormal, normalize(uLightDir)), 0.0);
        color.rgb *= 0.55 + diffuse * 0.45;
    }
    gl_FragColor = color;
}
`;

function setInterleavedVerts(geom, verts) {
    if (!verts || verts.length === 0) {
        geom.setDrawRange(0, 0);
        return;
    }
    const arr = new Float32Array(verts);
    const count = Math.floor(arr.length / 16);
    const ib = new T.InterleavedBuffer(arr, 16);
    geom.setAttribute("position", new T.InterleavedBufferAttribute(ib, 3, 0));
    geom.setAttribute("aPos", new T.InterleavedBufferAttribute(ib, 3, 0));
    geom.setAttribute("aUv", new T.InterleavedBufferAttribute(ib, 2, 3));
    geom.setAttribute("aColor", new T.InterleavedBufferAttribute(ib, 4, 5));
    geom.setAttribute("aTangent", new T.InterleavedBufferAttribute(ib, 3, 9));
    geom.setAttribute("aBitangent", new T.InterleavedBufferAttribute(ib, 3, 12));
    geom.setAttribute("aHasNormal", new T.InterleavedBufferAttribute(ib, 1, 15));
    geom.setDrawRange(0, count);
}

export async function createBeholderExhibit(scene, posX = -5.8, posZ = -3.5) {
    await ensureCotBEngine();

    // 1. Headless CotB Game Engine Context (no 2D flat-screen DOM chrome)
    const dummyEls = new Map();
    const customDoc = {
        getElementById: (id) => {
            if (!dummyEls.has(id)) dummyEls.set(id, document.createElement("div"));
            return dummyEls.get(id);
        },
        createElement: (...args) => document.createElement(...args),
        head: document.head,
        body: document.body
    };

    const ctx = window.CotBRuntime.createCoreContext(window.CotBResources, customDoc);

    for (const [k, fn] of Object.entries(window.CotBRuntime)) {
        if (k.startsWith("install") && typeof fn === "function") {
            fn(ctx);
        }
    }

    // Wrap imageEntry AFTER installViewportRendering so dynamic paths (portals, linocut, normals) resolve from CotB root
    if (typeof ctx.imageEntry === "function") {
        const origImageEntry = ctx.imageEntry;
        ctx.imageEntry = function (src, allowClassicFallback = true) {
            if (typeof src === "string" && !src.startsWith("data:") && !src.startsWith("http") && !src.startsWith("/") && !src.startsWith("furniture://")) {
                src = COTB_BASE + src;
            }
            return origImageEntry(src, allowClassicFallback);
        };
    }

    if (typeof ctx.vrPark2dRendering === "function") {
        ctx.vrPark2dRendering();
    }
    ctx.beginRun({});

    // 2. Roman Courtyard Tabletop Pedestal
    const group = new T.Group();
    group.position.set(posX, 0, posZ);
    // Face East (+X toward the courtyard center; visitor stands at posX + 1.65 looking West)
    group.rotation.y = Math.PI / 2;
    scene.add(group);

    const matWood = new T.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.72, metalness: 0.08 });
    const matSlate = new T.MeshStandardMaterial({ color: 0x161310, roughness: 0.92, metalness: 0.05 });
    const matBronze = new T.MeshStandardMaterial({ color: 0x8a623a, roughness: 0.45, metalness: 0.62 });

    // Square tabletop (1.84m × 1.84m) at y = 0.82m so CotB's 1.6m diorama sits cleanly inside
    const slab = new T.Mesh(new T.BoxGeometry(1.86, 0.08, 1.86), matWood);
    slab.position.set(0, 0.78, 0);
    group.add(slab);

    // Dark slate tabletop bed so the lit 3D dungeon diorama pops off the table
    const bed = new T.Mesh(new T.BoxGeometry(1.72, 0.012, 1.72), matSlate);
    bed.position.set(0, 0.824, 0);
    group.add(bed);

    // Bronze edge trim
    const rimF = new T.Mesh(new T.BoxGeometry(1.90, 0.09, 0.04), matBronze);
    rimF.position.set(0, 0.785, 0.93);
    const rimB = new T.Mesh(new T.BoxGeometry(1.90, 0.09, 0.04), matBronze);
    rimB.position.set(0, 0.785, -0.93);
    const rimL = new T.Mesh(new T.BoxGeometry(0.04, 0.09, 1.86), matBronze);
    rimL.position.set(-0.93, 0.785, 0);
    const rimR = new T.Mesh(new T.BoxGeometry(0.04, 0.09, 1.86), matBronze);
    rimR.position.set(0.93, 0.785, 0);
    group.add(rimF, rimB, rimL, rimR);

    // Four carved Roman legs
    const legGeom = new T.CylinderGeometry(0.075, 0.055, 0.74, 16);
    const legCapGeom = new T.BoxGeometry(0.18, 0.06, 0.18);
    for (const [lx, lz] of [[-0.78, -0.78], [0.78, -0.78], [-0.78, 0.78], [0.78, 0.78]]) {
        const leg = new T.Mesh(legGeom, matWood);
        leg.position.set(lx, 0.37, lz);
        const capTop = new T.Mesh(legCapGeom, matBronze);
        capTop.position.set(lx, 0.73, lz);
        const capBot = new T.Mesh(legCapGeom, matBronze);
        capBot.position.set(lx, 0.03, lz);
        group.add(leg, capTop, capBot);
    }

    // 3. Real 3D CotB VR Diorama (using CotB's own shaders, atlas & normal atlas)
    const dioramaGroup = new T.Group();
    dioramaGroup.position.set(0, 0.836, 0);
    group.add(dioramaGroup);

    const atlasCanvas = ctx.vrAtlasCanvas();
    const normalCanvas = ctx.vrNormalAtlasCanvas();

    const atlasTex = new T.CanvasTexture(atlasCanvas);
    atlasTex.flipY = false;
    atlasTex.magFilter = T.LinearFilter;
    atlasTex.minFilter = T.LinearFilter;
    atlasTex.generateMipmaps = false;
    atlasTex.colorSpace = T.NoColorSpace;

    const normalTex = new T.CanvasTexture(normalCanvas);
    normalTex.flipY = false;
    normalTex.magFilter = T.LinearFilter;
    normalTex.minFilter = T.LinearFilter;
    normalTex.generateMipmaps = false;
    normalTex.colorSpace = T.NoColorSpace;

    const lightDir = new T.Vector3(0.35, 0.82, 0.45);

    function makeDioramaMat(cutoff, depthWrite, transparent) {
        const mat = new T.ShaderMaterial({
            vertexShader: COTB_THREE_VERT,
            fragmentShader: COTB_THREE_FRAG,
            uniforms: {
                uTex: { value: atlasTex },
                uNormalTex: { value: normalTex },
                uLightDir: { value: lightDir },
                uCutoff: { value: cutoff }
            },
            side: T.DoubleSide,
            depthWrite,
            transparent
        });
        mat.userData = { dynamicFade: true };
        return mat;
    }

    const solidMat = makeDioramaMat(0.45, true, false);
    const transMat = makeDioramaMat(0.02, false, true);

    const archSolidGeom = new T.BufferGeometry();
    const dollSolidGeom = new T.BufferGeometry();
    const archTransGeom = new T.BufferGeometry();
    const dollTransGeom = new T.BufferGeometry();

    const archSolidMesh = new T.Mesh(archSolidGeom, solidMat);
    const dollSolidMesh = new T.Mesh(dollSolidGeom, solidMat);
    const archTransMesh = new T.Mesh(archTransGeom, transMat);
    const dollTransMesh = new T.Mesh(dollTransGeom, transMat);
    archSolidMesh.frustumCulled = false;
    dollSolidMesh.frustumCulled = false;
    archTransMesh.frustumCulled = false;
    dollTransMesh.frustumCulled = false;
    archTransMesh.renderOrder = 2;
    dollTransMesh.renderOrder = 3;

    dioramaGroup.add(archSolidMesh, dollSolidMesh, archTransMesh, dollTransMesh);

    // Invisible raycast hit volume covering the tabletop diorama & rim props
    const boardHitMesh = new T.Mesh(
        new T.BoxGeometry(1.84, 0.45, 1.84),
        new T.MeshBasicMaterial({ visible: false })
    );
    boardHitMesh.position.set(0, 0.98, 0);
    group.add(boardHitMesh);

    // 4. Real CotB VR Floating Tabletop Panes (HUD, Control Palette, Party, Inventory)
    const paneTargets = [];
    const paneRefs = {};

    function makeFloatingPane(key, width, height, x, y, z, rotY, rotX = 0, clickable = true) {
        const mat = new T.MeshBasicMaterial({
            transparent: true,
            side: T.DoubleSide,
            depthWrite: true
        });
        const mesh = new T.Mesh(new T.PlaneGeometry(width, height), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rotX, rotY, 0, "YXZ");
        mesh.userData = { paneKey: key, clickable };
        group.add(mesh);
        paneRefs[key] = { mesh, mat, tex: null };
        if (clickable) paneTargets.push(mesh);
        return mesh;
    }

    // Floating VR HUD banner behind the diorama
    makeFloatingPane("hud", 0.96, 0.48, 0, 1.34, -1.04, 0, -0.14, false);
    // Floating VR Control Palette on the left
    makeFloatingPane("palette", 0.54, 0.54, -1.14, 1.12, 0.08, 0.46, -0.10, true);
    // Floating VR Party Pane on the right-rear
    makeFloatingPane("party", 0.50, 0.50, 1.06, 1.18, -0.58, -0.34, -0.10, true);
    // Floating VR Inventory Pane on the right-front
    makeFloatingPane("inventory", 0.48, 0.53, 1.22, 1.10, 0.26, -0.56, -0.10, true);

    function bindPaneTexture(key, paneObj, dirty) {
        const ref = paneRefs[key];
        if (!ref || !paneObj?.canvas) return;
        if (!ref.tex) {
            ref.tex = new T.CanvasTexture(paneObj.canvas);
            ref.tex.minFilter = T.LinearFilter;
            ref.tex.magFilter = T.LinearFilter;
            ref.tex.colorSpace = T.SRGBColorSpace;
            ref.mat.map = ref.tex;
            ref.mat.needsUpdate = true;
        } else if (dirty) {
            ref.tex.needsUpdate = true;
        }
    }

    // Sync CotB's internal vrTable transform to our Three.js dioramaGroup world transform
    const worldPos = new T.Vector3();
    const worldQuat = new T.Quaternion();
    const headPos = new T.Vector3(posX + 1.65, 1.65, posZ);

    function syncTableWorld() {
        group.updateMatrixWorld(true);
        dioramaGroup.getWorldPosition(worldPos);
        dioramaGroup.getWorldQuaternion(worldQuat);
        const vt = ctx.vrTableState();
        vt.x = worldPos.x;
        vt.y = worldPos.y;
        vt.z = worldPos.z;
        vt.q = [worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w];
        vt.scale = 1;
    }

    function stepFrame(nowMs, cameraObj) {
        syncTableWorld();
        if (cameraObj) {
            cameraObj.getWorldPosition(headPos);
        }
        const out = ctx.vrEmbeddedStep(nowMs, { x: headPos.x, y: headPos.y, z: headPos.z });
        const s = out.tileMetres;
        dioramaGroup.scale.set(s, s, s);

        if (out.archChanged && out.arch) {
            setInterleavedVerts(archSolidGeom, out.arch.solid);
            setInterleavedVerts(archTransGeom, out.arch.translucent);
        }
        setInterleavedVerts(dollSolidGeom, out.dolls.solid.concat(out.decals.solid));
        setInterleavedVerts(dollTransGeom, out.dolls.translucent.concat(out.decals.translucent));

        if (out.atlasDirty) atlasTex.needsUpdate = true;
        if (out.normalDirty) normalTex.needsUpdate = true;

        bindPaneTexture("hud", out.panes.hud, out.hudDirty);
        bindPaneTexture("palette", out.panes.panel, out.panelDirty);
        bindPaneTexture("party", out.panes.party, out.partyDirty);
        bindPaneTexture("inventory", out.panes.inv, out.invDirty);
    }

    // Initial frame emit
    stepFrame(performance.now(), null);

    return {
        group,
        targets: [...paneTargets, boardHitMesh],
        boardMesh: boardHitMesh,
        select(ray) {
            syncTableWorld();
            // 1. Check floating CotB VR panes (Control Palette, Party, Inventory)
            const paneHits = ray.intersectObjects(paneTargets, false);
            if (paneHits.length > 0) {
                const hit = paneHits[0];
                const key = hit.object.userData?.paneKey;
                if (key && hit.uv) {
                    const u = hit.uv.x;
                    const v = 1 - hit.uv.y;
                    if (ctx.vrEmbeddedPaneClickUv(key, u, v)) {
                        stepFrame(performance.now(), null);
                        return true;
                    }
                }
            }
            // 2. Check direct 3D dungeon board & tabletop mode totems/cards via CotB's native raycaster
            const origin = { x: ray.ray.origin.x, y: ray.ray.origin.y, z: ray.ray.origin.z };
            const dir = { x: ray.ray.direction.x, y: ray.ray.direction.y, z: ray.ray.direction.z };
            const head = { x: headPos.x, y: headPos.y, z: headPos.z };
            if (ctx.vrEmbeddedTapWorld(origin, dir, head)) {
                stepFrame(performance.now(), null);
                return true;
            }
            return false;
        },
        update(dt, xr, renderer, camera) {
            const activeCam = (renderer?.xr?.isPresenting && renderer.xr.getCamera) ? renderer.xr.getCamera() : camera;
            syncTableWorld();
            if (activeCam) activeCam.getWorldPosition(headPos);
            if (typeof ctx.vrEmbeddedHoverWorld === "function" && renderer?.xr?.isPresenting && typeof renderer.xr.getController === "function") {
                const ctrlOrigin = new T.Vector3();
                const ctrlQuat = new T.Quaternion();
                const ctrlDir = new T.Vector3();
                let hovered = false;
                for (let ci = 0; ci < 2; ci += 1) {
                    const ctrl = renderer.xr.getController(ci);
                    if (!ctrl || !ctrl.visible) continue;
                    ctrl.getWorldPosition(ctrlOrigin);
                    ctrl.getWorldQuaternion(ctrlQuat);
                    ctrlDir.set(0, 0, -1).applyQuaternion(ctrlQuat).normalize();
                    const hit = ctx.vrEmbeddedHoverWorld(
                        { x: ctrlOrigin.x, y: ctrlOrigin.y, z: ctrlOrigin.z },
                        { x: ctrlDir.x, y: ctrlDir.y, z: ctrlDir.z },
                        { x: headPos.x, y: headPos.y, z: headPos.z }
                    );
                    if (hit) { hovered = true; break; }
                }
                if (!hovered) ctx.vrEmbeddedHoverWorld(null, null, null);
            }
            stepFrame(performance.now(), activeCam);
        },
        canStand() {
            return true;
        },
        context: ctx,
        api: {
            stepForward: () => { ctx.handleAction("moveForward"); stepFrame(performance.now(), null); },
            attack: () => { ctx.handleAction("attack"); stepFrame(performance.now(), null); }
        }
    };
}
