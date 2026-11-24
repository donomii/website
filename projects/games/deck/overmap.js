import { paintChart, paintAirship } from "./overmap-art.js";

const deck = window.GameDeck;
const chart = document.querySelector(".airship-chart");
const canvas = chart.querySelector("canvas");
const pins = chart.querySelector(".airship-ports");
const portName = document.querySelector("#airship-port");
const dockButton = document.querySelector(".airship-dock");
const context = canvas.getContext("2d");
const backdrop = document.createElement("canvas");
const world = { width: 1200, height: 660 };
const positions = [
  [145, 115], [437, 151], [738, 109], [1047, 147],
  [163, 341], [457, 324], [757, 345], [1033, 330],
  [144, 524], [443, 555], [742, 520], [1050, 548],
];
const shortNames = new Map([["No One Can Stop Mr. Domino!", "Mr. Domino"]]);
const keyboard = new Set();
const directions = [[14, -1, 0], [15, 1, 0], [12, 0, -1], [13, 0, 1]];
const keyboardMovement = new Map([
  ["ArrowLeft", [-1, 0]], ["KeyA", [-1, 0]], ["ArrowRight", [1, 0]], ["KeyD", [1, 0]],
  ["ArrowUp", [0, -1]], ["KeyW", [0, -1]], ["ArrowDown", [0, 1]], ["KeyS", [0, 1]],
]);
const ship = { x: 145, y: 115, vx: 0, vy: 0, facing: 1 };
let ports = [];
let nearby;
let target;
let previousButtons = new Set();
let lastFrame = 0;
let width = 0;
let height = 0;

function select(port) {
  if (nearby !== port) {
    nearby?.button.removeAttribute("data-nearby");
    nearby = port;
    nearby?.button.setAttribute("data-nearby", "");
    portName.textContent = nearby?.group.name ?? "";
    dockButton.disabled = !nearby;
  }
}

function dock(port = nearby) {
  if (!port || deck.busy()) return;
  const games = port.group.games;
  if (games.length === 1) {
    deck.navigate(games[0].url);
  } else {
    void deck.open(port.group);
  }
}

function hop(horizontal, vertical) {
  const origin = target ?? nearby ?? ship;
  const candidates = ports.map(port => {
    const dx = port.x - origin.x;
    const dy = port.y - origin.y;
    const forward = dx * horizontal + dy * vertical;
    const across = Math.abs(dx * vertical + dy * horizontal);
    return { port, forward, score: forward + across * 2.5 };
  }).filter(candidate => candidate.forward > 20).sort((a, b) => a.score - b.score);
  target = candidates[0]?.port ?? target;
}

function flight(dt, dx, dy) {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 0.18) target = undefined;
  let vx = 0;
  let vy = 0;
  if (target) {
    const tx = target.x - ship.x;
    const ty = target.y - ship.y;
    const distance = Math.hypot(tx, ty);
    if (distance < 7) {
      ship.x = target.x;
      ship.y = target.y;
      ship.vx = 0;
      ship.vy = 0;
      target = undefined;
    } else {
      const speed = Math.min(715, distance * 11);
      vx = tx * speed / distance;
      vy = ty * speed / distance;
    }
  } else if (magnitude > 0.18) {
    const speed = 390 * Math.min(1, (magnitude - 0.18) / 0.82);
    vx = dx * speed / magnitude;
    vy = dy * speed / magnitude;
  }
  const ease = 1 - Math.exp(-dt * 7);
  ship.vx += (vx - ship.vx) * ease;
  ship.vy += (vy - ship.vy) * ease;
  ship.x = Math.min(world.width - 32, Math.max(32, ship.x + ship.vx * dt));
  ship.y = Math.min(world.height - 32, Math.max(32, ship.y + ship.vy * dt));
  if (Math.abs(ship.vx) > 18) ship.facing = Math.sign(ship.vx);
  select(ports.find(port => Math.hypot(ship.x - port.x, ship.y - port.y) < 46));
}

function draw(now) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.drawImage(backdrop, 0, 0);
  const x = ship.x * width / world.width;
  const y = ship.y * height / world.height;
  const scale = Math.min(width / 850, height / 530);
  paintAirship(context, x, y, ship.facing, Math.max(0.7, scale), now);
}

function resize() {
  const ratio = Math.min(devicePixelRatio, 2);
  width = Math.round(chart.clientWidth * ratio);
  height = Math.round(chart.clientHeight * ratio);
  canvas.width = backdrop.width = width;
  canvas.height = backdrop.height = height;
  const art = backdrop.getContext("2d");
  art.setTransform(width / world.width, 0, 0, height / world.height, 0, 0);
  paintChart(art, world, ports);
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!deck.busy()) {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(item => item?.connected);
    const pressed = new Set(directions.map(([index]) => index).concat(0).filter(index => pad?.buttons[index]?.pressed));
    for (const [index, horizontal, vertical] of directions) {
      if (pressed.has(index) && !previousButtons.has(index)) hop(horizontal, vertical);
    }
    if (!target && pressed.has(0) && !previousButtons.has(0)) dock();
    previousButtons = pressed;
    let dx = pad?.axes[0] ?? 0;
    let dy = pad?.axes[1] ?? 0;
    for (const key of keyboard) {
      const [x, y] = keyboardMovement.get(key);
      dx += x;
      dy += y;
    }
    flight(dt, dx, dy);
  }
  if (width && height) draw(now);
  requestAnimationFrame(frame);
}

function installKeyboard() {
  window.addEventListener("keydown", event => {
    if (deck.busy()) return;
    if (keyboardMovement.has(event.code)) {
      event.preventDefault();
      keyboard.add(event.code);
    } else if (event.code === "Enter" && !event.repeat && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      dock();
    }
  });
  window.addEventListener("keyup", event => keyboard.delete(event.code));
  window.addEventListener("blur", () => keyboard.clear());
}

function addPorts(groups) {
  const columns = 4;
  const rows = Math.ceil(groups.length / columns);
  return groups.map((group, index) => {
    const point = rows <= 3 ? positions[index] : undefined;
    const x = point?.[0] ?? (index % columns + 0.5) * world.width / columns;
    const y = point?.[1] ?? (Math.floor(index / columns) + 0.5) * world.height / rows;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = shortNames.get(group.name) ?? group.name;
    button.setAttribute("aria-label", group.name);
    button.style.left = `${x / world.width * 100}%`;
    button.style.top = `${y / world.height * 100}%`;
    const port = { x, y, button, group };
    button.addEventListener("click", () => dock(port));
    pins.append(button);
    return port;
  });
}

deck.catalogue.then(groups => {
  ports = addPorts(groups);
  select(ports[0]);
  dockButton.addEventListener("click", () => dock());
  installKeyboard();
  new ResizeObserver(resize).observe(chart);
  resize();
  requestAnimationFrame(frame);
}).catch(error => {
  chart.querySelector(".airship-error").hidden = false;
  console.error(error);
});
