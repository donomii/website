import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { galleryRoom } from "./gallery-room.js?v=20261111";

const POOL_X = 0;
const POOL_Z = -0.2;
const RING_RADIUS = 1.22;
const TUBE_RADIUS = 0.145;
const POOL_FLOOR_Y = 0.035;
const BALL_RADIUS = 0.085;
const INNER_WALL_R = RING_RADIUS - TUBE_RADIUS - BALL_RADIUS - 0.01;
const POOL_BALLS = 78;
const STRAY_BALLS = 4;
const TOTAL_BALLS = POOL_BALLS + STRAY_BALLS;

const BALL_COLORS = [
    0xe83b3b, // red
    0xf5c429, // yellow
    0x2db356, // green
    0xf27c24, // orange
    0x2d7de8, // blue
    0xb94cd9, // purple
    0x22bdd0, // cyan
    0xee5ca6, // pink
];

function createPoolEasel(scene) {
    const group = new T.Group();
    group.position.set(0.35, 0, -1.88);
    group.rotation.y = -0.36;
    scene.add(group);

    const frameMat = new T.MeshStandardMaterial({ color: 0x26292e, roughness: 0.55, metalness: 0.35 });
    for (const side of [-0.62, 0.62]) {
        const leg = new T.Mesh(new T.CylinderGeometry(0.025, 0.028, 1.72, 10), frameMat);
        leg.position.set(side, 0.86, 0);
        leg.rotation.x = -0.05;
        group.add(leg);
    }
    const bar = new T.Mesh(new T.BoxGeometry(1.42, 0.04, 0.04), frameMat);
    bar.position.set(0, 0.72, 0.02);
    group.add(bar);

    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 416;
    const ctx = canvas.getContext("2d");
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const card = new T.Mesh(
        new T.PlaneGeometry(1.94, 1.05),
        new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide }),
    );
    card.position.set(0, 1.32, 0.05);
    card.rotation.x = -0.05;
    card.name = "Ball Pit notice";
    group.add(card);

    const redraw = hours => {
        ctx.fillStyle = "#f4efe2";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1f6fb8";
        ctx.lineWidth = 14;
        ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

        ctx.fillStyle = "#182433";
        ctx.textAlign = "center";
        ctx.font = "900 72px system-ui, sans-serif";
        ctx.fillText("BALL PIT", canvas.width / 2, 118);

        ctx.strokeStyle = "#c9bfa8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(90, 148);
        ctx.lineTo(canvas.width - 90, 148);
        ctx.stroke();

        ctx.fillStyle = "#2b3748";
        ctx.font = "bold 40px system-ui, sans-serif";
        ctx.fillText("Please enjoy an extra hour", canvas.width / 2, 218);
        ctx.fillText("in the ball pit.", canvas.width / 2, 268);

        ctx.fillStyle = "#1a68b5";
        ctx.font = "bold 33px system-ui, sans-serif";
        const label = hours === 1 ? "1 extra hour granted · click pit to splash" : `${hours} extra hours granted · click pit to splash`;
        ctx.fillText(label, canvas.width / 2, 352, canvas.width - 56);
        texture.needsUpdate = true;
    };
    redraw(1);
    return { card, redraw };
}

