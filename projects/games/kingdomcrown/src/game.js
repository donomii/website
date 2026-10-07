import { CONFIG, activeSiteCount, createGame, getInteraction, restartGame, stepGame, togglePause } from "./core.js";
import { workforceCounts } from "./expansion.js";
import { createControls } from "./controls.js";
import { createRenderer } from "./render.js";
import { createSoundController } from "./sound.js";

const canvas = requireElement("world");
const renderer = createRenderer(canvas);
const sound = createSoundController(requireElement("sound-button"));
let state = createGame();
let helpReturnStatus = "title";
let lastFrame = performance.now();

const ui = Object.freeze({
    titleOverlay: requireElement("title-overlay"),
    helpOverlay: requireElement("help-overlay"),
    pauseOverlay: requireElement("pause-overlay"),
    endOverlay: requireElement("end-overlay"),
    dread: requireElement("dread-value"),
    veil: requireElement("veil-value"),
    veilMeter: requireElement("veil-meter"),
    stamina: requireElement("stamina-value"),
    staminaMeter: requireElement("stamina-meter"),
    heart: requireElement("heart-value"),
    heartMeter: requireElement("heart-meter"),
    broods: requireElement("brood-value"),
    wave: requireElement("wave-value"),
    attack: requireElement("attack-value"),
    acolytes: requireElement("acolyte-value"),
    objective: requireElement("objective"),
    notice: requireElement("notice"),
    interaction: requireElement("interaction"),
    interactionLabel: requireElement("interaction-label"),
    interactionCost: requireElement("interaction-cost"),
    endEyebrow: requireElement("end-eyebrow"),
    endTitle: requireElement("end-title"),
    endMessage: requireElement("end-message"),
    restartButton: requireElement("restart-button"),
});

const controls = createControls(window, document.querySelectorAll("[data-action]"), {
    isPlaying: () => state.status === "playing",
    onSpecialKey: handleSpecialKey,
    onBlur: pauseOnFocusLoss,
    onTouch: () => sound.ensure(),
});

bindControls();
updateUi();
renderer.render(state, 0);
requestAnimationFrame(animationFrame);

function requireElement(id) {
    const element = document.getElementById(id);
    if (element === null) {
        throw new Error(`The game expected page element '#${id}', but it was not found while starting the interface.`);
    } else {
        return element;
    }
}

function bindControls() {
    requireElement("start-button").addEventListener("click", startGame);
    requireElement("restart-button").addEventListener("click", restartCurrentGame);
    requireElement("pause-button").addEventListener("click", changePause);
    requireElement("resume-button").addEventListener("click", changePause);
    requireElement("help-button").addEventListener("click", openHelp);
    requireElement("title-help-button").addEventListener("click", openHelp);
    requireElement("pause-help-button").addEventListener("click", openHelp);
    requireElement("close-help-button").addEventListener("click", closeHelp);
    requireElement("sound-button").addEventListener("click", () => sound.toggle());
    window.addEventListener("resize", () => renderer.resize());
    document.addEventListener("visibilitychange", pauseWhenHidden);
}

function handleSpecialKey(event) {
    if (event.repeat) {
        event.preventDefault();
        return;
    } else {
        performSpecialKey(event);
    }
}

function performSpecialKey(event) {
    switch (event.code) {
        case "Escape":
        case "KeyP":
            event.preventDefault();
            if (ui.helpOverlay.classList.contains("is-hidden")) {
                changePause();
            } else {
                closeHelp();
            }
            break;
        case "Enter":
            event.preventDefault();
            handleEnter();
            break;
        default:
            return;
    }
}

function handleEnter() {
    switch (state.status) {
        case "title":
            startGame();
            break;
        case "paused":
            if (ui.helpOverlay.classList.contains("is-hidden")) {
                changePause();
            } else {
                closeHelp();
            }
            break;
        case "victory":
        case "defeat":
            restartCurrentGame();
            break;
        default:
            return;
    }
}

function startGame() {
    sound.ensure();
    controls.clear();
    state.status = "playing";
    ui.titleOverlay.classList.add("is-hidden");
    ui.endOverlay.classList.add("is-hidden");
    ui.pauseOverlay.classList.add("is-hidden");
    lastFrame = performance.now();
}

function restartCurrentGame() {
    state = restartGame();
    state.status = "playing";
    controls.clear();
    renderer.cameraX = CONFIG.playerStartX;
    ui.endOverlay.classList.add("is-hidden");
    ui.titleOverlay.classList.add("is-hidden");
    ui.pauseOverlay.classList.add("is-hidden");
    sound.ensure();
    lastFrame = performance.now();
}

function changePause() {
    controls.clear();
    togglePause(state);
    if (state.status === "paused") {
        ui.pauseOverlay.classList.remove("is-hidden");
    } else {
        ui.pauseOverlay.classList.add("is-hidden");
        lastFrame = performance.now();
    }
}

function openHelp() {
    controls.clear();
    helpReturnStatus = state.status;
    state.status = state.status === "playing" ? "paused" : state.status;
    ui.helpOverlay.classList.remove("is-hidden");
}

