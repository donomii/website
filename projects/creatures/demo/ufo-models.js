import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const ASSET_ROOT = './assets/ufoai';
const MD2_HEADER_SIZE = 68;
const MD2_MAX_VERTICES = 2048;
const MD2_MAX_TRIANGLES = 4096;
const MD2_MAX_FRAMES = 1024;
const ANIMATION_UPDATES_PER_SECOND = 30;

const MODEL_DEFINITIONS = [
    {
        id: 'alien', label: 'Taman', directory: 'taman',
        body: 'body01.md2', animations: 'body01.anm', skin: 'body01a.png',
        head: 'head01.md2', headSkin: 'head01.png', tags: 'body01.tag',
        walk: 'walk2', idle: 'stand2', height: 2.0, collisionRadius: 0.7
    },
    {
        id: 'ortnok', label: 'Ortnok', directory: 'ortnok',
        body: 'body.md2', animations: 'body.anm', skin: 'body.png',
        head: 'head.md2', headSkin: 'head.png', tags: 'body.tag',
        walk: 'walk2', idle: 'stand2', height: 2.25, collisionRadius: 0.85
    },
    {
        id: 'shevaar', label: 'Shevaar', directory: 'shevaar',
        body: 'body.md2', animations: 'body.anm', skin: 'body.jpg',
        head: 'head.md2', headSkin: 'head.jpg', tags: 'body.tag',
        walk: 'walk2', idle: 'stand2', height: 2.15, collisionRadius: 0.8
    },
    {
        id: 'bloodspider', label: 'Bloodspider', directory: 'bloodspider',
        body: 'body.md2', animations: 'body.anm', skin: 'body.jpg',
        head: 'head.md2', headSkin: null, tags: 'body.tag',
        walk: 'walk2', idle: 'stand2', height: 1.15, collisionRadius: 0.75
    },
    {
        id: 'hovernet', label: 'Hovernet', directory: 'hovernet',
        body: 'body.md2', animations: 'body.anm', skin: 'body.jpg',
        head: 'head.md2', headSkin: null, tags: 'body.tag',
        walk: 'walk0', idle: 'stand0', height: 1.45, collisionRadius: 0.8
    },
    {
        id: 'alientank', label: 'Alien Tank', directory: 'alientank',
        body: 'body.md2', animations: 'body.anm', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        walk: 'walk0', idle: 'stand0', height: 1.8, collisionRadius: 1.0
    },
    {
        id: 'soldier', label: 'PHALANX Soldier', directory: 'soldier',
        body: 'body.md2', animations: 'body.anm', skin: 'body.png',
        head: 'head.md2', headSkin: 'head.png', tags: 'body.tag',
        walk: 'walk0', idle: 'stand0', height: 2.0, collisionRadius: 0.7
    },
    {
        id: 'female-soldier', label: 'PHALANX Soldier Woman', directory: 'female-soldier',
        body: 'body.md2', animations: 'body.anm', skin: 'body.png',
        head: 'head.md2', headSkin: 'head.png', tags: 'body.tag',
        walk: 'walk0', idle: 'stand0', height: 2.0, collisionRadius: 0.7
    },
    {
        id: 'civilian', label: 'Civilian', directory: 'civilian',
        body: 'body.md2', animations: 'body.anm', skin: 'body.jpg',
        head: 'head.md2', headSkin: 'head.jpg', tags: 'body.tag',
        walk: 'walk0', idle: 'stand0', height: 1.95, collisionRadius: 0.7
    }
];

export const UFO_MODEL_COUNT = MODEL_DEFINITIONS.length;

function readASCII(view, offset, length) {
    let value = '';
    for (let index = 0; index < length; index++) {
        const byte = view.getUint8(offset + index);
        value += byte === 0 ? '' : String.fromCharCode(byte);
    }
    return value;
}

