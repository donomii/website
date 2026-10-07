(function attachGreenWaveCore(root, factory) {
  "use strict";

  const publicApi = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = publicApi;
  } else {
    root.GreenWaveCore = publicApi;
  }
})(typeof globalThis === "object" ? globalThis : window, function createGreenWaveCore() {
  "use strict";

  // These defaults define the prototype's pace, map, and reward balance.
  const DEFAULT_SETTINGS = Object.freeze({
    columns: 36,
    rows: 22,
    tickMilliseconds: 135,
    targetPercent: 70,
    grassSteps: 7,
    saplingSteps: 18,
    minimumLoopLength: 8,
    minimumContactAge: 5,
    connectionCooldownSteps: 5,
    seedBurstRadius: 2,
    rockRatio: 0.065,
    waterRatio: 0.035,
    startX: null,
    startY: null
  });

  const DIRECTIONS = Object.freeze({
    up: Object.freeze({ x: 0, y: -1, name: "up" }),
    down: Object.freeze({ x: 0, y: 1, name: "down" }),
    left: Object.freeze({ x: -1, y: 0, name: "left" }),
    right: Object.freeze({ x: 1, y: 0, name: "right" })
  });

  const STATUS = Object.freeze({
    ready: "ready",
    running: "running",
    paused: "paused",
    complete: "complete"
  });

  function assertIntegerInRange(value, name, minimum, maximum) {
    if (Number.isInteger(value) && value >= minimum && value <= maximum) {
      return value;
    } else {
      throw new Error(`${name} must be an integer from ${minimum} through ${maximum}; received ${String(value)}`);
    }
  }

  function assertRatio(value, name, maximum) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum) {
      return value;
    } else {
      throw new Error(`${name} must be a finite number from 0 through ${maximum}; received ${String(value)}`);
    }
  }

  function validateSettings(options) {
    if (options !== null && typeof options === "object" && !Array.isArray(options)) {
      const settings = Object.assign({}, DEFAULT_SETTINGS);
      Object.keys(options).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
          settings[key] = options[key];
        } else {
          throw new Error(`Unknown Green Wave setting "${key}"; use a documented DEFAULT_SETTINGS key`);
        }
      });

      assertIntegerInRange(settings.columns, "columns", 5, 100);
      assertIntegerInRange(settings.rows, "rows", 5, 100);
      assertIntegerInRange(settings.tickMilliseconds, "tickMilliseconds", 40, 2000);
      assertRatio(settings.targetPercent, "targetPercent", 100);
      assertIntegerInRange(settings.grassSteps, "grassSteps", 1, 1000);
      assertIntegerInRange(settings.saplingSteps, "saplingSteps", settings.grassSteps + 1, 2000);
      assertIntegerInRange(settings.minimumLoopLength, "minimumLoopLength", 4, 1000);
      assertIntegerInRange(settings.minimumContactAge, "minimumContactAge", 1, 1000);
      assertIntegerInRange(settings.connectionCooldownSteps, "connectionCooldownSteps", 1, 1000);
      assertIntegerInRange(settings.seedBurstRadius, "seedBurstRadius", 1, 10);
      assertRatio(settings.rockRatio, "rockRatio", 0.3);
      assertRatio(settings.waterRatio, "waterRatio", 0.3);
      if (settings.rockRatio + settings.waterRatio <= 0.5) {
        return settings;
      } else {
        throw new Error(`rockRatio plus waterRatio must not exceed 0.5; received ${settings.rockRatio + settings.waterRatio}`);
      }
    } else {
      throw new Error("GreenWaveModel settings must be a plain object");
    }
  }

  function createRandom(seed) {
    let state = seed >>> 0;
    state = state === 0 ? 0x6d2b79f5 : state;
    return function nextRandom() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function samePoint(first, second) {
    return first.x === second.x && first.y === second.y;
  }

  function pointInsidePolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
      const currentPoint = polygon[index];
      const previousPoint = polygon[previous];
      const crossesY = (currentPoint.y > point.y) !== (previousPoint.y > point.y);
      const crossingX = ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
        (previousPoint.y - currentPoint.y) + currentPoint.x;
      const crossesRay = crossesY && point.x < crossingX;
      inside = crossesRay ? !inside : inside;
    }
    return inside;
  }

  class GreenWaveModel {
    constructor(options = {}) {
      this.settings = validateSettings(options);
      this.reset(0x47524545);
    }

    reset(seed) {
      assertIntegerInRange(seed, "seed", 0, 0x7fffffff);
      this.seed = seed;
      this.stepCount = 0;
      this.score = 0;
      this.canopyConnections = 0;
      this.lastConnectionStep = -this.settings.connectionCooldownSteps;
      this.status = STATUS.ready;
      this.events = [];
      this.direction = DIRECTIONS.right;
      this.queuedDirection = DIRECTIONS.right;

      const defaultStartX = Math.floor(this.settings.columns * 0.18);
      const defaultStartY = Math.floor(this.settings.rows * 0.5);
      const startX = this.settings.startX === null ? defaultStartX : this.settings.startX;
      const startY = this.settings.startY === null ? defaultStartY : this.settings.startY;
      assertIntegerInRange(startX, "startX", 0, this.settings.columns - 1);
      assertIntegerInRange(startY, "startY", 0, this.settings.rows - 1);
      this.head = { x: startX, y: startY };

      const random = createRandom(seed);
      this.cells = [];
      this.plantableCellCount = 0;
      for (let y = 0; y < this.settings.rows; y += 1) {
        for (let x = 0; x < this.settings.columns; x += 1) {
          const protectedStart = Math.abs(x - startX) <= 6 && Math.abs(y - startY) <= 5;
          const roll = random();
          let terrain = "soil";
          if (protectedStart) {
            terrain = "soil";
          } else if (roll < this.settings.waterRatio) {
            terrain = "water";
          } else if (roll < this.settings.waterRatio + this.settings.rockRatio) {
            terrain = "rock";
          } else {
            terrain = "soil";
          }
          this.plantableCellCount += terrain === "soil" ? 1 : 0;
          this.cells.push({ terrain, plantedAt: -1, sanctuary: false });
        }
      }

      this.restoredCellCount = 0;
      this.path = [{ x: startX, y: startY }];
      this.plantCell(startX, startY, false);
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
        throw new Error(`Cell (${x}, ${y}) is outside the ${this.settings.columns} by ${this.settings.rows} landscape`);
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
      } else if (this.status === STATUS.paused) {
        this.status = STATUS.running;
      } else {
        this.status = this.status;
      }
      return this.status;
    }

    setDirection(directionName) {
      if (Object.prototype.hasOwnProperty.call(DIRECTIONS, directionName)) {
        const nextDirection = DIRECTIONS[directionName];
        const reversesCurrent = nextDirection.x + this.direction.x === 0 && nextDirection.y + this.direction.y === 0;
        if (reversesCurrent) {
          return false;
        } else {
          this.queuedDirection = nextDirection;
          return true;
        }
      } else {
        throw new Error(`Unknown direction "${String(directionName)}"; expected up, down, left, or right`);
      }
    }

    growthStageForCell(cell) {
      if (cell.plantedAt < 0) {
        return "none";
      } else {
        const age = this.stepCount - cell.plantedAt;
        if (age < this.settings.grassSteps) {
          return "grass";
        } else if (age < this.settings.saplingSteps) {
          return "sapling";
        } else {
          return "forest";
        }
      }
    }

    plantCell(x, y, sanctuary) {
      const cell = this.getCell(x, y);
      if (cell.terrain !== "soil") {
        throw new Error(`Cannot grow at (${x}, ${y}); expected soil but found ${cell.terrain}`);
      } else if (cell.plantedAt < 0) {
        cell.plantedAt = this.stepCount;
        cell.sanctuary = sanctuary;
        this.restoredCellCount += 1;
        return true;
      } else {
        cell.sanctuary = sanctuary ? true : cell.sanctuary;
        return false;
      }
    }

    previousPathIndex(point) {
      let foundIndex = -1;
      for (let index = this.path.length - 2; index >= 0 && foundIndex < 0; index -= 1) {
        foundIndex = samePoint(this.path[index], point) ? index : foundIndex;
      }
      return foundIndex;
    }

    fillSanctuary(polygon) {
      let newlyRestored = 0;
      for (let y = 0; y < this.settings.rows; y += 1) {
        for (let x = 0; x < this.settings.columns; x += 1) {
          const cell = this.getCell(x, y);
          const inside = cell.terrain === "soil" && pointInsidePolygon({ x: x + 0.5, y: y + 0.5 }, polygon);
          if (inside) {
            newlyRestored += this.plantCell(x, y, true) ? 1 : 0;
            cell.sanctuary = true;
          } else {
            cell.sanctuary = cell.sanctuary;
          }
        }
      }

      polygon.forEach((point) => {
        if (this.isInside(point.x, point.y) && this.getCell(point.x, point.y).terrain === "soil") {
          this.getCell(point.x, point.y).sanctuary = true;
        } else {
          newlyRestored = newlyRestored;
        }
      });
      return newlyRestored;
    }

    scatterSeeds(center) {
      let newlyRestored = 0;
      const radius = this.settings.seedBurstRadius;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const x = center.x + offsetX;
          const y = center.y + offsetY;
          const inBurst = Math.abs(offsetX) + Math.abs(offsetY) <= radius;
          if (inBurst && this.isInside(x, y) && this.getCell(x, y).terrain === "soil") {
            newlyRestored += this.plantCell(x, y, false) ? 1 : 0;
          } else {
            newlyRestored = newlyRestored;
          }
        }
      }
      return newlyRestored;
    }

    rewardConnection(previousIndex, point) {
      const closedPath = previousIndex >= 0 ? this.path.slice(previousIndex) : [];
      closedPath.push({ x: point.x, y: point.y });
      const createsLoop = previousIndex >= 0 && closedPath.length >= this.settings.minimumLoopLength;
      const loopGrowth = createsLoop ? this.fillSanctuary(closedPath) : 0;
      const burstGrowth = this.scatterSeeds(point);
      const rewardType = createsLoop && loopGrowth > 0 ? "sanctuary" : "connection";
      const rewardGrowth = loopGrowth + burstGrowth;

      this.canopyConnections += 1;
      this.lastConnectionStep = this.stepCount;
      this.score += 100 + rewardGrowth * 15;
      this.events.push({
        type: rewardType,
        x: point.x,
        y: point.y,
        newCells: rewardGrowth,
        loopCells: loopGrowth
      });
    }

    updateCompletion() {
      if (this.progressPercent() >= this.settings.targetPercent) {
        this.status = STATUS.complete;
        this.events.push({ type: "complete", progress: this.progressPercent() });
      } else {
        this.status = this.status;
      }
    }

    advance() {
      if (this.status !== STATUS.running) {
        return { moved: false, reason: this.status };
      } else {
        this.direction = this.queuedDirection;
        const nextPoint = {
          x: this.head.x + this.direction.x,
          y: this.head.y + this.direction.y
        };

        if (!this.isInside(nextPoint.x, nextPoint.y)) {
          this.events.push({ type: "blocked", obstacle: "edge", x: this.head.x, y: this.head.y });
          return { moved: false, reason: "edge" };
        } else {
          const targetCell = this.getCell(nextPoint.x, nextPoint.y);
          if (targetCell.terrain !== "soil") {
            this.events.push({ type: "blocked", obstacle: targetCell.terrain, x: nextPoint.x, y: nextPoint.y });
            return { moved: false, reason: targetCell.terrain };
          } else {
            const previousIndex = this.previousPathIndex(nextPoint);
            const wasPlanted = targetCell.plantedAt >= 0;
            const oldGrowthAge = wasPlanted ? this.stepCount - targetCell.plantedAt : 0;

            this.stepCount += 1;
            this.head = nextPoint;
            this.path.push({ x: nextPoint.x, y: nextPoint.y });
            if (wasPlanted) {
              const connectionReady = oldGrowthAge >= this.settings.minimumContactAge &&
                this.stepCount - this.lastConnectionStep >= this.settings.connectionCooldownSteps;
              if (connectionReady) {
                this.rewardConnection(previousIndex, nextPoint);
              } else {
                this.score += 1;
              }
            } else {
              this.plantCell(nextPoint.x, nextPoint.y, false);
              this.score += 10;
            }
            this.updateCompletion();
            return { moved: true, reason: wasPlanted ? "revisited" : "new-growth" };
          }
        }
      }
    }

    progressPercent() {
      return Math.round((this.restoredCellCount / this.plantableCellCount) * 100);
    }

    drainEvents() {
      const drainedEvents = this.events.slice();
      this.events.length = 0;
      return drainedEvents;
    }

    getSnapshot() {
      return {
        status: this.status,
        head: { x: this.head.x, y: this.head.y },
        direction: this.direction.name,
        stepCount: this.stepCount,
        restoredCellCount: this.restoredCellCount,
        plantableCellCount: this.plantableCellCount,
        progressPercent: this.progressPercent(),
        canopyConnections: this.canopyConnections,
        score: this.score
      };
    }
  }

  return Object.freeze({
    DEFAULT_SETTINGS,
    DIRECTIONS,
    STATUS,
    GreenWaveModel,
    pointInsidePolygon
  });
});
