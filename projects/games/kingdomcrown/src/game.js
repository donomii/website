import { CONFIG, activeSiteCount, assaultDirection, canSelectInteraction, createGame, getInteractions, restartGame, stepGame, togglePause } from "./core.js";
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
    options: requireElement("options"),
    hud: requireElement("hud"),
    menuStatus: requireElement("menu-status"),
    pauseButton: requireElement("pause-button"),
    dread: requireElement("dread-value"),
    veil: requireElement("veil-value"),
    veilMeter: requireElement("veil-meter"),
    stamina: requireElement("stamina-value"),
    staminaMeter: requireElement("stamina-meter"),
    heart: requireElement("heart-value"),
    broods: requireElement("brood-value"),
    wave: requireElement("wave-value"),
    acolytes: requireElement("acolyte-value"),
    objective: requireElement("objective"),
    notice: requireElement("notice"),
    interaction: requireElement("interaction"),
    interactionLabel: requireElement("interaction-label"),
    interactionCost: requireElement("interaction-cost"),
    endTitle: requireElement("end-title"),
    endMessage: requireElement("end-message"),
    restartButton: requireElement("restart-button"),
});

const controls = createControls(CONFIG.worldWidth);

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
    ui.pauseButton.addEventListener("click", changePause);
    requireElement("resume-button").addEventListener("click", changePause);
    requireElement("help-button").addEventListener("click", openHelp);
    requireElement("pause-help-button").addEventListener("click", openHelp);
    requireElement("close-help-button").addEventListener("click", closeHelp);
    requireElement("sound-button").addEventListener("click", () => sound.toggle());
    canvas.addEventListener("click", selectWorldPoint);
    ui.interaction.addEventListener("click", selectNearbyAction);
    window.addEventListener("blur", pauseOnFocusLoss);
    window.addEventListener("resize", () => renderer.resize());
    document.addEventListener("visibilitychange", pauseWhenHidden);
}

function selectWorldPoint(event) {
    if (state.status !== "playing" || state.player.reformTimer > 0) {
        return;
    } else {
        const point = renderer.worldPoint(event.clientX, event.clientY);
        const interaction = actionAt(point);
        if (interaction !== null) {
            controls.interactWith(interaction.targetId);
        } else {
            controls.rideTo(point.x);
        }
        ui.options.open = false;
    }
}

function actionAt(point) {
    if (point.onMap || point.aboveTrail < -24 || point.aboveTrail > 200) {
        return null;
    } else {
        const candidates = getInteractions(state).filter(canSelectInteraction).filter((action) => {
            const reach = action.kind === "heart" ? 118 : 45;
            return Math.abs(point.x - action.x) <= reach;
        });
        candidates.sort((left, right) => Math.abs(left.x - point.x) - Math.abs(right.x - point.x));
        return candidates[0] ?? null;
    }
}

function selectNearbyAction() {
    const interaction = availableAction();
    if (interaction !== null) {
        controls.interactWith(interaction.targetId);
    } else {
        return;
    }
}

function availableAction() {
    return state.status === "playing" ? getInteractions(state).find(canSelectInteraction) ?? null : null;
}

function startGame() {
    sound.ensure();
    controls.clear();
    state.status = "playing";
    ui.options.open = false;
    ui.titleOverlay.classList.add("is-hidden");
    ui.hud.classList.remove("is-hidden");
    ui.menuStatus.classList.remove("is-hidden");
    ui.pauseButton.hidden = false;
    ui.endOverlay.classList.add("is-hidden");
    ui.pauseOverlay.classList.add("is-hidden");
    lastFrame = performance.now();
}

function restartCurrentGame() {
    state = restartGame();
    renderer.reset();
    startGame();
}

function changePause() {
    controls.clear();
    ui.options.open = false;
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
    ui.options.open = false;
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
    const input = controls.read(state.player);
    stepGame(state, input, elapsed);
    renderer.consumeEvents(state.events);
    sound.consumeEvents(state.events);
    if (state.player.reformTimer > 0 || state.status !== "playing") {
        controls.clear();
    } else {
        controls.finishFrame();
    }
    renderer.render(state, elapsed, controls.destination);
    updateUi();
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
    ui.broods.textContent = `${activeSiteCount(state)} / ${state.sites.length}`;
    ui.wave.textContent = state.ritualStarted
        ? state.siegeReserveTimer === null ? `${state.humans.length} left` : `Reserve · ${Math.ceil(state.siegeReserveTimer)}s`
        : `${assaultDirection(state.wave + 1)} · ${Math.max(0, Math.ceil(state.waveTimer))}s`;
    ui.wave.classList.toggle("raid-warning", state.waveWarning || state.ritualStarted);
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
    const interaction = availableAction();
    if (interaction === null) {
        ui.interaction.classList.add("is-hidden");
    } else {
        ui.interactionLabel.textContent = interaction.label;
        ui.interactionCost.textContent = `${interaction.cost} Dread`;
        ui.interaction.title = interaction.detail;
        ui.interaction.classList.toggle("cannot-afford", !interaction.affordable);
        ui.interaction.classList.remove("is-hidden");
    }
}

function updateOverlays() {
    switch (state.status) {
        case "victory":
            showEnd("Siege repelled", `The Heart held with ${Math.ceil(state.heart.hp)} health.`, "Play again");
            break;
        case "defeat":
            showEnd("The Heart fell", state.ritualStarted ? "The final siege broke your defenses." : `Your defenses fell during raid ${state.wave}.`, "Try again");
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

function showEnd(title, message, buttonLabel) {
    controls.clear();
    ui.endOverlay.dataset.outcome = state.status;
    ui.endTitle.textContent = title;
    ui.endMessage.textContent = message;
    ui.restartButton.textContent = buttonLabel;
    ui.endOverlay.classList.remove("is-hidden");
}

function objectiveText() {
    const dormant = state.sites.length - activeSiteCount(state);
    if (state.ritualStarted) {
        return "Defend the Heart until every crusader falls";
    } else if (dormant > 0) {
        return `Awaken ${dormant} remaining Brood${dormant === 1 ? "" : "s"}`;
    } else {
        if (state.dread < CONFIG.finalRitualCost) {
            return `Gather ${CONFIG.finalRitualCost - state.dread} more Dread for the final ritual`;
        } else {
            return "Return to the central Heart and select the ritual";
        }
    }
}

function ratio(value, maximum) {
    return Math.min(1, Math.max(0, value / maximum));
}
