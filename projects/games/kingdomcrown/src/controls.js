const GALLOP_AFTER = 0.6;

export function createControls() {
    let held = null;
    let taps = [];
    let seconds = 0;

    return {
        pressRide(pointerId, direction) {
            if (held !== null) {
                return false;
            } else {
                held = { pointerId, direction, targetId: null, tap: null };
                seconds = 0;
                return true;
            }
        },
        pressPurchase(pointerId, targetId) {
            if (held !== null) {
                return false;
            } else {
                const tap = { targetId };
                held = { pointerId, direction: 0, targetId, tap };
                seconds = 0;
                taps.push(tap);
                return true;
            }
        },
        tapPurchase(targetId) {
            if (held === null) {
                taps.push({ targetId });
            } else {
                return;
            }
        },
        release(pointerId, cancelled = false) {
            if (held?.pointerId === pointerId) {
                // A normal release still counts the down event of a quick tap.
                taps = cancelled ? taps.filter((tap) => tap !== held.tap) : taps;
                held = null;
            } else {
                return;
            }
        },
        read(player, elapsed) {
            seconds = held === null ? 0 : seconds + elapsed;
            const direction = held?.direction ?? 0;
            const tap = taps[0] ?? null;
            const targetId = tap?.targetId ?? held?.targetId ?? null;
            return {
                left: direction < 0,
                right: direction > 0,
                stop: direction === 0,
                gallop: direction !== 0 && !player.exhausted && seconds >= GALLOP_AFTER,
                interactPressed: tap !== null,
                interactHeld: held?.targetId === targetId && targetId !== null,
                interactTargetId: targetId,
            };
        },
        finishFrame(completedTargetId = null) {
            taps.shift();
            taps = completedTargetId === null ? taps : taps.filter((tap) => tap.targetId !== completedTargetId);
            if (held?.targetId === completedTargetId && completedTargetId !== null) {
                held.targetId = null;
            } else {
                return;
            }
        },
        clear() {
            held = null;
            taps = [];
        },
    };
}
