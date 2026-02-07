/**
 * lsys.js - L-System Engine and Interpreter
 */

const LSystemEngine = (() => {
    function tokenize(s) {
        return s.trim().split(/\s+/).filter(t => t.length > 0);
    }

    function rewrite(commands, rules) {
        let newList = [];
        for (let i = 0; i < commands.length; i++) {
            const token = commands[i];
            if (rules[token]) {
                newList = newList.concat(rules[token]);
            } else {
                newList.push(token);
            }
        }
        return newList;
    }

    function runRules(commands, rules, recursion) {
        let currentList = commands;
        for (let i = 0; i < recursion; i++) {
            currentList = rewrite(currentList, rules);
        }
        return currentList;
    }

    function runRuleset(input, globalRuleBook, metaData) {
        let output = input;
        for (let i = 0; i < 50; i++) {
            let newOutput = [];
            let changed = false;
            for (let j = 0; j < output.length; j++) {
                const token = output[j];
                const rules = globalRuleBook[token];
                if (rules) {
                    const meta = metaData[token];
                    const depth = meta ? (meta.iterations || 1) : 1;
                    const expanded = runRules([token], rules, depth);
                    newOutput = newOutput.concat(expanded);
                    changed = true;
                } else {
                    newOutput.push(token);
                }
            }
            output = newOutput;
            if (!changed) break;
        }
        return output;
    }

    class Interpreter {
        constructor() {
            this.stateStack = [];
            this.attribStack = [];
            this.triBuf = [];
            this.colBuf = [];
        }

        // Signature: interpret(commands, transform, buildMode, context, paintCallback)
        interpret(commands, transform, buildMode, context, paintCallback) {
            let a = {
                red: 1, green: 1, blue: 1, alpha: 1,
                angle: 0.3, useLighting: false, mirror: false
            };

            for (let i = 0; i < commands.length; i++) {
                const c = commands[i];
                if (c === "F") {
                    transform = Math3D.multiply(transform, Math3D.translate(0, 1, 0));
                } else if (c === "f") {
                    transform = Math3D.multiply(transform, Math3D.translate(0, -1, 0));
                } else if (c === "Y") {
                    transform = Math3D.multiply(transform, Math3D.rotateZ(a.angle));
                } else if (c === "y") {
                    transform = Math3D.multiply(transform, Math3D.rotateZ(-a.angle));
                } else if (c === "R") {
                    transform = Math3D.multiply(transform, Math3D.rotateY(a.angle));
                } else if (c === "r") {
                    transform = Math3D.multiply(transform, Math3D.rotateY(-a.angle));
                } else if (c === "P") {
                    transform = Math3D.multiply(transform, Math3D.rotateX(a.angle));
                } else if (c === "p") {
                    transform = Math3D.multiply(transform, Math3D.rotateX(-a.angle));
                } else if (c === "[") {
                    this.stateStack.push(new Float32Array(transform));
                    this.attribStack.push(Object.assign({}, a));
                } else if (c === "]") {
                    if (this.stateStack.length > 0) transform = this.stateStack.pop();
                    if (this.attribStack.length > 0) a = this.attribStack.pop();
                } else if (c === "s") {
                    transform = Math3D.multiply(transform, Math3D.scale(0.666, 0.666, 0.666));
                } else if (c === "S") {
                    transform = Math3D.multiply(transform, Math3D.scale(1.5, 1.5, 1.5));
                } else if (c === "hs") {
                    transform = Math3D.multiply(transform, Math3D.scale(0.5, 0.5, 0.5));
                } else if (c === "hS") {
                    transform = Math3D.multiply(transform, Math3D.scale(2, 2, 2));
                } else if (c === "HR") {
                    transform = Math3D.multiply(transform, Math3D.rotateY(context.clock * Math.PI * 2));
                    if (context.hrCompensation) transform = Math3D.multiply(transform, Math3D.rotateX(context.hrCompensation));
                } else if (c === "T" || c === "TF") {
                    if (buildMode) this.addTriangle(transform, a);
                    if (c === "TF") transform = Math3D.multiply(transform, Math3D.translate(0, 1, 0));
                } else if (c === "Q") {
                    if (buildMode) this.addQuad(transform, a);
                } else if (c === "." || c === "op") {
                    if (buildMode) this.addPoint(transform, a);
                } else if (c === "origin") {
                    if (buildMode) { this.triBuf.push(0, 0, 0); this.addColor(a); }
                } else if (c === "reverseTriangle") {
                    if (buildMode) this.reverseLastTriangle();
                } else if (c === "LightsOn") {
                    a.useLighting = true;
                } else if (c === "LightsOff") {
                    a.useLighting = false;
                } else if (c.startsWith("Colour")) {
                    const rgb = c.substring(6).split(',').map(Number);
                    if (rgb.length === 3) { a.red = rgb[0] / 255; a.green = rgb[1] / 255; a.blue = rgb[2] / 255; }
                } else if (c.startsWith("A")) {
                    a.angle = parseFloat(c.substring(1));
                } else if (c.startsWith("Scale(")) {
                    const s = c.match(/Scale\(([^,]+),([^,]+),([^)]+)\)/);
                    if (s) transform = Math3D.multiply(transform, Math3D.scale(parseFloat(s[1]), parseFloat(s[2]), parseFloat(s[3])));
                } else if (c.startsWith("RandScale(")) {
                    const s = c.match(/RandScale\(([^,]+),([^)]+)\)/);
                    if (s) {
                        const val = parseFloat(s[1]) + Math.random() * (parseFloat(s[2]) - parseFloat(s[1]));
                        transform = Math3D.multiply(transform, Math3D.scale(val, val, val));
                    }
                } else if (c.startsWith("Hinge(")) {
                    const h = c.match(/Hinge\(([0-9]+)\)/);
                    if (h && context.hinges) {
                        const idx = parseInt(h[1]);
                        if (context.hinges[idx] !== undefined) transform = Math3D.multiply(transform, Math3D.rotateY(context.hinges[idx]));
                    }
                } else if (c.startsWith("V(")) {
                    const v = c.match(/V\(([^,]+),([^)]+)\)/);
                    if (v && buildMode) {
                        const p = this.xform(transform, [parseFloat(v[1]), parseFloat(v[2]), 0]);
                        this.triBuf.push(...p); this.addColor(a);
                    }
                } else if (!buildMode && paintCallback) {
                    paintCallback(transform, c, a);
                }
            }
            return { vertices: this.triBuf, colors: this.colBuf };
        }

        addPoint(trans, a) {
            const p = this.xform(trans, [0, 0, 0]);
            this.triBuf.push(...p); this.addColor(a);
        }

        addTriangle(trans, a) {
            const p1 = this.xform(trans, [0, 1, 0]), p2 = this.xform(trans, [-0.1, 0, 0]), p3 = this.xform(trans, [0.1, 0, 0]);
            this.triBuf.push(...p1, ...p2, ...p3);
            for (let i = 0; i < 3; i++) this.addColor(a);
        }

        addQuad(trans, a) {
            const p1 = this.xform(trans, [-1, -1, 0]), p2 = this.xform(trans, [1, -1, 0]), p3 = this.xform(trans, [1, 1, 0]), p4 = this.xform(trans, [-1, 1, 0]);
            this.triBuf.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
            for (let i = 0; i < 6; i++) this.addColor(a);
        }

        addColor(a) { this.colBuf.push(a.red, a.green, a.blue, a.alpha); }

        reverseLastTriangle() {
            const b = this.triBuf; if (b.length < 9) return;
            const s = b.length - 6;
            const t = [b[s], b[s + 1], b[s + 2]];
            b[s] = b[s + 3]; b[s + 1] = b[s + 4]; b[s + 2] = b[s + 5];
            b[s + 3] = t[0]; b[s + 4] = t[1]; b[s + 5] = t[2];
        }

        xform(m, v) {
            const x = v[0], y = v[1], z = v[2];
            return [
                m[0] * x + m[4] * y + m[8] * z + m[12],
                m[1] * x + m[5] * y + m[9] * z + m[13],
                m[2] * x + m[6] * y + m[10] * z + m[14]
            ];
        }
    }

    function calculateNormals(v) {
        if (!v || v.length < 9) return new Float32Array(0);
        const n = new Float32Array(v.length);
        for (let i = 0; i < v.length; i += 9) {
            const ax = v[i + 3] - v[i], ay = v[i + 4] - v[i + 1], az = v[i + 5] - v[i + 2];
            const bx = v[i + 6] - v[i], by = v[i + 7] - v[i + 1], bz = v[i + 8] - v[i + 2];
            const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            for (let j = 0; j < 3; j++) { n[i + j * 3] = nx / len; n[i + j * 3 + 1] = ny / len; n[i + j * 3 + 2] = nz / len; }
        }
        return n;
    }

    return { runRuleset, tokenize, Interpreter, calculateNormals };
})();
