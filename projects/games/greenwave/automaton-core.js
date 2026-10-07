(function attachAutomatonCore(root, factory) {
  "use strict";

  const publicApi = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = publicApi;
  } else {
    root.GreenWaveAutomaton = publicApi;
  }
})(typeof globalThis === "object" ? globalThis : window, function createAutomatonCore() {
  "use strict";

  // These defaults control the simulation grid and the point at which the landscape is considered established.
  const DEFAULT_SETTINGS = Object.freeze({
    columns: 54,
    rows: 30,
    targetPercent: 58
  });

  const STATUS = Object.freeze({
    paused: "paused",
    running: "running",
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
          throw new Error(`Unknown Forest Life setting "${key}"`);
        }
      });
      assertInteger(settings.columns, "columns", 8, 120);
      assertInteger(settings.rows, "rows", 8, 100);
      assertInteger(settings.targetPercent, "targetPercent", 1, 100);
      return settings;
    } else {
      throw new Error("ForestAutomatonModel settings must be a plain object");
    }
  }

  function deterministicValue(x, y, generation, seed) {
    const raw = Math.sin(x * 63.31 + y * 109.17 + generation * 29.53 + seed * 0.00017) * 28731.391;
    return raw - Math.floor(raw);
  }

  class ForestAutomatonModel {
    constructor(options = {}) {
      this.settings = validateSettings(options);
      this.reset(0x464f5245);
    }

    reset(seed) {
      assertInteger(seed, "seed", 0, 0x7fffffff);
      this.seed = seed;
      this.generation = 0;
      this.status = STATUS.paused;
      this.events = [];
      this.cells = [];
      for (let y = 0; y < this.settings.rows; y += 1) {
        for (let x = 0; x < this.settings.columns; x += 1) {
          this.cells.push({
            state: 0,
            age: 0,
            habitat: deterministicValue(x, y, 5, seed)
          });
        }
      }
      const centerY = Math.floor(this.settings.rows / 2);
      for (let y = centerY - 3; y <= centerY + 3; y += 1) {
        for (let x = 2; x <= 6; x += 1) {
          if (this.isInside(x, y) && this.getCell(x, y).habitat >= 0.14) {
            const core = x <= 4 && Math.abs(y - centerY) <= 1;
            this.getCell(x, y).state = core ? 2 : 1;
            this.getCell(x, y).age = core ? 2 : 0;
          } else {
            this.generation += 0;
          }
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
        throw new Error(`Cell (${x}, ${y}) is outside the Forest Life grid`);
      }
    }

    start() {
      if (this.status === STATUS.paused) {
        this.status = STATUS.running;
      } else {
        this.status = this.status;
      }
      return this.status;
    }

    pause() {
      if (this.status === STATUS.running) {
        this.status = STATUS.paused;
      } else {
        this.status = this.status;
      }
      return this.status;
    }

    seedCluster(x, y) {
      assertInteger(x, "seed x", 0, this.settings.columns - 1);
      assertInteger(y, "seed y", 0, this.settings.rows - 1);
      let planted = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const targetX = x + offsetX;
          const targetY = y + offsetY;
          const inCluster = Math.abs(offsetX) + Math.abs(offsetY) <= 1;
          if (inCluster && this.isInside(targetX, targetY) && this.getCell(targetX, targetY).habitat >= 0.14) {
            const cell = this.getCell(targetX, targetY);
            const nextState = offsetX === 0 && offsetY === 0 ? 2 : 1;
            const wasBarren = cell.state === 0;
            cell.state = Math.max(cell.state, nextState);
            cell.age = Math.max(cell.age, 1);
            planted += wasBarren ? 1 : 0;
          } else {
            planted += 0;
          }
        }
      }
      this.events.push({ type: "seeded", x, y, newCells: planted });
      return planted;
    }

    neighborCounts(x, y) {
      let vegetation = 0;
      let forest = 0;
      let upwind = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const targetX = x + offsetX;
          const targetY = y + offsetY;
          const isCenter = offsetX === 0 && offsetY === 0;
          if (!isCenter && this.isInside(targetX, targetY)) {
            const state = this.getCell(targetX, targetY).state;
            vegetation += state > 0 ? 1 : 0;
            forest += state === 3 ? 1 : 0;
            upwind += offsetX === -1 && state > 0 ? 1 : 0;
          } else {
            vegetation += 0;
          }
        }
      }
      return { vegetation, forest, upwind };
    }

    nextCell(cell, neighbors, x, y) {
      const next = { state: cell.state, age: cell.age, habitat: cell.habitat };
      if (cell.habitat < 0.14) {
        next.state = 0;
        next.age = 0;
      } else {
        switch (cell.state) {
          case 0: {
            const pressure = neighbors.vegetation * 0.045 + neighbors.forest * 0.065 +
              neighbors.upwind * 0.16 + cell.habitat * 0.055;
            const canArrive = neighbors.vegetation >= 2 || neighbors.upwind >= 1;
            const arrives = canArrive && deterministicValue(x, y, this.generation, this.seed) < pressure;
            next.state = arrives ? 1 : 0;
            next.age = 0;
            break;
          }
          case 1:
            next.age += 1;
            next.state = next.age >= 3 && neighbors.vegetation >= 2 ? 2 : 1;
            next.age = next.state === 2 ? 0 : next.age;
            break;
          case 2:
            next.age += 1;
            next.state = next.age >= 4 && (neighbors.vegetation >= 2 || neighbors.upwind >= 1) ? 3 : 2;
            next.age = next.state === 3 ? 0 : next.age;
            break;
          default:
            next.age += 1;
            break;
        }
      }
      return next;
    }

    advance(force = false) {
      if (typeof force !== "boolean") {
        throw new Error(`Forest Life force must be boolean; received ${String(force)}`);
      } else if (this.status !== STATUS.running && !force) {
        return { advanced: false, reason: this.status };
      } else if (this.status === STATUS.complete) {
        return { advanced: false, reason: STATUS.complete };
      } else {
        const previousRestored = this.restoredCellCount();
        const nextCells = [];
        for (let y = 0; y < this.settings.rows; y += 1) {
          for (let x = 0; x < this.settings.columns; x += 1) {
            nextCells.push(this.nextCell(this.getCell(x, y), this.neighborCounts(x, y), x, y));
          }
        }
        this.cells = nextCells;
        this.generation += 1;
        const newGrowth = this.restoredCellCount() - previousRestored;
        this.events.push({ type: "generation", newCells: newGrowth, generation: this.generation });
        if (this.progressPercent() >= this.settings.targetPercent) {
          this.status = STATUS.complete;
          this.events.push({ type: "complete", progress: this.progressPercent() });
        } else {
          this.status = this.status;
        }
        return { advanced: true, reason: "generation", newCells: newGrowth };
      }
    }

    restoredCellCount() {
      return this.cells.reduce((total, cell) => total + (cell.state > 0 ? 1 : 0), 0);
    }

    plantableCellCount() {
      return this.cells.reduce((total, cell) => total + (cell.habitat >= 0.14 ? 1 : 0), 0);
    }

    progressPercent() {
      return Math.round(this.restoredCellCount() / this.plantableCellCount() * 100);
    }

    frontierColumn() {
      return this.cells.reduce((frontier, cell, index) => {
        const x = index % this.settings.columns;
        return cell.state > 0 ? Math.max(frontier, x) : frontier;
      }, 0);
    }

    stageCounts() {
      return this.cells.reduce((counts, cell) => {
        counts[cell.state] += 1;
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
        progressPercent: this.progressPercent(),
        frontierColumn: this.frontierColumn(),
        stageCounts: this.stageCounts()
      };
    }
  }

  return Object.freeze({ DEFAULT_SETTINGS, STATUS, ForestAutomatonModel });
});