function closeHelp() {
    controls.clear();
    ui.helpOverlay.classList.add("is-hidden");
    state.status = helpReturnStatus;
    if (state.status === "paused") {
        ui.pauseOverlay.classList.remove("is-hidden");
    } else {
        ui.pauseOverlay.classList.add("is-hidden");
        lastFrame = performance.now();
    }
}

function pauseWhenHidden() {
    if (document.hidden) {
        pauseOnFocusLoss();
    } else {
        return;
    }
}

function pauseOnFocusLoss() {
    controls.clear();
    if (state.status === "playing") {
        changePause();
    } else {
        return;
    }
}

function animationFrame(now) {
    const elapsed = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const input = controls.read();
    stepGame(state, input, elapsed);
    renderer.consumeEvents(state.events);
    sound.consumeEvents(state.events);
    renderer.render(state, elapsed);
    updateUi();
    controls.finishFrame();
    requestAnimationFrame(animationFrame);
}

function updateUi() {
    const player = state.player;
    const workforce = workforceCounts(state);
    ui.dread.textContent = String(state.dread);
    ui.veil.textContent = String(Math.ceil(player.veil));
    ui.stamina.textContent = String(Math.ceil(player.stamina));
    ui.heart.textContent = String(Math.ceil(state.heart.hp));
    ui.veilMeter.style.transform = `scaleX(${ratio(player.veil, player.maxVeil)})`;
    ui.staminaMeter.style.transform = `scaleX(${ratio(player.stamina, player.maxStamina)})`;
    ui.staminaMeter.classList.toggle("is-exhausted", player.exhausted);
    ui.heartMeter.style.transform = `scaleX(${ratio(state.heart.hp, state.heart.maxHp)})`;
    ui.broods.textContent = `${activeSiteCount(state)} / ${state.sites.length}`;
    ui.wave.textContent = `${state.wave} · ${Math.max(0, Math.ceil(state.waveTimer))}s`;
    ui.attack.textContent = player.attackCooldown === 0 ? "Ready" : `${player.attackCooldown.toFixed(1)}s`;
    ui.acolytes.textContent = `${workforce.free} free · ${workforce.staffed} working`;
    ui.objective.textContent = objectiveText();
    updateNotice();
    updateInteraction();
    updateOverlays();
}

function updateNotice() {
    const visible = state.notice.ttl > 0 && state.notice.text.length > 0;
    if (visible) {
        ui.notice.textContent = state.notice.text;
        ui.notice.classList.remove("is-hidden");
    } else {
        ui.notice.classList.add("is-hidden");
    }
}

function updateInteraction() {
    const interaction = state.status === "playing" ? getInteraction(state) : null;
    if (interaction === null) {
        ui.interaction.classList.add("is-hidden");
    } else {
        ui.interactionLabel.textContent = interaction.label;
        ui.interactionCost.textContent = interaction.cost > 0 ? `${interaction.cost} Dread` : interaction.action === "maxed" ? "Complete" : "Locked";
        ui.interaction.title = interaction.detail;
        ui.interaction.classList.toggle("cannot-afford", !interaction.affordable);
        ui.interaction.classList.remove("is-hidden");
    }
}

function updateOverlays() {
    switch (state.status) {
        case "victory":
            showEnd("THE EARTH OPENS", "The Sleeper Rises", `All ${state.sites.length} Broods answered. The human crown is a small and temporary thing.`, "Haunt again");
            break;
        case "defeat":
            showEnd("THE TORCHES REACH THE HEART", "The Haunting Ends", `The Heart fell during assault ${state.wave}. What was buried can be buried again.`, "Rise again");
            break;
        case "paused":
            if (ui.helpOverlay.classList.contains("is-hidden")) {
                ui.pauseOverlay.classList.remove("is-hidden");
            } else {
                ui.pauseOverlay.classList.add("is-hidden");
            }
            ui.endOverlay.classList.add("is-hidden");
            break;
        default:
            ui.pauseOverlay.classList.add("is-hidden");
            ui.endOverlay.classList.add("is-hidden");
            break;
    }
}

function showEnd(eyebrow, title, message, buttonLabel) {
    controls.clear();
    ui.endEyebrow.textContent = eyebrow;
    ui.endTitle.textContent = title;
    ui.endMessage.textContent = message;
    ui.restartButton.textContent = buttonLabel;
    ui.endOverlay.classList.remove("is-hidden");
}

function objectiveText() {
    const dormant = state.sites.length - activeSiteCount(state);
    if (dormant > 0) {
        return `Awaken ${dormant} remaining Brood${dormant === 1 ? "" : "s"}`;
    } else {
        if (state.dread < CONFIG.finalRitualCost) {
            return `Gather ${CONFIG.finalRitualCost - state.dread} more Dread for the final ritual`;
        } else {
            return "Return to the central Heart and press E";
        }
    }
}

function ratio(value, maximum) {
    return Math.min(1, Math.max(0, value / maximum));
}
