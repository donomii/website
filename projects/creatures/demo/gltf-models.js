import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const QUATERNIUS_ROOT = './assets/quaternius/ultimate-monsters';
const KHRONOS_ROOT = './assets/khronos/fox';
const KAYKIT_ADVENTURERS_ROOT = './assets/kaykit/adventurers';
const KAYKIT_SKELETONS_ROOT = './assets/kaykit/skeletons';
const ROBOT_EXPRESSIVE_ROOT = './assets/threejs/robot-expressive';
const CROSS_FADE_SECONDS = 0.2;
const MAX_MIXER_STEP_SECONDS = 0.1;

const MODEL_DEFINITIONS = [
    {
        id: 'quaternius-blue-demon', label: 'Quaternius Blue Demon', assetRoot: QUATERNIUS_ROOT,
        file: 'BlueDemon.gltf', walk: 'Run', idle: 'Idle', height: 1.9, collisionRadius: 0.85
    },
    {
        id: 'quaternius-bunny', label: 'Quaternius Bunny', assetRoot: QUATERNIUS_ROOT,
        file: 'Bunny.gltf', walk: 'Run', idle: 'Idle', height: 1.15, collisionRadius: 0.65
    },
    {
        id: 'quaternius-cactoro', label: 'Quaternius Cactoro', assetRoot: QUATERNIUS_ROOT,
        file: 'Cactoro.gltf', walk: 'Run', idle: 'Idle', height: 1.4, collisionRadius: 0.7
    },
    {
        id: 'quaternius-dino', label: 'Quaternius Dino', assetRoot: QUATERNIUS_ROOT,
        file: 'Dino.gltf', walk: 'Run', idle: 'Idle', height: 1.55, collisionRadius: 0.8
    },
    {
        id: 'quaternius-frog', label: 'Quaternius Frog', assetRoot: QUATERNIUS_ROOT,
        file: 'Frog.gltf', walk: 'Run', idle: 'Idle', height: 0.8, collisionRadius: 0.6
    },
    {
        id: 'quaternius-mushroom-king', label: 'Quaternius Mushroom King', assetRoot: QUATERNIUS_ROOT,
        file: 'MushroomKing.gltf', walk: 'Run', idle: 'Idle', height: 1.7, collisionRadius: 0.8
    },
    {
        id: 'quaternius-yeti', label: 'Quaternius Yeti', assetRoot: QUATERNIUS_ROOT,
        file: 'Yeti.gltf', walk: 'Run', idle: 'Idle', height: 2.1, collisionRadius: 0.9
    },
    {
        id: 'quaternius-cat', label: 'Quaternius Cat', assetRoot: QUATERNIUS_ROOT,
        file: 'Cat.gltf', walk: 'Walk', idle: 'Idle', height: 0.75, collisionRadius: 0.55
    },
    {
        id: 'quaternius-chicken', label: 'Quaternius Chicken', assetRoot: QUATERNIUS_ROOT,
        file: 'Chicken.gltf', walk: 'Walk', idle: 'Idle', height: 0.75, collisionRadius: 0.55
    },
    {
        id: 'quaternius-dog', label: 'Quaternius Dog', assetRoot: QUATERNIUS_ROOT,
        file: 'Dog.gltf', walk: 'Walk', idle: 'Idle', height: 0.8, collisionRadius: 0.6
    },
    {
        id: 'quaternius-green-blob', label: 'Quaternius Green Blob', assetRoot: QUATERNIUS_ROOT,
        file: 'GreenBlob.gltf', walk: 'Walk', idle: 'Idle', height: 0.75, collisionRadius: 0.65
    },
    {
        id: 'quaternius-mushnub-evolved', label: 'Quaternius Evolved Mushnub', assetRoot: QUATERNIUS_ROOT,
        file: 'Mushnub_Evolved.gltf', walk: 'Walk', idle: 'Idle', height: 1.2, collisionRadius: 0.7
    },
    {
        id: 'quaternius-wizard', label: 'Quaternius Wizard', assetRoot: QUATERNIUS_ROOT,
        file: 'Wizard.gltf', walk: 'Walk', idle: 'Idle', height: 1.55, collisionRadius: 0.7
    },
    {
        id: 'quaternius-armabee-evolved', label: 'Quaternius Evolved Armabee', assetRoot: QUATERNIUS_ROOT,
        file: 'Armabee_Evolved.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.0, collisionRadius: 0.7
    },
    {
        id: 'quaternius-dragon', label: 'Quaternius Dragon', assetRoot: QUATERNIUS_ROOT,
        file: 'Dragon.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.45, collisionRadius: 0.85
    },
    {
        id: 'quaternius-squidle', label: 'Quaternius Squidle', assetRoot: QUATERNIUS_ROOT,
        file: 'Squidle.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.0, collisionRadius: 0.7
    },
    {
        id: 'quaternius-monkroose', label: 'Quaternius Monkroose', assetRoot: QUATERNIUS_ROOT,
        file: 'big/Monkroose.gltf', walk: 'Run', idle: 'Idle', height: 1.4, collisionRadius: 0.75
    },
    {
        id: 'quaternius-big-ninja', label: 'Quaternius Big Ninja', assetRoot: QUATERNIUS_ROOT,
        file: 'big/Ninja.gltf', walk: 'Run', idle: 'Idle', height: 1.55, collisionRadius: 0.75
    },
    {
        id: 'quaternius-skull-orc', label: 'Quaternius Skull Orc', assetRoot: QUATERNIUS_ROOT,
        file: 'big/Orc_Skull.gltf', walk: 'Run', idle: 'Idle', height: 1.8, collisionRadius: 0.85
    },
    {
        id: 'quaternius-orc', label: 'Quaternius Orc', assetRoot: QUATERNIUS_ROOT,
        file: 'big/Orc.gltf', walk: 'Run', idle: 'Idle', height: 1.8, collisionRadius: 0.85
    },
    {
        id: 'quaternius-big-tribal', label: 'Quaternius Big Tribal', assetRoot: QUATERNIUS_ROOT,
        file: 'big/Tribal.gltf', walk: 'Run', idle: 'Idle', height: 1.65, collisionRadius: 0.8
    },
    {
        id: 'quaternius-blob-alien', label: 'Quaternius Blob Alien', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Alien.gltf', walk: 'Walk', idle: 'Idle', height: 0.95, collisionRadius: 0.65
    },
    {
        id: 'quaternius-blob-birb', label: 'Quaternius Blob Birb', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Birb.gltf', walk: 'Walk', idle: 'Idle', height: 0.75, collisionRadius: 0.55
    },
    {
        id: 'quaternius-blob-cactoro', label: 'Quaternius Blob Cactoro', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Cactoro.gltf', walk: 'Walk', idle: 'Idle', height: 1.1, collisionRadius: 0.65
    },
    {
        id: 'quaternius-blob-fish', label: 'Quaternius Blob Fish', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Fish.gltf', walk: 'Walk', idle: 'Idle', height: 0.75, collisionRadius: 0.55
    },
    {
        id: 'quaternius-green-spiky-blob', label: 'Quaternius Green Spiky Blob', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/GreenSpikyBlob.gltf', walk: 'Walk', idle: 'Idle', height: 0.85, collisionRadius: 0.65
    },
    {
        id: 'quaternius-mushnub', label: 'Quaternius Mushnub', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Mushnub.gltf', walk: 'Walk', idle: 'Idle', height: 0.95, collisionRadius: 0.65
    },
    {
        id: 'quaternius-blob-ninja', label: 'Quaternius Blob Ninja', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Ninja.gltf', walk: 'Walk', idle: 'Idle', height: 1.05, collisionRadius: 0.65
    },
    {
        id: 'quaternius-blob-orc', label: 'Quaternius Blob Orc', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Orc.gltf', walk: 'Walk', idle: 'Idle', height: 1.1, collisionRadius: 0.7
    },
    {
        id: 'quaternius-blob-pigeon', label: 'Quaternius Blob Pigeon', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Pigeon.gltf', walk: 'Walk', idle: 'Idle', height: 0.75, collisionRadius: 0.55
    },
    {
        id: 'quaternius-pink-blob', label: 'Quaternius Pink Blob', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/PinkBlob.gltf', walk: 'Walk', idle: 'Idle', height: 0.8, collisionRadius: 0.65
    },
    {
        id: 'quaternius-blob-yeti', label: 'Quaternius Blob Yeti', assetRoot: QUATERNIUS_ROOT,
        file: 'blob/Yeti.gltf', walk: 'Walk', idle: 'Idle', height: 1.25, collisionRadius: 0.7
    },
    {
        id: 'quaternius-alpaking', label: 'Quaternius Alpaking', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Alpaking.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.1, collisionRadius: 0.7
    },
    {
        id: 'quaternius-evolved-alpaking', label: 'Quaternius Evolved Alpaking', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Alpaking_Evolved.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.3, collisionRadius: 0.75
    },
    {
        id: 'quaternius-armabee', label: 'Quaternius Armabee', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Armabee.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 0.95, collisionRadius: 0.65
    },
    {
        id: 'quaternius-evolved-dragon', label: 'Quaternius Evolved Dragon', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Dragon_Evolved.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.6, collisionRadius: 0.9
    },
    {
        id: 'quaternius-ghost', label: 'Quaternius Ghost', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Ghost.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.2, collisionRadius: 0.7
    },
    {
        id: 'quaternius-skull-ghost', label: 'Quaternius Skull Ghost', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Ghost_Skull.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.1, collisionRadius: 0.7
    },
    {
        id: 'quaternius-glub', label: 'Quaternius Glub', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Glub.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 0.9, collisionRadius: 0.65
    },
    {
        id: 'quaternius-evolved-glub', label: 'Quaternius Evolved Glub', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Glub_Evolved.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.1, collisionRadius: 0.7
    },
    {
        id: 'quaternius-goleling', label: 'Quaternius Goleling', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Goleling.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.1, collisionRadius: 0.7
    },
    {
        id: 'quaternius-evolved-goleling', label: 'Quaternius Evolved Goleling', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Goleling_Evolved.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.3, collisionRadius: 0.75
    },
    {
        id: 'quaternius-hywirl', label: 'Quaternius Hywirl', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Hywirl.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.0, collisionRadius: 0.7
    },
    {
        id: 'quaternius-flying-pigeon', label: 'Quaternius Flying Pigeon', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Pigeon.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 0.8, collisionRadius: 0.55
    },
    {
        id: 'quaternius-flying-tribal', label: 'Quaternius Flying Tribal', assetRoot: QUATERNIUS_ROOT,
        file: 'flying/Tribal.gltf', walk: 'Fast_Flying', idle: 'Flying_Idle', height: 1.1, collisionRadius: 0.7
    },
    {
        id: 'khronos-fox', label: 'Khronos Fox', assetRoot: KHRONOS_ROOT,
        file: 'Fox.glb', walk: 'Run', idle: 'Survey', height: 0.8, collisionRadius: 0.65
    },
    {
        id: 'kaykit-barbarian', label: 'KayKit Barbarian', assetRoot: KAYKIT_ADVENTURERS_ROOT,
        file: 'Barbarian.glb', walk: 'Running_A', idle: 'Idle', height: 1.7, collisionRadius: 0.75
    },
    {
        id: 'kaykit-knight', label: 'KayKit Knight', assetRoot: KAYKIT_ADVENTURERS_ROOT,
        file: 'Knight.glb', walk: 'Running_A', idle: 'Idle', height: 1.7, collisionRadius: 0.75
    },
    {
        id: 'kaykit-mage', label: 'KayKit Mage', assetRoot: KAYKIT_ADVENTURERS_ROOT,
        file: 'Mage.glb', walk: 'Running_A', idle: 'Idle', height: 1.7, collisionRadius: 0.75
    },
    {
        id: 'kaykit-rogue', label: 'KayKit Rogue', assetRoot: KAYKIT_ADVENTURERS_ROOT,
        file: 'Rogue.glb', walk: 'Running_A', idle: 'Idle', height: 1.7, collisionRadius: 0.75
    },
    {
        id: 'kaykit-hooded-rogue', label: 'KayKit Hooded Rogue', assetRoot: KAYKIT_ADVENTURERS_ROOT,
        file: 'Rogue_Hooded.glb', walk: 'Running_A', idle: 'Idle', height: 1.7, collisionRadius: 0.75
    },
    {
        id: 'kaykit-skeleton-mage', label: 'KayKit Skeleton Mage', assetRoot: KAYKIT_SKELETONS_ROOT,
        file: 'Skeleton_Mage.glb', walk: 'Running_A', idle: 'Idle', height: 1.75, collisionRadius: 0.75
    },
    {
        id: 'kaykit-skeleton-minion', label: 'KayKit Skeleton Minion', assetRoot: KAYKIT_SKELETONS_ROOT,
        file: 'Skeleton_Minion.glb', walk: 'Running_A', idle: 'Idle', height: 1.75, collisionRadius: 0.75
    },
    {
        id: 'kaykit-skeleton-rogue', label: 'KayKit Skeleton Rogue', assetRoot: KAYKIT_SKELETONS_ROOT,
        file: 'Skeleton_Rogue.glb', walk: 'Running_A', idle: 'Idle', height: 1.75, collisionRadius: 0.75
    },
    {
        id: 'kaykit-skeleton-warrior', label: 'KayKit Skeleton Warrior', assetRoot: KAYKIT_SKELETONS_ROOT,
        file: 'Skeleton_Warrior.glb', walk: 'Running_A', idle: 'Idle', height: 1.75, collisionRadius: 0.75
    },
    {
        id: 'quaternius-expressive-robot', label: 'Quaternius Expressive Robot', assetRoot: ROBOT_EXPRESSIVE_ROOT,
        file: 'RobotExpressive.glb', walk: 'Running', idle: 'Idle', height: 1.7, collisionRadius: 0.75
    }
];

