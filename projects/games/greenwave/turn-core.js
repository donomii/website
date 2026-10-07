(function attachTurnCore(root, factory) {
  "use strict";

  const publicApi = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = publicApi;
  } else {
    root.GreenWaveTurn = publicApi;
  }
})(typeof globalThis === "object" ? globalThis : window, function createTurnCore() {
  "use strict";

  // These defaults control the board, restoration target, and visible seed economy.
  const DEFAULT_SETTINGS = Object.freeze({
    columns: 18,
    rows: 12,
    targetPercent: 65,
    startingSeeds: 10,
    maximumSeeds: 20,
    renewalTurns: 3
  });

  const STATUS = Object.freeze({
    ready: "ready",
    playing: "playing",
    complete: "complete"
  });

  const STAGES = Object.freeze({
    barren: 0,
    grass: 1,
    sapling: 2,
    forest: 3
  });

  const STAGE_NAMES = Object.freeze(["barren soil", "grass", "sapling", "forest"]);

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
          throw new Error(`Unknown Turn the Earth setting "${key}"`);
        }
      });
      assertInteger(settings.columns, "columns", 8, 40);
      assertInteger(settings.rows, "rows", 8, 30);
      assertInteger(settings.targetPercent, "targetPercent", 1, 100);
      assertInteger(settings.startingSeeds, "startingSeeds", 0, 1000);
      assertInteger(settings.maximumSeeds, "maximumSeeds", Math.max(1, settings.startingSeeds), 2000);
      assertInteger(settings.renewalTurns, "renewalTurns", 1, 100);
      return settings;
    } else {
      throw new Error("TurnTheEarthModel settings must be a plain object");
    }
  }

  function deterministicValue(x, y, turn, seed) {
    const raw = Math.sin(x * 73.91 + y * 43.17 + turn * 31.37 + seed * 0.00019) * 19371.539;
    return raw - Math.floor(raw);
  }

  class TurnTheEarthModel {
    constructor(options = {}) {
      this.settings = validateSettings(options);
      this.reset(0x5455524e);
    }

    reset(seed) {
      assertInteger(seed, "seed", 0, 0x7fffffff);
      this.seed = seed;
      this.turn = 0;
      this.seedCount = this.settings.startingSeeds;
      this.status = STATUS.ready;
      this.events = [];
      this.cells = [];
      for (let y = 0; y < this.settings.rows; y += 1) {
        for (let x = 0; x < this.settings.columns; x += 1) {
          this.cells.push({
            stage: STAGES.barren,
            age: 0,
            moisture: 0.16 + deterministicValue(x, y, 2, seed) * 0.54
          });
        }
      }

      const centerY = Math.floor(this.settings.rows / 2);
      for (let y = centerY - 2; y <= centerY + 2; y += 1) {
        for (let x = 2; x <= 5; x += 1) {
          if (this.isInside(x, y)) {
            const separation = Math.abs(y - centerY) + Math.abs(x - 3);
            const cell = this.getCell(x, y);
            cell.stage = separation <= 1 ? STAGES.forest : separation <= 3 ? STAGES.sapling : STAGES.grass;
            cell.age = cell.stage === STAGES.forest ? 4 : 1;
          } else {
            this.turn += 0;
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
        throw new Error(`Tile (${x}, ${y}) is outside the Turn the Earth board`);
      }
    }

    start() {
      if (this.status === STATUS.ready) {
        this.status = STATUS.playing;
      } else {
        this.status = this.status;
      }
      return this.status;
    }

    actionForCell(cell) {
      switch (cell.stage) {
        case STAGES.barren:
          return this.seedCount >= 1 ? "sow" : "restore-soil";
        case STAGES.grass:
          return this.seedCount >= 2 ? "plant-sapling" : "tend-meadow";
        case STAGES.sapling:
          return "tend-sapling";
        default:
          return "scatter-seeds";
      }
    }

    neighborCounts(x, y, cells = this.cells) {
      let vegetation = 0;
      let forest = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const targetX = x + offsetX;
          const targetY = y + offsetY;
          const isCenter = offsetX === 0 && offsetY === 0;
          if (!isCenter && this.isInside(targetX, targetY)) {
            const stage = cells[this.indexOf(targetX, targetY)].stage;
            vegetation += stage > STAGES.barren ? 1 : 0;
            forest += stage === STAGES.forest ? 1 : 0;
          } else {
            vegetation += 0;
          }
        }
      }
      return { vegetation, forest };
    }

    scatterFrom(x, y) {
      const offsets = [
        { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
        { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }
      ];
      const rotation = (this.turn + x * 3 + y * 5) % offsets.length;
      let planted = 0;
      for (let index = 0; index < offsets.length && planted < 4; index += 1) {
        const offset = offsets[(index + rotation) % offsets.length];
        const targetX = x + offset.x;
        const targetY = y + offset.y;
        if (this.isInside(targetX, targetY) && this.getCell(targetX, targetY).stage === STAGES.barren) {
          const target = this.getCell(targetX, targetY);
          target.stage = STAGES.grass;
          target.age = 0;
          target.moisture = Math.min(1, target.moisture + 0.08);
          planted += 1;
        } else {
          planted += 0;
        }
      }
      return planted;
    }

    applyAction(x, y) {
      const cell = this.getCell(x, y);
      const action = this.actionForCell(cell);
      let directGrowth = 0;
      switch (action) {
        case "sow":
          this.seedCount -= 1;
          cell.stage = STAGES.grass;
          cell.age = 0;
          directGrowth = 1;
          break;
        case "restore-soil":
          cell.moisture = Math.min(1, cell.moisture + 0.18);
          break;
        case "plant-sapling":
          this.seedCount -= 2;
          cell.stage = STAGES.sapling;
          cell.age = 0;
          break;
        case "tend-meadow":
          cell.moisture = Math.min(1, cell.moisture + 0.16);
          cell.age += 1;
          break;
        case "tend-sapling":
          cell.moisture = Math.min(1, cell.moisture + 0.12);
          cell.age += 2;
          break;
        default:
          directGrowth = this.scatterFrom(x, y);
          break;
      }
      return { action, directGrowth };
    }

    nextCell(cell, neighbors, x, y) {
      const next = {
        stage: cell.stage,
        age: cell.age,
        moisture: Math.min(1, cell.moisture + neighbors.forest * 0.006)
      };
      switch (cell.stage) {
        case STAGES.barren: {
          const chance = neighbors.forest * 0.08 + neighbors.vegetation * 0.018 + cell.moisture * 0.025;
          const arrives = neighbors.forest >= 2 && deterministicValue(x, y, this.turn, this.seed) < chance;
          next.stage = arrives ? STAGES.grass : STAGES.barren;
          next.age = 0;
          break;
        }
        case STAGES.grass:
          next.age += 1;
          next.stage = next.age >= 3 && (neighbors.vegetation >= 3 || next.moisture >= 0.48) ? STAGES.sapling : STAGES.grass;
          next.age = next.stage === STAGES.sapling ? 0 : next.age;
          break;
        case STAGES.sapling:
          next.age += 1;
          next.stage = next.age >= 4 && next.moisture >= 0.23 ? STAGES.forest : STAGES.sapling;
          next.age = next.stage === STAGES.forest ? 0 : next.age;
          break;
        default:
          next.age += 1;
          break;
      }
      return next;
    }

    advanceSeason() {
      const previousCells = this.cells.map((cell) => ({
        stage: cell.stage,
        age: cell.age,
        moisture: cell.moisture
      }));
      const nextCells = [];
      for (let y = 0; y < this.settings.rows; y += 1) {
        for (let x = 0; x < this.settings.columns; x += 1) {
          nextCells.push(this.nextCell(previousCells[this.indexOf(x, y)], this.neighborCounts(x, y, previousCells), x, y));
        }
      }
      this.cells = nextCells;
      this.turn += 1;
      let seedsGained = 0;
      if (this.turn % this.settings.renewalTurns === 0) {
        const forestCount = this.stageCounts()[STAGES.forest];
        const seedsBeforeRenewal = this.seedCount;
        const requestedSeeds = 2 + Math.floor(forestCount / 12);
        this.seedCount = Math.min(this.settings.maximumSeeds, this.seedCount + requestedSeeds);
        seedsGained = this.seedCount - seedsBeforeRenewal;
      } else {
        this.seedCount = this.seedCount;
      }
      return seedsGained;
    }

    clickTile(x, y) {
      assertInteger(x, "tile x", 0, this.settings.columns - 1);
      assertInteger(y, "tile y", 0, this.settings.rows - 1);
      if (this.status === STATUS.ready) {
        return { advanced: false, reason: STATUS.ready };
      } else if (this.status === STATUS.complete) {
        return { advanced: false, reason: STATUS.complete };
      } else {
        const beforeGrowth = this.restoredCellCount();
        const actionResult = this.applyAction(x, y);
        const seedsGained = this.advanceSeason();
        const newGrowth = this.restoredCellCount() - beforeGrowth;
        const turnEvent = {
          type: "turn",
          action: actionResult.action,
          x,
          y,
          turn: this.turn,
          directGrowth: actionResult.directGrowth,
          newGrowth,
          seedsGained
        };
        this.events.push(turnEvent);
        if (this.progressPercent() >= this.settings.targetPercent) {
          this.status = STATUS.complete;
          this.events.push({ type: "complete", progress: this.progressPercent(), turn: this.turn });
        } else {
          this.status = this.status;
        }
        return { advanced: true, reason: actionResult.action, turn: this.turn, newGrowth };
      }
    }

    restoredCellCount() {
      return this.cells.reduce((total, cell) => total + (cell.stage > STAGES.barren ? 1 : 0), 0);
    }

    progressPercent() {
      return Math.round(this.restoredCellCount() / this.cells.length * 100);
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
        turn: this.turn,
        seeds: this.seedCount,
        progressPercent: this.progressPercent(),
        stageCounts: this.stageCounts()
      };
    }
  }

  return Object.freeze({ DEFAULT_SETTINGS, STATUS, STAGES, STAGE_NAMES, TurnTheEarthModel });
});
