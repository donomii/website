(function runGreenWave(root) {
  "use strict";

  if (root.GreenWaveCore && root.GreenWaveRenderer) {
    const { GreenWaveModel, STATUS } = root.GreenWaveCore;
    const { LandscapeRenderer } = root.GreenWaveRenderer;
    const model = new GreenWaveModel();

    function requiredElement(identifier) {
      const element = document.getElementById(identifier);
      if (element) {
        return element;
      } else {
        throw new Error(`Green Wave expected the page element #${identifier}, but it was not found`);
      }
    }

    const canvas = requiredElement("game-canvas");
    const overlay = requiredElement("start-overlay");
    const overlayTitle = requiredElement("overlay-title");
    const overlayCopy = requiredElement("overlay-copy");
    const startButton = requiredElement("start-button");
    const pauseButton = requiredElement("pause-button");
    const message = requiredElement("message");
    const gameStatus = requiredElement("game-status");
    const restoredValue = requiredElement("restored-value");
    const progressFill = requiredElement("progress-fill");
    const connectionValue = requiredElement("connection-value");
    const renderer = new LandscapeRenderer(canvas, model);
    let nextSeed = 0x47524545;

    function updateInterface() {
      const snapshot = model.getSnapshot();
      restoredValue.textContent = `${snapshot.progressPercent}%`;
      progressFill.style.width = `${Math.min(snapshot.progressPercent, 100)}%`;
      connectionValue.textContent = String(snapshot.canopyConnections);

      switch (snapshot.status) {
        case STATUS.ready:
          gameStatus.textContent = "Ready";
          pauseButton.textContent = "Pause growth";
          pauseButton.disabled = true;
          break;
        case STATUS.running:
          gameStatus.textContent = "Growing";
          pauseButton.textContent = "Pause growth";
          pauseButton.disabled = false;
          break;
        case STATUS.paused:
          gameStatus.textContent = "Resting";
          pauseButton.textContent = "Continue growing";
          pauseButton.disabled = false;
          break;
        case STATUS.complete:
          gameStatus.textContent = "Awakened";
          pauseButton.textContent = "Growth complete";
          pauseButton.disabled = true;
          break;
        default:
          throw new Error(`Unexpected Green Wave status "${snapshot.status}" while updating the interface`);
      }
    }

    function showCompletion() {
      overlayTitle.textContent = "The land is alive";
      overlayCopy.textContent = "Forest, meadow, and sanctuary now hold the soil together. Begin again to grow a different landscape.";
      startButton.textContent = "Grow another landscape";
      overlay.classList.remove("is-hidden");
    }

    function handleEvent(event) {
      renderer.receiveEvent(event);
      switch (event.type) {
        case "blocked":
          message.textContent = event.obstacle === "edge" ?
            "The wave has reached the horizon. Turn to continue growing." :
            `The ${event.obstacle} rests here. Turn and let the wave curl around it.`;
          break;
        case "connection":
          message.textContent = `Roots intertwined. The reunion scattered seeds across ${event.newCells} new places.`;
          break;
        case "sanctuary":
          message.textContent = `A protected sanctuary formed, welcoming life into ${event.newCells} new places.`;
          break;
        case "complete":
          message.textContent = "Rain moves across the canopy. The restored landscape can sustain itself.";
          showCompletion();
          break;
        default:
          message.textContent = message.textContent;
          break;
      }
    }

    function processEvents() {
      model.drainEvents().forEach(handleEvent);
    }

    function beginOrRestart() {
      if (model.status === STATUS.complete) {
        nextSeed += 97;
        model.reset(nextSeed);
        message.textContent = "A new path begins. Older growth will remain wherever you guide it.";
      } else {
        model.status = model.status;
      }
      model.start();
      overlay.classList.add("is-hidden");
      updateInterface();
    }

    function togglePause() {
      const status = model.togglePause();
      if (status === STATUS.paused) {
        message.textContent = "The wave is resting. Press Space or the button to continue.";
      } else if (status === STATUS.running) {
        message.textContent = "Growth continues. Guide the living edge toward open soil.";
      } else {
        message.textContent = message.textContent;
      }
      updateInterface();
    }

    function chooseDirection(direction) {
      model.setDirection(direction);
      if (model.status === STATUS.ready) {
        beginOrRestart();
      } else {
        model.status = model.status;
      }
    }

    function handleKey(event) {
      const key = event.key.toLowerCase();
      switch (key) {
        case "arrowup":
        case "w":
          event.preventDefault();
          chooseDirection("up");
          break;
        case "arrowdown":
        case "s":
          event.preventDefault();
          chooseDirection("down");
          break;
        case "arrowleft":
        case "a":
          event.preventDefault();
          chooseDirection("left");
          break;
        case "arrowright":
        case "d":
          event.preventDefault();
          chooseDirection("right");
          break;
        case " ":
          event.preventDefault();
          togglePause();
          break;
        case "enter":
          event.preventDefault();
          beginOrRestart();
          break;
        default:
          return;
      }
    }

    startButton.addEventListener("click", beginOrRestart);
    pauseButton.addEventListener("click", togglePause);
    document.addEventListener("keydown", handleKey);
    document.querySelectorAll("[data-direction]").forEach((button) => {
      button.addEventListener("click", () => chooseDirection(button.dataset.direction));
    });
    globalThis.addEventListener("resize", () => renderer.resize());

    globalThis.setInterval(() => {
      model.advance();
      processEvents();
      updateInterface();
    }, model.settings.tickMilliseconds);

    function renderFrame(time) {
      renderer.render(time);
      globalThis.requestAnimationFrame(renderFrame);
    }

    updateInterface();
    globalThis.requestAnimationFrame(renderFrame);
  } else {
    throw new Error("Green Wave expected core.js and renderer.js to load before game.js");
  }
})(globalThis);
