const DEFAULT_LEVEL = {
  startX: 120,
  finishX: 3420,
  timer: 115,
  bounds: { left: 0, right: 3500, top: -80, groundY: 398 },
  cruiseSpeed: 220,
  minSpeed: 140,
  maxSpeed: 320,
  acceleration: 210,
  braking: 190,
  gravity: 1180,
  jumpVelocity: -560,
  shotSpeed: 560,
  upwardShotForwardSpeed: 120,
  forwardCooldown: 0.22,
  upwardCooldown: 0.28,
  playerInvulnerabilityDuration: 0.75,
  lateralBounds: { left: -180, right: 180 },
  lateralSpeed: 260
};

const FIRST_LEVEL_REQUIRED_ENTITIES = [
  "landing-site",
  "safe-space",
  "crater",
  "rock",
  "ridge",
  "shadow-zone",
  "ramp",
  "enemy-spawn-zone",
  "objective",
  "movement-blocker"
];

export const FIRST_LEVEL_DATA = {
  level: {
    ...DEFAULT_LEVEL,
    id: "night-earth-landing-site",
    terrainTheme: "night-earth",
    landingSite: { id: "moon-landing-site", x: 72, y: 350, w: 276, h: 48, laneLeft: -112, laneRight: 112 },
    spawnPoints: [{ id: "rover-start", x: 120, y: 350, w: 74, h: 48, lane: 0 }],
    safeZones: [
      { id: "safe-landing-pad", x: 0, w: 430, laneLeft: -120, laneRight: 120 },
      { id: "safe-mid-run", x: 1680, w: 160, laneLeft: -160, laneRight: 160 },
      { id: "safe-final-approach", x: 3060, w: 270, laneLeft: -160, laneRight: 160 }
    ],
    shadowZones: [
      { id: "shadow-canyon", x: 1030, w: 250, laneLeft: -180, laneRight: 180 },
      { id: "shadow-ridge", x: 2360, w: 330, laneLeft: -180, laneRight: 180 }
    ],
    enemySpawnZones: [
      { id: "sky-approach-alpha", x: 620, y: 60, w: 940, h: 190, laneLeft: -180, laneRight: 180 },
      { id: "sky-approach-beta", x: 1770, y: 70, w: 900, h: 180, laneLeft: -180, laneRight: 180 },
      { id: "ground-stalkers", x: 1280, y: 318, w: 980, h: 80, laneLeft: -180, laneRight: 180 },
      { id: "shadow-ambush", x: 2380, y: 95, w: 620, h: 185, laneLeft: -140, laneRight: 140 }
    ],
    objectives: [
      { id: "survey-beacon", type: "beacon", x: 1510, y: 320, w: 36, h: 78, lane: 110 },
      { id: "finish-marker", type: "finish", x: 3420, y: 318, w: 42, h: 80, lane: 0 }
    ],
    requiredEntities: FIRST_LEVEL_REQUIRED_ENTITIES
  },
  terrain: [
    { id: "crater-landing-edge", x: 560, y: 372, w: 96, h: 36, lane: -110, type: "crater", active: true, blocks: false, damage: 100, fatal: true, destructible: false },
    { id: "basalt-rock-1", x: 880, y: 350, w: 48, h: 48, lane: 80, type: "rock", active: true, blocks: true, damage: 34, fatal: false, destructible: true },
    { id: "shadow-ridge-1", x: 1180, y: 358, w: 118, h: 40, lane: -20, type: "ridge", active: true, blocks: true, damage: 28, fatal: false, destructible: false },
    { id: "low-ramp-1", x: 1410, y: 364, w: 160, h: 44, lane: 120, type: "ramp", active: true, blocks: false, damage: 0, fatal: false, destructible: false },
    { id: "crater-midfield", x: 1600, y: 358, w: 112, h: 50, lane: 0, type: "crater", active: true, blocks: false, damage: 100, fatal: true, destructible: false },
    { id: "turret-alpha", x: 1900, y: 344, w: 52, h: 54, lane: -95, type: "turret", active: true, blocks: true, damage: 38, fatal: false, destructible: true },
    { id: "rolling-rock-2", x: 2090, y: 346, w: 54, h: 52, lane: 98, type: "rock", active: true, blocks: true, damage: 40, fatal: false, destructible: true },
    { id: "knife-ridge-2", x: 2280, y: 356, w: 132, h: 42, lane: 12, type: "ridge", active: true, blocks: true, damage: 28, fatal: false, destructible: false },
    { id: "crater-shadow-mouth", x: 2660, y: 360, w: 118, h: 48, lane: -130, type: "crater", active: true, blocks: false, damage: 100, fatal: true, destructible: false },
    { id: "final-slope", x: 2860, y: 362, w: 180, h: 46, lane: 70, type: "ramp", active: true, blocks: false, damage: 0, fatal: false, destructible: false }
  ],
  enemies: [
    { id: "saucer-alpha", x: 760, y: 145, w: 48, h: 24, lane: -80, type: "saucer", spawnZone: "sky-approach-alpha", targetZone: "air", alive: true, health: 1, vx: 0, vy: 0 },
    { id: "bomb-alpha", x: 1230, y: 190, w: 28, h: 34, lane: 40, type: "bomb", spawnZone: "sky-approach-alpha", targetZone: "air", alive: true, health: 1, vx: 0, vy: 18 },
    { id: "werewolf-alpha", x: 1430, y: 356, w: 54, h: 42, lane: -120, type: "werewolf", spawnZone: "ground-stalkers", targetZone: "ground", alive: true, active: false, health: 2, maxHealth: 2, damage: 18, moveSpeed: 110, laneSpeed: 140, attackRange: 92, laneAttackRange: 72, attackCooldown: 1.0, spawnDistance: 620, spawnDelay: 1.0 },
    { id: "saucer-beta", x: 2030, y: 130, w: 48, h: 24, lane: 105, type: "saucer", spawnZone: "sky-approach-beta", targetZone: "air", alive: true, health: 1, vx: 0, vy: 0 },
    { id: "bomb-beta", x: 2450, y: 178, w: 28, h: 34, lane: -70, type: "bomb", spawnZone: "shadow-ambush", targetZone: "air", alive: true, health: 1, vx: 0, vy: 20 },
    { id: "vampire-alpha", x: 2530, y: 128, w: 42, h: 44, lane: 105, type: "vampire", spawnZone: "shadow-ambush", targetZone: "air", alive: true, active: false, health: 2, maxHealth: 2, damage: 16, moveSpeed: 90, laneSpeed: 100, attackRange: 145, laneAttackRange: 85, attackCooldown: 1.15, swoopAmplitude: 38, swoopRate: 2.7, spawnDistance: 1580, spawnDelay: 4.0 },
    { id: "saucer-gamma", x: 2830, y: 150, w: 44, h: 22, lane: 70, type: "saucer", spawnZone: "shadow-ambush", targetZone: "air", alive: true, health: 1, vx: 0, vy: 0 }
  ]
};

