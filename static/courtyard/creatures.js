import * as T from "three";
import { createGLTFCreatureModelLoadJobs } from "../../projects/creatures/demo/gltf-models.js";

const species = ["khronos-fox", "quaternius-bunny"];
const patrol = [
    new T.Vector3(3.5, 0, 2.3),
    new T.Vector3(-3.5, 0, 2.3),
    new T.Vector3(-3.5, 0, 6.1),
    new T.Vector3(3.5, 0, 6.1),
];

export async function createCreatures(scene) {
    const jobs = createGLTFCreatureModelLoadJobs();
    const models = await Promise.allSettled(species.map(id => jobs.find(job => job.id === id).load()));
    const creatures = models.flatMap((result, index) => {
        if (result.status === "rejected") {
            console.warn("Courtyard creature unavailable", result.reason);
            return [];
        }
        const actor = result.value.createActor();
        actor.object.position.copy(patrol[index]);
        scene.add(actor.object);
        return [{ actor, next: 1 - index, direction: index === 0 ? 1 : -1, restUntil: 0 }];
    });
    if (creatures.length === 0) throw new Error("No creature models loaded");
    let greetAfter = 0;
    let visitor = null;
    let visitorUntil = 0;
    let now = 0;

    function update(elapsed, dt) {
        now = elapsed;
        if (creatures.length === 2 && now >= greetAfter) {
            const [a, b] = creatures;
            if (a.actor.object.position.distanceTo(b.actor.object.position) < 1.3) {
                a.actor.object.lookAt(b.actor.object.position);
                b.actor.object.lookAt(a.actor.object.position);
                a.restUntil = b.restUntil = now + 1.8;
                greetAfter = now + 6;
            }
        }
        creatures.forEach(({ actor, restUntil }, index) => {
            const creature = creatures[index];
            const position = actor.object.position;
            const summoned = visitor && now < visitorUntil;
            const target = summoned ? visitor[index] : patrol[creature.next];
            const distance = position.distanceTo(target);
            const moving = distance > 0.18 && now >= restUntil;
            if (moving) {
                actor.object.lookAt(target);
                position.lerp(target, Math.min(1, dt * 1.55 / distance));
            } else if (!summoned && distance <= 0.18) {
                creature.next = (creature.next + creature.direction + patrol.length) % patrol.length;
                creature.restUntil = now + 0.65;
            }
            actor.update(elapsed, moving);
        });
    }

    function call(position) {
        visitor = creatures.map((_, index) => new T.Vector3(
            T.MathUtils.clamp(position.x + (index === 0 ? -0.7 : 0.7), -3.5, 3.5),
            0,
            T.MathUtils.clamp(position.z, 2.3, 6.1),
        ));
        visitorUntil = now + 9;
    }

    return { update, call };
}
