/**
 * @typedef {Object} SceneSettings
 * @property {number} seed Deterministic procedural world seed.
 * @property {number} islandRadius Radius of the main island in world units.
 * @property {number} mountainHeight Height contribution of the central mountain.
 * @property {number} lowland Width and flatness of the coastal lowland shelf.
 * @property {number} ruggedness Strength of ridges and small landforms.
 * @property {number} erosion Strength of procedural drainage channels.
 * @property {number} detail Amount of high-frequency terrain detail.
 * @property {number} seaLevel Height of the water plane.
 * @property {number} beachWidth Vertical width of the sandy shoreline material.
 * @property {number} riverFlow Width, depth, and visible motion of the mountain river.
 * @property {number} vegetation Number of procedural trees scattered across low ground.
 * @property {number} treeVariety Proportion of trees using mixed broadleaf and palm forms.
 * @property {number} plantCover Number of procedural ground-plant clusters and material patches.
 * @property {number} sunAzimuth Horizontal sun direction in degrees.
 * @property {number} sunElevation Vertical sun direction in degrees.
 * @property {number} cloudCover Portion of the sky occupied by clouds.
 * @property {number} cloudScale Balance between broad cloud banks and small broken forms.
 * @property {number} cloudDepth Optical thickness and sculpting of cloud masses.
 * @property {number} summitClouds Amount and thickness of small clouds around the upper mountain.
 * @property {number} windStrength Strength of cloud drift, rain slant, waves, and foliage sway.
 * @property {number} stormIntensity Strength of overcast light, rain, lightning, and rough water.
 * @property {number} haze Atmospheric distance haze density.
 * @property {number} waveRoughness Strength of procedural water ripples.
 * @property {number} shoreBreakers Strength of shallow breaking waves and shoreline foam.
 * @property {string} palette Named terrain and atmosphere color scheme.
 * @property {string} quality Ray-march step and display-resolution preset.
 * @property {boolean} animate Whether weather, foliage, water, and camera orbit move.
 */

/**
 * @typedef {Object} TreeInstance
 * @property {number} x Horizontal world position.
 * @property {number} y Terrain height at the tree base.
 * @property {number} z Depth world position.
 * @property {number} scale Relative trunk and foliage size.
 * @property {number} kind Deterministic conifer, broadleaf, or palm form identifier.
 * @property {number} rotation Horizontal form rotation in radians.
 */

/**
 * @typedef {Object} PlantInstance
 * @property {number} x Horizontal world position.
 * @property {number} y Terrain height at the plant base.
 * @property {number} z Depth world position.
 * @property {number} scale Relative shrub, reed, or flower-clump size.
 * @property {number} kind Deterministic shrub, reed, or flower-clump form identifier.
 * @property {number} rotation Horizontal form rotation in radians.
 */

/**
 * @typedef {Object} CameraSettings
 * @property {number} yaw Orbit angle around the island in radians.
 * @property {number} pitch Camera elevation angle in radians.
 * @property {number} distance Distance from the island focus point.
 */

/**
 * @typedef {Object} SceneDocument
 * @property {number} version Scene file format version.
 * @property {SceneSettings} settings Rendered world settings.
 * @property {CameraSettings} camera Viewpoint settings.
 */

export const SCENE_VERSION = 5;
export const RIVER_NODE_COUNT = 41;
export const TREE_SLOT_COUNT = 16;
export const PLANT_SLOT_COUNT = 10;

export const QUALITY_LEVELS = Object.freeze({
  preview: Object.freeze({ steps: 88, scale: 0.58, label: "Preview" }),
  balanced: Object.freeze({ steps: 132, scale: 0.78, label: "Balanced" }),
  final: Object.freeze({ steps: 184, scale: 1, label: "Final" })
});

