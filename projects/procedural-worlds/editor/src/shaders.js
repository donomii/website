import { PLANT_SLOT_COUNT, TREE_SLOT_COUNT, RIVER_NODE_COUNT } from "./types.js";
import { LOCAL_EFFECTS_SHADER } from "./shader-effects.js?v=5.2";

export const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform float u_islandRadius;
uniform float u_mountainHeight;
uniform float u_lowland;
uniform float u_ruggedness;
uniform float u_erosion;
uniform float u_detail;
uniform float u_seaLevel;
uniform float u_beachWidth;
uniform float u_riverFlow;
uniform vec2 u_riverNodes[${RIVER_NODE_COUNT}];
uniform float u_plantCover;
uniform float u_cloudCover;
uniform float u_cloudScale;
uniform float u_cloudDepth;
uniform float u_summitClouds;
uniform float u_windStrength;
uniform float u_stormIntensity;
uniform float u_haze;
uniform float u_waveRoughness;
uniform float u_shoreBreakers;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_distance;
uniform vec3 u_sunDirection;
uniform int u_palette;
uniform int u_steps;
uniform vec4 u_treeData[${TREE_SLOT_COUNT}];
uniform vec2 u_treeMeta[${TREE_SLOT_COUNT}];
uniform vec4 u_plantData[${PLANT_SLOT_COUNT}];
uniform vec2 u_plantMeta[${PLANT_SLOT_COUNT}];

const float PI = 3.14159265359;
const float FAR_DISTANCE = 44.0;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 point, float seed) {
  float signal = sin(dot(point, vec2(127.1, 311.7)) + seed * 74.7) * 43758.5453123;
  return fract(signal);
}

float valueNoise(vec2 point, float seed) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 curve = local * local * (3.0 - 2.0 * local);
  float lower = mix(hash21(cell, seed), hash21(cell + vec2(1.0, 0.0), seed), curve.x);
  float upper = mix(hash21(cell + vec2(0.0, 1.0), seed), hash21(cell + vec2(1.0), seed), curve.x);
  return mix(lower, upper, curve.y);
}

float fbm(vec2 point, float seed) {
  float total = 0.0;
  float amplitude = 0.5;
  mat2 octaveTransform = mat2(1.6, -1.2, 1.2, 1.6);
  for (int octave = 0; octave < 6; octave += 1) {
    total += amplitude * valueNoise(point, seed + float(octave) * 1.93);
    point = octaveTransform * point;
    amplitude *= 0.5;
  }
  return total;
}

vec4 riverSection(float progress) {
  float station = progress * float(${RIVER_NODE_COUNT - 1});
  int i = min(int(station), ${RIVER_NODE_COUNT - 2});
  vec2 a = u_riverNodes[i];
  vec2 b = u_riverNodes[i + 1];
  return vec4(mix(a, b, station - float(i)), (b - a) * float(${RIVER_NODE_COUNT - 1}) / (u_islandRadius * 1.05));
}

vec4 riverPathData(vec2 point) {
  float startZ = u_islandRadius * 0.05;
  float endZ = u_islandRadius * 1.10;
  float progress = saturate((point.y - startZ) / (endZ - startZ));
  float centerX = riverSection(progress).x;
  float halfWidth = max(0.000001, smoothstep(0.0, 0.15, u_riverFlow) * mix(0.055, 0.20, u_riverFlow) * mix(0.55, 1.15, progress));
  float sourceMask = smoothstep(startZ - 0.14, startZ, point.y);
  float mouthMask = 1.0 - smoothstep(endZ, endZ + 0.20, point.y);
  return vec4(progress, abs(point.x - centerX), halfWidth, sourceMask * mouthMask);
}

float riverBankMask(vec2 point) {
  vec4 river = riverPathData(point);
  float bank = 1.0 - smoothstep(river.z, river.z * 2.15, river.y);
  return bank * river.w * u_riverFlow;
}

float riverWaterMask(vec2 point) {
  vec4 river = riverPathData(point);
  float water = 1.0 - smoothstep(river.z * 0.58, river.z * 0.92, river.y);
  return water * river.w * u_riverFlow;
}

