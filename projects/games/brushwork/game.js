"use strict";

(function runBrushwork() {
  const geometry = globalThis.BrushworkRunes;

  if (geometry === undefined) {
    throw new Error("Brushwork could not start because runes.js did not load before game.js");
  } else {
    startGame(geometry);
  }

  function startGame(runesApi) {
    const canvas = requiredElement("game");
    const context = canvas.getContext("2d");

    if (context === null) {
      throw new Error("Brushwork requires a browser with two-dimensional canvas support");
    } else {
      initialize(canvas, context, runesApi);
    }
  }

  function requiredElement(id) {
    const found = document.getElementById(id);
    if (found === null) {
      throw new Error(`Brushwork is missing the required page element #${id}`);
    } else {
      return found;
    }
  }

  function initialize(canvas, context, runesApi) {
    const dom = {
      startPanel: requiredElement("start-panel"),
      pausePanel: requiredElement("pause-panel"),
      gameOverPanel: requiredElement("game-over-panel"),
      startButton: requiredElement("start-button"),
      restartButton: requiredElement("restart-button"),
      healthValue: requiredElement("health-value"),
      healthBar: requiredElement("health-bar"),
      inkValue: requiredElement("ink-value"),
      inkBar: requiredElement("ink-bar"),
      timeValue: requiredElement("time-value"),
      scoreValue: requiredElement("score-value"),
      runeValue: requiredElement("rune-value"),
      finalTime: requiredElement("final-time"),
      finalScore: requiredElement("final-score"),
      finalRunes: requiredElement("final-runes"),
      runeToast: requiredElement("rune-toast"),
      runeToastMark: requiredElement("rune-toast-mark"),
      runeToastTitle: requiredElement("rune-toast-title"),
      runeToastCopy: requiredElement("rune-toast-copy"),
      drawHint: requiredElement("draw-hint"),
    };
    const movementCodes = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD",
      "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
    ]);
    const preventedCodes = new Set([...movementCodes, "Space"]);
    const keys = new Set();
    const constants = Object.freeze({
      brushLength: 39,
      brushWidth: 8,
      circleLife: 7.5,
      crossDamage: 72,
      crossRadius: 96,
      inkCostPerPixel: 0.13,
      inkRecoveryPerSecond: 20,
      lineDamagePerSecond: 38,
      playerRadius: 13,
      strokeLife: 9,
    });
    const game = {
      width: 0,
      height: 0,
      pixelRatio: 1,
      arenaTop: 88,
      state: "ready",
      elapsed: 0,
      defeated: 0,
      runeCount: 0,
      spawnClock: 0,
      shake: 0,
      hintClock: 0,
      toastClock: 0,
      lastFrame: performance.now(),
      player: null,
      brush: null,
      enemies: [],
      traces: [],
      circles: [],
      particles: [],
      shockwaves: [],
      paperMarks: [],
    };
    const rendererApi = globalThis.BrushworkRenderer;
    const effectsApi = globalThis.BrushworkEffects;
    const supportLoaded = rendererApi !== undefined && effectsApi !== undefined;
    if (supportLoaded) {
      game.state = "ready";
    } else {
      throw new Error("Brushwork could not start because renderer.js or effects.js did not load");
    }
    const effects = effectsApi.create(game);
    const renderer = rendererApi.create({ context, game, constants, seededNoise });

    function resetRun() {
      const startY = Math.max(game.arenaTop + 90, game.height * 0.52);
      game.elapsed = 0;
      game.defeated = 0;
      game.runeCount = 0;
      game.spawnClock = 0.7;
      game.shake = 0;
      game.hintClock = 5.5;
      game.toastClock = 0;
      game.enemies = [];
      game.traces = [];
      game.circles = [];
      game.particles = [];
      game.shockwaves = [];
      game.player = {
        x: game.width * 0.5,
        y: startY,
        radius: constants.playerRadius,
        speed: 190,
        health: 100,
        maxHealth: 100,
        ink: 100,
        maxInk: 100,
        invulnerable: 0,
        moving: false,
      };
      game.brush = {
        x: game.player.x - constants.brushLength,
        y: game.player.y + 5,
        down: false,
        pointerDown: false,
        points: [],
      };
      keys.clear();
      hideAllPanels();
      updateReadouts();
    }

    function startRun() {
      resetRun();
      game.state = "playing";
      game.lastFrame = performance.now();
      dom.startPanel.classList.remove("visible");
      dom.gameOverPanel.classList.remove("visible");
      dom.pausePanel.classList.remove("visible");
    }

    function endRun() {
      finishStroke();
      game.state = "defeated";
      dom.finalTime.textContent = formatTime(game.elapsed);
      dom.finalScore.textContent = String(game.defeated);
      dom.finalRunes.textContent = String(game.runeCount);
      dom.gameOverPanel.classList.add("visible");
      dom.drawHint.classList.remove("visible");
    }

    function hideAllPanels() {
      dom.startPanel.classList.remove("visible");
      dom.pausePanel.classList.remove("visible");
      dom.gameOverPanel.classList.remove("visible");
    }

    function togglePause() {
      if (game.state === "playing") {
        finishStroke();
        game.state = "paused";
        dom.pausePanel.classList.add("visible");
      } else if (game.state === "paused") {
        game.state = "playing";
        game.lastFrame = performance.now();
        dom.pausePanel.classList.remove("visible");
      } else {
        dom.pausePanel.classList.remove("visible");
      }
    }

    function beginStroke() {
      const canDraw = game.state === "playing"
        && game.player.ink > 0.5
        && game.brush.down === false;
      if (canDraw) {
        game.brush.down = true;
        game.brush.points = [{ x: game.brush.x, y: game.brush.y }];
        dom.drawHint.classList.remove("visible");
        return true;
      } else {
        return false;
      }
    }

    function finishStroke() {
      if (game.brush !== null && game.brush.down) {
        game.brush.down = false;
        const points = game.brush.points.map((point) => ({ x: point.x, y: point.y }));
        game.brush.points = [];
        completeStroke(points);
        return true;
      } else {
        return false;
      }
    }

    function completeStroke(points) {
      const classification = runesApi.classifyStroke(points);
      if (classification.kind === "discard") {
        effects.makeDryBrushPuff(game.brush.x, game.brush.y);
      } else {
        const trace = {
          points,
          age: 0,
          life: constants.strokeLife,
          width: constants.brushWidth,
          activated: classification.kind === "circle",
          kind: classification.kind,
          magic: classification.kind,
          glow: 1,
        };
        game.traces.push(trace);

        if (classification.kind === "circle") {
          effects.makeStrokeSparks(points, "#5fcbb0", 18);
          activateCircle(classification);
        } else {
          const crossed = findCrossingTrace(trace);
          if (crossed === null) {
            effects.makeStrokeSparks(points, "#dda34e", 12);
          } else {
            trace.activated = true;
            crossed.trace.activated = true;
            trace.magic = "cross";
            crossed.trace.magic = "cross";
            crossed.trace.glow = 1;
            effects.makeStrokeSparks(trace.points, "#dd604f", 16);
            effects.makeStrokeSparks(crossed.trace.points, "#dd604f", 16);
            activateCross(crossed.rune);
          }
        }
      }
    }

    function findCrossingTrace(currentTrace) {
      let result = null;
      for (let index = game.traces.length - 2; index >= 0 && result === null; index -= 1) {
        const candidate = game.traces[index];
        const eligible = candidate.activated === false
          && candidate.kind === "line"
          && candidate.age <= 3.2;
        if (eligible) {
          const rune = runesApi.findCrossRune(candidate.points, currentTrace.points);
          if (rune === null) {
            result = null;
          } else {
            result = { trace: candidate, rune };
          }
        } else {
          result = null;
        }
      }
      return result;
    }

    function activateCircle(classification) {
      game.circles.push({
        x: classification.center.x,
        y: classification.center.y,
        radius: Math.min(110, classification.radius),
        age: 0,
        life: constants.circleLife,
        pulse: Math.random() * Math.PI * 2,
      });
      game.runeCount += 1;
      game.shake = Math.max(game.shake, 3);
      effects.makeRuneSparks(classification.center.x, classification.center.y, "#527f73", 16);
      showRuneToast("○", "Circle ward", "The loop becomes a slowing trap.");
      updateReadouts();
    }

    function activateCross(rune) {
      game.runeCount += 1;
      game.shockwaves.push({
        x: rune.x,
        y: rune.y,
        radius: 8,
        maximumRadius: constants.crossRadius,
        age: 0,
        life: 0.55,
      });
      game.shake = Math.max(game.shake, 9);
      effects.makeRuneSparks(rune.x, rune.y, "#b3473c", 34);

      for (let index = 0; index < game.enemies.length; index += 1) {
        const enemy = game.enemies[index];
        const fromBlast = runesApi.distance(enemy, rune);
        if (enemy.dead === false && fromBlast <= constants.crossRadius + enemy.radius) {
          const falloff = 1 - Math.min(0.55, fromBlast / constants.crossRadius * 0.55);
          damageEnemy(enemy, constants.crossDamage * falloff);
          const pushDistance = Math.max(1, fromBlast);
          enemy.x += (enemy.x - rune.x) / pushDistance * 24;
          enemy.y += (enemy.y - rune.y) / pushDistance * 24;
        } else {
          enemy.hitFlash = Math.max(0, enemy.hitFlash);
        }
      }
      showRuneToast("×", "Crossed-line burst", "The crossing releases stored ink.");
      updateReadouts();
    }

    function showRuneToast(mark, title, copy) {
      dom.runeToastMark.textContent = mark;
      dom.runeToastTitle.textContent = title;
      dom.runeToastCopy.textContent = copy;
      dom.runeToast.classList.add("visible");
      game.toastClock = 2.1;
    }

    function resizeCanvas() {
      game.pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      game.width = Math.max(320, window.innerWidth);
      game.height = Math.max(480, window.innerHeight);
      game.arenaTop = game.width <= 780 ? 112 : 84;
      canvas.width = Math.round(game.width * game.pixelRatio);
      canvas.height = Math.round(game.height * game.pixelRatio);
      context.setTransform(game.pixelRatio, 0, 0, game.pixelRatio, 0, 0);
      createPaperMarks();

      if (game.player === null) {
        resetRun();
        game.state = "ready";
        dom.startPanel.classList.add("visible");
      } else {
        game.player.x = clamp(game.player.x, 24, game.width - 24);
        game.player.y = clamp(game.player.y, game.arenaTop + 24, game.height - 24);
        game.brush.x = clamp(game.brush.x, 4, game.width - 4);
        game.brush.y = clamp(game.brush.y, game.arenaTop + 4, game.height - 4);
      }
    }

    function createPaperMarks() {
      const count = Math.ceil(game.width * game.height / 15000);
      game.paperMarks = [];
      for (let index = 0; index < count; index += 1) {
        game.paperMarks.push({
          x: seededNoise(index * 5.13) * game.width,
          y: seededNoise(index * 9.71 + 2) * game.height,
          length: 4 + seededNoise(index * 2.37 + 8) * 16,
          angle: seededNoise(index * 7.19 + 3) * Math.PI,
          alpha: 0.025 + seededNoise(index * 3.93 + 1) * 0.035,
        });
      }
    }

    function seededNoise(value) {
      const raw = Math.sin(value * 12.9898) * 43758.5453;
      return raw - Math.floor(raw);
    }

    function update(delta) {
      game.elapsed += delta;
      game.toastClock = Math.max(0, game.toastClock - delta);
      game.hintClock = Math.max(0, game.hintClock - delta);
      game.shake = Math.max(0, game.shake - delta * 18);
      game.player.invulnerable = Math.max(0, game.player.invulnerable - delta);
      updatePlayer(delta);
      updateTraces(delta);
      updateCircles(delta);
      updateSpawning(delta);
      updateEnemies(delta);
      effects.updateParticles(delta);
      effects.updateShockwaves(delta);
      updateInterfaceState();
      updateReadouts();
    }

    function updateAmbient(delta) {
      game.toastClock = Math.max(0, game.toastClock - delta);
      game.shake = Math.max(0, game.shake - delta * 18);
      effects.updateParticles(delta * 0.25);
      effects.updateShockwaves(delta * 0.25);
      updateInterfaceState();
    }

    function updatePlayer(delta) {
      const horizontal = Number(keys.has("KeyD") || keys.has("ArrowRight"))
        - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      const vertical = Number(keys.has("KeyS") || keys.has("ArrowDown"))
        - Number(keys.has("KeyW") || keys.has("ArrowUp"));
      const magnitude = Math.hypot(horizontal, vertical);

      if (magnitude > 0) {
        const movementX = horizontal / magnitude * game.player.speed * delta;
        const movementY = vertical / magnitude * game.player.speed * delta;
        game.player.x = clamp(game.player.x + movementX, 20, game.width - 20);
        game.player.y = clamp(game.player.y + movementY, game.arenaTop + 20, game.height - 20);
        game.player.moving = true;
      } else {
        game.player.moving = false;
      }

      dragBrush();

      if (game.brush.down) {
        sampleBrushStroke();
        if (game.player.ink <= 0) {
          finishStroke();
        } else {
          game.player.ink = Math.max(0, game.player.ink);
        }
      } else {
        game.player.ink = Math.min(
          game.player.maxInk,
          game.player.ink + constants.inkRecoveryPerSecond * delta,
        );
      }
    }

    function dragBrush() {
      const offsetX = game.player.x - game.brush.x;
      const offsetY = game.player.y - game.brush.y;
      const currentLength = Math.hypot(offsetX, offsetY);
      if (currentLength > constants.brushLength) {
        const excess = currentLength - constants.brushLength;
        game.brush.x += offsetX / currentLength * excess;
        game.brush.y += offsetY / currentLength * excess;
      } else {
        game.brush.x = clamp(game.brush.x, 3, game.width - 3);
        game.brush.y = clamp(game.brush.y, game.arenaTop + 3, game.height - 3);
      }
    }

    function sampleBrushStroke() {
      const points = game.brush.points;
      const previous = points[points.length - 1];
      const current = { x: game.brush.x, y: game.brush.y };
      const traveled = runesApi.distance(previous, current);
      if (traveled >= 3.5) {
        points.push(current);
        game.player.ink -= traveled * constants.inkCostPerPixel;
      } else {
        game.player.ink = Math.max(0, game.player.ink);
      }
    }

    function updateTraces(delta) {
      const living = [];
      for (let index = 0; index < game.traces.length; index += 1) {
        const trace = game.traces[index];
        trace.age += delta;
        trace.glow = Math.max(0, trace.glow - delta * 1.25);
        if (trace.age < trace.life) {
          living.push(trace);
        } else {
          effects.makeDryBrushPuff(trace.points[trace.points.length - 1].x, trace.points[trace.points.length - 1].y);
        }
      }
      game.traces = living;
    }

    function updateCircles(delta) {
      const living = [];
      for (let index = 0; index < game.circles.length; index += 1) {
        const circle = game.circles[index];
        circle.age += delta;
        circle.pulse += delta * 3;
        if (circle.age < circle.life) {
          living.push(circle);
        } else {
          effects.makeRuneSparks(circle.x, circle.y, "#527f73", 8);
        }
      }
      game.circles = living;
    }

    function updateSpawning(delta) {
      game.spawnClock -= delta;
      const maximumEnemies = Math.min(190, 75 + Math.floor(game.elapsed * 1.2));
      if (game.spawnClock <= 0 && game.enemies.length < maximumEnemies) {
        const groupSize = game.elapsed >= 70 ? 2 : 1;
        for (let count = 0; count < groupSize; count += 1) {
          spawnEnemy();
        }
        const baseInterval = Math.max(0.16, 0.76 - game.elapsed * 0.0062);
        game.spawnClock += baseInterval * (0.8 + Math.random() * 0.4);
      } else {
        game.spawnClock = Math.max(-0.2, game.spawnClock);
      }
    }

    function spawnEnemy() {
      const edge = Math.floor(Math.random() * 4);
      const radius = 8 + Math.random() * 7 + Math.min(3, game.elapsed / 70);
      const margin = radius + 20;
      let x = game.width * Math.random();
      let y = game.arenaTop + (game.height - game.arenaTop) * Math.random();

      if (edge === 0) {
        x = -margin;
      } else if (edge === 1) {
        x = game.width + margin;
      } else if (edge === 2) {
        y = game.arenaTop - margin;
      } else {
        y = game.height + margin;
      }

      const maximumHealth = 23 + radius * 1.55 + game.elapsed * 0.22;
      game.enemies.push({
        x,
        y,
        radius,
        health: maximumHealth,
        maximumHealth,
        speed: 39 + Math.random() * 23 + Math.min(22, game.elapsed * 0.16),
        wobble: Math.random() * Math.PI * 2,
        seed: Math.random() * 100,
        dead: false,
        hitFlash: 0,
      });
    }

    function updateEnemies(delta) {
      for (let index = 0; index < game.enemies.length; index += 1) {
        const enemy = game.enemies[index];
        if (enemy.dead) {
          enemy.hitFlash = 0;
        } else {
          moveEnemy(enemy, delta);
          damageEnemyWithInk(enemy, delta);
          damagePlayerOnContact(enemy);
          enemy.hitFlash = Math.max(0, enemy.hitFlash - delta * 5);
        }
      }

      const living = [];
      for (let index = 0; index < game.enemies.length; index += 1) {
        const enemy = game.enemies[index];
        if (enemy.dead) {
          game.defeated += 1;
          game.player.ink = Math.min(game.player.maxInk, game.player.ink + 1.8);
          effects.makeEnemySplash(enemy);
        } else {
          living.push(enemy);
        }
      }
      game.enemies = living;
    }

    function moveEnemy(enemy, delta) {
      const towardX = game.player.x - enemy.x;
      const towardY = game.player.y - enemy.y;
      const towardLength = Math.max(1, Math.hypot(towardX, towardY));
      let speedFactor = 1;

      for (let index = 0; index < game.circles.length; index += 1) {
        const circle = game.circles[index];
        const inside = Math.hypot(enemy.x - circle.x, enemy.y - circle.y) <= circle.radius;
        if (inside) {
          speedFactor = Math.min(speedFactor, 0.42);
        } else {
          speedFactor = Math.min(speedFactor, 1);
        }
      }

      enemy.wobble += delta * (2.1 + enemy.seed % 1.8);
      const sideX = -towardY / towardLength;
      const sideY = towardX / towardLength;
      const sway = Math.sin(enemy.wobble) * 0.14;
      enemy.x += (towardX / towardLength + sideX * sway) * enemy.speed * speedFactor * delta;
      enemy.y += (towardY / towardLength + sideY * sway) * enemy.speed * speedFactor * delta;
    }

    function damageEnemyWithInk(enemy, delta) {
      let damage = 0;
      for (let index = 0; index < game.traces.length; index += 1) {
        const trace = game.traces[index];
        const touching = runesApi.distanceToPath(enemy, trace.points)
          <= enemy.radius + trace.width * 0.6;
        if (touching) {
          const strength = Math.max(0.35, 1 - trace.age / trace.life);
          damage += constants.lineDamagePerSecond * strength * delta;
          trace.glow = 1;
        } else {
          damage += 0;
        }
      }

      if (game.brush.down && game.brush.points.length >= 2) {
        const touchingFreshInk = runesApi.distanceToPath(enemy, game.brush.points)
          <= enemy.radius + constants.brushWidth * 0.6;
        if (touchingFreshInk) {
          damage += constants.lineDamagePerSecond * 0.7 * delta;
        } else {
          damage += 0;
        }
      } else {
        damage += 0;
      }

      for (let index = 0; index < game.circles.length; index += 1) {
        const circle = game.circles[index];
        const inside = Math.hypot(enemy.x - circle.x, enemy.y - circle.y)
          <= circle.radius + enemy.radius;
        if (inside) {
          damage += 33 * delta;
        } else {
          damage += 0;
        }
      }

      if (damage > 0) {
        damageEnemy(enemy, damage);
      } else {
        enemy.hitFlash = Math.max(0, enemy.hitFlash);
      }
    }

    function damageEnemy(enemy, amount) {
      if (enemy.dead === false && amount > 0) {
        enemy.health -= amount;
        enemy.hitFlash = 1;
        if (enemy.health <= 0) {
          enemy.health = 0;
          enemy.dead = true;
        } else {
          enemy.dead = false;
        }
      } else {
        enemy.health = Math.max(0, enemy.health);
      }
    }

    function damagePlayerOnContact(enemy) {
      const contactDistance = game.player.radius + enemy.radius;
      const separation = Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y);
      const canHit = separation <= contactDistance && game.player.invulnerable <= 0;
      if (canHit) {
        game.player.health = Math.max(0, game.player.health - 13);
        game.player.invulnerable = 0.72;
        game.shake = Math.max(game.shake, 7);
        const safeSeparation = Math.max(1, separation);
        enemy.x -= (game.player.x - enemy.x) / safeSeparation * 24;
        enemy.y -= (game.player.y - enemy.y) / safeSeparation * 24;
        effects.makeRuneSparks(game.player.x, game.player.y, "#8e3029", 12);
        if (game.player.health <= 0) {
          endRun();
        } else {
          game.player.health = Math.max(0, game.player.health);
        }
      } else {
        enemy.x += 0;
      }
    }

    function updateInterfaceState() {
      dom.runeToast.classList.toggle("visible", game.toastClock > 0);
      const hintVisible = game.state === "playing"
        && game.hintClock > 0
        && game.brush.down === false;
      dom.drawHint.classList.toggle("visible", hintVisible);
    }

    function updateReadouts() {
      const healthRatio = game.player.health / game.player.maxHealth;
      const inkRatio = game.player.ink / game.player.maxInk;
      dom.healthValue.textContent = String(Math.ceil(game.player.health));
      dom.healthBar.style.transform = `scaleX(${clamp(healthRatio, 0, 1)})`;
      dom.inkValue.textContent = String(Math.ceil(game.player.ink));
      dom.inkBar.style.transform = `scaleX(${clamp(inkRatio, 0, 1)})`;
      dom.timeValue.textContent = formatTime(game.elapsed);
      dom.scoreValue.textContent = String(game.defeated);
      dom.runeValue.textContent = String(game.runeCount);
    }

    function formatTime(seconds) {
      const wholeSeconds = Math.max(0, Math.floor(seconds));
      const minutes = Math.floor(wholeSeconds / 60);
      const remainder = String(wholeSeconds % 60).padStart(2, "0");
      return `${minutes}:${remainder}`;
    }

    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    function frame(now) {
      const delta = Math.min(0.035, Math.max(0, (now - game.lastFrame) / 1000));
      game.lastFrame = now;
      if (game.state === "playing") {
        update(delta);
      } else {
        updateAmbient(delta);
      }
      renderer.render();
      requestAnimationFrame(frame);
    }

    const actionByCode = {
      Space: () => beginStroke(),
      KeyP: () => togglePause(),
      Enter: () => game.state === "ready" ? startRun() : false,
      KeyR: () => game.state === "defeated" ? startRun() : false,
    };

    window.addEventListener("keydown", (event) => {
      preventedCodes.has(event.code) ? event.preventDefault() : Boolean(event.defaultPrevented);
      keys.add(event.code);
      const action = actionByCode[event.code];
      typeof action === "function" && event.repeat === false ? action() : Boolean(action);
    });

    window.addEventListener("keyup", (event) => {
      keys.delete(event.code);
      event.code === "Space" ? finishStroke() : Boolean(event.code);
    });

    window.addEventListener("blur", () => {
      keys.clear();
      finishStroke();
    });

    canvas.addEventListener("pointerdown", (event) => {
      const primary = event.button === 0;
      if (primary) {
        event.preventDefault();
        game.brush.pointerDown = true;
        beginStroke();
        canvas.setPointerCapture(event.pointerId);
      } else {
        game.brush.pointerDown = false;
      }
    });

    canvas.addEventListener("pointerup", (event) => {
      game.brush.pointerDown = false;
      finishStroke();
      canvas.hasPointerCapture(event.pointerId)
        ? canvas.releasePointerCapture(event.pointerId)
        : Boolean(event.pointerId);
    });

    canvas.addEventListener("pointercancel", () => {
      game.brush.pointerDown = false;
      finishStroke();
    });

    dom.startButton.addEventListener("click", startRun);
    dom.restartButton.addEventListener("click", startRun);
    window.addEventListener("resize", resizeCanvas);
    movementCodes.forEach((code) => preventedCodes.add(code));
    resizeCanvas();
    requestAnimationFrame(frame);
  }
})();