function validateMD2Header(label, view, header) {
    if (header.skinWidth <= 0 || header.skinHeight <= 0) {
        throw new Error(`${label}: got skin size ${header.skinWidth}x${header.skinHeight}; expected positive dimensions`);
    } else if (header.numVertices < 1 || header.numVertices > MD2_MAX_VERTICES) {
        throw new Error(`${label}: got ${header.numVertices} vertices; expected 1..${MD2_MAX_VERTICES}`);
    } else if (header.numTriangles < 1 || header.numTriangles > MD2_MAX_TRIANGLES) {
        throw new Error(`${label}: got ${header.numTriangles} triangles; expected 1..${MD2_MAX_TRIANGLES}`);
    } else if (header.numFrames < 1 || header.numFrames > MD2_MAX_FRAMES) {
        throw new Error(`${label}: got ${header.numFrames} frames; expected 1..${MD2_MAX_FRAMES}`);
    } else if (header.frameSize !== 40 + header.numVertices * 4) {
        throw new Error(`${label}: got frame size ${header.frameSize}; expected ${40 + header.numVertices * 4}`);
    } else if (header.offsetEnd !== view.byteLength) {
        throw new Error(`${label}: header ends at ${header.offsetEnd}; file has ${view.byteLength} bytes`);
    } else {
        const textureEnd = header.offsetTexCoords + header.numTexCoords * 4;
        const triangleEnd = header.offsetTriangles + header.numTriangles * 12;
        const frameEnd = header.offsetFrames + header.numFrames * header.frameSize;
        if (header.offsetTexCoords < MD2_HEADER_SIZE || textureEnd > view.byteLength) {
            throw new Error(`${label}: texture-coordinate section is outside the ${view.byteLength}-byte file`);
        } else if (header.offsetTriangles < textureEnd || triangleEnd > view.byteLength) {
            throw new Error(`${label}: triangle section is unordered or outside the ${view.byteLength}-byte file`);
        } else if (header.offsetFrames < triangleEnd || frameEnd > view.byteLength) {
            throw new Error(`${label}: frame section is unordered or outside the ${view.byteLength}-byte file`);
        } else {
            return;
        }
    }
}

function parseMD2(label, buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < MD2_HEADER_SIZE) {
        throw new Error(`${label}: got ${view.byteLength} bytes; expected at least a ${MD2_HEADER_SIZE}-byte MD2 header`);
    } else if (readASCII(view, 0, 4) !== 'IDP2' || view.getInt32(4, true) !== 8) {
        throw new Error(`${label}: expected Quake II MD2 magic IDP2 and version 8`);
    } else {
        const header = {
            skinWidth: view.getInt32(8, true), skinHeight: view.getInt32(12, true),
            frameSize: view.getInt32(16, true), numVertices: view.getInt32(24, true),
            numTexCoords: view.getInt32(28, true), numTriangles: view.getInt32(32, true),
            numFrames: view.getInt32(40, true), offsetTexCoords: view.getInt32(48, true),
            offsetTriangles: view.getInt32(52, true), offsetFrames: view.getInt32(56, true),
            offsetEnd: view.getInt32(64, true)
        };
        validateMD2Header(label, view, header);
        return createMD2Model(label, view, header);
    }
}

