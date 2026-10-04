import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const KAYKIT_ROOT = './assets/kaykit/medieval-hexagon';
const KENNEY_ROOT = './assets/kenney/nature-kit';
const MAX_CONCURRENT_SCENERY_LOADS = 2;
const MAX_LOAD_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 700;
const TRANSIENT_LOAD_ERROR = /(?:HTTP|responded with) (?:408|425|429|5\d\d)\b|failed to fetch|networkerror|load failed/i;

function placement(x, z, rotationDegrees, scale = 1) {
    return { x, z, rotation: THREE.MathUtils.degToRad(rotationDegrees), scale };
}

const BUILDING_DEFINITIONS = [
    {
        id: 'kaykit-castle', label: 'KayKit Castle', file: 'building_castle_blue.gltf', height: 10,
        placements: [placement(-36, -33, 20)]
    },
    {
        id: 'kaykit-church', label: 'KayKit Church', file: 'building_church_blue.gltf', height: 7,
        placements: [placement(-23, -32, 5)]
    },
    {
        id: 'kaykit-tavern', label: 'KayKit Tavern', file: 'building_tavern_blue.gltf', height: 6,
        placements: [placement(-11, -33, -5)]
    },
    {
        id: 'kaykit-home-a', label: 'KayKit Home A', file: 'building_home_A_blue.gltf', height: 4.8,
        placements: [placement(0, -34, 8)]
    },
    {
        id: 'kaykit-home-b', label: 'KayKit Home B', file: 'building_home_B_blue.gltf', height: 5.7,
        placements: [placement(11, -32, -10)]
    },
    {
        id: 'kaykit-market', label: 'KayKit Market', file: 'building_market_blue.gltf', height: 4.6,
        placements: [placement(23, -31, 15)]
    },
    {
        id: 'kaykit-blacksmith', label: 'KayKit Blacksmith', file: 'building_blacksmith_blue.gltf', height: 5,
        placements: [placement(32, -22, 90)]
    },
    {
        id: 'kaykit-barracks', label: 'KayKit Barracks', file: 'building_barracks_blue.gltf', height: 6.2,
        placements: [placement(33, -10, 90)]
    },
    {
        id: 'kaykit-archery-range', label: 'KayKit Archery Range', file: 'building_archeryrange_blue.gltf', height: 5.2,
        placements: [placement(34, 3, 90)]
    },
    {
        id: 'kaykit-lumbermill', label: 'KayKit Lumbermill', file: 'building_lumbermill_blue.gltf', height: 6.8,
        placements: [placement(32, 17, 110)]
    },
    {
        id: 'kaykit-windmill', label: 'KayKit Windmill', file: 'building_windmill_blue.gltf', height: 7.5,
        placements: [placement(25, 31, 150)]
    },
    {
        id: 'kaykit-watermill', label: 'KayKit Watermill', file: 'building_watermill_blue.gltf', height: 6.8,
        placements: [placement(12, 34, 180)]
    },
    {
        id: 'kaykit-mine', label: 'KayKit Mine', file: 'building_mine_blue.gltf', height: 5.1,
        placements: [placement(-3, 35, 180)]
    },
    {
        id: 'kaykit-well', label: 'KayKit Well', file: 'building_well_blue.gltf', height: 2.4,
        placements: [placement(-18, 30, 0)]
    }
].map(definition => ({ ...definition, assetRoot: KAYKIT_ROOT }));

