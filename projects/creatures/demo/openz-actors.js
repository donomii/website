const ROOT = './assets/openz/actors';

const robots = ['Grunt', 'Psycho', 'Tough', 'Sniper', 'Pyro', 'Laser', 'Electrobot'];
const wildlife = [
    ['Eagle', 'Eagle', 0.8, 0.8],
    ['LavaDragon', 'Lava Dragon', 1.2, 0.9],
    ['PigDino', 'Pig Dino', 0.85, 0.65],
    ['Raptor', 'Raptor', 1.25, 0.8],
    ['MiniRaptor', 'Mini Raptor', 0.7, 0.5],
    ['Seagull', 'Seagull', 0.65, 0.65],
    ['Worm', 'Sandworm', 1.2, 0.7],
    ['YellowWorm', 'Yellow Worm', 0.5, 0.65],
    ['Croc', 'Crocodile', 0.65, 1.1],
    ['JG_Snake', 'Jungle Snake', 0.45, 0.65],
    ['Monkey', 'Monkey', 0.8, 0.5],
    ['Parrot_perched', 'Parrot', 0.65, 0.45]
];

function actor(name, label, height, collisionRadius, original) {
    return {
        id: 'openz-' + name.toLowerCase(), label: 'OpenZ ' + label, assetRoot: ROOT,
        file: name + '.glb', walk: 'Walk', idle: 'Idle', height, collisionRadius, original
    };
}

export const openZActors = [
    ...robots.map(name => actor(name, name, 1.6, 0.75, name === 'Grunt'
        ? 'Models/BS01/BS01_Robot.fbx' : 'Models/RobotsV3/BS01V3_' + name + '.fbx')),
    ...wildlife.map(([name, label, height, radius], index) => actor(name, label, height, radius,
        'Resources/OpenZ/' + (index < 8 ? 'Critters/' : 'L16Animals/') +
        (name === 'MiniRaptor' ? 'Raptor' : name) + '.fbx'))
];

