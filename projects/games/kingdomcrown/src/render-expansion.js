import { EXPANSION_CONFIG } from "./expansion.js";
import { drawCreature, drawFootShadow, drawLandmark, drawLocalLight, drawSelectionHalo } from "./foreground-art.js";
import { drawWalkingActor } from "./render-actors.js";

const DREAD = "#7df6dc";
const BONE = "#d8c7a2";
const VACANT = "#c8605a";
const ACOLYTE_HEIGHT = 76;
const STRUCTURE_HEIGHT = Object.freeze({ pasture: 51, spire: 94, barricade: 65, charnel: 86 });
const FOUNDATION_LIGHT = Object.freeze({
    pasture: "152, 172, 118",
    spire: "114, 218, 192",
    barricade: "224, 182, 113",
    charnel: "169, 135, 210",
});

export function drawOutcastFire(context, camp, ground, visualTime, selected) {
    const pulse = Math.sin(visualTime * 13 + camp.x) * 0.08;
    drawLocalLight(context, camp.x, ground - 11, 69, "245, 149, 73", 0.28 + pulse);
    if (selected) {
        drawSelectionHalo(context, camp.x - 8, ground, 50);
    } else {
        drawFootShadow(context, camp.x, ground, 38);
    }

    context.save();
    context.translate(camp.x, ground);
    drawLandmark(context, "fire", 41);

    if (camp.available) {
        context.translate(-36, 0);
        context.scale(-1, 1 + Math.sin(visualTime * 2 + camp.x) * 0.01);
        context.filter = "saturate(0.7) brightness(0.82)";
        drawCreature(context, "acolyte", ACOLYTE_HEIGHT - 6);
    } else {
        drawLocalLight(context, -22, -8, 25, "171, 103, 56", 0.12);
    }
    context.restore();
}

export function drawFixedStructure(context, structure, ground, visualTime, selected, staffed) {
    const { x, level, type } = structure;
    const height = structureHeight(structure);
    if (selected) {
        drawSelectionHalo(context, x, ground, 42 + level * 6);
    } else {
        drawFootShadow(context, x, ground, 27 + level * 9);
    }

    const glow = level === 0 ? 0.16 : staffed ? 0.16 + Math.sin(visualTime * 2.7 + x) * 0.04 : 0.09;
    drawLocalLight(context, x, ground - height * 0.64, Math.max(19, height * 0.58), FOUNDATION_LIGHT[type], glow);

    context.save();
    context.translate(x, ground);
    context.globalAlpha = structure.hitFlash > 0 ? 0.65 : 1;
    drawLandmark(context, level === 0 ? "foundation" : type, height);
    context.restore();

    if (level > 0) {
        drawStaffingMark(context, structure, ground, height, staffed);
        drawStructureHealth(context, structure, ground - height - 7);
    } else {
        drawLocalLight(context, x, ground - 8, 10, FOUNDATION_LIGHT[type], 0.34);
    }
}

export function structureHeight(structure) {
    return structure.level === 0 ? 13 : STRUCTURE_HEIGHT[structure.type] + (structure.level - 1) * 14;
}

function drawStaffingMark(context, structure, ground, height, staffed) {
    const x = structure.x + (structure.type === "spire" ? 21 : 32);
    const y = ground - height * 0.62;
    const assigned = structure.workerId !== null;
    const color = staffed ? DREAD : assigned ? "#e6bd6b" : VACANT;
    context.strokeStyle = "rgba(18, 24, 27, 0.9)";
    context.fillStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, 3, 0, Math.PI * 2);
    context.fill();
    context.stroke();
}

function drawStructureHealth(context, structure, y) {
    if (structure.hp >= structure.maxHp) {
        return;
    } else {
        const width = structure.type === "barricade" ? 72 : 58;
        const ratio = Math.max(0, Math.min(1, structure.hp / structure.maxHp));
        context.fillStyle = "rgba(3, 8, 10, 0.75)";
        context.fillRect(structure.x - width / 2 - 1, y - 1, width + 2, 5);
        context.fillStyle = structure.type === "barricade" ? BONE : DREAD;
        context.fillRect(structure.x - width / 2, y, width * ratio, 3);
    }
}

export function drawAcolyteActor(context, acolyte, ground, visualTime) {
    const lanternX = acolyte.x + acolyte.facing * 23;
    drawLocalLight(context, lanternX, ground - 28, 24, "110, 221, 201", 0.17);
    drawWalkingActor(context, acolyte, "acolyte", ground, visualTime, ACOLYTE_HEIGHT);

    if (acolyte.hp >= acolyte.maxHp) {
        return;
    } else {
        const ratio = Math.max(0, Math.min(1, acolyte.hp / acolyte.maxHp));
        const y = ground - ACOLYTE_HEIGHT - 5;
        context.fillStyle = "rgba(3, 8, 10, 0.75)";
        context.fillRect(acolyte.x - 17, y - 1, 34, 5);
        context.fillStyle = DREAD;
        context.fillRect(acolyte.x - 16, y, 32 * ratio, 3);
    }
}

export function drawCorpse(context, corpse, ground, visualTime) {
    const decay = Math.max(0, 1 - corpse.decayTimer / EXPANSION_CONFIG.corpseDecayTime);
    context.save();
    context.translate(corpse.x - 27, ground - 3);
    context.rotate(Math.PI * 0.47);
    context.globalAlpha = 0.85 - decay * 0.45;
    drawCreature(context, "soldier", 54);
    context.restore();

    const shimmer = Math.sin(visualTime * 4 + corpse.phase) * 0.07;
    drawLocalLight(context, corpse.x, ground - 8, 23, "118, 247, 210", decay * (0.4 + shimmer));
}