float terrainHeight(vec2 point) {
  float seed = u_seed * 0.013;
  float qx = fbm(point * 0.38, seed + 1.7);
  float qz = fbm(point * 0.38 + vec2(5.2, -3.1), seed + 8.3);
  float warp = 1.1 + u_ruggedness * 1.35;
  vec2 warped = point + (vec2(qx, qz) - 0.5) * warp;
  float coastNoise = fbm(point * 0.44 + vec2(7.1, -4.3), seed + 3.9);
  vec2 radii = vec2(u_islandRadius * (0.84 + coastNoise * 0.22), u_islandRadius * 1.08);
  float radius = length(point / radii);
  float island = 1.0 - smoothstep(0.12, 1.08, radius);
  float dome = pow(max(0.0, island), 0.92);
  float beachShelfMask = 1.0 - smoothstep(0.88, 1.08, radius);
  float lowlandInnerEdge = mix(0.60, 0.50, u_lowland);
  float lowlandOuterEdge = mix(0.78, 0.68, u_lowland);
  float lowlandShelfMask = 1.0 - smoothstep(lowlandInnerEdge, lowlandOuterEdge, radius);
  float mountainEdge = mix(0.82, 0.54, u_lowland);
  float mountainMask = 1.0 - smoothstep(0.16, mountainEdge, radius);
  float ridgeSignal = fbm(warped * 0.72, seed + 13.4);
  float ridges = pow(saturate(1.0 - abs(ridgeSignal * 2.0 - 1.0)), 1.55);
  float detailNoise = fbm(warped * 2.15, seed + 27.2) - 0.5;
  float channelSignal = fbm(warped * 0.95 + vec2(11.7, -6.4), seed + 41.8);
  float channels = max(0.0, 0.23 - abs(channelSignal - 0.5)) / 0.23;
  float beachShelfHeight = beachShelfMask * 0.86;
  float lowlandShelfHeight = lowlandShelfMask * mix(0.32, 0.56, u_lowland);
  float centralPeak = pow(max(0.0, 1.0 - radius), 1.55) * u_mountainHeight * 0.55;
  float ridgeHeight = dome * mountainMask * u_mountainHeight * (0.15 + ridges * 0.36);
  float detailStrength = mix(0.14, 1.0, mountainMask);
  float surfaceDetail = dome * detailNoise * u_detail * u_ruggedness * 0.72 * detailStrength;
  float erosionCut = dome * mountainMask * channels * u_erosion * 0.46;
  float baseHeight = -0.72 + beachShelfHeight + lowlandShelfHeight + centralPeak + ridgeHeight + surfaceDetail - erosionCut;
  if (u_riverFlow <= 0.0 || point.y < u_islandRadius * 0.05 - 0.14 || point.y > u_islandRadius * 1.10 + 0.20) {
    return baseHeight;
  } else {
    vec4 river = riverPathData(point);
    float across = river.y / river.z;
    float bed = riverSection(river.x).y + 0.032 * min(across * across, 1.0);
    return mix(baseHeight, bed, (1.0 - smoothstep(0.58, 2.15, across)) * river.w);
  }
}

float sdEllipsoid(vec3 point, vec3 radius) {
  float k0 = length(point / radius);
  float k1 = length(point / (radius * radius));
  return k0 * (k0 - 1.0) / max(k1, 0.0001);
}

float sdCappedCylinder(vec3 point, float radius, float halfHeight) {
  vec2 distanceToEdge = abs(vec2(length(point.xz), point.y)) - vec2(radius, halfHeight);
  return min(max(distanceToEdge.x, distanceToEdge.y), 0.0) + length(max(distanceToEdge, 0.0));
}

vec3 rotateFlora(vec3 point, float rotation) {
  float cosine = cos(rotation);
  float sine = sin(rotation);
  point.xz = mat2(cosine, -sine, sine, cosine) * point.xz;
  return point;
}

vec3 swayFlora(vec3 point, float phase, float amount) {
  float weatherWind = saturate(u_windStrength + u_stormIntensity * 0.42);
  float sway = sin(u_time * (0.82 + weatherWind * 1.35) + phase) * weatherWind * amount;
  point.x += point.y * point.y * sway;
  return point;
}

vec2 coniferField(vec3 local, float scale) {
  float trunk = sdCappedCylinder(local - vec3(0.0, 0.34 * scale, 0.0), 0.055 * scale, 0.34 * scale);
  float lowerCrown = sdEllipsoid(local - vec3(0.0, 0.64 * scale, 0.0), vec3(0.31, 0.27, 0.31) * scale);
  float middleCrown = sdEllipsoid(local - vec3(0.0, 0.84 * scale, 0.0), vec3(0.25, 0.30, 0.25) * scale);
  float upperCrown = sdEllipsoid(local - vec3(0.0, 1.06 * scale, 0.0), vec3(0.17, 0.28, 0.17) * scale);
  float foliage = min(lowerCrown, min(middleCrown, upperCrown));
  return vec2(min(trunk, foliage), mix(3.0, 4.0, step(foliage, trunk)));
}

vec2 broadleafField(vec3 local, float scale) {
  float trunk = sdCappedCylinder(local - vec3(0.0, 0.40 * scale, 0.0), 0.062 * scale, 0.40 * scale);
  float leftCrown = sdEllipsoid(local - vec3(-0.17, 0.88, 0.02) * scale, vec3(0.34, 0.31, 0.33) * scale);
  float rightCrown = sdEllipsoid(local - vec3(0.19, 0.90, -0.04) * scale, vec3(0.35, 0.33, 0.31) * scale);
  float topCrown = sdEllipsoid(local - vec3(0.01, 1.13, 0.02) * scale, vec3(0.31, 0.30, 0.30) * scale);
  float foliage = min(leftCrown, min(rightCrown, topCrown));
  return vec2(min(trunk, foliage), mix(3.0, 4.0, step(foliage, trunk)));
}

vec2 palmField(vec3 local, float scale) {
  float trunk = sdCappedCylinder(local - vec3(0.0, 0.48 * scale, 0.0), 0.052 * scale, 0.48 * scale);
  vec3 crownPoint = local - vec3(0.0, 1.02 * scale, 0.0);
  float leafEast = sdEllipsoid(crownPoint - vec3(0.23, -0.04, 0.0) * scale, vec3(0.54, 0.075, 0.13) * scale);
  float leafNorth = sdEllipsoid(crownPoint - vec3(0.0, -0.02, 0.23) * scale, vec3(0.13, 0.075, 0.54) * scale);
  float leafWest = sdEllipsoid(crownPoint + vec3(0.23, 0.04, 0.0) * scale, vec3(0.54, 0.075, 0.13) * scale);
  float leafSouth = sdEllipsoid(crownPoint + vec3(0.0, 0.02, 0.23) * scale, vec3(0.13, 0.075, 0.54) * scale);
  float foliage = min(min(leafEast, leafNorth), min(leafWest, leafSouth));
  return vec2(min(trunk, foliage), mix(3.0, 4.0, step(foliage, trunk)));
}

