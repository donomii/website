import { loadUFOCreatureModels, UFO_MODEL_COUNT } from './ufo-models.js';
import { loadExtraCreatureModels, EXTRA_MODEL_COUNT } from './extra-models.js';
import { loadGLTFCreatureModels, GLTF_MODEL_COUNT } from './gltf-models.js';

export const CREATURE_MODEL_COUNT = UFO_MODEL_COUNT + EXTRA_MODEL_COUNT + GLTF_MODEL_COUNT;

export async function loadCreatureModels(onProgress = () => {}) {
    let ufoLoaded = 0;
    let extraLoaded = 0;
    let gltfLoaded = 0;
    const reportProgress = label => onProgress(ufoLoaded + extraLoaded + gltfLoaded, CREATURE_MODEL_COUNT, label);
    const [ufoModels, extraModels, gltfModels] = await Promise.all([
        loadUFOCreatureModels((loaded, total, label) => {
            ufoLoaded = loaded;
            reportProgress(label);
        }),
        loadExtraCreatureModels((loaded, total, label) => {
            extraLoaded = loaded;
            reportProgress(label);
        }),
        loadGLTFCreatureModels((loaded, total, label) => {
            gltfLoaded = loaded;
            reportProgress(label);
        })
    ]);
    return [...ufoModels, ...extraModels, ...gltfModels];
}
