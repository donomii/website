import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

/**
 * Combines multiple exhibit rooms into a single shared gallery room with
 * positioned alcove bays, unified floor collision, and per-bay context hints.
 */
export async function composeExhibitsRoom({
    width = 12,
    depth = 16,
    floorColor = 0x534238,
    bgColor = 0x201a18,
    defaultHint = "",
    defaultHref = null,
    bays = [],
    onReport = () => {},
} = {}) {
    const scene = new T.Scene();
    scene.background = new T.Color(bgColor);
    scene.add(new T.HemisphereLight(0xffe9cf, 0x6c584e, 2.3));
    const sun = new T.DirectionalLight(0xffe0b8, 2.2);
    sun.position.set(-4, 7, 5);
    scene.add(sun);

    const surface = new T.Mesh(
        new T.PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
        new T.MeshStandardMaterial({ color: floorColor, roughness: 0.88 }),
    );
    surface.position.y = -0.02;
    const exit = new T.Mesh(new T.PlaneGeometry(2.4, 3.2), new T.MeshBasicMaterial());
    exit.position.set(0, 1.6, depth / 2 - 0.1);
    scene.add(surface, exit);

    let lastInteracted = null;
    const mounted = await Promise.all(bays.map(async bay => {
        const sub = await bay.load(msg => onReport(bay, msg));
        const group = new T.Group();
        group.position.set(bay.x, 0, bay.z);
        group.rotation.y = bay.rotY ?? 0;
        const scale = bay.scale ?? 1;
        group.scale.setScalar(scale);
        scene.add(group);
        for (const child of [...sub.scene.children]) {
            if (child.isLight) continue;
            if (child === sub.exit || child === sub.surface || child.userData?.baySkip) continue;
            group.add(child);
        }
        return { ...bay, scale, sub, group };
    }));

    return {
        scene,
        surface,
        exit,
        aimSelect: mounted.some(b => b.sub.aimSelect),
        height: () => 0,
        enter() {
            for (const b of mounted) b.sub.enter?.();
        },
        leave() {
            for (const b of mounted) b.sub.leave?.();
        },
        update(now, frame, xr, renderer) {
            for (const b of mounted) b.sub.update?.(now, frame, xr, renderer);
        },
        canStand(lx, lz) {
            for (const b of mounted) {
                if (!b.sub.canStand) continue;
                const dx = lx - b.x;
                const dz = lz - b.z;
                const cos = Math.cos(b.rotY ?? 0);
                const sin = Math.sin(b.rotY ?? 0);
                // Convert room-local point into bay-local coordinates.
                const bx = (dx * cos - dz * sin) / b.scale;
                const bz = (dx * sin + dz * cos) / b.scale;
                if (b.checkRadius && Math.hypot(dx, dz) > b.checkRadius) continue;
                if (b.sub.canStand(bx, bz) === false) return false;
            }
            return true;
        },
        select(ray) {
            for (const b of mounted) {
                if (b.sub.select?.(ray)) {
                    lastInteracted = b;
                    return true;
                }
            }
            return false;
        },
        contextAt(lx, lz) {
            let nearest = null;
            let bestDist = Infinity;
            for (const b of mounted) {
                const dist = Math.hypot(lx - b.x, lz - b.z);
                if (dist < (b.focusRadius ?? 4.6) && dist < bestDist) {
                    bestDist = dist;
                    nearest = b;
                }
            }
            const active = nearest ?? lastInteracted;
            if (!active) return { key: "overview", hint: defaultHint, projectHref: defaultHref };
            return { key: active.id, hint: active.hint, projectHref: active.projectHref ?? null };
        },
    };
}