export const GLTF_MODEL_COUNT = MODEL_DEFINITIONS.length;

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
        node.castShadow = isMesh;
        node.receiveShadow = isMesh;
        meshCount += isMesh ? 1 : 0;
    });
    if (meshCount > 0) {
        return template;
    } else {
        throw new Error(`${definition.label}: got ${meshCount} renderable meshes; expected at least one while preparing the glTF actor`);
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
        throw new Error(`${definition.label}: got measured height ${size.y}; expected a non-empty finite glTF actor while normalizing it`);
    }
}

class GLTFActor {
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

class GLTFModelAsset {
    constructor(definition, gltf) {
        this.definition = definition;
        this.template = prepareTemplate(definition, gltf.scene);
        this.walk = requireAnimation(definition, gltf.animations, definition.walk, 'movement');
        this.idle = requireAnimation(definition, gltf.animations, definition.idle, 'waiting');
        this.transform = measureTemplate(definition, this.template);
        this.height = definition.height;
        this.collisionRadius = definition.collisionRadius;
        this.carryHeight = definition.height + 0.45;
        this.label = definition.label;
    }

    createActor() {
        return new GLTFActor(this);
    }
}

async function loadModel(definition) {
    const path = new URL(`${definition.assetRoot}/${definition.file}`, import.meta.url).href;
    let gltf;
    try {
        gltf = await new GLTFLoader().loadAsync(path);
    } catch (error) {
        throw new Error(`${definition.label}: loading ${path} failed with ${error.message}; expected a valid glTF 2.0 model`);
    }
    if (gltf.animations.length > 0) {
        return new GLTFModelAsset(definition, gltf);
    } else {
        throw new Error(`${definition.label}: got ${gltf.animations.length} animation clips from ${path}; expected movement and idle clips`);
    }
}

export function createGLTFCreatureModelLoadJobs(definitions = MODEL_DEFINITIONS) {
    return definitions.map(definition => ({
        id: definition.id,
        label: definition.label,
        load: () => loadModel(definition)
    }));
}
