import { parseSceneDocument, resetCamera, serializeSceneDocument, wrapYaw } from "./config.js";
import { IslandRenderer } from "./renderer.js?v=5.2";
import { createTerrainObj } from "./terrain.js";
import { createHeightSampler } from "./height-sampler.js";
import { cloneDefaultScene, PRESETS, SCENE_VERSION } from "./types.js";
import { setupInterface } from "./ui.js";

let scene = cloneDefaultScene();
let renderer;
let interfaceApi;
let dirty = true;
const sampleExport = createHeightSampler();
let sceneSeconds = 0;
let lastFrameTime = performance.now();
let frameSampleStart = lastFrameTime;
let renderedFrames = 0;
let displayedFps = 0;
const HEIGHT_FIELD_KEYS = new Set(["seed", "islandRadius", "mountainHeight", "lowland", "ruggedness", "erosion", "detail", "riverFlow"]);

function markChanged(cameraOnly, changedKey) {
  dirty = true;
  if (cameraOnly) {
    interfaceApi.setStatus("Viewpoint updated. Drag to orbit or scroll to zoom.", false);
  } else {
    lastFrameTime = changedKey === "animate" ? performance.now() : lastFrameTime;
    const updateHeightPreview = changedKey === undefined || HEIGHT_FIELD_KEYS.has(changedKey);
    interfaceApi.refresh(scene, updateHeightPreview);
    interfaceApi.setStatus(`World ${scene.settings.seed} regenerated from procedural fields.`, false);
  }
}

function randomizeWorld() {
  const randomSeed = Math.floor(Math.random() * 1000000);
  scene.settings.seed = randomSeed;
  markChanged(false, "seed");
}

function applyPreset(name) {
  Object.assign(scene.settings, PRESETS[name]);
  randomizeWorld();
  for (const button of document.querySelectorAll("[data-preset]")) {
    button.classList.toggle("active", button.dataset.preset === name);
  }
}

function restoreCamera() {
  resetCamera(scene);
  markChanged(true);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === null) {
      await document.getElementById("viewport-shell").requestFullscreen();
      interfaceApi.setStatus("Viewport entered full screen. Use the same control or Escape to leave.", false);
    } else {
      await document.exitFullscreen();
      interfaceApi.setStatus("Viewport left full screen.", false);
    }
    dirty = true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    interfaceApi.setStatus(`Full-screen request failed while changing the viewport: ${detail}`, true);
  }
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveScene() {
  try {
    const text = serializeSceneDocument(scene);
    downloadBlob(new Blob([text], { type: "application/json" }), `procedural-world-${scene.settings.seed}.world.json`);
    interfaceApi.setStatus("Scene saved with validated world and camera settings.", false);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    interfaceApi.setStatus(`Scene save failed while validating the current world: ${detail}`, true);
  }
}

async function openScene(file) {
  try {
    const text = await file.text();
    const loadedScene = parseSceneDocument(text);
    sceneSeconds = 0;
    lastFrameTime = performance.now();
    scene.version = loadedScene.version;
    Object.assign(scene.settings, loadedScene.settings);
    Object.assign(scene.camera, loadedScene.camera);
    interfaceApi.refresh(scene);
    dirty = true;
    interfaceApi.setStatus(`Opened ${file.name}; world ${scene.settings.seed} is ready.`, false);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    interfaceApi.setStatus(detail, true);
  }
}

function exportPng() {
  if (renderer === undefined) {
    interfaceApi.setStatus("PNG export rejected: the WebGL renderer was unavailable; expected a successfully compiled scene before image export.", true);
  } else {
    dirty = true;
    const seed = scene.settings.seed;
    renderer.render(scene, sceneSeconds);
    renderer.canvas.toBlob((blob) => {
      if (blob === null) {
        interfaceApi.setStatus("PNG export failed: the canvas returned no image data; expected a completed WebGL frame.", true);
      } else {
        downloadBlob(blob, `procedural-world-${seed}.png`);
        interfaceApi.setStatus("Viewport render exported as a PNG image.", false);
      }
    }, "image/png");
  }
}

