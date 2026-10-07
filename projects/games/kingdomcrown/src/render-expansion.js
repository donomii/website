import { EXPANSION_CONFIG } from "./expansion.js";

const DREAD = "#7df6dc";
const BONE = "#d8c7a2";
const EMBER = "#e58b45";
const VACANT = "#c8605a";

export function drawOutcastFire(context, camp, ground, visualTime, selected) {
    context.save();
    context.translate(camp.x, ground);
    context.strokeStyle = selected ? DREAD : "rgba(133, 150, 132, 0.42)";
    context.lineWidth = selected ? 2.5 : 1.5;
    context.beginPath();
    context.ellipse(0, 1, 35, 8, 0, 0, Math.PI * 2);
    context.stroke();
    drawFire(context, visualTime, camp.id);
    if (camp.available) {
        drawOutcast(context, visualTime);
    } else {
        drawEmptyCamp(context);
    }
    context.restore();
}

export function drawFixedStructure(context, structure, ground, visualTime, selected, staffed) {
    context.save();
    context.translate(structure.x, ground);
    drawFoundationRing(context, structure, selected);
    if (structure.level === 0) {
        drawFoundation(context, structure.type);
    } else {
        context.globalAlpha = structure.hitFlash > 0 ? 0.58 : 1;
        drawBuiltStructure(context, structure, visualTime);
        drawStaffingMark(context, structure, staffed, visualTime);
    }
    context.restore();
    drawStructureHealth(context, structure, ground);
}

export function drawAcolyteActor(context, acolyte, ground, visualTime, role) {
    const bob = Math.sin(visualTime * 5.5 + numericId(acolyte.id)) * (Math.abs(acolyte.vx) > 2 ? 2 : 0.6);
    context.save();
    context.translate(acolyte.x, ground + bob);
    context.scale(acolyte.facing, 1);
    context.globalAlpha = acolyte.hitFlash > 0 ? 0.55 : 1;
    drawAcolyteBody(context);
    drawRoleEquipment(context, role);
    context.restore();
    drawAcolyteHealth(context, acolyte, ground);
}

export function drawCorpse(context, corpse, ground, visualTime) {
    const glow = Math.max(0, 1 - corpse.decayTimer / EXPANSION_CONFIG.corpseDecayTime);
    context.save();
    context.translate(corpse.x, ground);
    context.strokeStyle = "rgba(117, 104, 90, 0.72)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-14, -3);
    context.lineTo(8, -7);
    context.moveTo(-4, -5);
    context.lineTo(-14, -17);
    context.moveTo(2, -6);
    context.lineTo(15, -16);
    context.stroke();
    context.fillStyle = "#a99479";
    context.beginPath();
    context.arc(-17, -3, 6, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.3 + glow * 0.55;
    context.strokeStyle = DREAD;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, -11, 9 + Math.sin(visualTime * 4 + corpse.phase) * 2, 0, Math.PI * 2);
    context.stroke();
    context.restore();
}

function drawFire(context, visualTime, id) {
    const flicker = Math.sin(visualTime * 8 + numericId(id)) * 3;
    context.strokeStyle = "#392b22";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-12, 0);
    context.lineTo(13, -7);
    context.moveTo(-13, -7);
    context.lineTo(12, 0);
    context.stroke();
    context.fillStyle = EMBER;
    context.beginPath();
    context.moveTo(0, -5);
    context.quadraticCurveTo(-14, -22, -2, -32 - flicker);
    context.quadraticCurveTo(15, -20, 0, -5);
    context.fill();
    context.fillStyle = "#f2c768";
    context.beginPath();
    context.moveTo(0, -7);
    context.quadraticCurveTo(-6, -17, 2, -23 + flicker * 0.4);
    context.quadraticCurveTo(8, -16, 0, -7);
    context.fill();
}

