import { act, advance, islands, seedPrice } from "./game.mjs";
import { loadGame, saveGame } from "./state.mjs";

const chart = document.querySelector("#chart");
const stats = document.querySelector("#stats");
const selected = document.querySelector("#selected");
const actions = document.querySelector("#actions");
const message = document.querySelector("#message");
let index = 0;
let clock = Date.now();
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const loaded = loadGame(storage, clock);
let game = loaded.game;
let saveEnabled = loaded.saveEnabled;

chart.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <path d="M25 67L52 30L79 63L25 67" fill="none" stroke="#79a5ab" stroke-width=".32" stroke-dasharray="1 1"/>
  <path d="M8 25h.2m12 14h.2m10-23h.2m38 1h.2m8 17h.2m13 7h.2m-22 40h.2m-19-8h.2m-30 9h.2"
    fill="none" stroke="#c8d8d3" stroke-width=".55" stroke-linecap="round"/></svg>`;
const rocks = islands.map((island, i) => {
    const button = document.createElement("button");
    button.className = "rock";
    button.style.left = `${island.x}%`;
    button.style.top = `${island.y}%`;
    const title = document.createElement("strong");
    title.textContent = island.name;
    const label = document.createElement("small");
    button.append(title, label);
    button.addEventListener("click", () => { index = i; render(); });
    chart.append(button);
    return { button, label };
});

function save() {
    if (!saveEnabled) return;
    try {
        saveGame(storage, game, clock);
    } catch {
        // The game can continue for the current tab without storage.
        saveEnabled = false;
        game.message = "Outpost could not be saved. This session will play without saving.";
    }
}

function render() {
    stats.textContent = `${game.credits} credits · ${game.fleet} patrol ships · ${game.rivalHull ? `Rival raid in ${game.raidIn}s` : "Archipelago secured"}`;
    for (const [i, { button, label }] of rocks.entries()) {
        const owner = game.farms[i].owner;
        button.dataset.owner = owner;
        button.setAttribute("aria-pressed", String(i === index));
        label.textContent = owner ? "Owned farm" : i === 1 ? "Unsettled" : `Rival · ${game.rivalHull} hull`;
    }
    const farm = game.farms[index];
    selected.textContent = islands[index].name;
    const unused = new Map([...actions.children].map(control => [control.dataset.order, control]));
    function button(text, command, plot, disabled = false) {
        const order = plot === undefined ? command : `plot-${plot}`;
        let control = unused.get(order);
        if (control) {
            unused.delete(order);
        } else {
            control = document.createElement("button");
            control.dataset.order = order;
            control.addEventListener("click", () => {
                game.message = act(game, index, control.dataset.command, plot);
                save();
                render();
            });
            actions.append(control);
        }
        if (control.textContent !== text) control.textContent = text;
        control.disabled = disabled;
        control.dataset.command = command;
    }
    if (farm.owner) {
        farm.plots.forEach((remaining, plot) => {
            const label = `Plot ${plot + 1}`;
            if (remaining === null) button(`${label}: plant · ${seedPrice(game) ? "1 cr" : "emergency seed"}`, "plant", plot);
            else if (remaining === 0) button(`${label}: harvest · +4 cr`, "harvest", plot);
            else button(`${label}: growing ${remaining}s`, "grow", plot, true);
        });
        button(farm.depot ? "Depot active" : "Build auto-harvest depot · 7 cr", "depot", undefined, farm.depot);
        button(`Build turret · 5 cr (${farm.turret}/3)`, "turret", undefined, farm.turret >= 3);
        button("Build patrol ship · 4 cr", "fleet");
    } else if (index === 1) {
        button("Settle Cinder Shoal · 8 cr", "colony");
    } else {
        button("Raid Redoubt · 3 damage per ship, lose 1 ship", "attack");
    }
    for (const control of unused.values()) control.remove();
    if (message.textContent !== game.message) message.textContent = game.message;
}

render();
save();
setInterval(() => {
    const now = Date.now();
    const elapsed = Math.floor((now - clock) / 1000);
    if (elapsed < 1) return;
    clock += elapsed * 1000;
    advance(game, elapsed, elapsed > 4 || document.hidden);
    save();
    render();
}, 1000);
