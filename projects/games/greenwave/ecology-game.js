(function () {
  "use strict";
  const modeName = document.body.dataset.mode;
  const mode = window.EcologyModes[modeName];
  if (!mode) {
    throw new Error(`Cannot open ecology game: unknown page mode ${String(modeName)}.`);
  } else {
    mount(mode);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }

  function mount(config) {
    const model = new config.Model();
    let selected = config.tools[0].id;
    let focused = model.head ? model.index(model.head.x, model.head.y) : 0;
    let inspected = null;
    const root = document.getElementById("ecology-app");
    const header = element("header", "experiment-header", "");
    const heading = element("div", "", "");
    heading.append(element("p", "experiment-eyebrow", `Variation ${config.number} · One action, one season`), element("h1", "", config.title));
    header.append(heading, element("p", "", config.subtitle));
    const layout = element("section", "experiment-layout ecology-layout", "");
    const boardCard = element("div", "simulation-card ecology-card", "");
    const boardNote = element("p", "ecology-board-note", config.instruction);
    const scroll = element("div", "ecology-board-scroll", "");
    const grid = element("div", `ecology-grid theme-${config.theme}`, "");
    grid.id = "ecology-grid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", `${config.title} landscape`);
    grid.setAttribute("aria-rowcount", String(model.rows));
    grid.setAttribute("aria-colcount", String(model.columns));
    grid.style.setProperty("--columns", String(model.columns));
    const tiles = createTiles(grid, model, focused);
    scroll.append(grid);
    const message = element("p", "simulation-message ecology-message", model.message);
    message.id = "ecology-message";
    message.setAttribute("role", "status");
    const stats = element("div", "simulation-stats ecology-stats", "");
    const inspect = element("p", "ecology-inspect", "Hover or focus a tile for its condition. On small screens, swipe the board sideways.");
    boardCard.append(boardNote, scroll, inspect, message, stats);
    const panel = element("aside", "experiment-panel ecology-panel", "");
    const goalPanel = element("section", "panel-section ecology-goal", "");
    const status = element("span", "experiment-status", "Growing");
    status.id = "ecology-status";
    goalPanel.append(element("p", "experiment-eyebrow", "Your objective"), element("h2", "", "Restore the connections"),
      element("p", "ecology-goal-copy", config.goal), status);
    const toolPanel = element("section", "panel-section", "");
    toolPanel.append(element("h2", "", "Your next action"));
    const toolButtons = config.tools.map(tool => {
      const button = element("button", "plant-tool ecology-tool", "");
      button.type = "button";
      button.dataset.tool = tool.id;
      const copy = element("span", "", "");
      copy.append(element("strong", "", tool.label), element("small", "", tool.help));
      button.append(element("span", "tool-swatch", tool.mark), copy);
      button.addEventListener("click", () => { selected = tool.id; refresh(); });
      toolPanel.append(button);
      return button;
    });
    const rulesPanel = element("section", "panel-section ecology-rules", "");
    rulesPanel.append(element("h2", "", "Reading the landscape"), element("p", "", config.note), element("p", "", config.legend));
    const controls = element("div", "ecology-controls", "");
    const stepButtons = [];
    const quick = quickActions(config, tool => { selected = tool; refresh(); },
      () => perform(() => model.wait()), key => perform(() => model.move(key)), stepButtons);
    boardNote.after(quick.panel);
    if (modeName === "spring") {
      addDirections(controls, stepButtons, key => perform(() => model.move(key)));
    } else {
      const wait = element("button", "experiment-secondary", config.waitLabel);
      wait.id = "ecology-wait";
      wait.type = "button";
      wait.addEventListener("click", () => perform(() => model.wait()));
      controls.append(wait, element("p", "panel-note", config.waitHelp));
      stepButtons.push(wait);
    }
    const reset = element("button", "experiment-text-button", "Restart this mode");
    reset.id = "ecology-reset";
    reset.type = "button";
    reset.addEventListener("click", () => {
      model.reset(model.seed);
      selected = config.tools[0].id;
      inspected = null;
      refresh();
    });
    controls.append(reset, element("p", "panel-note", "Restarts this board from its opening state. Other modes are not affected."));
    toolPanel.append(controls);
    panel.append(goalPanel, toolPanel, rulesPanel);
    layout.append(boardCard, panel);
    root.append(header, layout);
    wireTiles();
    wireKeyboard();
    refresh();

    function perform(action) {
      try {
        action();
        refresh();
      } catch (error) {
        message.textContent = `The action stopped: ${error.message} Restart this mode to recover.`;
        tiles.forEach(tile => { tile.disabled = true; });
        stepButtons.forEach(button => { button.disabled = true; });
        toolButtons.forEach(button => { button.disabled = true; });
        quick.select.disabled = true;
        status.textContent = "Action stopped";
      }
    }

    function refresh() {
      tiles.forEach((tile, index) => {
        const view = model.tileView(index);
        tile.className = `ecology-tile tile-${view.kind}${view.highlight ? " is-highlighted" : ""}`;
        tile.children[0].textContent = view.mark;
        tile.children[1].textContent = view.badge;
        tile.setAttribute("aria-label", `Column ${index % model.columns + 1}, row ${Math.floor(index / model.columns) + 1}. ${view.detail} Action: ${config.tools.find(tool => tool.id === selected).label}.`);
        tile.title = view.detail;
        tile.disabled = model.status === "complete";
      });
      toolButtons.forEach(button => {
        button.classList.toggle("is-selected", button.dataset.tool === selected);
        button.setAttribute("aria-pressed", String(button.dataset.tool === selected));
        button.disabled = model.status === "complete";
      });
      stepButtons.forEach(button => { button.disabled = model.status === "complete"; });
      quick.select.value = selected;
      quick.select.disabled = model.status === "complete";
      quick.help.textContent = config.tools.find(tool => tool.id === selected).help;
      inspect.textContent = inspected === null ? "Hover or focus a tile for its condition. On small screens, swipe the board sideways." : model.tileView(inspected).detail;
      message.textContent = model.message;
      message.classList.toggle("is-complete", model.status === "complete");
      status.textContent = model.status === "complete" ? "Restored" : "Your move";
      const readouts = config.readouts(model).map(readout => {
        const card = element("div", "", "");
        card.append(element("span", "", readout.label), element("strong", "", readout.value), element("small", "", readout.help));
        return card;
      });
      stats.replaceChildren(...readouts);
      root.dataset.turn = String(model.turn);
      root.dataset.status = model.status;
    }

    function wireTiles() {
      tiles.forEach((tile, index) => {
        tile.addEventListener("click", () => {
          inspected = index;
          perform(() => model.act(selected, index % model.columns, Math.floor(index / model.columns)));
        });
        tile.addEventListener("pointerenter", () => { inspected = index; inspect.textContent = model.tileView(index).detail; });
        tile.addEventListener("focus", () => {
          tiles[focused].tabIndex = -1;
          focused = index;
          inspected = index;
          tile.tabIndex = 0;
          inspect.textContent = model.tileView(index).detail;
        });
      });
    }

    function wireKeyboard() {
      document.addEventListener("keydown", event => {
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        const delta = window.EcologyTypes.DIRECTIONS[key];
        const onBoard = grid.contains(event.target);
        if (!delta || event.altKey || event.ctrlKey || event.metaKey || event.repeat) {
          return;
        } else if (modeName === "spring" && (onBoard || event.target === document.body)) {
          event.preventDefault();
          perform(() => model.move(key));
        } else if (onBoard && key.startsWith("Arrow")) {
          event.preventDefault();
          const x = Math.max(0, Math.min(model.columns - 1, focused % model.columns + delta[0]));
          const y = Math.max(0, Math.min(model.rows - 1, Math.floor(focused / model.columns) + delta[1]));
          tiles[y * model.columns + x].focus();
        } else {
          return;
        }
      });
    }
  }

  function quickActions(config, choose, wait, move, stepButtons) {
    const panel = element("div", "ecology-quick", "");
    const label = element("label", "experiment-eyebrow", "Tile action");
    const select = element("select", "ecology-select", "");
    select.id = "ecology-quick-tool";
    label.htmlFor = select.id;
    for (const tool of config.tools) {
      const option = element("option", "", tool.label);
      option.value = tool.id;
      select.append(option);
    }
    select.addEventListener("change", () => choose(select.value));
    const help = element("p", "panel-note", config.tools[0].help);
    panel.append(label, select, help);
    if (modeName === "spring") {
      addDirections(panel, stepButtons, move);
    } else {
      const button = element("button", "experiment-secondary", config.waitLabel);
      button.type = "button";
      button.addEventListener("click", wait);
      stepButtons.push(button);
      panel.append(button, element("p", "panel-note", config.waitHelp));
    }
    return { panel, select, help };
  }

  function createTiles(grid, model, focused) {
    const tiles = [];
    for (let y = 0; y < model.rows; y += 1) {
      const row = element("div", "ecology-row", "");
      row.setAttribute("role", "row");
      for (let x = 0; x < model.columns; x += 1) {
        const tile = element("button", "ecology-tile", "");
        tile.type = "button";
        tile.setAttribute("role", "gridcell");
        tile.dataset.x = String(x);
        tile.dataset.y = String(y);
        tile.tabIndex = model.index(x, y) === focused ? 0 : -1;
        tile.append(element("span", "tile-mark", ""), element("span", "tile-badge", ""));
        row.append(tile);
        tiles.push(tile);
      }
      grid.append(row);
    }
    return tiles;
  }

  function addDirections(controls, buttons, move) {
    const pad = element("div", "ecology-directions", "");
    for (const [key, label] of [["ArrowUp", "↑ North"], ["ArrowLeft", "← West"], ["ArrowDown", "↓ South"], ["ArrowRight", "→ East"]]) {
      const button = element("button", "experiment-secondary", label);
      button.type = "button";
      button.addEventListener("click", () => move(key));
      buttons.push(button);
      pad.append(button);
    }
    controls.append(pad, element("p", "panel-note", "Each direction button moves one tile and advances one beat. You can also click an adjacent tile."));
  }
})();
