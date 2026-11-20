(function runEvilEmpires(document, game) {
  "use strict";

  const elements = {
    menuButton: document.getElementById("menu-button"),
    menu: document.getElementById("council-menu"),
    closeMenuButton: document.getElementById("close-menu-button"),
    menuBackdrop: document.getElementById("menu-backdrop"),
    decreeCard: document.getElementById("decree-card"),
    yearLabel: document.getElementById("year-label"),
    doctrineLabel: document.getElementById("doctrine-label"),
    decreeTitle: document.getElementById("decree-title"),
    decreeCommand: document.getElementById("decree-command"),
    decreeBriefing: document.getElementById("decree-briefing"),
    choices: document.getElementById("choices"),
    chronicle: document.getElementById("chronicle"),
    endingCard: document.getElementById("ending-card"),
    endingTitle: document.getElementById("ending-title"),
    endingText: document.getElementById("ending-text"),
    restartButton: document.getElementById("restart-button"),
    stats: {
      favour: {
        value: document.getElementById("favour-value"),
        meter: document.getElementById("favour-meter")
      },
      treasury: {
        value: document.getElementById("treasury-value"),
        meter: document.getElementById("treasury-meter")
      },
      prosperity: {
        value: document.getElementById("prosperity-value"),
        meter: document.getElementById("prosperity-meter")
      },
      peace: {
        value: document.getElementById("peace-value"),
        meter: document.getElementById("peace-meter")
      }
    }
  };

  let state = game.createGame();
  let selectedChoiceIndex = 0;
  let gamepadActive = false;
  let previousGamepadButtons = new Array(16).fill(false);
  let previousGamepadAxis = 0;

  function romanYear(number) {
    return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][number];
  }

  function renderStats() {
    Object.keys(elements.stats).forEach(function updateStat(name) {
      const value = state.stats[name];
      elements.stats[name].value.textContent = String(value);
      elements.stats[name].meter.style.width = value + "%";
    });
  }

  function renderChronicle() {
    elements.chronicle.replaceChildren();
    if (state.history.length === 0) {
      const emptyEntry = document.createElement("li");
      emptyEntry.textContent = "No decrees have yet been inflicted upon the realm.";
      elements.chronicle.appendChild(emptyEntry);
    } else {
      state.history.slice().reverse().forEach(function addEntry(entry) {
        const item = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = entry.choice;
        item.append(title, entry.outcome);
        elements.chronicle.appendChild(item);
      });
    }
  }

  function selectChoice(choiceIndex) {
    state = game.applyChoice(state, choiceIndex);
    selectedChoiceIndex = 0;
    render();
  }

  function choiceButtons() {
    return Array.from(elements.choices.querySelectorAll(".choice-button"));
  }

  function updateGamepadSelection() {
    choiceButtons().forEach(function markSelectedChoice(button, choiceIndex) {
      button.classList.toggle("gamepad-selected", gamepadActive && choiceIndex === selectedChoiceIndex);
    });
    elements.restartButton.classList.toggle("gamepad-selected", gamepadActive && state.ended);
  }

  function renderChoices(decree) {
    elements.choices.replaceChildren();
    decree.choices.forEach(function addChoice(choice, choiceIndex) {
      const button = document.createElement("button");
      const title = document.createElement("span");
      const description = document.createElement("span");
      button.className = "choice-button";
      button.type = "button";
      title.className = "choice-title";
      description.className = "choice-description";
      title.textContent = choice.title;
      description.textContent = choice.description;
      button.append(title, description);
      button.addEventListener("click", function choosePolicy() {
        selectChoice(choiceIndex);
      });
      button.addEventListener("focus", function rememberFocusedPolicy() {
        selectedChoiceIndex = choiceIndex;
        updateGamepadSelection();
      });
      elements.choices.appendChild(button);
    });
    updateGamepadSelection();
  }

  function renderDecree() {
    const decree = game.decrees[state.turn];
    elements.yearLabel.textContent = "Year " + romanYear(state.turn);
    elements.doctrineLabel.textContent = decree.doctrine;
    elements.decreeTitle.textContent = decree.title;
    elements.decreeCommand.textContent = decree.command;
    elements.decreeBriefing.textContent = decree.briefing;
    renderChoices(decree);
  }

  function render() {
    renderStats();
    renderChronicle();
    if (state.ended) {
      elements.decreeCard.hidden = true;
      elements.endingCard.hidden = false;
      elements.endingTitle.textContent = state.ending.title;
      elements.endingText.textContent = state.ending.text;
      elements.endingCard.scrollIntoView({ block: "start" });
    } else {
      elements.decreeCard.hidden = false;
      elements.endingCard.hidden = true;
      renderDecree();
    }
  }

  function restart() {
    state = game.createGame();
    selectedChoiceIndex = 0;
    render();
    elements.decreeCard.scrollIntoView({ block: "start" });
  }

  function setMenu(open) {
    elements.menu.hidden = !open;
    elements.menuBackdrop.hidden = !open;
    elements.menuButton.setAttribute("aria-expanded", String(open));
    (open ? elements.closeMenuButton : elements.menuButton).focus();
  }

  function currentGamepad() {
    if (typeof navigator.getGamepads === "function") {
      return Array.from(navigator.getGamepads()).find(function connectedGamepad(gamepadDevice) {
        return gamepadDevice !== null;
      }) || null;
    } else {
      return null;
    }
  }

  function buttonBecamePressed(gamepadDevice, buttonIndex) {
    return Boolean(
      gamepadDevice.buttons[buttonIndex] &&
      gamepadDevice.buttons[buttonIndex].pressed &&
      previousGamepadButtons[buttonIndex] === false
    );
  }

  function moveGamepadSelection(direction) {
    const buttons = choiceButtons();
    if (buttons.length === 0) {
      selectedChoiceIndex = 0;
    } else {
      selectedChoiceIndex = (selectedChoiceIndex + direction + buttons.length) % buttons.length;
      buttons[selectedChoiceIndex].focus();
    }
    updateGamepadSelection();
  }

  function activateGamepadSelection() {
    if (state.ended) {
      elements.restartButton.click();
    } else {
      const buttons = choiceButtons();
      if (buttons[selectedChoiceIndex]) {
        buttons[selectedChoiceIndex].click();
      } else {
        throw new Error("Cannot enact gamepad policy: the selected policy button is missing from the current decree.");
      }
    }
  }

  function pollGamepad() {
    const gamepadDevice = currentGamepad();
    if (gamepadDevice === null) {
      gamepadActive = false;
      previousGamepadButtons = new Array(16).fill(false);
      previousGamepadAxis = 0;
      updateGamepadSelection();
    } else {
      const axisY = gamepadDevice.axes.length > 1 ? gamepadDevice.axes[1] : 0;
      const moveUp = buttonBecamePressed(gamepadDevice, 12) || (axisY <= -0.6 && previousGamepadAxis > -0.6);
      const moveDown = buttonBecamePressed(gamepadDevice, 13) || (axisY >= 0.6 && previousGamepadAxis < 0.6);
      const confirm = buttonBecamePressed(gamepadDevice, 0);
      const back = buttonBecamePressed(gamepadDevice, 1);
      const menu = buttonBecamePressed(gamepadDevice, 9);
      gamepadActive = true;
      if (menu) {
        setMenu(elements.menu.hidden);
      } else if (!elements.menu.hidden && back) {
        setMenu(false);
      } else if (!elements.menu.hidden) {
        updateGamepadSelection();
      } else if (moveUp) {
        moveGamepadSelection(-1);
      } else if (moveDown) {
        moveGamepadSelection(1);
      } else if (confirm) {
        activateGamepadSelection();
      } else {
        updateGamepadSelection();
      }
      previousGamepadButtons = gamepadDevice.buttons.map(function rememberButton(button) {
        return button.pressed;
      });
      previousGamepadAxis = axisY;
    }
    window.requestAnimationFrame(pollGamepad);
  }

  elements.restartButton.addEventListener("click", restart);
  elements.menuButton.addEventListener("click", function openMenu() {
    setMenu(true);
  });
  elements.closeMenuButton.addEventListener("click", function closeMenu() {
    setMenu(false);
  });
  elements.menuBackdrop.addEventListener("click", function closeMenuFromBackdrop() {
    setMenu(false);
  });
  render();
  window.requestAnimationFrame(pollGamepad);
}(document, EvilEmpires));