const DEFAULT_TERRAIN = FIRST_LEVEL_DATA.terrain;
const DEFAULT_ENEMIES = FIRST_LEVEL_DATA.enemies;

export function createGameState(options = {}) {
  const level = createLevel(options.level);
  const rover = createRover(level, options.rover);
  const terrain = (options.terrain ?? DEFAULT_TERRAIN).map((hazard) => createHazard(hazard, level));
  const enemies = (options.enemies ?? DEFAULT_ENEMIES).map(createEnemy);
  if (options.validateLevel ?? isDefaultFirstLevel(options)) {
    validateLevelData({ level, terrain, enemies });
  }
  const shots = [];
  return finishState({
    tick: 0,
    state: "play",
    status: "playing",
    message: "",
    lossCause: "",
    level,
    bounds: { ...level.bounds },
    rover,
    shots,
    projectiles: shots,
    terrain,
    enemies,
    elapsedTime: 0,
    distance: Math.max(0, rover.worldX - level.startX),
    score: 0,
    time: level.timer,
    timeRemaining: level.timer,
    camera: 0,
    finish: level.finishX,
    objective: { finishX: level.finishX, progress: 0, complete: false },
    collisions: [],
    stats: { enemiesDestroyed: 0, hazardsCleared: 0, shotsFired: 0 },
    nextProjectileId: 1
  });
}

export function validateLevelData({ level, terrain, enemies }) {
  const problems = [];
  validateRequiredEntities(problems, level, terrain);
  validateSpawnPoints(problems, level, terrain);
  validateObjectiveLocations(problems, level);
  validateEnemySpawnLocations(problems, level, enemies);
  validateMovementBlockers(problems, level, terrain);
  if (problems.length > 0) {
    throw new TypeError(`invalid first level data: ${problems.join("; ")}`);
  }
  return true;
}

export function inputFromKeys(keys) {
  const has = (code) => keySetHas(keys, code);
  const moveX = axisValue(has("KeyA"), has("KeyD"));
  const moveY = axisValue(has("KeyS") || has("ArrowLeft"), has("KeyW") || has("ArrowRight"));
  let aim = null;
  if (has("KeyK") || has("KeyX")) {
    aim = { x: 0, y: -1 };
  } else if (has("KeyJ") || has("KeyZ")) {
    aim = { x: 1, y: 0 };
  }
  return {
    left: has("ArrowLeft") || has("KeyA") || has("KeyS"),
    right: has("ArrowRight") || has("KeyD") || has("KeyW"),
    moveX,
    moveY,
    jump: has("Space") || has("ArrowUp"),
    fireForward: has("KeyJ") || has("KeyZ"),
    fireUp: has("KeyK") || has("KeyX"),
    pause: has("KeyP"),
    restart: has("KeyR"),
    aim
  };
}