vec2 treeField(vec3 point, float maximumDistance) {
  vec2 result = vec2(FAR_DISTANCE, 0.0);
  for (int treeIndex = 0; treeIndex < ${TREE_SLOT_COUNT}; treeIndex += 1) {
    vec4 tree = u_treeData[treeIndex];
    vec2 meta = u_treeMeta[treeIndex];
    vec3 local = rotateFlora(point - tree.xyz, meta.y);
    float sphereBound = length(local - vec3(0.0, 0.68 * tree.w, 0.0)) - 1.08 * tree.w;
    if (sphereBound >= min(result.x, maximumDistance)) {
      continue;
    } else {
      local = swayFlora(local, float(treeIndex) * 1.71 + meta.y, 0.052);
      vec2 exact;
      if (meta.x < 0.5) {
        exact = coniferField(local, tree.w);
      } else {
        if (meta.x < 1.5) {
          exact = broadleafField(local, tree.w);
        } else {
          exact = palmField(local, tree.w);
        }
      }
      result = exact.x < result.x ? exact : result;
    }
  }
  return result;
}

vec2 shrubField(vec3 local, float scale) {
  float center = sdEllipsoid(local - vec3(0.0, 0.20, 0.0) * scale, vec3(0.25, 0.20, 0.23) * scale);
  float left = sdEllipsoid(local - vec3(-0.17, 0.15, 0.04) * scale, vec3(0.20, 0.15, 0.18) * scale);
  float right = sdEllipsoid(local - vec3(0.18, 0.17, -0.03) * scale, vec3(0.21, 0.17, 0.19) * scale);
  return vec2(min(center, min(left, right)), 5.0);
}

vec2 reedField(vec3 local, float scale) {
  float firstStem = sdCappedCylinder(local - vec3(-0.08, 0.19, 0.0) * scale, 0.018 * scale, 0.19 * scale);
  float secondStem = sdCappedCylinder(local - vec3(0.02, 0.24, 0.03) * scale, 0.016 * scale, 0.24 * scale);
  float thirdStem = sdCappedCylinder(local - vec3(0.10, 0.17, -0.03) * scale, 0.017 * scale, 0.17 * scale);
  float stems = min(firstStem, min(secondStem, thirdStem));
  float seedHead = sdEllipsoid(local - vec3(0.02, 0.49, 0.03) * scale, vec3(0.035, 0.085, 0.035) * scale);
  return vec2(min(stems, seedHead), mix(5.0, 6.0, step(seedHead, stems)));
}

vec2 flowerField(vec3 local, float scale) {
  float stem = sdCappedCylinder(local - vec3(0.0, 0.16, 0.0) * scale, 0.014 * scale, 0.16 * scale);
  float leftLeaf = sdEllipsoid(local - vec3(-0.09, 0.13, 0.0) * scale, vec3(0.12, 0.035, 0.065) * scale);
  float rightLeaf = sdEllipsoid(local - vec3(0.10, 0.19, 0.0) * scale, vec3(0.13, 0.035, 0.065) * scale);
  float foliage = min(stem, min(leftLeaf, rightLeaf));
  float blossom = length(local - vec3(0.0, 0.35, 0.0) * scale) - 0.075 * scale;
  return vec2(min(foliage, blossom), mix(5.0, 6.0, step(blossom, foliage)));
}

vec2 plantField(vec3 point, float maximumDistance) {
  vec2 result = vec2(FAR_DISTANCE, 0.0);
  for (int plantIndex = 0; plantIndex < ${PLANT_SLOT_COUNT}; plantIndex += 1) {
    vec4 plant = u_plantData[plantIndex];
    vec2 meta = u_plantMeta[plantIndex];
    vec3 local = rotateFlora(point - plant.xyz, meta.y);
    float sphereBound = length(local - vec3(0.0, 0.23 * plant.w, 0.0)) - 0.48 * plant.w;
    if (sphereBound >= min(result.x, maximumDistance)) {
      continue;
    } else {
      local = swayFlora(local, float(plantIndex) * 2.13 + meta.y, 0.11);
      vec2 exact;
      if (meta.x < 0.5) {
        exact = shrubField(local, plant.w);
      } else {
        if (meta.x < 1.5) {
          exact = reedField(local, plant.w);
        } else {
          exact = flowerField(local, plant.w);
        }
      }
      result = exact.x < result.x ? exact : result;
    }
  }
  return result;
}

vec2 groundField(vec3 point) {
  float terrainBound = (point.y - terrainHeight(point.xz)) * 0.26;
  vec3 rockPoint = point - vec3(-2.05, 0.08, 0.62);
  rockPoint.xz = mat2(0.88, -0.48, 0.48, 0.88) * rockPoint.xz;
  float rockBound = sdEllipsoid(rockPoint, vec3(0.28, 0.44, 0.34));
  float useRock = step(rockBound, terrainBound);
  return vec2(min(terrainBound, rockBound), mix(1.0, 2.0, useRock));
}

