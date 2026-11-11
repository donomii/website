import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const cells = 10;
const side = 1.4;
const size = side / cells;
const half = side / 2;
const radius = 0.42;
const tube = 0.19;
const UFO_URL = new URL("./assets/ufo.glb", import.meta.url).href;

function torusDistance(x, y, z) {
    return Math.hypot(Math.hypot(x, y) - radius, z) - tube;
}

function actionPlaque(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#392922";
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = "#dbba85";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 96);
    ctx.fillStyle = "#ffedcb";
    ctx.font = "38px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 70, 460);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.Mesh(new T.PlaneGeometry(1.15, 0.25), new T.MeshBasicMaterial({ map: texture }));
}

function createProceduralUfo(accentHex) {
    const group = new T.Group();
    const hull = new T.Mesh(
        new T.CylinderGeometry(0.18, 0.28, 0.08, 20),
        new T.MeshStandardMaterial({ color: 0x6b7c90, metalness: 0.55, roughness: 0.35 }),
    );
    const dome = new T.Mesh(
        new T.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new T.MeshStandardMaterial({ color: 0x2a6a8c, emissive: accentHex, emissiveIntensity: 0.85, roughness: 0.25 }),
    );
    dome.position.y = 0.04;
    const emitter = new T.Mesh(
        new T.CylinderGeometry(0.06, 0.04, 0.03, 12),
        new T.MeshBasicMaterial({ color: accentHex }),
    );
    emitter.position.y = -0.05;
    group.add(hull, dome, emitter);
    return group;
}

async function loadUfoPrototype() {
    try {
        const gltf = await new GLTFLoader().loadAsync(UFO_URL);
        const wrapper = new T.Group();
        const model = gltf.scene;
        wrapper.add(model);
        wrapper.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(model);
        const dim = box.getSize(new T.Vector3());
        const ctr = box.getCenter(new T.Vector3());
        const scale = 0.56 / Math.max(dim.x, dim.z, 0.001);
        model.scale.multiplyScalar(scale);
        model.position.set(-ctr.x * scale, -ctr.y * scale, -ctr.z * scale);
        model.traverse(obj => {
            if (!obj.isMesh || !obj.material) return;
            const mat = obj.material.clone();
            const isLight = /light/i.test(mat.name || "");
            if (isLight) {
                mat.color.setHex(0x52e0ff);
                mat.emissive = new T.Color(0x28b8ff);
                mat.emissiveIntensity = 1.4;
                mat.roughness = 0.25;
            } else {
                mat.color.setHex(0x6b7c90);
                mat.metalness = 0.55;
                mat.roughness = 0.36;
            }
            obj.material = mat;
        });
        return wrapper;
    } catch {
        return createProceduralUfo(0x4ce4ff);
    }
}

