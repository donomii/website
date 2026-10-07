import { getSteedPose } from "./movement.js";

const DREAD_COLOR = "#7df6dc";
const HUMAN_COLOR = "#d8c7a2";

export function drawHorrorActor(context, horror, ground, visualTime) {
    const bob = Math.sin(visualTime * 7 + numericId(horror.id)) * 2;
    context.save();
    context.translate(horror.x, ground + bob);
    context.scale(horror.facing, 1);
    context.globalAlpha = horror.hitFlash > 0 ? 0.56 : 1;
    if (horror.type === "brute") {
        drawBrute(context);
    } else {
        drawCrawler(context);
    }
    context.restore();
}

export function drawHumanActor(context, human, ground, visualTime) {
    const bob = Math.sin(visualTime * 8 + numericId(human.id)) * 1.5;
    context.save();
    context.translate(human.x, ground + bob);
    context.scale(human.facing, 1);
    context.globalAlpha = human.hitFlash > 0 ? 0.58 : 1;
    context.strokeStyle = "#161a19";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-5, -19);
    context.lineTo(-8, 0);
    context.moveTo(5, -19);
    context.lineTo(9, 0);
    context.stroke();
    context.fillStyle = human.type === "torchbearer" ? "#8d483c" : "#92907b";
    context.fillRect(-10, -48, 20, 31);
    context.fillStyle = HUMAN_COLOR;
    context.beginPath();
    context.arc(0, -57, 8, 0, Math.PI * 2);
    context.fill();
    drawHumanEquipment(context, human.type);
    context.restore();
}

export function drawMountedPlayer(context, player, ground, visualTime) {
    const pose = getSteedPose(player);
    const bob = pose.bob + (player.vx === 0 ? Math.sin(visualTime * 2) * 0.7 : 0);
    context.save();
    context.translate(player.x, ground);
    context.scale(player.facing, 1);
    context.globalAlpha = player.invulnerable > 0 && Math.floor(visualTime * 14) % 2 === 0 ? 0.48 : 1;
    context.fillStyle = "rgba(0, 4, 7, 0.28)";
    context.beginPath();
    context.ellipse(0, 2, 52, 6, 0, 0, Math.PI * 2);
    context.fill();
    for (const leg of pose.legs.filter((limb) => limb.far)) {
        drawSteedLeg(context, leg, bob);
    }
    context.save();
    context.translate(0, bob);
    drawSteedBody(context, pose.lean);
    context.restore();
    for (const leg of pose.legs.filter((limb) => !limb.far)) {
        drawSteedLeg(context, leg, bob);
    }
    context.translate(pose.lean, bob - 16);
    drawHerald(context);
    context.restore();
}

function drawSteedLeg(context, leg, bob) {
    const hipY = -45 + bob;
    const bend = leg.hipX > 0 ? 6 : -8;
    const kneeX = (leg.hipX + leg.footX) / 2 + bend;
    const kneeY = (hipY + leg.footY) / 2;
    context.strokeStyle = leg.far ? "#17272f" : "#34454c";
    context.lineWidth = leg.far ? 5 : 6;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(leg.hipX, hipY);
    context.lineTo(kneeX, kneeY);
    context.lineTo(leg.footX, leg.footY - 3);
    context.stroke();
    context.strokeStyle = leg.far ? "#53615f" : "#9aa896";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(leg.footX - 2, leg.footY - 2);
    context.lineTo(leg.footX + 4, leg.footY - 2);
    context.stroke();
}