vec2 sceneField(vec3 point) {
  vec2 ground = groundField(point);
  vec2 trees = treeField(point, ground.x);
  vec2 plants = plantField(point, min(ground.x, trees.x));
  vec2 result = trees.x < ground.x ? trees : ground;
  return plants.x < result.x ? plants : result;
}

float treeShadowField(vec3 point, float maximumDistance) {
  float result = FAR_DISTANCE;
  for (int treeIndex = 0; treeIndex < ${TREE_SLOT_COUNT}; treeIndex += 1) {
    vec4 tree = u_treeData[treeIndex];
    vec2 meta = u_treeMeta[treeIndex];
    vec3 local = rotateFlora(point - tree.xyz, meta.y);
    float sphereBound = length(local - vec3(0.0, 0.68 * tree.w, 0.0)) - 1.08 * tree.w;
    if (sphereBound >= min(result, maximumDistance)) {
      continue;
    } else {
      local = swayFlora(local, float(treeIndex) * 1.71 + meta.y, 0.052);
      float trunk = sdCappedCylinder(local - vec3(0.0, 0.38 * tree.w, 0.0), 0.06 * tree.w, 0.38 * tree.w);
      float canopy = sdEllipsoid(local - vec3(0.0, 0.86 * tree.w, 0.0), vec3(0.46, 0.56, 0.46) * tree.w);
      result = min(result, min(trunk, canopy));
    }
  }
  return result;
}

float shadowSceneField(vec3 point) {
  vec2 ground = groundField(point);
  return min(ground.x, treeShadowField(point, ground.x));
}

vec2 marchScene(vec3 rayOrigin, vec3 rayDirection) {
  float distanceAlongRay = 0.02;
  float material = 0.0;
  float hit = 0.0;
  bool marching = true;
  for (int stepIndex = 0; stepIndex < 196; stepIndex += 1) {
    if (marching && stepIndex < u_steps) {
      vec2 field = sceneField(rayOrigin + rayDirection * distanceAlongRay);
      float epsilon = 0.0012 + distanceAlongRay * 0.00045;
      if (field.x < epsilon) {
        material = field.y;
        hit = 1.0;
        marching = false;
      } else {
        distanceAlongRay += clamp(field.x * 0.82, 0.006, 0.55);
        if (distanceAlongRay > FAR_DISTANCE) {
          marching = false;
        } else {
          marching = true;
        }
      }
    } else {
      marching = false;
    }
  }
  return vec2(mix(FAR_DISTANCE, distanceAlongRay, hit), material);
}

vec3 surfaceNormal(vec3 point) {
  float epsilon = 0.0025;
  vec2 e = vec2(1.0, -1.0) * 0.5773 * epsilon;
  return normalize(
    e.xyy * sceneField(point + e.xyy).x +
    e.yyx * sceneField(point + e.yyx).x +
    e.yxy * sceneField(point + e.yxy).x +
    e.xxx * sceneField(point + e.xxx).x
  );
}

float softShadow(vec3 origin, vec3 direction) {
  float visibility = 1.0;
  float distanceAlongRay = 0.035;
  for (int stepIndex = 0; stepIndex < 28; stepIndex += 1) {
    float field = shadowSceneField(origin + direction * distanceAlongRay);
    visibility = min(visibility, 12.0 * field / distanceAlongRay);
    distanceAlongRay += clamp(field, 0.025, 0.42);
  }
  return saturate(visibility * 0.82 + 0.18);
}

float ambientOcclusion(vec3 point, vec3 normal) {
  float occlusion = 0.0;
  float weight = 1.0;
  for (int sampleIndex = 0; sampleIndex < 5; sampleIndex += 1) {
    float distanceFromSurface = 0.035 + 0.095 * float(sampleIndex);
    float field = sceneField(point + normal * distanceFromSurface).x;
    occlusion += (distanceFromSurface - field) * weight;
    weight *= 0.68;
  }
  return saturate(1.0 - occlusion * 1.7);
}

vec3 skyBase(vec3 direction) {
  float elevation = saturate(direction.y * 0.5 + 0.5);
  vec3 horizon;
  vec3 zenith;
  if (u_palette == 2) {
    horizon = vec3(0.76, 0.28, 0.16);
    zenith = vec3(0.08, 0.035, 0.08);
  } else {
    if (u_palette == 1) {
      horizon = vec3(0.62, 0.74, 0.86);
      zenith = vec3(0.10, 0.25, 0.46);
    } else {
      horizon = vec3(0.68, 0.78, 0.84);
      zenith = vec3(0.08, 0.30, 0.56);
    }
  }
  vec3 calm = mix(horizon, zenith, pow(elevation, 0.68));
  vec3 stormHorizon = vec3(0.20, 0.24, 0.28);
  vec3 stormZenith = vec3(0.055, 0.075, 0.11);
  return mix(calm, mix(stormHorizon, stormZenith, pow(elevation, 0.56)), u_stormIntensity * 0.84);
}

float weatherWind() {
  return saturate(u_windStrength + u_stormIntensity * 0.42);
}

