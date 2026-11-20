import { CONTROL_GROUPS, PRESETS, QUALITY_LEVELS } from "./types.js";
import { createHeightSampler, createPreviewQueue } from "./height-sampler.js";
import { wrapYaw } from "./config.js";

function requiredElement(id) {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Interface initialization failed: element #${id} was missing; expected the documented Procedural Worlds control surface.`);
  } else {
    return element;
  }
}

function formatValue(value, step, unit) {
  const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return `${value.toFixed(decimals)}${unit}`;
}

function buildRangeControl(definition, scene, onChange) {
  const label = document.createElement("label");
  label.className = "range-control";
  label.htmlFor = `control-${definition.key}`;
  const header = document.createElement("span");
  header.className = "range-header";
  const name = document.createElement("span");
  name.textContent = definition.label;
  const output = document.createElement("output");
  output.htmlFor = `control-${definition.key}`;
  const input = document.createElement("input");
  input.id = `control-${definition.key}`;
  input.type = "range";
  input.min = String(definition.min);
  input.max = String(definition.max);
  input.step = String(definition.step);
  input.value = String(scene.settings[definition.key]);
  const help = document.createElement("span");
  help.className = "control-help";
  help.textContent = definition.help;
  output.value = formatValue(scene.settings[definition.key], definition.step, definition.unit);
  input.addEventListener("input", () => {
    scene.settings[definition.key] = input.valueAsNumber;
    output.value = formatValue(input.valueAsNumber, definition.step, definition.unit);
    onChange(false, definition.key);
  });
  header.append(name, output);
  label.append(header, input, help);
  return Object.freeze({ root: label, input, output, definition });
}

function buildControlPanels(scene, onChange) {
  const target = requiredElement("generated-controls");
  const bindings = new Map();
  for (const group of CONTROL_GROUPS) {
    const panel = document.createElement("section");
    panel.className = "panel";
    const title = document.createElement("div");
    title.className = "panel-title";
    const titleText = document.createElement("span");
    titleText.textContent = group.title;
    const technique = document.createElement("span");
    technique.textContent = group.technique;
    title.append(titleText, technique);
    panel.append(title);
    for (const definition of group.controls) {
      const binding = buildRangeControl(definition, scene, onChange);
      bindings.set(definition.key, binding);
      panel.append(binding.root);
    }
    target.append(panel);
  }
  return bindings;
}

function drawHeightPreview(canvas, pixels) {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Height preview failed: the browser returned no 2D drawing context; expected canvas image support.");
  } else {
    const previewSize = 144;
    const square = new ImageData(pixels, previewSize, previewSize);
    const staging = document.createElement("canvas");
    staging.width = previewSize;
    staging.height = previewSize;
    const stagingContext = staging.getContext("2d");
    if (stagingContext === null) {
      throw new Error("Height preview failed: the browser returned no staging context while scaling the terrain field.");
    } else {
      stagingContext.putImageData(square, 0, 0);
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(staging, 0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(111, 224, 203, 0.58)";
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  }
}

function bindCamera(canvas, scene, onChange) {
  const pointers = new Map();
  function separation() {
    const [a, b] = pointers.values();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 0 && pointers.size < 2) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const before = pointers.size === 2 ? separation() : 0;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const after = separation();
      if (before < 1 || after < 1) return;
      scene.camera.distance = Math.min(18, Math.max(4.5, scene.camera.distance * before / after));
    } else {
      const deltaX = event.clientX - previous.x;
      const deltaY = event.clientY - previous.y;
      scene.camera.yaw = wrapYaw(scene.camera.yaw - deltaX * 0.006);
      scene.camera.pitch = Math.min(1.25, Math.max(0.02, scene.camera.pitch + deltaY * 0.005));
    }
    onChange(true);
  });
  const finishDrag = (event) => pointers.delete(event.pointerId);
  canvas.addEventListener("pointerup", finishDrag);
  canvas.addEventListener("pointercancel", finishDrag);
  canvas.addEventListener("lostpointercapture", finishDrag);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    scene.camera.distance = Math.min(18, Math.max(4.5, scene.camera.distance + event.deltaY * 0.008));
    onChange(true);
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      scene.camera.yaw = wrapYaw(scene.camera.yaw + 0.08);
    } else if (event.key === "ArrowRight") {
      scene.camera.yaw = wrapYaw(scene.camera.yaw - 0.08);
    } else if (event.key === "ArrowUp") {
      scene.camera.pitch = Math.min(1.25, scene.camera.pitch + 0.06);
    } else if (event.key === "ArrowDown") {
      scene.camera.pitch = Math.max(0.02, scene.camera.pitch - 0.06);
    } else {
      return;
    }
    event.preventDefault();
    onChange(true);
  });
}

