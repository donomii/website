(function runEvilEmpires(document, game) {
  "use strict";

  const elements = {
    opening: document.getElementById("opening"),
    beginButton: document.getElementById("begin-button"),
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

  function romanYear(number) {
    return ["I", "II", "III", "IV", "V", "VI", "VII"][number];
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
    render();
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
      elements.choices.appendChild(button);
    });
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
    render();
    elements.opening.hidden = false;
    elements.beginButton.focus();
  }

  elements.beginButton.addEventListener("click", function beginReign() {
    elements.opening.hidden = true;
  });
  elements.restartButton.addEventListener("click", restart);
  render();
}(document, EvilEmpires));
