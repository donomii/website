import * as T from "../../projects/games/domino-rush/vendor/three.module.js";

function batches(targetParent) {
    const groups = new Map();
    const cube = new T.BoxGeometry(1, 1, 1);
    const matrix = new T.Matrix4();
    const rotation = new T.Quaternion();
    const up = new T.Vector3(0, 1, 0);
    function put(material, position, size, quaternion = new T.Quaternion()) {
        const list = groups.get(material) ?? [];
        matrix.compose(position, quaternion, size);
        list.push(matrix.clone());
        groups.set(material, list);
    }
    return {
        box(material, w, h, d, x, y, z) {
            put(material, new T.Vector3(x, y, z), new T.Vector3(w, h, d));
        },
        bar(material, from, to, width = 0.035) {
            const direction = to.clone().sub(from);
            const len = direction.length();
            if (len < 1e-4) return;
            rotation.setFromUnitVectors(up, direction.divideScalar(len));
            put(material, from.clone().add(to).multiplyScalar(0.5),
                new T.Vector3(width, len, width), rotation);
        },
        prism(material, center, quat, sx, sy, sz) {
            put(material, center, new T.Vector3(sx, sy, sz), quat);
        },
        finish() {
            for (const [material, transforms] of groups) {
                const mesh = new T.InstancedMesh(cube, material, transforms.length);
                transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
                mesh.name = "Deco architecture · " + material.name;
                mesh.computeBoundingSphere();
                targetParent.add(mesh);
            }
        },
    };
}

function expandLSystem(axiom, rules, generations, maxLen = 5000) {
    let state = axiom;
    for (let g = 0; g < generations; g++) {
        let next = "";
        for (const ch of state) {
            next += rules[ch] ?? ch;
            if (next.length >= maxLen) break;
        }
        state = next.slice(0, maxLen);
    }
    return state;
}

const DECO_PRESETS = [
    {
        name: "Imperial Sunburst",
        axiom: "A",
        rules: { A: "F[^I][+sA][-sA]D", I: "IG" },
        gens: 3,
        angleDeg: 22.5,
        relief: 1.0,
        layout: "fan",
        step: 0.42,
    },
    {
        name: "Chrysler Crown",
        axiom: "S",
        rules: { S: "F^D[+sF][-sF][+sI][-sI]sS", I: "IG" },
        gens: 3,
        angleDeg: 15,
        relief: 1.25,
        layout: "spire",
        step: 0.46,
    },
    {
        name: "Cascade Chevron",
        axiom: "C",
        rules: { C: "F[+sI][-sI][^D]sC", I: "F^G" },
        gens: 3,
        angleDeg: 22.5,
        relief: 1.2,
        layout: "wings",
        step: 0.4,
    },
    {
        name: "Pagoda Lantern",
        axiom: "P",
        rules: { P: "F^I[+E][-E]vG[+sB][-sB]", B: "F^D[+I][-I]sP" },
        gens: 2,
        angleDeg: 36,
        relief: 1.45,
        layout: "spire",
        step: 0.46,
    },
    {
        name: "Lotus Medallion",
        axiom: "R",
        rules: { R: "F[+^I][-^I]sDsR", I: "E^G" },
        gens: 3,
        angleDeg: 22.5,
        relief: 1.0,
        layout: "rosette",
        step: 0.34,
    },
];

const ANGLES = [15, 22.5, 30, 36, 45];
const RELIEFS = [
    { label: "Flat", scale: 0.35 },
    { label: "Relief", scale: 1.0 },
    { label: "Deep 3D", scale: 1.75 },
];
const LAYOUTS = [
    { key: "fan", label: "Fan" },
    { key: "wings", label: "Wings" },
    { key: "rosette", label: "Rosette" },
    { key: "spire", label: "Spire" },
];

function formatRuleText(design) {
    return Object.entries(design.rules).map(([k, v]) => `${k}→${v}`).join("  ");
}

