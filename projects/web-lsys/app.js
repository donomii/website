/**
 * app.js - Application Logic and Interactions
 */

class App {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.renderer = new Renderer(this.canvas);

        this.mode = 'POT'; // GALLERY, SNEK, POT
        this.selection = 0;
        this.rotation = Math3D.identity();
        this.potRotation = Math3D.identity();

        this.hinges = new Array(24).fill(Math.PI);
        this.targetHinges = new Array(24).fill(Math.PI);
        this.snekPatterns = Object.keys(DATA.SNEK_PATTERNS);
        this.snekIndex = 0;

        this.clock = 0;
        this.potRules = POT_GEN.generate();

        this.initEvents();
        this.buildAllModels();
        this.resize();

        setInterval(() => this.updateSnek(), 5000);
        this.updateLabels();
        requestAnimationFrame((t) => this.loop(t));
    }

    buildAllModels() {
        ["Tetrahedron", "Icosahedron", "Prism", "Prism1", "Quad", "lineStar", "Koch2", "Koch3", "Sierpinksi", "Gosper", "Tree3", "3DTreeLeafy", "leaf", "leaf2", "Flower", "Flower10", "Flower11", "starburst"].forEach(m => this.ensureModel(m));
        this.ensurePot();
    }

    ensureModel(name) {
        if (this.renderer.models[name]) return;
        const meta = DATA.META_DATA[name];
        const commands = LSystemEngine.runRuleset([name], DATA.GLOBAL_RULE_BOOK, DATA.META_DATA);
        const interp = new LSystemEngine.Interpreter();
        const res = interp.interpret(commands, Math3D.identity(), true, { clock: 0 });
        if (!res.vertices || res.vertices.length === 0) return;
        const norms = LSystemEngine.calculateNormals(res.vertices);
        this.renderer.buildModel(name, res.vertices, res.colors, norms, meta?.style);
    }

    ensurePot() {
        const name = "RandomBonsai";
        const meta = { "RandomBonsai": { iterations: 5 } };
        const commands = LSystemEngine.runRuleset([name], this.potRules, meta);
        const interp = new LSystemEngine.Interpreter();
        const res = interp.interpret(commands, Math3D.identity(), true, { clock: 0 });
        const norms = LSystemEngine.calculateNormals(res.vertices);
        this.renderer.buildModel(name, res.vertices, res.colors, norms, "TRIANGLES");
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());
        let isDown = false, lastX, lastY;
        this.canvas.addEventListener('mousedown', (e) => { isDown = true; lastX = e.clientX; lastY = e.clientY; });
        window.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            if (this.mode === 'POT') {
                const ry = Math3D.rotateY(dx * 0.01), rx = Math3D.rotateX(dy * 0.01);
                this.potRotation = Math3D.multiply(this.potRotation, Math3D.multiply(ry, rx));
            } else if (this.mode === 'SNEK' || this.mode === 'GALLERY') {
                this.rotation = Math3D.multiply(this.rotation, Math3D.rotateY(dx * 0.01));
            }
            lastX = e.clientX; lastY = e.clientY;
        });
        window.addEventListener('mouseup', () => isDown = false);
        this.canvas.addEventListener('click', (e) => {
            if (this.mode === 'GALLERY') {
                this.selection = (this.selection + 1) % DATA.PLANT_GALLERY.length;
                this.updateLabels();
            }
        });
    }

    updateSnek() {
        if (this.mode !== 'SNEK') return;
        this.snekIndex = (this.snekIndex + 1) % this.snekPatterns.length;
        const p = DATA.SNEK_PATTERNS[this.snekPatterns[this.snekIndex]];
        for (let i = 0; i < p.length; i++) this.targetHinges[i] = (p[i] + 2) * Math.PI / 2;
        this.updateLabels();
    }

    resize() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        this.renderer.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    loop(t) {
        this.clock = (t * 0.001) / 25;
        for (let i = 0; i < 24; i++) this.hinges[i] += (this.targetHinges[i] - this.hinges[i]) * 0.1;
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    draw() {
        const gl = this.renderer.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const aspect = this.canvas.width / this.canvas.height;
        const proj = Math3D.perspective(1.57, aspect, 0.1, 1000);
        const view = Math3D.translate(0, 0, -6);

        let lsys = "", comp = [1, 0, 0], rot = this.rotation;
        if (this.mode === 'GALLERY') {
            lsys = DATA.PLANT_GALLERY[this.selection]; comp = DATA.PLANT_COMPENSATIONS[this.selection];
        } else if (this.mode === 'POT') {
            lsys = "RandomBonsai"; comp = DATA.POT_COMPENSATION; rot = this.potRotation;
        } else {
            lsys = DATA.SNEK_L_SYSTEM; comp = [1, 0, 0];
        }

        const modelBase = Math3D.multiply(Math3D.translate(comp[1], comp[2], 0), Math3D.scale(comp[0], comp[0], comp[0]));
        const modelFinal = Math3D.multiply(modelBase, rot);

        const commands = LSystemEngine.tokenize(lsys);
        const interp = new LSystemEngine.Interpreter();
        interp.interpret(commands, modelFinal, false, { clock: this.clock, hinges: this.hinges }, (trans, name, a) => {
            this.ensureModel(name);
            const mvp = Math3D.multiply(proj, Math3D.multiply(view, trans));
            this.renderer.drawModel(name, mvp, trans, [a.red, a.green, a.blue, a.alpha], a.useLighting, DATA.META_DATA[name]?.backfaceCull);
        });
    }

    updateLabels() {
        const main = document.getElementById('mainLabel');
        const sub = document.getElementById('subLabel');
        if (this.mode === 'GALLERY') {
            main.innerText = DATA.PLANT_LABELS[this.selection];
            sub.innerText = `Plant ${this.selection + 1} of ${DATA.PLANT_GALLERY.length}`;
        } else if (this.mode === 'SNEK') {
            main.innerText = "SNEK";
            sub.innerText = this.snekPatterns[this.snekIndex].toUpperCase();
        } else {
            main.innerText = "BONSAI";
            sub.innerText = "Randomly Generated";
        }
    }

    setMode(m) {
        this.mode = m; this.rotation = Math3D.identity();
        if (m === 'POT') {
            this.potRules = POT_GEN.generate();
            delete this.renderer.models["RandomBonsai"];
            this.ensurePot();
        } else if (m === 'SNEK') {
            this.updateSnek();
        }
        this.updateLabels();
    }
}