export function createBallPitRoom() {
    const scene = new T.Scene();
    scene.background = new T.Color(0x282428);

    const poolGroup = new T.Group();
    poolGroup.name = "Ball pit";
    poolGroup.position.set(POOL_X, 0, POOL_Z);
    scene.add(poolGroup);

    const lowerBlueMat = new T.MeshStandardMaterial({ color: 0x1669ba, roughness: 0.28, metalness: 0.06 });
    const upperBlueMat = new T.MeshStandardMaterial({ color: 0x2387e0, roughness: 0.22, metalness: 0.05 });
    const linerMat = new T.MeshStandardMaterial({ color: 0x114c8c, roughness: 0.45, metalness: 0.04 });
    const stripeMat = new T.MeshStandardMaterial({ color: 0xeaf4ff, roughness: 0.35, metalness: 0.02 });

    const liner = new T.Mesh(new T.CylinderGeometry(RING_RADIUS, RING_RADIUS + 0.02, POOL_FLOOR_Y, 44), linerMat);
    liner.position.y = POOL_FLOOR_Y / 2;
    const lowerRing = new T.Mesh(new T.TorusGeometry(RING_RADIUS, TUBE_RADIUS, 16, 48).rotateX(Math.PI / 2), lowerBlueMat);
    lowerRing.position.y = TUBE_RADIUS;
    const upperRing = new T.Mesh(new T.TorusGeometry(RING_RADIUS, TUBE_RADIUS, 16, 48).rotateX(Math.PI / 2), upperBlueMat);
    upperRing.position.y = TUBE_RADIUS * 2.55;
    const seam = new T.Mesh(new T.TorusGeometry(RING_RADIUS, 0.026, 8, 48).rotateX(Math.PI / 2), stripeMat);
    seam.position.y = TUBE_RADIUS * 3.45;
    poolGroup.add(liner, lowerRing, upperRing, seam);

    const ballGeo = new T.SphereGeometry(BALL_RADIUS, 16, 12);
    const ballMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.05 });
    const ballsMesh = new T.InstancedMesh(ballGeo, ballMat, TOTAL_BALLS);
    ballsMesh.name = "Ball pit balls";
    ballsMesh.frustumCulled = false;
    poolGroup.add(ballsMesh);

    const balls = [];
    const color = new T.Color();
    for (let i = 0; i < TOTAL_BALLS; i++) {
        const inPool = i < POOL_BALLS;
        let x = 0;
        let y = BALL_RADIUS;
        let z = 0;
        if (inPool) {
            const frac = (i + 0.5) / POOL_BALLS;
            const angle = i * 2.3999632;
            const layer = i >= 54 ? 1 : 0;
            const r = Math.sqrt(frac) * (INNER_WALL_R - 0.04) * (layer ? 0.72 : 1);
            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
            y = POOL_FLOOR_Y + BALL_RADIUS + layer * 0.14;
        } else {
            const idx = i - POOL_BALLS;
            const strayAngle = -0.35 + idx * 0.72;
            const strayR = RING_RADIUS + TUBE_RADIUS + BALL_RADIUS + 0.14 + (idx % 2) * 0.18;
            x = Math.cos(strayAngle) * strayR;
            z = Math.sin(strayAngle) * strayR;
            y = BALL_RADIUS;
        }
        balls.push({ x, y, z, vx: 0, vy: 0, vz: 0, inPool });
        color.setHex(BALL_COLORS[i % BALL_COLORS.length]);
        ballsMesh.setColorAt(i, color);
    }
    ballsMesh.instanceColor.needsUpdate = true;

    const matrix = new T.Matrix4();
    const syncBalls = () => {
        for (let i = 0; i < TOTAL_BALLS; i++) {
            const b = balls[i];
            matrix.makeTranslation(b.x, b.y, b.z);
            ballsMesh.setMatrixAt(i, matrix);
        }
        ballsMesh.instanceMatrix.needsUpdate = true;
        ballsMesh.computeBoundingSphere();
    };
    syncBalls();

    const easel = createPoolEasel(scene);
    const clickTargets = [liner, lowerRing, upperRing, ballsMesh, easel.card];

    let extraHours = 1;
    let settled = true;
    let lastNow = 0;

    const splash = (originX = 0, originZ = 0) => {
        extraHours++;
        easel.redraw(extraHours);
        settled = false;
        for (let i = 0; i < TOTAL_BALLS; i++) {
            const b = balls[i];
            if (!b.inPool) {
                b.vy = 0.8 + ((i * 37) % 10) * 0.06;
                continue;
            }
            const dx = b.x - originX;
            const dz = b.z - originZ;
            const d = Math.hypot(dx, dz);
            const focus = Math.max(0.25, 1.15 - d * 0.45);
            const kickAngle = i * 1.7 + extraHours * 0.9;
            b.vy = (2.2 + ((i * 53) % 13) * 0.16) * focus;
            b.vx += (d > 0.02 ? (dx / d) : Math.cos(kickAngle)) * 1.15 * focus + Math.cos(kickAngle) * 0.45;
            b.vz += (d > 0.02 ? (dz / d) : Math.sin(kickAngle)) * 1.15 * focus + Math.sin(kickAngle) * 0.45;
        }
    };

    const stepPhysics = dt => {
        if (settled) return;
        const minDist = BALL_RADIUS * 2;
        const minDistSq = minDist * minDist;
        let maxSpeedSq = 0;

        for (let i = 0; i < TOTAL_BALLS; i++) {
            const b = balls[i];
            b.vy -= 9.8 * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.z += b.vz * dt;

            const floorY = (b.inPool ? POOL_FLOOR_Y : 0) + BALL_RADIUS;
            if (b.y < floorY) {
                b.y = floorY;
                if (b.vy < 0) b.vy = Math.abs(b.vy) > 0.35 ? -b.vy * 0.42 : 0;
                b.vx *= 0.91;
                b.vz *= 0.91;
            }

            if (b.inPool) {
                const r = Math.hypot(b.x, b.z);
                if (r > INNER_WALL_R && r > 1e-4) {
                    const nx = b.x / r;
                    const nz = b.z / r;
                    b.x = nx * INNER_WALL_R;
                    b.z = nz * INNER_WALL_R;
                    const vr = b.vx * nx + b.vz * nz;
                    if (vr > 0) {
                        b.vx -= 1.48 * vr * nx;
                        b.vz -= 1.48 * vr * nz;
                    }
                }
            }
        }

        for (let i = 0; i < POOL_BALLS; i++) {
            const a = balls[i];
            for (let j = i + 1; j < POOL_BALLS; j++) {
                const b = balls[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dz = b.z - a.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq >= minDistSq || distSq < 1e-8) continue;
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;
                const push = (minDist - dist) * 0.5;
                a.x -= nx * push;
                a.y -= ny * push;
                a.z -= nz * push;
                b.x += nx * push;
                b.y += ny * push;
                b.z += nz * push;

                const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
                if (relV < 0) {
                    const jImp = -0.72 * relV;
                    a.vx -= jImp * nx;
                    a.vy -= jImp * ny;
                    a.vz -= jImp * nz;
                    b.vx += jImp * nx;
                    b.vy += jImp * ny;
                    b.vz += jImp * nz;
                }
            }
        }

        for (let i = 0; i < TOTAL_BALLS; i++) {
            const b = balls[i];
            b.vx *= 0.992;
            b.vz *= 0.992;
            const sSq = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
            if (sSq > maxSpeedSq) maxSpeedSq = sSq;
        }
        syncBalls();
        if (maxSpeedSq < 0.0004 && balls.every(b => b.y <= (b.inPool ? POOL_FLOOR_Y : 0) + BALL_RADIUS + 0.01)) {
            settled = true;
        }
    };

    return galleryRoom(scene, {
        canStand: (x, z) => Math.hypot(x - POOL_X, z - POOL_Z) > 1.56,
        update(now = performance.now()) {
            const dt = lastNow ? Math.min(0.032, Math.max(0.004, (now - lastNow) / 1000)) : 0.016;
            lastNow = now;
            stepPhysics(dt);
        },
        select(ray) {
            const hit = ray.intersectObjects(clickTargets, false)[0];
            if (!hit) return false;
            const local = poolGroup.worldToLocal(hit.point.clone());
            splash(hit.object === easel.card ? 0 : local.x, hit.object === easel.card ? 0 : local.z);
            return true;
        },
    });
}