function makePlaqueMesh(width, height, drawFn) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.round(512 * (height / width));
    const ctx = canvas.getContext("2d");
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const mesh = new T.Mesh(
        new T.PlaneGeometry(width, height),
        new T.MeshBasicMaterial({ map: texture })
    );
    const redraw = (...args) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFn(ctx, canvas.width, canvas.height, ...args);
        texture.needsUpdate = true;
    };
    return { mesh, redraw };
}

export function createDecoArchitecture(scene) {
    const material = (name, color, metalness, roughness, emissive = 0x000000) => {
        const value = new T.MeshStandardMaterial({ color, metalness, roughness, emissive });
        value.name = name;
        return value;
    };
    const gold = material("brushed brass", 0xc8a55e, 0.64, 0.3);
    const ivory = material("ivory stone", 0xe0d6bd, 0.08, 0.35);
    const black = material("black onyx", 0x151d21, 0.22, 0.27);
    const green = material("emerald lacquer", 0x164744, 0.22, 0.38);
    const jade = material("honed jade stone", 0x294d46, 0.04, 0.68);
    const velvet = material("peacock velvet", 0x235658, 0.02, 0.86);
    const glass = material("warm opal glass", 0xffe6b4, 0.04, 0.4, 0x71552b);
    const b = batches(scene);
    function object(geometry, finish, x, y, z) {
        const mesh = new T.Mesh(geometry, finish);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
    }

    // L-system reproduction of the classic 17-ray alternating brass sunburst fan.
    function fan(x, y, z, radius, turn = 0) {
        for (const r of [radius * 0.22, radius * 0.92, radius]) {
            const arc = object(new T.TorusGeometry(r, 0.018, 5, 48, Math.PI), gold, x, y, z);
            arc.rotation.y = turn;
        }
        const spokeSeq = expandLSystem("EL", { E: "EO", O: "EO" }, 4);
        const program = expandLSystem(spokeSeq, { E: "[mF]+", O: "[mf]+", L: "[mF]" }, 1);
        const point = (r, angle) => new T.Vector3(
            x + Math.cos(angle) * r * Math.cos(turn),
            y + Math.sin(angle) * r,
            z - Math.cos(angle) * r * Math.sin(turn)
        );
        const stack = [];
        let dist = 0;
        let angle = 0;
        for (const ch of program) {
            if (ch === "m") {
                dist += radius * 0.22;
            } else if (ch === "F" || ch === "f") {
                const seg = ch === "F" ? radius * 0.78 : radius * 0.65;
                b.bar(gold, point(dist, angle), point(dist + seg, angle), 0.035);
                dist += seg;
            } else if (ch === "+") {
                angle += Math.PI / 16;
            } else if (ch === "[") {
                stack.push({ dist, angle });
            } else if (ch === "]" && stack.length) {
                ({ dist, angle } = stack.pop());
            }
        }
    }

    // Interactive 3D L-system relief studio mounted on the East center onyx panel (x = +5.94, z = 0).
    function createInteractivePanel() {
        const panelX = 5.94;
        const reliefMats = { F: gold, I: ivory, G: glass, E: green };
        const angleAxisW = new T.Vector3(0, 0, 1);
        const pitchAxisU = new T.Vector3(1, 0, 0);
        const rollAxisV = new T.Vector3(0, 1, 0);
        const localUp = new T.Vector3(0, 1, 0);
        const stepRot = new T.Quaternion();
        const bevelRot = new T.Quaternion().setFromAxisAngle(angleAxisW, Math.PI / 4);

        const designState = {
            presetIndex: 0,
            customCount: 0,
            gensIndex: 2,
            angleIndex: 1,
            reliefIndex: 1,
            layoutIndex: 0,
            design: { ...DECO_PRESETS[0], rules: { ...DECO_PRESETS[0].rules } },
        };

        const sculptureGroup = new T.Group();
        sculptureGroup.name = "Art Deco L-system studio relief";
        scene.add(sculptureGroup);

        const toPanelWorld = (u, v, w) => new T.Vector3(panelX - 0.08 - w, v, u);

        function symmetryArms(layoutKey) {
            if (layoutKey === "fan") {
                return Array.from({ length: 11 }, (_, idx) => {
                    const ray = idx - 5;
                    return {
                        u: 0,
                        v: 0,
                        w: 0.02,
                        angle: -ray * (Math.PI / 13),
                        mirror: ray < 0 ? -1 : 1,
                        scale: ray % 2 === 0 ? 1.0 : 0.78,
                        leanOut: 0.14 + (1 - Math.abs(ray) / 5) * 0.16,
                    };
                });
            }
            if (layoutKey === "wings") {
                const arms = [];
                for (let tier = 0; tier < 5; tier++) {
                    for (const mirror of [-1, 1]) {
                        arms.push({
                            u: mirror * (0.1 + tier * 0.15),
                            v: tier * 0.14,
                            w: 0.02 + (4 - tier) * 0.015,
                            angle: -mirror * (0.24 + tier * 0.11),
                            mirror,
                            scale: 1.06 - tier * 0.12,
                            leanOut: 0.16 + (4 - tier) * 0.03,
                        });
                    }
                }
                return arms;
            }
            if (layoutKey === "rosette") {
                return Array.from({ length: 12 }, (_, idx) => ({
                    u: 0,
                    v: 0,
                    w: 0.03,
                    angle: idx * (Math.PI / 6),
                    mirror: idx % 2 === 0 ? 1 : -1,
                    scale: idx % 2 === 0 ? 0.92 : 0.72,
                    leanOut: idx % 2 === 0 ? 0.22 : 0.14,
                }));
            }
            return [0, -1, 1, -2, 2, -3, 3].map(slot => {
                const abs = Math.abs(slot);
                return {
                    u: slot * 0.27,
                    v: 0,
                    w: (3 - abs) * 0.025 + 0.02,
                    angle: -slot * 0.035,
                    mirror: slot < 0 ? -1 : 1,
                    scale: 1.24 - abs * 0.23,
                    leanOut: 0.22 - abs * 0.03,
                };
            });
        }

        const clearSculpture = () => {
            while (sculptureGroup.children.length) {
                const child = sculptureGroup.children.pop();
                child.dispose?.();
            }
        };

        const renderDesign = () => {
            clearSculpture();
            const d = designState.design;
            const expanded = expandLSystem(d.axiom, d.rules, d.gens, 3600);
            const turnRad = (d.angleDeg * Math.PI) / 180;
            const reliefScale = d.relief;
            const pb = batches(sculptureGroup);
            const arms = symmetryArms(d.layout);
            const maxPrimitives = 1400;
            const items = [];
            let minU = Infinity, maxU = -Infinity;
            let minV = Infinity, maxV = -Infinity;
            let minW = Infinity, maxW = -Infinity;
            const trackPt = vec => {
                if (vec.x < minU) minU = vec.x;
                if (vec.x > maxU) maxU = vec.x;
                if (vec.y < minV) minV = vec.y;
                if (vec.y > maxV) maxV = vec.y;
                if (vec.z < minW) minW = vec.z;
                if (vec.z > maxW) maxW = vec.z;
            };

            for (const arm of arms) {
                if (items.length >= maxPrimitives) break;
                const stack = [];
                const pos = new T.Vector3(arm.u, arm.v, arm.w);
                const quat = new T.Quaternion().setFromAxisAngle(angleAxisW, arm.angle);
                quat.multiply(stepRot.setFromAxisAngle(pitchAxisU, arm.leanOut * reliefScale));
                let len = d.step * arm.scale * (d.gens >= 4 ? 0.68 : d.gens === 1 ? 1.35 : 0.92);
                let barW = 0.038;
                const forward = new T.Vector3();
                const nextPos = new T.Vector3();
                const tmpQuat = new T.Quaternion();

                for (const ch of expanded) {
                    if (items.length >= maxPrimitives) break;
                    if (ch === "F" || ch === "I" || ch === "G" || ch === "E") {
                        const segScale = ch === "G" ? 0.46 : ch === "I" ? 0.82 : 1.0;
                        forward.copy(localUp).applyQuaternion(quat);
                        nextPos.copy(pos).addScaledVector(forward, len * segScale);
                        const a = pos.clone();
                        const b = nextPos.clone();
                        trackPt(a);
                        trackPt(b);
                        const segWidth = ch === "I" ? barW * 1.38 : ch === "G" ? barW * 1.28 : barW;
                        items.push({ kind: "bar", mat: reliefMats[ch], a, b, segWidth });
                        pos.copy(nextPos);
                    } else if (ch === "f") {
                        forward.copy(localUp).applyQuaternion(quat);
                        pos.addScaledVector(forward, len * 0.52);
                    } else if (ch === "D") {
                        tmpQuat.copy(quat).multiply(bevelRot);
                        const diamondW = barW * 2.15;
                        const p = pos.clone();
                        trackPt(p);
                        items.push({ kind: "prism", p, q: tmpQuat.clone(), diamondW });
                    } else if (ch === "+") {
                        quat.multiply(stepRot.setFromAxisAngle(angleAxisW, turnRad * arm.mirror));
                    } else if (ch === "-") {
                        quat.multiply(stepRot.setFromAxisAngle(angleAxisW, -turnRad * arm.mirror));
                    } else if (ch === "^") {
                        quat.multiply(stepRot.setFromAxisAngle(pitchAxisU, turnRad * 0.58 * reliefScale));
                    } else if (ch === "v") {
                        quat.multiply(stepRot.setFromAxisAngle(pitchAxisU, -turnRad * 0.58 * reliefScale));
                    } else if (ch === "<") {
                        quat.multiply(stepRot.setFromAxisAngle(rollAxisV, turnRad * arm.mirror));
                    } else if (ch === ">") {
                        quat.multiply(stepRot.setFromAxisAngle(rollAxisV, -turnRad * arm.mirror));
                    } else if (ch === "s") {
                        len *= 0.74;
                        barW = Math.max(0.016, barW * 0.86);
                    } else if (ch === "[") {
                        stack.push({ pos: pos.clone(), quat: quat.clone(), len, barW });
                    } else if (ch === "]" && stack.length) {
                        const saved = stack.pop();
                        pos.copy(saved.pos);
                        quat.copy(saved.quat);
                        len = saved.len;
                        barW = saved.barW;
                    }
                }
            }

            if (items.length) {
                const spanU = Math.max(0.45, maxU - minU);
                const spanV = Math.max(0.55, maxV - minV);
                const spanW = Math.max(0.06, maxW - minW);
                const midU = (minU + maxU) * 0.5;
                const midV = (minV + maxV) * 0.5;
                const fitScale = Math.min(2.26 / spanU, 2.02 / spanV, 2.1);
                const depthScale = Math.min(fitScale, (0.42 * reliefScale) / spanW);
                const thickScale = T.MathUtils.clamp(Math.sqrt(fitScale), 0.72, 1.32);
                const mapWorld = (vec, offsetW = 0) => toPanelWorld(
                    (vec.x - midU) * fitScale,
                    2.68 + (vec.y - midV) * fitScale,
                    0.04 + (vec.z - minW) * depthScale + offsetW
                );
                for (const item of items) {
                    if (item.kind === "bar") {
                        pb.bar(item.mat, mapWorld(item.a), mapWorld(item.b), item.segWidth * thickScale);
                    } else {
                        const dw = T.MathUtils.clamp(item.diamondW * thickScale, 0.04, 0.13);
                        pb.prism(gold, mapWorld(item.p, 0.014), item.q, dw, dw, dw * 0.72);
                    }
                }
            }
            pb.finish();
        };

        // Sloped Art Deco onyx-and-brass designer desk anchored beneath the east panel.
        b.box(black, 0.44, 0.68, 2.66, 5.7, 0.34, 0);
        b.box(gold, 0.48, 0.04, 2.7, 5.68, 0.68, 0);
        const tilt = 0.54;
        const headerPlaque = makePlaqueMesh(2.54, 0.25, (ctx, w, h, text, sub) => {
            ctx.fillStyle = "#11181c";
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = "#d8b46a";
            ctx.lineWidth = 4;
            ctx.strokeRect(4, 4, w - 8, h - 8);
            ctx.fillStyle = "#f9e7be";
            ctx.font = "600 22px Georgia";
            ctx.textAlign = "center";
            ctx.fillText(text, w / 2, 24, w - 24);
            ctx.fillStyle = "#8fd4c9";
            ctx.font = "15px monospace";
            ctx.fillText(sub, w / 2, 43, w - 24);
        });
        headerPlaque.mesh.position.set(5.78, 1.38, 0);
        headerPlaque.mesh.rotation.set(-0.18, -Math.PI / 2, 0, "YXZ");
        scene.add(headerPlaque.mesh);

        const buttons = [];
        const addButton = (col, row, onClick) => {
            const z = col * 0.86;
            const y = row === 0 ? 1.09 : 0.84;
            const x = row === 0 ? 5.72 : 5.56;
            const plaque = makePlaqueMesh(0.79, 0.22, (ctx, w, h, title, val) => {
                ctx.fillStyle = "#162124";
                ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = "#cfa75f";
                ctx.lineWidth = 8;
                ctx.strokeRect(6, 6, w - 12, h - 12);
                ctx.fillStyle = "#d4b375";
                ctx.font = "600 32px Georgia";
                ctx.textAlign = "center";
                ctx.fillText(title, w / 2, 50, w - 30);
                ctx.fillStyle = "#fff1cf";
                ctx.font = "bold 44px system-ui";
                ctx.fillText(val, w / 2, 108, w - 30);
            });
            plaque.mesh.position.set(x, y, z);
            plaque.mesh.rotation.set(-tilt, -Math.PI / 2, 0, "YXZ");
            plaque.mesh.userData.onDecoAction = onClick;
            scene.add(plaque.mesh);
            buttons.push(plaque);
            return plaque;
        };

        const syncLabels = () => {
            const d = designState.design;
            const reliefLabel = RELIEFS[designState.reliefIndex]?.label ?? "Custom";
            const layoutLabel = LAYOUTS.find(l => l.key === d.layout)?.label ?? d.layout;
            headerPlaque.redraw(
                `L-System Atelier · ${d.name} (Gen ${d.gens}, ${d.angleDeg}°, ${reliefLabel}, ${layoutLabel})`,
                formatRuleText(d)
            );
            btnMotif.redraw("PRESET MOTIF", d.name);
            btnGens.redraw("REWRITES", `Gen ${d.gens}`);
            btnInvent.redraw("RANDOM GRAMMAR", "Invent New");
            btnAngle.redraw("TURN ANGLE", `${d.angleDeg}°`);
            btnRelief.redraw("3D RELIEF", reliefLabel);
            btnLayout.redraw("SYMMETRY", layoutLabel);
        };

        const applyChange = () => {
            renderDesign();
            syncLabels();
        };

        const loadPreset = index => {
            const p = DECO_PRESETS[index % DECO_PRESETS.length];
            designState.presetIndex = index % DECO_PRESETS.length;
            designState.gensIndex = p.gens - 1;
            designState.angleIndex = Math.max(0, ANGLES.indexOf(p.angleDeg));
            designState.reliefIndex = p.relief < 0.7 ? 0 : p.relief > 1.3 ? 2 : 1;
            designState.layoutIndex = Math.max(0, LAYOUTS.findIndex(l => l.key === p.layout));
            designState.design = { ...p, rules: { ...p.rules } };
            applyChange();
        };

        const inventNew = () => {
            designState.customCount++;
            const pick = arr => arr[Math.floor(Math.random() * arr.length)];
            const crownTokens = ["^I", "^G", "^D", "E^G", "I^G", "<^I", ">^G"];
            const finTokens = ["+sA", "+sI", "+^G", "+E", "+sB", "+^I"];
            const mirrorToken = tok => tok.replaceAll("+", "@").replaceAll("-", "+").replaceAll("@", "-").replaceAll("<", "#").replaceAll(">", "<").replaceAll("#", ">");
            const left = pick(finTokens);
            const right = mirrorToken(left);
            const subLeft = "+" + pick(["sI", "G", "D", "^E"]);
            const subRight = mirrorToken(subLeft);
            const crest = pick(crownTokens);
            const spine = pick(["F", "F^D", "I^F", "E^F"]);
            const sub = pick(["F^G", "I^D", "E^I", "F^D"]);
            const angle = pick(ANGLES.slice(0, 4));
            const reliefObj = pick(RELIEFS.slice(1));
            const layoutObj = pick(LAYOUTS);
            designState.angleIndex = ANGLES.indexOf(angle);
            designState.reliefIndex = RELIEFS.indexOf(reliefObj);
            designState.layoutIndex = LAYOUTS.indexOf(layoutObj);
            designState.gensIndex = 1 + Math.floor(Math.random() * 2);
            designState.design = {
                name: `Atelier #${designState.customCount}`,
                axiom: "A",
                rules: {
                    A: `${spine}[${crest}][${left}][${right}]B`,
                    B: `${sub}[${subLeft}][${subRight}]sA`,
                },
                gens: designState.gensIndex + 1,
                angleDeg: angle,
                relief: reliefObj.scale,
                layout: layoutObj.key,
                step: layoutObj.key === "rosette" ? 0.34 : 0.42,
            };
            applyChange();
        };

        const btnMotif = addButton(-1, 0, () => loadPreset(designState.presetIndex + 1));
        const btnGens = addButton(0, 0, () => {
            designState.gensIndex = (designState.gensIndex + 1) % 4;
            designState.design.gens = designState.gensIndex + 1;
            applyChange();
        });
        const btnInvent = addButton(1, 0, inventNew);
        const btnAngle = addButton(-1, 1, () => {
            designState.angleIndex = (designState.angleIndex + 1) % ANGLES.length;
            designState.design.angleDeg = ANGLES[designState.angleIndex];
            applyChange();
        });
        const btnRelief = addButton(0, 1, () => {
            designState.reliefIndex = (designState.reliefIndex + 1) % RELIEFS.length;
            designState.design.relief = RELIEFS[designState.reliefIndex].scale;
            applyChange();
        });
        const btnLayout = addButton(1, 1, () => {
            designState.layoutIndex = (designState.layoutIndex + 1) % LAYOUTS.length;
            designState.design.layout = LAYOUTS[designState.layoutIndex].key;
            applyChange();
        });

        applyChange();

        return {
            targets: buttons.map(b => b.mesh),
            summary: () => {
                const d = designState.design;
                const reliefLabel = RELIEFS[designState.reliefIndex]?.label ?? "Relief";
                return `East L-System Panel · ${d.name} (Gen ${d.gens}, ${d.angleDeg}°, ${reliefLabel}, ${d.layout}) · ${formatRuleText(d)}`;
            },
            select(ray) {
                const hit = ray.intersectObjects(buttons.map(b => b.mesh), false)[0];
                if (!hit) return false;
                hit.object.userData.onDecoAction();
                return true;
            },
        };
    }

    const surface = object(new T.PlaneGeometry(12, 16).rotateX(-Math.PI / 2), jade, 0, 0, 0);
    surface.name = "Deco salon floor";
    for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
            const corner = [[5.65, 6.8], [4.95, 6.8], [4.95, 7.25], [4.25, 7.25]];
            for (let index = 1; index < corner.length; index++) {
                const from = corner[index - 1];
                const to = corner[index];
                b.bar(gold, new T.Vector3(side * from[0], 0.012, end * from[1]),
                    new T.Vector3(side * to[0], 0.012, end * to[1]), 0.025);
            }
        }
    }
    for (const x of [-5.65, 5.65]) b.box(gold, 0.035, 0.015, 15.3, x, 0.018, 0);
    for (const z of [-7.65, 7.65]) b.box(gold, 11.3, 0.015, 0.035, 0, 0.018, z);
    for (const x of [-6.1, 6.1]) b.box(green, 0.2, 6.5, 16.2, x, 3.25, 0);
    b.box(green, 12.2, 6.5, 0.2, 0, 3.25, -8.1);
    for (const x of [-3.57, 3.57]) b.box(green, 5.05, 6.5, 0.2, x, 3.25, 8.1);
    b.box(green, 2.1, 3.2, 0.2, 0, 4.9, 8.1);
    b.box(black, 12.2, 0.2, 16.2, 0, 6.6, 0);
    for (const height of [0.18, 1.15, 5.5, 5.72, 6.3]) {
        for (const x of [-5.97, 5.97]) b.box(gold, 0.045, 0.035, 16, x, height, 0);
        for (const z of [-7.97, 7.97]) b.box(gold, 12, 0.035, 0.045, 0, height, z);
    }
    for (const x of [-5.72, 5.72]) {
        for (const z of [-6.4, -2.2, 2.2, 6.4]) {
            b.box(black, 0.52, 4.6, 0.6, x, 2.3, z);
            for (const offset of [-0.18, -0.09, 0, 0.09, 0.18]) {
                b.box(gold, 0.035, 4.1, 0.04, x + offset, 2.3, z + 0.32);
            }
            for (let tier = 0; tier < 3; tier++) {
                b.box(ivory, 0.62 + tier * 0.16, 0.16, 0.76 + tier * 0.12, x, 4.62 + tier * 0.18, z);
            }
        }
    }
    for (const side of [-1, 1]) {
        const x = side * 5.94;
        for (const z of [-4.3, 0, 4.3]) {
            b.box(black, 0.035, 3.55, 2.8, x, 3.1, z);
            for (const edge of [-1.42, 1.42]) b.box(gold, 0.06, 3.6, 0.035, x - side * 0.03, 3.1, z + edge);
            for (const y of [1.3, 4.9]) b.box(gold, 0.06, 0.035, 2.86, x - side * 0.03, y, z);
            if (!(side === 1 && z === 0)) {
                fan(x - side * 0.06, 2.35, z, 1.18, Math.PI / 2);
                for (const offset of [-0.22, 0, 0.22]) b.box(gold, 0.05, 0.75, 0.025, x - side * 0.06, 1.94, z + offset);
            }
        }
        b.box(black, 1.48, 0.24, 2.2, side * 4.1, 0.38, 3.9);
        b.box(velvet, 1.42, 0.3, 2.02, side * 4.1, 0.64, 3.9);
        b.box(velvet, 0.24, 0.85, 2.12, side * 4.72, 0.98, 3.9);
        for (const z of [2.85, 4.95]) b.box(gold, 1.5, 0.1, 0.12, side * 4.1, 0.93, z);
    }
    const studioPanel = createInteractivePanel();
    for (let tier = 0; tier < 4; tier++) {
        const w = 5.2 - tier * 0.45;
        const h = 5.0 - tier * 0.35;
        b.box(tier % 2 ? black : gold, w, h, 0.1, 0, 2.9, -7.92 + tier * 0.055);
    }
    fan(0, 2.45, -7.64, 2.0);
    object(new T.CylinderGeometry(0.55, 0.55, 0.06, 48).rotateX(Math.PI / 2), gold, 0, 2.45, -7.58);
    for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) b.box(gold, 0.035, 1.45, 0.06, x, 1.7, -7.59);
    for (const z of [-6.2, -2, 2.2, 6.2]) {
        b.box(gold, 3.6, 0.12, 0.45, 0, 6.05, z);
        for (const x of [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25]) {
            b.box(glass, 0.22, 0.48 + (1.25 - Math.abs(x)) * 0.32, 0.25, x, 5.72, z);
        }
    }
    const centerZ = -1.6;
    for (let tier = 0; tier < 3; tier++) {
        object(new T.CylinderGeometry(1 - tier * 0.16, 1 - tier * 0.16, 0.16, 8),
            tier === 1 ? gold : black, 0, 0.08 + tier * 0.16, centerZ);
    }
    object(new T.CylinderGeometry(0.35, 0.48, 0.7, 8), ivory, 0, 0.8, centerZ);
    const sculpture = new T.Group();
    sculpture.name = "Brass armillary";
    sculpture.position.set(0, 2.0, centerZ);
    scene.add(sculpture);
    for (let index = 0; index < 3; index++) {
        const ring = new T.Mesh(new T.TorusGeometry(0.75 + index * 0.1, 0.025, 8, 64), gold);
        ring.rotation.set(index * Math.PI / 3, index * Math.PI / 4, index * Math.PI / 5);
        sculpture.add(ring);
    }
    const core = new T.Mesh(new T.OctahedronGeometry(0.37), gold);
    sculpture.add(core);
    for (const side of [-1, 1]) {
        for (const z of [-5.4, 5.9]) {
            const x = side * 4.7;
            object(new T.CylinderGeometry(0.32, 0.23, 0.55, 8), black, x, 0.275, z);
            object(new T.TorusGeometry(0.32, 0.02, 5, 8).rotateX(Math.PI / 2), gold, x, 0.55, z);
            object(new T.CylinderGeometry(0.035, 0.06, 1.4, 7), gold, x, 1.25, z);
            const leaves = new T.InstancedMesh(new T.SphereGeometry(1, 8, 4), green, 9);
            const matrix = new T.Matrix4();
            for (let leaf = 0; leaf < 9; leaf++) {
                const angle = leaf * Math.PI * 2 / 9;
                const position = new T.Vector3(x + Math.sin(angle) * 0.32, 1.88, z + Math.cos(angle) * 0.32);
                const rotation = new T.Quaternion().setFromEuler(new T.Euler(0.8, angle, 0));
                matrix.compose(position, rotation, new T.Vector3(0.12, 0.6, 0.035));
                leaves.setMatrixAt(leaf, matrix);
            }
            scene.add(leaves);
        }
    }
    for (const x of [-1.13, 1.13]) {
        b.box(gold, 0.15, 3.3, 0.16, x, 1.65, 7.9);
        b.box(ivory, 0.08, 3.25, 0.2, x + Math.sign(x) * 0.15, 1.625, 7.9);
    }
    b.box(gold, 2.4, 0.15, 0.18, 0, 3.28, 7.9);
    const exit = object(new T.PlaneGeometry(2.1, 3.2), new T.MeshBasicMaterial({ color: 0xafd0ce, side: T.DoubleSide }), 0, 1.6, 7.99);
    exit.name = "Courtyard doorway";
    b.finish();
    const canStand = (x, z) => Math.abs(x) <= 5.35 && Math.abs(z) <= 7.5 &&
        Math.hypot(x, z - centerZ) > 1.22 &&
        !(Math.abs(Math.abs(x) - 4.1) < 1.0 && Math.abs(z - 3.9) < 1.38) &&
        ![-1, 1].some(side => [-5.4, 5.9].some(pz => Math.hypot(x - side * 4.7, z - pz) < 0.58));
    return {
        surface,
        exit,
        sculpture,
        canStand,
        select: studioPanel.select,
        panelSummary: studioPanel.summary,
    };
}