export function updateGameState(state, input = {}, dt = 0) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new TypeError(`expected non-negative finite dt, got ${dt}`);
  }
  if (input.restart && state.state !== "play") {
    return createGameState();
  }
  if (input.pause) {
    return togglePause(state);
  }
  if (state.state !== "play") {
    return finishState({ ...cloneState(state), collisions: [] });
  }

  const next = cloneState(state);
  next.tick += 1;
  next.collisions = [];
  next.elapsedTime = finiteOrDefault(next.elapsedTime, 0) + dt;
  next.timeRemaining = Math.max(0, next.timeRemaining - dt);
  next.time = next.timeRemaining;
  updateAim(next.rover, input);
  updateCooldowns(next.rover, next.level, dt);
  updateRoverTimers(next.rover, dt);
  updateSpeed(next.rover, next.level, input, dt);
  updateJump(next.rover, next.level, input);
  updateVerticalPosition(next.rover, next.level, dt, next.collisions);
  updateHorizontalPosition(next, dt);
  updateLateralPosition(next, input, dt);
  fireProjectiles(next, input);
  resolveProjectileHits(next);
  updateProjectiles(next, dt);
  updateEnemies(next, dt);
  resolveProjectileHits(next);
  resolveRoverContacts(next);
  updateObjective(next);
  updateScore(next);
  updateTransitions(next);
  return finishState(next);
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function createLevel(level = FIRST_LEVEL_DATA.level) {
  const bounds = { ...DEFAULT_LEVEL.bounds, ...(level.bounds ?? {}) };
  const lateralBounds = { ...DEFAULT_LEVEL.lateralBounds, ...(level.lateralBounds ?? {}) };
  const finishX = finiteOrDefault(level.finishX, DEFAULT_LEVEL.finishX);
  return {
    ...DEFAULT_LEVEL,
    ...level,
    finishX,
    bounds: { ...bounds, right: finiteOrDefault(bounds.right, finishX) },
    lateralBounds: {
      left: finiteOrDefault(lateralBounds.left, DEFAULT_LEVEL.lateralBounds.left),
      right: finiteOrDefault(lateralBounds.right, DEFAULT_LEVEL.lateralBounds.right)
    },
    lateralSpeed: finiteOrDefault(level.lateralSpeed, DEFAULT_LEVEL.lateralSpeed),
    landingSite: cloneRect(level.landingSite ?? null),
    spawnPoints: cloneRectList(level.spawnPoints ?? []),
    safeZones: cloneRectList(level.safeZones ?? []),
    shadowZones: cloneRectList(level.shadowZones ?? []),
    enemySpawnZones: cloneRectList(level.enemySpawnZones ?? []),
    objectives: cloneRectList(level.objectives ?? []),
    requiredEntities: [...(level.requiredEntities ?? [])]
  };
}

function createRover(level, rover = {}) {
  const health = finiteOrDefault(rover.health ?? rover.integrity, 100);
  const worldX = finiteOrDefault(rover.worldX, level.startX);
  const y = finiteOrDefault(rover.y, level.bounds.groundY);
  const cooldowns = {
    forward: finiteOrDefault(rover.cooldowns?.forward ?? rover.cooldown, 0),
    up: finiteOrDefault(rover.cooldowns?.up ?? rover.upCooldown, 0)
  };
  return {
    x: finiteOrDefault(rover.x, 120),
    worldX,
    y,
    w: finiteOrDefault(rover.w, 74),
    h: finiteOrDefault(rover.h, 48),
    vy: finiteOrDefault(rover.vy, 0),
    lane: finiteOrDefault(rover.lane, 0),
    laneVelocity: finiteOrDefault(rover.laneVelocity, 0),
    speed: finiteOrDefault(rover.speed, 210),
    roll: finiteOrDefault(rover.roll, 0),
    health,
    integrity: health,
    maxHealth: finiteOrDefault(rover.maxHealth, 100),
    aim: normalizeVector(rover.aim ?? { x: 1, y: 0 }, { x: 1, y: 0 }),
    cooldowns,
    cooldown: cooldowns.forward,
    upCooldown: cooldowns.up,
    onGround: rover.onGround ?? y >= level.bounds.groundY,
    invulnerableTimer: finiteOrDefault(rover.invulnerableTimer, 0),
    invulnerable: finiteOrDefault(rover.invulnerableTimer, 0) > 0,
    damageFlash: finiteOrDefault(rover.damageFlash, 0)
  };
}

function createHazard(hazard, level) {
  const h = finiteOrDefault(hazard.h, 24);
  return {
    id: hazard.id ?? `${hazard.type ?? "hazard"}-${finiteOrDefault(hazard.x, 0)}`,
    type: hazard.type ?? "hazard",
    x: finiteOrDefault(hazard.x, 0),
    y: finiteOrDefault(hazard.y, level.bounds.groundY + 10 - h),
    w: finiteOrDefault(hazard.w, 32),
    h,
    lane: finiteOrNull(hazard.lane),
    active: hazard.active ?? true,
    blocks: hazard.blocks ?? false,
    damage: finiteOrDefault(hazard.damage, 0),
    fatal: hazard.fatal ?? false,
    destructible: hazard.destructible ?? false,
    cleared: hazard.cleared ?? false,
    contacted: hazard.contacted ?? false
  };
}

