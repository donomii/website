import { drawCreature, drawFootShadow, drawLocalLight } from "./foreground-art.js";
import { drawPaintedSteed } from "./steed-rig.js";

const DREAD_COLOR = "#7df6dc";

export const HUMAN_HEIGHT = Object.freeze({ soldier: 78, archer: 78, torchbearer: 90 });
export const HORROR_HEIGHT = Object.freeze({ crawler: 51, brute: 94 });

export function drawHorrorActor(context, horror, ground, visualTime, lunge) {
    drawWalkingActor(context, horror, horror.type, ground, visualTime, HORROR_HEIGHT[horror.type], lunge);
}

export function drawHumanActor(context, human, ground, visualTime, lunge) {
    if (human.type === "torchbearer") {
        const pulse = Math.sin(visualTime * 19 + actorOffset(human.id)) * 0.05;
        const torchX = human.x + lunge + human.facing * 23;
        drawLocalLight(context, torchX, ground - 75, 39, "255, 148, 63", 0.23 + pulse);
        drawLocalLight(context, human.x, ground, 30, "232, 141, 62", 0.11 + pulse);
    } else {
        drawFootShadow(context, human.x, ground, 18);
    }
    drawWalkingActor(context, human, human.type, ground, visualTime, HUMAN_HEIGHT[human.type], lunge);
}

export function drawWalkingActor(context, actor, sprite, ground, visualTime, height, lunge = 0) {
    const travel = Math.min(1, Math.abs(actor.vx) / 50);
    const phase = visualTime * 11 + actorOffset(actor.id);
    const stride = Math.sin(phase) * travel;
    const sway = Math.sin(visualTime * 3 + actorOffset(actor.id)) * 0.008 + stride * 0.02;
    context.save();
    context.translate(actor.x + lunge, ground);
    context.transform(actor.facing, 0, sway, 1 + sway * 0.2, 0, 0);
    context.globalAlpha = actor.hitFlash > 0 ? 0.58 : 1;
    drawCreature(context, sprite, height, stride);
    context.restore();
}

export function drawMountedPlayer(context, player, ground, visualTime) {
    drawFootShadow(context, player.x, ground, 52);
    context.save();
    context.translate(player.x, ground);
    context.scale(player.facing, 1);
    context.globalAlpha = player.invulnerable > 0 && Math.floor(visualTime * 14) % 2 === 0 ? 0.48 : 1;
    drawPaintedSteed(context, player, visualTime);
    context.restore();
}

export function drawReformingHerald(context, state, ground, visualTime) {
    const progress = 1 - state.player.reformTimer / 3.4;
    context.save();
    context.globalAlpha = 0.25 + progress * 0.5;
    context.strokeStyle = DREAD_COLOR;
    context.lineWidth = 2;
    for (let arc = 0; arc < 5; arc += 1) {
        context.beginPath();
        context.arc(state.heart.x, ground - 55, 22 + arc * 11 + progress * 16, visualTime + arc, visualTime + arc + Math.PI * 1.2);
        context.stroke();
    }
    context.restore();
}

function actorOffset(id) {
    const match = /([0-9]+)$/.exec(id);
    return match === null ? 0 : Number(match[1]);
}
