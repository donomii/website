import { connect, createInhabitant, createStation, ports, types, walk } from "./station.mjs";

const station = createStation();
const canvas = document.querySelector("#station");
const ctx = canvas.getContext("2d");
const selected = document.querySelector("#selected");
const type = document.querySelector("#type");
const stats = document.querySelector("#stats");
const message = document.querySelector("#message");
const controls = document.querySelector("#ports");
let selection = 0;
let hitboxes = [];
const crew = [];
let previousTime;

function option(list, label, value) {
    const entry = document.createElement("option");
    entry.textContent = label;
    entry.value = value;
    list.append(entry);
}
for (const name of Object.keys(types)) option(type, name, name);
for (const port of Object.keys(ports)) {
    const button = document.createElement("button");
    button.textContent = port;
    button.addEventListener("click", () => {
        const result = connect(station, selection, port, type.value);
        if (result.error) {
            message.textContent = result.error;
        } else {
            select(result.target);
            message.textContent = result.built ? `${type.value} attached through the ${port.toLowerCase()} port.` : "Loop closed with a new tube.";
        }
    });
    controls.append(button);
}

function select(index) {
    selection = index;
    selected.replaceChildren();
    station.modules.forEach(({ type: kind }, i) => option(selected, `${i + 1} · ${kind}`, i));
    selected.value = String(index);
    const tubes = station.modules.reduce((count, module) => count + module.links.length, 0) / 2;
    stats.textContent = `${station.modules.length} modules · ${tubes} tubes · ${crewCount()} crew`;
    while (crew.length < crewCount()) crew.push(createInhabitant(crew.length, index));
}

function crewCount() {
    return Math.min(24, station.modules.filter(module => module.type === "Habitat").length * 3);
}

selected.addEventListener("change", () => select(Number(selected.value)));
canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = [...hitboxes].reverse().find(box => Math.abs(box.x - x) <= box.width && Math.abs(box.y - y) <= box.height);
    if (hit) select(hit.index);
});
select(0);

const project = ([x, y, z]) => [(x - y) * 0.84, (x + y) * 0.43 - z];
const stars = Array.from({ length: 125 }, (_, i) => [(i * 137 % 1009) / 1009, (i * 251 % 1013) / 1013]);

function draw(now) {
    const elapsed = previousTime === undefined ? 0 : Math.min(100, now - previousTime);
    previousTime = now;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#8aa5b6";
    for (const [x, y] of stars) ctx.fillRect(x * width, y * height, 1.2, 1.2);
    const positions = station.modules.map(module => project(module.position));
    const xs = positions.map(point => point[0]);
    const ys = positions.map(point => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const scale = Math.min(104, (width - 32) / (maxX - minX + 1.25), (height - 32) / (maxY - minY + 1.25));
    const screen = ([x, y]) => [width / 2 + (x - (minX + maxX) / 2) * scale,
        height / 2 + (y - (minY + maxY) / 2) * scale];
    const layout = positions.map(screen);
    function line(from, to, color, thickness) {
        ctx.beginPath();
        ctx.moveTo(...from);
        ctx.lineTo(...to);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.stroke();
    }
    station.modules.forEach((module, i) => module.links.forEach(target => {
        if (target <= i) return;
        line(layout[i], layout[target], "#1b2935", scale * 0.24);
        line(layout[i], layout[target], "#668c99", scale * 0.16);
        line(layout[i], layout[target], "#b1ced2", scale * 0.036);
    }));
    hitboxes = [];
    const order = station.modules.map((module, index) => ({ module, index }))
        .sort((a, b) => a.module.position[0] + a.module.position[1] + a.module.position[2] -
            b.module.position[0] - b.module.position[1] - b.module.position[2]);
    for (const { module, index } of order) {
        const [x, y] = layout[index];
        const w = scale * 0.36;
        const h = scale * 0.22;
        ctx.fillStyle = "#293946";
        ctx.beginPath();
        ctx.roundRect(x - w, y - h * 0.6, w * 2, h * 2, h * 0.45);
        ctx.fill();
        ctx.fillStyle = types[module.type];
        ctx.beginPath();
        ctx.roundRect(x - w, y - h, w * 2, h * 1.55, h * 0.45);
        ctx.fill();
        ctx.strokeStyle = index === selection ? "#ffe5a8" : "#bdd0d1";
        ctx.lineWidth = index === selection ? 2.6 : 1;
        ctx.stroke();
        if (scale >= 30) {
            ctx.fillStyle = "#1d333a";
            ctx.font = `bold ${Math.max(10, scale * 0.13)}px system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(index + 1), x, y - h * 0.2);
        }
        hitboxes.push({ x, y, width: w, height: h * 1.4, index });
    }
    for (const [i, member] of crew.entries()) {
        const [centerX, centerY] = screen(project(walk(station, member, elapsed)));
        const x = centerX + (i % 3 - 1) * 5;
        const y = centerY + 6;
        const radius = Math.max(1.6, scale * 0.038);
        ctx.fillStyle = i % 2 === 0 ? "#fff0bf" : "#a2e3ff";
        ctx.fillRect(x - radius * 0.65, y, radius * 1.3, radius * 1.55);
        ctx.beginPath();
        ctx.arc(x, y - radius * 0.5, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#354b59";
        ctx.fillRect(x - radius * 0.72, y - radius * 0.64, radius * 1.44, radius * 0.46);
    }
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
