(() => {
  function render(ctx, game, canvas, roverImage) {
    const width = canvas.width;
    const height = canvas.height;
    const view = createView(game, canvas);
    ctx.clearRect(0, 0, width, height);
    drawSky(ctx, view);
    drawTrack(ctx, view);
    drawLevelZones(ctx, view, game);
    drawObjectives(ctx, view, game);
    drawFinish(ctx, view, game);
    drawHazards(ctx, view, game);
    drawEnemies(ctx, view, game);
    drawShots(ctx, view, game);
    drawPlayerMoon(ctx, view, game, roverImage);
    drawAim(ctx, view, game);
    drawOverlay(ctx, game, width, height, view.pixelRatio);
  }

  function createView(game, canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const pixelRatio = canvas.getBoundingClientRect ? width / Math.max(1, canvas.getBoundingClientRect().width) : 1;
    const player = playerScreenPosition(game, canvas);
    return {
      width,
      height,
      pixelRatio,
      centerX: width / 2,
      horizon: height * 0.32,
      playerX: player.x,
      playerY: player.y,
      playerRadius: player.radius,
      cameraX: game.rover.worldX,
      cameraLane: game.rover.lane ?? 0,
      viewDistance: 980,
      laneScale: width * 0.46 / 180
    };
  }

  function playerScreenPosition(game, canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const pixelRatio = canvas.getBoundingClientRect ? width / Math.max(1, canvas.getBoundingClientRect().width) : 1;
    const radius = clamp(42 * pixelRatio, 28 * pixelRatio, Math.min(width, height) * 0.08);
    return {
      x: width / 2,
      y: Math.min(height - radius - 24 * pixelRatio, height * 0.77),
      radius
    };
  }

  function drawSky(ctx, view) {
    const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
    gradient.addColorStop(0, "#06101f");
    gradient.addColorStop(0.5, "#143047");
    gradient.addColorStop(1, "#101816");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);

    ctx.fillStyle = "#f5efbf";
    ctx.beginPath();
    ctx.arc(view.width * 0.82, view.height * 0.16, 34 * view.pixelRatio, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dff6ff";
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 127 - view.cameraX * 0.06) % (view.width + 80 * view.pixelRatio);
      const y = 20 * view.pixelRatio + (i * 43) % Math.max(1, view.horizon - 24 * view.pixelRatio);
      ctx.fillRect(x < 0 ? x + view.width + 80 * view.pixelRatio : x, y, 2 * view.pixelRatio, 2 * view.pixelRatio);
    }

    ctx.fillStyle = "#1d3a4c";
    for (let i = -2; i < 11; i += 1) {
      const base = i * view.width * 0.12 - (view.cameraX * 0.09) % (view.width * 0.12);
      ctx.beginPath();
      ctx.moveTo(base, view.horizon + 38 * view.pixelRatio);
      ctx.lineTo(base + view.width * 0.08, view.horizon - (20 + (i % 3) * 12) * view.pixelRatio);
      ctx.lineTo(base + view.width * 0.18, view.horizon + 38 * view.pixelRatio);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTrack(ctx, view) {
    const bottom = view.height;
    const topLeft = view.centerX - view.width * 0.13;
    const topRight = view.centerX + view.width * 0.13;
    const bottomLeft = -view.width * 0.12;
    const bottomRight = view.width * 1.12;

    ctx.fillStyle = "#111816";
    ctx.fillRect(0, view.horizon, view.width, view.height - view.horizon);

    const trackGradient = ctx.createLinearGradient(0, view.horizon, 0, bottom);
    trackGradient.addColorStop(0, "#6f7e61");
    trackGradient.addColorStop(1, "#38422f");
    ctx.fillStyle = trackGradient;
    ctx.beginPath();
    ctx.moveTo(topLeft, view.horizon);
    ctx.lineTo(topRight, view.horizon);
    ctx.lineTo(bottomRight, bottom);
    ctx.lineTo(bottomLeft, bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(207, 217, 155, 0.35)";
    ctx.lineWidth = 2 * view.pixelRatio;
    for (const lane of [-180, -90, 0, 90, 180]) {
      const far = projectGround(view, view.cameraX + view.viewDistance, lane);
      const near = projectGround(view, view.cameraX, lane);
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(near.x, near.y + view.playerRadius * 1.8);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(13, 21, 18, 0.28)";
    for (let z = 120; z <= view.viewDistance; z += 120) {
      const center = projectGround(view, view.cameraX + z, view.cameraLane);
      const width = view.width * 0.08 + (1 - z / view.viewDistance) * view.width * 1.1;
      ctx.beginPath();
      ctx.moveTo(center.x - width / 2, center.y);
      ctx.lineTo(center.x + width / 2, center.y);
      ctx.stroke();
    }
  }

  function drawFinish(ctx, view, game) {
    const p = projectGround(view, game.finish, 0);
    if (!p.visible) {
      return;
    }
    ctx.strokeStyle = "#f4e673";
    ctx.lineWidth = 4 * view.pixelRatio * p.scale;
    ctx.beginPath();
    ctx.moveTo(p.x - 120 * view.pixelRatio * p.scale, p.y);
    ctx.lineTo(p.x + 120 * view.pixelRatio * p.scale, p.y);
    ctx.stroke();
  }

  function drawLevelZones(ctx, view, game) {
    for (const zone of game.level.shadowZones ?? []) {
      drawGroundZone(ctx, view, zone, "rgba(4, 7, 10, 0.42)", "rgba(12, 16, 20, 0.52)");
    }
    for (const zone of game.level.enemySpawnZones ?? []) {
      drawGroundZone(ctx, view, zone, "rgba(63, 181, 200, 0.08)", "rgba(102, 213, 219, 0.22)");
    }
    for (const zone of game.level.safeZones ?? []) {
      drawGroundZone(ctx, view, zone, "rgba(197, 220, 130, 0.15)", "rgba(230, 236, 159, 0.32)");
    }
    if (game.level.landingSite) {
      drawGroundZone(ctx, view, game.level.landingSite, "rgba(214, 217, 188, 0.24)", "rgba(245, 239, 191, 0.5)");
    }
  }

  function drawObjectives(ctx, view, game) {
    for (const objective of game.level.objectives ?? []) {
      const p = projectGround(view, objective.x, laneForEntity(objective));
      if (!p.visible) {
        continue;
      }
      const w = Math.max(8 * view.pixelRatio, objective.w * p.scale * view.pixelRatio);
      const h = Math.max(18 * view.pixelRatio, objective.h * p.scale * view.pixelRatio);
      ctx.strokeStyle = objective.type === "finish" ? "#f4e673" : "#8fd1d3";
      ctx.lineWidth = 3 * view.pixelRatio * p.scale;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - h);
      ctx.stroke();
      ctx.fillStyle = objective.type === "finish" ? "#f4e673" : "#8fd1d3";
      ctx.beginPath();
      ctx.arc(p.x, p.y - h, w * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHazards(ctx, view, game) {
    const hazards = game.terrain.filter((hazard) => hazard.active).sort((a, b) => b.x - a.x);
    for (const hazard of hazards) {
      const lane = laneForEntity(hazard);
      const p = projectGround(view, hazard.x, lane);
      if (!p.visible) {
        continue;
      }
      const w = Math.max(14 * view.pixelRatio, hazard.w * p.scale * view.pixelRatio);
      const h = Math.max(10 * view.pixelRatio, hazard.h * p.scale * view.pixelRatio);
      if (hazard.type === "crater") {
        ctx.fillStyle = "#101713";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + h * 0.12, w * 0.72, h * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (hazard.type === "ridge") {
        ctx.fillStyle = "#aab77b";
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.62, p.y);
        ctx.lineTo(p.x, p.y - h);
        ctx.lineTo(p.x + w * 0.62, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (hazard.type === "ramp" || hazard.type === "slope") {
        ctx.fillStyle = "#89986b";
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.72, p.y);
        ctx.lineTo(p.x + w * 0.62, p.y - h);
        ctx.lineTo(p.x + w * 0.78, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (hazard.type === "turret") {
        ctx.fillStyle = "#b9c790";
        ctx.fillRect(p.x - w * 0.35, p.y - h, w * 0.7, h);
        ctx.fillStyle = "#1d2725";
        ctx.fillRect(p.x - w * 0.55, p.y - h * 1.18, w * 1.1, h * 0.28);
      } else {
        ctx.fillStyle = "#555f4c";
        ctx.beginPath();
        ctx.arc(p.x, p.y - h * 0.35, Math.max(w, h) * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawEnemies(ctx, view, game) {
    const enemies = game.enemies.filter((enemy) => enemy.active || enemy.defeatFlash > 0).sort((a, b) => b.x - a.x);
    for (const enemy of enemies) {
      const p = projectGround(view, enemy.x, laneForEntity(enemy));
      if (!p.visible) {
        continue;
      }
      const altitude = (game.bounds.groundY - enemy.y) * p.scale * view.pixelRatio * 0.75;
      const x = p.x;
      const y = p.y - Math.max(50 * view.pixelRatio * p.scale, altitude);
      const w = enemy.w * p.scale * view.pixelRatio;
      const h = enemy.h * p.scale * view.pixelRatio;
      if (!enemy.alive) {
        drawEnemyDefeat(ctx, view, enemy, x, y, w, h);
      } else if (enemy.type === "werewolf") {
        drawWerewolf(ctx, view, enemy, p, w, h);
        drawEnemyHealth(ctx, enemy, p.x, p.y - h * 1.55, w);
      } else if (enemy.type === "vampire") {
        drawVampire(ctx, view, enemy, x, y, w, h);
        drawEnemyHealth(ctx, enemy, x, y - h * 0.95, w);
      } else if (enemy.type === "bomb") {
        ctx.fillStyle = "#d8e0c4";
        ctx.beginPath();
        ctx.moveTo(x, y - h * 0.7);
        ctx.lineTo(x + w * 0.45, y + h * 0.35);
        ctx.lineTo(x, y + h * 0.72);
        ctx.lineTo(x - w * 0.45, y + h * 0.35);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = "#8fd1d3";
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.72, h * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f0df69";
        ctx.fillRect(x - w * 0.25, y - h * 0.1, w * 0.5, h * 0.18);
      }
    }
  }

  function drawWerewolf(ctx, view, enemy, p, w, h) {
    const x = p.x;
    const y = p.y - h * 0.52;
    ctx.fillStyle = enemyFill(enemy, "#3a312a");
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.58, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.attackFlash > 0 ? "#f06f4f" : "#d8d1a1";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.38, y - h * 0.46);
    ctx.lineTo(x - w * 0.18, y - h * 0.88);
    ctx.lineTo(x - w * 0.02, y - h * 0.42);
    ctx.lineTo(x + w * 0.24, y - h * 0.84);
    ctx.lineTo(x + w * 0.38, y - h * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = enemy.spawnFlash > 0 ? "rgba(244, 230, 115, 0.85)" : "rgba(216, 209, 161, 0.45)";
    ctx.lineWidth = 2 * view.pixelRatio;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, p.y - h * 0.12);
    ctx.lineTo(x + w * 0.62, p.y - h * 0.12);
    ctx.stroke();
  }

  function drawVampire(ctx, view, enemy, x, y, w, h) {
    ctx.fillStyle = enemyFill(enemy, "#32253b");
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.42);
    ctx.lineTo(x - w * 0.92, y + h * 0.18);
    ctx.lineTo(x - w * 0.28, y + h * 0.36);
    ctx.lineTo(x, y + h * 0.16);
    ctx.lineTo(x + w * 0.28, y + h * 0.36);
    ctx.lineTo(x + w * 0.92, y + h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = enemy.attackFlash > 0 ? "#f06f4f" : "#d8d1a1";
    ctx.beginPath();
    ctx.arc(x, y - h * 0.24, Math.max(4 * view.pixelRatio, h * 0.18), 0, Math.PI * 2);
    ctx.fill();
    if (enemy.spawnFlash > 0) {
      ctx.strokeStyle = "rgba(244, 230, 115, 0.82)";
      ctx.lineWidth = 2 * view.pixelRatio;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) * 0.74, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemyHealth(ctx, enemy, x, y, w) {
    if (!Number.isFinite(enemy.maxHealth) || enemy.maxHealth <= 1) {
      return;
    }
    const width = Math.max(18, w * 0.9);
    const fill = Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
    ctx.fillStyle = "rgba(5, 9, 14, 0.72)";
    ctx.fillRect(x - width / 2, y, width, 4);
    ctx.fillStyle = fill > 0.45 ? "#d8d1a1" : "#f06f4f";
    ctx.fillRect(x - width / 2, y, width * fill, 4);
  }

  function drawEnemyDefeat(ctx, view, enemy, x, y, w, h) {
    const amount = Math.max(0, Math.min(1, enemy.defeatFlash / 0.45));
    ctx.strokeStyle = `rgba(244, 230, 115, ${amount})`;
    ctx.lineWidth = 3 * view.pixelRatio;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(w, h) * (0.45 + (1 - amount) * 0.8), 0, Math.PI * 2);
    ctx.stroke();
  }

  function enemyFill(enemy, base) {
    if (enemy.hitFlash > 0) {
      return "#f4e673";
    } else if (enemy.attackFlash > 0) {
      return "#7e3330";
    }
    return base;
  }

  function drawShots(ctx, view, game) {
    ctx.fillStyle = "#f7df5f";
    for (const shot of game.shots) {
      const p = projectGround(view, shot.x, shot.lane ?? game.rover.lane);
      if (!p.visible) {
        continue;
      }
      const y = p.y + (shot.y - game.bounds.groundY) * p.scale * view.pixelRatio;
      const r = Math.max(3 * view.pixelRatio, 5 * view.pixelRatio * p.scale);
      ctx.beginPath();
      ctx.arc(p.x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayerMoon(ctx, view, game, roverImage) {
    const x = view.playerX;
    const y = view.playerY;
    const r = view.playerRadius;
    const sphere = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
    sphere.addColorStop(0, "#fbf5c9");
    sphere.addColorStop(0.58, "#cfd2bb");
    sphere.addColorStop(1, "#7f8a85");
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.98, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(game.rover.roll);
    ctx.strokeStyle = "rgba(86, 97, 91, 0.36)";
    ctx.lineWidth = 2 * view.pixelRatio;
    for (let offset = -2; offset <= 2; offset += 1) {
      ctx.beginPath();
      ctx.ellipse(offset * r * 0.34, 0, r * 0.18, r * 1.05, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(77, 88, 83, 0.42)";
    for (const crater of [[-0.32, -0.18, 0.13], [0.22, -0.3, 0.09], [0.28, 0.22, 0.15], [-0.1, 0.28, 0.08]]) {
      ctx.beginPath();
      ctx.ellipse(x + crater[0] * r, y + crater[1] * r, crater[2] * r, crater[2] * r * 0.72, game.rover.roll * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.rover.damageFlash > 0 || game.rover.invulnerable) {
      ctx.strokeStyle = game.rover.damageFlash > 0 ? "rgba(240, 111, 79, 0.95)" : "rgba(244, 230, 115, 0.62)";
      ctx.lineWidth = 4 * view.pixelRatio;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.08, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawAim(ctx, view, game) {
    const aim = game.rover.aim;
    const length = view.playerRadius * 2.6;
    const x = view.playerX + aim.x * length;
    const y = view.playerY + aim.y * length;
    ctx.strokeStyle = "rgba(247, 223, 95, 0.9)";
    ctx.lineWidth = 3 * view.pixelRatio;
    ctx.beginPath();
    ctx.moveTo(view.playerX, view.playerY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(247, 223, 95, 0.78)";
    ctx.lineWidth = 2 * view.pixelRatio;
    ctx.beginPath();
    ctx.arc(x, y, 12 * view.pixelRatio, 0, Math.PI * 2);
    ctx.moveTo(x - 18 * view.pixelRatio, y);
    ctx.lineTo(x + 18 * view.pixelRatio, y);
    ctx.moveTo(x, y - 18 * view.pixelRatio);
    ctx.lineTo(x, y + 18 * view.pixelRatio);
    ctx.stroke();
  }

  function drawOverlay(ctx, game, width, height, pixelRatio) {
    if (game.state === "play") {
      return;
    }
    ctx.fillStyle = "rgba(5, 9, 14, 0.72)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f4f1cc";
    ctx.textAlign = "center";
    ctx.font = `${42 * pixelRatio}px system-ui, sans-serif`;
    ctx.fillText(game.state === "pause" ? "Paused" : game.message, width / 2, height / 2 - 20 * pixelRatio);
    ctx.font = `${18 * pixelRatio}px system-ui, sans-serif`;
    ctx.fillText("R restarts", width / 2, height / 2 + 28 * pixelRatio);
    ctx.textAlign = "left";
  }

  function projectGround(view, worldX, lane) {
    const dz = worldX - view.cameraX;
    const depth = clamp(dz / view.viewDistance, 0, 1);
    const perspective = Math.pow(1 - depth, 1.32);
    const y = view.horizon + perspective * (view.playerY + view.playerRadius * 1.7 - view.horizon);
    const x = view.centerX + (lane - view.cameraLane) * view.laneScale * (0.2 + perspective * 0.8);
    return {
      x,
      y,
      scale: 0.22 + perspective * 1.08,
      visible: dz > -120 && dz < view.viewDistance
    };
  }

  function drawGroundZone(ctx, view, zone, fillStyle, strokeStyle) {
    if (!zoneVisible(view, zone)) {
      return;
    }
    const leftLane = Number.isFinite(zone.laneLeft) ? zone.laneLeft : -180;
    const rightLane = Number.isFinite(zone.laneRight) ? zone.laneRight : 180;
    const nearX = zone.x;
    const farX = zone.x + zone.w;
    const nearLeft = projectGround(view, nearX, leftLane);
    const nearRight = projectGround(view, nearX, rightLane);
    const farRight = projectGround(view, farX, rightLane);
    const farLeft = projectGround(view, farX, leftLane);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(farLeft.x, farLeft.y);
    ctx.lineTo(farRight.x, farRight.y);
    ctx.lineTo(nearRight.x, nearRight.y + view.playerRadius * 1.2);
    ctx.lineTo(nearLeft.x, nearLeft.y + view.playerRadius * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2 * view.pixelRatio;
    ctx.stroke();
  }

  function zoneVisible(view, zone) {
    return zone.x + zone.w > view.cameraX - 120 && zone.x < view.cameraX + view.viewDistance;
  }

  function laneForEntity(entity) {
    return Number.isFinite(entity.lane) ? entity.lane : laneForId(entity.id);
  }

  function laneForId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return [-125, 0, 125][hash % 3];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  window.MoonPatrolRender = { render, playerScreenPosition };
})();
