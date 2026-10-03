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
        id: 'egoboo-cobol', label: 'Egoboo Cobol', assetRoot: EGOBOO_ASSET_ROOT, directory: 'cobol',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 5 }],
        walk: 'walk', idle: 'idle', height: 1.1, collisionRadius: 0.6
    },
    {
        id: 'egoboo-demon', label: 'Egoboo Demon', assetRoot: EGOBOO_ASSET_ROOT, directory: 'demon',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'hover', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'hover', idle: 'idle', height: 1.5, collisionRadius: 0.75
    },
    {
        id: 'egoboo-firelizard', label: 'Egoboo Fire Lizard', assetRoot: EGOBOO_ASSET_ROOT, directory: 'firelizard',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 5 }],
        walk: 'walk', idle: 'idle', height: 0.8, collisionRadius: 0.75
    },
    {
        id: 'egoboo-grubbug', label: 'Egoboo Grub Bug', assetRoot: EGOBOO_ASSET_ROOT, directory: 'grubbug',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'crawl', prefix: 'DA', fps: 10 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'crawl', idle: 'idle', height: 0.6, collisionRadius: 0.6
    },
    {
        id: 'egoboo-lumpkin', label: 'Egoboo Lumpkin', assetRoot: EGOBOO_ASSET_ROOT, directory: 'lumpkin',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 10 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.25, collisionRadius: 0.7
    },
    {
        id: 'egoboo-trog', label: 'Egoboo Trog', assetRoot: EGOBOO_ASSET_ROOT, directory: 'trog',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 5 }],
        walk: 'walk', idle: 'idle', height: 1.7, collisionRadius: 0.8
    },
    {
        id: 'egoboo-spider', label: 'Egoboo Spider', assetRoot: EGOBOO_ASSET_ROOT, directory: 'spider',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 10 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 0.8, collisionRadius: 0.85
    },
    {
        id: 'egoboo-pitcobra', label: 'Egoboo Pit Cobra', assetRoot: EGOBOO_ASSET_ROOT, directory: 'pitcobra',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.25, collisionRadius: 0.65
    },
    {
        id: 'egoboo-sandtroll', label: 'Egoboo Sand Troll', assetRoot: EGOBOO_ASSET_ROOT, directory: 'sandtroll',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 2.4, collisionRadius: 1
    },
    {
        id: 'egoboo-jelly', label: 'Egoboo Jelly', assetRoot: EGOBOO_ASSET_ROOT, directory: 'jelly',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 0.8, collisionRadius: 0.7
    },
    {
        id: 'egoboo-ghoul', label: 'Egoboo Ghoul', assetRoot: EGOBOO_ASSET_ROOT, directory: 'ghoul',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.35, collisionRadius: 0.7
    },
    {
        id: 'egoboo-nautilus', label: 'Egoboo Nautilus', assetRoot: EGOBOO_ASSET_ROOT, directory: 'nautilus',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.2, collisionRadius: 0.8
    },
    {
        id: 'egoboo-eyeball', label: 'Egoboo Eyeball', assetRoot: EGOBOO_ASSET_ROOT, directory: 'eyeball',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 0.9, collisionRadius: 0.6
    },
    {
        id: 'egoboo-mimic', label: 'Egoboo Mimic', assetRoot: EGOBOO_ASSET_ROOT, directory: 'mimic',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1, collisionRadius: 0.75
    },
    {
        id: 'egoboo-mosquito', label: 'Egoboo Mosquito', assetRoot: EGOBOO_ASSET_ROOT, directory: 'mosquito',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 14 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 0.65, collisionRadius: 0.6
    },
    {
        id: 'egoboo-scatterbrain', label: 'Egoboo Scatterbrain', assetRoot: EGOBOO_ASSET_ROOT, directory: 'scatterbrain',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.15, collisionRadius: 0.7
    },
    {
        id: 'egoboo-trorc', label: 'Egoboo Trorc', assetRoot: EGOBOO_ASSET_ROOT, directory: 'trorc',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 10 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.8, collisionRadius: 0.8
    },
    {
        id: 'egoboo-vampyre', label: 'Egoboo Vampyre', assetRoot: EGOBOO_ASSET_ROOT, directory: 'vampyre',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.8, collisionRadius: 0.75
    },
    {
        id: 'egoboo-animatedmace', label: 'Egoboo Animated Mace', assetRoot: EGOBOO_ASSET_ROOT, directory: 'animatedmace',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.4, collisionRadius: 0.6
    },
    {
        id: 'egoboo-carpetmimic', label: 'Egoboo Carpet Mimic', assetRoot: EGOBOO_ASSET_ROOT, directory: 'carpetmimic',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 0.35, collisionRadius: 0.8
    },
    {
        id: 'egoboo-mephit', label: 'Egoboo Mephit', assetRoot: EGOBOO_ASSET_ROOT, directory: 'mephit',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 10 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.15, collisionRadius: 0.7
    },
    {
        id: 'egoboo-rusteater', label: 'Egoboo Rust Eater', assetRoot: EGOBOO_ASSET_ROOT, directory: 'rusteater',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WB', fps: 9 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.2, collisionRadius: 0.8
    },
    {
        id: 'egoboo-varguile', label: 'Egoboo Varguile', assetRoot: EGOBOO_ASSET_ROOT, directory: 'varguile',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'DA', fps: 8 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 0.9, collisionRadius: 0.6
    },
    {
        id: 'egoboo-zombi', label: 'Egoboo Zombi', assetRoot: EGOBOO_ASSET_ROOT, directory: 'zombi',
        body: 'body.md2', animations: null, animationFormat: 'frame-prefix', skin: 'body.png',
        head: null, headSkin: null, tags: null,
        frameAnimations: [{ name: 'walk', prefix: 'WA', fps: 10 }, { name: 'idle', prefix: 'DA', fps: 4 }],
        walk: 'walk', idle: 'idle', height: 1.65, collisionRadius: 0.75
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
