import { Zipper } from "./zipper.js?v=20261004-2";
import { BrowserBridge } from "./browser.js?v=20261004-2";
import { examples } from "./examples.js?v=20261004-2";
import { DEFAULTS, requireValue } from "./types.js?v=20261004-2";
import { elements, updateLines, updateView } from "./view.js?v=20261004-2";

async function mount(root) {
  const response = await fetch(new URL("./playground.html?v=20261004-2", import.meta.url));
  requireValue(response.ok, `Could not load the editor: HTTP ${response.status}.`);
  root.innerHTML = await response.text();
  const ui = elements(root);
  for (const example of examples) {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.title;
    ui.example.append(option);
  }
  root.querySelector(".zl-footer a").href = new URL("./zipper.js?v=20261004-2", import.meta.url).href;
  ui.delay.value = String(DEFAULTS.delay);
  ui.limit.value = String(DEFAULTS.stepLimit);
  ui.limit.max = String(DEFAULTS.maxStepLimit);
  const state = { running: false, busy: false, dirty: false, editing: false, generation: 0, runToken: 0, console: [] };
  const bridge = new BrowserBridge(ui.preview, text => appendConsole(text));
  const machine = new Zipper(examples[0].source, {
    callHost: (name, args, signal) => bridge.call(name, args, signal),
  });

  function render() {
    updateView(ui, machine, state);
  }

  function report(error) {
    state.running = false;
    render();
    ui.status.textContent = "Error";
    ui.status.dataset.status = "error";
    ui.message.textContent = error.message;
  }

  function appendConsole(text) {
    state.console.push(text);
    state.console = state.console.slice(-100);
    ui.console.textContent = state.console.join("\n").slice(-DEFAULTS.maxOutputLength);
    ui.consoleCount.textContent = state.console.length + " messages";
  }

  function clearConsole() {
    state.console = [];
    ui.console.textContent = "";
    ui.consoleCount.textContent = "0 messages";
  }

  function restart() {
    // A reset must remain available even while the step-limit field is invalid.

    machine.reset(ui.source.value);
    state.generation += 1;
    state.runToken += 1;
    state.running = false;
    state.busy = false;
    state.dirty = false;
    bridge.reset();
    clearConsole();
    closeTapeEditor();
    render();
  }

  function loadExample() {
    const example = examples.find(item => item.id === ui.example.value);
    requireValue(example !== undefined, "Choose a listed example.");
    ui.source.value = example.source;
    ui.exampleDescription.textContent = example.description;
    updateLines(ui);
    restart();
  }

  function prepare(replay) {
    requireValue(!state.editing, "Apply or cancel tape edits before running.");
    machine.setStepLimit(Number(ui.limit.value));
    if (state.dirty || (replay && machine.status === "halted")) {
      restart();
    } else {
      return;
    }
  }

  async function step() {
    prepare(false);
    await advance(state.generation);
  }

  async function advance(generation) {
    state.busy = true;
    const pending = machine.step();
    render();
    await pending;
    if (generation === state.generation) {
      state.busy = false;
      render();
    } else {
      return;
    }
  }

  async function run() {
    state.runToken += 1;

    if (state.running) {
      state.running = false;
      render();
    } else {
      prepare(true);
      state.running = true;
      const runToken = state.runToken;
      const generation = state.generation;
      render();
      while (state.running && runToken === state.runToken && generation === state.generation && machine.status === "ready") {
        await advance(generation);
        if (state.running && runToken === state.runToken && machine.status === "ready" && generation === state.generation) {
          await new Promise(resolve => setTimeout(resolve, Number(ui.delay.value)));
        } else {
          break;
        }
      }
      if (runToken === state.runToken && generation === state.generation) {
        state.running = false;
        render();
      } else {
        return;
      }
    }
  }

  function closeTapeEditor() {
    state.editing = false;
    ui.tape.hidden = false;
    ui.tapeEditor.hidden = true;
    render();
  }

  function download() {
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([ui.source.value], { type: "text/plain;charset=utf-8" }));
    link.href = url;
    link.download = "program.piz";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function on(button, action) {
    button.addEventListener("click", () => Promise.resolve().then(action).catch(report));
  }

  on(ui.run, run);
  on(ui.step, step);
  on(ui.reset, restart);
  on(ui.load, loadExample);
  on(ui.back, () => { machine.back(); render(); });
  on(ui.download, download);
  on(ui.editTape, () => {
    state.editing = true;
    render();
    ui.tapeSource.value = machine.tape;
    ui.tape.hidden = true;
    ui.tapeEditor.hidden = false;
    ui.tapeSource.focus();
  });
  on(ui.cancelTape, closeTapeEditor);
  on(ui.applyTape, () => {
    machine.editTape(ui.tapeSource.value);
    closeTapeEditor();
    render();
  });
  ui.limit.addEventListener("change", () => {
    try {
      machine.setStepLimit(Number(ui.limit.value));
      render();
    } catch (error) {
      report(error);
    }
  });
  ui.source.addEventListener("input", () => {
    state.dirty = true;
    updateLines(ui);
    render();
  });
  ui.source.addEventListener("scroll", () => { ui.lines.scrollTop = ui.source.scrollTop; });
  ui.source.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (state.busy && !state.running) {
        return;
      } else {
        void run().catch(report);
      }
    } else {
      return;
    }
  });
  loadExample();
  // The containing page may embed its own interpreter with an explicit JS host.
  root.dispatchEvent(new CustomEvent("zipper-ready", { bubbles: true }));
}

const root = document.getElementById("zipper-playground");
if (root === null) {
  throw new Error("Zipper needs a #zipper-playground element.");
} else {
  mount(root).catch(error => {
    root.textContent = "Zipper could not start. " + error.message + " Open this page through a web server, then reload.";
  });
}