export function setupInterface(scene, handlers) {
  const canvas = requiredElement("viewport");
  const controls = requiredElement("toggle-controls");
  controls.addEventListener("click", () => {
    const open = requiredElement("world-controls").parentElement.classList.toggle("inspector-open");
    controls.setAttribute("aria-expanded", String(open));
  });
  requiredElement("exit-fullscreen").addEventListener("click", handlers.fullscreen);
  const seed = requiredElement("seed");
  const palette = requiredElement("palette");
  const quality = requiredElement("quality");
  const animate = requiredElement("animate");
  const heightPreview = requiredElement("height-preview");
  const status = requiredElement("status-message");
  const bindings = buildControlPanels(scene, handlers.change);
  const requestPreview = createPreviewQueue(createHeightSampler(),
    (pixels) => drawHeightPreview(heightPreview, pixels),
    (error) => setStatus(`Height preview failed: ${error.message}`, true));
  seed.addEventListener("change", () => {
    const value = seed.valueAsNumber;
    if (Number.isInteger(value) && value >= 0 && value <= 999999) {
      scene.settings.seed = value;
      handlers.change(false, "seed");
    } else {
      const rejectedValue = seed.value || "empty";
      seed.value = String(scene.settings.seed);
      handlers.status(`Seed rejected: ${rejectedValue}; enter a whole number from 0 through 999999.`, true);
    }
  });
  requiredElement("randomize-seed").addEventListener("click", handlers.randomize);
  palette.addEventListener("change", () => {
    scene.settings.palette = palette.value;
    handlers.change(false, "palette");
  });
  quality.addEventListener("change", () => {
    scene.settings.quality = quality.value;
    handlers.change(false, "quality");
  });
  animate.addEventListener("change", () => {
    scene.settings.animate = animate.checked;
    handlers.change(false, "animate");
  });
  for (const button of document.querySelectorAll("[data-preset]")) {
    button.addEventListener("click", () => {
      const presetName = button.dataset.preset;
      if (presetName !== undefined && Object.hasOwn(PRESETS, presetName)) {
        handlers.preset(presetName);
      } else {
        handlers.status(`Preset rejected: ${String(presetName)} was not a documented world preset.`, true);
      }
    });
  }
  requiredElement("new-world").addEventListener("click", handlers.randomize);
  requiredElement("reset-camera").addEventListener("click", handlers.resetCamera);
  requiredElement("fullscreen").addEventListener("click", handlers.fullscreen);
  requiredElement("save-scene").addEventListener("click", handlers.saveScene);
  requiredElement("open-scene").addEventListener("click", () => requiredElement("scene-file").click());
  requiredElement("scene-file").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files === null ? undefined : input.files[0];
    if (file === undefined) {
      handlers.status("Open scene cancelled; the current world was left unchanged.", false);
    } else {
      await handlers.openScene(file);
      input.value = "";
    }
  });
  requiredElement("export-png").addEventListener("click", handlers.exportPng);
  requiredElement("export-obj").addEventListener("click", handlers.exportObj);
  requiredElement("export-heightmap").addEventListener("click", handlers.exportHeightmap);
  bindCamera(canvas, scene, handlers.change);

  function refresh(nextScene, updateHeightPreview = true) {
    seed.value = String(nextScene.settings.seed);
    palette.value = nextScene.settings.palette;
    quality.value = nextScene.settings.quality;
    animate.checked = nextScene.settings.animate;
    for (const [key, binding] of bindings.entries()) {
      binding.input.value = String(nextScene.settings[key]);
      binding.output.value = formatValue(nextScene.settings[key], binding.definition.step, binding.definition.unit);
    }
    const qualityDefinition = QUALITY_LEVELS[nextScene.settings.quality];
    requiredElement("quality-readout").textContent = `${qualityDefinition.label.toUpperCase()} · ${qualityDefinition.steps} STEPS`;
    for (const button of document.querySelectorAll("[data-preset]")) {
      button.classList.remove("active");
    }
    if (updateHeightPreview) {
      requestPreview(nextScene.settings);
    } else {
      return;
    }
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? "#e7a18e" : "#769792";
  }

  function updatePerformance(width, height, fps) {
    requiredElement("resolution-readout").textContent = `${width} × ${height}`;
    requiredElement("fps-readout").textContent = fps > 0 ? `${fps.toFixed(0)} FPS` : "STILL FRAME";
  }

  function showRenderError(message) {
    requiredElement("render-error-message").textContent = message;
    requiredElement("render-error").hidden = false;
  }

  refresh(scene);
  return Object.freeze({ refresh, setStatus, updatePerformance, showRenderError, canvas });
}