float cloudDensity(vec2 point, float frequency, float seedOffset) {
  float firstWarp = fbm(point * frequency * 0.52, u_seed * 0.021 + seedOffset);
  float secondWarp = fbm(point * frequency * 0.52 + vec2(5.3, -3.7), u_seed * 0.021 + seedOffset + 7.0);
  vec2 warped = point * frequency + (vec2(firstWarp, secondWarp) - 0.5) * 1.75;
  return fbm(warped, u_seed * 0.021 + seedOffset + 13.0);
}

float lightningFlash() {
  float eventTime = u_time * 0.42;
  float eventIndex = floor(eventTime);
  float eventTrigger = step(0.84, hash21(vec2(eventIndex, eventIndex * 0.37 + 17.0), u_seed + 401.0));
  float phase = fract(eventTime);
  float firstPulse = exp(-phase * 34.0);
  float secondPulse = exp(-abs(phase - 0.13) * 46.0) * 0.48;
  return (firstPulse + secondPulse) * eventTrigger * u_stormIntensity * u_stormIntensity * step(0.001, u_time);
}

float cloudShadow(vec3 point) {
  float frequency = mix(0.055, 0.14, u_cloudScale);
  vec2 drift = vec2(u_time * weatherWind() * 0.055, u_time * weatherWind() * 0.021);
  float density = fbm(point.xz * frequency + drift, u_seed * 0.021 + 151.0);
  float cover = max(u_cloudCover, u_stormIntensity * 0.9);
  float mask = smoothstep(mix(0.78, 0.31, cover), mix(0.78, 0.31, cover) + 0.16, density);
  float depthStrength = mix(0.42, 1.0, u_cloudDepth);
  return 1.0 - mask * mix(0.24, 0.72, u_stormIntensity) * depthStrength;
}

vec3 skyColor(vec3 direction, vec3 rayOrigin) {
  float wind = weatherWind();
  float frequency = mix(0.050, 0.132, u_cloudScale);
  float clock = u_time * mix(0.012, 0.10, wind);
  vec2 drift = vec2(clock, clock * 0.42);
  float lowerPlane = max(0.0, (6.4 - rayOrigin.y) / max(direction.y, 0.075));
  float upperPlane = max(0.0, (10.5 - rayOrigin.y) / max(direction.y, 0.075));
  vec2 lowerPoint = rayOrigin.xz + direction.xz * lowerPlane + drift;
  vec2 upperPoint = rayOrigin.xz + direction.xz * upperPlane + drift * vec2(-0.52, 0.33);
  float lowerNoise = cloudDensity(lowerPoint, frequency, 91.0);
  float upperNoise = fbm(upperPoint * frequency * 1.85, u_seed * 0.021 + 137.0);
  float edgeDetail = valueNoise(lowerPoint * frequency * 4.2, u_seed * 0.021 + 173.0);
  lowerNoise += (edgeDetail - 0.5) * mix(0.14, 0.055, u_cloudDepth);
  float effectiveCover = max(u_cloudCover, u_stormIntensity * 0.92);
  float lowerThreshold = mix(0.80, 0.28, effectiveCover);
  float upperThreshold = mix(0.84, 0.44, effectiveCover * 0.76);
  float horizonFade = smoothstep(-0.02, 0.15, direction.y);
  float lowerShape = smoothstep(lowerThreshold, lowerThreshold + 0.17, lowerNoise) * horizonFade;
  float opticalDepth = lowerShape * mix(0.58, 2.65, u_cloudDepth);
  float lowerCloud = 1.0 - exp(-opticalDepth);
  float upperBreakup = valueNoise(upperPoint * frequency * 5.4, u_seed * 0.021 + 181.0);
  float upperCloud = smoothstep(upperThreshold, upperThreshold + 0.14, upperNoise + (upperBreakup - 0.5) * 0.09) * horizonFade;
  float lowerInterior = saturate((lowerNoise - lowerThreshold) / 0.34);
  float sunAmount = max(dot(direction, u_sunDirection), 0.0);
  float sunVisibility = (1.0 - u_stormIntensity * 0.88) * (1.0 - lowerCloud * 0.72);
  vec3 color = skyBase(direction);
  color += vec3(1.0, 0.62, 0.25) * pow(sunAmount, 96.0) * 2.2 * sunVisibility;
  color += vec3(1.0, 0.34, 0.12) * pow(sunAmount, 12.0) * 0.34 * sunVisibility;
  vec3 calmCloud = mix(vec3(0.48, 0.53, 0.58), vec3(1.0, 0.86, 0.68), pow(sunAmount, 4.0));
  vec3 stormCloud = mix(vec3(0.12, 0.15, 0.19), vec3(0.34, 0.38, 0.43), saturate(direction.y * 1.7));
  vec3 lowerColor = mix(calmCloud, stormCloud, u_stormIntensity * (0.72 + lowerCloud * 0.28));
  float underside = lowerInterior * u_cloudDepth * (1.0 - saturate(direction.y * 1.5));
  lowerColor *= mix(1.06, 0.58, underside);
  float silverLining = lowerCloud * (1.0 - lowerInterior) * pow(sunAmount, 0.34) * u_cloudDepth;
  vec3 upperColor = mix(vec3(0.73, 0.78, 0.82), vec3(0.30, 0.34, 0.40), u_stormIntensity);
  color = mix(color, upperColor, upperCloud * mix(0.30, 0.58, u_cloudCover));
  color = mix(color, lowerColor, lowerCloud * mix(0.68, 0.94, u_stormIntensity));
  color += mix(vec3(0.72, 0.82, 0.92), vec3(1.0, 0.78, 0.46), sunAmount) * silverLining * (1.0 - u_stormIntensity * 0.62) * 0.46;
  color += vec3(0.60, 0.72, 0.96) * lightningFlash() * (0.65 + lowerCloud * 0.7);
  return color;
}

