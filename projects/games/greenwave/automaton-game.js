(function runForestLife(root) {
  "use strict";

  if (root.GreenWaveAutomaton) {
    const { ForestAutomatonModel, STATUS } = root.GreenWaveAutomaton;
    const model = new ForestAutomatonModel();
    const SPEEDS = Object.freeze({ slow: 650, steady: 260, fast: 90 });

    function requiredElement(identifier) {
      const element = document.getElementById(identifier);
      if (element) {
        return element;
      } else {
        throw new Error(`Forest Life expected #${identifier}, but it was not found`);
      }
    }

    const canvas = requiredElement("automaton-canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.imageSmoothingEnabled = true;
    } else {
      throw new Error("Forest Life requires two-dimensional canvas support");
    }

    const overlay = requiredElement("automaton-overlay");
    const overlayTitle = requiredElement("automaton-overlay-title");
    const overlayCopy = requiredElement("automaton-overlay-copy");
    const startButton = requiredElement("automaton-start");
    const runButton = requiredElement("automaton-run");
    const stepButton = requiredElement("automaton-step");
    const resetButton = requiredElement("automaton-reset");
    const message = requiredElement("automaton-message");
    const statusReadout = requiredElement("automaton-status");
    const generationReadout = requiredElement("automaton-generation");
    const progressReadout = requiredElement("automaton-progress");
    const frontierReadout = requiredElement("automaton-frontier");
    let selectedSpeed = "steady";
    let nextSeed = 0x464f5245;
    let pulseCells = [];

    function resizeCanvas() {
      const pixelRatio = Math.min(root.devicePixelRatio || 1, 2);
      const displayedWidth = Math.max(canvas.clientWidth, 650);
      canvas.width = Math.round(displayedWidth * pixelRatio);
      canvas.height = Math.round(displayedWidth * model.settings.rows / model.settings.columns * pixelRatio);
    }

    function drawCell(cell, x, y, width, height) {
      const pixelX = x * width;
      const pixelY = y * height;
      const habitatShade = Math.floor(112 + cell.habitat * 32);
      if (cell.habitat < 0.14) {
        context.fillStyle = "#6f6b60";
      } else {
        context.fillStyle = `rgb(${habitatShade + 35}, ${habitatShade + 18}, ${habitatShade - 19})`;
      }
      context.fillRect(pixelX, pixelY, width + 1, height + 1);

      switch (cell.state) {
        case 1:
          context.fillStyle = "#8ca64b";
          context.fillRect(pixelX + width * 0.13, pixelY + height * 0.14, width * 0.74, height * 0.72);
          break;
        case 2:
          context.fillStyle = "#527c50";
          context.beginPath();
          context.arc(pixelX + width * 0.5, pixelY + height * 0.48, width * 0.34, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#d0c078";
          context.fillRect(pixelX + width * 0.46, pixelY + height * 0.5, width * 0.08, height * 0.34);
          break;
        case 3:
          context.fillStyle = "#245541";
          context.beginPath();
          context.arc(pixelX + width * 0.38, pixelY + height * 0.47, width * 0.34, 0, Math.PI * 2);
          context.arc(pixelX + width * 0.64, pixelY + height * 0.43, width * 0.35, 0, Math.PI * 2);
          context.arc(pixelX + width * 0.52, pixelY + height * 0.25, width * 0.31, 0, Math.PI * 2);
          context.fill();
          break;
        default:
          context.fillStyle = "rgba(0, 0, 0, 0)";
          break;
      }

      context.strokeStyle = "rgba(236, 226, 187, 0.09)";
      context.lineWidth = 1;
      context.strokeRect(pixelX, pixelY, width, height);
    }

    function render() {
      const width = canvas.width / model.settings.columns;
      const height = canvas.height / model.settings.rows;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < model.settings.rows; y += 1) {
        for (let x = 0; x < model.settings.columns; x += 1) {
          drawCell(model.getCell(x, y), x, y, width, height);
        }
      }

      pulseCells = pulseCells.filter((pulse) => pulse.life > 0.03);
      pulseCells.forEach((pulse) => {
        pulse.life *= 0.95;
        context.strokeStyle = `rgba(245, 229, 125, ${pulse.life})`;
        context.lineWidth = Math.max(1.5, width * 0.12);
        context.beginPath();
        context.arc((pulse.x + 0.5) * width, (pulse.y + 0.5) * height, width * (1.4 - pulse.life * 0.7), 0, Math.PI * 2);
        context.stroke();
      });
      root.requestAnimationFrame(render);
    }

    function updateInterface() {
      const snapshot = model.getSnapshot();
      generationReadout.textContent = String(snapshot.generation);
      progressReadout.textContent = `${snapshot.progressPercent}%`;
      frontierReadout.textContent = String(snapshot.frontierColumn).padStart(2, "0");
      switch (snapshot.status) {
        case STATUS.running:
          statusReadout.textContent = "Running";
          runButton.textContent = "Pause generations";
          stepButton.disabled = true;
          break;
        case STATUS.paused:
          statusReadout.textContent = "Paused";
          runButton.textContent = "Run generations";
          stepButton.disabled = false;
          break;
        case STATUS.complete:
          statusReadout.textContent = "Established";
          runButton.textContent = "Model complete";
          runButton.disabled = true;
          stepButton.disabled = true;
          break;
        default:
          throw new Error(`Unexpected Forest Life status "${snapshot.status}"`);
      }
      if (snapshot.status !== STATUS.complete) {
        runButton.disabled = false;
      } else {
        runButton.disabled = true;
      }
    }

    function showCompletion() {
      overlayTitle.textContent = "The front became a forest";
      overlayCopy.textContent = "Neighbor by neighbor, a small western grove established a living system across the land.";
      startButton.textContent = "Run a new model";
      overlay.classList.remove("is-hidden");
    }

    function processEvents() {
      model.drainEvents().forEach((event) => {
        switch (event.type) {
          case "seeded":
            message.textContent = `${event.newCells} pioneer cells joined the model. Their neighbors will respond next generation.`;
            pulseCells.push({ x: event.x, y: event.y, life: 1 });
            break;
          case "generation":
            if (event.newCells > 0) {
              message.textContent = `Generation ${event.generation}: the front entered ${event.newCells} new cells.`;
            } else {
              message.textContent = `Generation ${event.generation}: the forest matured in place while waiting for a viable edge.`;
            }
            break;
          case "complete":
            message.textContent = "The cellular forest now occupies enough habitat to maintain a continuous green front.";
            showCompletion();
            break;
          default:
            throw new Error(`Unknown Forest Life event "${event.type}"`);
        }
      });
    }

    function begin() {
      if (model.status === STATUS.complete) {
        nextSeed += 83;
        model.reset(nextSeed);
        overlayTitle.textContent = "Watch a forest think";
        overlayCopy.textContent = "Run the model and a green front will emerge. Click the land at any time to introduce another pioneer grove.";
        startButton.textContent = "Run the simulation";
      } else {
        model.status = model.status;
      }
      model.start();
      overlay.classList.add("is-hidden");
      message.textContent = "The western grove is casting seeds into its eastern neighbors.";
      updateInterface();
    }

    function toggleRun() {
      if (model.status === STATUS.running) {
        model.pause();
        message.textContent = "The model is paused. Advance one generation or plant a new pioneer grove.";
      } else if (model.status === STATUS.paused) {
        model.start();
        message.textContent = "The model is running; every cell now updates at the selected pace.";
      } else {
        message.textContent = message.textContent;
      }
      updateInterface();
    }

    function resetModel() {
      nextSeed += 83;
      model.reset(nextSeed);
      pulseCells = [];
      overlayTitle.textContent = "Watch a forest think";
      overlayCopy.textContent = "Run the model and a green front will emerge. Click the land at any time to introduce another pioneer grove.";
      startButton.textContent = "Run the simulation";
      overlay.classList.remove("is-hidden");
      message.textContent = "Cells update together: grass becomes saplings, saplings become forest, and forest seeds its neighbors.";
      updateInterface();
    }

    function canvasPosition(event) {
      const bounds = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(model.settings.columns - 1, Math.floor((event.clientX - bounds.left) / bounds.width * model.settings.columns))),
        y: Math.max(0, Math.min(model.settings.rows - 1, Math.floor((event.clientY - bounds.top) / bounds.height * model.settings.rows)))
      };
    }

    canvas.addEventListener("click", (event) => {
      const point = canvasPosition(event);
      model.seedCluster(point.x, point.y);
      processEvents();
      updateInterface();
    });

    document.querySelectorAll("[data-speed]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSpeed = button.dataset.speed;
        document.querySelectorAll("[data-speed]").forEach((candidate) => {
          const selected = candidate.dataset.speed === selectedSpeed;
          candidate.classList.toggle("is-selected", selected);
          candidate.setAttribute("aria-pressed", String(selected));
        });
        message.textContent = `${button.querySelector("strong").textContent} pace selected: ${SPEEDS[selectedSpeed]} milliseconds between generations.`;
      });
    });

    startButton.addEventListener("click", begin);
    runButton.addEventListener("click", toggleRun);
    stepButton.addEventListener("click", () => {
      model.advance(true);
      processEvents();
      updateInterface();
    });
    resetButton.addEventListener("click", resetModel);
    root.addEventListener("resize", resizeCanvas);

    function scheduleGeneration() {
      root.setTimeout(() => {
        if (model.status === STATUS.running) {
          model.advance();
          processEvents();
          updateInterface();
        } else {
          model.status = model.status;
        }
        scheduleGeneration();
      }, SPEEDS[selectedSpeed]);
    }

    resizeCanvas();
    updateInterface();
    scheduleGeneration();
    root.requestAnimationFrame(render);
  } else {
    throw new Error("Forest Life expected automaton-core.js to load first");
  }
})(globalThis);