export const DEFAULT_SCENE = Object.freeze({
  version: SCENE_VERSION,
  settings: Object.freeze({
    seed: 1847,
    islandRadius: 3.25,
    mountainHeight: 3.65,
    lowland: 0.66,
    ruggedness: 0.68,
    erosion: 0.54,
    detail: 0.64,
    seaLevel: 0,
    beachWidth: 0.55,
    riverFlow: 0.72,
    vegetation: 0.72,
    treeVariety: 0.68,
    plantCover: 0.64,
    sunAzimuth: 218,
    sunElevation: 34,
    cloudCover: 0.46,
    cloudScale: 0.55,
    cloudDepth: 0.62,
    summitClouds: 0.42,
    windStrength: 0.35,
    stormIntensity: 0,
    haze: 0,
    waveRoughness: 0.38,
    shoreBreakers: 0.74,
    palette: "temperate",
    quality: "balanced",
    animate: false
  }),
  camera: Object.freeze({
    yaw: -0.72,
    pitch: 0.28,
    distance: 9.8
  })
});

export const PRESETS = Object.freeze({
  island: Object.freeze({
    islandRadius: 3.25,
    mountainHeight: 3.65,
    lowland: 0.66,
    ruggedness: 0.68,
    erosion: 0.54,
    detail: 0.64,
    seaLevel: 0,
    beachWidth: 0.55,
    riverFlow: 0.72,
    vegetation: 0.72,
    treeVariety: 0.68,
    plantCover: 0.64,
    palette: "temperate"
  }),
  alpine: Object.freeze({
    islandRadius: 3.7,
    mountainHeight: 4.6,
    lowland: 0.42,
    ruggedness: 0.88,
    erosion: 0.72,
    detail: 0.78,
    seaLevel: -0.1,
    beachWidth: 0.28,
    riverFlow: 0.58,
    vegetation: 0.48,
    treeVariety: 0.28,
    plantCover: 0.34,
    palette: "alpine"
  }),
  volcanic: Object.freeze({
    islandRadius: 2.85,
    mountainHeight: 4.15,
    lowland: 0.30,
    ruggedness: 0.92,
    erosion: 0.36,
    detail: 0.82,
    seaLevel: 0.08,
    beachWidth: 0.38,
    riverFlow: 0.22,
    vegetation: 0.18,
    treeVariety: 0.42,
    plantCover: 0.12,
    palette: "volcanic"
  })
});