function createMD2Model(label, view, header) {
    const textureCoordinates = new Float32Array(header.numTexCoords * 2);
    for (let index = 0; index < header.numTexCoords; index++) {
        const offset = header.offsetTexCoords + index * 4;
        textureCoordinates[index * 2] = view.getInt16(offset, true) / header.skinWidth;
        textureCoordinates[index * 2 + 1] = 1 - view.getInt16(offset + 2, true) / header.skinHeight;
    }
    const sourceVertices = new Uint16Array(header.numTriangles * 3);
    const uvs = new Float32Array(header.numTriangles * 6);
    for (let triangle = 0; triangle < header.numTriangles; triangle++) {
        const offset = header.offsetTriangles + triangle * 12;
        for (let corner = 0; corner < 3; corner++) {
            const target = triangle * 3 + corner;
            const vertex = view.getUint16(offset + corner * 2, true);
            const textureCoordinate = view.getUint16(offset + 6 + corner * 2, true);
            if (vertex >= header.numVertices || textureCoordinate >= header.numTexCoords) {
                throw new Error(`${label}: triangle ${triangle} corner ${corner} references vertex ${vertex}/${header.numVertices} or texture coordinate ${textureCoordinate}/${header.numTexCoords}`);
            } else {
                sourceVertices[target] = vertex;
                uvs[target * 2] = textureCoordinates[textureCoordinate * 2];
                uvs[target * 2 + 1] = textureCoordinates[textureCoordinate * 2 + 1];
            }
        }
    }
    const frames = [];
    for (let index = 0; index < header.numFrames; index++) {
        const offset = header.offsetFrames + index * header.frameSize;
        frames.push({
            name: readASCII(view, offset + 24, 16),
            scale: [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)],
            translate: [view.getFloat32(offset + 12, true), view.getFloat32(offset + 16, true), view.getFloat32(offset + 20, true)],
            verticesOffset: offset + 40
        });
    }
    return { view, header, frames, sourceVertices, uvs };
}

function parseAnimations(label, text, frameCount) {
    const animations = new Map();
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].split('//', 1)[0].trim();
        if (line === '') {
            continue;
        } else {
            const fields = line.split(/\s+/);
            const first = Number.parseInt(fields[1], 10);
            const last = Number.parseInt(fields[2], 10);
            const fps = Number.parseFloat(fields[3]);
            if (fields.length !== 4 || !Number.isInteger(first) || !Number.isInteger(last) || !Number.isFinite(fps)) {
                throw new Error(`${label}:${lineIndex + 1}: expected name, first frame, last frame, and FPS; got ${JSON.stringify(line)}`);
            } else if (first < 0 || last < first || last >= frameCount || fps <= 0) {
                throw new Error(`${label}:${lineIndex + 1}: animation ${fields[0]} has frames ${first}..${last} at ${fps} FPS; expected an ordered in-range animation`);
            } else if (animations.has(fields[0])) {
                throw new Error(`${label}:${lineIndex + 1}: animation ${fields[0]} is declared more than once`);
            } else {
                animations.set(fields[0], { name: fields[0], first, last, fps });
            }
        }
    }
    if (animations.size > 0) {
        return animations;
    } else {
        throw new Error(`${label}: got no animation rows; expected at least one`);
    }
}

function parseFramePrefixAnimations(definition, model) {
    const animations = new Map();
    for (const clip of definition.frameAnimations) {
        const matchingFrames = [];
        for (let frameIndex = 0; frameIndex < model.frames.length; frameIndex++) {
            if (model.frames[frameIndex].name.startsWith(clip.prefix)) {
                matchingFrames.push(frameIndex);
            } else {
                continue;
            }
        }
        if (matchingFrames.length === 0) {
            throw new Error(`${definition.label}: got no MD2 frames beginning with ${clip.prefix}; expected frames for ${clip.name}`);
        } else if (!Number.isFinite(clip.fps) || clip.fps <= 0) {
            throw new Error(`${definition.label}: got ${clip.fps} FPS for ${clip.name}; expected a positive frame rate`);
        } else if (animations.has(clip.name)) {
            throw new Error(`${definition.label}: frame-prefix animation ${clip.name} is declared more than once`);
        } else {
            for (let index = 1; index < matchingFrames.length; index++) {
                if (matchingFrames[index] !== matchingFrames[index - 1] + 1) {
                    throw new Error(`${definition.label}: MD2 frames beginning with ${clip.prefix} are not contiguous`);
                } else {
                    continue;
                }
            }
            animations.set(clip.name, {
                name: clip.name,
                first: matchingFrames[0],
                last: matchingFrames[matchingFrames.length - 1],
                fps: clip.fps
            });
        }
    }
    if (animations.size > 0) {
        return animations;
    } else {
        throw new Error(`${definition.label}: got no frame-prefix animations; expected at least one`);
    }
}

