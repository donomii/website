const STICK_DEAD_ZONE = 0.25;

export const NO_BUTTONS = Object.freeze({ direction: 0, pay: false, pause: false });

export function readStandardGamepad(pads) {
    const pad = Array.from(pads).find((candidate) => candidate?.connected && candidate.mapping === "standard");
    if (pad === undefined) {
        return NO_BUTTONS;
    } else {
        const left = Boolean(pad.buttons[14]?.pressed);
        const right = Boolean(pad.buttons[15]?.pressed);
        const stick = pad.axes[0] ?? 0;
        const direction = left || right ? Number(right) - Number(left)
            : Math.abs(stick) > STICK_DEAD_ZONE ? Math.sign(stick) : 0;
        return { direction, pay: Boolean(pad.buttons[0]?.pressed), pause: Boolean(pad.buttons[9]?.pressed) };
    }
}

export function createButtonInput(controls, availableTarget, activate = () => false, pause = () => {}) {
    const inputId = Symbol("button input");
    let previous = NO_BUTTONS;

    return {
        update(next, playing) {
            const before = previous;
            previous = next;
            if (next.pause && !before.pause) {
                controls.release(inputId, true);
                pause();
            } else if (next.pay && !before.pay) {
                controls.release(inputId);
                const targetId = !activate() && playing ? availableTarget() : null;
                if (targetId !== null) {
                    controls.pressPurchase(inputId, targetId);
                } else {
                    return;
                }
            } else if (next.pay) {
                return;
            } else {
                if (before.pay || before.direction !== next.direction) {
                    controls.release(inputId);
                }
                if (next.direction !== 0 && playing) {
                    controls.pressRide(inputId, next.direction);
                } else {
                    return;
                }
            }
        },
    };
}
