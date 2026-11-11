import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { moduleLimit, ports, types } from "../../projects/games/accumulative-station/station.mjs";

// The original simulation uses z for height and y for its second horizontal axis.
const point = ([x, y, z]) => new T.Vector3(x, z, y);
const visible = object => {
    for (let node = object; node; node = node.parent) {
        if (!node.visible) return false;
    }
    return true;
};

function crewMeshes(parent) {
    const suit = new T.MeshStandardMaterial({ color: 0xffe9bd, roughness: 0.6 });
    const dark = new T.MeshStandardMaterial({ color: 0x16384e, metalness: 0.4 });
    const make = (name, geometry, material, count) => {
        const mesh = new T.InstancedMesh(geometry, material, count);
        mesh.name = name;
        mesh.count = 0;
        mesh.frustumCulled = false;
        parent.add(mesh);
        return mesh;
    };
    const body = make("Station crew suits", new T.CapsuleGeometry(0.033, 0.055, 3, 6), suit, 24);
    const heads = make("Station crew helmets", new T.SphereGeometry(0.044, 8, 6), suit, 24);
    const visors = make("Station crew visors", new T.SphereGeometry(0.039, 8, 4).scale(0.9, 0.55, 0.3), dark, 24);
    const limbs = make("Station crew limbs", new T.BoxGeometry(0.024, 0.072, 0.025), suit, 96);
    const packs = make("Station crew backpacks", new T.BoxGeometry(0.058, 0.065, 0.035), dark, 24);
    const matrix = new T.Matrix4();
    const offset = new T.Vector3();
    const position = new T.Vector3();
    const rotation = new T.Quaternion();
    const swing = new T.Quaternion();
    const xAxis = new T.Vector3(1, 0, 0);
    const unit = new T.Vector3(1, 1, 1);
    const orientations = Array.from({ length: 24 }, () => new T.Quaternion());
    const basis = new T.Matrix4();
    const normal = new T.Vector3();
    const side = new T.Vector3();
    return (station, crew, positions, now, elapsed) => {
        for (const mesh of [body, heads, visors, limbs, packs]) mesh.count = 0;
        crew.forEach((member, index) => {
            const from = point(station.modules[member.from].position);
            const to = point(station.modules[member.to].position);
            const direction = to.clone().sub(from).normalize();
            if (direction.lengthSq() === 0) direction.set(0, 0, 1);
            normal.set(Math.abs(direction.y) > 0.5 ? 1 : 0, Math.abs(direction.y) > 0.5 ? 0 : 1, 0);
            side.crossVectors(normal, direction).normalize();
            basis.makeBasis(side, normal, direction);
            const desired = new T.Quaternion().setFromRotationMatrix(basis);
            orientations[index].slerp(desired, Math.min(1, elapsed / 110));
            const orientation = orientations[index];
            const distance = Math.min(member.phase, 1 - member.phase);
            // Walk over module roofs near nodes and along tube shells between them.
            const lift = 0.1 + 0.25 * (1 - T.MathUtils.smoothstep(distance, 0.16, 0.4));
            const feet = point(positions[index]).addScaledVector(normal, lift).addScaledVector(side, (index % 3 - 1) * 0.075);
            const stride = Math.sin(now / 125 + index) * (member.from === member.to ? 0.04 : 0.55);
            const part = (mesh, x, y, z, angle = 0) => {
                position.copy(offset.set(x, y, z)).applyQuaternion(orientation).add(feet);
                swing.setFromAxisAngle(xAxis, angle);
                rotation.copy(orientation).multiply(swing);
                matrix.compose(position, rotation, unit);
                mesh.setMatrixAt(mesh.count++, matrix);
            };
            part(body, 0, 0.11, 0);
            part(heads, 0, 0.19, 0);
            part(visors, 0, 0.194, 0.033);
            part(packs, 0, 0.12, -0.043);
            for (const sign of [-1, 1]) {
                part(limbs, sign * 0.024, 0.035, sign * Math.sin(stride) * 0.025, sign * stride);
                part(limbs, sign * 0.052, 0.11, -sign * Math.sin(stride) * 0.025, -sign * stride);
            }
        });
        for (const mesh of [body, heads, visors, limbs, packs]) mesh.instanceMatrix.needsUpdate = true;
    };
}