export async function createCarving(scene, x, z) {
    const exhibit = new T.Group();
    exhibit.position.set(x, 1.52, z);
    scene.add(exhibit);

    const block = new T.InstancedMesh(new T.BoxGeometry(size * 0.99, size * 0.99, size * 0.99),
        new T.MeshStandardMaterial({ roughness: 0.93 }), cells ** 3);
    block.instanceMatrix.setUsage(T.DynamicDrawUsage);
    block.frustumCulled = false;
    exhibit.add(block);
    const base = new T.Mesh(new T.BoxGeometry(1.8, 0.8, 1.8),
        new T.MeshStandardMaterial({ color: 0x967053, roughness: 0.95 }));
    base.position.y = -1.1;
    exhibit.add(base);

    const trigger = actionPlaque("Carve stone");
    trigger.position.set(0, -1.1, 0.91);
    exhibit.add(trigger);

    const ufoPrototype = await loadUfoPrototype();
    const ufoConfigs = [
        { baseAngle: 0.52, orbitSpeed: 0.44, radius: 1.18, height: 0.98, interval: 0.50, startTimer: 0.44, beamHex: 0x6dff9c, sparkHex: 0xd6ffe3 },
        { baseAngle: 2.52, orbitSpeed: 0.38, radius: 1.22, height: 0.82, interval: 0.50, startTimer: 0.19, beamHex: 0x4ee6ff, sparkHex: 0xdcf9ff },
    ];
    const upAxis = new T.Vector3(0, 1, 0);
    const beamUnitGeom = new T.CylinderGeometry(0.022, 0.014, 1, 8);
    const sparkGeom = new T.SphereGeometry(0.1, 10, 8);
    const ufos = ufoConfigs.map((cfg, idx) => {
        const craft = ufoPrototype.clone(true);
        craft.traverse(obj => {
            if (obj.isMesh && obj.material) {
                obj.material = obj.material.clone();
                if (/light/i.test(obj.material.name || "")) {
                    obj.material.color.setHex(cfg.beamHex);
                    obj.material.emissive.setHex(cfg.beamHex);
                }
            }
        });
        craft.name = `Carving UFO ${idx + 1}`;
        const beam = new T.Mesh(beamUnitGeom, new T.MeshBasicMaterial({ color: cfg.beamHex }));
        beam.visible = false;
        const spark = new T.Mesh(sparkGeom, new T.MeshBasicMaterial({ color: cfg.sparkHex }));
        spark.visible = false;
        exhibit.add(craft, beam, spark);
        return { ...cfg, phaseOffset: idx * 2.1, craft, beam, spark, timer: cfg.startTimer, pulse: 0 };
    });

    const colors = new T.Color();
    const matrix = new T.Matrix4();
    const hidden = new T.Matrix4().makeScale(0, 0, 0);
    const indexOf = (vx, vy, vz) => vx + cells * (vy + cells * vz);
    const coord = i => (i + 0.5) * size - half;
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

    // Precompute hidden torus core and a tight enveloping boulder shell around it.
    const totalVoxels = cells ** 3;
    const coreMask = new Uint8Array(totalVoxels);
    const startMask = new Uint8Array(totalVoxels);
    const voxelPos = new Array(totalVoxels);
    for (let vz = 0; vz < cells; vz++) {
        for (let vy = 0; vy < cells; vy++) {
            for (let vx = 0; vx < cells; vx++) {
                const idx = indexOf(vx, vy, vz);
                const px = coord(vx);
                const py = coord(vy);
                const pz = coord(vz);
                voxelPos[idx] = new T.Vector3(px, py, pz);
                if (torusDistance(px, py, pz) <= 0) {
                    coreMask[idx] = 1;
                    startMask[idx] = 1;
                }
            }
        }
    }
    for (let vz = 0; vz < cells; vz++) {
        for (let vy = 0; vy < cells; vy++) {
            for (let vx = 0; vx < cells; vx++) {
                const idx = indexOf(vx, vy, vz);
                if (!coreMask[idx]) continue;
                for (const [dx, dy, dz] of dirs) {
                    const nx = vx + dx;
                    const ny = vy + dy;
                    const nz = vz + dz;
                    if (nx >= 0 && nx < cells && ny >= 0 && ny < cells && nz >= 0 && nz < cells) {
                        startMask[indexOf(nx, ny, nz)] = 1;
                    }
                }
            }
        }
    }
    // Plug the center aperture across the stone slab thickness so the hole starts hidden too.
    for (let vz = 3; vz <= 6; vz++) {
        for (let vy = 4; vy <= 5; vy++) {
            for (let vx = 4; vx <= 5; vx++) {
                startMask[indexOf(vx, vy, vz)] = 1;
            }
        }
    }

    const carveTargets = [];
    for (let vz = 0; vz < cells; vz++) {
        for (let vy = 0; vy < cells; vy++) {
            for (let vx = 0; vx < cells; vx++) {
                const idx = indexOf(vx, vy, vz);
                if (startMask[idx] && !coreMask[idx]) {
                    carveTargets.push({ idx, vx, vy, vz, pos: voxelPos[idx] });
                }
            }
        }
    }
    const rayCount = carveTargets.length;

    const present = new Uint8Array(totalVoxels);
    let remaining = [];
    let removed = 0;
    let active = false;
    let started = false;
    let elapsed = 0;
    const beamDelta = new T.Vector3();
    const emitterPos = new T.Vector3();
    const beamQuat = new T.Quaternion();
    const PULSE_DUR = 0.26;

    function positionUfos(t) {
        for (const u of ufos) {
            const angle = u.baseAngle + t * u.orbitSpeed;
            const bob = Math.sin(t * 2.4 + u.phaseOffset) * 0.08;
            const ux = Math.cos(angle) * u.radius;
            const uz = Math.sin(angle) * u.radius;
            u.craft.position.set(ux, u.height + bob, uz);
            u.craft.lookAt(0, u.height * 0.45, 0);
            u.craft.rotateZ(Math.sin(t * 1.9 + u.phaseOffset) * 0.1);
            u.craft.rotateX(0.14);
        }
    }

    function reset() {
        present.set(startMask);
        for (let idx = 0; idx < totalVoxels; idx++) {
            if (startMask[idx]) {
                const p = voxelPos[idx];
                block.setMatrixAt(idx, matrix.makeTranslation(p.x, p.y, p.z));
            } else {
                block.setMatrixAt(idx, hidden);
            }
            block.setColorAt(idx, colors.setHex(0xd2a276).multiplyScalar(0.83 + (idx % 11) * 0.025));
        }
        block.instanceMatrix.needsUpdate = true;
        block.instanceColor.needsUpdate = true;
        remaining = carveTargets.slice();
        removed = 0;
        for (const u of ufos) {
            u.timer = u.startTimer;
            u.pulse = 0;
            u.beam.visible = false;
            u.spark.visible = false;
        }
    }

    function isExposed(entry) {
        for (const [dx, dy, dz] of dirs) {
            const nx = entry.vx + dx;
            const ny = entry.vy + dy;
            const nz = entry.vz + dz;
            if (nx < 0 || nx >= cells || ny < 0 || ny >= cells || nz < 0 || nz >= cells) return true;
            if (!present[indexOf(nx, ny, nz)]) return true;
        }
        return false;
    }

    function pickTargetIndex(ufoPos) {
        let bestPos = -1;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const entry = remaining[i];
            if (!isExposed(entry)) continue;
            const d2 = entry.pos.distanceToSquared(ufoPos);
            if (d2 < bestDist) {
                bestDist = d2;
                bestPos = i;
            }
        }
        if (bestPos >= 0) return bestPos;
        for (let i = 0; i < remaining.length; i++) {
            const d2 = remaining[i].pos.distanceToSquared(ufoPos);
            if (d2 < bestDist) {
                bestDist = d2;
                bestPos = i;
            }
        }
        return Math.max(0, bestPos);
    }

    function fireUfoZap(ufo) {
        if (!remaining.length) return;
        const pos = pickTargetIndex(ufo.craft.position);
        const [target] = remaining.splice(pos, 1);
        present[target.idx] = 0;
        block.setMatrixAt(target.idx, hidden);
        block.instanceMatrix.needsUpdate = true;
        removed++;

        emitterPos.copy(ufo.craft.position);
        emitterPos.y -= 0.07;
        beamDelta.subVectors(target.pos, emitterPos);
        const len = Math.max(beamDelta.length(), 0.05);
        ufo.beam.position.copy(emitterPos).addScaledVector(beamDelta, 0.5);
        ufo.beam.quaternion.copy(beamQuat.setFromUnitVectors(upAxis, beamDelta.normalize()));
        ufo.beam.scale.set(1, len, 1);
        ufo.beam.visible = true;
        ufo.spark.position.copy(target.pos);
        ufo.spark.scale.setScalar(1);
        ufo.spark.visible = true;
        ufo.pulse = PULSE_DUR;
    }

    reset();
    positionUfos(0);
    return {
        group: exhibit,
        targets: [block, base, trigger],
        get started() { return started; },
        start() {
            reset();
            started = true;
            active = true;
        },
        update(dt = 1 / 60) {
            const step = Math.min(Math.max(dt, 0), 0.1);
            elapsed += step;
            positionUfos(elapsed);
            for (const u of ufos) {
                if (active && remaining.length > 0) {
                    u.timer += step;
                    while (u.timer >= u.interval && remaining.length > 0) {
                        u.timer -= u.interval;
                        fireUfoZap(u);
                    }
                }
                if (u.pulse > 0) {
                    u.pulse = Math.max(0, u.pulse - step);
                    const k = u.pulse / PULSE_DUR;
                    u.beam.scale.x = 0.6 + 0.8 * k;
                    u.beam.scale.z = 0.6 + 0.8 * k;
                    u.spark.scale.setScalar(0.35 + 0.9 * k);
                    if (u.pulse === 0) {
                        u.beam.visible = false;
                        u.spark.visible = false;
                    }
                }
            }
            active = remaining.length > 0;
            return { active, nextRay: removed, rayCount, removed };
        },
    };
}
