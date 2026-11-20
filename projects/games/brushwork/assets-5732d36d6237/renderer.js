"use strict";

(function attachBrushworkRenderer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrushworkRenderer = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createBrushworkRendererApi() {
  function create(options) {
    const valid = options !== null
      && typeof options === "object"
      && options.context !== null
      && typeof options.game === "object"
      && typeof options.constants === "object"
      && typeof options.seededNoise === "function";

    if (valid) {
      return makeRenderer(
        options.context,
        options.game,
        options.constants,
        options.seededNoise,
      );
    } else {
      throw new TypeError("BrushworkRenderer.create requires context, game, constants, and seededNoise");
    }
  }

  function makeRenderer(context, game, constants, seededNoise) {
    let paper = null;

    function render() {
      context.setTransform(game.pixelRatio, 0, 0, game.pixelRatio, 0, 0);
      drawPaper();
      context.save();
      const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
      const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
      context.translate(shakeX, shakeY);
      drawPortals();
      drawCircles();
      drawTraces();
      drawCurrentStroke();
      drawDrops();
      drawEnemies();
      drawPlayerAndBrush();
      drawShockwaves();
      drawParticles();
      drawFeedback();
      context.restore();
      drawJoystick();
    }

    function drawPaper() {
      if (paper === null || paper.width !== context.canvas.width || paper.height !== context.canvas.height
          || paper.arenaTop !== game.arenaTop) {
        paper = document.createElement("canvas");
        paper.width = context.canvas.width;
        paper.height = context.canvas.height;
        paper.arenaTop = game.arenaTop;
        paintPaper(paper.getContext("2d"));
      }
      context.drawImage(paper, 0, 0, game.width, game.height);
    }

    function paintPaper(ink) {
      const { width, height, arenaTop, pixelRatio } = game;
      const field = height - arenaTop;
      const centerY = arenaTop + field * 0.5;
      ink.scale(pixelRatio, pixelRatio);
      const wash = ink.createRadialGradient(width * 0.52, centerY, 0, width * 0.52, centerY, Math.hypot(width, field) * 0.55);
      wash.addColorStop(0, "#faf3db");
      wash.addColorStop(0.53, "#eee4cb");
      wash.addColorStop(1, "#c8c0a6");
      ink.fillStyle = wash;
      ink.fillRect(0, 0, width, height);

      drawRidges(ink, width * 0.68, arenaTop + field * 0.29, width * 0.47, field * 0.34);
      drawRidges(ink, -width * 0.06, height + 15, width * 0.75, field * 0.31);
      drawReeds(ink, width * 0.055, height + 14, Math.min(0.95, field / 660));
      ink.save();
      ink.translate(width * 0.956, arenaTop - 11);
      ink.rotate(Math.PI);
      drawReeds(ink, 0, 0, Math.min(0.75, field / 820));
      ink.restore();

      ink.lineWidth = 1;
      for (let i = 0; i < width * field / 78; i += 1) {
        const x = seededNoise(i + 3) * width;
        const y = arenaTop + seededNoise(i * 7.73) * field;
        const length = 1 + seededNoise(i * 2.3) * 5;
        ink.strokeStyle = i % 4 === 0 ? "#fffcf550" : "#5751400e";
        ink.beginPath();
        ink.moveTo(x, y);
        ink.lineTo(x + length, y + seededNoise(i * 0.24) * 1.6);
        ink.stroke();
      }

      const inset = width < 600 ? 9 : 18;
      ink.strokeStyle = "#6c695638";
      ink.strokeRect(inset, arenaTop + inset, width - inset * 2, field - inset * 2);
      ink.strokeStyle = "#fffdf474";
      ink.strokeRect(inset + 4, arenaTop + inset + 4, width - (inset + 4) * 2, field - (inset + 4) * 2);
    }

    function drawRidges(ink, left, base, width, height) {
      for (let layer = 0; layer < 3; layer += 1) {
        ink.beginPath();
        ink.moveTo(left, base);
        for (let step = 0; step <= 22; step += 1) {
          const t = step / 22;
          const silhouette = 0.37 + Math.sin(t * 11 + layer * 1.4) * 0.17
            + seededNoise(step * 0.73 + layer * 8) * 0.23;
          const x = left + t * width;
          const y = base - Math.sin(t * Math.PI) * height * silhouette * (1 - layer * 0.23);
          ink.lineTo(x, y);
        }
        ink.lineTo(left + width, base);
        ink.closePath();
        const wash = ink.createLinearGradient(left, base - height, left, base);
        wash.addColorStop(0, layer === 0 ? "#435a6980" : "#46616785");
        wash.addColorStop(1, layer === 0 ? "#435a6900" : "#46616700");
        ink.fillStyle = wash;
        ink.fill();
      }
    }

    function drawReeds(ink, x, y, scale) {
      ink.save();
      ink.translate(x, y);
      ink.scale(scale, scale);
      ink.lineCap = "round";
      for (let stem = 0; stem < 7; stem += 1) {
        const lean = (stem - 2) * 13;
        const height = 91 + seededNoise(stem * 3.1) * 114;
        const base = stem * 10 - 22;
        ink.strokeStyle = "#42575151";
        ink.lineWidth = 1.7;
        ink.beginPath();
        ink.moveTo(base, 0);
        ink.quadraticCurveTo(base + lean * 0.35, -height * 0.53, base + lean, -height);
        ink.stroke();
        for (let i = 1; i < 5; i += 1) {
          const t = 0.33 + 0.14 * i;
          const px = base + lean * (0.7 * t * (1 - t) + t * t);
          const py = -height * t;
          const side = (i + stem) % 2 === 0 ? -1 : 1;
          const length = (20 + seededNoise(stem * 2 + i * 0.9) * 29) * side;
          ink.beginPath();
          ink.moveTo(px, py);
          ink.quadraticCurveTo(px + length * 0.42, py - 21, px + length, py - 14);
          ink.quadraticCurveTo(px + length * 0.65, py - 12, px, py);
          ink.fillStyle = i % 2 === 0 ? "#374c4857" : "#51695b4b";
          ink.fill();
        }
      }
      ink.restore();
    }

    function drawTraces() {
      for (let index = 0; index < game.traces.length; index += 1) {
        const trace = game.traces[index];
        const remaining = Math.max(0, 1 - trace.age / trace.life);
        drawInkPath(trace.points, trace.width + 4, `rgba(21, 24, 18, ${remaining * 0.12})`);
        drawInkPath(trace.points, trace.width, `rgba(24, 27, 20, ${remaining * 0.74})`);
        drawInkPath(trace.points, Math.max(1, trace.width * 0.24), `rgba(64, 69, 53, ${remaining * 0.48})`);
        drawActivatedTrace(trace, remaining);
      }
    }

    function drawActivatedTrace(trace, remaining) {
      const circleColors = trace.magic === "circle";
      const crossColors = trace.magic === "cross";
      const core = circleColors ? "99, 225, 190" : crossColors ? "242, 93, 70" : "238, 172, 72";
      const halo = circleColors ? "37, 155, 132" : crossColors ? "181, 42, 40" : "213, 92, 36";
      const energy = 0.22 + trace.glow * 0.78;
      const step = Math.max(4, Math.ceil(trace.points.length / 14));
      const offset = Math.floor(game.elapsed * 18) % step;

      context.save();
      context.globalCompositeOperation = "screen";
      drawInkPath(trace.points, 13 + trace.glow * 5, `rgba(${halo}, ${remaining * energy * 0.23})`);
      context.setLineDash([5, 9]);
      context.lineDashOffset = -game.elapsed * 24;
      drawInkPath(
        trace.points,
        2.2 + trace.glow * 2.2,
        `rgba(${core}, ${remaining * (0.3 + energy * 0.62)})`,
      );
      context.setLineDash([]);

      for (let index = offset; index < trace.points.length; index += step) {
        const point = trace.points[index];
        const phase = game.elapsed * 7.5 + index * 0.63;
        const flicker = 0.5 + Math.sin(phase) * 0.5;
        const height = 3 + flicker * 4 + trace.glow * 4;
        const x = point.x + Math.sin(phase * 1.7) * 2.2;
        const y = point.y - 1;
        context.fillStyle = `rgba(${core}, ${remaining * energy * (0.34 + flicker * 0.48)})`;
        context.beginPath();
        context.moveTo(x - 2, y + 2);
        context.quadraticCurveTo(x - 1, y - height * 0.45, x + Math.sin(phase) * 1.5, y - height);
        context.quadraticCurveTo(x + 3, y - height * 0.28, x + 2, y + 2);
        context.closePath();
        context.fill();
      }
      context.restore();
    }

    function drawCurrentStroke() {
      if (game.live !== null) {
        const { points, length } = game.live;
        drawInkPath(points, constants.brushWidth + 5, "#26333224");
        drawInkPath(points, constants.brushWidth, "#243333");
        drawInkPath(points, 1.5, "#b4bea083");
        if (length > 88) {
          const start = points[0];
          const tip = points[points.length - 1];
          const near = Math.hypot(start.x - tip.x, start.y - tip.y) < 34;
          context.beginPath();
          context.arc(start.x, start.y, near ? 9 : 5, 0, Math.PI * 2);
          context.strokeStyle = near ? "#278675" : "#687f71a0";
          context.lineWidth = 2;
          context.stroke();
        }
      }
    }

    function drawInkPath(points, width, color) {
      if (points.length >= 2) {
        context.save();
        context.strokeStyle = color;
        context.lineWidth = width;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) {
          context.lineTo(points[index].x, points[index].y);
        }
        context.stroke();
        context.restore();
      } else {
        context.globalAlpha = 1;
      }
    }

    function drawCircles() {
      for (let index = 0; index < game.circles.length; index += 1) {
        const circle = game.circles[index];
        const remaining = Math.max(0, 1 - circle.age / circle.life);
        const breathing = 1 + Math.sin(circle.pulse) * 0.025;
        context.save();
        context.translate(circle.x, circle.y);
        context.scale(breathing, breathing);
        context.fillStyle = `rgba(76, 137, 119, ${remaining * 0.11})`;
        context.strokeStyle = `rgba(55, 114, 99, ${remaining * 0.8})`;
        context.lineWidth = 2;
        context.setLineDash([5, 9]);
        context.beginPath();
        context.arc(0, 0, circle.radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.setLineDash([]);
        context.strokeStyle = `rgba(59, 104, 92, ${remaining * 0.4})`;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(0, 0, circle.radius * 0.77, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = `rgba(46, 93, 82, ${remaining * 0.75})`;
        context.rotate(circle.pulse * 0.2);
        for (let i = 0; i < 4; i += 1) {
          context.rotate(Math.PI / 2);
          context.fillRect(circle.radius * 0.68, -2, circle.radius * 0.19, 4);
        }
        context.restore();
      }
    }

    function drawPortals() {
      for (const portal of game.portals) {
        const progress = portal.age / portal.life;
        const radius = portal.type === "blot" ? 22 + progress * 16 : 16 + progress * 11;
        context.save();
        context.translate(portal.x, portal.y);
        context.rotate(progress * 1.8);
        context.strokeStyle = portal.type === "blot" ? "#8a3150"
          : portal.type === "dart" ? "#a63f32" : portal.type === "shell" ? "#716038" : "#56756b";
        context.lineWidth = 1.5;
        context.setLineDash([6, 5]);
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#3b4645" + Math.round(28 + progress * 90).toString(16).padStart(2, "0");
        context.beginPath();
        context.arc(0, 0, progress * 14, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    function drawDrops() {
      for (const drop of game.drops) {
        const radius = 6 + Math.sin(drop.age * 7) * 0.6;
        context.save();
        context.translate(drop.x, drop.y - 3);
        context.globalAlpha = Math.min(1, drop.life - drop.age);
        context.fillStyle = "#247970";
        context.strokeStyle = "#d5ead0";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(0, -radius * 1.6);
        context.quadraticCurveTo(radius * 1.8, 1, radius * 0.72, radius * 0.76);
        context.quadraticCurveTo(0, radius * 1.65, -radius * 0.72, radius * 0.76);
        context.quadraticCurveTo(-radius * 1.8, 1, 0, -radius * 1.6);
        context.fill();
        context.stroke();
        context.restore();
      }
    }

    function drawEnemies() {
      const ordered = [...game.enemies].sort((a, b) => a.y - b.y);
      for (const enemy of ordered) {
        if (enemy.type === "blot" && enemy.charge > 0) {
          drawPulseWarning(enemy);
        } else if (enemy.type === "dart" && enemy.charge > 0.25) {
          const length = 86;
          context.strokeStyle = "#b84e40b0";
          context.lineWidth = 2;
          context.setLineDash([4, 4]);
          context.beginPath();
          context.moveTo(enemy.x, enemy.y);
          context.lineTo(enemy.x + enemy.aimX * length, enemy.y + enemy.aimY * length);
          context.stroke();
          context.setLineDash([]);
        }
        drawEnemy(enemy);
      }
    }

    function drawPulseWarning(enemy) {
      const radius = enemy.pulseRadius;
      const progress = 1 - enemy.charge / enemy.windup;
      context.save();
      context.fillStyle = "rgba(159, 47, 62, " + (0.06 + progress * 0.11) + ")";
      context.strokeStyle = "#a33e4b";
      context.lineWidth = 2;
      context.setLineDash([6, 4]);
      context.beginPath();
      context.arc(enemy.x, enemy.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(enemy.x, enemy.y, Math.max(3, radius * progress), 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    function drawEnemy(enemy) {
      const { radius, type } = enemy;
      const heading = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
      context.save();
      context.translate(enemy.x, enemy.y);
      context.fillStyle = "#23323029";
      context.beginPath();
      context.ellipse(3, radius * 0.6, radius * 1.27, radius * 0.47, 0, 0, Math.PI * 2);
      context.fill();
      context.rotate(heading);

      const sides = type === "shell" ? 8 : type === "dart" ? 5 : 12;
      context.beginPath();
      for (let side = 0; side < sides; side += 1) {
        const angle = side / sides * Math.PI * 2;
        const fringe = 0.90 + seededNoise(enemy.seed + side * 4.17) * 0.26;
        const stretch = type === "dart" ? 1.28 : 1 + Math.sin(enemy.wobble) * 0.12;
        const x = Math.cos(angle) * radius * fringe * stretch;
        const y = Math.sin(angle) * radius * fringe;
        if (side === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.closePath();
      const ink = context.createLinearGradient(-radius, -radius, radius, radius);
      ink.addColorStop(0, enemy.hitFlash > 0 ? "#b47951" : type === "blot" ? "#893f53" : type === "dart" ? "#9d4c3e" : "#4c625f");
      ink.addColorStop(1, enemy.hitFlash > 0 ? "#834335" : "#192626");
      context.fillStyle = ink;
      context.strokeStyle = type === "shell" ? "#676051" : "#213032";
      context.lineWidth = type === "shell" ? 3 : 1.7;
      context.fill();
      context.stroke();

      const eye = type === "blot" ? "#ffa082" : type === "shell" ? "#ebc087" : "#fbdfab";
      context.fillStyle = eye;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.ellipse(radius * 0.36, side * radius * 0.29, 2.4, 1.5, side * 0.3, 0, Math.PI * 2);
        context.fill();
      }
      if (type === "blot") {
        context.strokeStyle = "#e3947d";
        context.lineWidth = 1.5;
        for (const angle of [-Math.PI / 4, 0, Math.PI / 4]) {
          context.beginPath();
          context.arc(1, 0, radius * 0.72, angle - 0.2, angle + 0.2);
          context.stroke();
        }
      } else if (type === "shell") {
        context.strokeStyle = "#dfbf7ba3";
        context.lineWidth = 1.25;
        context.beginPath();
        context.arc(-radius * 0.12, 0, radius * 0.71, Math.PI * 0.35, Math.PI * 1.65);
        context.stroke();
      }
      context.restore();

      if (enemy.health < enemy.maximumHealth) {
        const width = radius * 1.65;
        const x = enemy.x - width / 2;
        const y = enemy.y - radius - 7;
        context.fillStyle = "#514f4351";
        context.fillRect(x, y, width, 2);
        context.fillStyle = "#a43c30";
        context.fillRect(x, y, width * enemy.health / enemy.maximumHealth, 2);
      }
    }

    function drawPlayerAndBrush() {
      const { player, brush } = game;
      const { dx, dy, dash, moving } = player;
      const painting = game.live !== null;
      const pointer = painting && brush.pointer;
      const angle = pointer && game.live.points.length > 1
        ? brushAngle(game.live.points) : Math.atan2(player.y - brush.y, player.x - brush.x);

      if (dash > 0) {
        context.lineCap = "round";
        context.lineWidth = 14;
        context.strokeStyle = player.dashStrike ? "#2d847e59" : "#9f43334d";
        context.beginPath();
        context.moveTo(player.x - dx * 10, player.y - dy * 10 + 4);
        context.lineTo(player.x - dx * 47, player.y - dy * 47 + 4);
        context.stroke();
      }

      if (!pointer) {
        drawBrush(brush.x, brush.y, angle, painting);
      }

      context.save();
      context.translate(player.x, player.y);
      context.strokeStyle = "#365d5870";
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(0, 6, 16, 10, 0, 0, Math.PI * 2);
      context.stroke();
      const readiness = 1 - player.cooldown / constants.dashCooldown;
      context.strokeStyle = "#377d71";
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(0, 6, 16, 10, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * readiness);
      context.stroke();
      context.fillStyle = "#3d3b313b";
      context.beginPath();
      context.ellipse(3, 6, 13, 6, 0, 0, Math.PI * 2);
      context.fill();

      const hit = player.invulnerable > 0.28 && Math.floor(player.invulnerable * 17) % 2 === 0;
      context.globalAlpha = hit ? 0.48 : 1;
      context.translate(dx * 2, moving ? Math.sin(game.elapsed * 24) * 1.5 : 0);
      context.fillStyle = "#6c2929";
      context.beginPath();
      context.moveTo(-12, 8);
      context.quadraticCurveTo(-7, -9, 0, -10);
      context.quadraticCurveTo(8, -8, 12, 7);
      context.quadraticCurveTo(0, 13, -12, 8);
      context.fill();
      context.fillStyle = "#bc5541";
      context.beginPath();
      context.moveTo(-7, 9);
      context.quadraticCurveTo(-4, -7, 1, -9);
      context.lineTo(7, 8);
      context.quadraticCurveTo(1, 12, -7, 9);
      context.fill();
      context.strokeStyle = "#e5ae76";
      context.lineWidth = 1.7;
      context.beginPath();
      context.moveTo(-7, 3);
      context.quadraticCurveTo(0, 6, 8, 2);
      context.stroke();
      context.fillStyle = "#e7be87";
      context.beginPath();
      context.arc(dx * 1.8, -12, 7, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#273a38";
      context.strokeStyle = "#202e2d";
      context.beginPath();
      context.moveTo(-14, -15);
      context.quadraticCurveTo(-3, -23, 1 + dx * 2, -30);
      context.quadraticCurveTo(7, -26, 15, -16);
      context.quadraticCurveTo(1, -11, -14, -15);
      context.fill();
      context.stroke();
      context.strokeStyle = "#91a891";
      context.beginPath();
      context.moveTo(-8, -16);
      context.quadraticCurveTo(2, -15, 11, -17);
      context.stroke();
      context.restore();

      if (pointer) {
        drawBrush(brush.x, brush.y, angle, true);
      }
    }

    function brushAngle(points) {
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      return Math.atan2(a.y - b.y, a.x - b.x);
    }

    function drawBrush(x, y, angle, down) {
      context.save();
      context.translate(x, y + (down ? 0 : -3));
      context.rotate(angle);
      context.fillStyle = "#283331";
      context.beginPath();
      context.moveTo(-8, 0);
      context.quadraticCurveTo(-3, -6, 5, -4);
      context.lineTo(5, 4);
      context.quadraticCurveTo(-2, 6, -8, 0);
      context.fill();
      context.fillStyle = "#9c774c";
      context.fillRect(9, -2.5, 19, 5);
      context.fillStyle = "#d5a861";
      context.fillRect(4, -4, 7, 8);
      context.fillRect(11, -1.5, 15, 1);
      context.restore();
    }

    function drawParticles() {
      for (let index = 0; index < game.particles.length; index += 1) {
        const particle = game.particles[index];
        const remaining = 1 - particle.age / particle.life;
        context.globalAlpha = Math.max(0, remaining);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * Math.max(0.2, remaining), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    function drawShockwaves() {
      for (let index = 0; index < game.shockwaves.length; index += 1) {
        const wave = game.shockwaves[index];
        const remaining = Math.max(0, 1 - wave.age / wave.life);
        context.save();
        context.strokeStyle = `rgba(145, 54, 46, ${remaining * 0.85})`;
        context.lineWidth = 2 + remaining * 5;
        context.beginPath();
        context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = `rgba(31, 35, 26, ${remaining * 0.45})`;
        context.lineWidth = 1;
        context.beginPath();
        if (wave.kind === "blot") {
          context.arc(wave.x, wave.y, wave.radius * 0.68, 0, Math.PI * 2);
        } else {
          context.moveTo(wave.x - wave.radius * 0.72, wave.y - wave.radius * 0.72);
          context.lineTo(wave.x + wave.radius * 0.72, wave.y + wave.radius * 0.72);
          context.moveTo(wave.x + wave.radius * 0.72, wave.y - wave.radius * 0.72);
          context.lineTo(wave.x - wave.radius * 0.72, wave.y + wave.radius * 0.72);
        }
        context.stroke();
        context.restore();
      }
    }

    function drawFeedback() {
      if (game.feedback !== null) {
        const { x, y, label, color, age, life } = game.feedback;
        context.save();
        context.globalAlpha = Math.min(1, (life - age) * 4);
        context.textAlign = "center";
        context.font = "600 16px Georgia, serif";
        context.strokeStyle = "#fbefd6";
        context.lineWidth = 4;
        const baseline = Math.max(game.arenaTop + 20, y - 19 - age * 27);
        const inset = context.measureText(label).width / 2 + 5;
        const center = Math.max(inset, Math.min(game.width - inset, x));
        context.strokeText(label, center, baseline);
        context.fillStyle = color;
        context.fillText(label, center, baseline);
        context.restore();
      }
    }

    function drawJoystick() {
      if (game.joystick !== null) {
        const { x, y, dx, dy } = game.joystick;
        context.lineWidth = 1.5;
        context.strokeStyle = "#344b4790";
        context.beginPath();
        context.arc(x, y, 42, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = "#344b4760";
        context.beginPath();
        context.arc(x + dx, y + dy, 13, 0, Math.PI * 2);
        context.fill();
      }
    }

    return Object.freeze({ render });
  }

  return Object.freeze({ create });
});
