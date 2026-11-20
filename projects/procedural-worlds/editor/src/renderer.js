import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders.js?v=5.2";
import { PLANT_SLOT_COUNT, QUALITY_LEVELS, TREE_SLOT_COUNT } from "./types.js";
import { createPlantInstances, createTreeInstances, getRiverRoute } from "./terrain.js";

const PALETTE_INDEX = Object.freeze({ temperate: 0, alpine: 1, volcanic: 2 });

function compileShader(gl, kind, source, label) {
  const shader = gl.createShader(kind);
  if (shader === null) {
    throw new Error(`Renderer initialization failed: WebGL returned no shader object while creating the ${label} shader.`);
  } else {
    gl.shaderSource(shader, source);
  }
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "WebGL supplied no diagnostic log.";
    throw new Error(`Renderer initialization failed: the ${label} shader did not compile. ${log}`);
  } else {
    return shader;
  }
}

function createProgram(gl) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER, "vertex");
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER, "fragment");
  const program = gl.createProgram();
  if (program === null) {
    throw new Error("Renderer initialization failed: WebGL returned no program while linking the landscape renderer.");
  } else {
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "WebGL supplied no diagnostic log.";
    throw new Error(`Renderer initialization failed: the landscape shader program did not link. ${log}`);
  } else {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }
  return program;
}

function requiredUniform(gl, program, name) {
  const location = gl.getUniformLocation(program, name);
  if (location === null) {
    throw new Error(`Renderer initialization failed: uniform ${name} was unavailable after linking; expected every documented scene control to reach the GPU.`);
  } else {
    return location;
  }
}

function sunDirection(settings) {
  const azimuth = settings.sunAzimuth * Math.PI / 180;
  const elevation = settings.sunElevation * Math.PI / 180;
  return [
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  ];
}

