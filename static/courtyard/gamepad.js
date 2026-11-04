export function readGamepad() {
    let activeIndex = null;
    let previous = [];
    return () => {
        const pads = Array.from(navigator.getGamepads?.() ?? []);
        const pad = pads.find(candidate => candidate?.mapping === "standard" && candidate.index === activeIndex)
            ?? pads.find(candidate => candidate?.mapping === "standard" && candidate.buttons.some(button => button.pressed));
        if (!pad || !document.hasFocus() || document.hidden) {
            activeIndex = null;
            previous = [];
            return null;
        }
        const current = pad.buttons.map(button => button.pressed);
        const pressed = current.map((down, index) => down && !previous[index]);
        activeIndex = pad.index;
        previous = current;
        const axes = Array.from(pad.axes, value => {
            const deadZone = 0.18;
            return Math.sign(value) * Math.max(0, Math.abs(value) - deadZone) / (1 - deadZone);
        });
        return { axes, pressed };
    };
}

export function gamepadMenu(selector) {
    return ({ pressed }) => {
        if (![0, 12, 13, 14, 15].some(index => pressed[index])) return;
        const controls = [...document.querySelectorAll(selector)].filter(control =>
            !control.disabled && control.getClientRects().length > 0);
        const current = controls.indexOf(document.activeElement);
        if (pressed[12] || pressed[14]) {
            controls[current <= 0 ? controls.length - 1 : current - 1]?.focus();
        } else if (pressed[13] || pressed[15]) {
            controls[(current + 1) % controls.length]?.focus();
        } else if (pressed[0]) {
            controls[current]?.click();
        }
    };
}
