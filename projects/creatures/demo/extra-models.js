import { loadModelDefinitions } from './ufo-models.js';

const EGOBOO_ASSET_ROOT = './assets/egoboo';
const SAUERBRATEN_ASSET_ROOT = './assets/sauerbraten';

const EXTRA_MODEL_DEFINITIONS = [
    {
        id: 'egoboo-bat', label: 'Egoboo Bat', assetRoot: EGOBOO_ASSET_ROOT, directory: 'bat',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'fly', prefix: 'WA', fps: 10 }, { name: 'idle', prefix: 'UA', fps: 6 }],
        walk: 'fly', idle: 'idle', height: 0.9, collisionRadius: 0.6
    },
    {
        id: 'egoboo-cockatrice', label: 'Egoboo Cockatrice', assetRoot: EGOBOO_ASSET_ROOT, directory: 'cockatrice',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 6 }],
        walk: 'walk', idle: 'idle', height: 1.25, collisionRadius: 0.7
    },
    {
        id: 'egoboo-crab', label: 'Egoboo Crab', assetRoot: EGOBOO_ASSET_ROOT, directory: 'crab',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'UA', fps: 5 }],
        walk: 'walk', idle: 'idle', height: 0.7, collisionRadius: 0.65
    },
    {
        id: 'egoboo-minotore', label: 'Egoboo Minotore', assetRoot: EGOBOO_ASSET_ROOT, directory: 'minotore',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WA', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 2.3, collisionRadius: 0.9
    },
    {
        id: 'sauerbraten-hellpig', label: 'Sauerbraten Hellpig', assetRoot: SAUERBRATEN_ASSET_ROOT, directory: 'hellpig',
        body: 'body.md2', animations: 'md2.cfg', animationFormat: 'sauerbraten-md2cfg', skin: 'body.jpg',
        head: null, headSkin: null, tags: null,
        walk: 'forward', idle: 'idle', height: 1.25, collisionRadius: 0.8
    }
];

export const EXTRA_MODEL_COUNT = EXTRA_MODEL_DEFINITIONS.length;

export async function loadExtraCreatureModels(onProgress = () => {}) {
    return loadModelDefinitions(EXTRA_MODEL_DEFINITIONS, onProgress);
}
