import { MOVEMENT_CONFIG } from "./movement.js";

const ARRIVAL_TOLERANCE = 9;
const GALLOP_DISTANCE = 190;

export function createControls(worldWidth) {
    const margin = MOVEMENT_CONFIG.playerWorldMargin;
    let destination = null;
    let interactionId = null;

    return {
        get destination() {
            return destination;
        },
        rideTo(x) {
            destination = Math.max(margin, Math.min(worldWidth - margin, x));
            interactionId = null;
        },
        interactWith(id) {
            destination = null;
            interactionId = id;
        },
        read(player) {
            const moving = directionFor(player);
            return {
                left: moving < 0,
                right: moving > 0,
                gallop: moving !== 0 && !player.exhausted && Math.abs(destination - player.x) >= GALLOP_DISTANCE,
                interactPressed: interactionId !== null,
                interactTargetId: interactionId,
            };
        },
        finishFrame() {
            interactionId = null;
        },
        clear() {
            destination = null;
            interactionId = null;
        },
    };

    function directionFor(player) {
        if (destination === null || player.reformTimer > 0) {
            return 0;
        } else {
            const distance = destination - player.x;
            const speed = Math.abs(player.vx);
            if (Math.abs(distance) <= ARRIVAL_TOLERANCE && speed <= MOVEMENT_CONFIG.playerStopSpeed) {
                destination = null;
                return 0;
            } else {
                const direction = Math.sign(distance);
                const brakingDistance = Math.max(0, player.vx * direction) / MOVEMENT_CONFIG.playerBraking;
                // Coast into the target with the same braking rate used by the riding simulation.
                return Math.abs(distance) <= ARRIVAL_TOLERANCE / 2 + brakingDistance ? 0 : direction;
            }
        }
    }
}
