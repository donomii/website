import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { openZActors } from './openz-actors.js?v=20261124-1';

const root = new URL('./assets/openz/', import.meta.url);
const stage = document.querySelector('#stage');
const status = stage.querySelector('output');
const model = document.querySelector('#model');
const motion = document.querySelector('#motion');
const motionLabel = document.querySelector('#motion-label');
const download = document.querySelector('#download');
const renderer = new THREE.WebGLRenderer({ canvas: stage.querySelector('canvas'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202832);
scene.add(new THREE.HemisphereLight(0xfff6e5, 0x929fac, 2.25));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(4, 6, 3);
scene.add(key);
const camera = new THREE.PerspectiveCamera(36, 1, .01, 10000);
const orbit = new OrbitControls(camera, renderer.domElement);
const clock = new THREE.Clock();
let entries = [], current = null, mixer = null, clips = [], revision = 0;

new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = stage;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (current) frame(current);
}).observe(stage);
renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    mixer?.update(dt);
    renderer.render(scene, camera);
});

function dispose(object) {
    const resources = new Set();
    object.traverse(node => {
        if (node.geometry) resources.add(node.geometry);
        if (node.skeleton) resources.add(node.skeleton);
        for (const mat of [].concat(node.material || [])) {
            resources.add(mat);
            for (const value of Object.values(mat)) {
                if (value?.isTexture) resources.add(value);
            }
        }
    });
    for (const resource of resources) resource.dispose();
}

function frame(object) {
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object, true);
    if (bounds.isEmpty()) {
        object.traverse(node => { if (node.isBone) bounds.expandByPoint(node.getWorldPosition(new THREE.Vector3())); });
    }
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (!(sphere.radius > 0) || !Number.isFinite(sphere.radius)) throw new Error('No measurable model bounds');
    const distance = 1.08 * sphere.radius / Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect)));
    orbit.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(.8, .45, 1).normalize(), distance);
    camera.near = Math.max(.00001, sphere.radius / 500);
    camera.far = distance + sphere.radius * 100;
    camera.updateProjectionMatrix();
    orbit.minDistance = .12 * sphere.radius;
    orbit.maxDistance = 30 * distance;
    orbit.update();
}

async function loadEntry(entry, url) {
    if (entry.actor || entry.path.endsWith('.glb')) {
        const gltf = await new GLTFLoader().loadAsync(entry.actor ? new URL('actors/' + entry.actor.file, root).href : url);
        return [gltf.scene, gltf.animations];
    } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const manager = new THREE.LoadingManager();
        const buffer = await response.arrayBuffer();
        const blobs = new Set();
        let loading = false;
        const images = new Promise((resolve, reject) => {
            manager.onStart = () => { loading = true; };
            manager.onLoad = resolve;
            manager.onError = resource => reject(new Error('Could not read the model texture ' + resource));
        });
        manager.setURLModifier(request => {
            if (request.startsWith('blob:')) blobs.add(request);
            if (/^(data:|blob:)/.test(request)) return request;
            const key = request.split(/[\\/]/).pop();
            const texture = entry.textures?.[key];
            if (!texture) throw new Error('Missing source texture ' + key);
            return new URL(texture, root).href;
        });
        try {
            const result = new FBXLoader(manager).parse(buffer, '');
            if (entry.mesh === false) result.add(new THREE.SkeletonHelper(result));
            if (loading) await images;
            return [result, result.animations];
        } finally {
            for (const blob of blobs) URL.revokeObjectURL(blob);
        }
    }
}

function play() {
    if (mixer) {
        mixer.stopAllAction();
        const clip = clips[Number(motion.value)];
        if (clip) mixer.clipAction(clip).play();
        mixer.update(0);
    }
}

async function select() {
    const ticket = ++revision;
    const entry = entries[Number(model.value)];
    const url = new URL('originals/' + entry.path, root).href;
    download.href = url;
    download.hidden = false;
    download.download = entry.path.split('/').pop();
    stage.dataset.state = 'loading';
    status.textContent = 'Loading ' + download.download + '…';
    status.hidden = false;
    motionLabel.hidden = true;
    if (current) {
        mixer?.stopAllAction();
        scene.remove(current);
        dispose(current);
        current = null;
        mixer = null;
    }
    try {
        const [object, animations] = await loadEntry(entry, url);
        if (ticket !== revision) { dispose(object); return; }
        current = object;
        scene.add(object);
        clips = animations;
        mixer = clips.length ? new THREE.AnimationMixer(object) : null;
        motion.replaceChildren(...clips.map((clip, i) => new Option(clip.name || 'Motion ' + (i + 1), i)));
        const idle = clips.findIndex(clip => clip.name === 'Idle');
        motion.selectedIndex = idle >= 0 ? idle : 0;
        motionLabel.hidden = !clips.length;
        play();
        frame(object);
        stage.dataset.state = 'ready';
        status.hidden = true;
    } catch (error) {
        if (ticket === revision) {
            status.textContent = 'Could not display ' + download.download + ': ' + error.message;
            stage.dataset.state = 'error';
        }
    }
}

async function start() {
    const response = await fetch(new URL('catalog.json', root));
    if (!response.ok) throw new Error('Model catalog returned HTTP ' + response.status);
    const originals = await response.json();
    const actors = openZActors.map(actor => ({ actor, path: actor.original }));
    entries = [...actors, ...originals];
    const groups = new Map();
    entries.forEach((entry, i) => {
        const parts = entry.path.split('/');
        const name = parts.pop();
        const group = entry.actor ? 'Creatures' : parts.join(' / ');
        if (!groups.has(group)) {
            const node = document.createElement('optgroup');
            node.label = group;
            groups.set(group, node);
            model.append(node);
        }
        groups.get(group).append(new Option(entry.actor ? entry.actor.label : name, i));
    });
    model.addEventListener('change', select);
    motion.addEventListener('change', play);
    await select();
}
start().catch(error => { status.textContent = error.message; stage.dataset.state = 'error'; });

