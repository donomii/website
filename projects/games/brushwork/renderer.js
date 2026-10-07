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
    function render() {
      context.setTransform(game.pixelRatio, 0, 0, game.pixelRatio, 0, 0);
      context.clearRect(0, 0, game.width, game.height);
      drawPaper();
      context.save();
      const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
      const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
      context.translate(shakeX, shakeY);
      drawTraces();
      drawCircles();
      drawParticles();
      drawEnemies();
      drawCurrentStroke();
      drawPlayerAndBrush();
      drawShockwaves();
      context.restore();
      drawVignette();
    }

    function drawPaper() {
      context.fillStyle = "#d8cda9";
      context.fillRect(0, 0, game.width, game.height);
      context.strokeStyle = "rgba(80, 70, 47, 0.045)";
      context.lineWidth = 1;
      context.beginPath();
      for (let y = game.arenaTop + 22; y < game.height; y += 42) {
        context.moveTo(0, y);
        context.bezierCurveTo(game.width * 0.3, y + 3, game.width * 0.7, y - 3, game.width, y);
      }
      context.stroke();

      for (let index = 0; index < game.paperMarks.length; index += 1) {
        const mark = game.paperMarks[index];
        context.save();
        context.translate(mark.x, mark.y);
        context.rotate(mark.angle);
        context.strokeStyle = `rgba(69, 58, 36, ${mark.alpha})`;
        context.beginPath();
        context.moveTo(-mark.length / 2, 0);
        context.lineTo(mark.length / 2, 0);
        context.stroke();
        context.restore();
      }
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
      context.shadowColor = `rgba(${halo}, ${remaining * energy})`;
      context.shadowBlur = 7 + trace.glow * 19;
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
      if (game.brush.down && game.brush.points.length >= 2) {
        drawInkPath(game.brush.points, constants.brushWidth + 4, "rgba(20, 23, 17, .15)");
        drawInkPath(game.brush.points, constants.brushWidth, "rgba(18, 21, 16, .88)");
        drawInkPath(game.brush.points, 1.5, "rgba(88, 94, 73, .55)");
      } else {
        context.globalAlpha = 1;
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
        context.font = `${Math.max(15, circle.radius * 0.28)}px Georgia`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("守", 0, 1);
        context.restore();
      }
    }

    function drawEnemies() {
      for (let index = 0; index < game.enemies.length; index += 1) {
        drawEnemy(game.enemies[index]);
      }
    }

    function drawEnemy(enemy) {
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(Math.sin(enemy.wobble * 0.7) * 0.12);
      context.fillStyle = "rgba(35, 31, 23, .14)";
      context.beginPath();
      context.ellipse(3, enemy.radius * 0.7, enemy.radius * 1.08, enemy.radius * 0.55, 0, 0, Math.PI * 2);
      context.fill();

      const sides = 9;
      context.beginPath();
      for (let side = 0; side <= sides; side += 1) {
        const angle = side / sides * Math.PI * 2;
        const irregular = 0.84 + seededNoise(enemy.seed + side * 4.17) * 0.25;
        const radius = enemy.radius * irregular;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (side === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.closePath();
      context.fillStyle = enemy.hitFlash > 0 ? "#6d3c34" : "#25271e";
      context.fill();
      context.strokeStyle = "rgba(13, 15, 11, .7)";
      context.lineWidth = 1.5;
      context.stroke();

      const eyeOffset = enemy.radius * 0.32;
      context.fillStyle = "#d8cda9";
      context.beginPath();
      context.arc(-eyeOffset, -1, Math.max(1.5, enemy.radius * 0.12), 0, Math.PI * 2);
      context.arc(eyeOffset, -1, Math.max(1.5, enemy.radius * 0.12), 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (enemy.health < enemy.maximumHealth && enemy.health > 0) {
        const healthWidth = enemy.radius * 1.7;
        context.fillStyle = "rgba(36, 33, 24, .18)";
        context.fillRect(enemy.x - healthWidth / 2, enemy.y - enemy.radius - 8, healthWidth, 2);
        context.fillStyle = "rgba(143, 57, 48, .7)";
        context.fillRect(
          enemy.x - healthWidth / 2,
          enemy.y - enemy.radius - 8,
          healthWidth * enemy.health / enemy.maximumHealth,
          2,
        );
      } else {
        context.globalAlpha = 1;
      }
    }

    function drawPlayerAndBrush() {
      const offsetX = game.player.x - game.brush.x;
      const offsetY = game.player.y - game.brush.y;
      const angle = Math.atan2(offsetY, offsetX);
      const lift = game.brush.down ? 0 : -5;

      context.save();
      context.strokeStyle = "rgba(37, 31, 20, .14)";
      context.lineWidth = 8;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(game.player.x + 4, game.player.y + 8);
      context.lineTo(game.brush.x + 5, game.brush.y + 8);
      context.stroke();
      context.restore();

      context.save();
      context.translate(game.brush.x, game.brush.y + lift);
      context.rotate(angle);
      context.fillStyle = game.brush.down ? "#171b15" : "#34382b";
      context.beginPath();
      context.moveTo(-9, -5);
      context.quadraticCurveTo(-18, 0, -9, 5);
      context.lineTo(2, 4);
      context.lineTo(2, -4);
      context.closePath();
      context.fill();
      context.fillStyle = "#8a7450";
      context.fillRect(1, -5, 8, 10);
      context.fillStyle = "#b48850";
      context.fillRect(8, -2.5, constants.brushLength - 10, 5);
      context.fillStyle = "rgba(255, 229, 169, .35)";
      context.fillRect(9, -1.5, constants.brushLength - 13, 1);
      context.restore();

      const flashing = game.player.invulnerable > 0
        && Math.floor(game.player.invulnerable * 15) % 2 === 0;
      context.save();
      context.globalAlpha = flashing ? 0.36 : 1;
      context.translate(game.player.x, game.player.y);
      context.fillStyle = "rgba(48, 37, 20, .16)";
      context.beginPath();
      context.ellipse(3, 12, 14, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#973d33";
      context.beginPath();
      context.moveTo(-11, 11);
      context.quadraticCurveTo(-8, -7, 0, -8);
      context.quadraticCurveTo(9, -7, 12, 11);
      context.quadraticCurveTo(0, 15, -11, 11);
      context.fill();
      context.fillStyle = "#d2b37c";
      context.beginPath();
      context.arc(0, -10, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#28291f";
      context.beginPath();
      context.moveTo(-12, -12);
      context.lineTo(12, -12);
      context.lineTo(2, -28);
      context.quadraticCurveTo(-4, -23, -12, -12);
      context.fill();
      context.fillStyle = "#151711";
      context.beginPath();
      context.arc(-2.5, -10, 1.1, 0, Math.PI * 2);
      context.arc(2.5, -10, 1.1, 0, Math.PI * 2);
      context.fill();
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
        context.moveTo(wave.x - wave.radius * 0.72, wave.y - wave.radius * 0.72);
        context.lineTo(wave.x + wave.radius * 0.72, wave.y + wave.radius * 0.72);
        context.moveTo(wave.x + wave.radius * 0.72, wave.y - wave.radius * 0.72);
        context.lineTo(wave.x - wave.radius * 0.72, wave.y + wave.radius * 0.72);
        context.stroke();
        context.restore();
      }
    }

    function drawVignette() {
      const gradient = context.createRadialGradient(
        game.width / 2,
        game.height / 2,
        Math.min(game.width, game.height) * 0.25,
        game.width / 2,
        game.height / 2,
        Math.max(game.width, game.height) * 0.72,
      );
      gradient.addColorStop(0, "rgba(34, 26, 13, 0)");
      gradient.addColorStop(1, "rgba(34, 26, 13, .2)");
      context.fillStyle = gradient;
      context.fillRect(0, game.arenaTop, game.width, game.height - game.arenaTop);
    }

    return Object.freeze({ render });
  }

  return Object.freeze({ create });
});