function drawOutcast(context, visualTime) {
    const sway = Math.sin(visualTime * 1.7) * 1.5;
    context.save();
    context.translate(-25 + sway, 0);
    context.fillStyle = "#27272a";
    context.beginPath();
    context.moveTo(-8, -3);
    context.lineTo(-5, -39);
    context.quadraticCurveTo(0, -50, 7, -38);
    context.lineTo(11, -3);
    context.closePath();
    context.fill();
    context.fillStyle = "#c0aa89";
    context.beginPath();
    context.arc(1, -45, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
}

function drawEmptyCamp(context) {
    context.strokeStyle = "rgba(141, 129, 107, 0.55)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-31, 0);
    context.lineTo(-27, -18);
    context.lineTo(-20, -2);
    context.stroke();
}

function drawFoundationRing(context, structure, selected) {
    const colors = {
        pasture: "rgba(119, 142, 105, 0.55)",
        spire: "rgba(108, 177, 166, 0.55)",
        barricade: "rgba(177, 160, 126, 0.55)",
        charnel: "rgba(152, 100, 105, 0.55)",
    };
    context.strokeStyle = selected ? DREAD : colors[structure.type];
    context.lineWidth = selected ? 3 : 1.5;
    context.beginPath();
    context.ellipse(0, 1, structure.type === "barricade" ? 45 : 38, 9, 0, 0, Math.PI * 2);
    context.stroke();
}

function drawFoundation(context, type) {
    context.fillStyle = "#14201f";
    for (const x of [-23, -8, 8, 23]) {
        context.beginPath();
        context.ellipse(x, -3, 7, 4, -0.2, 0, Math.PI * 2);
        context.fill();
    }
    context.strokeStyle = "rgba(120, 191, 170, 0.38)";
    context.lineWidth = 1.5;
    context.beginPath();
    switch (type) {
        case "pasture":
            context.arc(0, -8, 12, Math.PI, Math.PI * 2);
            context.moveTo(-12, -8);
            context.lineTo(12, -8);
            break;
        case "spire":
            context.moveTo(0, -28);
            context.lineTo(-9, -5);
            context.lineTo(9, -5);
            context.closePath();
            break;
        case "barricade":
            context.moveTo(-20, -4);
            context.quadraticCurveTo(-10, -26, 0, -4);
            context.quadraticCurveTo(10, -26, 20, -4);
            break;
        case "charnel":
            context.arc(0, -7, 11, 0, Math.PI * 2);
            context.moveTo(-8, -15);
            context.lineTo(8, 1);
            break;
        default:
            throw new Error(`Unknown structure type '${type}' while drawing a foundation.`);
    }
    context.stroke();
}

function drawBuiltStructure(context, structure, visualTime) {
    switch (structure.type) {
        case "pasture":
            drawPasture(context, structure, visualTime);
            break;
        case "spire":
            drawSpire(context, structure, visualTime);
            break;
        case "barricade":
            drawBarricade(context, structure);
            break;
        case "charnel":
            drawCharnelYard(context, structure, visualTime);
            break;
        default:
            throw new Error(`Unknown structure type '${structure.type}' while drawing a built structure.`);
    }
}

function drawPasture(context, structure, visualTime) {
    context.strokeStyle = "#0a1516";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-34, -2);
    context.quadraticCurveTo(-22, -25, -8, -6);
    context.moveTo(34, -2);
    context.quadraticCurveTo(22, -25, 8, -6);
    context.stroke();
    for (let pod = 0; pod < structure.level + 1; pod += 1) {
        const x = (pod - structure.level / 2) * 21;
        const pulse = Math.sin(visualTime * 2.2 + pod) * 2;
        context.fillStyle = "#141e22";
        context.beginPath();
        context.ellipse(x, -17 - pod % 2 * 5, 10 + pulse, 17 + structure.level * 2, -0.15, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(125, 246, 220, 0.5)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, -8);
        context.lineTo(x + 2, -28 - pod % 2 * 5);
        context.stroke();
    }
}

