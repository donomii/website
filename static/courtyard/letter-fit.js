import * as T from "three";

const grid = 19;
const volume = grid ** 3;
const step = 0.095;
const glyphs = [
    ["H", ["10001", "10001", "10001", "11111", "10001", "10001", "10001"]],
    ["I", ["111", "010", "010", "010", "010", "010", "111"]],
    ["L", ["1000", "1000", "1000", "1000", "1000", "1000", "1111"]],
    ["O", ["01110", "11011", "10001", "10001", "10001", "11011", "01110"]],
    ["T", ["11111", "00100", "00100", "00100", "00100", "00100", "00100"]],
    ["U", ["10001", "10001", "10001", "10001", "10001", "11011", "01110"]],
];

const indexOf = (x, y, z) => x + grid * (y + grid * z);

function makeTarget(kind) {
    const target = new Uint8Array(volume);
    if (kind === "pyramid") {
        for (let y = 0; y < 15; y++) {
            const radius = 7 - 2 * Math.floor(y / 4);
            for (let z = 9 - radius; z <= 9 + radius; z++) {
                for (let x = 9 - radius; x <= 9 + radius; x++) {
                    target[indexOf(x, y, z)] = 1;
                }
            }
        }
        return target;
    }
    for (let z = 6; z <= 12; z++) {
        for (let y = 1; y < grid; y++) {
            for (let x = 0; x < grid; x++) {
                const offset = Math.abs(x - 9);
                const pillar = y <= 9 && offset >= 4 && offset <= 7;
                const radius = Math.hypot(offset, y - 9);
                const vault = y > 9 && radius >= 4 && radius <= 7.6;
                if (pillar || vault) target[indexOf(x, y, z)] = 1;
            }
        }
    }
    return target;
}

function glyphVariants() {
    const variants = [];
    for (const [label, rows] of glyphs) {
        for (const scale of [1, 2]) {
            for (const depth of [2, 4, 7]) {
                for (const rotate of [false, true]) {
                    const width = rows[0].length * scale;
                    const height = rows.length * scale;
                    const offsets = [];
                    for (let z = 0; z < depth; z++) {
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                if (rows[rows.length - 1 - Math.floor(y / scale)][Math.floor(x / scale)] === "1") {
                                    offsets.push(rotate ? indexOf(height - y - 1, x, z) : indexOf(x, y, z));
                                }
                            }
                        }
                    }
                    variants.push({ label, offsets, depth, width: rotate ? height : width, height: rotate ? width : height });
                }
            }
        }
    }
    return variants;
}

function display(group, x, color) {
    const cells = new T.InstancedMesh(new T.BoxGeometry(step * 0.97, step * 0.97, step * 0.97),
        new T.MeshStandardMaterial({ color, roughness: 0.87 }), volume);
    cells.position.x = x;
    cells.count = 0;
    cells.frustumCulled = false;
    group.add(cells);
    return cells;
}

function addCell(cells, index, transform) {
    const x = index % grid;
    const y = Math.floor(index / grid) % grid;
    const z = Math.floor(index / (grid ** 2));
    const slot = cells.count++;
    cells.setMatrixAt(slot, transform.makeTranslation((x - 9) * step, y * step, (z - 9) * step));
    return slot;
}

function plaque(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#392922";
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = "#dbba85";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 496, 96);
    ctx.fillStyle = "#ffedcb";
    ctx.font = "38px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 70, 460);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return new T.Mesh(new T.PlaneGeometry(1.3, 0.28), new T.MeshBasicMaterial({ map: texture }));
}

export function createLetterFit(scene) {
    const group = new T.Group();
    group.position.set(4.5, 0.72, -4.75);
    scene.add(group);
    const targetDisplay = display(group, -1.05, 0xc6a583);
    const fitDisplay = display(group, 1.05, 0xffffff);
    const base = new T.Mesh(new T.BoxGeometry(4, 0.72, 1.95), new T.MeshStandardMaterial({ color: 0x795e49 }));
    base.position.y = -0.36;
    group.add(base);
    const fitPlaque = plaque("Fit the shape");
    fitPlaque.position.set(-0.85, -0.36, 0.99);
    fitPlaque.userData.fitAction = "start";
    const switchPlaque = plaque("Switch shape");
    switchPlaque.position.set(0.85, -0.36, 0.99);
    switchPlaque.userData.fitAction = "toggle";
    group.add(fitPlaque, switchPlaque);

    const matrix = new T.Matrix4();
    let target;
    const variants = glyphVariants();
    const occupied = new Uint8Array(volume);
    const letters = [];
    const color = new T.Color();
    let randomState = 121947;
    let error = 0;
    let examined = 0;
    let sampled = 0;
    let best = null;
    let running = false;
    let worstMs = 0;
    let frameCount = 0;
    let frameTotal = 0;

    function reset() {
        occupied.fill(0);
        fitDisplay.count = 0;
        letters.length = 0;
        randomState = 121947;
        error = targetDisplay.count;
        examined = sampled = worstMs = frameCount = frameTotal = 0;
        best = null;
        running = false;
    }

    function setTarget(kind) {
        target = makeTarget(kind);
        targetDisplay.count = 0;
        target.forEach((filled, index) => { if (filled) addCell(targetDisplay, index, matrix); });
        targetDisplay.instanceMatrix.needsUpdate = true;
        reset();
    }

    function pick(limit) {
        randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
        return Math.floor(randomState / 4294967296 * limit);
    }

    function sample() {
        const shape = variants[pick(variants.length)];
        const start = indexOf(pick(grid - shape.width + 1), pick(grid - shape.height + 1), pick(grid - shape.depth + 1));
        let gain = 0;
        for (const offset of shape.offsets) {
            const index = start + offset;
            if (!occupied[index]) gain += target[index] ? 1 : -1;
        }
        if (gain > (best?.gain ?? 0)) best = { shape, start, gain };
        sampled++;
        examined++;
    }

    function accept() {
        if (!best) {
            running = false;
            return;
        }
        const { shape, start, gain } = best;
        color.setHSL((letters.length * 0.19 + 0.47) % 1, 0.57, 0.57);
        for (const offset of shape.offsets) {
            const index = start + offset;
            if (!occupied[index]) {
                occupied[index] = 1;
                fitDisplay.setColorAt(addCell(fitDisplay, index, matrix), color);
            }
        }
        fitDisplay.instanceMatrix.needsUpdate = true;
        fitDisplay.instanceColor.needsUpdate = true;
        letters.push(shape.label);
        error -= gain;
        sampled = 0;
        best = null;
        running = letters.length < 24 && error > 0;
    }

    let currentKind = "arch";
    setTarget(currentKind);
    return {
        group,
        targets: [fitPlaque, switchPlaque, base],
        get kind() { return currentKind; },
        setTarget(kind) {
            currentKind = kind;
            setTarget(kind);
        },
        toggleTarget() {
            currentKind = currentKind === "arch" ? "pyramid" : "arch";
            setTarget(currentKind);
            return currentKind;
        },
        start() {
            reset();
            running = true;
        },
        update(frameMs) {
            if (running) {
                if (frameCount > 0) frameTotal += frameMs;
                frameCount++;
                const start = performance.now();
                for (let count = 0; count < 36 && running && performance.now() - start < 2; count++) {
                    sample();
                    if (sampled === 480) accept();
                }
                worstMs = Math.max(worstMs, performance.now() - start);
            }
            const meanFrameMs = frameCount > 1 ? frameTotal / (frameCount - 1) : 0;
            return { running, letters: letters.join(""), error, initial: targetDisplay.count, examined, worstMs, meanFrameMs };
        },
    };
}
