export const LOCAL_EFFECTS_SHADER = `
float distanceFog(float distanceAlongRay, float hazeScale, float stormScale) {
  float density = u_haze * hazeScale + u_stormIntensity * stormScale;
  return 1.0 - exp(-distanceAlongRay * density);
}

vec2 rayEllipsoidInterval(vec3 rayOrigin, vec3 rayDirection, vec3 center, vec3 radius) {
  vec3 localOrigin = (rayOrigin - center) / radius;
  vec3 localDirection = rayDirection / radius;
  float directionLength = dot(localDirection, localDirection);
  float originProjection = dot(localOrigin, localDirection);
  float discriminant = originProjection * originProjection - directionLength * (dot(localOrigin, localOrigin) - 1.0);
  if (discriminant > 0.0) {
    float root = sqrt(discriminant);
    return vec2((-originProjection - root) / directionLength, (-originProjection + root) / directionLength);
  } else {
    return vec2(FAR_DISTANCE, FAR_DISTANCE);
  }
}

vec4 summitCloudLayer(vec3 rayOrigin, vec3 rayDirection, float surfaceDistance) {
  if (u_summitClouds <= 0.001) {
    return vec4(0.0);
  } else {
    float cloudHeight = u_seaLevel + u_mountainHeight * 0.72 + 0.12;
    vec3 boundRadius = vec3(u_islandRadius * 0.52, 0.72, u_islandRadius * 0.52);
    vec2 bound = rayEllipsoidInterval(rayOrigin, rayDirection, vec3(0.0, cloudHeight, 0.0), boundRadius);
    float opticalDepth = 0.0;
    float lightSum = 0.0;
    if (bound.x < surfaceDistance && bound.y > 0.0) {
      float spin = u_time * weatherWind() * 0.018;
      for (int puffIndex = 0; puffIndex < 9; puffIndex += 1) {
        float puff = float(puffIndex);
        float group = floor(puff / 3.0);
        float lobe = mod(puff, 3.0);
        float groupJitter = hash21(vec2(group + 19.0, 37.0), u_seed + 331.0);
        float groupAngle = group * 2.0944 + groupJitter * 0.78 + spin * mix(-1.0, 1.0, step(1.0, group));
        float ringRadius = u_islandRadius * mix(0.18, 0.31, hash21(vec2(group + 41.0, 53.0), u_seed + 337.0));
        vec2 groupCenter = vec2(cos(groupAngle), sin(groupAngle)) * ringRadius;
        float lobeAngle = groupAngle + lobe * 2.0944 + hash21(vec2(puff + 67.0, 71.0), u_seed + 347.0) * 0.48;
        float sideLobe = step(0.5, lobe);
        float lobeRadius = sideLobe * mix(0.14, 0.25, hash21(vec2(puff + 73.0, 79.0), u_seed + 349.0));
        vec2 centerXZ = groupCenter + vec2(cos(lobeAngle), sin(lobeAngle)) * lobeRadius;
        float heightJitter = hash21(vec2(puff + 83.0, 89.0), u_seed + 353.0) - 0.5;
        vec3 center = vec3(centerXZ.x, cloudHeight + heightJitter * 0.16, centerXZ.y);
        float sizeJitter = hash21(vec2(puff + 97.0, 101.0), u_seed + 359.0);
        float lobeScale = mix(1.0, 0.74, sideLobe);
        vec3 radius = vec3(mix(0.20, 0.31, sizeJitter), mix(0.13, 0.22, 1.0 - sizeJitter * 0.55), mix(0.20, 0.30, fract(sizeJitter * 1.71 + 0.23))) * lobeScale;
        float activationStart = lobe * 0.22 + group * 0.025;
        float activation = smoothstep(activationStart, activationStart + 0.18, u_summitClouds);
        vec2 interval = rayEllipsoidInterval(rayOrigin, rayDirection, center, radius);
        float entry = max(interval.x, 0.0);
        float exitDistance = min(interval.y, surfaceDistance);
        float chord = max(0.0, exitDistance - entry) * activation;
        vec3 surfacePoint = rayOrigin + rayDirection * entry;
        vec3 puffNormal = normalize((surfacePoint - center) / (radius * radius));
        float light = 0.46 + max(dot(puffNormal, u_sunDirection), 0.0) * 0.54;
        opticalDepth += chord;
        lightSum += light * chord;
      }
    } else {
      opticalDepth = 0.0;
      lightSum = 0.0;
    }
    float opacity = 1.0 - exp(-opticalDepth * mix(1.35, 3.10, u_summitClouds));
    float illumination = lightSum / max(opticalDepth, 0.001);
    vec3 cloudShade = mix(vec3(0.47, 0.57, 0.66), vec3(0.96, 0.94, 0.87), illumination);
    cloudShade = mix(cloudShade, vec3(0.24, 0.29, 0.35), u_stormIntensity * 0.72);
    return vec4(cloudShade, opacity);
  }
}

vec2 breakerFront(vec2 point, float waterDepth, float offset, float rate, float seedOffset) {
  float ageJitter = hash21(vec2(seedOffset, 23.0), u_seed + 307.0) * 0.08;
  // A continuous circular coordinate keeps the timing seamless around the beach.
  vec2 coast = normalize(point / vec2(1.0, 1.08) + vec2(0.00001));
  float bearing = ageJitter * 63.0 + offset * 11.0;
  vec2 swell = vec2(cos(bearing), sin(bearing));
  float along = dot(coast, swell);
  float clock = u_time * mix(0.055, 0.22, weatherWind());
  float age = fract(offset + ageJitter + clock * rate + along * 0.65);
  float setPhase = along * 4.3 + dot(coast, vec2(-swell.y, swell.x)) * 1.8 + clock * 1.4 + bearing;
  float sector = smoothstep(-0.12, 0.72, cos(setPhase));
  float life = sector * smoothstep(0.02, 0.14, age) * (1.0 - smoothstep(0.82, 0.98, age));
  float targetDepth = mix(0.44, 0.025, age);
  float angle = hash21(vec2(seedOffset, 31.0), u_seed + 311.0) * PI * 2.0;
  vec2 rotated = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * point;
  float broad = valueNoise(rotated * 0.74 + vec2(age * 0.35, -age * 0.11), u_seed + seedOffset);
  float detail = valueNoise(rotated * 2.30 + vec2(-age * 0.17, age * 0.29), u_seed + seedOffset + 5.0);
  float warpedDepth = waterDepth + (broad - 0.5) * 0.065;
  float width = mix(0.035, 0.012, age);
  float signedFront = warpedDepth - targetDepth;
  float crest = 1.0 - smoothstep(width, width * 2.1, abs(signedFront));
  float brokenArc = smoothstep(0.46, 0.64, broad * 0.54 + detail * 0.46);
  float trail = smoothstep(0.01, 0.05, signedFront) * (1.0 - smoothstep(0.09, 0.23, signedFront));
  float wash = smoothstep(0.62, 0.8, age) * (1.0 - smoothstep(0.015, 0.13, waterDepth));
  float foam = (crest * brokenArc + (0.34 * trail + 0.48 * wash) * smoothstep(0.38, 0.72, detail)) * life;
  float curlSign = 1.0 - 2.0 * smoothstep(-width, width, signedFront);
  return vec2(foam, crest * brokenArc * curlSign * life);
}

vec2 shoreBreakerPattern(vec3 point, float waterDepth) {
  if (u_shoreBreakers <= 0.001) {
    return vec2(0.0);
  } else {
    vec2 first = breakerFront(point.xz, waterDepth, 0.10, 0.83, 317.0);
    vec2 second = breakerFront(point.xz, waterDepth, 0.38, 1.07, 331.0);
    vec2 third = breakerFront(point.xz, waterDepth, 0.67, 1.31, 347.0);
    float breakerZone = smoothstep(0.012, 0.045, waterDepth) * (1.0 - smoothstep(0.46, 0.58, waterDepth));
    float foam = saturate(first.x + second.x + third.x) * u_shoreBreakers;
    float curl = (first.y + second.y + third.y) * breakerZone * u_shoreBreakers;
    return vec2(foam, curl);
  }
}

vec2 irregularWaveGradient(vec2 point) {
  float dominantAngle = hash21(vec2(5.0, 17.0), u_seed + 383.0) * PI * 2.0;
  float clock = u_time * mix(0.42, 1.48, weatherWind());
  vec2 warp = vec2(sin(dot(point, vec2(0.43, 0.27)) + dominantAngle), cos(dot(point, vec2(-0.31, 0.38)) - dominantAngle));
  vec2 warpedPoint = point + warp * 0.38;
  vec2 gradient = vec2(0.0);
  for (int waveIndex = 0; waveIndex < 5; waveIndex += 1) {
    float wave = float(waveIndex);
    float ratio = wave / 4.0;
    float directionNoise = hash21(vec2(wave + 11.0, 29.0), u_seed + 389.0);
    float frequencyNoise = hash21(vec2(wave + 37.0, 43.0), u_seed + 397.0);
    float phaseNoise = hash21(vec2(wave + 47.0, 59.0), u_seed + 401.0);
    float angle = dominantAngle + (directionNoise - 0.5) * PI + wave * 1.13;
    vec2 direction = vec2(cos(angle), sin(angle));
    vec2 across = vec2(-direction.y, direction.x);
    float frequency = mix(0.83, 6.70, pow(ratio, 0.78)) * mix(0.86, 1.14, frequencyNoise);
    float phase = dot(warpedPoint, direction) * frequency + clock * sqrt(frequency) * mix(0.64, 1.08, frequencyNoise) + phaseNoise * PI * 2.0;
    float packet = 0.62 + 0.23 * sin(dot(warpedPoint, across) * mix(0.22, 0.68, ratio) + phaseNoise * 7.0);
    packet += 0.15 * sin(dot(warpedPoint, across + direction * 0.37) * mix(0.31, 0.91, ratio) - phaseNoise * 4.0);
    float crest = cos(phase) + cos(phase * 2.0 + phaseNoise * 3.0) * 0.19;
    gradient += direction * crest * mix(0.095, 0.042, ratio) * packet;
  }
  for (int packetIndex = 0; packetIndex < 2; packetIndex += 1) {
    float packet = float(packetIndex);
    float centerAngle = hash21(vec2(packet + 71.0, 83.0), u_seed + 409.0) * PI * 2.0;
    float centerRadius = mix(4.8, 7.2, hash21(vec2(packet + 89.0, 97.0), u_seed + 419.0));
    vec2 packetCenter = vec2(cos(centerAngle), sin(centerAngle)) * centerRadius;
    vec2 fromCenter = warpedPoint - packetCenter;
    float radialDistance = length(fromCenter);
    vec2 radialDirection = fromCenter / max(radialDistance, 0.001);
    float radialFrequency = mix(1.25, 2.05, packet);
    float radialPhase = radialDistance * radialFrequency - clock * mix(0.76, 1.18, packet);
    float radialEnvelope = 0.62 + 0.38 * sin(dot(warpedPoint, vec2(0.19 + packet * 0.07, -0.23 + packet * 0.05)) + centerAngle);
    gradient += radialDirection * cos(radialPhase) * mix(0.052, 0.036, packet) * radialEnvelope;
  }
  return gradient;
}

vec3 waterNormal(vec3 point, float breakerCurl) {
  float roughness = saturate(u_waveRoughness + u_stormIntensity * 0.58);
  vec2 gradient = irregularWaveGradient(point.xz) * roughness;
  vec2 islandRadii = vec2(u_islandRadius, u_islandRadius * 1.08);
  vec2 shoreDirection = normalize(point.xz / (islandRadii * islandRadii) + vec2(0.0001, -0.0001));
  gradient += shoreDirection * breakerCurl * 0.46;
  return normalize(vec3(-gradient.x, 1.0, -gradient.y));
}
`;