function typeLabel(scene, type, x) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext("2d");
    context.fillStyle = "#102635";
    context.fillRect(0, 0, 512, 112);
    context.fillStyle = "#e3f1ef";
    context.font = "46px system-ui";
    context.textAlign = "center";
    context.fillText(type, 256, 73, 488);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(new T.PlaneGeometry(0.74, 0.162), new T.MeshBasicMaterial({ map: texture }));
    mesh.position.set(x, 0.78, 1.73);
    mesh.userData.order = { kind: "type", type };
    scene.add(mesh);
    return mesh;
}

export function stationModels(scene) {
    const root = new T.Group();
    root.name = "Station structure";
    root.position.set(0, 1.87, -1.3);
    scene.add(root);
    const geometry = {
        Habitat: new T.CylinderGeometry(0.27, 0.27, 0.58, 10).rotateZ(Math.PI / 2),
        Laboratory: new T.BoxGeometry(0.5, 0.5, 0.5),
        Greenhouse: new T.SphereGeometry(0.32, 12, 8).scale(1, 0.85, 1),
        Observatory: new T.IcosahedronGeometry(0.33, 1),
    };
    const modules = Object.fromEntries(Object.entries(types).map(([type, color]) => {
        const mesh = new T.InstancedMesh(geometry[type], new T.MeshStandardMaterial({ color, metalness: 0.24, roughness: 0.5 }), moduleLimit);
        mesh.name = "Station " + type;
        mesh.userData.indices = [];
        mesh.count = 0;
        root.add(mesh);
        return [type, mesh];
    }));
    const tubes = new T.InstancedMesh(new T.CylinderGeometry(0.075, 0.075, 1, 8),
        new T.MeshStandardMaterial({ color: 0x779cab, metalness: 0.6, roughness: 0.4 }), moduleLimit * 3);
    tubes.name = "Station tubes";
    const windows = new T.InstancedMesh(new T.BoxGeometry(0.3, 0.14, 0.035),
        new T.MeshStandardMaterial({ color: 0x193b56, emissive: 0x153847, roughness: 0.3 }), moduleLimit);
    root.add(tubes, windows);
    const highlight = new T.Mesh(new T.BoxGeometry(0.73, 0.73, 0.73),
        new T.MeshBasicMaterial({ color: 0xffd887, wireframe: true }));
    root.add(highlight);
    const drawCrew = crewMeshes(root);
    const targetMeshes = [];
    const palette = Object.keys(types).map((type, index) => {
        const x = (index - 1.5) * 0.9;
        const shape = new T.Mesh(geometry[type], modules[type].material);
        shape.position.set(x, 1.0, 1.4);
        shape.scale.setScalar(0.55);
        shape.userData.order = { kind: "type", type };
        scene.add(shape);
        const rim = new T.Mesh(new T.TorusGeometry(0.26, 0.022, 6, 24).rotateX(-Math.PI / 2),
            new T.MeshBasicMaterial({ color: 0x354d58 }));
        rim.position.set(x, 0.755, 1.4);
        scene.add(rim);
        targetMeshes.push(shape, typeLabel(scene, type, x));
        return { type, rim };
    });
    const portViews = Object.entries(ports).map(([port, vector]) => {
        const direction = point(vector);
        const handle = new T.Mesh(new T.TorusGeometry(0.13, 0.025, 6, 24),
            new T.MeshBasicMaterial({ color: 0x77dfec }));
        handle.name = "Port " + port;
        handle.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), direction);
        // The visible ring has a solid pick volume, including when viewed edge-on.
        const picker = new T.Mesh(new T.SphereGeometry(0.18, 10, 6),
            new T.MeshBasicMaterial({ transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
        picker.quaternion.copy(handle.quaternion);
        picker.name = "Pick " + port;
        picker.userData.order = { kind: "port", port };
        const ghost = new T.Mesh(geometry.Habitat, new T.MeshBasicMaterial({ color: 0x77dfec, wireframe: true, transparent: true, opacity: 0.28 }));
        ghost.userData.order = picker.userData.order;
        scene.add(handle, picker);
        root.add(ghost);
        targetMeshes.push(picker, ghost);
        return { port, direction, handle, picker, ghost };
    });
    const matrix = new T.Matrix4();
    const rotation = new T.Quaternion();
    const up = new T.Vector3(0, 1, 0);
    return {
        draw(station, selection, type) {
            const positions = station.modules.map(module => point(module.position));
            const selected = positions[selection];
            const bounds = new T.Box3().setFromPoints([...positions, selected.clone().addScalar(1), selected.clone().subScalar(1)]);
            const size = bounds.getSize(new T.Vector3()).addScalar(1);
            const scale = Math.min(0.72, 4.15 / size.x, 3.3 / size.y, 3.8 / size.z);
            root.scale.setScalar(scale);
            root.position.set(
                T.MathUtils.clamp(root.position.x, -2.075 - (bounds.min.x - 0.5) * scale, 2.075 - (bounds.max.x + 0.5) * scale),
                T.MathUtils.clamp(root.position.y, 0.65 - (bounds.min.y - 0.5) * scale, 4.7 - (bounds.max.y + 0.5) * scale),
                T.MathUtils.clamp(root.position.z, -3.2 - (bounds.min.z - 0.5) * scale, 0.6 - (bounds.max.z + 0.5) * scale));
            for (const mesh of Object.values(modules)) { mesh.count = 0; mesh.userData.indices = []; }
            tubes.count = 0;
            windows.count = 0;
            station.modules.forEach((module, index) => {
                const mesh = modules[module.type];
                matrix.makeTranslation(...positions[index].toArray());
                mesh.userData.indices.push(index);
                mesh.setMatrixAt(mesh.count++, matrix);
                matrix.makeTranslation(positions[index].x, positions[index].y + 0.05, positions[index].z + 0.275);
                windows.setMatrixAt(windows.count++, matrix);
                for (const target of module.links) {
                    if (target <= index) continue;
                    const direction = positions[target].clone().sub(positions[index]);
                    rotation.setFromUnitVectors(up, direction.clone().normalize());
                    matrix.compose(positions[index].clone().add(positions[target]).multiplyScalar(0.5), rotation, new T.Vector3(1, direction.length(), 1));
                    tubes.setMatrixAt(tubes.count++, matrix);
                }
            });
            for (const mesh of [...Object.values(modules), tubes, windows]) {
                mesh.instanceMatrix.needsUpdate = true;
                mesh.computeBoundingSphere();
            }
            highlight.position.copy(selected);
            for (const view of palette) view.rim.material.color.setHex(view.type === type ? 0xffd887 : 0x354d58);
            root.updateMatrixWorld(true);
            const origin = root.position.clone().addScaledVector(selected, scale);
            for (const view of portViews) {
                const neighbor = selected.clone().add(view.direction);
                const target = positions.findIndex(position => position.equals(neighbor));
                const connected = station.modules[selection].links.includes(target);
                view.handle.visible = view.picker.visible = !connected;
                view.ghost.visible = target === -1;
                view.ghost.geometry = geometry[type];
                view.ghost.position.copy(neighbor);
                // Loop controls belong in the gap, outside both neighboring hulls.
                view.handle.position.copy(origin).addScaledVector(view.direction, target === -1 ? 0.54 : scale / 2);
                view.picker.position.copy(view.handle.position);
            }
        },
        animate: drawCrew,
        hit(ray) {
            (root.parent ?? scene).updateMatrixWorld(true);
            const hits = ray.intersectObjects([...Object.values(modules).filter(mesh => mesh.count), ...targetMeshes], false);
            const hit = hits.find(candidate => visible(candidate.object));
            if (!hit) return undefined;
            if (hit.instanceId !== undefined) return { kind: "module", index: hit.object.userData.indices[hit.instanceId] };
            return hit.object.userData.order;
        },
    };
}
