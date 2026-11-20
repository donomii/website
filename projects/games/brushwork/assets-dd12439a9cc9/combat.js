"use strict";

(function attachCombat(root) {
  const constants = Object.freeze({
    playerRadius: 12,
    brushLength: 18,
    brushWidth: 10,
    inkCost: 0.17,
    inkRecovery: 30,
    circleLife: 7,
    crossRadius: 106,
    strokeLife: 6.5,
    dashLife: 0.17,
    dashCooldown: 1.2,
    dashBuffer: 0.14,
    blotPulseRadius: 92,
    blotWindup: 0.7,
    chainWindow: 1.7,
  });
  const waves = [6, 10, 14, 17, 20, 24];
  const formations = {
    4: { angles: [0, Math.PI * 0.88], groups: [["dart", "wisp"], ["shell", "dart"], ["wisp", "wisp"]], interval: 0.83 },
    5: { angles: [0, -0.31, 0.31], groups: [["shell", "wisp", "wisp"], ["wisp", "dart", "dart"]], interval: 1.04 },
    6: { angles: [0, Math.PI * 0.78, Math.PI * 1.26], groups: [["dart", "wisp", "wisp"], ["shell", "dart"]], interval: 0.92 },
  };
  const enemyTypes = {
    wisp: { radius: 13, health: 34, speed: 88, damage: 12 },
    dart: { radius: 11, health: 29, speed: 112, damage: 16 },
    shell: { radius: 19, health: 87, speed: 62, damage: 21 },
    blot: { radius: 25, health: 222, speed: 64, damage: 22 },
  };

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function create(runes, effectsApi, random = Math.random) {
    const game = { width: 320, height: 480, arenaTop: 52, pixelRatio: 1 };
    reset("ready");
    const effects = effectsApi.create(game);

    function reset(state) {
      const x = game.width / 2;
      const y = (game.height + game.arenaTop) / 2;
      Object.assign(game, {
        state, elapsed: 0, shake: 0, defeated: 0, runeCount: 0, wave: 1,
        chain: 0, bestChain: 0, chainClock: 0,
        waveCount: waves.length, phase: "incoming", phaseClock: 1.15, spawnClock: 0, spawnGroup: 0,
        queued: waves[0], feedback: null, live: null, joystick: null, aim: null,
        enemies: [], portals: [], traces: [], circles: [], drops: [], particles: [], shockwaves: [],
        player: {
          x, y, radius: constants.playerRadius, health: 100, ink: 100,
          dx: 1, dy: 0, moving: false, invulnerable: 0, dash: 0, cooldown: 0, dashStrike: false, dashQueued: false,
        },
        brush: { x: x - constants.brushLength, y, pointer: false },
      });
    }

    function place(point, inset) {
      point.x = clamp(point.x, inset, game.width - inset);
      point.y = clamp(point.y, game.arenaTop + inset, game.height - inset);
    }

    function resize(width, height, pixelRatio, arenaTop) {
      const scaleX = width / game.width;
      const scaleY = (height - arenaTop) / (game.height - game.arenaTop);
      // Translate each anchored shape as a unit so a screen rotation does not warp a rune.
      const anchors = [game.player, ...game.enemies, ...game.portals, ...game.circles, ...game.drops];
      for (const anchor of anchors) {
        anchor.x *= scaleX;
        anchor.y = arenaTop + (anchor.y - game.arenaTop) * scaleY;
      }
      for (const trace of game.traces) {
        const shiftX = (trace.minX + trace.maxX) / 2 * (scaleX - 1);
        const centerY = (trace.minY + trace.maxY) / 2;
        const shiftY = arenaTop + (centerY - game.arenaTop) * scaleY - centerY;
        for (const point of trace.points) {
          point.x += shiftX;
          point.y += shiftY;
        }
        trace.minX += shiftX;
        trace.maxX += shiftX;
        trace.minY += shiftY;
        trace.maxY += shiftY;
      }
      game.particles = [];
      game.shockwaves = [];
      Object.assign(game, { width, height, pixelRatio, arenaTop });
      place(game.player, 17);
      Object.assign(game.brush, { ...brushTarget(), pointer: false });
      place(game.brush, 3);
    }

    function start() {
      reset("playing");
    }

    function pause() {
      if (game.state === "playing") {
        finishPaint();
        game.player.moving = false;
        game.player.dashQueued = false;
        game.state = "paused";
      } else if (game.state === "paused") {
        game.state = "playing";
      }
    }

    function beginPaint(point) {
      if (game.state !== "playing" || game.live !== null || game.player.ink < 4) {
        return false;
      } else {
        const pointer = point !== null;
        const startPoint = pointer ? { ...point }
          : game.brush.pointer ? brushTarget() : { x: game.brush.x, y: game.brush.y };
        place(startPoint, 3);
        Object.assign(game.brush, startPoint, { pointer });
        game.live = {
          points: [startPoint], width: constants.brushWidth, hits: new WeakSet(), length: 0,
          minX: startPoint.x, maxX: startPoint.x, minY: startPoint.y, maxY: startPoint.y,
        };
        return true;
      }
    }

    function paint(point, sampleMinimum = 5) {
      const stroke = game.live;
      if (stroke === null) {
        return;
      } else {
        const previous = stroke.points[stroke.points.length - 1];
        const target = { ...point };
        place(target, 3);
        const span = runes.distance(previous, target);
        const available = game.player.ink / constants.inkCost;
        const length = Math.min(span, available);
        if (span >= sampleMinimum && length > 0) {
          const fraction = length / span;
          const x = previous.x + (target.x - previous.x) * fraction;
          const y = previous.y + (target.y - previous.y) * fraction;
          stroke.points.push({ x, y });
          stroke.length += length;
          stroke.minX = Math.min(stroke.minX, x);
          stroke.maxX = Math.max(stroke.maxX, x);
          stroke.minY = Math.min(stroke.minY, y);
          stroke.maxY = Math.max(stroke.maxY, y);
          game.player.ink = Math.max(0, game.player.ink - length * constants.inkCost);
          game.brush.x = x;
          game.brush.y = y;
          if (available <= span) {
            finishPaint();
          }
        }
      }
    }

    function finishPaint() {
      if (game.live !== null) {
        const trace = game.live;
        game.live = null;
        const rune = runes.classifyStroke(trace.points);
        if (rune.kind === "discard") {
          effects.makeDryBrushPuff(game.brush.x, game.brush.y);
        } else {
          const crossed = rune.kind === "line" && trace.length >= 58 && rune.metrics.straightness <= 0.14
            ? findCross(trace) : null;
          Object.assign(trace, {
            age: 0, life: constants.strokeLife, glow: 1, magic: rune.kind,
            crossable: crossed === null && rune.kind === "line"
              && rune.metrics.straightness <= 0.14 && rune.metrics.length >= 58,
          });
          game.traces.push(trace);
          if (rune.kind === "circle") {
            activateWard(rune);
          } else if (crossed !== null) {
            trace.magic = crossed.trace.magic = "cross";
            crossed.trace.crossable = false;
            crossed.trace.glow = 1;
            activateBurst(crossed.rune);
          } else {
            effects.makeStrokeSparks(trace.points, "#d58a3e", 10);
          }
        }
        if (game.brush.pointer) {
          Object.assign(game.brush, brushTarget(), { pointer: false });
          place(game.brush, 3);
        }
      }
    }

    function findCross(stroke) {
      for (let index = game.traces.length - 1; index >= 0; index -= 1) {
        const trace = game.traces[index];
        const overlaps = stroke.minX <= trace.maxX && stroke.maxX >= trace.minX
          && stroke.minY <= trace.maxY && stroke.maxY >= trace.minY;
        const rune = trace.crossable && overlaps ? runes.findCrossRune(trace.points, stroke.points) : null;
        if (rune !== null) {
          return { trace, rune };
        }
      }
      return null;
    }

    function activateWard(rune) {
      const { x, y } = rune.center;
      const radius = Math.min(115, rune.radius) + 7;
      game.circles.push({ x, y, radius, age: 0, life: constants.circleLife, pulse: 0 });
      announceRune(x, y, "Ward", "#187b74", 16);
      for (const enemy of game.enemies) {
        if (runes.distance(enemy, rune.center) <= radius + enemy.radius) {
          hurt(enemy, 15);
        }
      }
    }

    function activateBurst(rune) {
      const { x, y } = rune;
      const radius = constants.crossRadius;
      game.shockwaves.push({ x, y, radius: 8, maximumRadius: radius, age: 0, life: 0.48 });
      game.shake = 5;
      announceRune(x, y, "Burst", "#bd4334", 28);
      for (const enemy of game.enemies) {
        const distance = runes.distance(enemy, rune);
        if (distance <= radius + enemy.radius) {
          hurt(enemy, 100 * (1 - Math.min(0.45, distance / radius * 0.45)));
          enemy.x += (enemy.x - x) / Math.max(1, distance) * 22;
          enemy.y += (enemy.y - y) / Math.max(1, distance) * 22;
        }
      }
    }

    function announceRune(x, y, label, color, sparks) {
      game.runeCount += 1;
      game.player.ink = Math.min(100, game.player.ink + 10);
      markAction(x, y, label, color, sparks);
    }

    function markAction(x, y, label, color, sparks) {
      game.feedback = { x, y, label, color, age: 0, life: 0.85 };
      effects.makeRuneSparks(x, y, color, sparks);
    }

    function dodge(x, y) {
      const player = game.player;
      if (game.state === "playing" && player.cooldown <= constants.dashBuffer) {
        if (player.cooldown === 0) {
          startDash(x, y);
        } else {
          player.dashQueued = true;
        }
      }
    }

    function startDash(x, y) {
      const player = game.player;
      const length = Math.hypot(x, y);
      player.dx = length > 0 ? x / length : player.dx;
      player.dy = length > 0 ? y / length : player.dy;
      player.dash = constants.dashLife;
      player.dashStrike = true;
      player.dashQueued = false;
      player.cooldown = constants.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, constants.dashLife + 0.09);
      effects.makeRuneSparks(player.x, player.y + 8, "#bd593f", 9);
    }

    function brushTarget() {
      const { x, y, dx, dy } = game.player;
      return { x: x - dx * constants.brushLength, y: y - dy * constants.brushLength };
    }

    function updatePlayer(delta, moveX, moveY) {
      const player = game.player;
      player.cooldown = Math.max(0, player.cooldown - delta);
      if (player.dashQueued && player.cooldown === 0) {
        startDash(moveX, moveY);
      }
      const magnitude = Math.hypot(moveX, moveY);
      const dashing = player.dash > 0;
      player.moving = magnitude > 0 || dashing;
      if (dashing) {
        player.x += player.dx * 615 * delta;
        player.y += player.dy * 615 * delta;
      } else if (magnitude > 0) {
        player.dx = moveX / magnitude;
        player.dy = moveY / magnitude;
        const speed = 232 * Math.min(1, magnitude);
        player.x += player.dx * speed * delta;
        player.y += player.dy * speed * delta;
      }
      place(player, 17);
      player.dash = Math.max(0, player.dash - delta);
      player.invulnerable = Math.max(0, player.invulnerable - delta);

      if (!game.brush.pointer || game.live === null) {
        const target = brushTarget();
        const follow = 1 - Math.exp(-30 * delta);
        game.brush.x += (target.x - game.brush.x) * follow;
        game.brush.y += (target.y - game.brush.y) * follow;
        place(game.brush, 3);
        if (game.live !== null) {
          paint(game.brush, 3.5);
        }
      }
      if (game.live === null) {
        game.player.ink = Math.min(100, game.player.ink + constants.inkRecovery * delta);
      }
    }

    function queuePortal(angle, type) {
      const { player, width, height, arenaTop } = game;
      const reach = Math.min(245, Math.max(115, Math.min(width, height - arenaTop) * 0.44));
      const x = clamp(player.x + Math.cos(angle) * reach, 26, width - 26);
      const y = clamp(player.y + Math.sin(angle) * reach, arenaTop + 26, height - 26);
      // Reflect a spawn direction if clipping at the paper edge put it on top of the player.
      const close = Math.hypot(x - player.x, y - player.y) < reach * 0.64;
      game.portals.push({
        x: close ? clamp(2 * player.x - x + Math.cos(angle + Math.PI) * reach, 26, width - 26) : x,
        y: close ? clamp(2 * player.y - y + Math.sin(angle + Math.PI) * reach, arenaTop + 26, height - 26) : y,
        type, age: 0, life: type === "blot" ? 0.92 : 0.58,
      });
      game.queued -= 1;
    }

    function spawn(portal) {
      const base = enemyTypes[portal.type];
      const health = base.health + (game.wave - 1) * 2.5;
      game.enemies.push({
        x: portal.x, y: portal.y, type: portal.type, radius: base.radius,
        health, maximumHealth: health, speed: base.speed + (game.wave - 1) * 3.5,
        damage: base.damage, hitFlash: 0, seed: random() * 100, wobble: random() * Math.PI * 2,
        charge: 0, aimX: 0, aimY: 0, attackClock: 0.8 + random() * 0.7,
      });
      effects.makeRuneSparks(portal.x, portal.y, "#3a4246", 7);
    }

    function queueFormation() {
      const angle = random() * Math.PI * 2;
      const formation = formations[game.wave];
      if (formation === undefined) {
        const count = waves[game.wave - 1] - game.queued;
        const type = game.wave === 3 && count % 5 === 4 ? "shell"
          : game.wave >= 2 && count % 3 === 2 ? "dart" : "wisp";
        queuePortal(angle, type);
        game.spawnClock = 0.73 - (game.wave - 1) * 0.084;
      } else {
        const bossArrival = game.wave === game.waveCount && game.spawnGroup === 3;
        const group = bossArrival ? ["blot"] : formation.groups[game.spawnGroup % formation.groups.length];
        const count = Math.min(group.length, game.queued);
        for (let index = 0; index < count; index += 1) {
          queuePortal(angle + formation.angles[index], group[index]);
        }
        game.spawnClock = formation.interval;
        game.spawnGroup += 1;
      }
    }

    function updateWave(delta) {
      if (game.phase === "incoming") {
        game.phaseClock -= delta;
        if (game.phaseClock <= 0) {
          game.phase = "fight";
          game.spawnClock = 0;
        }
      } else {
        game.spawnClock -= delta;
        if (game.queued > 0 && game.spawnClock <= 0) {
          queueFormation();
        }
      }
      game.portals = game.portals.filter((portal) => {
        portal.age += delta;
        if (portal.age >= portal.life) {
          spawn(portal);
          return false;
        } else {
          return true;
        }
      });
    }

    function enterNextWave() {
      if (game.wave === game.waveCount) {
        finishPaint();
        game.state = "victorious";
      } else {
        game.wave += 1;
        game.phase = "incoming";
        game.phaseClock = 2.35;
        game.queued = waves[game.wave - 1];
        game.spawnGroup = 0;
        game.player.health = Math.min(100, game.player.health + 12);
        game.player.ink = Math.min(100, game.player.ink + 30);
      }
    }

    function moveEnemy(enemy, delta, slow) {
      const x = game.player.x - enemy.x;
      const y = game.player.y - enemy.y;
      const distance = Math.max(1, Math.hypot(x, y));
      const towardX = x / distance;
      const towardY = y / distance;
      enemy.wobble += delta * 4;
      enemy.attackClock -= delta;

      if (enemy.type === "blot" && enemy.charge > 0) {
        enemy.charge = Math.max(0, enemy.charge - delta);
        if (enemy.charge === 0) {
          pulse(enemy, distance);
        }
      } else if (enemy.type === "blot" && enemy.attackClock <= 0 && distance < 146) {
        const enraged = enemy.health <= enemy.maximumHealth / 2;
        enemy.pulseRadius = enraged ? 118 : constants.blotPulseRadius;
        enemy.windup = enraged ? 0.55 : constants.blotWindup;
        enemy.charge = enemy.windup;
        enemy.attackClock = enraged ? 1.9 : 2.7;
      } else if (enemy.type === "dart" && enemy.charge > 0) {
        // Darts show their aim while winding up, then commit to it in a straight lunge.
        enemy.charge = Math.max(0, enemy.charge - delta);
        const pace = enemy.charge <= 0.25 ? 286 : 0;
        enemy.x += enemy.aimX * pace * slow * delta;
        enemy.y += enemy.aimY * pace * slow * delta;
      } else if (enemy.type === "dart" && enemy.attackClock <= 0 && distance < 160 && distance > 44) {
        enemy.charge = 0.65;
        enemy.attackClock = 2.2;
        enemy.aimX = towardX;
        enemy.aimY = towardY;
      } else {
        const sway = Math.sin(enemy.wobble) * (enemy.type === "wisp" ? 0.22 : 0.1);
        enemy.x += (towardX - towardY * sway) * enemy.speed * slow * delta;
        enemy.y += (towardY + towardX * sway) * enemy.speed * slow * delta;
      }
      place(enemy, 10);
    }

    function hurt(enemy, damage) {
      enemy.health = Math.max(0, enemy.health - damage);
      enemy.hitFlash = 1;
    }

    function scorch(enemy, trace, delta) {
      const reach = enemy.radius + trace.width * 0.55;
      const inBounds = enemy.x + reach >= trace.minX && enemy.x - reach <= trace.maxX
        && enemy.y + reach >= trace.minY && enemy.y - reach <= trace.maxY;
      if (inBounds && trace.length >= 18 && runes.distanceToPath(enemy, trace.points) <= reach) {
        const firstHit = !trace.hits.has(enemy);
        const strength = trace.age === undefined ? 1 : Math.max(0.55, 1 - trace.age / trace.life * 0.55);
        const resistance = enemy.type === "blot" ? 0.5 : 1;
        hurt(enemy, ((firstHit ? 28 : 0) + 57 * delta) * strength * resistance);
        trace.hits.add(enemy);
        trace.glow = 1;
        if (firstHit) {
          effects.makeRuneSparks(enemy.x, enemy.y, "#ad5e36", 4);
        }
      }
    }

    function contact(enemy) {
      const player = game.player;
      const distance = runes.distance(enemy, player);
      if (enemy.health > 0 && distance <= player.radius + enemy.radius) {
        if (player.dash > 0 && player.dashStrike) {
          player.dashStrike = false;
          hurt(enemy, 23);
          player.ink = Math.min(100, player.ink + 10);
          markAction(enemy.x, enemy.y, "+10 ink", "#256d61", 12);
        } else if (hitPlayer(enemy.damage)) {
          enemy.x += (enemy.x - player.x) / Math.max(1, distance) * 34;
          enemy.y += (enemy.y - player.y) / Math.max(1, distance) * 34;
        }
      }
    }

    function hitPlayer(damage) {
      const player = game.player;
      if (player.invulnerable > 0 || player.health <= 0) {
        return false;
      } else {
        player.health = Math.max(0, player.health - damage);
        player.invulnerable = 0.72;
        game.shake = 7;
        effects.makeRuneSparks(player.x, player.y, "#a62e36", 13);
        return true;
      }
    }

    function pulse(enemy, distance) {
      const radius = enemy.pulseRadius;
      game.shockwaves.push({
        x: enemy.x, y: enemy.y, radius: 8, maximumRadius: radius,
        age: 0, life: 0.42, kind: "blot",
      });
      effects.makeRuneSparks(enemy.x, enemy.y, "#873746", 21);
      if (distance <= radius + game.player.radius) {
        hitPlayer(24);
      }
    }

    function updateEnemies(delta) {
      game.enemies = game.enemies.filter((enemy) => {
        if (enemy.health > 0) {
          enemy.hitFlash = Math.max(0, enemy.hitFlash - delta * 6);
          const warded = game.circles.some((ward) => runes.distance(enemy, ward) <= ward.radius + enemy.radius);
          moveEnemy(enemy, delta, warded ? 0.39 : 1);
          if (warded) {
            hurt(enemy, 43 * delta);
          }
          for (const trace of game.traces) {
            scorch(enemy, trace, delta);
          }
          if (game.live !== null) {
            scorch(enemy, game.live, delta);
          }
          contact(enemy);
        }
        if (enemy.health > 0) {
          return true;
        } else {
          defeat(enemy);
          return false;
        }
      });
    }

    function defeat(enemy) {
      game.defeated += 1;
      game.chain += 1;
      game.bestChain = Math.max(game.bestChain, game.chain);
      game.chainClock = constants.chainWindow;
      effects.makeEnemySplash(enemy);
      const bonus = game.chain % 3 === 0;
      game.player.ink = Math.min(100, game.player.ink + (bonus ? 15 : 3));
      if (bonus) {
        markAction(enemy.x, enemy.y, game.chain + "× chain", "#9a4b24", 14);
      }
      if (game.defeated % 3 === 0 || enemy.type === "shell") {
        game.drops.push({ x: enemy.x, y: enemy.y, age: 0, life: 10 });
      }
    }

    function updateDrops(delta) {
      const player = game.player;
      game.drops = game.drops.filter((drop) => {
        drop.age += delta;
        const distance = runes.distance(player, drop);
        if (distance < 23) {
          player.ink = Math.min(100, player.ink + 26);
          effects.makeRuneSparks(drop.x, drop.y, "#1d8b82", 9);
          return false;
        } else {
          const pull = distance < 69 ? Math.min(1, 10 * delta) : 0;
          drop.x += (player.x - drop.x) * pull;
          drop.y += (player.y - drop.y) * pull;
          return drop.age < drop.life;
        }
      });
    }

    function advanceVisuals(delta) {
      game.shake = Math.max(0, game.shake - delta * 27);
      effects.updateParticles(delta);
      effects.updateShockwaves(delta);
      if (game.feedback !== null) {
        game.feedback.age += delta;
        game.feedback = game.feedback.age < game.feedback.life ? game.feedback : null;
      }
    }

    function update(delta, moveX, moveY) {
      if (game.state === "playing") {
        game.elapsed += delta;
        game.chainClock = Math.max(0, game.chainClock - delta);
        game.chain = game.chainClock === 0 ? 0 : game.chain;
        updatePlayer(delta, moveX, moveY);
        game.traces = game.traces.filter((trace) => {
          trace.age += delta;
          trace.glow = Math.max(0, trace.glow - delta * 2.4);
          return trace.age < trace.life;
        });
        game.circles = game.circles.filter((circle) => {
          circle.age += delta;
          circle.pulse += delta * 5;
          return circle.age < circle.life;
        });
        updateWave(delta);
        updateEnemies(delta);
        updateDrops(delta);
        if (game.player.health === 0) {
          finishPaint();
          game.state = "defeated";
        } else if (game.phase === "fight" && game.queued === 0
            && game.portals.length === 0 && game.enemies.length === 0) {
          enterNextWave();
        }
      }
      if (game.state !== "paused") {
        advanceVisuals(delta);
      }
    }

    return Object.freeze({ game, resize, start, pause, beginPaint, paint, finishPaint, dodge, update });
  }

  const api = Object.freeze({ create, constants });
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrushworkCombat = api;
  }
})(globalThis);