function createEnemy(enemy) {
  const health = finiteOrDefault(enemy.health, 1);
  const hasSpawnPacing = Number.isFinite(enemy.spawnDelay) || Number.isFinite(enemy.spawnDistance);
  const y = finiteOrDefault(enemy.y, 0);
  return {
    id: enemy.id ?? `${enemy.type ?? "enemy"}-${finiteOrDefault(enemy.x, 0)}`,
    type: enemy.type ?? "enemy",
    x: finiteOrDefault(enemy.x, 0),
    y,
    w: finiteOrDefault(enemy.w, 32),
    h: finiteOrDefault(enemy.h, 24),
    lane: finiteOrNull(enemy.lane),
    spawnZone: enemy.spawnZone ?? "",
    targetZone: enemy.targetZone ?? "air",
    alive: enemy.alive ?? true,
    active: enemy.active ?? !hasSpawnPacing,
    defeated: enemy.defeated ?? false,
    health,
    maxHealth: finiteOrDefault(enemy.maxHealth, health),
    damage: finiteOrDefault(enemy.damage, defaultEnemyDamage(enemy.type)),
    vx: finiteOrDefault(enemy.vx, 0),
    vy: finiteOrDefault(enemy.vy, 0),
    moveSpeed: finiteOrDefault(enemy.moveSpeed, defaultEnemyMoveSpeed(enemy.type)),
    laneSpeed: finiteOrDefault(enemy.laneSpeed, defaultEnemyLaneSpeed(enemy.type)),
    attackRange: finiteOrDefault(enemy.attackRange, defaultEnemyAttackRange(enemy.type)),
    laneAttackRange: finiteOrDefault(enemy.laneAttackRange, defaultEnemyLaneAttackRange(enemy.type)),
    attackCooldown: finiteOrDefault(enemy.attackCooldown, defaultEnemyAttackCooldown(enemy.type)),
    attackTimer: finiteOrDefault(enemy.attackTimer, 0),
    spawnDelay: finiteOrDefault(enemy.spawnDelay, 0),
    spawnDistance: finiteOrDefault(enemy.spawnDistance, 0),
    age: finiteOrDefault(enemy.age, 0),
    baseY: finiteOrDefault(enemy.baseY, y),
    swoopAmplitude: finiteOrDefault(enemy.swoopAmplitude, 32),
    swoopRate: finiteOrDefault(enemy.swoopRate, 2.4),
    hitFlash: finiteOrDefault(enemy.hitFlash, 0),
    attackFlash: finiteOrDefault(enemy.attackFlash, 0),
    spawnFlash: finiteOrDefault(enemy.spawnFlash, 0),
    defeatFlash: finiteOrDefault(enemy.defeatFlash, 0)
  };
}

function cloneState(state) {
  const shots = state.shots.map((shot) => ({ ...shot }));
  return finishState({
    ...state,
    level: cloneLevel(state.level),
    bounds: { ...state.bounds },
    rover: {
      ...state.rover,
      aim: { ...state.rover.aim },
      cooldowns: { ...state.rover.cooldowns }
    },
    shots,
    projectiles: shots,
    terrain: state.terrain.map((hazard) => ({ ...hazard })),
    enemies: state.enemies.map((enemy) => ({ ...enemy })),
    objective: { ...state.objective },
    collisions: state.collisions.map((collision) => ({ ...collision })),
    stats: { ...state.stats }
  });
}

function isDefaultFirstLevel(options) {
  return options.level === undefined && options.terrain === undefined && options.enemies === undefined;
}

function validateRequiredEntities(problems, level, terrain) {
  const requiredEntities = level.requiredEntities.length > 0 ? level.requiredEntities : FIRST_LEVEL_REQUIRED_ENTITIES;
  const checks = {
    "landing-site": isRectLike(level.landingSite),
    "safe-space": level.safeZones.length > 0,
    crater: terrainHasType(terrain, "crater"),
    rock: terrainHasType(terrain, "rock"),
    ridge: terrainHasType(terrain, "ridge"),
    "shadow-zone": level.shadowZones.length > 0,
    ramp: terrainHasType(terrain, "ramp") || terrainHasType(terrain, "slope"),
    "enemy-spawn-zone": level.enemySpawnZones.length > 0,
    objective: level.objectives.length > 0,
    "movement-blocker": terrain.some((hazard) => hazard.active && hazard.blocks)
  };
  for (const entity of requiredEntities) {
    if (!checks[entity]) {
      problems.push(`missing required entity ${entity}`);
    }
  }
}

function validateSpawnPoints(problems, level, terrain) {
  const blockers = terrain.filter((hazard) => hazard.active && hazard.blocks);
  if (level.spawnPoints.length === 0) {
    problems.push("missing required spawn point");
    return;
  }
  for (const spawn of level.spawnPoints) {
    const spawnBox = entityBox(spawn);
    for (const blocker of blockers) {
      if (rectsIntersect(spawnBox, hazardBox(blocker))) {
        problems.push(`spawn point ${spawn.id} overlaps movement blocker ${blocker.id}`);
      }
    }
  }
}

function validateObjectiveLocations(problems, level) {
  for (const objective of level.objectives) {
    if (!rectInsideLevel(entityBox(objective), level.bounds)) {
      problems.push(`objective ${objective.id} outside level bounds`);
    }
  }
}

function validateEnemySpawnLocations(problems, level, enemies) {
  const zones = new Map(level.enemySpawnZones.map((zone) => [zone.id, zone]));
  for (const enemy of enemies) {
    const zone = zones.get(enemy.spawnZone);
    if (!zone) {
      problems.push(`enemy ${enemy.id} missing allowed spawn zone ${enemy.spawnZone}`);
      continue;
    }
    if (!rectInsideRect(enemyBox(enemy), entityBox(zone))) {
      problems.push(`enemy ${enemy.id} outside spawn zone ${zone.id}`);
    }
  }
}

