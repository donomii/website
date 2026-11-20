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
    },
    {
        id: 'kaykit-tower-a', label: 'KayKit Tower A', file: 'building_tower_A_blue.gltf', height: 7.5,
        placements: [placement(-18, 61, 180)]
    },
    {
        id: 'kaykit-tower-b', label: 'KayKit Tower B', file: 'building_tower_B_blue.gltf', height: 6.8,
        placements: [placement(-34, 59, 175)]
    },
    {
        id: 'kaykit-tower-base', label: 'KayKit Tower Base', file: 'building_tower_base_blue.gltf', height: 4.2,
        placements: [placement(-49, 53, 145)]
    },
    {
        id: 'kaykit-catapult-tower', label: 'KayKit Catapult Tower', file: 'building_tower_catapult_blue.gltf', height: 7.2,
        placements: [placement(-59, 40, 110)]
    },
    {
        id: 'kaykit-red-castle', label: 'KayKit Red Castle', file: 'building_castle_red.gltf', height: 10,
        placements: [placement(-58, -55, 25)]
    },
    {
        id: 'kaykit-red-church', label: 'KayKit Red Church', file: 'building_church_red.gltf', height: 7,
        placements: [placement(-43, -60, 0)]
    },
    {
        id: 'kaykit-red-tavern', label: 'KayKit Red Tavern', file: 'building_tavern_red.gltf', height: 6,
        placements: [placement(-29, -61, 0)]
    },
    {
        id: 'kaykit-red-home-a', label: 'KayKit Red Home A', file: 'building_home_A_red.gltf', height: 4.8,
        placements: [placement(-16, -62, 0)]
    },
    {
        id: 'kaykit-red-home-b', label: 'KayKit Red Home B', file: 'building_home_B_red.gltf', height: 5.7,
        placements: [placement(-4, -61, 0)]
    },
    {
        id: 'kaykit-red-market', label: 'KayKit Red Market', file: 'building_market_red.gltf', height: 4.6,
        placements: [placement(9, -61, 0)]
    },
    {
        id: 'kaykit-red-blacksmith', label: 'KayKit Red Blacksmith', file: 'building_blacksmith_red.gltf', height: 5,
        placements: [placement(23, -60, 0)]
    },
    {
        id: 'kaykit-red-barracks', label: 'KayKit Red Barracks', file: 'building_barracks_red.gltf', height: 6.2,
        placements: [placement(37, -58, -10)]
    },
    {
        id: 'kaykit-red-archery-range', label: 'KayKit Red Archery Range', file: 'building_archeryrange_red.gltf', height: 5.2,
        placements: [placement(52, -53, -45)]
    },
    {
        id: 'kaykit-red-lumbermill', label: 'KayKit Red Lumbermill', file: 'building_lumbermill_red.gltf', height: 6.8,
        placements: [placement(59, -40, -90)]
    },
    {
        id: 'kaykit-red-windmill', label: 'KayKit Red Windmill', file: 'building_windmill_red.gltf', height: 7.5,
        placements: [placement(61, -25, -90)]
    },
    {
        id: 'kaykit-red-watermill', label: 'KayKit Red Watermill', file: 'building_watermill_red.gltf', height: 6.8,
        placements: [placement(61, -9, -90)]
    },
    {
        id: 'kaykit-red-mine', label: 'KayKit Red Mine', file: 'building_mine_red.gltf', height: 5.1,
        placements: [placement(62, 7, -90)]
    },
    {
        id: 'kaykit-red-well', label: 'KayKit Red Well', file: 'building_well_red.gltf', height: 2.4,
        placements: [placement(60, 20, -90)]
    },
    {
        id: 'kaykit-red-tower-a', label: 'KayKit Red Tower A', file: 'building_tower_A_red.gltf', height: 7.5,
        placements: [placement(58, 35, -120)]
    },
    {
        id: 'kaykit-red-tower-b', label: 'KayKit Red Tower B', file: 'building_tower_B_red.gltf', height: 6.8,
        placements: [placement(51, 49, -145)]
    },
    {
        id: 'kaykit-red-tower-base', label: 'KayKit Red Tower Base', file: 'building_tower_base_red.gltf', height: 4.2,
        placements: [placement(37, 58, 180)]
    },
    {
        id: 'kaykit-red-catapult-tower', label: 'KayKit Red Catapult Tower', file: 'building_tower_catapult_red.gltf', height: 7.2,
        placements: [placement(20, 61, 180)]
    },
    {
        id: 'kaykit-bridge-a', label: 'KayKit Bridge A', file: 'building_bridge_A.gltf', height: 1.2,
        placements: [placement(4, 58, 180)]
    },
    {
        id: 'kaykit-bridge-b', label: 'KayKit Bridge B', file: 'building_bridge_B.gltf', height: 1.3,
        placements: [placement(-2, -52, 0)]
    },
    {
        id: 'kaykit-destroyed-building', label: 'KayKit Destroyed Building', file: 'building_destroyed.gltf', height: 2.8,
        placements: [placement(-61, -24, 90)]
    },
    {
        id: 'kaykit-grain-store', label: 'KayKit Grain Store', file: 'building_grain.gltf', height: 2.2,
        placements: [placement(-60, -8, 90)]
    },
    {
        id: 'kaykit-scaffolding', label: 'KayKit Scaffolding', file: 'building_scaffolding.gltf', height: 5.5,
        placements: [placement(-61, 10, 90)]
    },
    {
        id: 'kaykit-stage', label: 'KayKit Stage', file: 'building_stage_A.gltf', height: 2.2,
        placements: [placement(-57, 25, 90)]
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
    },
    {
        id: 'kenney-cactus-short', label: 'Kenney Short Cactus', file: 'cactus_short.glb', height: 1.4,
        placements: [placement(-52, -20, 20), placement(-55, -4, 130), placement(-48, 12, 245)]
    },
    {
        id: 'kenney-cactus-tall', label: 'Kenney Tall Cactus', file: 'cactus_tall.glb', height: 2.4,
        placements: [placement(-56, -13, 10), placement(-53, 3, 120), placement(-50, 18, 235)]
    },
    {
        id: 'kenney-campfire', label: 'Kenney Stone Campfire', file: 'campfire_stones.glb', height: 0.5,
        placements: [placement(44, 40, 35), placement(-43, 46, 210)]
    },
    {
        id: 'kenney-canoe', label: 'Kenney Canoe', file: 'canoe.glb', height: 0.65,
        placements: [placement(54, 13, 80), placement(53, 2, 95)]
    },
    {
        id: 'kenney-carrots', label: 'Kenney Carrots', file: 'crop_carrot.glb', height: 0.55,
        placements: [
            placement(32, -28, 0), placement(36, -28, 0), placement(40, -28, 0), placement(44, -28, 0)
        ]
    },
    {
        id: 'kenney-melons', label: 'Kenney Melons', file: 'crop_melon.glb', height: 0.65,
        placements: [
            placement(32, -24, 0), placement(36, -24, 0), placement(40, -24, 0), placement(44, -24, 0)
        ]
    },
    {
        id: 'kenney-pumpkins', label: 'Kenney Pumpkins', file: 'crop_pumpkin.glb', height: 0.65,
        placements: [
            placement(32, -20, 0), placement(36, -20, 0), placement(40, -20, 0), placement(44, -20, 0)
        ]
    },
    {
        id: 'kenney-turnips', label: 'Kenney Turnips', file: 'crop_turnip.glb', height: 0.55,
        placements: [
            placement(32, -16, 0), placement(36, -16, 0), placement(40, -16, 0), placement(44, -16, 0)
        ]
    },
    {
        id: 'kenney-flower-purple-b', label: 'Kenney Purple Flower Clumps', file: 'flower_purpleB.glb', height: 0.65,
        placements: [placement(-37, -31, 25), placement(-31, 33, 115), placement(31, 35, 205), placement(35, -33, 295)]
    },
    {
        id: 'kenney-flower-red-b', label: 'Kenney Red Flower Clumps', file: 'flower_redB.glb', height: 0.65,
        placements: [placement(-43, -25, 5), placement(-35, 39, 95), placement(24, 40, 185), placement(41, -31, 275)]
    },
    {
        id: 'kenney-flower-yellow-b', label: 'Kenney Yellow Flower Clumps', file: 'flower_yellowB.glb', height: 0.65,
        placements: [placement(-47, -18, 15), placement(-40, 30, 105), placement(13, 42, 195), placement(46, -22, 285)]
    },
    {
        id: 'kenney-leafy-grass', label: 'Kenney Leafy Grass', file: 'grass_leafsLarge.glb', height: 0.85,
        placements: [
            placement(-48, -28, 10), placement(-46, 24, 75), placement(-28, 47, 140),
            placement(8, 49, 205), placement(47, 27, 270), placement(48, -30, 335)
        ]
    },
    {
        id: 'kenney-large-log', label: 'Kenney Large Fallen Log', file: 'log_large.glb', height: 0.9,
        placements: [placement(-48, 31, 35), placement(0, 48, 155), placement(47, -36, 275)]
    },
    {
        id: 'kenney-log-stack', label: 'Kenney Log Stack', file: 'log_stack.glb', height: 1.1,
        placements: [placement(-54, 30, 20), placement(29, 49, 145), placement(50, -42, 260)]
    },
    {
        id: 'kenney-tan-mushrooms', label: 'Kenney Tan Mushrooms', file: 'mushroom_tanGroup.glb', height: 0.55,
        placements: [placement(-45, -35, 40), placement(-38, 43, 160), placement(43, 36, 280)]
    },
    {
        id: 'kenney-tall-red-mushroom', label: 'Kenney Tall Red Mushroom', file: 'mushroom_redTall.glb', height: 0.75,
        placements: [placement(-49, -38, 60), placement(-33, 47, 180), placement(47, 32, 300)]
    },
    {
        id: 'kenney-bush-small', label: 'Kenney Small Bush', file: 'plant_bushSmall.glb', height: 0.9,
        placements: [placement(-49, -32, 30), placement(-44, 38, 120), placement(35, 45, 210), placement(48, -34, 300)]
    },
    {
        id: 'kenney-bush-triangle', label: 'Kenney Triangle Bush', file: 'plant_bushTriangle.glb', height: 1.25,
        placements: [placement(-52, -27, 45), placement(-47, 34, 135), placement(40, 41, 225), placement(51, -29, 315)]
    },
    {
        id: 'kenney-rock-large-b', label: 'Kenney Large Rock B', file: 'rock_largeB.glb', height: 2.3,
        placements: [placement(-55, 22, 25), placement(19, 51, 145), placement(53, -19, 265)]
    },
    {
        id: 'kenney-rock-large-c', label: 'Kenney Large Rock C', file: 'rock_largeC.glb', height: 2.1,
        placements: [placement(-54, -30, 55), placement(-12, 51, 175), placement(53, 27, 295)]
    },
    {
        id: 'kenney-rock-tall-a', label: 'Kenney Tall Rock A', file: 'rock_tallA.glb', height: 2,
        placements: [placement(-55, 17, 35), placement(25, 52, 155), placement(54, -14, 275)]
    },
    {
        id: 'kenney-rock-tall-b', label: 'Kenney Tall Rock B', file: 'rock_tallB.glb', height: 2.2,
        placements: [placement(-53, -35, 65), placement(-20, 52, 185), placement(54, 31, 305)]
    },
    {
        id: 'kenney-obelisk', label: 'Kenney Obelisk', file: 'statue_obelisk.glb', height: 3.2,
        placements: [placement(-46, 0, 20), placement(46, 0, 200)]
    },
    {
        id: 'kenney-stone-head', label: 'Kenney Stone Head', file: 'statue_head.glb', height: 1.8,
        placements: [placement(-45, 8, 40), placement(45, 8, 220)]
    },
    {
        id: 'kenney-old-stump', label: 'Kenney Old Stump', file: 'stump_old.glb', height: 1,
        placements: [placement(-50, 27, 25), placement(-6, 48, 145), placement(49, -38, 265)]
    },
    {
        id: 'kenney-detailed-stump', label: 'Kenney Detailed Stump', file: 'stump_roundDetailed.glb', height: 1.1,
        placements: [placement(-51, -24, 55), placement(7, 48, 175), placement(50, 29, 295)]
    },
    {
        id: 'kenney-closed-tent', label: 'Kenney Closed Tent', file: 'tent_detailedClosed.glb', height: 2.2,
        placements: [placement(40, 43, 135), placement(-39, 49, 225)]
    },
    {
        id: 'kenney-open-tent', label: 'Kenney Open Tent', file: 'tent_detailedOpen.glb', height: 2.2,
        placements: [placement(47, 39, 145), placement(-46, 45, 215)]
    },
    {
        id: 'kenney-oak', label: 'Kenney Oak Tree', file: 'tree_oak.glb', height: 7.5,
        placements: [
            placement(-63, -42, 15), placement(-64, 28, 85), placement(-28, 64, 155),
            placement(28, 65, 225), placement(63, 43, 305)
        ]
    },
    {
        id: 'kenney-fall-oak', label: 'Kenney Fall Oak Tree', file: 'tree_oak_fall.glb', height: 7.5,
        placements: [
            placement(-64, -34, 30), placement(-61, 36, 100), placement(-19, 65, 170),
            placement(39, 62, 240), placement(64, 34, 320)
        ]
    },
    {
        id: 'kenney-fat-tree', label: 'Kenney Fat Tree', file: 'tree_fat.glb', height: 6.5,
        placements: [
            placement(-65, -26, 45), placement(-57, 47, 115), placement(-9, 66, 185),
            placement(47, 57, 255), placement(65, 25, 325)
        ]
    },
    {
        id: 'kenney-fall-tree', label: 'Kenney Fall Tree', file: 'tree_default_fall.glb', height: 6,
        placements: [
            placement(-65, -18, 60), placement(-50, 54, 130), placement(2, 65, 200),
            placement(55, 50, 270), placement(65, 16, 340)
        ]
    },
    {
        id: 'kenney-tall-palm', label: 'Kenney Tall Palm', file: 'tree_palmDetailedTall.glb', height: 8,
        placements: [
            placement(-56, -48, 20), placement(-38, -64, 90), placement(10, -65, 160),
            placement(46, -58, 230), placement(64, -44, 300)
        ]
    },
    {
        id: 'kenney-round-pine', label: 'Kenney Round Pine', file: 'tree_pineRoundA.glb', height: 7,
        placements: [
            placement(-66, -10, 35), placement(-43, 59, 105), placement(11, 64, 175),
            placement(57, 46, 245), placement(66, 8, 315)
        ]
    },
    {
        id: 'kenney-detailed-tall-pine', label: 'Kenney Detailed Tall Pine', file: 'tree_pineTallA_detailed.glb', height: 8,
        placements: [
            placement(-66, -2, 50), placement(-35, 63, 120), placement(20, 63, 190),
            placement(61, 38, 260), placement(66, -2, 330)
        ]
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