function drawSteedBody(context, lean) {
    context.strokeStyle = "#263e43";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-35, -54);
    context.bezierCurveTo(-58, -68 - lean, -60, -29, -77, -31 - lean);
    context.stroke();
    context.fillStyle = "#14232b";
    context.strokeStyle = "#365451";
    context.lineWidth = 1.5;
    context.beginPath();
    context.ellipse(0, -54, 42, 19, -0.04, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(24, -59);
    context.quadraticCurveTo(28, -83, 40, -94);
    context.lineTo(39, -106);
    context.lineTo(48, -97);
    context.lineTo(54, -103);
    context.lineTo(55, -92);
    context.quadraticCurveTo(65, -91, 75, -78);
    context.lineTo(70, -69);
    context.lineTo(54, -74);
    context.quadraticCurveTo(48, -51, 32, -43);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = DREAD_COLOR;
    context.beginPath();
    context.ellipse(56, -84, 3, 4, -0.2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#77657d";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(65, -75);
    context.quadraticCurveTo(33, -61, 13 + lean, -75);
    context.stroke();
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

function drawCrawler(context) {
    context.strokeStyle = "#0a1114";
    context.lineWidth = 4;
    for (let leg = -2; leg <= 2; leg += 1) {
        context.beginPath();
        context.moveTo(leg * 7, -14);
        context.lineTo(leg * 12, -2);
        context.lineTo(leg * 15 + 5, 2);
        context.stroke();
    }
    context.fillStyle = "#10161c";
    context.beginPath();
    context.ellipse(0, -21, 24, 16, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = DREAD_COLOR;
    context.beginPath();
    context.ellipse(10, -23, 5, 7, 0, 0, Math.PI * 2);
    context.fill();
}

function drawBrute(context) {
    context.strokeStyle = "#0a1114";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(-18, -31);
    context.lineTo(-29, -2);
    context.moveTo(16, -31);
    context.lineTo(28, -2);
    context.moveTo(21, -44);
    context.lineTo(39, -21);
    context.stroke();
    context.fillStyle = "#111821";
    context.beginPath();
    context.ellipse(0, -43, 35, 37, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = DREAD_COLOR;
    for (let eye = -1; eye <= 1; eye += 1) {
        context.beginPath();
        context.ellipse(13, -44 + eye * 11, 4, 6, 0, 0, Math.PI * 2);
        context.fill();
    }
}

function drawHumanEquipment(context, type) {
    switch (type) {
        case "archer":
            context.strokeStyle = "#b99a63";
            context.lineWidth = 2;
            context.beginPath();
            context.arc(13, -37, 13, -Math.PI / 2, Math.PI / 2);
            context.moveTo(13, -50);
            context.lineTo(13, -24);
            context.stroke();
            break;
        case "torchbearer":
            context.strokeStyle = "#4b3323";
            context.lineWidth = 4;
            context.beginPath();
            context.moveTo(10, -37);
            context.lineTo(19, -67);
            context.stroke();
            context.fillStyle = "#f2a33c";
            context.beginPath();
            context.moveTo(19, -65);
            context.quadraticCurveTo(8, -78, 22, -84);
            context.quadraticCurveTo(32, -75, 19, -65);
            context.fill();
            break;
        default:
            context.strokeStyle = "#c7bd9d";
            context.lineWidth = 3;
            context.beginPath();
            context.moveTo(8, -40);
            context.lineTo(25, -59);
            context.stroke();
            context.fillStyle = "#4e5b5d";
            context.beginPath();
            context.arc(-13, -38, 11, 0, Math.PI * 2);
            context.fill();
            break;
    }
}

function drawHerald(context) {
    context.fillStyle = "#15131c";
    context.beginPath();
    context.moveTo(-12, -48);
    context.lineTo(7, -88);
    context.lineTo(24, -49);
    context.closePath();
    context.fill();
    context.fillStyle = "#080d11";
    context.beginPath();
    context.arc(7, -93, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = DREAD_COLOR;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(1, -100);
    context.lineTo(-7, -116);
    context.lineTo(-15, -120);
    context.moveTo(12, -101);
    context.lineTo(20, -117);
    context.lineTo(29, -121);
    context.stroke();
    context.fillStyle = DREAD_COLOR;
    context.fillRect(9, -96, 6, 2);
}

function numericId(id) {
    const match = /([0-9]+)$/.exec(id);
    return match === null ? 0 : Number(match[1]);
}