function exportObj() {
  try {
    const model = createTerrainObj(scene.settings, 144);
    downloadBlob(new Blob([model], { type: "text/plain" }), `procedural-island-${scene.settings.seed}.obj`);
    interfaceApi.setStatus("Terrain exported as a 144 × 144 OBJ mesh.", false);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    interfaceApi.setStatus(`OBJ export failed while sampling the terrain: ${detail}`, true);
  }
}

async function exportHeightmap() {
  try {
    const size = 1024;
    const seed = scene.settings.seed;
    interfaceApi.setStatus(`Sampling the heightmap for world ${seed}.`, false);
    const pixels = await sampleExport(scene.settings, size);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Heightmap export failed: the browser returned no 2D canvas context; expected PNG drawing support.");
    } else {
      context.putImageData(new ImageData(pixels, size, size), 0, 0);
    }
    canvas.toBlob((blob) => {
      if (blob === null) {
        interfaceApi.setStatus("Heightmap export failed: the canvas returned no PNG data after drawing the terrain field.", true);
      } else {
        downloadBlob(blob, `procedural-height-${seed}.png`);
        interfaceApi.setStatus("Terrain exported as a 1024 px grayscale heightmap.", false);
      }
    }, "image/png");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    interfaceApi.setStatus(detail, true);
  }
}

const handlers = Object.freeze({
  change: markChanged,
  randomize: randomizeWorld,
  preset: applyPreset,
  resetCamera: restoreCamera,
  fullscreen: toggleFullscreen,
  saveScene,
  openScene,
  exportPng,
  exportObj,
  exportHeightmap,
  status(message, isError) {
    interfaceApi.setStatus(message, isError);
  }
});

interfaceApi = setupInterface(scene, handlers);

try {
  renderer = new IslandRenderer(interfaceApi.canvas);
  interfaceApi.setStatus("Living island ready with river, irregular shore breakers, and summit clouds. Adjust any lab to compose the world.", false);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  interfaceApi.showRenderError(detail);
  interfaceApi.setStatus(detail, true);
}

function drawDirtyFrame() {
  if (!dirty) {
    return 0;
  } else {
    renderer.render(scene, sceneSeconds);
    dirty = false;
    return 1;
  }
}

function updateFrameRate(timestamp) {
  if (timestamp - frameSampleStart < 600) {
    return displayedFps;
  } else {
    const nextFps = renderedFrames * 1000 / (timestamp - frameSampleStart);
    renderedFrames = 0;
    frameSampleStart = timestamp;
    return nextFps;
  }
}

function renderFrame(timestamp) {
  const deltaSeconds = scene.settings.animate ? Math.max(0, (timestamp - lastFrameTime) / 1000) : 0;
  lastFrameTime = timestamp;
  if (renderer !== undefined) {
    sceneSeconds += deltaSeconds;
    const orbitStep = Math.min(0.1, deltaSeconds) * 0.055;
    scene.camera.yaw = scene.settings.animate ? wrapYaw(scene.camera.yaw - orbitStep) : scene.camera.yaw;
    dirty = dirty || scene.settings.animate;
    renderedFrames += drawDirtyFrame();
    displayedFps = updateFrameRate(timestamp);
    interfaceApi.updatePerformance(renderer.canvas.width, renderer.canvas.height, scene.settings.animate ? displayedFps : 0);
  } else {
    dirty = false;
  }
  window.requestAnimationFrame(renderFrame);
}

window.addEventListener("resize", () => {
  dirty = true;
});

window.__PROCEDURAL_WORLDS_READY__ = Object.freeze({
  version: SCENE_VERSION,
  renderer: renderer === undefined ? "unavailable" : "webgl2",
  defaultSeed: scene.settings.seed
});

window.requestAnimationFrame(renderFrame);