function validateMovementBlockers(problems, level, terrain) {
  const blockers = terrain.filter((hazard) => hazard.active && hazard.blocks);
  if (blockers.length === 0) {
    problems.push("missing movement blocker terrain");
  }
  for (const blocker of blockers) {
    if (!positiveRect(blocker)) {
      problems.push(`movement blocker ${blocker.id} has invalid dimensions`);
    }
    if (!terrainInsideLevel(blocker, level.bounds)) {
      problems.push(`movement blocker ${blocker.id} outside level bounds`);
    }
  }
  for (const safeZone of level.safeZones) {
    const zoneBox = groundZoneBox(safeZone, level.bounds);
    for (const blocker of blockers) {
      if (rectsIntersect(zoneBox, hazardBox(blocker))) {
        problems.push(`safe space ${safeZone.id} overlaps movement blocker ${blocker.id}`);
      }
    }
  }
}

function terrainHasType(terrain, type) {
  return terrain.some((hazard) => hazard.active && hazard.type === type);
}

function cloneLevel(level) {
  return {
    ...level,
    bounds: { ...level.bounds },
    lateralBounds: { ...level.lateralBounds },
    landingSite: cloneRect(level.landingSite),
    spawnPoints: cloneRectList(level.spawnPoints),
    safeZones: cloneRectList(level.safeZones),
    shadowZones: cloneRectList(level.shadowZones),
    enemySpawnZones: cloneRectList(level.enemySpawnZones),
    objectives: cloneRectList(level.objectives),
    requiredEntities: [...level.requiredEntities]
  };
}

function cloneRect(rect) {
  if (!rect) {
    return null;
  }
  return { ...rect };
}

function cloneRectList(rects) {
  return rects.map(cloneRect).filter(Boolean);
}

function isRectLike(rect) {
  return Boolean(rect) && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h);
}

function entityBox(entity) {
  return {
    x: finiteOrDefault(entity.x, 0),
    y: finiteOrDefault(entity.y, 0),
    w: finiteOrDefault(entity.w, 1),
    h: finiteOrDefault(entity.h, 1)
  };
}

function rectInsideLevel(box, bounds) {
  return box.x >= bounds.left && box.x + box.w <= bounds.right && box.y >= bounds.top && box.y + box.h <= bounds.groundY;
}

function terrainInsideLevel(entity, bounds) {
  const box = entityBox(entity);
  return box.x >= bounds.left && box.x + box.w <= bounds.right && box.y >= bounds.top && box.y + box.h <= bounds.groundY;
}

function rectInsideRect(inner, outer) {
  return inner.x >= outer.x && inner.x + inner.w <= outer.x + outer.w && inner.y >= outer.y && inner.y + inner.h <= outer.y + outer.h;
}

function positiveRect(rect) {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h) && rect.w > 0 && rect.h > 0;
}

function groundZoneBox(zone, bounds) {
  return {
    x: finiteOrDefault(zone.x, bounds.left),
    y: bounds.top,
    w: finiteOrDefault(zone.w, 0),
    h: bounds.groundY - bounds.top
  };
}

function togglePause(state) {
  const next = cloneState(state);
  if (next.state === "play") {
    next.state = "pause";
    next.status = "paused";
    next.message = "Paused";
  } else if (next.state === "pause") {
    next.state = "play";
    next.status = "playing";
    next.message = "";
  }
  next.collisions = [];
  return finishState(next);
}

function updateAim(rover, input) {
  if (input.aim) {
    rover.aim = normalizeVector(input.aim, rover.aim);
  } else if (input.fireUp) {
    rover.aim = { x: 0, y: -1 };
  } else if (input.fireForward) {
    rover.aim = { x: 1, y: 0 };
  }
}

function updateCooldowns(rover, level, dt) {
  rover.cooldowns.forward = Math.max(0, rover.cooldowns.forward - dt);
  rover.cooldowns.up = Math.max(0, rover.cooldowns.up - dt);
  rover.cooldown = rover.cooldowns.forward;
  rover.upCooldown = rover.cooldowns.up;
}

function updateRoverTimers(rover, dt) {
  rover.invulnerableTimer = Math.max(0, finiteOrDefault(rover.invulnerableTimer, 0) - dt);
  rover.invulnerable = rover.invulnerableTimer > 0;
  rover.damageFlash = Math.max(0, finiteOrDefault(rover.damageFlash, 0) - dt);
}

function updateSpeed(rover, level, input, dt) {
  const forwardIntent = movementForwardIntent(input);
  if (forwardIntent < 0) {
    rover.speed = Math.max(level.minSpeed, rover.speed + level.braking * forwardIntent * dt);
  } else if (forwardIntent > 0) {
    rover.speed = Math.min(level.maxSpeed, rover.speed + level.acceleration * forwardIntent * dt);
  } else {
    rover.speed += (level.cruiseSpeed - rover.speed) * Math.min(1, dt * 2.4);
  }
}

function updateJump(rover, level, input) {
  if (input.jump && rover.onGround) {
    rover.vy = level.jumpVelocity;
    rover.onGround = false;
  }
}

function updateVerticalPosition(rover, level, dt, collisions) {
  rover.vy += level.gravity * dt;
  rover.y += rover.vy * dt;
  if (rover.y < level.bounds.top) {
    rover.y = level.bounds.top;
    rover.vy = 0;
    collisions.push({ type: "bounds", side: "top" });
  } else if (rover.y >= level.bounds.groundY) {
    rover.y = level.bounds.groundY;
    rover.vy = 0;
    rover.onGround = true;
  } else {
    rover.onGround = false;
  }
}

