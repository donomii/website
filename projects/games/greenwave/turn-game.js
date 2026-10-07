(function runTurnTheEarth(root) {
  "use strict";

  if (root.GreenWaveTurn) {
    const { TurnTheEarthModel, STATUS, STAGE_NAMES } = root.GreenWaveTurn;
    const model = new TurnTheEarthModel();

    function requiredElement(identifier) {
      const element = document.getElementById(identifier);
      if (element) {
        return element;
      } else {
        throw new Error(`Turn the Earth expected #${identifier}, but it was not found`);
      }
    }

    const grid = requiredElement("turn-grid");
    const overlay = requiredElement("turn-overlay");
    const overlayTitle = requiredElement("turn-overlay-title");
    const overlayCopy = requiredElement("turn-overlay-copy");
    const startButton = requiredElement("turn-start");
    const resetButton = requiredElement("turn-reset");
    const message = requiredElement("turn-message");
    const statusReadout = requiredElement("turn-status");
    const seasonReadout = requiredElement("turn-season");
    const seedReadout = requiredElement("turn-seeds");
    const progressReadout = requiredElement("turn-progress");
    const tileButtons = [];
    let recentIndex = -1;
    let nextSeed = 0x5455524e;

    function actionInstruction(cell) {
      switch (model.actionForCell(cell)) {
        case "sow":
          return "Click to sow grass for 1 seed";
        case "restore-soil":
          return "Click to restore moisture and advance the season";
        case "plant-sapling":
          return "Click to plant a sapling for 2 seeds";
        case "tend-meadow":
          return "Click to tend the meadow and advance the season";
        case "tend-sapling":
          return "Click to tend the sapling toward forest";
        default:
          return "Click to scatter seeds into neighboring tiles";
      }
    }

    function moistureClass(cell) {
      if (cell.moisture < 0.34) {
        return "moisture-low";
      } else if (cell.moisture < 0.56) {
        return "moisture-mid";
      } else {
        return "moisture-high";
      }
    }

    function stageMark(stage) {
      switch (stage) {
        case 0:
          return "·";
        case 1:
          return "╱";
        case 2:
          return "♣";
        default:
          return "♠";
      }
    }

    function updateTiles() {
      tileButtons.forEach((button, index) => {
        const x = index % model.settings.columns;
        const y = Math.floor(index / model.settings.columns);
        const cell = model.cells[index];
        button.className = `turn-tile stage-${cell.stage} ${moistureClass(cell)}`;
        button.classList.toggle("is-recent", index === recentIndex);
        button.disabled = model.status === STATUS.complete;
        const label = `${STAGE_NAMES[cell.stage]} at column ${x + 1}, row ${y + 1}. ${actionInstruction(cell)}.`;
        button.setAttribute("aria-label", label);
        button.title = label;
        button.firstElementChild.textContent = stageMark(cell.stage);
      });
    }

    function updateInterface() {
      const snapshot = model.getSnapshot();
      seasonReadout.textContent = String(snapshot.turn);
      seedReadout.textContent = String(snapshot.seeds);
      progressReadout.textContent = `${snapshot.progressPercent}%`;
      switch (snapshot.status) {
        case STATUS.ready:
          statusReadout.textContent = "Ready";
          break;
        case STATUS.playing:
          statusReadout.textContent = "Waiting for you";
          break;
        case STATUS.complete:
          statusReadout.textContent = "Established";
          break;
        default:
          throw new Error(`Unexpected Turn the Earth status "${snapshot.status}"`);
      }
      updateTiles();
    }

    function actionMessage(event) {
      switch (event.action) {
        case "sow":
          return "You sowed grass into empty soil.";
        case "restore-soil":
          return "With the seed store empty, you rested and moistened the soil.";
        case "plant-sapling":
          return "You deepened a meadow into a young tree.";
        case "tend-meadow":
          return "You tended the meadow while waiting for more seeds.";
        case "tend-sapling":
          return "You tended a sapling toward mature forest.";
        default:
          return `The forest scattered into ${event.directGrowth} neighboring tiles.`;
      }
    }

    function showCompletion() {
      overlayTitle.textContent = "Your turns became a forest";
      overlayCopy.textContent = "The landscape now carries enough grass, young trees, and forest to continue as a living system.";
      startButton.textContent = "Turn another landscape";
      overlay.classList.remove("is-hidden");
    }

    function processEvents() {
      model.drainEvents().forEach((event) => {
        switch (event.type) {
          case "turn": {
            const response = event.newGrowth > 0 ? ` The season ended with ${event.newGrowth} new living tiles.` : " The season matured existing growth.";
            const renewal = event.seedsGained > 0 ? ` Seed stores renewed by ${event.seedsGained}.` : "";
            message.textContent = `${actionMessage(event)}${response}${renewal}`;
            break;
          }
          case "complete":
            message.textContent = `Season ${event.turn} established a self-sustaining landscape.`;
            showCompletion();
            break;
          default:
            throw new Error(`Unknown Turn the Earth event "${event.type}"`);
        }
      });
    }

    function resetBoard(showOpening) {
      nextSeed += 89;
      model.reset(nextSeed);
      recentIndex = -1;
      overlayTitle.textContent = "The land waits for your touch";
      overlayCopy.textContent = "Every tile is an action. Sow empty soil, deepen grass into trees, tend saplings, or ask a forest to scatter seeds.";
      startButton.textContent = "Begin the first season";
      if (showOpening) {
        overlay.classList.remove("is-hidden");
      } else {
        overlay.classList.add("is-hidden");
      }
      message.textContent = "Click a tile. Your action happens first; then every tile responds together.";
      updateInterface();
    }

    function begin() {
      if (model.status === STATUS.complete) {
        resetBoard(false);
      } else {
        model.status = model.status;
      }
      model.start();
      overlay.classList.add("is-hidden");
      message.textContent = "The landscape is waiting. Choose one tile for the first turn.";
      updateInterface();
    }

    for (let y = 0; y < model.settings.rows; y += 1) {
      for (let x = 0; x < model.settings.columns; x += 1) {
        const button = document.createElement("button");
        const mark = document.createElement("span");
        button.type = "button";
        button.setAttribute("role", "gridcell");
        mark.className = "tile-mark";
        mark.setAttribute("aria-hidden", "true");
        button.appendChild(mark);
        button.addEventListener("click", () => {
          const result = model.clickTile(x, y);
          if (result.advanced) {
            recentIndex = model.indexOf(x, y);
            processEvents();
          } else {
            message.textContent = "Begin the landscape before taking its first turn.";
          }
          updateInterface();
        });
        grid.appendChild(button);
        tileButtons.push(button);
      }
    }

    startButton.addEventListener("click", begin);
    resetButton.addEventListener("click", () => resetBoard(true));
    updateInterface();
  } else {
    throw new Error("Turn the Earth expected turn-core.js to load first");
  }
})(globalThis);