export const CONTROL_GROUPS = Object.freeze([
  Object.freeze({
    id: "terrain",
    title: "Terrain Lab",
    technique: "DOMAIN-WARPED FBM",
    controls: Object.freeze([
      Object.freeze({ key: "islandRadius", label: "Island radius", min: 1.8, max: 4.8, step: 0.05, unit: " wu", help: "Changes the island footprint. Larger values push the shoreline farther from the mountain." }),
      Object.freeze({ key: "mountainHeight", label: "Mountain height", min: 1.2, max: 5.4, step: 0.05, unit: " wu", help: "Raises or lowers the central procedural mountain." }),
      Object.freeze({ key: "lowland", label: "Lowland shelf", min: 0, max: 1, step: 0.01, unit: "", help: "Widens and flattens the habitable ground between the central mountain and beach." }),
      Object.freeze({ key: "ruggedness", label: "Ruggedness", min: 0, max: 1, step: 0.01, unit: "", help: "Blends in sharper ridges, broken rock, and an irregular coastline." }),
      Object.freeze({ key: "erosion", label: "Erosion", min: 0, max: 1, step: 0.01, unit: "", help: "Carves branching drainage channels into the mountain slopes." }),
      Object.freeze({ key: "detail", label: "Surface detail", min: 0, max: 1, step: 0.01, unit: "", help: "Controls fine terrain noise. Lower it for broad rounded landforms." }),
      Object.freeze({ key: "seaLevel", label: "Sea level", min: -0.45, max: 0.65, step: 0.01, unit: " wu", help: "Moves the reflective ocean plane up or down across the island." }),
      Object.freeze({ key: "beachWidth", label: "Beach width", min: 0, max: 1, step: 0.01, unit: "", help: "Widens the sandy height band between the waterline and grassy lowland." }),
      Object.freeze({ key: "riverFlow", label: "River flow", min: 0, max: 1, step: 0.01, unit: "", help: "Widens and deepens the seeded river from mountain to sea and strengthens its visible downstream flow. Zero removes the river." })
    ])
  }),
  Object.freeze({
    id: "ecosystem",
    title: "Ecosystem Lab",
    technique: "SDF SCATTER",
    controls: Object.freeze([
      Object.freeze({ key: "vegetation", label: "Tree cover", min: 0, max: 1, step: 0.01, unit: "", help: "Controls how many deterministic signed-distance trees grow on suitable flat lowland." }),
      Object.freeze({ key: "treeVariety", label: "Tree variety", min: 0, max: 1, step: 0.01, unit: "", help: "Blends the forest from uniform conifers toward a seeded mix of conifer, broadleaf, and palm forms." }),
      Object.freeze({ key: "plantCover", label: "Ground plants", min: 0, max: 1, step: 0.01, unit: "", help: "Adds grounded shrubs, reeds, flower clumps, and small procedural vegetation patches." })
    ])
  }),
  Object.freeze({
    id: "weather",
    title: "Weather Lab",
    technique: "LAYERED ATMOSPHERE",
    controls: Object.freeze([
      Object.freeze({ key: "cloudCover", label: "Cloud cover", min: 0, max: 1, step: 0.01, unit: "", help: "Sets how much domain-warped procedural cloud fills the sky." }),
      Object.freeze({ key: "cloudScale", label: "Cloud scale", min: 0, max: 1, step: 0.01, unit: "", help: "Moves the layered sky between broad cloud banks and smaller broken cloud forms." }),
      Object.freeze({ key: "cloudDepth", label: "Cloud depth", min: 0, max: 1, step: 0.01, unit: "", help: "Builds thicker cloud cores, darker undersides, and brighter sunlit edges without changing sky coverage." }),
      Object.freeze({ key: "summitClouds", label: "Summit clouds", min: 0, max: 1, step: 0.01, unit: "", help: "Adds small seeded cloud puffs around the upper mountain. Higher values add and thicken the puffs; zero removes them." }),
      Object.freeze({ key: "windStrength", label: "Wind strength", min: 0, max: 1, step: 0.01, unit: "", help: "Controls cloud drift, foliage sway, rain slant, and wave speed when the world animates." }),
      Object.freeze({ key: "stormIntensity", label: "Storm intensity", min: 0, max: 1, step: 0.01, unit: "", help: "Builds dark overcast, rain, lightning flashes, heavier haze, and rougher water." })
    ])
  }),
  Object.freeze({
    id: "atmosphere",
    title: "Sky & Water Lab",
    technique: "PROCEDURAL LIGHT",
    controls: Object.freeze([
      Object.freeze({ key: "sunAzimuth", label: "Sun azimuth", min: 0, max: 360, step: 1, unit: "°", help: "Rotates the sun around the horizon and changes the shadow direction." }),
      Object.freeze({ key: "sunElevation", label: "Sun elevation", min: 3, max: 82, step: 1, unit: "°", help: "Raises the sun from a long-shadow sunset to overhead daylight." }),
      Object.freeze({ key: "haze", label: "Distance haze", min: 0, max: 0.65, step: 0.01, unit: "", help: "Adds calm-weather aerial perspective so distant terrain blends into the horizon. Zero disables it; storms can still add haze." }),
      Object.freeze({ key: "waveRoughness", label: "Wave roughness", min: 0, max: 1, step: 0.01, unit: "", help: "Strengthens the seeded, irregular directional waves used for ocean reflections." }),
      Object.freeze({ key: "shoreBreakers", label: "Shore breakers", min: 0, max: 1, step: 0.01, unit: "", help: "Adds rolling shallow-water crests, broken whitewater, and foamy swash along the beach. Zero calms the shoreline." })
    ])
  })
]);

export function cloneDefaultScene() {
  return JSON.parse(JSON.stringify(DEFAULT_SCENE));
}
