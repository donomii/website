/**
 * renderer.js - WebGL Renderer and Math
 */

const Math3D = (() => {
    function identity() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }

    function multiply(a, b) {
        let out = new Float32Array(16);
        for (let i = 0; i < 4; i++) { // row
            for (let j = 0; j < 4; j++) { // col
                out[i + j * 4] = a[i + 0 * 4] * b[0 + j * 4] +
                    a[i + 1 * 4] * b[1 + j * 4] +
                    a[i + 2 * 4] * b[2 + j * 4] +
                    a[i + 3 * 4] * b[3 + j * 4];
            }
        }
        return out;
    }

    function perspective(fovy, aspect, near, far) {
        let f = 1.0 / Math.tan(fovy / 2), nf = 1 / (near - far);
        let out = identity();
        out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = (2 * far * near) * nf; out[15] = 0;
        return out;
    }

    function translate(x, y, z) {
        let out = identity(); out[12] = x; out[13] = y; out[14] = z; return out;
    }

    function scale(x, y, z) {
        let out = identity(); out[0] = x; out[5] = y; out[10] = z; return out;
    }

    function rotateX(rad) {
        let s = Math.sin(rad), c = Math.cos(rad);
        let out = identity(); out[5] = c; out[6] = s; out[9] = -s; out[10] = c; return out;
    }

    function rotateY(rad) {
        let s = Math.sin(rad), c = Math.cos(rad);
        let out = identity(); out[0] = c; out[2] = -s; out[8] = s; out[10] = c; return out;
    }

    function rotateZ(rad) {
        let s = Math.sin(rad), c = Math.cos(rad);
        let out = identity(); out[0] = c; out[1] = s; out[4] = -s; out[5] = c; return out;
    }

    return { identity, multiply, perspective, translate, scale, rotateX, rotateY, rotateZ };
})();

class Renderer {
    constructor(canvas) {
        this.gl = canvas.getContext('webgl');
        if (!this.gl) { alert("WebGL not supported"); return; }
        this.gl.clearColor(0.05, 0.05, 0.05, 1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.initShaders();
        this.models = {};
    }

    initShaders() {
        const vs = `
            attribute vec4 aPosition;
            attribute vec4 aColor;
            attribute vec3 aNormal;
            uniform mat4 uMVP;
            uniform mat4 uModel;
            varying vec4 vColor;
            varying vec3 vNormal;
            void main() {
                gl_Position = uMVP * aPosition;
                vColor = aColor;
                vNormal = mat3(uModel) * aNormal;
            }
        `;
        const fs = `
            precision mediump float;
            varying vec4 vColor;
            varying vec3 vNormal;
            uniform bool uUseLighting;
            void main() {
                if (uUseLighting) {
                    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
                    float diff = max(dot(normalize(vNormal), lightDir), 0.0);
                    gl_FragColor = vec4(vColor.rgb * (0.4 + 0.6 * diff), vColor.a);
                } else {
                    gl_FragColor = vColor;
                }
            }
        `;
        this.program = this.createProgram(vs, fs);
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        return prog;
    }

    drawModel(modelName, mvp, modelMat, color, useLighting, backfaceCull) {
        const gl = this.gl;
        const model = this.models[modelName];
        if (!model || model.count === 0) return;

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uMVP"), false, mvp);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "uModel"), false, modelMat);
        gl.uniform1i(gl.getUniformLocation(this.program, "uUseLighting"), useLighting ? 1 : 0);

        if (backfaceCull) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);

        this.bindBuffer(model.pos, gl.getAttribLocation(this.program, "aPosition"), 3);
        this.bindBuffer(model.col, gl.getAttribLocation(this.program, "aColor"), 4);
        this.bindBuffer(model.norm, gl.getAttribLocation(this.program, "aNormal"), 3);

        gl.drawArrays(gl[model.primitive || "TRIANGLES"], 0, model.count);
    }

    bindBuffer(buffer, loc, size) {
        const gl = this.gl;
        if (loc < 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }

    buildModel(name, vertices, colors, normals, primitive) {
        const gl = this.gl;
        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        const colBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        const normBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        this.models[name] = { pos: posBuf, col: colBuf, norm: normBuf, count: vertices.length / 3, primitive: primitive || "TRIANGLES" };
    }
}