function updateHorizontalPosition(state, dt) {
  const rover = state.rover;
  const bounds = state.level.bounds;
  let desiredX = rover.worldX + rover.speed * dt;
  if (desiredX < bounds.left) {
    desiredX = bounds.left;
    state.collisions.push({ type: "bounds", side: "left" });
  } else if (desiredX > bounds.right) {
    desiredX = bounds.right;
    state.collisions.push({ type: "bounds", side: "right" });
  }
  for (const hazard of state.terrain) {
    if (!hazard.active || !hazard.blocks) {
      continue;
    }
    const nextBox = roverBoxAt(rover, desiredX);
    if (!rectsIntersect(nextBox, hazardBox(hazard))) {
      continue;
    }
    desiredX = rover.worldX <= hazard.x ? hazard.x - rover.w : hazard.x + hazard.w;
    rover.speed = Math.min(rover.speed, 0);
    state.collisions.push({ type: "blocked", target: hazard.id });
    applyHazardDamage(state, hazard);
  }
  rover.worldX = desiredX;
  state.distance = Math.max(0, rover.worldX - state.level.startX);
  state.camera = Math.max(0, state.distance - rover.x + 120);
  rover.roll += (rover.speed * dt) / 34;
}

function updateLateralPosition(state, input, dt) {
  const rover = state.rover;
  const moveX = clamp(finiteOrDefault(input.moveX, 0), -1, 1);
  rover.laneVelocity = moveX * state.level.lateralSpeed;
  rover.lane += rover.laneVelocity * dt;
  if (rover.lane < state.level.lateralBounds.left) {
    rover.lane = state.level.lateralBounds.left;
    state.collisions.push({ type: "bounds", side: "lane-left" });
  } else if (rover.lane > state.level.lateralBounds.right) {
    rover.lane = state.level.lateralBounds.right;
    state.collisions.push({ type: "bounds", side: "lane-right" });
  }
}

function fireProjectiles(state, input) {
  if (input.fireForward && state.rover.cooldowns.forward === 0) {
    addProjectile(state, "forward", { x: 1, y: 0 }, "ground", state.level.shotSpeed);
    state.rover.cooldowns.forward = state.level.forwardCooldown;
  }
  if (input.fireUp && state.rover.cooldowns.up === 0) {
    addProjectile(state, "up", { x: 0.21, y: -1 }, "air", state.level.shotSpeed);
    state.rover.cooldowns.up = state.level.upwardCooldown;
  }
  if (input.fire && state.rover.cooldowns.forward === 0) {
    addProjectile(state, "aim", state.rover.aim, "all", state.level.shotSpeed);
    state.rover.cooldowns.forward = state.level.forwardCooldown;
  }
  state.rover.cooldown = state.rover.cooldowns.forward;
  state.rover.upCooldown = state.rover.cooldowns.up;
}

function addProjectile(state, kind, direction, target, speed) {
  const unit = normalizeVector(direction, { x: 1, y: 0 });
  const velocity = projectileVelocity(state, kind, unit, speed);
  state.shots.push({
    id: `shot-${state.nextProjectileId}`,
    x: state.rover.worldX + 35,
    y: kind === "up" ? state.rover.y + 24 : state.level.bounds.groundY - 18,
    w: kind === "up" ? 10 : 14,
    h: kind === "up" ? 10 : 5,
    vx: velocity.x,
    vy: velocity.y,
    lane: state.rover.lane,
    kind,
    target,
    active: true,
    damage: 1
  });
  state.nextProjectileId += 1;
  state.stats.shotsFired += 1;
}

function projectileVelocity(state, kind, unit, speed) {
  if (kind === "up") {
    return { x: state.rover.speed + state.level.upwardShotForwardSpeed, y: -speed };
  }
  return { x: unit.x * speed, y: unit.y * speed };
}

function updateProjectiles(state, dt) {
  for (const shot of state.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
  }
  const bounds = state.level.bounds;
  const rightEdge = state.rover.worldX + 980;
  state.shots = state.shots.filter((shot) => shot.active && shot.x >= bounds.left - 80 && shot.x <= rightEdge && shot.y >= bounds.top - 80 && shot.y <= bounds.groundY + 140);
  state.projectiles = state.shots;
}

