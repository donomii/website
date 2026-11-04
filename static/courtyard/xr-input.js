import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

export const vrSessionOptions = {
    requiredFeatures: ["local-floor"],
    optionalFeatures: ["hand-tracking"],
};

export function attachVrInput(xr, rig, index, showRay = true) {
    const ray = xr.getController(index);
    const grip = xr.getControllerGrip(index);
    const hand = xr.getHand(index);
    const finish = new T.MeshBasicMaterial({ color: index ? 0xaadfff : 0xffdfa0 });
    const shell = new T.Mesh(new T.CapsuleGeometry(0.024, 0.068, 4, 10), finish);
    shell.rotation.x = Math.PI / 2;
    const face = new T.Mesh(new T.TorusGeometry(0.032, 0.005, 6, 20), finish);
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 0.022, -0.036);
    grip.add(shell, face);

    if (showRay) {
        const beam = new T.Line(new T.BufferGeometry().setFromPoints([
            new T.Vector3(), new T.Vector3(0, 0, -24),
        ]), new T.LineBasicMaterial({ color: 0xffdf9f, transparent: true, opacity: 0.45 }));
        ray.add(beam);
    }

    const joints = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), finish, 25);
    joints.count = 0;
    joints.frustumCulled = false;
    joints.instanceMatrix.setUsage(T.DynamicDrawUsage);
    hand.add(joints);
    rig.add(ray, grip, hand);
    const matrix = new T.Matrix4();
    function update() {
        let count = 0;
        for (const joint of Object.values(hand.joints)) {
            if (!joint.visible || count === 25) continue;
            const radius = Math.max(0.007, joint.jointRadius || 0.01);
            matrix.makeScale(radius, radius, radius).setPosition(joint.position);
            joints.setMatrixAt(count++, matrix);
        }
        joints.count = count;
        joints.instanceMatrix.needsUpdate = true;
    }
    return { ray, update };
}

export function thumbsticks(sources) {
    const controllers = Array.from(sources).filter(source =>
        source.gamepad?.mapping === "xr-standard" && source.gamepad.axes.length >= 4);
    const left = controllers.find(source => source.handedness === "left") ?? controllers[0];
    const right = controllers.find(source => source !== left && source.handedness === "right");
    return [left?.gamepad.axes[2] ?? 0, left?.gamepad.axes[3] ?? 0, right?.gamepad.axes[2] ?? 0];
}
