import { createWorld, height, placeBlock, spawn, species, stepWorld, width } from "./aquarium.mjs";

const canvas = document.querySelector("#tank");
const ctx = canvas.getContext("2d");
const tool = document.querySelector("#tool");
const stats = document.querySelector("#stats");
const result = document.querySelector("#result");
const pause = document.querySelector("#pause");
const step = document.querySelector("#step");
let world = createWorld();
let paused = false;

function render() {
    const ratio = Math.min(devicePixelRatio, 2);
    const w = Math.round(canvas.clientWidth * ratio);
    const h = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
    ctx.fillStyle = "#163139";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#244751";
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) ctx.fillRect(x + 0.46, y + 0.46, 0.075, 0.075);
    }
    for (const cell of world.blocks) {
        const x = cell % width;
        const y = Math.floor(cell / width);
        ctx.fillStyle = "#4b6974";
        ctx.fillRect(x + 0.06, y + 0.08, 0.88, 0.84);
        ctx.fillStyle = "#76919a";
        ctx.fillRect(x + 0.13, y + 0.16, 0.74, 0.15);
    }
    for (const agent of world.agents) {
        const x = agent.x + 0.5;
        const y = agent.y + 0.5;
        ctx.globalAlpha = agent.stun ? 0.5 : 1;
        ctx.fillStyle = species[agent.type];
        ctx.beginPath();
        if (agent.type === "hunter") {
            ctx.moveTo(x, y - 0.43);
            ctx.lineTo(x + 0.4, y + 0.34);
            ctx.lineTo(x - 0.4, y + 0.34);
            ctx.closePath();
        } else if (agent.type === "breaker") {
            ctx.rect(x - 0.32, y - 0.32, 0.64, 0.64);
        } else {
            ctx.arc(x, y, 0.35, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = "#122932";
        ctx.fillRect(x - 0.17, y - 0.02, 0.12, 0.11);
        ctx.fillRect(x + 0.05, y - 0.02, 0.12, 0.11);
    }
    ctx.globalAlpha = 1;
    stats.textContent = `Tick ${world.tick} · ${world.agents.length} creatures · ${world.built} built · ${world.broken} broken · ${world.caught} caught`;
}

function place(x, y) {
    return tool.value === "block" ? placeBlock(world, x, y) : spawn(world, tool.value, x, y);
}

canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * width / rect.width);
    const y = Math.floor((event.clientY - rect.top) * height / rect.height);
    result.textContent = place(x, y) ? `Placed ${tool.value}.` : "That cell is occupied or the tank is full.";
    render();
});
document.querySelector("#add").addEventListener("click", () => {
    for (let cell = 0; cell < width * height; cell++) {
        const offset = (cell + world.tick * 17 + 239) % (width * height);
        if (place(offset % width, Math.floor(offset / width))) {
            result.textContent = `Placed ${tool.value}.`;
            render();
            return;
        }
    }
    result.textContent = "There is no room for this creature or wall.";
});
pause.addEventListener("click", () => {
    paused = !paused;
    pause.textContent = paused ? "Resume" : "Pause";
    step.disabled = !paused;
});
step.addEventListener("click", () => { stepWorld(world); render(); });
document.querySelector("#reset").addEventListener("click", () => {
    world = createWorld();
    result.textContent = "Tank reset.";
    render();
});
window.addEventListener("resize", render);
setInterval(() => { if (!paused) { stepWorld(world); render(); } }, 230);
render();
