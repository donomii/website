function loadArt(file) {
    const image = new Image();
    image.src = new URL(`../art/${file}.webp`, import.meta.url).href;
    return image;
}

export const heraldArt = loadArt("herald");
const creatures = loadArt("creatures");
const structures = loadArt("structures");
export const trail = loadArt("trail");

// Source bounds followed by the anchor in source pixels.
const bodies = Object.freeze({
    soldier: [72, 42, 338, 449, 261, 482],
    archer: [587, 42, 361, 448, 769, 482],
    torchbearer: [1112, 8, 340, 483, 1283, 482],
    acolyte: [35, 554, 405, 447, 262, 989],
    crawler: [515, 742, 465, 241, 745, 970],
    brute: [1069, 536, 434, 468, 1284, 990],
});

const landmarks = Object.freeze({
    keep: [6, 0, 498, 335, 249, 322],
    heart: [518, 0, 504, 335, 768, 323],
    dormant: [1050, 23, 458, 312, 1292, 323],
    brood: [4, 345, 506, 330, 255, 662],
    barricade: [515, 408, 506, 268, 765, 664],
    spire: [1104, 340, 372, 336, 1284, 666],
    pasture: [3, 810, 507, 195, 259, 991],
    charnel: [514, 682, 507, 320, 774, 991],
    fire: [1028, 819, 504, 193, 1264, 997],
    foundation: [1095, 264, 399, 60, 1292, 322],
});

export function drawCreature(context, name, height, stride = 0) {
    const region = bodies[name];
    const scale = height / region[3];
    if (stride === 0 || creatures.naturalWidth === 0) {
        drawCutout(context, creatures, region, scale);
    } else {
        drawCreatureStride(context, region, scale, stride);
    }
}

function drawCreatureStride(context, [x, y, width, height, anchorX, anchorY], scale, stride) {
    const upper = Math.round(height * 0.72);
    const lower = height - upper;
    const seam = (y + upper - anchorY) * scale;
    context.drawImage(creatures, x, y, width, upper, (x - anchorX) * scale,
        (y - anchorY) * scale, width * scale, upper * scale);

    for (const side of [-1, 1]) {
        const legX = side < 0 ? x : anchorX;
        const legWidth = side < 0 ? anchorX - x : x + width - anchorX;
        const swing = stride * side;
        context.save();
        context.translate(0, seam);
        context.transform(1, 0, swing * 0.24, 1 - Math.max(0, swing) * 0.21, 0, 0);
        context.drawImage(creatures, legX, y + upper, legWidth, lower, (legX - anchorX) * scale, 0,
            legWidth * scale, lower * scale);
        context.restore();
    }
}

export function drawLandmark(context, name, height) {
    const region = landmarks[name];
    drawCutout(context, structures, region, height / region[3]);
}

function drawCutout(context, image, [x, y, width, height, anchorX, anchorY], scale) {
    if (image.naturalWidth === 0) {
        return;
    } else {
        context.drawImage(image, x, y, width, height, (x - anchorX) * scale, (y - anchorY) * scale,
            width * scale, height * scale);
    }
}

export function drawFootShadow(context, x, y, width) {
    context.fillStyle = "rgba(5, 9, 11, 0.4)";
    context.beginPath();
    context.ellipse(x, y + 2, width, Math.max(2, width * 0.12), 0, 0, Math.PI * 2);
    context.fill();
}

export function drawLocalLight(context, x, y, radius, color, alpha) {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(${color}, ${alpha})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function drawSelectionHalo(context, x, y, radius) {
    context.strokeStyle = "rgba(150, 232, 211, 0.68)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.ellipse(x, y + 3, radius, 9, 0, 0, Math.PI * 2);
    context.stroke();
}
