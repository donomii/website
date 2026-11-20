import { CONFIG, activeSiteCount, assaultDirection, canSelectInteraction, createGame, getInteractions, restartGame, stepGame, togglePause } from "./core.js";
import { workforceCounts } from "./expansion.js";
import { createControls } from "./controls.js";
import { createRenderer } from "./render.js";
import { COIN_FLIGHT_TIME } from "./purchases.js";
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
    purse: requireElement("purse-coin"),
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

const controls = createControls();

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
    bindPress(canvas, pressWorld);
    bindPress(ui.interaction, (event) => {
        const interaction = availableAction();
        return interaction !== null && controls.pressPurchase(event.pointerId, interaction.targetId);
    });
    ui.interaction.addEventListener("click", (event) => {
        const interaction = availableAction();
        if (event.detail === 0 && interaction !== null) {
            controls.tapPurchase(interaction.targetId);
        } else {
            return;
        }
    });
    window.addEventListener("blur", pauseOnFocusLoss);
    window.addEventListener("resize", () => renderer.resize());
    document.addEventListener("visibilitychange", pauseWhenHidden);
}

function bindPress(element, press) {
    element.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && press(event)) {
            element.setPointerCapture(event.pointerId);
            event.preventDefault();
        } else {
            return;
        }
    });
    element.addEventListener("pointerup", (event) => controls.release(event.pointerId));
    element.addEventListener("pointercancel", (event) => controls.release(event.pointerId, true));
    element.addEventListener("lostpointercapture", (event) => controls.release(event.pointerId, true));
}

function pressWorld(event) {
    if (state.status !== "playing" || state.player.reformTimer > 0) {
        return false;
    } else {
        const point = renderer.worldPoint(event.clientX, event.clientY);
        const interaction = actionAt(point);
        ui.options.open = false;
        return interaction !== null
            ? controls.pressPurchase(event.pointerId, interaction.targetId)
            : controls.pressRide(event.pointerId, Math.sign(point.x - state.player.x));
    }
}

function actionAt(point) {
    if (point.aboveTrail < -14 || point.aboveTrail > 204) {
        return null;
    } else {
        const candidates = getInteractions(state).filter(canSelectInteraction).filter((action) => {
            const target = renderer.landmarkBounds(state, action);
            return point.aboveTrail <= target.height + 12 && Math.abs(point.x - target.x) <= target.halfWidth;
        });
        candidates.sort((left, right) => Math.abs(left.x - point.x) - Math.abs(right.x - point.x));
        return candidates[0] ?? null;
    }
}

function availableAction() {
    if (state.status !== "playing") {
        return null;
    } else {
        const actions = getInteractions(state).filter(canSelectInteraction);
        const pending = actions.find((action) => action.targetId === state.purchase?.targetId);
        return pending ?? actions[0] ?? null;
    }
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
    const input = controls.read(state.player, elapsed);
    stepGame(state, input, elapsed);
    renderer.consumeEvents(state.events);
    sound.consumeEvents(state.events);
    if (state.player.reformTimer > 0 || state.status !== "playing") {
        controls.clear();
    } else {
        const finished = state.events.find((event) => event.type === "purchase-complete" || event.type === "purchase-cancelled");
        controls.finishFrame(finished?.targetId ?? null);
    }
    const purse = state.purchase === null ? null : ui.purse.getBoundingClientRect();
    renderer.render(state, elapsed, purse === null ? null : { x: purse.x + purse.width / 2, y: purse.y + purse.height / 2 });
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
        const coins = state.purchase?.targetId === interaction.targetId ? state.purchase.coins : [];
        const arrived = coins.filter((time) => state.time >= time + COIN_FLIGHT_TIME).length;
        ui.interactionCost.textContent = coins.length === 0
            ? `${interaction.cost} Dread` : `${arrived} / ${interaction.cost}`;
        ui.interaction.title = `Tap for one coin. Hold to keep paying. ${interaction.detail}`;
        ui.interaction.classList.toggle("cannot-afford", state.dread + coins.length < interaction.cost);
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
        if (state.dread + (state.purchase?.targetId === state.heart.id ? state.purchase.coins.length : 0) < CONFIG.finalRitualCost) {
            return "Gather more Dread for the final ritual";
        } else {
            return "Return to the central Heart and select the ritual";
        }
    }
}

function ratio(value, maximum) {
    return Math.min(1, Math.max(0, value / maximum));
}