function updateEnemies(state, dt) {
  for (const enemy of state.enemies) {
    updateEnemyTimers(enemy, dt);
    if (!enemy.alive) {
      continue;
    }
    updateEnemySpawn(state, enemy);
    if (!enemy.active) {
      continue;
    }
    enemy.age += dt;
    if (enemy.type === "werewolf") {
      updateWerewolf(state, enemy, dt);
    } else if (enemy.type === "vampire") {
      updateVampire(state, enemy, dt);
    } else {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
    updateEnemyAttack(state, enemy);
  }
}

function updateEnemyTimers(enemy, dt) {
  enemy.attackTimer = Math.max(0, finiteOrDefault(enemy.attackTimer, 0) - dt);
  enemy.hitFlash = Math.max(0, finiteOrDefault(enemy.hitFlash, 0) - dt);
  enemy.attackFlash = Math.max(0, finiteOrDefault(enemy.attackFlash, 0) - dt);
  enemy.spawnFlash = Math.max(0, finiteOrDefault(enemy.spawnFlash, 0) - dt);
  enemy.defeatFlash = Math.max(0, finiteOrDefault(enemy.defeatFlash, 0) - dt);
}

function updateEnemySpawn(state, enemy) {
  if (enemy.active) {
    return;
  }
  if (state.elapsedTime < enemy.spawnDelay || state.distance < enemy.spawnDistance) {
    return;
  }
  enemy.active = true;
  enemy.spawnFlash = 0.35;
  state.collisions.push({ type: "enemy-spawn", target: enemy.id });
}

function updateWerewolf(state, enemy, dt) {
  enemy.x = moveToward(enemy.x, state.rover.worldX + 8, enemy.moveSpeed, dt);
  enemy.y = state.level.bounds.groundY - enemy.h;
  enemy.lane = moveToward(numericLane(enemy), state.rover.lane, enemy.laneSpeed, dt);
}

function updateVampire(state, enemy, dt) {
  enemy.x = moveToward(enemy.x, state.rover.worldX + 80, enemy.moveSpeed, dt);
  enemy.lane = moveToward(numericLane(enemy), state.rover.lane, enemy.laneSpeed, dt);
  enemy.y = clamp(enemy.baseY + Math.sin(enemy.age * enemy.swoopRate) * enemy.swoopAmplitude, state.level.bounds.top, state.level.bounds.groundY - enemy.h - 18);
}

function updateEnemyAttack(state, enemy) {
  if (!enemyCanAttack(enemy) || enemy.attackTimer > 0 || !enemyInAttackRange(state, enemy)) {
    return;
  }
  if (damageRover(state, enemy.damage, "enemy", enemy.id)) {
    enemy.attackFlash = 0.28;
    state.collisions.push({ type: "enemy-attack", target: enemy.id, damage: enemy.damage });
  }
  enemy.attackTimer = enemy.attackCooldown;
}

function resolveProjectileHits(state) {
  for (const shot of state.shots) {
    if (!shot.active) {
      continue;
    }
    if (resolveProjectileEnemyHit(state, shot)) {
      continue;
    }
    resolveProjectileHazardHit(state, shot);
  }
}

function resolveProjectileEnemyHit(state, shot) {
  for (const enemy of state.enemies) {
    if (!enemy.alive || !enemy.active || !projectileCanHitZone(shot, enemy.targetZone)) {
      continue;
    }
    if (!rectsIntersect(projectileBox(shot), enemyBox(enemy))) {
      continue;
    }
    enemy.health -= shot.damage;
    enemy.hitFlash = 0.18;
    shot.active = false;
    state.collisions.push({ type: "projectile-hit", projectile: shot.id, target: enemy.id });
    if (enemy.health <= 0) {
      defeatEnemy(state, enemy);
    }
    return true;
  }
  return false;
}

function resolveProjectileHazardHit(state, shot) {
  for (const hazard of state.terrain) {
    if (!hazard.active || !hazard.destructible || !projectileCanHitZone(shot, "ground")) {
      continue;
    }
    if (!rectsIntersect(projectileBox(shot), hazardBox(hazard))) {
      continue;
    }
    hazard.active = false;
    hazard.cleared = true;
    shot.active = false;
    state.stats.hazardsCleared += 1;
    state.collisions.push({ type: "projectile-hit", projectile: shot.id, target: hazard.id });
    return true;
  }
  return false;
}

function resolveRoverContacts(state) {
  const roverBox = roverBoxAt(state.rover, state.rover.worldX);
  for (const hazard of state.terrain) {
    if (!hazard.active || hazard.blocks || !rectsIntersect(roverBox, hazardBox(hazard))) {
      continue;
    }
    state.collisions.push({ type: "hazard", target: hazard.id });
    applyHazardDamage(state, hazard);
    if (hazard.fatal || hazard.damage > 0) {
      hazard.active = false;
    }
  }
  for (const enemy of state.enemies) {
    if (!enemy.alive || !enemy.active || !rectsIntersect(roverBox, enemyBox(enemy))) {
      continue;
    }
    if (enemyCanAttack(enemy)) {
      continue;
    }
    enemy.alive = false;
    enemy.active = false;
    enemy.defeatFlash = 0.22;
    damageRover(state, 45, "enemy", enemy.id);
    state.collisions.push({ type: "enemy", target: enemy.id });
  }
}

function applyHazardDamage(state, hazard) {
  if (hazard.damage <= 0 || hazard.contacted) {
    return;
  }
  hazard.contacted = true;
  damageRover(state, hazard.damage, "hazard", hazard.id);
}

function damageRover(state, damage, sourceType, source) {
  const amount = finiteOrDefault(damage, 0);
  if (amount <= 0 || state.rover.invulnerableTimer > 0) {
    return false;
  }
  state.rover.health = Math.max(0, state.rover.health - amount);
  state.rover.integrity = state.rover.health;
  state.rover.invulnerableTimer = state.level.playerInvulnerabilityDuration;
  state.rover.invulnerable = true;
  state.rover.damageFlash = 0.24;
  state.collisions.push({ type: "player-damage", sourceType, source, damage: amount });
  return true;
}

function defeatEnemy(state, enemy) {
  enemy.alive = false;
  enemy.active = false;
  enemy.defeated = true;
  enemy.defeatFlash = 0.45;
  enemy.health = 0;
  state.stats.enemiesDestroyed += 1;
  state.collisions.push({ type: "enemy-defeated", target: enemy.id });
}

function updateObjective(state) {
  for (const hazard of state.terrain) {
    if (!hazard.cleared && hazard.active && hazard.x + hazard.w < state.rover.worldX) {
      hazard.cleared = true;
      state.stats.hazardsCleared += 1;
    }
  }
  const span = Math.max(1, state.level.finishX - state.level.startX);
  const progress = clamp((state.rover.worldX - state.level.startX) / span, 0, 1);
  state.objective = {
    finishX: state.level.finishX,
    progress,
    complete: progress >= 1
  };
}

function updateScore(state) {
  state.score = Math.floor(state.distance / 8) + state.stats.enemiesDestroyed * 250 + state.stats.hazardsCleared * 75;
}

function updateTransitions(state) {
  if (state.rover.health <= 0) {
    state.state = "loss";
    state.status = "lost";
    state.message = "Rover Disabled";
    state.lossCause = "health";
  } else if (state.timeRemaining <= 0) {
    state.state = "loss";
    state.status = "lost";
    state.message = "Time Expired";
    state.lossCause = "time";
  } else if (state.objective.complete) {
    state.state = "win";
    state.status = "won";
    state.message = "Level Clear";
    state.score += Math.floor(state.timeRemaining) * 20;
  }
}

function finishState(state) {
  state.rover.integrity = state.rover.health;
  state.rover.cooldown = state.rover.cooldowns.forward;
  state.rover.upCooldown = state.rover.cooldowns.up;
  state.rover.invulnerable = finiteOrDefault(state.rover.invulnerableTimer, 0) > 0;
  state.time = state.timeRemaining;
  state.finish = state.level.finishX;
  state.bounds = { ...state.level.bounds };
  state.projectiles = state.shots;
  return state;
}

function roverBoxAt(rover, worldX) {
  return { x: worldX, y: rover.y + 4, w: rover.w, h: rover.h };
}

function projectileBox(shot) {
  return { x: shot.x, y: shot.y, w: shot.w, h: shot.h };
}

function hazardBox(hazard) {
  return { x: hazard.x, y: hazard.y, w: hazard.w, h: hazard.h };
}

function enemyBox(enemy) {
  return { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
}

function projectileCanHitZone(shot, zone) {
  return shot.target === "all" || shot.target === zone;
}

function enemyCanAttack(enemy) {
  return enemy.type === "werewolf" || enemy.type === "vampire";
}

function enemyInAttackRange(state, enemy) {
  const enemyCenterX = enemy.x + enemy.w / 2;
  const roverCenterX = state.rover.worldX + state.rover.w / 2;
  const laneDistance = Math.abs(numericLane(enemy) - state.rover.lane);
  return Math.abs(enemyCenterX - roverCenterX) <= enemy.attackRange && laneDistance <= enemy.laneAttackRange;
}

function defaultEnemyDamage(type) {
  if (type === "werewolf") {
    return 16;
  } else if (type === "vampire") {
    return 14;
  }
  return 0;
}

function defaultEnemyMoveSpeed(type) {
  if (type === "werewolf") {
    return 95;
  } else if (type === "vampire") {
    return 90;
  }
  return 0;
}

function defaultEnemyLaneSpeed(type) {
  if (type === "werewolf") {
    return 120;
  } else if (type === "vampire") {
    return 90;
  }
  return 0;
}

function defaultEnemyAttackRange(type) {
  if (type === "werewolf") {
    return 82;
  } else if (type === "vampire") {
    return 135;
  }
  return 0;
}

function defaultEnemyLaneAttackRange(type) {
  if (type === "werewolf") {
    return 68;
  } else if (type === "vampire") {
    return 84;
  }
  return 0;
}

function defaultEnemyAttackCooldown(type) {
  if (type === "werewolf") {
    return 1.0;
  } else if (type === "vampire") {
    return 1.2;
  }
  return 0;
}

function numericLane(entity) {
  return Number.isFinite(entity.lane) ? entity.lane : 0;
}

function moveToward(value, target, speed, dt) {
  const distance = target - value;
  const step = Math.min(Math.abs(distance), Math.max(0, speed) * dt);
  if (distance < 0) {
    return value - step;
  } else if (distance > 0) {
    return value + step;
  }
  return value;
}

function movementForwardIntent(input) {
  const moveY = clamp(finiteOrDefault(input.moveY, 0), -1, 1);
  if (moveY !== 0) {
    return moveY;
  } else if (input.right && !input.left) {
    return 1;
  } else if (input.left && !input.right) {
    return -1;
  }
  return 0;
}

function normalizeVector(vector, fallback) {
  const x = finiteOrDefault(vector.x, fallback.x);
  const y = finiteOrDefault(vector.y, fallback.y);
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { ...fallback };
  }
  return { x: x / length, y: y / length };
}

function keySetHas(keys, code) {
  if (!keys) {
    return false;
  }
  if (typeof keys.has === "function") {
    return keys.has(code);
  }
  if (Array.isArray(keys)) {
    return keys.includes(code);
  }
  return Boolean(keys[code]);
}

function axisValue(negative, positive) {
  if (negative && !positive) {
    return -1;
  } else if (positive && !negative) {
    return 1;
  }
  return 0;
}

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
