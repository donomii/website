import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const QUATERNIUS_ROOT = './assets/quaternius/ultimate-monsters';
const CROSS_FADE_SECONDS = 0.2;
const MAX_MIXER_STEP_SECONDS = 0.1;

const MODEL_DEFINITIONS = [
    {
        id: 'quaternius-alien', label: 'Quaternius Alien', file: 'Alien.fbx',
        walk: 'CharacterArmature|Run', idle: 'CharacterArmature|Idle', height: 1.55, collisionRadius: 0.75
    },
    {
        id: 'quaternius-birb', label: 'Quaternius Birb', file: 'Birb.fbx',
        walk: 'CharacterArmature|Run', idle: 'CharacterArmature|Idle', height: 0.8, collisionRadius: 0.6
    },
    {
        id: 'quaternius-demon-fbx', label: 'Quaternius Demon', file: 'Demon.fbx',
        walk: 'CharacterArmature|Run', idle: 'CharacterArmature|Idle', height: 1.65, collisionRadius: 0.8
    },
    {
        id: 'quaternius-fish-fbx', label: 'Quaternius Fish', file: 'Fish.fbx',
        walk: 'CharacterArmature|Run', idle: 'CharacterArmature|Idle', height: 0.85, collisionRadius: 0.6
    }
];

export const FBX_MODEL_COUNT = MODEL_DEFINITIONS.length;

function requireAnimation(definition, animations, name, purpose) {
    const clip = THREE.AnimationClip.findByName(animations, name);
    if (clip === null || clip === undefined) {
        const available = animations.map(animation => animation.name).join(', ');
        throw new Error(`${definition.label}: got animations [${available}]; expected ${name} for ${purpose}`);
    } else {
        return clip;
    }
}

function prepareTemplate(definition, template) {
    let meshCount = 0;
    template.traverse(node => {
        const isMesh = node.isMesh === true;
        if (isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            meshCount++;
        } else {
            node.castShadow = false;
            node.receiveShadow = false;
        }
    });
    if (meshCount > 0) {
        return template;
    } else {
        throw new Error(`${definition.label}: got ${meshCount} renderable meshes; expected at least one while preparing the FBX actor`);
    }
}

function measureTemplate(definition, template) {
    template.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(template);
    const size = bounds.getSize(new THREE.Vector3());
    const validHeight = !bounds.isEmpty() && Number.isFinite(size.y) && size.y > 0;
    if (validHeight) {
        const scale = definition.height / size.y;
        return {
            scale,
            offsetX: -(bounds.min.x + bounds.max.x) * 0.5 * scale,
            offsetY: -bounds.min.y * scale,
            offsetZ: -(bounds.min.z + bounds.max.z) * 0.5 * scale
        };
    } else {
        throw new Error(`${definition.label}: got measured height ${size.y}; expected a non-empty finite FBX actor while normalizing it`);
    }
}

class FBXActor {
    constructor(asset) {
        this.asset = asset;
        this.object = new THREE.Group();
        this.model = cloneSkeleton(asset.template);
        this.model.scale.setScalar(asset.transform.scale);
        this.model.position.set(asset.transform.offsetX, asset.transform.offsetY, asset.transform.offsetZ);
        this.object.add(this.model);
        this.object.userData.modelName = asset.definition.id;
        this.mixer = new THREE.AnimationMixer(this.model);
        this.walkAction = this.mixer.clipAction(asset.walk);
        this.idleAction = this.mixer.clipAction(asset.idle);
        this.walkAction.setEffectiveTimeScale(1);
        this.idleAction.setEffectiveTimeScale(1);
        this.activeAction = this.idleAction;
        this.activeAction.play();
        this.lastTime = null;
    }

    update(time, moving) {
        const requestedAction = moving ? this.walkAction : this.idleAction;
        if (requestedAction !== this.activeAction) {
            requestedAction.reset();
            requestedAction.play();
            this.activeAction.crossFadeTo(requestedAction, CROSS_FADE_SECONDS, true);
            this.activeAction = requestedAction;
        } else {
            this.activeAction.enabled = true;
        }
        const elapsed = this.lastTime === null ? 0 : time - this.lastTime;
        const delta = Math.min(MAX_MIXER_STEP_SECONDS, Math.max(0, elapsed));
        this.lastTime = time;
        this.mixer.update(delta);
    }
}

class FBXModelAsset {
    constructor(definition, template) {
        this.definition = definition;
        this.template = prepareTemplate(definition, template);
        this.walk = requireAnimation(definition, template.animations, definition.walk, 'movement');
        this.idle = requireAnimation(definition, template.animations, definition.idle, 'waiting');
        this.transform = measureTemplate(definition, this.template);
        this.height = definition.height;
        this.collisionRadius = definition.collisionRadius;
        this.carryHeight = definition.height + 0.45;
        this.label = definition.label;
    }

    createActor() {
        return new FBXActor(this);
    }
}

async function loadModel(definition) {
    const path = `${QUATERNIUS_ROOT}/${definition.file}`;
    let template;
    try {
        template = await new FBXLoader().loadAsync(path);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${definition.label}: loading ${path} failed with ${message}; expected a valid animated FBX model`);
    }
    if (template.animations.length > 0) {
        return new FBXModelAsset(definition, template);
    } else {
        throw new Error(`${definition.label}: got ${template.animations.length} animation clips from ${path}; expected movement and idle clips`);
    }
}

export function createFBXCreatureModelLoadJobs() {
    return MODEL_DEFINITIONS.map(definition => ({
        id: definition.id,
        label: definition.label,
        load: () => loadModel(definition)
    }));
}