const NATURE_DEFINITIONS = [
    {
        id: 'kenney-tree-default', label: 'Kenney Default Tree', file: 'tree_default.glb', height: 5.5,
        placements: [
            placement(-44, -20, 15), placement(-43, 4, 80, 0.9), placement(-40, 22, 145, 1.1),
            placement(-34, 42, 210), placement(4, 44, 260, 0.95), placement(43, 30, 330, 1.05)
        ]
    },
    {
        id: 'kenney-tree-detailed', label: 'Kenney Detailed Tree', file: 'tree_detailed.glb', height: 6,
        placements: [
            placement(-43, -39, 25), placement(-42, 34, 130), placement(18, 44, 225), placement(43, -39, 315)
        ]
    },
    {
        id: 'kenney-tree-tall', label: 'Kenney Tall Tree', file: 'tree_tall.glb', height: 7,
        placements: [
            placement(-45, -7, 45, 0.9), placement(-30, 43, 125), placement(38, 40, 215), placement(45, 14, 300, 0.95)
        ]
    },
    {
        id: 'kenney-pine-a', label: 'Kenney Pine A', file: 'tree_pineDefaultA.glb', height: 6.5,
        placements: [
            placement(-42, -31, 10), placement(-44, 13, 75), placement(-21, 43, 150),
            placement(31, 43, 230), placement(45, -12, 320)
        ]
    },
    {
        id: 'kenney-pine-b', label: 'Kenney Pine B', file: 'tree_pineDefaultB.glb', height: 7,
        placements: [
            placement(-32, -43, 30), placement(-45, 30, 105), placement(-10, 44, 175),
            placement(44, 23, 250), placement(44, -28, 340)
        ]
    },
    {
        id: 'kenney-bush', label: 'Kenney Bush', file: 'plant_bush.glb', height: 1.2,
        placements: [
            placement(-28, -27, 20), placement(-16, -27, 90), placement(7, -28, 145),
            placement(28, -16, 210), placement(27, 11, 280), placement(-13, 27, 340)
        ]
    },
    {
        id: 'kenney-bush-detailed', label: 'Kenney Detailed Bush', file: 'plant_bushDetailed.glb', height: 1.4,
        placements: [
            placement(-27, 27, 40), placement(-9, 30, 120), placement(20, 28, 215), placement(29, -27, 305)
        ]
    },
    {
        id: 'kenney-bush-large', label: 'Kenney Large Bush', file: 'plant_bushLarge.glb', height: 1.6,
        placements: [
            placement(-38, -25, 5), placement(-38, 15, 100), placement(37, 24, 200), placement(38, -17, 300)
        ]
    },
    {
        id: 'kenney-rock-flat', label: 'Kenney Flat Rock', file: 'rock_smallFlatA.glb', height: 0.55,
        placements: [
            placement(-25, -24, 25), placement(-23, 24, 115), placement(23, 24, 205), placement(25, -24, 295)
        ]
    },
    {
        id: 'kenney-rock-small', label: 'Kenney Small Rock', file: 'rock_smallH.glb', height: 1,
        placements: [placement(-39, -13, 40), placement(-30, 37, 160), placement(39, 9, 275)]
    },
    {
        id: 'kenney-rock-tall', label: 'Kenney Tall Rock', file: 'rock_tallH.glb', height: 1.8,
        placements: [placement(-36, 28, 65), placement(6, 40, 185), placement(40, -7, 305)]
    },
    {
        id: 'kenney-rock-large', label: 'Kenney Large Rock', file: 'rock_largeA.glb', height: 2.2,
        placements: [placement(-40, -3, 35), placement(-25, 39, 155), placement(40, 35, 270)]
    },
    {
        id: 'kenney-grass', label: 'Kenney Grass', file: 'grass_large.glb', height: 0.8,
        placements: [
            placement(-31, -25, 15), placement(-20, -25, 60), placement(-7, -27, 105), placement(17, -26, 150),
            placement(27, -7, 195), placement(27, 21, 240), placement(4, 29, 285), placement(-24, 25, 330)
        ]
    },
    {
        id: 'kenney-flower-red', label: 'Kenney Red Flowers', file: 'flower_redA.glb', height: 0.55,
        placements: [placement(-29, -24, 0), placement(14, -27, 90), placement(26, 14, 180), placement(-22, 27, 270)]
    },
    {
        id: 'kenney-flower-purple', label: 'Kenney Purple Flowers', file: 'flower_purpleA.glb', height: 0.55,
        placements: [placement(-18, -26, 20), placement(25, -18, 110), placement(17, 27, 200), placement(-26, 20, 290)]
    },
    {
        id: 'kenney-flower-yellow', label: 'Kenney Yellow Flowers', file: 'flower_yellowA.glb', height: 0.55,
        placements: [placement(-6, -28, 40), placement(28, -5, 130), placement(5, 29, 220), placement(-28, 8, 310)]
    },
    {
        id: 'kenney-log', label: 'Kenney Fallen Log', file: 'log.glb', height: 0.65,
        placements: [placement(-34, 8, 25, 1.2), placement(-12, 38, 150, 1.1), placement(39, 20, 280, 1.2)]
    },
    {
        id: 'kenney-mushrooms', label: 'Kenney Red Mushrooms', file: 'mushroom_redGroup.glb', height: 0.55,
        placements: [placement(-35, -17, 55), placement(-20, 35, 175), placement(36, 30, 295)]
    }
].map(definition => ({ ...definition, assetRoot: KENNEY_ROOT }));

const MODEL_DEFINITIONS = [...BUILDING_DEFINITIONS, ...NATURE_DEFINITIONS];

export const SCENERY_MODEL_COUNT = MODEL_DEFINITIONS.length;
export const SCENERY_PLACEMENT_COUNT = MODEL_DEFINITIONS.reduce(
    (total, definition) => total + definition.placements.length,
    0
);

function normalizeError(error) {
    return error instanceof Error ? error : new Error(String(error));
}

