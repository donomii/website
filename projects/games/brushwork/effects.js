"use strict";

(function attachBrushworkEffects(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrushworkEffects = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createBrushworkEffectsApi() {
  function create(game) {
    const valid = game !== null
      && typeof game === "object"
      && Array.isArray(game.particles)
      && Array.isArray(game.shockwaves);
    if (valid) {
      return makeEffects(game);
    } else {
      throw new TypeError("BrushworkEffects.create requires game particle and shockwave arrays");
    }
  }

  function makeEffects(game) {
    function makeEnemySplash(enemy) {
      const count = 7 + Math.floor(enemy.radius * 0.45);
      makeRuneSparks(enemy.x, enemy.y, "#26291f", count);
    }

    function makeRuneSparks(x, y, color, count) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 90;
        game.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          life: 0.35 + Math.random() * 0.65,
          size: 1.4 + Math.random() * 3.7,
          color,
        });
      }
    }

    function makeDryBrushPuff(x, y) {
      for (let index = 0; index < 3; index += 1) {
        game.particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 11,
          vy: -4 - Math.random() * 8,
          age: 0,
          life: 0.35 + Math.random() * 0.3,
          size: 1 + Math.random() * 1.8,
          color: "#39392c",
        });
      }
    }

    function makeStrokeSparks(points, color, count) {
      const valid = Array.isArray(points)
        && points.length > 0
        && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        && typeof color === "string"
        && Number.isInteger(count)
        && count > 0;
      if (valid) {
        for (let index = 0; index < count; index += 1) {
          const pathIndex = Math.floor(index / Math.max(1, count - 1) * (points.length - 1));
          const point = points[pathIndex];
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
          const speed = 14 + Math.random() * 42;
          game.particles.push({
            x: point.x + (Math.random() - 0.5) * 5,
            y: point.y + (Math.random() - 0.5) * 5,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            age: 0,
            life: 0.32 + Math.random() * 0.55,
            size: 1.4 + Math.random() * 2.8,
            color,
          });
        }
      } else {
        throw new TypeError("Stroke sparks require valid points, a color, and a positive integer quantity");
      }
    }

    function updateParticles(delta) {
      const living = [];
      for (let index = 0; index < game.particles.length; index += 1) {
        const particle = game.particles[index];
        particle.age += delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vx *= Math.pow(0.05, delta);
        particle.vy *= Math.pow(0.05, delta);
        if (particle.age < particle.life) {
          living.push(particle);
        } else {
          particle.age = particle.life;
        }
      }
      game.particles = living;
    }

    function updateShockwaves(delta) {
      const living = [];
      for (let index = 0; index < game.shockwaves.length; index += 1) {
        const wave = game.shockwaves[index];
        wave.age += delta;
        wave.radius = easeOutCubic(Math.min(1, wave.age / wave.life)) * wave.maximumRadius;
        if (wave.age < wave.life) {
          living.push(wave);
        } else {
          wave.radius = wave.maximumRadius;
        }
      }
      game.shockwaves = living;
    }

    return Object.freeze({
      makeDryBrushPuff,
      makeEnemySplash,
      makeRuneSparks,
      makeStrokeSparks,
      updateParticles,
      updateShockwaves,
    });
  }

  function easeOutCubic(amount) {
    return 1 - Math.pow(1 - amount, 3);
  }

  return Object.freeze({ create });
});