vec3 terrainAlbedo(vec3 point, vec3 normal, float material) {
  if (material > 5.5) {
    float blossomVariation = valueNoise(point.xz * 13.0 + point.y, u_seed + 239.0);
    vec3 blossom = u_palette == 2 ? vec3(0.86, 0.34, 0.08) : vec3(0.92, 0.48, 0.66);
    return mix(blossom, vec3(0.93, 0.78, 0.24), blossomVariation * 0.52);
  } else {
    if (material > 4.5) {
      float plantVariation = valueNoise(point.xz * 10.0 + point.y, u_seed + 233.0);
      vec3 plant = u_palette == 1 ? vec3(0.08, 0.24, 0.13) : vec3(0.10, 0.36, 0.095);
      return plant * (0.70 + plantVariation * 0.45);
    } else {
      if (material > 3.5) {
        float leafVariation = valueNoise(point.xz * 7.0 + point.y, u_seed + 211.0);
        vec3 leaves;
        if (u_palette == 2) {
          leaves = vec3(0.22, 0.11, 0.035);
        } else {
          if (u_palette == 1) {
            leaves = vec3(0.045, 0.16, 0.10);
          } else {
            leaves = vec3(0.055, 0.27, 0.075);
          }
        }
        return leaves * (0.72 + leafVariation * 0.48);
      } else {
        if (material > 2.5) {
          float barkVariation = valueNoise(point.xz * 11.0 + point.y, u_seed + 223.0);
          return vec3(0.22, 0.115, 0.052) * (0.72 + barkVariation * 0.38);
        } else {
          material = min(material, 2.0);
        }
      }
    }
  }
  float slope = saturate(1.0 - normal.y);
  float grain = fbm(point.xz * 2.8, u_seed * 0.013 + 67.0);
  vec3 sand;
  vec3 grass;
  vec3 rock;
  vec3 snow;
  if (u_palette == 2) {
    sand = vec3(0.28, 0.12, 0.045);
    grass = vec3(0.13, 0.075, 0.045);
    rock = vec3(0.20, 0.16, 0.15);
    snow = vec3(0.65, 0.22, 0.055);
  } else {
    if (u_palette == 1) {
      sand = vec3(0.56, 0.54, 0.46);
      grass = vec3(0.22, 0.32, 0.20);
      rock = vec3(0.31, 0.34, 0.36);
      snow = vec3(0.90, 0.94, 0.96);
    } else {
      sand = vec3(0.78, 0.61, 0.32);
      grass = vec3(0.15, 0.33, 0.12);
      rock = vec3(0.29, 0.26, 0.22);
      snow = vec3(0.82, 0.87, 0.84);
    }
  }
  float beachTop = u_seaLevel + mix(0.16, 0.58, u_beachWidth);
  float beach = (1.0 - smoothstep(u_seaLevel + 0.03, beachTop, point.y)) * (1.0 - smoothstep(0.24, 0.82, slope));
  float rockMask = smoothstep(0.28, 0.72, slope + (grain - 0.5) * 0.25);
  float snowLine = u_palette == 1 ? u_mountainHeight * 0.58 : u_mountainHeight * 0.82;
  float snowMask = smoothstep(snowLine, snowLine + 0.65, point.y) * (1.0 - smoothstep(0.30, 0.76, slope));
  float wetSand = 1.0 - smoothstep(u_seaLevel + 0.03, u_seaLevel + 0.13, point.y);
  vec3 albedo = mix(grass, rock, rockMask);
  albedo = mix(albedo, sand, beach);
  albedo = mix(albedo, sand * 0.58, beach * wetSand * 0.72);
  albedo = mix(albedo, snow, snowMask);
  float plantHabitat = smoothstep(u_seaLevel + 0.16, u_seaLevel + 0.34, point.y);
  plantHabitat *= 1.0 - smoothstep(u_seaLevel + 0.94, u_seaLevel + 1.38, point.y);
  plantHabitat *= 1.0 - smoothstep(0.18, 0.58, slope);
  float plantNoise = valueNoise(point.xz * 5.8, u_seed + 257.0);
  float groundPlants = smoothstep(mix(0.91, 0.54, u_plantCover), 0.95, plantNoise) * u_plantCover * plantHabitat;
  float flowerSpecks = step(0.82, hash21(floor(point.xz * 17.0), u_seed + 269.0)) * groundPlants;
  albedo = mix(albedo, grass * vec3(0.72, 1.18, 0.68), groundPlants * 0.58);
  albedo = mix(albedo, vec3(0.92, 0.58, 0.22), flowerSpecks * 0.72);
  float riverBank = riverBankMask(point.xz);
  float riverCore = riverWaterMask(point.xz);
  albedo = mix(albedo, albedo * vec3(0.58, 0.69, 0.64), riverBank * (1.0 - riverCore) * 0.78);
  albedo *= 0.82 + grain * 0.34;
  return mix(albedo, rock * 0.82, step(1.5, material));
}

${LOCAL_EFFECTS_SHADER}