function wait(delayMilliseconds) {
    return new Promise(resolve => setTimeout(resolve, delayMilliseconds));
}

function prepareTemplate(definition, template) {
    let meshCount = 0;
    template.traverse(node => {
        if (node.isMesh === true) {
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
        throw new Error(`${definition.label}: got ${meshCount} renderable meshes; expected at least one while preparing scenery`);
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
        throw new Error(`${definition.label}: got measured height ${size.y}; expected non-empty finite scenery while normalizing it`);
    }
}

async function loadDefinition(definition) {
    const path = `${definition.assetRoot}/${definition.file}`;
    let gltf;
    try {
        gltf = await new GLTFLoader().loadAsync(path);
    } catch (error) {
        const message = normalizeError(error).message;
        throw new Error(`${definition.label}: loading ${path} failed with ${message}; expected a valid glTF 2.0 model`);
    }
    if (gltf.scene instanceof THREE.Object3D) {
        const template = prepareTemplate(definition, gltf.scene);
        return { definition, template, transform: measureTemplate(definition, template) };
    } else {
        throw new Error(`${definition.label}: got no scene from ${path}; expected a glTF scene containing scenery meshes`);
    }
}

function createSceneryInstance(asset, item) {
    const root = new THREE.Group();
    const model = asset.template.clone(true);
    const scaledSize = asset.transform.scale * item.scale;
    model.scale.setScalar(scaledSize);
    model.position.set(
        asset.transform.offsetX * item.scale,
        asset.transform.offsetY * item.scale,
        asset.transform.offsetZ * item.scale
    );
    root.position.set(item.x, 0, item.z);
    root.rotation.y = item.rotation;
    root.userData.sceneryName = asset.definition.id;
    root.add(model);
    return root;
}

function placeLoadedScenery(scene, asset) {
    asset.definition.placements.forEach(item => {
        scene.add(createSceneryInstance(asset, item));
    });
    return asset.definition.placements.length;
}

async function loadDefinitionWithRetry(definition, onRetry) {
    let lastError = new Error(`${definition.label}: scenery loading did not start`);
    for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
        try {
            return await loadDefinition(definition);
        } catch (error) {
            lastError = normalizeError(error);
            const canRetry = attempt < MAX_LOAD_ATTEMPTS && TRANSIENT_LOAD_ERROR.test(lastError.message);
            if (canRetry) {
                const retryDelay = RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));
                onRetry({
                    attempt,
                    nextAttempt: attempt + 1,
                    maxAttempts: MAX_LOAD_ATTEMPTS,
                    retryDelay,
                    error: lastError.message
                });
                await wait(retryDelay);
            } else {
                const attemptWord = attempt === 1 ? 'attempt' : 'attempts';
                throw new Error(`${definition.label}: loading failed after ${attempt} ${attemptWord}: ${lastError.message}`);
            }
        }
    }
    throw new Error(`${definition.label}: loading exhausted its retry loop: ${lastError.message}`);
}

export async function loadScenery(scene, { onProgress = () => {} } = {}) {
    const failures = [];
    let nextDefinitionIndex = 0;
    let completed = 0;
    let loaded = 0;
    let placed = 0;

    const createProgress = (state, label, details = {}) => ({
        state,
        label,
        completed,
        loaded,
        placed,
        failed: failures.length,
        total: SCENERY_MODEL_COUNT,
        totalPlacements: SCENERY_PLACEMENT_COUNT,
        ...details
    });

    async function loadNextDefinitions() {
        while (nextDefinitionIndex < MODEL_DEFINITIONS.length) {
            const definition = MODEL_DEFINITIONS[nextDefinitionIndex];
            nextDefinitionIndex++;
            onProgress(createProgress('loading', definition.label));
            try {
                const asset = await loadDefinitionWithRetry(definition, retry => {
                    onProgress(createProgress('retrying', definition.label, retry));
                });
                placed += placeLoadedScenery(scene, asset);
                loaded++;
                completed++;
                onProgress(createProgress('loaded', definition.label));
            } catch (error) {
                const failure = { id: definition.id, label: definition.label, error: normalizeError(error).message };
                failures.push(failure);
                completed++;
                onProgress(createProgress('failed', definition.label, { error: failure.error }));
            }
            await wait(0);
        }
    }

    const workerCount = Math.min(MAX_CONCURRENT_SCENERY_LOADS, MODEL_DEFINITIONS.length);
    await Promise.all(Array.from({ length: workerCount }, () => loadNextDefinitions()));
    return {
        loaded,
        placed,
        failed: failures.length,
        total: SCENERY_MODEL_COUNT,
        totalPlacements: SCENERY_PLACEMENT_COUNT,
        failures
    };
}