function parseSauerbratenAnimations(label, text, frameCount) {
    const animations = new Map();
    const lines = text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].split('//', 1)[0].trim();
        if (line === '' || !line.startsWith('md2anim ')) {
            continue;
        } else {
            const match = /^md2anim\s+(?:"([^"]+)"|(\S+))\s+(\d+)\s+(\d+)(?:\s+(\d+(?:\.\d+)?))?$/.exec(line);
            if (match === null) {
                throw new Error(`${label}:${lineIndex + 1}: expected md2anim name, first frame, frame count, and optional FPS; got ${JSON.stringify(line)}`);
            } else {
                const first = Number.parseInt(match[3], 10);
                const count = Number.parseInt(match[4], 10);
                const last = first + count - 1;
                const fps = match[5] === undefined ? 10 : Number.parseFloat(match[5]);
                if (count < 1 || first < 0 || last >= frameCount || !Number.isFinite(fps) || fps <= 0) {
                    throw new Error(`${label}:${lineIndex + 1}: got frames ${first}..${last} at ${fps} FPS; expected an in-range animation`);
                } else {
                    const aliases = (match[1] === undefined ? match[2] : match[1]).split('|');
                    for (const name of aliases) {
                        if (animations.has(name)) {
                            throw new Error(`${label}:${lineIndex + 1}: animation ${name} is declared more than once`);
                        } else {
                            animations.set(name, { name, first, last, fps });
                        }
                    }
                }
            }
        }
    }
    if (animations.size > 0) {
        return animations;
    } else {
        throw new Error(`${label}: got no md2anim rows; expected at least one`);
    }
}

function parseModelAnimations(definition, animationText, body) {
    if (definition.animationFormat === 'frame-prefix') {
        if (animationText === null) {
            return parseFramePrefixAnimations(definition, body);
        } else {
            throw new Error(`${definition.label}: frame-prefix animation must come from the MD2 frame names, not a separate table`);
        }
    } else if (definition.animationFormat === 'sauerbraten-md2cfg') {
        if (animationText === null) {
            throw new Error(`${definition.label}: expected a Sauerbraten md2.cfg animation table`);
        } else {
            return parseSauerbratenAnimations(`${definition.label} animation table`, animationText, body.header.numFrames);
        }
    } else if (definition.animationFormat === undefined || definition.animationFormat === 'ufo-anm') {
        if (animationText === null) {
            throw new Error(`${definition.label}: expected a UFO:AI animation table`);
        } else {
            return parseAnimations(`${definition.label} animation table`, animationText, body.header.numFrames);
        }
    } else {
        throw new Error(`${definition.label}: got unsupported animation format ${definition.animationFormat}`);
    }
}

function parseHeadTags(label, buffer, expectedFrames) {
    const view = new DataView(buffer);
    if (view.byteLength < 32 || readASCII(view, 0, 4) !== 'JDP2' || view.getInt32(4, true) !== 1) {
        throw new Error(`${label}: expected a UFO:AI JDP2 version 1 tag file`);
    } else {
        const tagCount = view.getInt32(8, true);
        const frameCount = view.getInt32(12, true);
        const namesOffset = view.getInt32(16, true);
        const tagsOffset = view.getInt32(20, true);
        const endOffset = view.getInt32(24, true);
        if (tagCount < 1 || tagCount > 64 || frameCount !== expectedFrames || endOffset !== view.byteLength) {
            throw new Error(`${label}: got ${tagCount} tags and ${frameCount} frames in ${view.byteLength} bytes; expected 1..64 tags, ${expectedFrames} frames, and a matching file end`);
        } else {
            const names = [];
            for (let index = 0; index < tagCount; index++) {
                names.push(readASCII(view, namesOffset + index * 64, 64));
            }
            const headIndex = names.indexOf('tag_head');
            if (headIndex < 0) {
                throw new Error(`${label}: got tags ${names.join(', ')}; expected tag_head for the actor head`);
            } else {
                const frames = new Float32Array(frameCount * 12);
                for (let frame = 0; frame < frameCount; frame++) {
                    const record = tagsOffset + (headIndex * frameCount + frame) * 48;
                    for (let value = 0; value < 12; value++) {
                        frames[frame * 12 + value] = view.getFloat32(record + value * 4, true);
                    }
                }
                return frames;
            }
        }
    }
}

