(function () {
  "use strict";

  // Core constants faithfully ported from DCBH (gameplay.go, falling.go, System*.go)
  // Enhanced with authentic Dungeon Crawl Stone Soup (DCSS) tileset graphics.
  const VIEW_WIDTH = 1024;
  const VIEW_HEIGHT = 1024;

  const PLAYER_MAX_HP = 10;
  const PLAYER_SPEED = 400; // px/s
  const ENEMY_SPEED = 84; // px/s
  const BULLET_SPEED = 640; // px/s

  const BULLET_COOLDOWN = 0.18; // s
  const BULLET_MAX_LIFETIME = 2.4; // s
  const INITIAL_SPAWN_DELAY = 0.25; // s
  const INITIAL_SPAWN_INTERVAL = 1.0; // s
  const MIN_SPAWN_INTERVAL = 0.28; // s
  const SPAWN_RAMP_PER_SEC = 0.012;

  const TILE_SIZE = 64; // 32px DCSS tile rendered at crisp 2x
  const MENU_GRID_SIZE = 25;
  const WALL_MARGIN = TILE_SIZE; // 1-tile stone border around arena

  const STORAGE_BEST_KEY = "dcbh_best_kills_v1";
  const DCSS_BASE = "/projects/games/crawlofthebeholder/art/tilesets/classic/";

  const CARDINAL_DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  // DCSS branch progression (changes floor/wall palette & unlocks deeper monsters)
  const BRANCHES = [
    { id: "dungeon", label: "D:1", name: "The Dungeon", minTime: 0, accent: "#cbd5e1" },
    { id: "crypt", label: "Crypt:1", name: "The Crypt", minTime: 25, accent: "#a78bfa" },
    { id: "zot", label: "Zot:5", name: "The Realm of Zot", minTime: 60, accent: "#f87171" }
  ];

  // Authentic DCSS monster roster grouped by dungeon depth
  const MONSTER_TIERS = {
    dungeon: [
      { id: "goblin", name: "goblin", tile: "mons_goblin", speedMul: 1.15, burst: "#4ade80" },
      { id: "orc", name: "orc", tile: "mons_orc", speedMul: 1.0, burst: "#86efac" },
      { id: "orc_warrior", name: "orc warrior", tile: "mons_orc_warrior", speedMul: 0.96, burst: "#facc15" },
      { id: "azure_jelly", name: "azure jelly", tile: "mons_azure_jelly", speedMul: 0.92, burst: "#38bdf8" },
      { id: "eye_of_draining", name: "eye of draining", tile: "mons_eye", speedMul: 1.08, burst: "#c084fc" }
    ],
    crypt: [
      { id: "hydra", name: "hydra", tile: "mons_hydra", speedMul: 0.95, burst: "#4ade80" },
      { id: "manticore", name: "manticore", tile: "mons_manticore", speedMul: 1.12, burst: "#fb923c" },
      { id: "mummy", name: "mummy", tile: "mons_mummy", speedMul: 0.86, burst: "#fde68a" },
      { id: "wight", name: "wight", tile: "mons_wight", speedMul: 1.05, burst: "#93c5fd" },
      { id: "orb_spider", name: "orb spider", tile: "mons_orb_spider", speedMul: 1.18, burst: "#f472b6" },
      { id: "ogre", name: "ogre", tile: "mons_ogre", speedMul: 0.9, burst: "#d97706" }
    ],
    zot: [
      { id: "starspawn", name: "tentacled starspawn", tile: "starspawn", speedMul: 1.05, burst: "#fb923c" },
      { id: "tentacled_monstrosity", name: "tentacled monstrosity", tile: "mons_tentacled", speedMul: 0.96, burst: "#a855f7" },
      { id: "chaos_spawn", name: "chaos spawn", tile: "mons_chaos", speedMul: 1.16, burst: "#e879f9" },
      { id: "shadow_demon", name: "shadow demon", tile: "mons_shadow_demon", speedMul: 1.12, burst: "#818cf8" },
      { id: "ancient_lich", name: "ancient lich", tile: "mons_ancient_lich", speedMul: 0.98, burst: "#c084fc" },
      { id: "brimstone_fiend", name: "brimstone fiend", tile: "mons_brimstone", speedMul: 1.08, burst: "#ef4444" },
      { id: "executioner", name: "executioner", tile: "mons_executioner", speedMul: 1.2, burst: "#f87171" },
      { id: "balrug", name: "balrug", tile: "mons_balrug", speedMul: 1.02, burst: "#f97316" },
      { id: "curse_skull", name: "curse skull", tile: "mons_curse_skull", speedMul: 1.1, burst: "#e2e8f0" },
      { id: "crystal_guardian", name: "crystal guardian", tile: "mons_crystal", speedMul: 0.94, burst: "#67e8f9" }
    ]
  };

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const muteBtn = document.getElementById("mute-btn");

  // --- Retro Procedural Audio (WebAudio, zero external files) ---
  const sound = {
    ctx: null,
    muted: false,
    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(function () {});
      }
      return this.ctx;
    },
    tone(freqStart, freqEnd, duration, type, gainPeak) {
      const ac = this.ensure();
      if (!ac) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "triangle";
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);
      gain.gain.setValueAtTime(gainPeak, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + duration);
    },
    shoot() {
      this.tone(540, 260, 0.055, "triangle", 0.035);
    },
    kill() {
      this.tone(240, 520, 0.09, "square", 0.045);
    },
    hurt() {
      this.tone(170, 62, 0.18, "sawtooth", 0.09);
    },
    descend() {
      this.tone(280, 620, 0.25, "triangle", 0.06);
    },
    gameOver() {
      this.tone(220, 55, 0.42, "sawtooth", 0.1);
    }
  };

  // --- Asset Loader (DCBH + Authentic DCSS classic tileset) ---
  const ASSET_FILES = {
    // Player & spell projectile
    player: "assets/deep_elf_annihilator.png",
    bullet: "assets/damnation.png",
    starspawn: "assets/tentacled_starspawn.png",

    // DCSS dungeon floors
    floor_norm_0: DCSS_BASE + "FLOOR_NORMAL_0.png",
    floor_norm_1: DCSS_BASE + "FLOOR_NORMAL_1.png",
    floor_norm_2: DCSS_BASE + "FLOOR_NORMAL_2.png",
    floor_norm_3: DCSS_BASE + "FLOOR_NORMAL_3.png",
    floor_crypt_0: DCSS_BASE + "FLOOR_CRYPT_0.png",
    floor_crypt_1: DCSS_BASE + "FLOOR_CRYPT_1.png",
    floor_cobalt_0: DCSS_BASE + "FLOOR_BLACK_COBALT_0.png",
    floor_cobalt_1: DCSS_BASE + "FLOOR_BLACK_COBALT_1.png",
    floor_cobalt_2: DCSS_BASE + "FLOOR_BLACK_COBALT_2.png",
    floor_cobalt_3: DCSS_BASE + "FLOOR_BLACK_COBALT_3.png",
    floor_mosaic_0: DCSS_BASE + "FLOOR_MOSAIC_0.png",
    floor_mosaic_1: DCSS_BASE + "FLOOR_MOSAIC_1.png",
    floor_mosaic_2: DCSS_BASE + "FLOOR_MOSAIC_2.png",
    floor_mosaic_3: DCSS_BASE + "FLOOR_MOSAIC_3.png",
    floor_blood_0: DCSS_BASE + "FLOOR_COBBLE_BLOOD_0.png",
    floor_blood_1: DCSS_BASE + "FLOOR_COBBLE_BLOOD_1.png",

    // DCSS walls & dungeon features
    wall_cat_0: DCSS_BASE + "WALL_CATACOMBS_0.png",
    wall_cat_1: DCSS_BASE + "WALL_CATACOMBS_1.png",
    wall_cat_2: DCSS_BASE + "WALL_CATACOMBS_2.png",
    wall_cat_3: DCSS_BASE + "WALL_CATACOMBS_3.png",
    wall_vault_0: DCSS_BASE + "WALL_VAULT_0.png",
    wall_vault_1: DCSS_BASE + "WALL_VAULT_1.png",
    wall_vault_2: DCSS_BASE + "WALL_VAULT_2.png",
    wall_vault_3: DCSS_BASE + "WALL_VAULT_3.png",
    wall_zot_0: DCSS_BASE + "WALL_ZOT_RED_0.png",
    wall_zot_1: DCSS_BASE + "WALL_ZOT_RED_1.png",
    wall_zot_2: DCSS_BASE + "WALL_ZOT_RED_2.png",
    wall_zot_3: DCSS_BASE + "WALL_ZOT_RED_3.png",
    lava_0: DCSS_BASE + "DNGN_LAVA_0.png",
    lava_1: DCSS_BASE + "DNGN_LAVA_1.png",
    lava_2: DCSS_BASE + "DNGN_LAVA_2.png",
    lava_3: DCSS_BASE + "DNGN_LAVA_3.png",
    stairs_down: DCSS_BASE + "DNGN_SHOALS_STAIRS_DOWN_0.png",
    stairs_up: DCSS_BASE + "DNGN_SHOALS_STAIRS_UP_0.png",
    shallow_water: DCSS_BASE + "DNGN_SHALLOW_WATER_0.png",
    deep_water: DCSS_BASE + "DNGN_DEEP_WATER_0.png",

    // DCSS blood, spell clouds, and status icons
    blood_0: DCSS_BASE + "BLOOD_0.png",
    blood_1: DCSS_BASE + "BLOOD_1.png",
    blood_2: DCSS_BASE + "BLOOD_2.png",
    blood_3: DCSS_BASE + "BLOOD_3.png",
    cloud_fire_0: DCSS_BASE + "CLOUD_FIRE_0.png",
    cloud_fire_1: DCSS_BASE + "CLOUD_FIRE_1.png",
    cloud_fire_2: DCSS_BASE + "CLOUD_FIRE_2.png",
    cloud_cold_0: DCSS_BASE + "CLOUD_COLD_0.png",
    cloud_cold_1: DCSS_BASE + "CLOUD_COLD_1.png",
    cloud_poison_0: DCSS_BASE + "CLOUD_POISON_0.png",
    cloud_poison_1: DCSS_BASE + "CLOUD_POISON_1.png",
    icon_hasted: DCSS_BASE + "HASTED_0.png",
    icon_flame: DCSS_BASE + "INNER_FLAME_0.png",
    icon_berserk: DCSS_BASE + "BERSERK_0.png",

    // DCSS monsters
    mons_goblin: DCSS_BASE + "MONS_GOBLIN_0.png",
    mons_orc: DCSS_BASE + "MONS_ORC_0.png",
    mons_orc_warrior: DCSS_BASE + "MONS_ORC_WARRIOR_0.png",
    mons_azure_jelly: DCSS_BASE + "MONS_AZURE_JELLY_0.png",
    mons_eye: DCSS_BASE + "MONS_EYE_OF_DRAINING_0.png",
    mons_hydra: DCSS_BASE + "MONS_HYDRA_0.png",
    mons_manticore: DCSS_BASE + "MONS_MANTICORE_0.png",
    mons_mummy: DCSS_BASE + "MONS_MUMMY_0.png",
    mons_wight: DCSS_BASE + "MONS_WIGHT_0.png",
    mons_orb_spider: DCSS_BASE + "MONS_ORB_SPIDER_0.png",
    mons_ogre: DCSS_BASE + "MONS_OGRE_0.png",
    mons_tentacled: DCSS_BASE + "MONS_TENTACLED_MONSTROSITY_0.png",
    mons_chaos: DCSS_BASE + "MONS_CHAOS_SPAWN_0.png",
    mons_shadow_demon: DCSS_BASE + "MONS_SHADOW_DEMON_0.png",
    mons_ancient_lich: DCSS_BASE + "MONS_ANCIENT_LICH_0.png",
    mons_brimstone: DCSS_BASE + "MONS_BRIMSTONE_FIEND_0.png",
    mons_executioner: DCSS_BASE + "MONS_EXECUTIONER_0.png",
    mons_balrug: DCSS_BASE + "MONS_BALRUG_0.png",
    mons_curse_skull: DCSS_BASE + "MONS_CURSE_SKULL_0.png",
    mons_crystal: DCSS_BASE + "MONS_CRYSTAL_GUARDIAN_0.png"
  };

  const assets = {};
  let assetsReady = false;
  let menuCanvas = null;
  let arenaCanvas = null;

  // Decorative animated lava braziers placed symmetrically in the dungeon hall
  const LAVA_TILES = [
    { gx: 4, gy: 4 }, { gx: 20, gy: 4 },
    { gx: 4, gy: 20 }, { gx: 20, gy: 20 },
    { gx: 9, gy: 9 }, { gx: 15, gy: 9 },
    { gx: 9, gy: 15 }, { gx: 15, gy: 15 }
  ];

  // Deterministic tile hash so dungeon floors have organic DCSS variation
  function tileHash(x, y, salt) {
    let n = (x * 374761393 + y * 668265263 + (salt || 0) * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0);
  }

  function buildDungeonCanvas(branchId, level) {
    const off = document.createElement("canvas");
    const cols = level ? level.rows[0].length : MENU_GRID_SIZE;
    const rows = level ? level.rows.length : MENU_GRID_SIZE;
    off.width = cols * TILE_SIZE;
    off.height = rows * TILE_SIZE;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;

    const floorSets = {
      dungeon: [assets.floor_norm_0, assets.floor_norm_1, assets.floor_norm_2, assets.floor_norm_3],
      crypt: [assets.floor_crypt_0, assets.floor_crypt_1, assets.floor_blood_0, assets.floor_blood_1],
      zot: [assets.floor_cobalt_0, assets.floor_cobalt_1, assets.floor_cobalt_2, assets.floor_cobalt_3]
    };
    const wallSets = {
      dungeon: [assets.wall_cat_0, assets.wall_cat_1, assets.wall_cat_2, assets.wall_cat_3],
      crypt: [assets.wall_vault_0, assets.wall_vault_1, assets.wall_vault_2, assets.wall_vault_3],
      zot: [assets.wall_zot_0, assets.wall_zot_1, assets.wall_zot_2, assets.wall_zot_3]
    };
    const mosaicSet = [assets.floor_mosaic_0, assets.floor_mosaic_1, assets.floor_mosaic_2, assets.floor_mosaic_3];

    const floors = floorSets[branchId] || floorSets.dungeon;
    const walls = wallSets[branchId] || wallSets.dungeon;
    const fallbackFloor = branchId === "zot" ? "#131729" : branchId === "crypt" ? "#1a1720" : "#1c1c21";
    const fallbackWall = branchId === "zot" ? "#451a1a" : branchId === "crypt" ? "#2e2938" : "#2f2c29";

    const centerCol = Math.floor(cols / 2);
    const centerRow = Math.floor(rows / 2);

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const dx = gx * TILE_SIZE;
        const dy = gy * TILE_SIZE;
        const h = tileHash(gx, gy, branchId.length);
        const isBorder = gx === 0 || gy === 0 || gx === cols - 1 || gy === rows - 1;
        const terrain = level ? level.rows[gy][gx] : (isBorder ? "x" : ".");

        if (terrain === "x") {
          const wImg = walls[h % walls.length];
          if (wImg) {
            octx.drawImage(wImg, dx, dy, TILE_SIZE, TILE_SIZE);
          } else {
            octx.fillStyle = fallbackWall;
            octx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
          }
          continue;
        }

        // Central sanctuary mosaic ring + cardinal walkways
        const distCenter = Math.max(Math.abs(gx - centerCol), Math.abs(gy - centerRow));
        const onWalkway = gx === centerCol || gy === centerRow;
        let fImg = null;
        if (terrain === "w" || terrain === "W") {
          fImg = terrain === "w" ? assets.shallow_water : assets.deep_water;
        } else if (distCenter <= 3 || (onWalkway && distCenter <= 8)) {
          fImg = mosaicSet[h % mosaicSet.length];
        } else {
          fImg = floors[h % floors.length];
        }

        if (fImg) {
          octx.drawImage(fImg, dx, dy, TILE_SIZE, TILE_SIZE);
        } else {
          octx.fillStyle = fallbackFloor;
          octx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
        }

        // Subtle tile grid shadow for classic DCSS readability
        octx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        octx.lineWidth = 1;
        octx.strokeRect(dx + 0.5, dy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }

    // The menu keeps its central stairs emblem. Arena stairs mark the two landings.
    if (level) {
      const stairs = [];
      if (branchId !== BRANCHES[0].id) stairs.push([level.entry, assets.stairs_up]);
      if (branchId !== BRANCHES[BRANCHES.length - 1].id) stairs.push([level.exit, assets.stairs_down]);
      for (const [point, sprite] of stairs) {
        if (sprite) octx.drawImage(sprite, point.x - TILE_SIZE / 2, point.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      }
    } else if (assets.stairs_down) {
      octx.drawImage(
        assets.stairs_down,
        centerCol * TILE_SIZE,
        centerRow * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }

    // Ambient drop shadow along the inner edge of the stone border
    octx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    octx.lineWidth = 10;
    octx.strokeRect(
      WALL_MARGIN + 5,
      WALL_MARGIN + 5,
      off.width - WALL_MARGIN * 2 - 10,
      off.height - WALL_MARGIN * 2 - 10
    );

    return off;
  }

  function buildAllDungeonLayers() {
    menuCanvas = buildDungeonCanvas("dungeon");
    if (state.level) arenaCanvas = buildDungeonCanvas(state.branch.id, state.level);
  }

  function loadAllAssets() {
    const keys = Object.keys(ASSET_FILES);
    let remaining = keys.length;

    keys.forEach(function (key) {
      const img = new Image();
      img.onload = function () {
        assets[key] = img;
        remaining -= 1;
        if (remaining === 0) {
          assetsReady = true;
          buildAllDungeonLayers();
        }
      };
      img.onerror = function () {
        remaining -= 1;
        if (remaining === 0) {
          assetsReady = true;
          buildAllDungeonLayers();
        }
      };
      img.src = ASSET_FILES[key];
    });
  }

  // --- Helpers (matching gameplay.go) ---
  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function healthFraction(hp, maxHp) {
    if (maxHp <= 0) return 0;
    return clamp(hp / maxHp, 0, 1);
  }

  function movementVector(horizontal, vertical) {
    const mag = Math.hypot(horizontal, vertical);
    if (mag > 1) {
      return { x: horizontal / mag, y: vertical / mag };
    }
    return { x: horizontal, y: vertical };
  }

  function directionBetween(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) {
      return { x: 0, y: -1 };
    }
    return { x: dx / mag, y: dy / mag };
  }

  function enemySpawnInterval(elapsed) {
    const interval = INITIAL_SPAWN_INTERVAL - elapsed * SPAWN_RAMP_PER_SEC;
    return interval < MIN_SPAWN_INTERVAL ? MIN_SPAWN_INTERVAL : interval;
  }

  function currentBranchForTime(elapsed) {
    let chosen = BRANCHES[0];
    for (let i = 0; i < BRANCHES.length; i++) {
      if (elapsed >= BRANCHES[i].minTime) {
        chosen = BRANCHES[i];
      }
    }
    return chosen;
  }

  function loadBestScore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_BEST_KEY);
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (_e) {
      return 0;
    }
  }

  function saveBestScore(score) {
    try {
      window.localStorage.setItem(STORAGE_BEST_KEY, String(score));
    } catch (_e) {
      // ignore storage errors
    }
  }

  // --- Game State ---
  const state = {
    scene: "menu", // "menu" | "game"
    paused: false,
    score: 0,
    lastScore: 0,
    bestScore: loadBestScore(),
    gameOver: false,
    menuLockTimer: 0,

    elapsed: 0,
    branch: BRANCHES[0],
    levels: [],
    level: null,
    runSeed: 0,
    onStairs: false,
    spawnCooldown: INITIAL_SPAWN_DELAY,
    bulletCooldown: 0,
    bulletSweep: 0,

    player: null,
    enemies: [],
    bullets: [],
    particles: [],
    decals: [], // persistent DCSS blood splatters on dungeon floor
    spellClouds: [], // transient DCSS fire/cold/poison puffs on kill/hit
    ambientClouds: [], // drifting dungeon miasma/smoke
    combatLog: [], // DCSS-style combat messages
    camera: { x: 0, y: 0 },
    shakeTimer: 0,
    hurtFlash: 0,
    animTime: 0
  };

  function pushLog(text, color) {
    state.combatLog.push({ text: text, color: color || "#cbd5e1" });
    if (state.combatLog.length > 4) {
      state.combatLog.shift();
    }
  }

  function initAmbientClouds() {
    state.ambientClouds = [
      { x: 240, y: 260, vx: 14, kind: "poison", scale: 1.5, alpha: 0.34 },
      { x: 960, y: 480, vx: -11, kind: "cold", scale: 1.7, alpha: 0.3 },
      { x: 520, y: 1120, vx: 16, kind: "fire", scale: 1.4, alpha: 0.28 },
      { x: 1240, y: 1080, vx: -13, kind: "poison", scale: 1.6, alpha: 0.3 }
    ];
  }

  function createPlayer() {
    const size = 64; // 32 * 2x scale
    return {
      x: 0,
      y: 0,
      width: size,
      height: size,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      facingX: 1,
      walkPhase: 0
    };
  }

  function centerOf(ent) {
    return {
      x: ent.x + ent.width / 2,
      y: ent.y + ent.height / 2
    };
  }

  function updateCamera() {
    if (!state.player) return;
    const pc = centerOf(state.player);
    const maxCamX = Math.max(0, state.level.width - VIEW_WIDTH);
    const maxCamY = Math.max(0, state.level.height - VIEW_HEIGHT);
    state.camera.x = clamp(pc.x - VIEW_WIDTH / 2, 0, maxCamX);
    state.camera.y = clamp(pc.y - VIEW_HEIGHT / 2, 0, maxCamY);
  }

  function enterLevel(index, descending) {
    const branch = BRANCHES[index];
    const level = state.levels[index] ||= new ArenaLevel(branch.id, state.runSeed, TILE_SIZE);
    const landing = descending ? level.entry : level.exit;
    state.level = level;
    state.branch = branch;
    state.player.x = landing.x - state.player.width / 2;
    state.player.y = landing.y - state.player.height / 2;
    state.onStairs = true;
    state.enemies = level.enemies;
    state.decals = level.decals;
    state.bullets = [];
    state.particles = [];
    state.spellClouds = [];
    arenaCanvas = buildDungeonCanvas(branch.id, level);
    updateCamera();
  }

  function travelTo(index, descending) {
    enterLevel(index, descending);
    pushLog("You " + (descending ? "descend into " : "ascend to ") + state.branch.name + " (" + state.branch.label + ")!", state.branch.accent);
    sound.descend();
  }

  function startRun() {
    state.scene = "game";
    state.paused = false;
    state.score = 0;
    state.gameOver = false;
    state.elapsed = 0;
    state.runSeed = Math.floor(Math.random() * 0x100000000);
    state.levels = [];
    state.spawnCooldown = INITIAL_SPAWN_DELAY;
    state.bulletCooldown = 0;
    state.bulletSweep = 0;
    state.player = createPlayer();
    enterLevel(0, true);
    state.combatLog = [];
    state.shakeTimer = 0;
    state.hurtFlash = 0;
    initAmbientClouds();
    pushLog("Welcome, Deep Elf Annihilator! You enter D:1.", "#facc15");
    pushLog("Damnation bolts auto-target the nearest visible monster.", "#94a3b8");
    syncUI();
    canvas.focus();
  }

  function finishRun(killerName) {
    state.lastScore = state.score;
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      saveBestScore(state.bestScore);
    }
    pushLog("You die... slain by " + (killerName || "the swarm") + ".", "#ef4444");
    state.gameOver = true;
    state.scene = "menu";
    state.paused = false;
    state.menuLockTimer = 0.55; // prevent accidental instant restart from held movement key
    sound.gameOver();
    syncUI();
  }

  function syncUI() {
    if (state.scene === "menu") {
      startBtn.classList.remove("hidden");
      startBtn.textContent = state.gameOver ? "Descend Again" : "Enter Dungeon";
      pauseBtn.disabled = true;
      pauseBtn.textContent = "Pause";
    } else {
      startBtn.classList.add("hidden");
      pauseBtn.disabled = false;
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    }
    muteBtn.textContent = sound.muted ? "Sound: Off" : "Sound: On";
  }

  // --- Input Handling (Keyboard + Numpad + Mouse-follow + Touch + Gamepad) ---
  const keys = Object.create(null);
  const pointerTarget = {
    active: false,
    mode: null, // "mouse" | "touch"
    id: null,
    canvasX: VIEW_WIDTH / 2,
    canvasY: VIEW_HEIGHT / 2
  };
  const gamepadState = {
    prevStart: false,
    prevA: false,
    prevBack: false,
    prevB: false
  };

  function isMovementKey(code) {
    return (
      code === "KeyW" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD" ||
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      code === "Numpad8" ||
      code === "Numpad2" ||
      code === "Numpad4" ||
      code === "Numpad6" ||
      code === "Numpad7" ||
      code === "Numpad9" ||
      code === "Numpad1" ||
      code === "Numpad3"
    );
  }

  function updatePointerCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointerTarget.canvasX = clamp(((e.clientX - rect.left) / rect.width) * VIEW_WIDTH, 0, VIEW_WIDTH);
    pointerTarget.canvasY = clamp(((e.clientY - rect.top) / rect.height) * VIEW_HEIGHT, 0, VIEW_HEIGHT);
  }

  window.addEventListener("keydown", function (e) {
    if (isMovementKey(e.code) || e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
    }

    keys[e.code] = true;
    if (isMovementKey(e.code)) {
      pointerTarget.active = false;
    }

    if (state.scene === "menu") {
      if (state.menuLockTimer <= 0) {
        if (e.code === "Enter" || e.code === "Space" || isMovementKey(e.code)) {
          startRun();
        }
      }
      return;
    }

    if (e.code === "KeyP" || e.code === "Escape") {
      state.paused = !state.paused;
      syncUI();
    } else if (e.code === "KeyR") {
      startRun();
    } else if (e.code === "KeyM") {
      sound.muted = !sound.muted;
      syncUI();
    }
  });

  window.addEventListener("keyup", function (e) {
    keys[e.code] = false;
  });

  window.addEventListener("blur", function () {
    for (const k in keys) {
      keys[k] = false;
    }
    pointerTarget.active = false;
    pointerTarget.id = null;
  });

  // Mouse-follow & Touch-to-move on canvas
  canvas.addEventListener("pointerdown", function (e) {
    canvas.focus();
    updatePointerCanvasCoords(e);
    if (state.scene === "menu") {
      if (state.menuLockTimer <= 0) {
        startRun();
      }
      return;
    }
    pointerTarget.active = true;
    pointerTarget.mode = e.pointerType === "mouse" ? "mouse" : "touch";
    pointerTarget.id = e.pointerId;
    if (pointerTarget.mode === "touch" && canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_e) {}
    }
  });

  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerType === "mouse") {
      updatePointerCanvasCoords(e);
      if (state.scene === "game") {
        pointerTarget.active = true;
        pointerTarget.mode = "mouse";
        pointerTarget.id = e.pointerId;
      }
      return;
    }
    if (pointerTarget.active && pointerTarget.mode === "touch" && e.pointerId === pointerTarget.id) {
      updatePointerCanvasCoords(e);
    }
  });

  canvas.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse" && pointerTarget.mode === "mouse") {
      pointerTarget.active = false;
    }
  });

  function endTouchPointer(e) {
    if (pointerTarget.mode === "touch" && e.pointerId === pointerTarget.id) {
      pointerTarget.active = false;
      pointerTarget.id = null;
    }
  }

  canvas.addEventListener("pointerup", endTouchPointer);
  canvas.addEventListener("pointercancel", endTouchPointer);

  startBtn.addEventListener("click", function () {
    startRun();
  });

  pauseBtn.addEventListener("click", function () {
    if (state.scene !== "game") return;
    state.paused = !state.paused;
    syncUI();
    canvas.focus();
  });

  restartBtn.addEventListener("click", function () {
    startRun();
  });

  muteBtn.addEventListener("click", function () {
    sound.muted = !sound.muted;
    syncUI();
    canvas.focus();
  });

  function readGamepad() {
    const out = { x: 0, y: 0, startPressed: false, aPressed: false, backPressed: false };
    if (!navigator.getGamepads) return out;
    const pads = navigator.getGamepads();
    if (!pads) return out;

    let pad = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) {
        pad = pads[i];
        break;
      }
    }
    if (!pad) return out;

    const deadzone = 0.18;
    let gx = pad.axes && pad.axes.length > 0 ? pad.axes[0] : 0;
    let gy = pad.axes && pad.axes.length > 1 ? pad.axes[1] : 0;
    if (Math.hypot(gx, gy) < deadzone) {
      gx = 0;
      gy = 0;
    }

    const btns = pad.buttons || [];
    const btnDown = function (idx) {
      return !!(btns[idx] && (btns[idx].pressed || btns[idx].value > 0.5));
    };
    if (btnDown(12)) gy -= 1; // D-pad Up
    if (btnDown(13)) gy += 1; // D-pad Down
    if (btnDown(14)) gx -= 1; // D-pad Left
    if (btnDown(15)) gx += 1; // D-pad Right

    const aNow = btnDown(0);
    const startNow = btnDown(9);
    const backNow = btnDown(8);

    out.aPressed = aNow && !gamepadState.prevA;
    out.startPressed = startNow && !gamepadState.prevStart;
    out.backPressed = backNow && !gamepadState.prevBack;

    gamepadState.prevA = aNow;
    gamepadState.prevStart = startNow;
    gamepadState.prevBack = backNow;

    const v = movementVector(gx, gy);
    out.x = v.x;
    out.y = v.y;
    return out;
  }

  function pollGamepadActions(gp) {
    if (state.scene === "menu") {
      if (state.menuLockTimer <= 0 && (gp.aPressed || gp.startPressed || Math.hypot(gp.x, gp.y) > 0.35)) {
        startRun();
      }
      return;
    }
    if (gp.startPressed) {
      state.paused = !state.paused;
      syncUI();
    } else if (gp.backPressed) {
      startRun();
    }
  }

  function readMovementInput(gp) {
    let hori = 0;
    let vert = 0;
    if (keys.KeyA || keys.ArrowLeft || keys.Numpad4 || keys.Numpad7 || keys.Numpad1) hori -= 1;
    if (keys.KeyD || keys.ArrowRight || keys.Numpad6 || keys.Numpad9 || keys.Numpad3) hori += 1;
    if (keys.KeyW || keys.ArrowUp || keys.Numpad8 || keys.Numpad7 || keys.Numpad9) vert -= 1;
    if (keys.KeyS || keys.ArrowDown || keys.Numpad2 || keys.Numpad1 || keys.Numpad3) vert += 1;

    if (hori !== 0 || vert !== 0) {
      return movementVector(hori, vert);
    }

    if (gp && (gp.x !== 0 || gp.y !== 0)) {
      pointerTarget.active = false;
      return { x: gp.x, y: gp.y };
    }

    if (pointerTarget.active && state.player) {
      const pc = centerOf(state.player);
      const targetX = state.camera.x + pointerTarget.canvasX;
      const targetY = state.camera.y + pointerTarget.canvasY;
      const dx = targetX - pc.x;
      const dy = targetY - pc.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 8) {
        return { x: 0, y: 0 };
      }
      const speedScale = dist < 28 ? dist / 28 : 1;
      return {
        x: (dx / dist) * speedScale,
        y: (dy / dist) * speedScale
      };
    }

    return { x: 0, y: 0 };
  }

  // --- Spawning Systems ---
  function spawnPosition() {
    const pc = centerOf(state.player);
    const halfWidth = VIEW_WIDTH / 2 + 84;
    const halfHeight = VIEW_HEIGHT / 2 + 84;

    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        return { x: pc.x - halfWidth, y: pc.y - halfHeight + Math.random() * halfHeight * 2 };
      case 1:
        return { x: pc.x + halfWidth, y: pc.y - halfHeight + Math.random() * halfHeight * 2 };
      case 2:
        return { x: pc.x - halfWidth + Math.random() * halfWidth * 2, y: pc.y - halfHeight };
      default:
        return { x: pc.x - halfWidth + Math.random() * halfWidth * 2, y: pc.y + halfHeight };
    }
  }

  function pickMonsterArchetype() {
    const roll = Math.random();
    let pool = MONSTER_TIERS.dungeon;
    if (state.branch.id === "zot") {
      if (roll < 0.65) pool = MONSTER_TIERS.zot;
      else if (roll < 0.88) pool = MONSTER_TIERS.crypt;
      else pool = MONSTER_TIERS.dungeon;
    } else if (state.branch.id === "crypt") {
      if (roll < 0.65) pool = MONSTER_TIERS.crypt;
      else if (roll < 0.8) pool = MONSTER_TIERS.zot;
      else pool = MONSTER_TIERS.dungeon;
    } else {
      if (roll < 0.8) pool = MONSTER_TIERS.dungeon;
      else pool = MONSTER_TIERS.crypt;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawnEnemy() {
    const edge = spawnPosition();
    const pc = centerOf(state.player);
    let pos = null, nearest = Infinity, farthest = -1, fallback = null;
    for (const cell of state.level.cells) {
      const range = Math.hypot(cell.x - pc.x, cell.y - pc.y);
      const offset = Math.hypot(cell.x - edge.x, cell.y - edge.y);
      if (range > farthest) {
        fallback = cell;
        farthest = range;
      }
      if (range >= VIEW_WIDTH / 2 && offset < nearest) {
        pos = cell;
        nearest = offset;
      }
    }
    pos ||= fallback;
    const arch = pickMonsterArchetype();
    state.enemies.push({
      id: arch.id,
      name: arch.name,
      tile: arch.tile,
      burst: arch.burst,
      speed: ENEMY_SPEED * arch.speedMul,
      x: pos.x - TILE_SIZE / 2,
      y: pos.y - TILE_SIZE / 2,
      width: 64,
      height: 64,
      bobPhase: Math.random() * Math.PI * 2,
      facingX: 1
    });
  }

  function nearestEnemyDirection(fromX, fromY) {
    let bestDistSq = Infinity;
    let bestX = 0;
    let bestY = 0;
    let found = false;

    for (let i = 0; i < state.enemies.length; i++) {
      const ec = centerOf(state.enemies[i]);
      const dx = ec.x - fromX;
      const dy = ec.y - fromY;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq && state.level.clearPath({ x: fromX, y: fromY }, ec, 0)) {
        bestDistSq = distSq;
        bestX = ec.x;
        bestY = ec.y;
        found = true;
      }
    }

    if (!found) return null;
    return directionBetween(fromX, fromY, bestX, bestY);
  }

  function spawnBullet() {
    const pc = centerOf(state.player);
    let dir = nearestEnemyDirection(pc.x, pc.y);
    if (!dir) {
      dir = CARDINAL_DIRS[state.bulletSweep % CARDINAL_DIRS.length];
      state.bulletSweep += 1;
    }

    const w = 36;
    const h = 36;
    state.bullets.push({
      x: pc.x - w / 2,
      y: pc.y - h / 2,
      width: w,
      height: h,
      dx: dir.x,
      dy: dir.y,
      rotation: Math.atan2(dir.y, dir.x),
      age: 0,
      maxAge: BULLET_MAX_LIFETIME
    });
    sound.shoot();
  }

  function spawnBloodDecal(cx, cy) {
    const bloodKeys = ["blood_0", "blood_1", "blood_2", "blood_3"];
    state.decals.push({
      x: clamp(cx - 24, WALL_MARGIN, state.level.width - WALL_MARGIN - 48),
      y: clamp(cy - 24, WALL_MARGIN, state.level.height - WALL_MARGIN - 48),
      size: 48,
      tile: bloodKeys[Math.floor(Math.random() * bloodKeys.length)],
      alpha: 0.72
    });
    if (state.decals.length > 120) {
      state.decals.shift();
    }
  }

  function spawnSpellCloud(cx, cy, kind) {
    state.spellClouds.push({
      x: cx,
      y: cy,
      kind: kind || "fire",
      life: 0,
      maxLife: 0.34,
      size: 56
    });
  }

  function spawnBurst(cx, cy, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 70 + Math.random() * 190;
      state.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.22 + Math.random() * 0.24,
        size: 4 + Math.random() * 4,
        color: color
      });
    }
  }

  // --- Collision Detection ---
  function aabbOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function entityHitsEnemy(ent, enemy, inset) {
    const shrink = inset || 0;
    const box = {
      x: ent.x + shrink,
      y: ent.y + shrink,
      width: Math.max(4, ent.width - shrink * 2),
      height: Math.max(4, ent.height - shrink * 2)
    };
    if (!aabbOverlap(box, enemy)) return false;

    const c1 = centerOf(box);
    const c2 = centerOf(enemy);
    const r1 = Math.min(box.width, box.height) * 0.44;
    const r2 = Math.min(enemy.width, enemy.height) * 0.4;
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  }

  // --- Simulation Step ---
  function update(dt) {
    state.animTime += dt;

    // Poll Gamepad API (works in both menu and gameplay)
    const gp = readGamepad();
    pollGamepadActions(gp);

    // Drift ambient dungeon clouds
    const worldWidth = state.level ? state.level.width : MENU_GRID_SIZE * TILE_SIZE;
    for (let i = 0; i < state.ambientClouds.length; i++) {
      const c = state.ambientClouds[i];
      c.x += c.vx * dt;
      if (c.x > worldWidth + 96) c.x = -96;
      if (c.x < -96) c.x = worldWidth + 96;
    }

    if (state.scene === "menu") {
      if (state.menuLockTimer > 0) {
        state.menuLockTimer = Math.max(0, state.menuLockTimer - dt);
      }
      return;
    }

    if (state.paused) return;

    const previousElapsed = state.elapsed;
    state.elapsed += dt;
    if (state.shakeTimer > 0) state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    if (state.hurtFlash > 0) state.hurtFlash = Math.max(0, state.hurtFlash - dt);

    // Branch progression check
    const nextBranch = currentBranchForTime(state.elapsed);
    if (previousElapsed < nextBranch.minTime && state.branch.minTime < nextBranch.minTime) {
      travelTo(BRANCHES.indexOf(nextBranch), true);
    }

    // 1. ControlSystem: move player (keyboard / numpad / gamepad / mouse-follow / touch) & clamp inside walls
    const move = readMovementInput(gp);
    state.level.move(state.player, move.x * PLAYER_SPEED * dt, move.y * PLAYER_SPEED * dt);
    if (move.x < -0.05) state.player.facingX = -1;
    if (move.x > 0.05) state.player.facingX = 1;
    if (Math.hypot(move.x, move.y) > 0.05) {
      state.player.walkPhase += dt * 14;
    }

    const index = BRANCHES.indexOf(state.branch);
    const stair = state.level.stairAt(centerOf(state.player), index, BRANCHES.length - 1);
    if (stair && !state.onStairs) {
      travelTo(index + stair, stair > 0);
    } else {
      state.onStairs = stair !== 0;
    }
    updateCamera();

    // 2. RockSpawnSystem: time-ramped DCSS monster spawning
    state.spawnCooldown -= dt;
    if (state.spawnCooldown <= 0) {
      spawnEnemy();
      const jitter = 0.85 + Math.random() * 0.3;
      state.spawnCooldown = enemySpawnInterval(state.elapsed) * jitter;
    }

    // 3. ChasingSystem: move monsters toward player; despawn far monsters
    const pc = centerOf(state.player);
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const ec = centerOf(e);
      const target = state.level.chaseTarget(ec, pc, e.width / 4);
      const dir = directionBetween(ec.x, ec.y, target.x, target.y);
      const step = Math.min(e.speed * dt, Math.hypot(target.x - ec.x, target.y - ec.y));
      state.level.move(e, dir.x * step, dir.y * step);
      e.bobPhase += dt * 6;
      if (dir.x < -0.05) e.facingX = -1;
      if (dir.x > 0.05) e.facingX = 1;

      const dist = Math.hypot(ec.x - pc.x, ec.y - pc.y);
      if (dist > VIEW_WIDTH * 2) {
        state.enemies.splice(i, 1);
      }
    }

    // 4. BulletSpawnSystem: auto-fire Damnation toward nearest monster
    state.bulletCooldown -= dt;
    if (state.bulletCooldown <= 0) {
      state.bulletCooldown = BULLET_COOLDOWN;
      spawnBullet();
    }

    // 5. BulletSystem: move bolts & expire by lifetime
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      const from = centerOf(b);
      b.x += b.dx * BULLET_SPEED * dt;
      b.y += b.dy * BULLET_SPEED * dt;
      b.age += dt;
      if (b.age > b.maxAge || !state.level.clearPath(from, centerOf(b), 0)) {
        state.bullets.splice(i, 1);
      }
    }

    // 6. CollisionSystem + DeathSystem
    // 6a. Bolt vs Monster
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      let hit = false;
      for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
        const e = state.enemies[ei];
        if (entityHitsEnemy(b, e, 4)) {
          const ec = centerOf(e);
          spawnBloodDecal(ec.x, ec.y);
          spawnSpellCloud(ec.x, ec.y, "fire");
          spawnBurst(ec.x, ec.y, e.burst || "#f97316", 8);
          state.enemies.splice(ei, 1);
          state.bullets.splice(bi, 1);
          state.score += 1;
          if (state.score <= 3 || state.score % 10 === 0) {
            pushLog("You blast the " + e.name + "! (" + state.score + " slain)", "#fde047");
          }
          sound.kill();
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // 6b. Monster vs Player
    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      if (entityHitsEnemy(state.player, e, 10)) {
        const ec = centerOf(e);
        spawnSpellCloud(ec.x, ec.y, "cold");
        spawnBurst(ec.x, ec.y, "#ef4444", 12);
        const attackerName = e.name;
        state.enemies.splice(ei, 1);
        state.player.hp = Math.max(0, state.player.hp - 1);
        state.hurtFlash = 0.25;
        state.shakeTimer = 0.2;
        if (state.player.hp <= 0) {
          finishRun("a " + attackerName);
          return;
        } else {
          pushLog("The " + attackerName + " hits you! (" + state.player.hp + "/" + state.player.maxHp + " HP)", "#f87171");
          sound.hurt();
        }
      }
    }

    // 7. Particles & transient spell clouds
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life += dt;
      if (p.life >= p.maxLife) {
        state.particles.splice(i, 1);
      }
    }

    for (let i = state.spellClouds.length - 1; i >= 0; i--) {
      const sc = state.spellClouds[i];
      sc.life += dt;
      if (sc.life >= sc.maxLife) {
        state.spellClouds.splice(i, 1);
      }
    }
  }

  // --- Rendering ---
  function drawLavaBraziers() {
    const lavaFrames = [assets.lava_0, assets.lava_1, assets.lava_2, assets.lava_3];
    const frameIdx = Math.floor(state.animTime * 4);
    for (let i = 0; i < LAVA_TILES.length; i++) {
      const t = LAVA_TILES[i];
      const img = lavaFrames[(frameIdx + i) % lavaFrames.length];
      const dx = t.gx * TILE_SIZE;
      const dy = t.gy * TILE_SIZE;
      const point = { x: dx + TILE_SIZE / 2, y: dy + TILE_SIZE / 2 };
      if (state.level.terrain(point.x, point.y) !== "." ||
          state.level.stairAt(point, BRANCHES.indexOf(state.branch), BRANCHES.length - 1)) continue;
      if (img) {
        ctx.drawImage(img, dx, dy, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(dx, dy, TILE_SIZE, TILE_SIZE);
      }
      ctx.strokeStyle = "rgba(251, 146, 60, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  function drawEnemy(e) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    const bob = Math.sin(e.bobPhase) * 2.5;

    ctx.save();
    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.beginPath();
    ctx.ellipse(cx, e.y + e.height - 6, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, cy + bob);
    if (e.facingX < 0) {
      ctx.scale(-1, 1);
    }
    const img = assets[e.tile];
    if (img) {
      ctx.drawImage(img, -e.width / 2, -e.height / 2, e.width, e.height);
    } else {
      ctx.fillStyle = e.burst || "#ea580c";
      ctx.fillRect(-e.width / 2, -e.height / 2, e.width, e.height);
    }
    ctx.restore();
  }

  function drawBullet(b) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    // Fiery DCSS damnation aura
    ctx.fillStyle = "rgba(251, 146, 60, 0.28)";
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(b.rotation);
    if (assets.bullet) {
      ctx.drawImage(assets.bullet, -b.width / 2, -b.height / 2, b.width, b.height);
    } else {
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    const bob = Math.sin(p.walkPhase) * 2;

    ctx.save();
    // Subtle arcane ring under Deep Elf Annihilator
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.height - 5, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.height - 6, 26, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.translate(cx, cy + bob);
    if (p.facingX < 0) {
      ctx.scale(-1, 1);
    }
    if (assets.player) {
      ctx.drawImage(assets.player, -p.width / 2, -p.height / 2, p.width, p.height);
    } else {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    }
    ctx.restore();
  }

  function drawSpellClouds() {
    const fireFrames = [assets.cloud_fire_0, assets.cloud_fire_1, assets.cloud_fire_2];
    const coldFrames = [assets.cloud_cold_0, assets.cloud_cold_1];
    const poisonFrames = [assets.cloud_poison_0, assets.cloud_poison_1];

    // Transient death/impact clouds
    for (let i = 0; i < state.spellClouds.length; i++) {
      const sc = state.spellClouds[i];
      const progress = sc.life / sc.maxLife;
      const frames = sc.kind === "cold" ? coldFrames : fireFrames;
      const img = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
      if (!img) continue;
      ctx.save();
      ctx.globalAlpha = clamp(1 - progress, 0, 1) * 0.85;
      const sz = sc.size * (0.85 + progress * 0.45);
      ctx.drawImage(img, sc.x - sz / 2, sc.y - sz / 2, sz, sz);
      ctx.restore();
    }

    // Ambient drifting DCSS clouds
    const fIdx = Math.floor(state.animTime * 3);
    for (let i = 0; i < state.ambientClouds.length; i++) {
      const c = state.ambientClouds[i];
      const frames = c.kind === "fire" ? fireFrames : c.kind === "cold" ? coldFrames : poisonFrames;
      const img = frames[(fIdx + i) % frames.length];
      if (!img) continue;
      const sz = TILE_SIZE * c.scale;
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(img, c.x - sz / 2, c.y - sz / 2, sz, sz);
      ctx.restore();
    }
  }

  function drawHUD() {
    const p = state.player;
    const frac = healthFraction(p.hp, p.maxHp);

    // Top proportional DCSS/DCBH HP bar
    const barX = 14;
    const barY = 14;
    const barMaxW = VIEW_WIDTH - 28;
    const barH = 38;

    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 15, 0.84)";
    ctx.fillRect(barX, barY, barMaxW, barH);

    // Iconic DCSS-inspired HP bar (green -> yellow -> red/orange)
    ctx.fillStyle = frac <= 0.3 ? "#dc2626" : frac <= 0.6 ? "#facc15" : "#4ade80";
    ctx.fillRect(barX, barY, barMaxW * frac, barH);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#d4af37";
    ctx.strokeRect(barX, barY, barMaxW, barH);

    ctx.font = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.fillStyle = frac > 0.16 ? "#0c0d12" : "#ffffff";
    ctx.fillText("HP " + p.hp + "/" + p.maxHp, barX + 14, barY + barH / 2 + 1);

    // Branch badge on right side of HP bar
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(state.branch.label + " — " + state.branch.name, barX + barMaxW - 14, barY + barH / 2 + 1);
    ctx.textAlign = "left";

    // Bottom-left DCSS character & score panel
    const boxW = 300;
    const boxH = 114;
    const boxX = 16;
    const boxY = VIEW_HEIGHT - boxH - 16;

    ctx.fillStyle = "rgba(10, 10, 16, 0.86)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "#7c6a38";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    if (assets.player) {
      ctx.drawImage(assets.player, boxX + 12, boxY + 24, 64, 64);
    }
    if (assets.icon_flame) {
      ctx.drawImage(assets.icon_flame, boxX + 258, boxY + 14, 28, 28);
    }
    if (assets.icon_hasted) {
      ctx.drawImage(assets.icon_hasted, boxX + 258, boxY + 46, 28, 28);
    }

    ctx.textBaseline = "top";
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 26px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(state.score + " slain", boxX + 86, boxY + 14);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("DEAn • " + state.branch.label, boxX + 86, boxY + 48);

    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    const timeStr = mins + ":" + (secs < 10 ? "0" + secs : secs);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Time " + timeStr + " • Best " + Math.max(state.bestScore, state.score), boxX + 86, boxY + 78);

    // Bottom-right DCSS combat message log
    const logW = 540;
    const logH = 114;
    const logX = VIEW_WIDTH - logW - 16;
    const logY = VIEW_HEIGHT - logH - 16;

    ctx.fillStyle = "rgba(10, 10, 16, 0.84)";
    ctx.fillRect(logX, logY, logW, logH);
    ctx.strokeStyle = "#4b4536";
    ctx.lineWidth = 2;
    ctx.strokeRect(logX, logY, logW, logH);

    ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let i = 0; i < state.combatLog.length; i++) {
      const entry = state.combatLog[i];
      ctx.fillStyle = entry.color;
      ctx.fillText(entry.text, logX + 14, logY + 14 + i * 23);
    }
    ctx.restore();
  }

  function drawMenu() {
    ctx.save();
    ctx.fillStyle = "#08080d";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Dimmed authentic DCSS dungeon backdrop
    const preview = menuCanvas;
    if (preview) {
      ctx.globalAlpha = 0.34;
      ctx.drawImage(preview, 288, 288, VIEW_WIDTH, VIEW_HEIGHT, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.globalAlpha = 1;
    }

    // Vignette
    const grad = ctx.createRadialGradient(
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      140,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH * 0.65
    );
    grad.addColorStop(0, "rgba(8, 8, 14, 0.25)");
    grad.addColorStop(1, "rgba(4, 4, 8, 0.94)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // DCSS Monster Lineup Showcase
    ctx.imageSmoothingEnabled = false;
    const showcase = [
      { img: assets.mons_ancient_lich, x: VIEW_WIDTH / 2 - 330, y: 266, s: 76 },
      { img: assets.mons_hydra, x: VIEW_WIDTH / 2 - 235, y: 274, s: 72 },
      { img: assets.starspawn, x: VIEW_WIDTH / 2 - 145, y: 270, s: 76 },
      { img: assets.player, x: VIEW_WIDTH / 2 - 48, y: 248, s: 96 },
      { img: assets.mons_brimstone, x: VIEW_WIDTH / 2 + 70, y: 270, s: 76 },
      { img: assets.mons_executioner, x: VIEW_WIDTH / 2 + 162, y: 274, s: 72 },
      { img: assets.mons_balrug, x: VIEW_WIDTH / 2 + 252, y: 266, s: 76 }
    ];
    for (let i = 0; i < showcase.length; i++) {
      const item = showcase[i];
      if (item.img) {
        ctx.drawImage(item.img, item.x, item.y, item.s, item.s);
      }
    }
    if (assets.bullet) {
      ctx.drawImage(assets.bullet, VIEW_WIDTH / 2 - 84, 294, 34, 34);
      ctx.drawImage(assets.bullet, VIEW_WIDTH / 2 + 48, 294, 34, 34);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 54px Georgia, 'Times New Roman', serif";
    ctx.fillText("Dungeon Crawl Bullet Hell", VIEW_WIDTH / 2, 165);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "23px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Deep Elf Annihilator vs. the Dungeon, Crypt, and Realm of Zot.", VIEW_WIDTH / 2, 398);

    if (state.gameOver) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 36px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("YOU DIE...", VIEW_WIDTH / 2, 480);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Last run: " + state.lastScore + " slain (" + state.branch.label + ")", VIEW_WIDTH / 2, 540);

      ctx.fillStyle = "#facc15";
      ctx.font = "bold 30px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Best run: " + state.bestScore + " slain", VIEW_WIDTH / 2, 590);
    } else if (state.bestScore > 0) {
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 28px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Best run: " + state.bestScore + " slain", VIEW_WIDTH / 2, 510);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Press Enter, Space, or move to descend.", VIEW_WIDTH / 2, 708);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "19px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Mouse, Touch, WASD / Arrows / Numpad, or Gamepad • 10 HP", VIEW_WIDTH / 2, 758);

    if (!assetsReady) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "18px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Loading DCSS dungeon tiles...", VIEW_WIDTH / 2, 810);
    }

    ctx.restore();
  }

  function render() {
    ctx.imageSmoothingEnabled = false;

    if (state.scene === "menu") {
      drawMenu();
      return;
    }

    ctx.save();
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Subtle screen shake on damage
    let shakeX = 0;
    let shakeY = 0;
    if (state.shakeTimer > 0) {
      const mag = (state.shakeTimer / 0.2) * 10;
      shakeX = (Math.random() - 0.5) * mag * 2;
      shakeY = (Math.random() - 0.5) * mag * 2;
    }

    ctx.save();
    ctx.translate(-Math.round(state.camera.x) + shakeX, -Math.round(state.camera.y) + shakeY);

    // Layer 0: DCSS branch dungeon floor + stone walls
    const floorCanvas = arenaCanvas;
    if (floorCanvas) {
      ctx.drawImage(floorCanvas, 0, 0);
    } else {
      ctx.fillStyle = "#18181f";
      ctx.fillRect(0, 0, state.level.width, state.level.height);
    }

    // Animated DCSS lava braziers
    drawLavaBraziers();

    // Persistent DCSS blood splatters on the dungeon floor
    for (let i = 0; i < state.decals.length; i++) {
      const d = state.decals[i];
      const img = assets[d.tile];
      if (!img) continue;
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.drawImage(img, d.x, d.y, d.size, d.size);
      ctx.restore();
    }

    // Layer 1: Player (Deep Elf Annihilator)
    drawPlayer();

    // Subtle DCSS target reticle when steering via mouse or touch
    if (pointerTarget.active) {
      const tx = state.camera.x + pointerTarget.canvasX;
      const ty = state.camera.y + pointerTarget.canvasY;
      ctx.save();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx - 16, ty);
      ctx.lineTo(tx - 6, ty);
      ctx.moveTo(tx + 6, ty);
      ctx.lineTo(tx + 16, ty);
      ctx.moveTo(tx, ty - 16);
      ctx.lineTo(tx, ty - 6);
      ctx.moveTo(tx, ty + 6);
      ctx.lineTo(tx, ty + 16);
      ctx.stroke();
      ctx.restore();
    }

    // Layer 2: DCSS Monster swarm
    for (let i = 0; i < state.enemies.length; i++) {
      drawEnemy(state.enemies[i]);
    }

    // Layer 3: Damnation bolts
    for (let i = 0; i < state.bullets.length; i++) {
      drawBullet(state.bullets[i]);
    }

    // Layer 4: DCSS spell clouds & hit particles
    drawSpellClouds();
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // end world camera transform

    // Subtle dungeon torchlight vignette
    const torch = ctx.createRadialGradient(
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH * 0.28,
      VIEW_WIDTH / 2,
      VIEW_HEIGHT / 2,
      VIEW_WIDTH * 0.68
    );
    torch.addColorStop(0, "rgba(0, 0, 0, 0)");
    torch.addColorStop(1, "rgba(0, 0, 0, 0.36)");
    ctx.fillStyle = torch;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Damage vignette flash
    if (state.hurtFlash > 0) {
      ctx.fillStyle = "rgba(220, 38, 38, " + (state.hurtFlash * 1.1).toFixed(3) + ")";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }

    // Layer 5: DCSS HUD & combat log
    drawHUD();

    // Pause overlay
    if (state.paused) {
      ctx.fillStyle = "rgba(8, 8, 14, 0.72)";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 56px Georgia, 'Times New Roman', serif";
      ctx.fillText("PAUSED", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "22px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Press P or Esc to resume", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 40);
    }

    ctx.restore();
  }

  // --- Main Loop ---
  let lastTime = performance.now();

  function frame(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(0.05, Math.max(0, rawDt));

    update(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  initAmbientClouds();
  loadAllAssets();
  syncUI();
  window.requestAnimationFrame(frame);
})();
