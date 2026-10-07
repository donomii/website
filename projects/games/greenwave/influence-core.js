(function attachInfluenceCore(root, factory) {
  "use strict";

  const publicApi = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = publicApi;
  } else {
    root.GreenWaveInfluence = publicApi;
  }
})(typeof globalThis === "object" ? globalThis : window, function createInfluenceCore() {
  "use strict";

  // These defaults control the map, restoration goal, simulation pace, and seed economy.
  const DEFAULT_SETTINGS = Object.freeze({
    columns: 30,
    rows: 18,
    tickMilliseconds: 420,
    targetPercent: 70,
    startingSeeds: 18,
    maximumSeeds: 24
  });

  const PLANT_TYPES = Object.freeze({
    clover: Object.freeze({
      name: "Clover Circle",
      cost: 2,
      radius: 2,
      centerStage: 1,
      fertility: 0.38,
      moisture: 0.05,
      seeds: 0.14,
      color: "#a8c85e"
    }),
    pioneer: Object.freeze({
      name: "Pioneer Tree",
      cost: 4,
      radius: 3,
      centerStage: 2,
      fertility: 0.12,
      moisture: 0.12,
      seeds: 0.48,
      color: "#4f8b58"
    }),
    rain: Object.freeze({
      name: "Rain Grove",
      cost: 6,
      radius: 4,
      centerStage: 3,
      fertility: 0.08,
      moisture: 0.52,
      seeds: 0.2,
      color: "#3e7d78"
    })
  });

  const STATUS = Object.freeze({
    ready: "ready",
    running: "running",
    paused: "paused",
    complete: "complete"
  });

  function assertInteger(value, name, minimum, maximum) {
    if (Number.isInteger(value) && value >= minimum && value <= maximum) {
      return value;
    } else {
      throw new Error(`${name} must be an integer from ${minimum} through ${maximum}; received ${String(value)}`);
    }
  }

  function validateSettings(options) {
    if (options !== null && typeof options === "object" && !Array.isArray(options)) {
      const settings = Object.assign({}, DEFAULT_SETTINGS);
      Object.keys(options).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
          settings[key] = options[key];
        } else {
          throw new Error(`Unknown Influence Garden setting "${key}"`);
        }
      });
      assertInteger(settings.columns, "columns", 5, 100);
      assertInteger(settings.rows, "rows", 5, 100);
      assertInteger(settings.tickMilliseconds, "tickMilliseconds", 60, 5000);
      assertInteger(settings.targetPercent, "targetPercent", 1, 100);
      assertInteger(settings.startingSeeds, "startingSeeds", 1, 1000);
      assertInteger(settings.maximumSeeds, "maximumSeeds", settings.startingSeeds, 2000);
      return settings;
    } else {
      throw new Error("InfluenceGardenModel settings must be a plain object");
    }
  }

  function deterministicValue(x, y, generation, seed) {
    const raw = Math.sin(x * 81.17 + y * 37.91 + generation * 19.73 + seed * 0.00013) * 17391.716;
    return raw - Math.floor(raw);
  }

  function distance(firstX, firstY, secondX, secondY) {
    return Math.hypot(firstX - secondX, firstY - secondY);
  }

  class InfluenceGardenModel {
    constructor(options = {}) {
      this.settings = validateSettings(options);
      this.reset(0x53454544);
    }

    reset(seed) {
      assertInteger(seed, "seed", 0, 0x7fffffff);
      this.seed = seed;
      this.generation = 0;
      this.status = STATUS.ready;
      this.seedCount = this.settings.startingSeeds;
      this.plants = [];
      this.events = [];
      this.cells = [];
      this.lastInfluence = [];
      for (let y = 0; y < this.settings.rows; y += 1) {
        for (let x = 0; x < this.settings.columns; x += 1) {
          this.cells.push({
            stage: 0,
            age: 0,
            baseMoisture: 0.12 + deterministicValue(x, y, 3, seed) * 0.42,
            baseFertility: 0.1 + deterministicValue(x, y, 7, seed) * 0.38
          });
          this.lastInfluence.push({ fertility: 0, moisture: 0, seeds: 0, coverage: 0 });
        }
      }
      return this.getSnapshot();
    }

    indexOf(x, y) {
      return y * this.settings.columns + x;
    }

    isInside(x, y) {
      return x >= 0 && x < this.settings.columns && y >= 0 && y < this.settings.rows;
    }

    getCell(x, y) {
      if (this.isInside(x, y)) {
        return this.cells[this.indexOf(x, y)];
      } else {
        throw new Error(`Cell (${x}, ${y}) is outside the Influence Garden`);
      }
    }

    start() {
      if (this.status === STATUS.ready || this.status === STATUS.paused) {
        this.status = STATUS.running;
      } else {
        this.status = this.status;
      }
      return this.status;
    }

    togglePause() {
      if (this.status === STATUS.running) {
        this.status = STATUS.paused;
      } else if (this.status === STATUS.paused || this.status === STATUS.ready) {
        this.status = STATUS.running;
      } else {
        this.status = this.status;
      }
      return this.status;
    }

    plant(kind, x, y) {
      if (Object.prototype.hasOwnProperty.call(PLANT_TYPES, kind)) {
        assertInteger(x, "plant x", 0, this.settings.columns - 1);
        assertInteger(y, "plant y", 0, this.settings.rows - 1);
        const definition = PLANT_TYPES[kind];
        const occupied = this.plants.some((plant) => plant.x === x && plant.y === y);
        if (this.status === STATUS.complete) {
          return { planted: false, reason: "complete" };
        } else if (occupied) {
          return { planted: false, reason: "occupied" };
        } else if (this.seedCount < definition.cost) {
          return { planted: false, reason: "seeds" };
        } else {
          const overlaps = this.plants.some((plant) => {
            const otherDefinition = PLANT_TYPES[plant.kind];
            return distance(x, y, plant.x, plant.y) < definition.radius + otherDefinition.radius;
          });
          this.seedCount -= definition.cost;
          this.plants.push({ kind, x, y, plantedAt: this.generation });
          const centerCell = this.getCell(x, y);
          centerCell.stage = Math.max(centerCell.stage, definition.centerStage);
          centerCell.age = 0;
          this.events.push({ type: overlaps ? "symbiosis" : "planted", kind, x, y });
          return { planted: true, reason: overlaps ? "symbiosis" : "planted" };
        }
      } else {
        throw new Error(`Unknown plant kind "${String(kind)}"; expected clover, pioneer, or rain`);
      }
    }

    calculateInfluence() {
      const influences = this.cells.map(() => ({ fertility: 0, moisture: 0, seeds: 0, coverage: 0 }));
      this.plants.forEach((plant) => {
        const definition = PLANT_TYPES[plant.kind];
        const minimumX = Math.max(0, plant.x - definition.radius);
        const maximumX = Math.min(this.settings.columns - 1, plant.x + definition.radius);
        const minimumY = Math.max(0, plant.y - definition.radius);
        const maximumY = Math.min(this.settings.rows - 1, plant.y + definition.radius);
        for (let y = minimumY; y <= maximumY; y += 1) {
          for (let x = minimumX; x <= maximumX; x += 1) {
            const separation = distance(x, y, plant.x, plant.y);
            if (separation <= definition.radius) {
              const strength = 0.35 + (1 - separation / definition.radius) * 0.65;
              const influence = influences[this.indexOf(x, y)];
              influence.fertility += definition.fertility * strength;
              influence.moisture += definition.moisture * strength;
              influence.seeds += definition.seeds * strength;
              influence.coverage += 1;
            } else {
              influences[this.indexOf(x, y)].coverage += 0;
            }
          }
        }
      });
      this.lastInfluence = influences;
      return influences;
    }

    neighborCounts(x, y) {
      let vegetation = 0;
      let forest = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          const isCenter = offsetX === 0 && offsetY === 0;
          if (!isCenter && this.isInside(neighborX, neighborY)) {
            const stage = this.getCell(neighborX, neighborY).stage;
            vegetation += stage > 0 ? 1 : 0;
            forest += stage === 3 ? 1 : 0;
          } else {
            vegetation += 0;
          }
        }
      }
      return { vegetation, forest };
    }

    nextCell(cell, influence, neighbors, x, y) {
      const next = {
        stage: cell.stage,
        age: cell.age,
        baseMoisture: cell.baseMoisture,
        baseFertility: cell.baseFertility
      };
      const synergy = influence.coverage >= 2 ? 0.24 : 0;
      switch (cell.stage) {
        case 0: {
          const potential = cell.baseMoisture * 0.2 + cell.baseFertility * 0.18 +
            influence.moisture + influence.fertility + influence.seeds +
            neighbors.vegetation * 0.025 + neighbors.forest * 0.05 + synergy;
          const chance = Math.max(0, Math.min(0.82, potential - 0.34));
          const germinates = deterministicValue(x, y, this.generation, this.seed) < chance;
          next.stage = germinates ? 1 : 0;
          next.age = 0;
          break;
        }
        case 1: {
          next.age += 1;
          const supported = influence.seeds + synergy >= 0.13 || neighbors.forest >= 1 || neighbors.vegetation >= 4;
          const hydrated = cell.baseMoisture + influence.moisture >= 0.27;
          next.stage = next.age >= 2 && supported && hydrated ? 2 : 1;
          next.age = next.stage === 2 ? 0 : next.age;
          break;
        }
        case 2: {
          next.age += 1;
          const forestReady = next.age >= 4 && cell.baseMoisture + influence.moisture + synergy >= 0.31;
          next.stage = forestReady ? 3 : 2;
          next.age = next.stage === 3 ? 0 : next.age;
          break;
        }
        default:
          next.age += 1;
          break;
      }
      return next;
    }

    advance() {
      if (this.status !== STATUS.running) {
        return { advanced: false, reason: this.status };
      } else {
        const influences = this.calculateInfluence();
        const previousRestored = this.restoredCellCount();
        const nextCells = [];
        for (let y = 0; y < this.settings.rows; y += 1) {
          for (let x = 0; x < this.settings.columns; x += 1) {
            const index = this.indexOf(x, y);
            nextCells.push(this.nextCell(this.cells[index], influences[index], this.neighborCounts(x, y), x, y));
          }
        }
        this.cells = nextCells;
        this.generation += 1;

        this.plants.forEach((plant) => {
          const definition = PLANT_TYPES[plant.kind];
          const centerCell = this.getCell(plant.x, plant.y);
          centerCell.stage = Math.max(centerCell.stage, definition.centerStage);
        });

        const newGrowth = this.restoredCellCount() - previousRestored;
        if (newGrowth > 0) {
          this.events.push({ type: "spread", newCells: newGrowth });
        } else {
          this.events.push({ type: "quiet", newCells: 0 });
        }

        if (this.generation % 2 === 0) {
          const renewal = 1 + Math.floor(this.progressPercent() / 25);
          this.seedCount = Math.min(this.settings.maximumSeeds, this.seedCount + renewal);
        } else {
          this.seedCount = this.seedCount;
        }

        if (this.progressPercent() >= this.settings.targetPercent) {
          this.status = STATUS.complete;
          this.events.push({ type: "complete", progress: this.progressPercent() });
        } else {
          this.status = this.status;
        }
        return { advanced: true, reason: "growth", newCells: newGrowth };
      }
    }

    restoredCellCount() {
      return this.cells.reduce((total, cell) => total + (cell.stage > 0 ? 1 : 0), 0);
    }

    progressPercent() {
      return Math.round(this.restoredCellCount() / this.cells.length * 100);
    }

    overlapCellCount() {
      return this.lastInfluence.reduce((total, influence) => total + (influence.coverage >= 2 ? 1 : 0), 0);
    }

    stageCounts() {
      return this.cells.reduce((counts, cell) => {
        counts[cell.stage] += 1;
        return counts;
      }, [0, 0, 0, 0]);
    }

    drainEvents() {
      const events = this.events.slice();
      this.events.length = 0;
      return events;
    }

    getSnapshot() {
      return {
        status: this.status,
        generation: this.generation,
        seeds: this.seedCount,
        plants: this.plants.length,
        progressPercent: this.progressPercent(),
        overlapCells: this.overlapCellCount(),
        stageCounts: this.stageCounts()
      };
    }
  }

  return Object.freeze({ DEFAULT_SETTINGS, PLANT_TYPES, STATUS, InfluenceGardenModel });
});
