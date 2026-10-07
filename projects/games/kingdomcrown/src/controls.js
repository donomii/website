const KEY_ACTIONS = Object.freeze({
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    ShiftLeft: "gallop",
    ShiftRight: "gallop",
    Space: "attack",
    KeyE: "interact",
});

export function createControls(keyboardTarget, touchButtons, callbacks) {
    const sources = new Map();
    const pressed = new Set();
    const buttons = [...touchButtons];
    const controls = {
        read() {
            const held = new Set(sources.values());
            return {
                left: held.has("left"),
                right: held.has("right"),
                gallop: held.has("gallop"),
                attackPressed: pressed.has("attack"),
                interactPressed: pressed.has("interact"),
            };
        },
        finishFrame() {
            pressed.clear();
        },
        clear() {
            sources.clear();
            pressed.clear();
            for (const button of buttons) {
                button.classList.remove("is-held");
            }
        },
    };
    keyboardTarget.addEventListener("keydown", keyDown, { passive: false });
    keyboardTarget.addEventListener("keyup", keyUp, { passive: false });
    keyboardTarget.addEventListener("blur", () => {
        controls.clear();
        callbacks.onBlur();
    });
    for (const button of buttons) {
        bindTouchButton(button, sources, pressed, callbacks);
    }
    return controls;

    function keyDown(event) {
        const action = KEY_ACTIONS[event.code];
        if (action === undefined) {
            callbacks.onSpecialKey(event);
        } else {
            event.preventDefault();
            if (callbacks.isPlaying() && !event.repeat) {
                pressAction(sources, pressed, `key:${event.code}`, action);
            } else {
                return;
            }
        }
    }

    function keyUp(event) {
        if (KEY_ACTIONS[event.code] === undefined) {
            return;
        } else {
            event.preventDefault();
            sources.delete(`key:${event.code}`);
        }
    }
}

function pressAction(sources, pressed, source, action) {
    switch (action) {
        case "attack":
        case "interact":
            pressed.add(action);
            break;
        case "left":
        case "right":
        case "gallop":
            sources.set(source, action);
            break;
        default:
            throw new Error(`Unknown control action '${action}' from '${source}' while accepting player input.`);
    }
}

function bindTouchButton(button, sources, pressed, callbacks) {
    const release = (event) => {
        event.preventDefault();
        sources.delete(`pointer:${event.pointerId}`);
        const held = [...sources].some(([source, action]) => source.startsWith("pointer:") && action === button.dataset.action);
        button.classList.toggle("is-held", held);
    };
    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (callbacks.isPlaying()) {
            button.setPointerCapture(event.pointerId);
            button.classList.add("is-held");
            pressAction(sources, pressed, `pointer:${event.pointerId}`, button.dataset.action);
            callbacks.onTouch();
        } else {
            return;
        }
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
}
