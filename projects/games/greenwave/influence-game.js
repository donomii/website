(function runInfluenceGarden(root) {
  "use strict";

  if (root.GreenWaveInfluence) {
    const { InfluenceGardenModel, PLANT_TYPES, STATUS } = root.GreenWaveInfluence;
    const model = new InfluenceGardenModel();

    function requiredElement(identifier) {
      const element = document.getElementById(identifier);
      if (element) {
        return element;
      } else {
        throw new Error(`Influence Garden expected #${identifier}, but it was not found`);
      }
    }

    const canvas = requiredElement("influence-canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = true;
    } else {
      throw new Error("Influence Garden requires two-dimensional canvas support");
    }

    const overlay = requiredElement("influence-overlay");
    const overlayTitle = requiredElement("influence-overlay-title");
    const overlayCopy = requiredElement("influence-overlay-copy");
    const startButton = requiredElement("influence-start");
    const pauseButton = requiredElement("influence-pause");
    const resetButton = requiredElement("influence-reset");
    const message = requiredElement("influence-message");
    const statusReadout = requiredElement("influence-status");
    const progressReadout = requiredElement("influence-progress");
    const seedReadout = requiredElement("influence-seeds");
    const overlapReadout = requiredElement("influence-overlap");
    let selectedPlant = "clover";
    let hoverCell = null;
    let nextSeed = 0x53454544;
    let particles = [];

    function resizeCanvas() {
      const pixelRatio = Math.min(root.devicePixelRatio || 1, 2);
      const displayedWidth = Math.max(canvas.clientWidth, 620);
      canvas.width = Math.round(displayedWidth * pixelRatio);
      canvas.height = Math.round(displayedWidth * model.settings.rows / model.settings.columns * pixelRatio);
    }

    function cellMetrics() {
      return {
        width: canvas.width / model.settings.columns,
        height: canvas.height / model.settings.rows
      };
    }

    function terrainColor(cell, x, y) {
      const texture = Math.sin(x * 17.19 + y * 41.73 + model.seed * 0.0001);
      const warmth = cell.baseFertility + texture * 0.035;
      if (warmth > 0.37) {
        return "#b7a373";
      } else if (warmth > 0.25) {
        return "#ad9868";
      } else {
        return "#a78f61";
      }
    }

    function drawTerrain(metrics) {
      for (let y = 0; y < model.settings.rows; y += 1) {
        for (let x = 0; x < model.settings.columns; x += 1) {
          const cell = model.getCell(x, y);
          context.fillStyle = terrainColor(cell, x, y);
          context.fillRect(x * metrics.width, y * metrics.height, metrics.width + 1, metrics.height + 1);
          context.fillStyle = "rgba(80, 64, 39, 0.11)";
          context.beginPath();
          context.arc((x + 0.3 + cell.baseMoisture * 0.3) * metrics.width, (y + 0.32) * metrics.height, Math.max(0.7, metrics.width * 0.025), 0, Math.PI * 2);
          context.fill();
        }
      }
    }

    function drawInfluenceArea(plant, metrics, preview) {
      const definition = PLANT_TYPES[plant.kind];
      const centerX = (plant.x + 0.5) * metrics.width;
      const centerY = (plant.y + 0.5) * metrics.height;
      const radius = definition.radius * metrics.width;
      const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `${definition.color}49`);
      gradient.addColorStop(0.72, `${definition.color}2a`);
      gradient.addColorStop(1, `${definition.color}08`);
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = preview ? "rgba(255, 248, 184, 0.86)" : `${definition.color}aa`;
      context.lineWidth = Math.max(1.2, metrics.width * 0.05);
      context.setLineDash(preview ? [metrics.width * 0.18, metrics.width * 0.12] : []);
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }

    function drawGrowth(cell, x, y, metrics) {
      const centerX = (x + 0.5) * metrics.width;
      const centerY = (y + 0.5) * metrics.height;
      switch (cell.stage) {
        case 1:
          context.fillStyle = "rgba(113, 151, 67, 0.45)";
          context.fillRect(x * metrics.width, y * metrics.height, metrics.width + 1, metrics.height + 1);
          context.strokeStyle = "#597f3d";
          context.lineWidth = Math.max(1.1, metrics.width * 0.045);
          context.beginPath();
          context.moveTo(centerX, centerY + metrics.height * 0.2);
          context.lineTo(centerX - metrics.width * 0.08, centerY - metrics.height * 0.17);
          context.moveTo(centerX, centerY + metrics.height * 0.2);
          context.lineTo(centerX + metrics.width * 0.1, centerY - metrics.height * 0.13);
          context.stroke();
          break;
        case 2:
          context.fillStyle = "rgba(72, 125, 71, 0.42)";
          context.fillRect(x * metrics.width, y * metrics.height, metrics.width + 1, metrics.height + 1);
          context.fillStyle = "#356a48";
          context.beginPath();
          context.arc(centerX, centerY - metrics.height * 0.08, metrics.width * 0.22, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#67533a";
          context.fillRect(centerX - metrics.width * 0.035, centerY, metrics.width * 0.07, metrics.height * 0.27);
          break;
        case 3:
          context.fillStyle = "rgba(32, 93, 61, 0.46)";
          context.fillRect(x * metrics.width, y * metrics.height, metrics.width + 1, metrics.height + 1);
          context.fillStyle = "#245842";
          context.beginPath();
          context.arc(centerX - metrics.width * 0.12, centerY - metrics.height * 0.03, metrics.width * 0.25, 0, Math.PI * 2);
          context.arc(centerX + metrics.width * 0.13, centerY - metrics.height * 0.06, metrics.width * 0.27, 0, Math.PI * 2);
          context.arc(centerX, centerY - metrics.height * 0.22, metrics.width * 0.25, 0, Math.PI * 2);
          context.fill();
          break;
        default:
          context.fillStyle = "rgba(0, 0, 0, 0)";
          break;
      }
    }

    function drawPlant(plant, metrics) {
      const definition = PLANT_TYPES[plant.kind];
      const centerX = (plant.x + 0.5) * metrics.width;
      const centerY = (plant.y + 0.5) * metrics.height;
      context.fillStyle = "rgba(250, 243, 173, 0.88)";
      context.beginPath();
      context.arc(centerX, centerY, metrics.width * 0.22, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = definition.color;
      context.lineWidth = Math.max(1.5, metrics.width * 0.07);
      context.beginPath();
      context.arc(centerX, centerY, metrics.width * 0.3, 0, Math.PI * 2);
      context.stroke();
    }

    function drawParticles(metrics) {
      particles = particles.filter((particle) => particle.life > 0.03);
      particles.forEach((particle) => {
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.life *= 0.965;
        context.globalAlpha = particle.life;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x * metrics.width, particle.y * metrics.height, particle.size, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    }

    function createBurst(x, y, color) {
      for (let index = 0; index < 30; index += 1) {
        const angle = index / 30 * Math.PI * 2;
        particles.push({
          x: x + 0.5,
          y: y + 0.5,
          velocityX: Math.cos(angle) * (0.018 + Math.random() * 0.025),
          velocityY: Math.sin(angle) * (0.018 + Math.random() * 0.025),
          life: 1,
          size: 1.3 + Math.random() * 2,
          color
        });
      }
    }

    function render() {
      const metrics = cellMetrics();
      context.clearRect(0, 0, canvas.width, canvas.height);
      drawTerrain(metrics);
      for (let y = 0; y < model.settings.rows; y += 1) {
        for (let x = 0; x < model.settings.columns; x += 1) {
          drawGrowth(model.getCell(x, y), x, y, metrics);
        }
      }
      model.plants.forEach((plant) => drawInfluenceArea(plant, metrics, false));
      model.plants.forEach((plant) => drawPlant(plant, metrics));
      if (hoverCell && model.status !== STATUS.complete) {
        drawInfluenceArea({ kind: selectedPlant, x: hoverCell.x, y: hoverCell.y }, metrics, true);
      } else {
        hoverCell = hoverCell;
      }
      drawParticles(metrics);
      root.requestAnimationFrame(render);
    }

    function updateInterface() {
      const snapshot = model.getSnapshot();
      progressReadout.textContent = `${snapshot.progressPercent}%`;
      seedReadout.textContent = String(snapshot.seeds);
      overlapReadout.textContent = String(snapshot.overlapCells);
      switch (snapshot.status) {
        case STATUS.ready:
          statusReadout.textContent = "Ready";
          pauseButton.disabled = true;
          pauseButton.textContent = "Pause the seasons";
          break;
        case STATUS.running:
          statusReadout.textContent = "Growing";
          pauseButton.disabled = false;
          pauseButton.textContent = "Pause the seasons";
          break;
        case STATUS.paused:
          statusReadout.textContent = "Resting";
          pauseButton.disabled = false;
          pauseButton.textContent = "Continue the seasons";
          break;
        case STATUS.complete:
          statusReadout.textContent = "Established";
          pauseButton.disabled = true;
          pauseButton.textContent = "Ecosystem established";
          break;
        default:
          throw new Error(`Unexpected Influence Garden status "${snapshot.status}"`);
      }
    }

    function showCompletion() {
      overlayTitle.textContent = "A network sustains itself";
      overlayCopy.textContent = "Fertility, shade, and moisture now circulate through living ground. Start again to compose a different network.";
      startButton.textContent = "Plant another garden";
      overlay.classList.remove("is-hidden");
    }

    function processEvents() {
      model.drainEvents().forEach((event) => {
        switch (event.type) {
          case "planted":
            message.textContent = `${PLANT_TYPES[event.kind].name} planted. Its pale circle shows the ground it changes.`;
            createBurst(event.x, event.y, PLANT_TYPES[event.kind].color);
            break;
          case "symbiosis":
            message.textContent = "The influence circles overlap: this shared ground now grows with a symbiosis bonus.";
            createBurst(event.x, event.y, "#f2df7e");
            break;
          case "spread":
            message.textContent = `${event.newCells} new patches responded to the living network this season.`;
            break;
          case "quiet":
            message.textContent = message.textContent;
            break;
          case "complete":
            message.textContent = "The planted network has restored enough land to renew its own seeds and water.";
            showCompletion();
            break;
          default:
            throw new Error(`Unknown Influence Garden event "${event.type}"`);
        }
      });
    }

    function begin() {
      if (model.status === STATUS.complete) {
        nextSeed += 71;
        model.reset(nextSeed);
        overlayTitle.textContent = "Compose a living network";
        overlayCopy.textContent = "Place different plants close enough for their circles to overlap. Shared ground grows fastest.";
        startButton.textContent = "Enter the garden";
      } else {
        model.status = model.status;
      }
      model.start();
      overlay.classList.add("is-hidden");
      message.textContent = "Choose a species, then click the soil. Try overlapping two different circles.";
      updateInterface();
    }

    function resetGarden() {
      nextSeed += 71;
      model.reset(nextSeed);
      hoverCell = null;
      particles = [];
      overlayTitle.textContent = "Compose a living network";
      overlayCopy.textContent = "Place different plants close enough for their circles to overlap. Shared ground grows fastest.";
      startButton.textContent = "Enter the garden";
      overlay.classList.remove("is-hidden");
      message.textContent = "Pale circles show the area each plant changes.";
      updateInterface();
    }

    function togglePause() {
      const status = model.togglePause();
      if (status === STATUS.paused) {
        message.textContent = "The seasons are paused. You can still compose the planting layout.";
      } else if (status === STATUS.running) {
        message.textContent = "The seasons continue; influence is spreading through the soil.";
      } else {
        message.textContent = message.textContent;
      }
      updateInterface();
    }

    function canvasPosition(event) {
      const bounds = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - bounds.left) / bounds.width * model.settings.columns);
      const y = Math.floor((event.clientY - bounds.top) / bounds.height * model.settings.rows);
      return {
        x: Math.max(0, Math.min(model.settings.columns - 1, x)),
        y: Math.max(0, Math.min(model.settings.rows - 1, y))
      };
    }

    canvas.addEventListener("pointermove", (event) => {
      hoverCell = canvasPosition(event);
    });
    canvas.addEventListener("pointerleave", () => {
      hoverCell = null;
    });
    canvas.addEventListener("click", (event) => {
      const point = canvasPosition(event);
      const result = model.plant(selectedPlant, point.x, point.y);
      if (result.planted) {
        model.calculateInfluence();
        processEvents();
      } else if (result.reason === "seeds") {
        message.textContent = `This plant needs ${PLANT_TYPES[selectedPlant].cost} seeds. Let the current garden renew some.`;
      } else if (result.reason === "occupied") {
        message.textContent = "A plant already anchors this spot. Place the new influence circle nearby.";
      } else {
        message.textContent = "This garden is established. Start another to keep planting.";
      }
      updateInterface();
    });

    document.querySelectorAll("[data-plant]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedPlant = button.dataset.plant;
        document.querySelectorAll("[data-plant]").forEach((candidate) => {
          const selected = candidate.dataset.plant === selectedPlant;
          candidate.classList.toggle("is-selected", selected);
          candidate.setAttribute("aria-pressed", String(selected));
        });
        message.textContent = `${PLANT_TYPES[selectedPlant].name} selected: ${PLANT_TYPES[selectedPlant].cost} seeds, radius ${PLANT_TYPES[selectedPlant].radius}.`;
      });
    });

    startButton.addEventListener("click", begin);
    pauseButton.addEventListener("click", togglePause);
    resetButton.addEventListener("click", resetGarden);
    root.addEventListener("resize", resizeCanvas);
    root.setInterval(() => {
      model.advance();
      processEvents();
      updateInterface();
    }, model.settings.tickMilliseconds);

    resizeCanvas();
    updateInterface();
    root.requestAnimationFrame(render);
  } else {
    throw new Error("Influence Garden expected influence-core.js to load first");
  }
})(globalThis);