export class IslandRenderer {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (gl === null) {
      throw new Error("Renderer initialization failed: this browser did not provide WebGL2; expected a WebGL2-capable browser with hardware acceleration enabled.");
    } else {
      this.gl = gl;
    }
    this.canvas = canvas;
    this.program = createProgram(gl);
    this.uniforms = this.createUniformMap();
    this.createFullscreenTriangle();
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.sceneryKey = "";
    this.treeData = new Float32Array(0);
    this.treeMeta = new Float32Array(0);
    this.plantData = new Float32Array(0);
    this.plantMeta = new Float32Array(0);
    this.sceneryData = Object.freeze({ treeData: this.treeData, treeMeta: this.treeMeta, plantData: this.plantData, plantMeta: this.plantMeta });
  }

  createUniformMap() {
    const gl = this.gl;
    const program = this.program;
    return Object.freeze({
      resolution: requiredUniform(gl, program, "u_resolution"),
      time: requiredUniform(gl, program, "u_time"),
      seed: requiredUniform(gl, program, "u_seed"),
      islandRadius: requiredUniform(gl, program, "u_islandRadius"),
      mountainHeight: requiredUniform(gl, program, "u_mountainHeight"),
      lowland: requiredUniform(gl, program, "u_lowland"),
      ruggedness: requiredUniform(gl, program, "u_ruggedness"),
      erosion: requiredUniform(gl, program, "u_erosion"),
      detail: requiredUniform(gl, program, "u_detail"),
      seaLevel: requiredUniform(gl, program, "u_seaLevel"),
      beachWidth: requiredUniform(gl, program, "u_beachWidth"),
      riverFlow: requiredUniform(gl, program, "u_riverFlow"),
      riverNodes: requiredUniform(gl, program, "u_riverNodes[0]"),
      plantCover: requiredUniform(gl, program, "u_plantCover"),
      cloudCover: requiredUniform(gl, program, "u_cloudCover"),
      cloudScale: requiredUniform(gl, program, "u_cloudScale"),
      cloudDepth: requiredUniform(gl, program, "u_cloudDepth"),
      summitClouds: requiredUniform(gl, program, "u_summitClouds"),
      windStrength: requiredUniform(gl, program, "u_windStrength"),
      stormIntensity: requiredUniform(gl, program, "u_stormIntensity"),
      haze: requiredUniform(gl, program, "u_haze"),
      waveRoughness: requiredUniform(gl, program, "u_waveRoughness"),
      shoreBreakers: requiredUniform(gl, program, "u_shoreBreakers"),
      yaw: requiredUniform(gl, program, "u_yaw"),
      pitch: requiredUniform(gl, program, "u_pitch"),
      distance: requiredUniform(gl, program, "u_distance"),
      sunDirection: requiredUniform(gl, program, "u_sunDirection"),
      palette: requiredUniform(gl, program, "u_palette"),
      steps: requiredUniform(gl, program, "u_steps"),
      treeData: requiredUniform(gl, program, "u_treeData[0]"),
      treeMeta: requiredUniform(gl, program, "u_treeMeta[0]"),
      plantData: requiredUniform(gl, program, "u_plantData[0]"),
      plantMeta: requiredUniform(gl, program, "u_plantMeta[0]")
    });
  }

  createFullscreenTriangle() {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    if (buffer === null) {
      throw new Error("Renderer initialization failed: WebGL returned no vertex buffer for the full-screen landscape triangle.");
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program, "a_position");
    if (position < 0) {
      throw new Error("Renderer initialization failed: the full-screen position attribute was missing after shader linking.");
    } else {
      gl.enableVertexAttribArray(position);
    }
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }

  resize(quality) {
    const scale = QUALITY_LEVELS[quality].scale;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * scale;
    const width = Math.max(2, Math.round(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(2, Math.round(this.canvas.clientHeight * pixelRatio));
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.lastWidth = width;
      this.lastHeight = height;
      this.gl.viewport(0, 0, width, height);
    } else {
      this.gl.viewport(0, 0, this.lastWidth, this.lastHeight);
    }
  }

  getSceneryData(settings) {
    const key = [settings.seed, settings.islandRadius, settings.mountainHeight, settings.lowland, settings.ruggedness, settings.erosion, settings.detail, settings.seaLevel, settings.riverFlow, settings.vegetation, settings.treeVariety, settings.plantCover].join("|");
    if (key !== this.sceneryKey) {
      const trees = createTreeInstances(settings, TREE_SLOT_COUNT);
      const plants = createPlantInstances(settings, trees, PLANT_SLOT_COUNT);
      this.sceneryKey = key;
      this.treeData = new Float32Array(trees.flatMap((tree) => [tree.x, tree.y, tree.z, tree.scale]));
      this.treeMeta = new Float32Array(trees.flatMap((tree) => [tree.kind, tree.rotation]));
      this.plantData = new Float32Array(plants.flatMap((plant) => [plant.x, plant.y, plant.z, plant.scale]));
      this.plantMeta = new Float32Array(plants.flatMap((plant) => [plant.kind, plant.rotation]));
      this.sceneryData = Object.freeze({ treeData: this.treeData, treeMeta: this.treeMeta, plantData: this.plantData, plantMeta: this.plantMeta });
      return this.sceneryData;
    } else {
      return this.sceneryData;
    }
  }

  render(scene, elapsedSeconds) {
    const gl = this.gl;
    const settings = scene.settings;
    const camera = scene.camera;
    const quality = QUALITY_LEVELS[settings.quality];
    const sun = sunDirection(settings);
    const scenery = this.getSceneryData(settings);
    this.resize(settings.quality);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.time, elapsedSeconds);
    gl.uniform1f(this.uniforms.seed, settings.seed);
    gl.uniform1f(this.uniforms.islandRadius, settings.islandRadius);
    gl.uniform1f(this.uniforms.mountainHeight, settings.mountainHeight);
    gl.uniform1f(this.uniforms.lowland, settings.lowland);
    gl.uniform1f(this.uniforms.ruggedness, settings.ruggedness);
    gl.uniform1f(this.uniforms.erosion, settings.erosion);
    gl.uniform1f(this.uniforms.detail, settings.detail);
    gl.uniform1f(this.uniforms.seaLevel, settings.seaLevel);
    gl.uniform1f(this.uniforms.beachWidth, settings.beachWidth);
    gl.uniform1f(this.uniforms.riverFlow, settings.riverFlow);
    gl.uniform2fv(this.uniforms.riverNodes, getRiverRoute(settings));
    gl.uniform1f(this.uniforms.plantCover, settings.plantCover);
    gl.uniform1f(this.uniforms.cloudCover, settings.cloudCover);
    gl.uniform1f(this.uniforms.cloudScale, settings.cloudScale);
    gl.uniform1f(this.uniforms.cloudDepth, settings.cloudDepth);
    gl.uniform1f(this.uniforms.summitClouds, settings.summitClouds);
    gl.uniform1f(this.uniforms.windStrength, settings.windStrength);
    gl.uniform1f(this.uniforms.stormIntensity, settings.stormIntensity);
    gl.uniform1f(this.uniforms.haze, settings.haze);
    gl.uniform1f(this.uniforms.waveRoughness, settings.waveRoughness);
    gl.uniform1f(this.uniforms.shoreBreakers, settings.shoreBreakers);
    gl.uniform1f(this.uniforms.yaw, camera.yaw);
    gl.uniform1f(this.uniforms.pitch, camera.pitch);
    gl.uniform1f(this.uniforms.distance, camera.distance);
    gl.uniform3f(this.uniforms.sunDirection, sun[0], sun[1], sun[2]);
    gl.uniform1i(this.uniforms.palette, PALETTE_INDEX[settings.palette]);
    gl.uniform1i(this.uniforms.steps, quality.steps);
    gl.uniform4fv(this.uniforms.treeData, scenery.treeData);
    gl.uniform2fv(this.uniforms.treeMeta, scenery.treeMeta);
    gl.uniform4fv(this.uniforms.plantData, scenery.plantData);
    gl.uniform2fv(this.uniforms.plantMeta, scenery.plantMeta);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