vec3 shadeRiver(vec3 point, vec3 rayDirection, vec3 rayOrigin, vec3 terrainNormal, float distanceAlongRay) {
  vec4 river = riverPathData(point.xz);
  vec4 section = riverSection(river.x);
  vec2 flowDirection = normalize(vec2(section.z, 1.0));
  float flowSpeed = mix(0.55, 3.2, saturate(u_riverFlow * 0.76 + weatherWind() * 0.34));
  float phase = river.x * 46.0 - u_time * flowSpeed;
  float flowCrest = pow(saturate(0.5 + 0.5 * sin(phase + river.y * 21.0)), 5.0);
  float fineCrest = pow(saturate(0.5 + 0.5 * sin(phase * 1.83 + 1.7)), 7.0);
  vec3 normal = normalize(mix(terrainNormal, vec3(0.0, 1.0, 0.0), 0.68));
  normal.xz -= flowDirection * cos(phase) * u_riverFlow * 0.065;
  normal = normalize(normal);
  vec3 reflectedDirection = reflect(rayDirection, normal);
  vec3 reflection = skyColor(reflectedDirection, rayOrigin);
  float fresnel = 0.04 + 0.96 * pow(1.0 - saturate(dot(-rayDirection, normal)), 5.0);
  vec3 riverBase;
  if (u_palette == 2) {
    riverBase = vec3(0.12, 0.055, 0.035);
  } else {
    if (u_palette == 1) {
      riverBase = vec3(0.035, 0.16, 0.22);
    } else {
      riverBase = vec3(0.025, 0.24, 0.25);
    }
  }
  float sunGlint = pow(max(dot(reflect(rayDirection, normal), u_sunDirection), 0.0), 58.0);
  vec3 color = mix(riverBase, reflection, fresnel * 0.62 + 0.10);
  color += vec3(1.0, 0.76, 0.43) * sunGlint * cloudShadow(point) * 0.72;
  float normalizedAcross = river.y / max(river.z, 0.001);
  float edgeFoam = smoothstep(0.48, 0.72, normalizedAcross) * (1.0 - smoothstep(0.76, 0.94, normalizedAcross));
  float grade = -section.w / length(vec2(section.z, 1.0));
  float rapids = smoothstep(0.35, 1.8, grade) * saturate(flowCrest + fineCrest * 0.46);
  float foam = saturate(edgeFoam * 0.16 + rapids * 0.72) * u_riverFlow;
  color = mix(color, vec3(0.82, 0.91, 0.88), foam);
  color += vec3(0.44, 0.58, 0.88) * lightningFlash() * (0.36 + fresnel);
  float fog = distanceFog(distanceAlongRay, 0.045, 0.016);
  return mix(color, skyBase(rayDirection), saturate(fog));
}

vec3 shadeTerrain(vec3 point, vec3 rayDirection, vec3 rayOrigin, float material, float distanceAlongRay) {
  vec3 normal = surfaceNormal(point);
  vec3 albedo = terrainAlbedo(point, normal, material);
  float diffuse = max(dot(normal, u_sunDirection), 0.0);
  float shadow = softShadow(point + normal * 0.025, u_sunDirection);
  float cloudLight = cloudShadow(point);
  float ao = ambientOcclusion(point, normal);
  vec3 halfVector = normalize(u_sunDirection - rayDirection);
  float specular = pow(max(dot(normal, halfVector), 0.0), 42.0) * 0.18;
  vec3 ambient = skyBase(normal) * (0.20 + normal.y * 0.18) * ao;
  float stormSun = 1.0 - u_stormIntensity * 0.68;
  float foliageBacklight = max(dot(-normal, u_sunDirection) * 0.6 + 0.4, 0.0) * step(2.5, material);
  vec3 color = albedo * (ambient + vec3(1.0, 0.78, 0.56) * diffuse * shadow * cloudLight * stormSun * 1.12);
  color += albedo * vec3(0.18, 0.31, 0.12) * foliageBacklight * cloudLight;
  color += vec3(1.0, 0.72, 0.44) * specular * shadow * cloudLight * stormSun;
  color += albedo * vec3(0.48, 0.60, 0.88) * lightningFlash() * 1.35;
  float fog = distanceFog(distanceAlongRay, 0.055, 0.018);
  vec3 landColor = mix(color, skyBase(rayDirection), saturate(fog));
  float river = riverWaterMask(point.xz) * (1.0 - step(1.5, material));
  if (river > 0.001) {
    return mix(landColor, shadeRiver(point, rayDirection, rayOrigin, normal, distanceAlongRay), river);
  } else {
    return landColor;
  }
}

