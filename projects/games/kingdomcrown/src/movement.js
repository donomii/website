export const MOVEMENT_CONFIG = Object.freeze({
    playerRideSpeed: 205, // World units per second at normal riding speed.
    playerGallopSpeed: 350, // World units per second while spending stamina.
    playerAcceleration: 5.5, // Response per second when gaining speed.
    playerBraking: 8.5, // Response per second after releasing direction.
    playerTurning: 12, // Faster braking when changing direction.
    playerStopSpeed: 1, // Snap slower movement to rest when no direction is held.
    playerWorldMargin: 55, // Keep the mounted herald inside either world edge.
    playerStaminaDrain: 30, // Stamina spent per second of galloping.
    playerStaminaRecovery: 21, // Stamina restored per second without galloping.
    playerGallopRecovery: 25, // Minimum stamina to clear exhaustion with Gallop released.
    playerStrideLength: 92, // Ground distance covered by one complete gait cycle.
});

export function updateRidingPlayer(player, input, dt, worldWidth) {
    const direction = Number(input.right) - Number(input.left);
    const wasExhausted = player.exhausted;
    player.exhausted = (player.exhausted || player.stamina <= 0)
        && (input.gallop || player.stamina < MOVEMENT_CONFIG.playerGallopRecovery);
    const galloping = input.gallop && direction !== 0 && !player.exhausted;
    const speed = galloping ? MOVEMENT_CONFIG.playerGallopSpeed : MOVEMENT_CONFIG.playerRideSpeed;
    const reversing = direction * player.vx < 0;
    const response = direction === 0 ? MOVEMENT_CONFIG.playerBraking
        : reversing ? MOVEMENT_CONFIG.playerTurning : MOVEMENT_CONFIG.playerAcceleration;
    const velocity = player.vx + (direction * speed - player.vx) * (1 - Math.exp(-response * dt));
    player.vx = direction === 0 && Math.abs(velocity) < MOVEMENT_CONFIG.playerStopSpeed ? 0 : velocity;
    const distance = moveMountedPlayer(player, direction, dt, worldWidth);
    updateStamina(player, galloping && distance > 0, dt);
    player.gaitPhase = (player.gaitPhase + distance / MOVEMENT_CONFIG.playerStrideLength) % 1;
    return !wasExhausted && player.exhausted;
}

function moveMountedPlayer(player, direction, dt, worldWidth) {
    const previousX = player.x;
    const margin = MOVEMENT_CONFIG.playerWorldMargin;
    const destination = player.x + player.vx * dt;
    player.x = Math.min(worldWidth - margin, Math.max(margin, destination));
    const atBoundary = (player.x === margin && player.vx < 0)
        || (player.x === worldWidth - margin && player.vx > 0);
    player.vx = atBoundary ? 0 : player.vx;
    const displacement = player.x - previousX;
    player.facing = Math.sign(displacement) || direction || player.facing;
    return Math.abs(displacement);
}

function updateStamina(player, galloping, dt) {
    if (galloping) {
        player.stamina = Math.max(0, player.stamina - MOVEMENT_CONFIG.playerStaminaDrain * dt);
        player.exhausted = player.stamina === 0;
    } else {
        player.stamina = Math.min(player.maxStamina, player.stamina + MOVEMENT_CONFIG.playerStaminaRecovery * dt);
    }
}

export function getSteedPose(player) {
    const speed = Math.abs(player.vx);
    const moving = Math.min(1, speed / (MOVEMENT_CONFIG.playerRideSpeed * 0.4));
    const gallop = Math.max(0, Math.min(1,
        (speed - MOVEMENT_CONFIG.playerRideSpeed) / (MOVEMENT_CONFIG.playerGallopSpeed - MOVEMENT_CONFIG.playerRideSpeed)));
    const phase = player.gaitPhase;
    const legs = [
        steedLeg(-25, (phase + 0.72 * gallop) % 1, moving, gallop, true),
        steedLeg(25, (phase + 0.5 - 0.34 * gallop) % 1, moving, gallop, true),
        steedLeg(-25, (phase + 0.5 + 0.06 * gallop) % 1, moving, gallop, false),
        steedLeg(25, phase, moving, gallop, false),
    ];
    return {
        legs,
        bob: -Math.pow(Math.sin(phase * Math.PI * 2), 2) * (1.5 + gallop * 2) * moving,
        lean: moving * (1 + gallop * 3),
    };
}

function steedLeg(hipX, phase, moving, gallop, far) {
    // The stance foot moves backward exactly as fast as the body moves forward.
    const reach = MOVEMENT_CONFIG.playerStrideLength / 4;
    const swinging = phase >= 0.5;
    const swing = Math.max(0, (phase - 0.5) * 2);
    const forward = swinging ? -1 + 2 * swing * swing * (3 - 2 * swing) : 1 - 4 * phase;
    return {
        hipX,
        footX: hipX + forward * reach * moving,
        footY: swinging ? -Math.sin(swing * Math.PI) * (12 + gallop * 6) * moving : 0,
        far,
    };
}
