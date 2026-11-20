import { PLANT_SLOT_COUNT, TREE_SLOT_COUNT } from "./types.js";
import { buildRiverRoute, sampleRiverNode } from "./river.js";

const SCATTER_ATTEMPTS = 36;
const RIVER_TREE_ATTEMPTS = 48;
const SLOPE_SAMPLE_DISTANCE = 0.07;
const TREE_HORIZONTAL_RADII = Object.freeze([0.31, 0.55, 0.77]);
const PLANT_HORIZONTAL_RADII = Object.freeze([0.40, 0.12, 0.23]);
const TREE_SWAY_MARGIN = 0.10;
const PLANT_SWAY_MARGIN = 0.04;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0, edge1, value) {
  const position = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return position * position * (3 - 2 * position);
}

function mix(start, end, amount) {
  return start * (1 - amount) + end * amount;
}

function hash2(x, z, seed) {
  const signal = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return signal - Math.floor(signal);
}

function assertIntegerRange(value, minimum, maximum, task) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${task} rejected: value was ${String(value)}; expected an integer from ${minimum} through ${maximum}.`);
  } else {
    return value;
  }
}

export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const lower = mix(hash2(ix, iz, seed), hash2(ix + 1, iz, seed), ux);
  const upper = mix(hash2(ix, iz + 1, seed), hash2(ix + 1, iz + 1, seed), ux);
  return mix(lower, upper, uz);
}

export function fbm(x, z, seed, octaves = 6) {
  let total = 0;
  let amplitude = 0.5;
  let px = x;
  let pz = z;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += amplitude * valueNoise(px, pz, seed + octave * 1.93);
    const nextX = 1.6 * px + 1.2 * pz;
    const nextZ = -1.2 * px + 1.6 * pz;
    px = nextX;
    pz = nextZ;
    amplitude *= 0.5;
  }
  return total;
}

function baseTerrainHeight(x, z, settings) {
  // Even the widest noisy coast ends inside this radius. The river is carved separately.
  const outerRadius = settings.islandRadius * 1.08 * 1.08;
  if (x * x + z * z > outerRadius * outerRadius) return -0.72;
  const seed = settings.seed * 0.013;
  const coastNoise = fbm(x * 0.44 + 7.1, z * 0.44 - 4.3, seed + 3.9, 6);
  const radiusX = settings.islandRadius * (0.84 + coastNoise * 0.22);
  const radiusZ = settings.islandRadius * 1.08;
  const radius = Math.hypot(x / radiusX, z / radiusZ);
  if (radius >= 1.08) return -0.72;
  const qx = fbm(x * 0.38, z * 0.38, seed + 1.7, 6);
  const qz = fbm(x * 0.38 + 5.2, z * 0.38 - 3.1, seed + 8.3, 6);
  const warp = 1.1 + settings.ruggedness * 1.35;
  const wx = x + (qx - 0.5) * warp;
  const wz = z + (qz - 0.5) * warp;
  const island = 1 - smoothstep(0.12, 1.08, radius);
  const dome = Math.pow(Math.max(0, island), 0.92);
  const beachShelfMask = 1 - smoothstep(0.88, 1.08, radius);
  const lowlandInnerEdge = mix(0.60, 0.50, settings.lowland);
  const lowlandOuterEdge = mix(0.78, 0.68, settings.lowland);
  const lowlandShelfMask = 1 - smoothstep(lowlandInnerEdge, lowlandOuterEdge, radius);
  const mountainEdge = mix(0.82, 0.54, settings.lowland);
  const mountainMask = 1 - smoothstep(0.16, mountainEdge, radius);
  const ridgeSignal = fbm(wx * 0.72, wz * 0.72, seed + 13.4, 6);
  const ridges = Math.pow(clamp(1 - Math.abs(ridgeSignal * 2 - 1), 0, 1), 1.55);
  const detailNoise = fbm(wx * 2.15, wz * 2.15, seed + 27.2, 6) - 0.5;
  const channelSignal = fbm(wx * 0.95 + 11.7, wz * 0.95 - 6.4, seed + 41.8, 6);
  const channels = Math.max(0, 0.23 - Math.abs(channelSignal - 0.5)) / 0.23;
  const beachShelfHeight = beachShelfMask * 0.86;
  const lowlandShelfHeight = lowlandShelfMask * mix(0.32, 0.56, settings.lowland);
  const centralPeak = Math.pow(Math.max(0, 1 - radius), 1.55) * settings.mountainHeight * 0.55;
  const ridgeHeight = dome * mountainMask * settings.mountainHeight * (0.15 + ridges * 0.36);
  const detailStrength = mix(0.14, 1, mountainMask);
  const surfaceDetail = dome * detailNoise * settings.detail * settings.ruggedness * 0.72 * detailStrength;
  const erosionCut = dome * mountainMask * channels * settings.erosion * 0.46;
  return -0.72 + beachShelfHeight + lowlandShelfHeight + centralPeak + ridgeHeight + surfaceDetail - erosionCut;
}

function riverProgress(z, settings) {
  const startZ = settings.islandRadius * 0.05;
  const endZ = settings.islandRadius * 1.10;
  return clamp((z - startZ) / (endZ - startZ), 0, 1);
}

const routeKeys = ["seed", "islandRadius", "mountainHeight", "lowland", "ruggedness", "erosion", "detail", "riverFlow"];
let cachedSettings;
let cachedRoute;

export function getRiverRoute(settings) {
  if (cachedSettings && routeKeys.every((key) => settings[key] === cachedSettings[key])) {
    return cachedRoute;
  } else {
    cachedRoute = buildRiverRoute(settings, baseTerrainHeight);
    cachedSettings = { ...settings };
    return cachedRoute;
  }
}

function riverHalfWidth(progress, riverFlow) {
  return Math.max(0.000001, smoothstep(0, 0.15, riverFlow) * mix(0.055, 0.20, riverFlow) * mix(0.55, 1.15, progress));
}

function riverLengthMask(z, settings) {
  const startZ = settings.islandRadius * 0.05;
  const endZ = settings.islandRadius * 1.10;
  return smoothstep(startZ - 0.14, startZ, z) * (1 - smoothstep(endZ, endZ + 0.20, z));
}

export function riverDistance(x, z, settings, widthFactor = 0.92) {
  if (!(settings.riverFlow > 0)) {
    return 100;
  } else {
    const nodes = getRiverRoute(settings);
    const count = nodes.length / 2;
    const start = settings.islandRadius * 0.05;
    const step = settings.islandRadius * 1.05 / (count - 1);
    let nearest = Infinity;
    for (let i = -1; i < count; i += 1) {
      const a = Math.max(0, i);
      const b = Math.min(count - 1, i + 1);
      const az = i < 0 ? start - 0.14 : start + a * step;
      const bz = start + b * step + (i === count - 1 ? 0.20 : 0);
      const dx = nodes[2 * b] - nodes[2 * a];
      const dz = bz - az;
      const rx = x - nodes[2 * a];
      const rz = z - az;
      const t = clamp((rx * dx + rz * dz) / (dx * dx + dz * dz), 0, 1);
      const width = riverHalfWidth(b / (count - 1), settings.riverFlow) * widthFactor;
      nearest = Math.min(nearest, Math.hypot(rx - dx * t, rz - dz * t) - width);
    }
    return nearest;
  }
}

export function terrainHeight(x, z, settings, route) {
  const ground = baseTerrainHeight(x, z, settings);
  const extent = riverLengthMask(z, settings);
  if (!(settings.riverFlow > 0) || extent === 0) {
    return ground;
  } else {
    const nodes = route ?? getRiverRoute(settings);
    const t = riverProgress(z, settings);
    const width = riverHalfWidth(t, settings.riverFlow);
    const across = Math.abs(x - sampleRiverNode(nodes, t, 0)) / width;
    const bed = sampleRiverNode(nodes, t, 1) + 0.032 * Math.min(across * across, 1);
    return mix(ground, bed, extent * (1 - smoothstep(0.58, 2.15, across)));
  }
}

export function terrainSlope(x, z, settings) {
  const slopeX = (terrainHeight(x + SLOPE_SAMPLE_DISTANCE, z, settings) - terrainHeight(x - SLOPE_SAMPLE_DISTANCE, z, settings)) / (SLOPE_SAMPLE_DISTANCE * 2);
  const slopeZ = (terrainHeight(x, z + SLOPE_SAMPLE_DISTANCE, settings) - terrainHeight(x, z - SLOPE_SAMPLE_DISTANCE, settings)) / (SLOPE_SAMPLE_DISTANCE * 2);
  return Math.hypot(slopeX, slopeZ);
}

function treeCandidate(settings, treeIndex, attempt) {
  const seed = settings.seed * 0.017;
  const angleJitter = hash2(treeIndex + 31, attempt + 17, seed + 19.4) - 0.5;
  const radialJitter = hash2(treeIndex + 73, attempt + 47, seed + 29.1);
  const angle = treeIndex * 2.399963 + angleJitter * 0.82 + attempt * 0.11;
  const radialBand = attempt % 7 - 3;
  const radiusRatio = clamp(0.48 + radialJitter * 0.28 + radialBand * 0.018, 0.42, 0.82);
  const alternate = attempt >= RIVER_TREE_ATTEMPTS;
  const bearing = alternate ? (treeIndex + attempt) * 2.399963 + angleJitter * 0.12 : angle;
  const ring = alternate ? 0.72 + 0.17 * radialJitter : radiusRatio;
  const x = Math.cos(bearing) * settings.islandRadius * ring;
  const z = Math.sin(bearing) * settings.islandRadius * 1.08 * ring;
  const y = terrainHeight(x, z, settings);
  const slope = terrainSlope(x, z, settings);
  const targetHeight = settings.seaLevel + 0.58;
  const underwaterPenalty = Math.max(0, settings.seaLevel + 0.12 - y) * 12;
  const mountainPenalty = Math.max(0, y - settings.seaLevel - 1.15) * 5;
  const penalty = Math.abs(y - targetHeight) + slope * 1.6 + underwaterPenalty + mountainPenalty;
  const scale = 0.62 + hash2(treeIndex + 101, attempt + 89, seed + 43.7) * 0.34;
  return Object.freeze({ x, y, z, scale, slope, penalty });
}

function sceneryPenalty(candidate, placedTrees) {
  let penalty = Math.max(0, 0.78 - Math.hypot(candidate.x + 2.05, candidate.z - 0.62)) * 7;
  for (const tree of placedTrees) {
    penalty += Math.max(0, 0.72 - Math.hypot(candidate.x - tree.x, candidate.z - tree.z)) * 6;
  }
  return penalty;
}

function treeKind(settings, treeIndex, height) {
  const seed = settings.seed * 0.017;
  const alternative = hash2(treeIndex + 139, 47, seed + 59.2) < settings.treeVariety * 0.72;
  if (alternative) {
    const palm = height < settings.seaLevel + 0.78 && hash2(treeIndex + 173, 83, seed + 71.4) > 0.62;
    return palm ? 2 : 1;
  } else {
    return 0;
  }
}

function treeCandidateIsSafe(candidate, settings, treeIndex, placedTrees) {
  let safe = candidate.y > settings.seaLevel + 0.10;
  safe = safe && candidate.y < settings.seaLevel + 1.25;
  safe = safe && candidate.slope < 0.82;
  safe = safe && Math.hypot(candidate.x + 2.05, candidate.z - 0.62) >= 0.62;
  const kind = treeKind(settings, treeIndex, candidate.y);
  const riverClearance = TREE_HORIZONTAL_RADII[kind] * candidate.scale + TREE_SWAY_MARGIN;
  safe = safe && riverDistance(candidate.x, candidate.z, settings, 2.15) >= riverClearance;
  for (const tree of placedTrees) {
    const minimumSpacing = Math.max(0.72, (candidate.scale + tree.scale) * 0.46);
    safe = safe && (tree.x >= 100 || Math.hypot(candidate.x - tree.x, candidate.z - tree.z) >= minimumSpacing);
  }
  return safe;
}

function selectTreeCandidate(settings, treeIndex, placedTrees) {
  let best;
  let bestScore = Number.POSITIVE_INFINITY;
  // A winding river can occupy a slot's first search sector. Explore the
  // wider coastal shelf only when the normal river search found no safe ground.
  const attemptCount = (settings.riverFlow ?? 0) > 0 ? 3 * RIVER_TREE_ATTEMPTS : SCATTER_ATTEMPTS;
  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    if (attempt === RIVER_TREE_ATTEMPTS && best !== undefined) {
      break;
    } else {
      const candidate = treeCandidate(settings, treeIndex, attempt);
      if (treeCandidateIsSafe(candidate, settings, treeIndex, placedTrees)) {
        const score = candidate.penalty + sceneryPenalty(candidate, placedTrees);
        best = score < bestScore ? candidate : best;
        bestScore = Math.min(bestScore, score);
      } else {
        continue;
      }
    }
  }
  return best;
}

export function createTreeInstances(settings, maximumCount = TREE_SLOT_COUNT) {
  maximumCount = assertIntegerRange(maximumCount, 1, 64, "Tree scatter count");
  const activeCount = Math.round(settings.vegetation * maximumCount);
  const trees = [];
  for (let treeIndex = 0; treeIndex < maximumCount; treeIndex += 1) {
    const inactiveTree = Object.freeze({ x: 120 + treeIndex, y: 120, z: 120, scale: 1, kind: 0, rotation: 0 });
    if (treeIndex >= activeCount) {
      trees.push(inactiveTree);
    } else {
      const best = selectTreeCandidate(settings, treeIndex, trees);
      if (best === undefined) {
        trees.push(inactiveTree);
      } else {
        const kind = treeKind(settings, treeIndex, best.y);
        const rotation = hash2(treeIndex + 211, 109, settings.seed * 0.017 + 83.6) * Math.PI * 2;
        trees.push(Object.freeze({ x: best.x, y: best.y, z: best.z, scale: best.scale, kind, rotation }));
      }
    }
  }
  return Object.freeze(trees);
}

function plantCandidate(settings, plantIndex, attempt) {
  const seed = settings.seed * 0.019;
  const angleJitter = hash2(plantIndex + 251, attempt + 131, seed + 91.2) - 0.5;
  const radialJitter = hash2(plantIndex + 283, attempt + 163, seed + 101.7);
  const angle = plantIndex * 2.399963 + angleJitter * 1.08 + attempt * 0.17;
  const radialBand = attempt % 7 - 3;
  const radiusRatio = clamp(0.46 + radialJitter * 0.38 + radialBand * 0.014, 0.40, 0.88);
  const x = Math.cos(angle) * settings.islandRadius * radiusRatio;
  const z = Math.sin(angle) * settings.islandRadius * 1.08 * radiusRatio;
  const y = terrainHeight(x, z, settings);
  const slope = terrainSlope(x, z, settings);
  const targetHeight = settings.seaLevel + 0.43;
  const underwaterPenalty = Math.max(0, settings.seaLevel + 0.08 - y) * 18;
  const mountainPenalty = Math.max(0, y - settings.seaLevel - 1.02) * 7;
  const penalty = Math.abs(y - targetHeight) * 0.72 + slope * 1.9 + underwaterPenalty + mountainPenalty;
  const scale = 0.68 + hash2(plantIndex + 307, attempt + 191, seed + 113.9) * 0.34;
  return Object.freeze({ x, y, z, scale, slope, penalty });
}

function plantSceneryPenalty(candidate, placedPlants, trees) {
  let penalty = Math.max(0, 0.48 - Math.hypot(candidate.x + 2.05, candidate.z - 0.62)) * 8;
  for (const tree of trees) {
    penalty += tree.x < 100 ? Math.max(0, 0.34 - Math.hypot(candidate.x - tree.x, candidate.z - tree.z)) * 7 : 0;
  }
  for (const plant of placedPlants) {
    penalty += Math.max(0, 0.31 - Math.hypot(candidate.x - plant.x, candidate.z - plant.z)) * 5;
  }
  return penalty;
}

function plantKind(settings, plantIndex, height) {
  if (height < settings.seaLevel + 0.27) {
    return 1;
  } else {
    return hash2(plantIndex + 347, 229, settings.seed * 0.019 + 127.3) > 0.48 ? 2 : 0;
  }
}

function plantCandidateIsSafe(candidate, settings, plantIndex, placedPlants, trees) {
  let safe = candidate.y > settings.seaLevel + 0.06;
  safe = safe && candidate.y < settings.seaLevel + 1.08;
  safe = safe && candidate.slope < 0.75;
  safe = safe && Math.hypot(candidate.x + 2.05, candidate.z - 0.62) >= 0.32;
  const kind = plantKind(settings, plantIndex, candidate.y);
  const riverClearance = PLANT_HORIZONTAL_RADII[kind] * candidate.scale + PLANT_SWAY_MARGIN;
  safe = safe && riverDistance(candidate.x, candidate.z, settings, 2.15) >= riverClearance;
  for (const tree of trees) {
    const minimumSpacing = 0.26 + candidate.scale * 0.14 + tree.scale * 0.08;
    safe = safe && (tree.x >= 100 || Math.hypot(candidate.x - tree.x, candidate.z - tree.z) >= minimumSpacing);
  }
  for (const plant of placedPlants) {
    const minimumSpacing = 0.16 + (candidate.scale + plant.scale) * 0.12;
    safe = safe && (plant.x >= 100 || Math.hypot(candidate.x - plant.x, candidate.z - plant.z) >= minimumSpacing);
  }
  return safe;
}

function selectPlantCandidate(settings, plantIndex, placedPlants, trees) {
  let best;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt += 1) {
    const candidate = plantCandidate(settings, plantIndex, attempt);
    if (!plantCandidateIsSafe(candidate, settings, plantIndex, placedPlants, trees)) {
      continue;
    } else {
      const score = candidate.penalty + plantSceneryPenalty(candidate, placedPlants, trees);
      best = score < bestScore ? candidate : best;
      bestScore = Math.min(bestScore, score);
    }
  }
  return best;
}

export function createPlantInstances(settings, trees = createTreeInstances(settings), maximumCount = PLANT_SLOT_COUNT) {
  maximumCount = assertIntegerRange(maximumCount, 1, 64, "Plant scatter count");
  if (!Array.isArray(trees) || trees.length === 0) {
    throw new Error("Plant scatter rejected: tree instances were unavailable; expected a nonempty sequence for scenery separation.");
  } else {
    trees = [...trees];
  }
  const activeCount = Math.round(settings.plantCover * maximumCount);
  const plants = [];
  for (let plantIndex = 0; plantIndex < maximumCount; plantIndex += 1) {
    const inactivePlant = Object.freeze({ x: 140 + plantIndex, y: 140, z: 140, scale: 1, kind: 0, rotation: 0 });
    if (plantIndex >= activeCount) {
      plants.push(inactivePlant);
    } else {
      const best = selectPlantCandidate(settings, plantIndex, plants, trees);
      if (best === undefined) {
        plants.push(inactivePlant);
      } else {
        const kind = plantKind(settings, plantIndex, best.y);
        const rotation = hash2(plantIndex + 379, 251, settings.seed * 0.019 + 139.1) * Math.PI * 2;
        plants.push(Object.freeze({ x: best.x, y: best.y, z: best.z, scale: best.scale, kind, rotation }));
      }
    }
  }
  return Object.freeze(plants);
}

export function createTerrainObj(settings, resolution = 144) {
  resolution = assertIntegerRange(resolution, 8, 512, "OBJ export resolution");
  const lines = ["# Procedural Worlds terrain", `# seed ${settings.seed}`, "o ProceduralIsland"];
  const extent = settings.islandRadius * 1.38;
  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    const z = mix(-extent, extent, zIndex / (resolution - 1));
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const x = mix(-extent, extent, xIndex / (resolution - 1));
      const y = terrainHeight(x, z, settings);
      lines.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
    }
  }
  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      lines.push(`vt ${(xIndex / (resolution - 1)).toFixed(6)} ${(zIndex / (resolution - 1)).toFixed(6)}`);
    }
  }
  for (let zIndex = 0; zIndex < resolution - 1; zIndex += 1) {
    for (let xIndex = 0; xIndex < resolution - 1; xIndex += 1) {
      const a = zIndex * resolution + xIndex + 1;
      const b = a + 1;
      const c = a + resolution;
      const d = c + 1;
      lines.push(`f ${a}/${a} ${c}/${c} ${b}/${b}`);
      lines.push(`f ${b}/${b} ${c}/${c} ${d}/${d}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function createHeightmapPixels(settings, size = 256) {
  size = assertIntegerRange(size, 16, 2048, "Heightmap export size");
  const pixels = new Uint8ClampedArray(size * size * 4);
  const extent = settings.islandRadius * 1.38;
  const minimumHeight = -0.72;
  const maximumHeight = settings.mountainHeight * 1.55;
  const route = settings.riverFlow > 0 ? getRiverRoute(settings) : undefined;
  for (let row = 0; row < size; row += 1) {
    const z = mix(-extent, extent, row / (size - 1));
    for (let column = 0; column < size; column += 1) {
      const x = mix(-extent, extent, column / (size - 1));
      const height = terrainHeight(x, z, settings, route);
      const shade = Math.round(clamp((height - minimumHeight) / (maximumHeight - minimumHeight), 0, 1) * 255);
      const index = (row * size + column) * 4;
      pixels[index] = shade;
      pixels[index + 1] = shade;
      pixels[index + 2] = shade;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}
