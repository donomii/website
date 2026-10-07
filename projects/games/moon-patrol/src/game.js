import { createGameState, inputFromKeys, updateGameState } from "../web/game_state.js";

const keys = new Set();
const pointerAim = { active: false, x: 1, y: 0 };
let pointerFire = false;
let previousGamepadButtons = new Set();

export function createGame() {
  return createGameState();
}

export function press(code) {
  keys.add(code);
}

export function release(code) {
  keys.delete(code);
}

export function setPointerAim(vector) {
  pointerAim.active = true;
  pointerAim.x = vector.x;
  pointerAim.y = vector.y;
}

export function clearPointerAim() {
  pointerAim.active = false;
}

export function setPointerFire(active) {
  pointerFire = active;
}

export function update(game, dt) {
  const input = browserInput();
  const next = updateGameState(game, input, dt);
  clearLatchedKeys(input);
  replaceGameState(game, next);
}

function browserInput() {
  const input = inputFromKeys(keys);
  const gamepad = inputFromGamepads();
  input.moveX = largestAxis(input.moveX, gamepad.moveX);
  input.moveY = largestAxis(input.moveY, gamepad.moveY);
  input.left = input.left || input.moveY < 0;
  input.right = input.right || input.moveY > 0;
  input.fire = pointerFire || gamepad.fire;
  input.pause = input.pause || gamepad.pause;
  input.restart = input.restart || gamepad.restart;
  if (pointerAim.active) {
    input.aim = { x: pointerAim.x, y: pointerAim.y };
  } else if (gamepad.aim) {
    input.aim = gamepad.aim;
  }
  return input;
}

function inputFromGamepads() {
  const pads = typeof navigator !== "undefined" && typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  const buttons = new Set();
  const input = { moveX: 0, moveY: 0, aim: null, fire: false, pause: false, restart: false };
  for (const pad of pads) {
    if (!pad) {
      continue;
    }
    const leftX = axis(pad.axes[0]);
    const leftY = axis(pad.axes[1]);
    const rightX = axis(pad.axes[2]);
    const rightY = axis(pad.axes[3]);
    input.moveX = largestAxis(input.moveX, leftX);
    input.moveY = largestAxis(input.moveY, -leftY);
    if (Math.hypot(rightX, rightY) > 0) {
      input.aim = { x: rightX, y: rightY };
    }
    for (let index = 0; index < pad.buttons.length; index += 1) {
      if (pad.buttons[index].pressed) {
        const id = `${pad.index}:${index}`;
        buttons.add(id);
        input.fire = input.fire || index === 0 || index === 5 || index === 7;
        input.pause = input.pause || (index === 9 && !previousGamepadButtons.has(id));
        input.restart = input.restart || (index === 8 && !previousGamepadButtons.has(id));
      }
    }
  }
  previousGamepadButtons = buttons;
  return input;
}

function clearLatchedKeys(input) {
  if (input.pause) {
    keys.delete("KeyP");
  }
  if (input.restart) {
    keys.delete("KeyR");
  }
}

function largestAxis(a, b) {
  if (Math.abs(b) > Math.abs(a)) {
    return b;
  }
  return a;
}

function axis(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.18) {
    return 0;
  }
  return value;
}

function replaceGameState(game, next) {
  for (const key of Object.keys(game)) {
    delete game[key];
  }
  Object.assign(game, next);
}

window.MoonPatrolGame = { createGame, update, press, release, setPointerAim, clearPointerAim, setPointerFire };
