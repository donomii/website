import { heraldArt } from "./foreground-art.js";
import { getSteedPose } from "./movement.js";

const SCALE = 1 / 3;
const BODY_ANCHOR = Object.freeze({ x: 252, y: 461 });
const BODY_MASK = new Path2D(
    "M 30 28 H 476 V 321 L 364 322 L 344 337 L 319 340 L 307 330 "
    + "L 273 333 L 267 365 L 242 383 L 209 360 L 205 325 L 176 316 L 151 331 "
    + "L 127 348 L 112 368 L 100 391 L 96 433 L 59 431 L 30 389 Z"
);

const FRONT = Object.freeze({
    hipX: 26,
    hipY: -48,
    footX: 22,
    farFootX: 33,
    upper: [319, 340, 15, 36],
    shin: [314, 392, 7, 24],
    hoof: [303, 434, 33, 30],
});

const HIND = Object.freeze({
    hipX: -37,
    hipY: -53,
    footX: -44,
    farFootX: -26,
    upper: [129, 345, 11, 14],
    shin: [113, 390, 8, 32],
    hoof: [101, 430, 36, 34],
});

export function drawPaintedSteed(context, player, visualTime) {
    if (heraldArt.naturalWidth === 0) {
        return;
    } else {
        const pose = getSteedPose(player);
        const breathing = Math.sin(visualTime * 2.1) * 0.45 * (1 - Math.min(1, Math.abs(player.vx) / 120));
        const bob = pose.bob + breathing;
        context.save();
        context.filter = "brightness(0.68)";
        for (const leg of pose.legs.filter((limb) => limb.far)) {
            drawLeg(context, leg, bob);
        }
        context.restore();
        for (const leg of pose.legs.filter((limb) => !limb.far)) {
            drawLeg(context, leg, bob);
        }
        drawBody(context, bob, pose.lean);
    }
}

function drawBody(context, bob, lean) {
    context.save();
    context.translate(0, bob);
    context.transform(1, 0, -lean * 0.007, 1, 0, 0);
    context.scale(SCALE, SCALE);
    context.translate(-BODY_ANCHOR.x, -BODY_ANCHOR.y);
    context.clip(BODY_MASK);
    context.drawImage(heraldArt, 0, 0, 480, 480, 0, 0, 480, 480);
    context.restore();
}

function drawLeg(context, leg, bob) {
    const front = leg.hipX > 0;
    const art = front ? FRONT : HIND;
    const hipX = art.hipX + (leg.far ? 6 : 0);
    const hipY = art.hipY + bob;
    const footX = (leg.far ? art.farFootX : art.footX) + leg.footX - leg.hipX;
    const ankleY = leg.footY - 6;
    const lift = -leg.footY;
    const kneeX = hipX + (footX - hipX) * 0.57 - (front ? lift * 0.45 : 7 + lift * 0.55);
    const kneeY = hipY + (ankleY - hipY) * 0.55;

    if (front) {
        drawSegment(context, art.upper, hipX, hipY, kneeX, kneeY, 12, 6);
    } else {
        const stifleX = hipX + 6 + (footX - hipX) * 0.15;
        const stifleY = hipY + (kneeY - hipY) * 0.48;
        drawSegment(context, art.upper, hipX, hipY, stifleX, stifleY, 17, 12);
        drawSegment(context, art.upper, stifleX, stifleY, kneeX, kneeY, 12, 6);
    }
    drawSegment(context, art.shin, kneeX, kneeY, footX, ankleY, 6.5, 4.8);

    context.save();
    context.translate(footX, leg.footY);
    context.rotate(lift * 0.024);
    context.drawImage(heraldArt, ...art.hoof, -5.2, -10, 11.5, 10.6);
    context.restore();
}

function drawSegment(context, source, x, y, endX, endY, upperWidth, lowerWidth) {
    const length = Math.hypot(endX - x, endY - y);
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(x - endX, endY - y));
    context.beginPath();
    context.moveTo(-upperWidth / 2, -1.5);
    context.quadraticCurveTo(-upperWidth * 0.47, length * 0.56, -lowerWidth / 2, length + 1.5);
    context.lineTo(lowerWidth / 2, length + 1.5);
    context.quadraticCurveTo(upperWidth * 0.38, length * 0.54, upperWidth / 2, -1.5);
    context.closePath();
    context.clip();
    context.drawImage(heraldArt, ...source, -upperWidth / 2, -1.5, upperWidth, length + 3);
    context.restore();
}
