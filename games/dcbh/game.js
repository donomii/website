(function () {
  "use strict";

  // Core constants faithfully ported from DCBH (gameplay.go, falling.go, System*.go)
  const VIEW_WIDTH = 1024;
  const VIEW_HEIGHT = 1024;

  const PLAYER_MAX_HP = 10;
  const PLAYER_SPEED = 400; // px/s
  const ENEMY_SPEED = 80; // px/s
  const BULLET_SPEED = 620; // px/s

  const BULLET_COOLDOWN = 0.18; // s
  const BULLET_MAX_LIFETIME = 2.4; // s
  const INITIAL_SPAWN_DELAY = 0.25; // s
  const INITIAL_SPAWN_INTERVAL = 1.0; // s
  const MIN_SPAWN_INTERVAL = 0.28; // s
  const SPAWN_RAMP_PER_SEC = 0.012;

  const STORAGE_BEST_KEY = "dcbh_best_kills_v1";

  const CARDINAL_DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  // Octagon polygon from SystemRockSpawn.go for rock2.png (16x16 scaled 4x -> 64x64)
  const ROCK_POLY_BASE = [
    { x: 4, y: 0 },
    { x: 12, y: 0 },
    { x: 16, y: 4 },
    { x: 16, y: 13 },
    { x: 13, y: 13 },
    { x: 13, y: 16 },
    { x: 3, y: 16 },
    { x: 3, y: 13 },
    { x: 0, y: 13 },
    { x: 0, y: 4 }
  ];

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const muteBtn = document.getElementById("mute-btn");

  const mapData = window.DCBH_MAP_DATA;
  const worldWidth = mapData ? mapData.width * mapData.tileWidth : 1600;
  const worldHeight = mapData ? mapData.height * mapData.tileHeight : 1600;

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
    gameOver() {
      this.tone(220, 55, 0.42, "sawtooth", 0.1);
    }
  };

  // --- Asset Loader ---
  const ASSET_FILES = {
    player: "assets/deep_elf_annihilator.png",
    bullet: "assets/damnation.png",
    rock: "assets/rock2.png",
    starspawn: "assets/tentacled_starspawn.png",
    grass: "assets/grass-tiles-2-small.png",
    trees: "assets/tree2-final.png",
    cloud: "assets/cloud.png"
  };

  const assets = {};
  let assetsReady = false;
  let grassCanvas = null;
  let treesCanvas = null;

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
          buildStaticTileLayers();
        }
      };
      img.onerror = function () {
        remaining -= 1;
        if (remaining === 0) {
          assetsReady = true;
          buildStaticTileLayers();
        }
      };
      img.src = ASSET_FILES[key];
    });
  }

  function findTilesetForGid(gid) {
    if (!mapData || !mapData.tilesets) return null;
    let chosen = null;
    for (let i = 0; i < mapData.tilesets.length; i++) {
      const ts = mapData.tilesets[i];
      if (gid >= ts.firstgid) {
        chosen = ts;
      }
    }
    return chosen;
  }

  function tilesetImage(ts) {
    if (!ts) return null;
    if (ts.image.indexOf("grass") !== -1) return assets.grass || null;
    if (ts.image.indexOf("tree") !== -1) return assets.trees || null;
    return null;
  }

  function prerenderTileLayer(layerName) {
    if (!mapData || !mapData.layers || !mapData.layers[layerName]) return null;
    const off = document.createElement("canvas");
    off.width = worldWidth;
    off.height = worldHeight;
    const octx = off.getContext("2d");
    octx.imageSmoothingEnabled = false;

    const gids = mapData.layers[layerName];
    const cols = mapData.width;
    const tw = mapData.tileWidth;
    const th = mapData.tileHeight;

    for (let idx = 0; idx < gids.length; idx++) {
      const rawGid = gids[idx];
      // Clear TMX flip flags in upper 3 bits if any
      const gid = rawGid & 0x1fffffff;
      if (gid === 0) continue;

      const ts = findTilesetForGid(gid);
      const img = tilesetImage(ts);
      if (!ts || !img) continue;

      const localId = gid - ts.firstgid;
      const sx = (localId % ts.columns) * ts.tileWidth;
      const sy = Math.floor(localId / ts.columns) * ts.tileHeight;
      const dx = (idx % cols) * tw;
      const dy = Math.floor(idx / cols) * th;

      octx.drawImage(img, sx, sy, ts.tileWidth, ts.tileHeight, dx, dy, tw, th);
    }

    return off;
  }

  function buildStaticTileLayers() {
    grassCanvas = prerenderTileLayer("grass");
    treesCanvas = prerenderTileLayer("trees");
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
    spawnCooldown: INITIAL_SPAWN_DELAY,
    bulletCooldown: 0,
    bulletSweep: 0,

    player: null,
    enemies: [],
    bullets: [],
    particles: [],
    camera: { x: 0, y: 0 },
    shakeTimer: 0,
    hurtFlash: 0,
    cloudOffset: 0
  };

  function createPlayer() {
    const width = 64; // 32 * 2x scale
    const height = 64;
    return {
      x: 500,
      y: 500,
      width: width,
      height: height,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      facingX: 1,
      invulnVisual: 0
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
    const maxCamX = Math.max(0, worldWidth - VIEW_WIDTH);
    const maxCamY = Math.max(0, worldHeight - VIEW_HEIGHT);
    state.camera.x = clamp(pc.x - VIEW_WIDTH / 2, 0, maxCamX);
    state.camera.y = clamp(pc.y - VIEW_HEIGHT / 2, 0, maxCamY);
  }

  function startRun() {
    state.scene = "game";
    state.paused = false;
    state.score = 0;
    state.gameOver = false;
    state.elapsed = 0;
    state.spawnCooldown = INITIAL_SPAWN_DELAY;
    state.bulletCooldown = 0;
    state.bulletSweep = 0;
    state.player = createPlayer();
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.shakeTimer = 0;
    state.hurtFlash = 0;
    updateCamera();
    syncUI();
    canvas.focus();
  }

  function finishRun() {
    state.lastScore = state.score;
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      saveBestScore(state.bestScore);
    }
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
      startBtn.textContent = state.gameOver ? "Play Again" : "Start Run";
      pauseBtn.disabled = true;
      pauseBtn.textContent = "Pause";
    } else {
      startBtn.classList.add("hidden");
      pauseBtn.disabled = false;
      pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    }
    muteBtn.textContent = sound.muted ? "Sound: Off" : "Sound: On";
  }

  // --- Input Handling ---
  const keys = Object.create(null);
  const pointerMove = {
    active: false,
    id: null,
    originX: 0,
    originY: 0,
    dx: 0,
    dy: 0
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
      code === "ArrowRight"
    );
  }

  window.addEventListener("keydown", function (e) {
    if (
      isMovementKey(e.code) ||
      e.code === "Space" ||
      e.code === "Enter"
    ) {
      e.preventDefault();
    }

    keys[e.code] = true;

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
    pointerMove.active = false;
    pointerMove.dx = 0;
    pointerMove.dy = 0;
  });

  // Touch / mouse drag virtual joystick on canvas
  canvas.addEventListener("pointerdown", function (e) {
    canvas.focus();
    if (state.scene === "menu") {
      if (state.menuLockTimer <= 0) {
        startRun();
      }
      return;
    }
    pointerMove.active = true;
    pointerMove.id = e.pointerId;
    pointerMove.originX = e.clientX;
    pointerMove.originY = e.clientY;
    pointerMove.dx = 0;
    pointerMove.dy = 0;
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_e) {}
    }
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!pointerMove.active || e.pointerId !== pointerMove.id) return;
    const rawX = e.clientX - pointerMove.originX;
    const rawY = e.clientY - pointerMove.originY;
    const maxRadius = 48;
    const dist = Math.hypot(rawX, rawY);
    if (dist < 4) {
      pointerMove.dx = 0;
      pointerMove.dy = 0;
    } else {
      const clamped = Math.min(dist, maxRadius) / maxRadius;
      pointerMove.dx = (rawX / dist) * clamped;
      pointerMove.dy = (rawY / dist) * clamped;
    }
  });

  function endPointer(e) {
    if (pointerMove.active && e.pointerId === pointerMove.id) {
      pointerMove.active = false;
      pointerMove.id = null;
      pointerMove.dx = 0;
      pointerMove.dy = 0;
    }
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

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

  function readMovementInput() {
    let hori = 0;
    let vert = 0;
    if (keys.KeyA || keys.ArrowLeft) hori -= 1;
    if (keys.KeyD || keys.ArrowRight) hori += 1;
    if (keys.KeyW || keys.ArrowUp) vert -= 1;
    if (keys.KeyS || keys.ArrowDown) vert += 1;

    if (hori === 0 && vert === 0 && pointerMove.active) {
      hori = pointerMove.dx;
      vert = pointerMove.dy;
    }
    return movementVector(hori, vert);
  }

  // --- Spawning Systems ---
  function spawnPosition() {
    const pc = centerOf(state.player);
    const halfWidth = VIEW_WIDTH / 2 + 96;
    const halfHeight = VIEW_HEIGHT / 2 + 96;

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

  function spawnEnemy() {
    const pos = spawnPosition();
    const variant = Math.floor(Math.random() * 3);
    const rotRad = ((45 * Math.random()) * Math.PI) / 180;

    if (variant === 0) {
      // Dark ellipse / void orb (SystemRockSpawn.go case 0)
      const yscale = 1.0 + Math.random();
      const width = 64;
      const height = 64 * yscale;
      state.enemies.push({
        kind: "ellipse",
        x: pos.x,
        y: pos.y,
        width: width,
        height: height,
        rotation: rotRad,
        rx: width / 2,
        ry: height / 2
      });
    } else if (variant === 1) {
      // rock2.png scaled 4x (SystemRockSpawn.go case 1)
      state.enemies.push({
        kind: "rock",
        x: pos.x,
        y: pos.y,
        width: 64,
        height: 64,
        rotation: rotRad
      });
    } else {
      // tentacled_starspawn.png scaled 2x (SystemRockSpawn.go default)
      state.enemies.push({
        kind: "starspawn",
        x: pos.x,
        y: pos.y,
        width: 64,
        height: 64,
        rotation: rotRad
      });
    }
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
      if (distSq < bestDistSq) {
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

    const w = 32;
    const h = 32;
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
        size: 3 + Math.random() * 5,
        color: color
      });
    }
  }

  // --- Collision Detection (AABB + rotated ellipse / polygon refinement) ---
  function aabbOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function pointInRotatedEllipse(px, py, enemy, pad) {
    const ec = centerOf(enemy);
    const cos = Math.cos(-enemy.rotation);
    const sin = Math.sin(-enemy.rotation);
    const dx = px - ec.x;
    const dy = py - ec.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const rx = enemy.rx + pad;
    const ry = enemy.ry + pad;
    return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
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

    if (enemy.kind === "ellipse") {
      const c = centerOf(box);
      const radius = Math.min(box.width, box.height) * 0.42;
      return pointInRotatedEllipse(c.x, c.y, enemy, radius);
    }

    // Tight circle-ish hitbox for rock & starspawn to feel crisp and fair
    const c1 = centerOf(box);
    const c2 = centerOf(enemy);
    const r1 = Math.min(box.width, box.height) * 0.44;
    const r2 = Math.min(enemy.width, enemy.height) * 0.42;
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  }

  // --- Simulation Step ---
  function update(dt) {
    state.cloudOffset = (state.cloudOffset + dt * 10) % (worldWidth + 500);

    if (state.scene === "menu") {
      if (state.menuLockTimer > 0) {
        state.menuLockTimer = Math.max(0, state.menuLockTimer - dt);
      }
      return;
    }

    if (state.paused) return;

    state.elapsed += dt;
    if (state.shakeTimer > 0) state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    if (state.hurtFlash > 0) state.hurtFlash = Math.max(0, state.hurtFlash - dt);

    // 1. ControlSystem: move player & clamp to tilemap bounds
    const move = readMovementInput();
    state.player.x += move.x * PLAYER_SPEED * dt;
    state.player.y += move.y * PLAYER_SPEED * dt;
    if (move.x < -0.05) state.player.facingX = -1;
    if (move.x > 0.05) state.player.facingX = 1;

    state.player.x = clamp(state.player.x, 0, Math.max(0, worldWidth - state.player.width));
    state.player.y = clamp(state.player.y, 0, Math.max(0, worldHeight - state.player.height));
    updateCamera();

    // 2. RockSpawnSystem: time-ramped enemy spawning
    state.spawnCooldown -= dt;
    if (state.spawnCooldown <= 0) {
      spawnEnemy();
      const jitter = 0.85 + Math.random() * 0.3;
      state.spawnCooldown = enemySpawnInterval(state.elapsed) * jitter;
    }

    // 3. ChasingSystem: move enemies toward player; despawn far enemies
    const pc = centerOf(state.player);
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const ec = centerOf(e);
      const dir = directionBetween(ec.x, ec.y, pc.x, pc.y);
      e.x += dir.x * ENEMY_SPEED * dt;
      e.y += dir.y * ENEMY_SPEED * dt;

      const dist = Math.hypot(ec.x - pc.x, ec.y - pc.y);
      if (dist > VIEW_WIDTH * 2) {
        state.enemies.splice(i, 1);
      }
    }

    // 4. BulletSpawnSystem: auto-fire toward nearest enemy or sweep cardinals
    state.bulletCooldown -= dt;
    if (state.bulletCooldown <= 0) {
      state.bulletCooldown = BULLET_COOLDOWN;
      spawnBullet();
    }

    // 5. BulletSystem: move bullets & expire by lifetime
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.dx * BULLET_SPEED * dt;
      b.y += b.dy * BULLET_SPEED * dt;
      b.age += dt;
      if (b.age > b.maxAge) {
        state.bullets.splice(i, 1);
      }
    }

    // 6. CollisionSystem + DeathSystem
    // 6a. Bullet vs Enemy
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      let hit = false;
      for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
        const e = state.enemies[ei];
        if (entityHitsEnemy(b, e, 4)) {
          const ec = centerOf(e);
          const color = e.kind === "ellipse" ? "#a855f7" : e.kind === "rock" ? "#cbd5e1" : "#f97316";
          spawnBurst(ec.x, ec.y, color, 9);
          state.enemies.splice(ei, 1);
          state.bullets.splice(bi, 1);
          state.score += 1;
          sound.kill();
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // 6b. Enemy vs Player
    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      if (entityHitsEnemy(state.player, e, 8)) {
        const ec = centerOf(e);
        spawnBurst(ec.x, ec.y, "#ef4444", 12);
        state.enemies.splice(ei, 1);
        state.player.hp = Math.max(0, state.player.hp - 1);
        state.hurtFlash = 0.25;
        state.shakeTimer = 0.2;
        if (state.player.hp <= 0) {
          finishRun();
          return;
        } else {
          sound.hurt();
        }
      }
    }

    // 7. Particles
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
  }

  // --- Rendering ---
  function drawEnemy(e) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.rotation);

    if (e.kind === "ellipse") {
      // Dark shadow ellipse (SystemRockSpawn.go case 0) with subtle rim so it reads crisply
      ctx.beginPath();
      ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#08070d";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
      ctx.stroke();
    } else if (e.kind === "rock") {
      if (assets.rock) {
        ctx.drawImage(assets.rock, -e.width / 2, -e.height / 2, e.width, e.height);
      } else {
        ctx.beginPath();
        for (let i = 0; i < ROCK_POLY_BASE.length; i++) {
          const px = ROCK_POLY_BASE[i].x * 4 - e.width / 2;
          const py = ROCK_POLY_BASE[i].y * 4 - e.height / 2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = "#64748b";
        ctx.fill();
      }
    } else {
      if (assets.starspawn) {
        ctx.drawImage(assets.starspawn, -e.width / 2, -e.height / 2, e.width, e.height);
      } else {
        ctx.fillStyle = "#ea580c";
        ctx.fillRect(-e.width / 2, -e.height / 2, e.width, e.height);
      }
    }
    ctx.restore();
  }

  function drawBullet(b) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    ctx.save();
    ctx.translate(cx, cy);
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
    ctx.save();
    // Subtle ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.height - 6, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, cy);
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

  function drawHUD() {
    const p = state.player;
    const frac = healthFraction(p.hp, p.maxHp);

    // Top proportional yellow HP bar (matching SystemHUD.go: X:10, Y:10, Width: (W-20)*frac, Height:50)
    const barX = 14;
    const barY = 14;
    const barMaxW = VIEW_WIDTH - 28;
    const barH = 38;

    ctx.save();
    // Backing
    ctx.fillStyle = "rgba(10, 12, 18, 0.72)";
    ctx.fillRect(barX, barY, barMaxW, barH);

    // Yellow HP fill (shifts warmer at low HP while keeping iconic DCBH yellow)
    ctx.fillStyle = frac <= 0.3 ? "#f97316" : "#ffff00";
    ctx.fillRect(barX, barY, barMaxW * frac, barH);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(barX, barY, barMaxW, barH);

    // HP label inside bar
    ctx.font = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.fillStyle = frac > 0.14 ? "#111111" : "#ffffff";
    ctx.fillText("HP " + p.hp + "/" + p.maxHp, barX + 14, barY + barH / 2 + 1);

    // Bottom-left HUD panel (matching SystemHUD.go bottom-left kills & HP text)
    const boxW = 240;
    const boxH = 112;
    const boxX = 16;
    const boxY = VIEW_HEIGHT - boxH - 16;

    ctx.fillStyle = "rgba(10, 12, 18, 0.76)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(state.score + " kills", boxX + 16, boxY + 14);

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 22px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("HP " + p.hp + "/" + p.maxHp, boxX + 16, boxY + 50);

    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    const timeStr = mins + ":" + (secs < 10 ? "0" + secs : secs);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Time " + timeStr + "  •  Best " + Math.max(state.bestScore, state.score), boxX + 16, boxY + 82);
    ctx.restore();
  }

  function drawMenu() {
    ctx.save();
    // Dark background (matching MenuScene common.SetBackground(color.Black))
    ctx.fillStyle = "#08090e";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Subtle dimmed preview of the grass map behind the menu
    if (grassCanvas) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(grassCanvas, 200, 200, VIEW_WIDTH, VIEW_HEIGHT, 0, 0, VIEW_WIDTH, VIEW_HEIGHT);
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
    grad.addColorStop(0, "rgba(8, 9, 14, 0.25)");
    grad.addColorStop(1, "rgba(4, 5, 10, 0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Center showcase sprites
    ctx.imageSmoothingEnabled = false;
    if (assets.player) {
      ctx.drawImage(assets.player, VIEW_WIDTH / 2 - 48, 250, 96, 96);
    }
    if (assets.starspawn) {
      ctx.drawImage(assets.starspawn, VIEW_WIDTH / 2 - 210, 270, 80, 80);
    }
    if (assets.rock) {
      ctx.drawImage(assets.rock, VIEW_WIDTH / 2 + 130, 270, 80, 80);
    }
    if (assets.bullet) {
      ctx.drawImage(assets.bullet, VIEW_WIDTH / 2 - 125, 290, 44, 44);
      ctx.drawImage(assets.bullet, VIEW_WIDTH / 2 + 80, 290, 44, 44);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 54px Georgia, 'Times New Roman', serif";
    ctx.fillText("Dungeon Crawl Bullet Hell", VIEW_WIDTH / 2, 165);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Survive the swarm. Auto-fire at the nearest monster.", VIEW_WIDTH / 2, 405);

    if (state.gameOver) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 36px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("RUN OVER", VIEW_WIDTH / 2, 485);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Last run: " + state.lastScore + " kills", VIEW_WIDTH / 2, 545);

      ctx.fillStyle = "#facc15";
      ctx.font = "bold 32px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Best run: " + state.bestScore + " kills", VIEW_WIDTH / 2, 595);
    } else if (state.bestScore > 0) {
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 28px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Best run: " + state.bestScore + " kills", VIEW_WIDTH / 2, 510);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Press Enter, Space, or move to start.", VIEW_WIDTH / 2, 710);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("WASD / Arrow keys (or drag on screen) to move • 10 HP", VIEW_WIDTH / 2, 760);

    if (!assetsReady) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "18px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("Loading sprites...", VIEW_WIDTH / 2, 810);
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
    ctx.fillStyle = "#1a2e1a";
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

    // Layer 0: grassLayer
    if (grassCanvas) {
      ctx.drawImage(grassCanvas, 0, 0);
    } else {
      ctx.fillStyle = "#365314";
      ctx.fillRect(0, 0, worldWidth, worldHeight);
    }

    // Subtle world boundary border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, worldWidth - 4, worldHeight - 4);

    // Layer 1: guyLayer (player)
    drawPlayer();

    // Layer 2: monsterLayer (enemies)
    for (let i = 0; i < state.enemies.length; i++) {
      drawEnemy(state.enemies[i]);
    }

    // Layer 3: bulletLayer (bullets)
    for (let i = 0; i < state.bullets.length; i++) {
      drawBullet(state.bullets[i]);
    }

    // Hit particles
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Layer 4: treeLayer (drawn above entities, matching falling.go z-index!)
    if (treesCanvas) {
      ctx.drawImage(treesCanvas, 0, 0);
    }

    // Layer 5: cloudLayer (from example.tmx image layer)
    if (assets.cloud) {
      ctx.globalAlpha = 0.72;
      const cx1 = (state.cloudOffset) % (worldWidth + 400) - 400;
      ctx.drawImage(assets.cloud, cx1, 40);
      const cx2 = (state.cloudOffset + 850) % (worldWidth + 400) - 400;
      ctx.drawImage(assets.cloud, cx2, 780);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // end world camera transform

    // Damage vignette flash
    if (state.hurtFlash > 0) {
      ctx.fillStyle = "rgba(239, 68, 68, " + (state.hurtFlash * 1.1).toFixed(3) + ")";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }

    // Layer 6: hudLayer
    drawHUD();

    // Pause overlay
    if (state.paused) {
      ctx.fillStyle = "rgba(8, 9, 14, 0.68)";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 56px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("PAUSED", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText("Press P or Esc to resume", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 40);
    }

    ctx.restore();
  }

  // --- Main Loop ---
  let lastTime = performance.now();

  function frame(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    // Clamp dt to avoid giant jumps when switching tabs
    const dt = Math.min(0.05, Math.max(0, rawDt));

    update(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  loadAllAssets();
  syncUI();
  window.requestAnimationFrame(frame);
})();
