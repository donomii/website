import { DEFAULT_SCENE, QUALITY_LEVELS, SCENE_VERSION } from "./types.js";

const SETTING_RULES = Object.freeze({
  seed: Object.freeze({ min: 0, max: 999999, integer: true }),
  islandRadius: Object.freeze({ min: 1.8, max: 4.8 }),
  mountainHeight: Object.freeze({ min: 1.2, max: 5.4 }),
  lowland: Object.freeze({ min: 0, max: 1 }),
  ruggedness: Object.freeze({ min: 0, max: 1 }),
  erosion: Object.freeze({ min: 0, max: 1 }),
  detail: Object.freeze({ min: 0, max: 1 }),
  seaLevel: Object.freeze({ min: -0.45, max: 0.65 }),
  beachWidth: Object.freeze({ min: 0, max: 1 }),
  riverFlow: Object.freeze({ min: 0, max: 1 }),
  vegetation: Object.freeze({ min: 0, max: 1 }),
  treeVariety: Object.freeze({ min: 0, max: 1 }),
  plantCover: Object.freeze({ min: 0, max: 1 }),
  sunAzimuth: Object.freeze({ min: 0, max: 360 }),
  sunElevation: Object.freeze({ min: 3, max: 82 }),
  cloudCover: Object.freeze({ min: 0, max: 1 }),
  cloudScale: Object.freeze({ min: 0, max: 1 }),
  cloudDepth: Object.freeze({ min: 0, max: 1 }),
  summitClouds: Object.freeze({ min: 0, max: 1 }),
  windStrength: Object.freeze({ min: 0, max: 1 }),
  stormIntensity: Object.freeze({ min: 0, max: 1 }),
  haze: Object.freeze({ min: 0, max: 0.65 }),
  waveRoughness: Object.freeze({ min: 0, max: 1 }),
  shoreBreakers: Object.freeze({ min: 0, max: 1 })
});

const CAMERA_RULES = Object.freeze({
  yaw: Object.freeze({ min: -100, max: 100 }),
  pitch: Object.freeze({ min: -0.05, max: 1.35 }),
  distance: Object.freeze({ min: 4.5, max: 18 })
});

const PALETTES = Object.freeze(["temperate", "alpine", "volcanic"]);

function assertRecord(value, path) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Scene load rejected: ${path} was ${typeof value}; expected a keyed data object.`);
  } else {
    return value;
  }
}

function assertExactKeys(record, expectedKeys, path) {
  const actualKeys = Object.keys(record).sort();
  const requiredKeys = [...expectedKeys].sort();
  if (actualKeys.join("|") !== requiredKeys.join("|")) {
    throw new Error(`Scene load rejected: ${path} contained keys [${actualKeys.join(", ")}]; expected exactly [${requiredKeys.join(", ")}].`);
  } else {
    return record;
  }
}

function assertNumber(value, rule, path) {
  const isInteger = rule.integer === true ? Number.isInteger(value) : true;
  if (typeof value !== "number" || !Number.isFinite(value) || !isInteger || value < rule.min || value > rule.max) {
    const kind = rule.integer === true ? "integer" : "number";
    throw new Error(`Scene load rejected: ${path} was ${String(value)}; expected a finite ${kind} from ${rule.min} through ${rule.max}.`);
  } else {
    return value;
  }
}

function assertChoice(value, choices, path, expectation) {
  if (!choices.includes(value)) {
    throw new Error(`Scene load rejected: ${path} was ${String(value)}; expected ${expectation}.`);
  } else {
    return value;
  }
}

function assertBoolean(value, path) {
  if (typeof value !== "boolean") {
    throw new Error(`Scene load rejected: ${path} was ${typeof value}; expected a boolean.`);
  } else {
    return value;
  }
}

function assertVersion(value) {
  if (value !== SCENE_VERSION) {
    throw new Error(`Scene load rejected: version was ${String(value)}; expected version ${SCENE_VERSION}.`);
  } else {
    return value;
  }
}

function validateSettings(value) {
  const settings = assertRecord(value, "settings");
  const expectedKeys = [...Object.keys(SETTING_RULES), "palette", "quality", "animate"];
  assertExactKeys(settings, expectedKeys, "settings");
  for (const [key, rule] of Object.entries(SETTING_RULES)) {
    assertNumber(settings[key], rule, `settings.${key}`);
  }
  assertChoice(settings.palette, PALETTES, "settings.palette", "temperate, alpine, or volcanic");
  assertChoice(settings.quality, Object.keys(QUALITY_LEVELS), "settings.quality", "preview, balanced, or final");
  assertBoolean(settings.animate, "settings.animate");
  return settings;
}

function validateCamera(value) {
  const camera = assertRecord(value, "camera");
  assertExactKeys(camera, Object.keys(CAMERA_RULES), "camera");
  for (const [key, rule] of Object.entries(CAMERA_RULES)) {
    assertNumber(camera[key], rule, `camera.${key}`);
  }
  return camera;
}

export function validateSceneDocument(value) {
  const document = assertRecord(value, "scene document");
  assertExactKeys(document, ["version", "settings", "camera"], "scene document");
  assertVersion(document.version);
  validateSettings(document.settings);
  validateCamera(document.camera);
  return JSON.parse(JSON.stringify(document));
}

export function parseSceneDocument(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Scene load rejected: the selected file was not valid JSON while parsing a Procedural Worlds scene. ${detail}`);
  }
  return validateSceneDocument(parsed);
}

export function serializeSceneDocument(scene) {
  const validated = validateSceneDocument(JSON.parse(JSON.stringify(scene)));
  return `${JSON.stringify(validated, null, 2)}\n`;
}

export function wrapYaw(angle) {
  const turn = Math.PI * 2;
  return ((angle + Math.PI) % turn + turn) % turn - Math.PI;
}

export function resetCamera(scene) {
  scene.camera = JSON.parse(JSON.stringify(DEFAULT_SCENE.camera));
  return scene;
}
