(function attachGreenWaveRenderer(root, factory) {
  "use strict";

  if (root.GreenWaveCore) {
    root.GreenWaveRenderer = factory(root.GreenWaveCore);
  } else {
    throw new Error("Green Wave renderer expected core.js to load first");
  }
})(globalThis, function createGreenWaveRenderer() {
  "use strict";

  function tileNoise(x, y, seed) {
    const value = Math.sin(x * 92.13 + y * 47.77 + seed * 0.0001) * 43758.5453;
    return value - Math.floor(value);
  }

  class LandscapeRenderer {
    constructor(canvas, model) {
      if (canvas instanceof HTMLCanvasElement) {
        this.canvas = canvas;
      } else {
        throw new Error("LandscapeRenderer expected an HTML canvas element");
      }
      this.context = canvas.getContext("2d");
      if (this.context) {
        this.model = model;
      } else {
        throw new Error("The browser could not provide the 2D canvas required by Green Wave");
      }
      this.particles = [];
      this.flash = 0;
      this.resize();
    }

    resize() {
      const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
      const displayedWidth = Math.max(this.canvas.clientWidth, 640);
      const displayedHeight = displayedWidth * this.model.settings.rows / this.model.settings.columns;
      this.canvas.width = Math.round(displayedWidth * pixelRatio);
      this.canvas.height = Math.round(displayedHeight * pixelRatio);
    }

    receiveEvent(event) {
      switch (event.type) {
        case "connection":
          this.createBurst(event.x, event.y, 30, "#f7de80");
          this.flash = 0.45;
          break;
        case "sanctuary":
          this.createBurst(event.x, event.y, 54, "#f9e998");
          this.flash = 0.75;
          break;
        case "complete":
          this.createBurst(this.model.head.x, this.model.head.y, 90, "#fff0a4");
          this.flash = 1;
          break;
        default:
          this.flash = this.flash;
          break;
      }
    }

    createBurst(gridX, gridY, count, color) {
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.18;
        const speed = 0.35 + Math.random() * 1.15;
        this.particles.push({
          gridX: gridX + 0.5,
          gridY: gridY + 0.5,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          life: 1,
          size: 1.5 + Math.random() * 2.5,
          color
        });
      }
    }

    drawTerrainCell(cell, x, y, cellWidth, cellHeight) {
      const context = this.context;
      const pixelX = x * cellWidth;
      const pixelY = y * cellHeight;
      const noise = tileNoise(x, y, this.model.seed);

      switch (cell.terrain) {
        case "water":
          context.fillStyle = noise > 0.5 ? "#78a7a0" : "#6d9b96";
          context.fillRect(pixelX, pixelY, cellWidth + 1, cellHeight + 1);
          context.strokeStyle = "rgba(229, 238, 211, 0.34)";
          context.lineWidth = Math.max(1, cellWidth * 0.035);
          context.beginPath();
          context.arc(pixelX + cellWidth * 0.5, pixelY + cellHeight * 0.5, cellWidth * 0.24, 0.2, 2.65);
          context.stroke();
          break;
        case "rock":
          context.fillStyle = noise > 0.5 ? "#bba778" : "#c4ae79";
          context.fillRect(pixelX, pixelY, cellWidth + 1, cellHeight + 1);
          context.fillStyle = "rgba(84, 82, 70, 0.62)";
          context.beginPath();
          context.ellipse(pixelX + cellWidth * 0.5, pixelY + cellHeight * 0.58, cellWidth * 0.3, cellHeight * 0.22, noise, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "rgba(244, 231, 191, 0.22)";
          context.beginPath();
          context.ellipse(pixelX + cellWidth * 0.43, pixelY + cellHeight * 0.49, cellWidth * 0.12, cellHeight * 0.07, noise, 0, Math.PI * 2);
          context.fill();
          break;
        default:
          context.fillStyle = noise > 0.66 ? "#c6ad73" : noise > 0.33 ? "#c1a66c" : "#bca067";
          context.fillRect(pixelX, pixelY, cellWidth + 1, cellHeight + 1);
          context.fillStyle = "rgba(91, 69, 42, 0.13)";
          context.beginPath();
          context.arc(pixelX + cellWidth * (0.25 + noise * 0.5), pixelY + cellHeight * (0.22 + noise * 0.55), Math.max(0.7, cellWidth * 0.035), 0, Math.PI * 2);
          context.fill();
          break;
      }
    }

    drawGrowth(cell, stage, x, y, cellWidth, cellHeight) {
      const context = this.context;
      const centerX = (x + 0.5) * cellWidth;
      const centerY = (y + 0.5) * cellHeight;
      const noise = tileNoise(x, y, this.model.seed + 19);

      switch (stage) {
        case "grass":
          context.fillStyle = "rgba(110, 146, 67, 0.24)";
          break;
        case "sapling":
          context.fillStyle = "rgba(76, 128, 67, 0.31)";
          break;
        case "forest":
          context.fillStyle = "rgba(38, 103, 66, 0.38)";
          break;
        default:
          context.fillStyle = "rgba(0, 0, 0, 0)";
          break;
      }
      context.fillRect(x * cellWidth, y * cellHeight, cellWidth + 1, cellHeight + 1);

      if (cell.sanctuary) {
        const sanctuaryGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, cellWidth * 0.62);
        sanctuaryGlow.addColorStop(0, "rgba(239, 218, 103, 0.32)");
        sanctuaryGlow.addColorStop(1, "rgba(239, 218, 103, 0)");
        context.fillStyle = sanctuaryGlow;
        context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      } else {
        context.fillStyle = context.fillStyle;
      }

      switch (stage) {
        case "grass":
          context.strokeStyle = cell.sanctuary ? "#a5c255" : "#557f3b";
          context.lineWidth = Math.max(1.4, cellWidth * 0.06);
          for (let blade = -1; blade <= 1; blade += 1) {
            context.beginPath();
            context.moveTo(centerX + blade * cellWidth * 0.12, centerY + cellHeight * 0.23);
            context.quadraticCurveTo(centerX + blade * cellWidth * 0.08, centerY, centerX + (blade + noise - 0.5) * cellWidth * 0.14, centerY - cellHeight * 0.2);
            context.stroke();
          }
          break;
        case "sapling":
          context.strokeStyle = "#5f5533";
          context.lineWidth = Math.max(1.2, cellWidth * 0.07);
          context.beginPath();
          context.moveTo(centerX, centerY + cellHeight * 0.27);
          context.lineTo(centerX, centerY - cellHeight * 0.08);
          context.stroke();
          context.fillStyle = cell.sanctuary ? "#8eb34e" : "#598c49";
          context.beginPath();
          context.arc(centerX - cellWidth * 0.09, centerY - cellHeight * 0.1, cellWidth * 0.16, 0, Math.PI * 2);
          context.arc(centerX + cellWidth * 0.1, centerY - cellHeight * 0.12, cellWidth * 0.18, 0, Math.PI * 2);
          context.fill();
          break;
        case "forest":
          context.fillStyle = "rgba(37, 50, 34, 0.2)";
          context.beginPath();
          context.ellipse(centerX + cellWidth * 0.08, centerY + cellHeight * 0.27, cellWidth * 0.3, cellHeight * 0.13, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#665438";
          context.fillRect(centerX - cellWidth * 0.055, centerY, cellWidth * 0.11, cellHeight * 0.28);
          context.fillStyle = cell.sanctuary ? "#2f704a" : noise > 0.5 ? "#286542" : "#34724a";
          context.beginPath();
          context.arc(centerX - cellWidth * 0.13, centerY - cellHeight * 0.08, cellWidth * 0.26, 0, Math.PI * 2);
          context.arc(centerX + cellWidth * 0.15, centerY - cellHeight * 0.1, cellWidth * 0.28, 0, Math.PI * 2);
          context.arc(centerX, centerY - cellHeight * 0.26, cellWidth * 0.26, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = cell.sanctuary ? "rgba(224, 219, 112, 0.7)" : "rgba(159, 185, 91, 0.35)";
          context.beginPath();
          context.arc(centerX - cellWidth * 0.08, centerY - cellHeight * 0.25, cellWidth * 0.07, 0, Math.PI * 2);
          context.fill();
          break;
        default:
          context.fillStyle = context.fillStyle;
          break;
      }
    }

    drawHead(cellWidth, cellHeight, time) {
      const context = this.context;
      const centerX = (this.model.head.x + 0.5) * cellWidth;
      const centerY = (this.model.head.y + 0.5) * cellHeight;
      const pulse = 0.5 + Math.sin(time * 0.006) * 0.12;
      const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, cellWidth * pulse);
      glow.addColorStop(0, "rgba(255, 249, 176, 0.94)");
      glow.addColorStop(0.35, "rgba(190, 220, 96, 0.72)");
      glow.addColorStop(1, "rgba(154, 199, 82, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centerX, centerY, cellWidth * pulse, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255, 255, 222, 0.95)";
      context.lineWidth = Math.max(1.5, cellWidth * 0.07);
      context.beginPath();
      context.arc(centerX, centerY, cellWidth * 0.23, 0, Math.PI * 2);
      context.stroke();
    }

    drawBirds(cellWidth, cellHeight, time) {
      const context = this.context;
      const birdCount = Math.min(this.model.canopyConnections, 6);
      context.strokeStyle = "rgba(35, 62, 50, 0.68)";
      context.lineWidth = Math.max(1, cellWidth * 0.045);
      for (let bird = 0; bird < birdCount; bird += 1) {
        const x = ((time * 0.00004 * (bird + 2) + bird * 0.17) % 1) * this.canvas.width;
        const y = this.canvas.height * (0.13 + bird * 0.035);
        context.beginPath();
        context.arc(x - cellWidth * 0.09, y, cellWidth * 0.1, 5.25, 6.15);
        context.arc(x + cellWidth * 0.09, y, cellWidth * 0.1, 3.27, 4.16);
        context.stroke();
      }
    }

    drawParticles(cellWidth, cellHeight) {
      const context = this.context;
      this.particles = this.particles.filter((particle) => particle.life > 0.02);
      this.particles.forEach((particle) => {
        particle.gridX += particle.velocityX * 0.035;
        particle.gridY += particle.velocityY * 0.035;
        particle.velocityY += 0.012;
        particle.life *= 0.972;
        context.globalAlpha = particle.life;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.gridX * cellWidth, particle.gridY * cellHeight, particle.size, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    }

    render(time) {
      const context = this.context;
      const cellWidth = this.canvas.width / this.model.settings.columns;
      const cellHeight = this.canvas.height / this.model.settings.rows;
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let y = 0; y < this.model.settings.rows; y += 1) {
        for (let x = 0; x < this.model.settings.columns; x += 1) {
          this.drawTerrainCell(this.model.getCell(x, y), x, y, cellWidth, cellHeight);
        }
      }

      for (let y = 0; y < this.model.settings.rows; y += 1) {
        for (let x = 0; x < this.model.settings.columns; x += 1) {
          const cell = this.model.getCell(x, y);
          this.drawGrowth(cell, this.model.growthStageForCell(cell), x, y, cellWidth, cellHeight);
        }
      }

      this.drawBirds(cellWidth, cellHeight, time);
      this.drawHead(cellWidth, cellHeight, time);
      this.drawParticles(cellWidth, cellHeight);
      if (this.flash > 0.01) {
        context.fillStyle = `rgba(238, 239, 155, ${this.flash * 0.13})`;
        context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.flash *= 0.94;
      } else {
        this.flash = 0;
      }
    }
  }

  return Object.freeze({ LandscapeRenderer });
});