vec3 shadeWater(vec3 point, vec3 rayDirection, vec3 rayOrigin, float distanceAlongRay) {
  float floorHeight = terrainHeight(point.xz);
  float waterDepth = max(0.0, u_seaLevel - floorHeight);
  vec2 breakers = shoreBreakerPattern(point, waterDepth);
  vec3 normal = waterNormal(point, breakers.y);
  vec3 reflectedDirection = reflect(rayDirection, normal);
  vec3 reflection = skyColor(reflectedDirection, rayOrigin);
  float fresnel = 0.04 + 0.96 * pow(1.0 - saturate(dot(-rayDirection, normal)), 5.0);
  vec3 shallow = mix(vec3(0.04, 0.34, 0.35), vec3(0.015, 0.08, 0.15), saturate(waterDepth * 1.8));
  shallow = mix(shallow, vec3(0.018, 0.035, 0.055), u_stormIntensity * 0.78);
  float roughness = saturate(u_waveRoughness + u_stormIntensity * 0.58);
  float sunGlint = pow(max(dot(reflect(rayDirection, normal), u_sunDirection), 0.0), mix(110.0, 24.0, roughness));
  vec3 color = mix(shallow, reflection, fresnel * 0.78 + 0.12);
  color += vec3(1.0, 0.74, 0.38) * sunGlint * cloudShadow(point) * (1.0 - u_stormIntensity * 0.78) * 1.8;
  color += vec3(0.42, 0.56, 0.86) * lightningFlash() * (0.45 + fresnel);
  float riverMouth = riverWaterMask(point.xz) * (1.0 - smoothstep(0.04, 0.34, waterDepth));
  float mouthPulse = pow(saturate(0.5 + 0.5 * sin(riverPathData(point.xz).x * 42.0 - u_time * 2.4)), 5.0);
  float foam = saturate(breakers.x + riverMouth * (0.24 + mouthPulse * 0.42));
  color = mix(color, vec3(0.84, 0.93, 0.91), foam * 0.92);
  float fog = distanceFog(distanceAlongRay, 0.035, 0.015);
  return mix(color, skyBase(rayDirection), saturate(fog));
}

mat3 cameraBasis(vec3 origin, vec3 target) {
  vec3 forward = normalize(target - origin);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  return mat3(right, up, forward);
}

vec3 toneMap(vec3 color) {
  vec3 numerator = color * (2.51 * color + 0.03);
  vec3 denominator = color * (2.43 * color + 0.59) + 0.14;
  return clamp(numerator / denominator, 0.0, 1.0);
}

float rainLayer(vec2 pixel, float scale, float speed, float offset) {
  float slant = mix(0.08, 0.58, weatherWind());
  vec2 rainPoint = pixel * vec2(scale, scale * 0.42);
  rainPoint.x += rainPoint.y * slant;
  vec2 cell = floor(rainPoint);
  vec2 local = fract(rainPoint);
  float random = hash21(cell + offset, u_seed + 503.0 + offset);
  local.y = fract(local.y + u_time * speed + random);
  float center = 0.16 + random * 0.68;
  float narrowLine = 1.0 - smoothstep(0.012, 0.052, abs(local.x - center));
  float streakLength = smoothstep(0.12, 0.35, local.y) * (1.0 - smoothstep(0.62, 0.94, local.y));
  return narrowLine * streakLength * step(0.24, random);
}

float rainAmount(vec2 pixel) {
  float nearRain = rainLayer(pixel, 28.0, 1.95 + weatherWind() * 2.1, 11.0);
  float farRain = rainLayer(pixel + vec2(0.13, -0.07), 47.0, 2.75 + weatherWind() * 2.8, 29.0);
  return saturate(nearRain * 0.72 + farRain * 0.46) * smoothstep(0.18, 0.88, u_stormIntensity);
}

void main() {
  vec2 pixel = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 target = vec3(0.0, 1.05, 0.0);
  vec3 orbit = vec3(cos(u_pitch) * sin(u_yaw), sin(u_pitch), cos(u_pitch) * cos(u_yaw));
  vec3 rayOrigin = target + orbit * u_distance;
  vec3 rayDirection = normalize(cameraBasis(rayOrigin, target) * vec3(pixel, 1.72));
  vec2 hit = marchScene(rayOrigin, rayDirection);
  float waterDistance = (u_seaLevel - rayOrigin.y) / rayDirection.y;
  bool waterVisible = rayDirection.y < -0.0001 && waterDistance > 0.0 && waterDistance < FAR_DISTANCE;
  bool terrainVisible = hit.y > 0.0 && hit.x < FAR_DISTANCE;
  vec3 color;
  float surfaceDistance = FAR_DISTANCE;
  if (terrainVisible && (!waterVisible || hit.x < waterDistance)) {
    vec3 point = rayOrigin + rayDirection * hit.x;
    color = shadeTerrain(point, rayDirection, rayOrigin, hit.y, hit.x);
    surfaceDistance = hit.x;
  } else {
    if (waterVisible) {
      vec3 point = rayOrigin + rayDirection * waterDistance;
      color = shadeWater(point, rayDirection, rayOrigin, waterDistance);
      surfaceDistance = waterDistance;
    } else {
      color = skyColor(rayDirection, rayOrigin);
      surfaceDistance = FAR_DISTANCE;
    }
  }
  vec4 summitCloud = summitCloudLayer(rayOrigin, rayDirection, surfaceDistance);
  color = mix(color, summitCloud.rgb, summitCloud.a);
  float rain = rainAmount(pixel);
  color *= 1.0 - rain * 0.24;
  color += vec3(0.56, 0.68, 0.78) * rain * 0.58;
  color *= 1.0 + lightningFlash() * 0.18;
  float vignette = 1.0 - 0.18 * dot(v_uv - 0.5, v_uv - 0.5);
  float dither = (hash21(gl_FragCoord.xy, u_seed) - 0.5) / 255.0;
  color = pow(max(toneMap(color) * vignette + dither, 0.0), vec3(1.0 / 2.2));
  outColor = vec4(color, 1.0);
}
`;