async function fetchAsset(path, kind, responseType) {
    const response = await fetch(path);
    if (response.ok) {
        return responseType === 'text' ? response.text() : response.arrayBuffer();
    } else {
        throw new Error(`loading ${kind} from ${path}: got HTTP ${response.status} ${response.statusText}; expected a successful response`);
    }
}

async function loadTexture(path, label) {
    const texture = await new THREE.TextureLoader().loadAsync(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.name = label;
    return texture;
}

function requireAnimation(definition, animations, name, purpose) {
    if (animations.has(name)) {
        return animations.get(name);
    } else {
        throw new Error(`${definition.label}: animation table lacks ${name}; expected the configured ${purpose} animation`);
    }
}

function decodeVertex(model, frameIndex, vertexIndex, target) {
    const frame = model.frames[frameIndex];
    const offset = frame.verticesOffset + vertexIndex * 4;
    target[0] = model.view.getUint8(offset) * frame.scale[0] + frame.translate[0];
    target[1] = model.view.getUint8(offset + 1) * frame.scale[1] + frame.translate[1];
    target[2] = model.view.getUint8(offset + 2) * frame.scale[2] + frame.translate[2];
}

function includePoint(bounds, x, y, z) {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
}

function applyTag(point, tags, frame, target) {
    const offset = frame * 12;
    target[0] = tags[offset + 9] + tags[offset] * point[0] + tags[offset + 3] * point[1] + tags[offset + 6] * point[2];
    target[1] = tags[offset + 10] + tags[offset + 1] * point[0] + tags[offset + 4] * point[1] + tags[offset + 7] * point[2];
    target[2] = tags[offset + 11] + tags[offset + 2] * point[0] + tags[offset + 5] * point[1] + tags[offset + 8] * point[2];
}

function measureActor(asset) {
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    const point = new Float32Array(3);
    const transformed = new Float32Array(3);
    for (let frame = asset.walk.first; frame <= asset.walk.last; frame++) {
        for (let vertex = 0; vertex < asset.body.header.numVertices; vertex++) {
            decodeVertex(asset.body, frame, vertex, point);
            includePoint(bounds, point[0], point[1], point[2]);
        }
        if (asset.head === null) {
            continue;
        } else {
            for (let vertex = 0; vertex < asset.head.header.numVertices; vertex++) {
                decodeVertex(asset.head, 0, vertex, point);
                applyTag(point, asset.headTags, frame, transformed);
                includePoint(bounds, transformed[0], transformed[1], transformed[2]);
            }
        }
    }
    const rawHeight = bounds.maxZ - bounds.minZ;
    if (Number.isFinite(rawHeight) && rawHeight > 0) {
        return {
            centerX: (bounds.minX + bounds.maxX) / 2,
            centerY: (bounds.minY + bounds.maxY) / 2,
            minZ: bounds.minZ,
            scale: asset.definition.height / rawHeight
        };
    } else {
        throw new Error(`${asset.definition.label}: measured raw height ${rawHeight}; expected a finite positive model height`);
    }
}

function createGeometry(model) {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(model.sourceVertices.length * 3), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    geometry.setAttribute('uv', new THREE.BufferAttribute(model.uvs, 2));
    return geometry;
}

function interpolateTag(tags, firstFrame, secondFrame, amount, target) {
    const firstOffset = firstFrame * 12;
    const secondOffset = secondFrame * 12;
    for (let value = 0; value < 12; value++) {
        target[value] = THREE.MathUtils.lerp(tags[firstOffset + value], tags[secondOffset + value], amount);
    }
}

function writeWorldPoint(positions, target, rawX, rawY, rawZ, transform) {
    positions[target] = (rawY - transform.centerY) * transform.scale;
    positions[target + 1] = (rawZ - transform.minZ) * transform.scale;
    positions[target + 2] = (rawX - transform.centerX) * transform.scale;
}

function updateBodyGeometry(asset, geometry, firstFrame, secondFrame, amount) {
    const positions = geometry.attributes.position.array;
    const first = asset.body.frames[firstFrame];
    const second = asset.body.frames[secondFrame];
    for (let target = 0; target < asset.body.sourceVertices.length; target++) {
        const vertex = asset.body.sourceVertices[target];
        const firstOffset = first.verticesOffset + vertex * 4;
        const secondOffset = second.verticesOffset + vertex * 4;
        const rawX = THREE.MathUtils.lerp(asset.body.view.getUint8(firstOffset) * first.scale[0] + first.translate[0], asset.body.view.getUint8(secondOffset) * second.scale[0] + second.translate[0], amount);
        const rawY = THREE.MathUtils.lerp(asset.body.view.getUint8(firstOffset + 1) * first.scale[1] + first.translate[1], asset.body.view.getUint8(secondOffset + 1) * second.scale[1] + second.translate[1], amount);
        const rawZ = THREE.MathUtils.lerp(asset.body.view.getUint8(firstOffset + 2) * first.scale[2] + first.translate[2], asset.body.view.getUint8(secondOffset + 2) * second.scale[2] + second.translate[2], amount);
        writeWorldPoint(positions, target * 3, rawX, rawY, rawZ, asset.transform);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
}

function updateHeadGeometry(asset, geometry, firstFrame, secondFrame, amount, tag) {
    interpolateTag(asset.headTags, firstFrame, secondFrame, amount, tag);
    const positions = geometry.attributes.position.array;
    const frame = asset.head.frames[0];
    for (let target = 0; target < asset.head.sourceVertices.length; target++) {
        const vertex = asset.head.sourceVertices[target];
        const offset = frame.verticesOffset + vertex * 4;
        const x = asset.head.view.getUint8(offset) * frame.scale[0] + frame.translate[0];
        const y = asset.head.view.getUint8(offset + 1) * frame.scale[1] + frame.translate[1];
        const z = asset.head.view.getUint8(offset + 2) * frame.scale[2] + frame.translate[2];
        const rawX = tag[9] + tag[0] * x + tag[3] * y + tag[6] * z;
        const rawY = tag[10] + tag[1] * x + tag[4] * y + tag[7] * z;
        const rawZ = tag[11] + tag[2] * x + tag[5] * y + tag[8] * z;
        writeWorldPoint(positions, target * 3, rawX, rawY, rawZ, asset.transform);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
}

class UFOActor {
    constructor(asset) {
        this.asset = asset;
        this.object = new THREE.Group();
        this.bodyGeometry = createGeometry(asset.body);
        this.bodyMesh = this.createMesh(this.bodyGeometry, asset.bodyTexture);
        this.object.add(this.bodyMesh);
        this.headGeometry = asset.head === null ? null : createGeometry(asset.head);
        this.headMesh = this.headGeometry === null ? null : this.createMesh(this.headGeometry, asset.headTexture);
        if (this.headMesh === null) {
            this.object.userData.hasSeparateHead = false;
        } else {
            this.object.add(this.headMesh);
            this.object.userData.hasSeparateHead = true;
        }
        this.tag = new Float32Array(12);
        this.phaseOffset = Math.random() * 10;
        this.lastTick = -1;
        this.lastAnimation = '';
        this.object.userData.modelName = asset.definition.id;
        this.update(0, false);
    }

    createMesh(geometry, texture) {
        const material = new THREE.MeshStandardMaterial({
            map: texture, roughness: 0.82, metalness: 0, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    update(time, moving) {
        const animation = moving ? this.asset.walk : this.asset.idle;
        const tick = Math.floor(time * ANIMATION_UPDATES_PER_SECOND);
        if (tick !== this.lastTick || animation.name !== this.lastAnimation) {
            this.lastTick = tick;
            this.lastAnimation = animation.name;
            const frameCount = animation.last - animation.first + 1;
            const position = ((time + this.phaseOffset) * animation.fps) % frameCount;
            const localFrame = Math.floor(position);
            const firstFrame = animation.first + localFrame;
            const secondFrame = animation.first + ((localFrame + 1) % frameCount);
            const amount = position - localFrame;
            updateBodyGeometry(this.asset, this.bodyGeometry, firstFrame, secondFrame, amount);
            if (this.headGeometry === null) {
                return;
            } else {
                updateHeadGeometry(this.asset, this.headGeometry, firstFrame, secondFrame, amount, this.tag);
            }
        } else {
            return;
        }
    }
}

class UFOModelAsset {
    constructor(definition, body, head, animations, headTags, bodyTexture, headTexture) {
        this.definition = definition;
        this.body = body;
        this.head = head;
        this.animations = animations;
        this.headTags = headTags;
        this.bodyTexture = bodyTexture;
        this.headTexture = headTexture;
        this.walk = requireAnimation(definition, animations, definition.walk, 'walking');
        this.idle = requireAnimation(definition, animations, definition.idle, 'idle');
        this.transform = measureActor(this);
        this.height = definition.height;
        this.collisionRadius = definition.collisionRadius;
        this.carryHeight = definition.height + 0.45;
        this.label = definition.label;
    }

    createActor() {
        return new UFOActor(this);
    }
}

async function loadModel(definition) {
    const assetRoot = definition.assetRoot === undefined ? ASSET_ROOT : definition.assetRoot;
    const base = `${assetRoot}/${definition.directory}`;
    const headBufferPromise = definition.head === null ? Promise.resolve(null) : fetchAsset(`${base}/${definition.head}`, `${definition.label} head model`, 'buffer');
    const tagBufferPromise = definition.tags === null ? Promise.resolve(null) : fetchAsset(`${base}/${definition.tags}`, `${definition.label} head tags`, 'buffer');
    const headTexturePromise = definition.head === null || definition.headSkin === null ? Promise.resolve(null) : loadTexture(`${base}/${definition.headSkin}`, `${definition.label} head skin`);
    const animationTextPromise = definition.animations === null ? Promise.resolve(null) : fetchAsset(`${base}/${definition.animations}`, `${definition.label} animation table`, 'text');
    const [bodyBuffer, animationText, bodyTexture, headBuffer, tagBuffer, loadedHeadTexture] = await Promise.all([
        fetchAsset(`${base}/${definition.body}`, `${definition.label} body model`, 'buffer'),
        animationTextPromise,
        loadTexture(`${base}/${definition.skin}`, `${definition.label} body skin`),
        headBufferPromise, tagBufferPromise, headTexturePromise
    ]);
    const body = parseMD2(`${definition.label} body model`, bodyBuffer);
    const animations = parseModelAnimations(definition, animationText, body);
    const head = headBuffer === null ? null : parseMD2(`${definition.label} head model`, headBuffer);
    const headTags = tagBuffer === null ? null : parseHeadTags(`${definition.label} head tags`, tagBuffer, body.header.numFrames);
    const headTexture = head === null ? null : (loadedHeadTexture === null ? bodyTexture : loadedHeadTexture);
    return new UFOModelAsset(definition, body, head, animations, headTags, bodyTexture, headTexture);
}

export async function loadModelDefinitions(definitions, onProgress = () => {}) {
    let loaded = 0;
    const assets = await Promise.all(definitions.map(async definition => {
        const asset = await loadModel(definition);
        loaded++;
        onProgress(loaded, definitions.length, definition.label);
        return asset;
    }));
    return assets;
}

export async function loadUFOCreatureModels(onProgress = () => {}) {
    return loadModelDefinitions(MODEL_DEFINITIONS, onProgress);
}
