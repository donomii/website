import { loadUFOCreatureModels, UFO_MODEL_COUNT } from './ufo-models.js';
import { loadExtraCreatureModels, EXTRA_MODEL_COUNT } from './extra-models.js';

export const CREATURE_MODEL_COUNT = UFO_MODEL_COUNT + EXTRA_MODEL_COUNT;

export async function loadCreatureModels(onProgress = () => {}) {
    let ufoLoaded = 0;
    let extraLoaded = 0;
    const reportProgress = label => onProgress(ufoLoaded + extraLoaded, CREATURE_MODEL_COUNT, label);
    const [ufoModels, extraModels] = await Promise.all([
        loadUFOCreatureModels((loaded, total, label) => {
            ufoLoaded = loaded;
            reportProgress(label);
        }),
        loadExtraCreatureModels((loaded, total, label) => {
            extraLoaded = loaded;
            reportProgress(label);
        })
    ]);
    return [...ufoModels, ...extraModels];
}