function drawSpire(context, structure, visualTime) {
    const height = 48 + structure.level * 18;
    context.fillStyle = "#10181d";
    context.beginPath();
    context.moveTo(-16 - structure.level * 2, -2);
    context.lineTo(-8, -height);
    context.lineTo(8, -height);
    context.lineTo(16 + structure.level * 2, -2);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(125, 246, 220, 0.42)";
    context.lineWidth = 2;
    for (let band = 1; band <= structure.level; band += 1) {
        context.beginPath();
        context.moveTo(-11 - band, -16 - band * 14);
        context.lineTo(11 + band, -16 - band * 14);
        context.stroke();
    }
    const blink = Math.abs(Math.sin(visualTime * 1.8 + structure.x)) > 0.12 ? 1 : 0.2;
    context.fillStyle = `rgba(125, 246, 220, ${blink})`;
    context.beginPath();
    context.ellipse(0, -height - 7, 11 + structure.level * 2, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#071014";
    context.beginPath();
    context.ellipse(0, -height - 7, 3, 6, 0, 0, Math.PI * 2);
    context.fill();
}

function drawBarricade(context, structure) {
    context.strokeStyle = "#b7aa8c";
    context.lineWidth = 5 + structure.level;
    const ribs = 2 + structure.level * 2;
    for (let rib = 0; rib < ribs; rib += 1) {
        const x = (rib - (ribs - 1) / 2) * 12;
        const height = 36 + structure.level * 10 - Math.abs(x) * 0.25;
        context.beginPath();
        context.moveTo(x, 0);
        context.quadraticCurveTo(x - 10, -height * 0.72, x, -height);
        context.stroke();
    }
    context.strokeStyle = "#5e5143";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(-38, -13);
    context.lineTo(38, -13);
    context.stroke();
}

function drawCharnelYard(context, structure, visualTime) {
    context.fillStyle = "#160f14";
    context.beginPath();
    context.ellipse(0, -3, 31 + structure.level * 4, 10, 0, Math.PI, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#978773";
    context.lineWidth = 3;
    for (let bone = 0; bone < 3 + structure.level * 2; bone += 1) {
        const x = -27 + bone * 11;
        const height = 12 + (bone % 3) * 7;
        context.beginPath();
        context.moveTo(x, -3);
        context.lineTo(x + 5, -height);
        context.stroke();
    }
    context.strokeStyle = "#263532";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(-29, -5);
    context.lineTo(-27, -49 - structure.level * 8);
    context.lineTo(18, -49 - structure.level * 8);
    context.stroke();
    const swing = Math.sin(visualTime * 1.4) * 4;
    context.strokeStyle = DREAD;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(18, -49 - structure.level * 8);
    context.lineTo(18 + swing, -21);
    context.stroke();
}

function drawStaffingMark(context, structure, staffed, visualTime) {
    const x = 28 + structure.level * 3;
    const y = structure.type === "spire" ? -55 - structure.level * 18 : -55 - structure.level * 4;
    const assigned = structure.workerId !== null;
    const color = staffed ? DREAD : assigned ? "#e6bd6b" : VACANT;
    context.globalAlpha = staffed ? 0.72 + Math.sin(visualTime * 3) * 0.18 : 0.8;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, 3.5, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
}

function drawStructureHealth(context, structure, ground) {
    if (structure.level === 0 || structure.hp >= structure.maxHp) {
        return;
    } else {
        const definition = EXPANSION_CONFIG.types[structure.type];
        const height = structure.type === "spire" ? 74 + structure.level * 18 : 68 + structure.level * 5;
        const width = structure.type === "barricade" ? 72 : 58;
        const ratio = Math.max(0, Math.min(1, structure.hp / structure.maxHp));
        context.fillStyle = "rgba(3, 8, 10, 0.75)";
        context.fillRect(structure.x - width / 2 - 1, ground - height - 1, width + 2, 5);
        context.fillStyle = definition.role === "Stitcher" ? BONE : DREAD;
        context.fillRect(structure.x - width / 2, ground - height, width * ratio, 3);
    }
}

function drawAcolyteBody(context) {
    context.strokeStyle = "#161817";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-4, -18);
    context.lineTo(-7, 0);
    context.moveTo(4, -18);
    context.lineTo(8, 0);
    context.stroke();
    context.fillStyle = "#24252c";
    context.beginPath();
    context.moveTo(-11, -16);
    context.lineTo(-7, -48);
    context.lineTo(9, -48);
    context.lineTo(13, -16);
    context.closePath();
    context.fill();
    context.fillStyle = "#aa9379";
    context.beginPath();
    context.arc(1, -55, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = DREAD;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(1, -55, 10, -Math.PI * 0.15, Math.PI * 0.5);
    context.stroke();
}

function drawRoleEquipment(context, role) {
    switch (role) {
        case "Reaper":
            context.strokeStyle = "#a89b78";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(8, -39);
            context.lineTo(23, -66);
            context.arc(18, -66, 9, -0.9, 1.1);
            context.stroke();
            break;
        case "Seer":
            context.strokeStyle = DREAD;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(10, -35);
            context.lineTo(23, -69);
            context.ellipse(23, -73, 7, 4, 0, 0, Math.PI * 2);
            context.stroke();
            break;
        case "Stitcher":
            context.strokeStyle = BONE;
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(8, -35);
            context.lineTo(24, -58);
            context.lineTo(27, -72);
            context.stroke();
            break;
        case "Bonepicker":
            context.strokeStyle = "#8d745d";
            context.lineWidth = 3;
            context.strokeRect(10, -37, 18, 15);
            context.beginPath();
            context.arc(19, -38, 9, Math.PI, Math.PI * 2);
            context.stroke();
            break;
        default:
            context.fillStyle = "rgba(125, 246, 220, 0.55)";
            context.beginPath();
            context.arc(13, -38, 4, 0, Math.PI * 2);
            context.fill();
            break;
    }
}

function drawAcolyteHealth(context, acolyte, ground) {
    if (acolyte.hp >= acolyte.maxHp) {
        return;
    } else {
        const ratio = Math.max(0, Math.min(1, acolyte.hp / acolyte.maxHp));
        context.fillStyle = "rgba(3, 8, 10, 0.75)";
        context.fillRect(acolyte.x - 17, ground - 72, 34, 5);
        context.fillStyle = DREAD;
        context.fillRect(acolyte.x - 16, ground - 71, 32 * ratio, 3);
    }
}

function numericId(id) {
    const match = /([0-9]+)$/.exec(id);
    return match === null ? 0 : Number(match[1]);
}
