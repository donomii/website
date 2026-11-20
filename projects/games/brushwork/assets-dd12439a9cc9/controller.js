"use strict";

(function attachBrushworkController(root) {
  const deadZone = 0.18;
  const pressThreshold = 0.45;
  const releaseThreshold = 0.28;
  const neutral = { cast: false, trail: false, confirm: false, menu: false, dodge: false };
  const buttons = { confirm: 0, trail: 2, dodge: 5, cast: 7, menu: 9, up: 12, down: 13, left: 14, right: 15 };

  function browserGamepads() {
    try {
      return root.navigator?.getGamepads?.() ?? [];
    } catch (error) {
      if (error.name === "SecurityError") {
        return [];
      } else {
        throw error;
      }
    }
  }

  function standard(pad) {
    return pad?.connected === true && pad.mapping === "standard";
  }

  function stick(x, y) {
    const distance = Math.hypot(x, y);
    if (distance <= deadZone) {
      return { x: 0, y: 0 };
    } else {
      const scale = (Math.min(distance, 1) - deadZone) / ((1 - deadZone) * distance);
      return { x: x * scale, y: y * scale };
    }
  }

  function sample(pad, previous) {
    const pressed = (name) => pad.buttons[buttons[name]]?.pressed === true;
    const x = Number(pressed("right")) - Number(pressed("left"));
    const y = Number(pressed("down")) - Number(pressed("up"));
    const move = x || y ? stick(x, y) : stick(pad.axes[0], pad.axes[1]);
    const aim = stick(pad.axes[2], pad.axes[3]);
    const trigger = pad.buttons[buttons.cast];
    const cast = (trigger?.value ?? Number(trigger?.pressed === true))
      >= (previous.cast ? releaseThreshold : pressThreshold);
    const trail = pressed("trail");
    const confirm = pressed("confirm");
    const menu = pressed("menu");
    const dodge = pressed("dodge");
    return {
      move, aim, cast, trail, confirm, menu, dodge,
      castPressed: cast && !previous.cast,
      trailPressed: trail && !previous.trail,
      confirmPressed: confirm && !previous.confirm,
      menuPressed: menu && !previous.menu,
      dodgePressed: dodge && !previous.dodge,
      active: Boolean(move.x || move.y || aim.x || aim.y || cast || trail || confirm || menu || dodge),
    };
  }

  function create(readGamepads = browserGamepads) {
    let index = null;
    let previous = neutral;

    function read() {
      const pads = readGamepads();
      if (index !== null) {
        const pad = pads[index];
        if (standard(pad)) {
          previous = sample(pad, previous);
          return previous;
        } else {
          index = null;
          previous = neutral;
          return null;
        }
      } else {
        for (const pad of pads) {
          if (standard(pad)) {
            const input = sample(pad, neutral);
            if (input.active) {
              index = pad.index;
              previous = input;
              return input;
            }
          }
        }
        return null;
      }
    }

    return Object.freeze({ read });
  }

  const api = Object.freeze({ create });
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrushworkController = api;
  }
})(globalThis);
