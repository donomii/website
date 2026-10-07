(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ecology-common.js"));
  } else {
    root.Watershed = factory(root.GreenEcology);
  }
})(typeof globalThis === "object" ? globalThis : this, function (E) {
  "use strict";

  class WatershedModel extends E.GridModel {
    constructor(seed = E.RULES.watershed.seed) {
      super(E.RULES.watershed, ["channel", "pond", "tree", "fill"]);
      this.reset(seed);
    }

    reset(seed) {
      this.create(seed, (x, y) => ({ elevation: this.columns - x, terrain: "soil", water: 0,
        moisture: 0, stage: 0, age: 0, target: this.rules.targets.some(p => p.x === x && p.y === y) }));
      this.getCell(this.rules.source.x, this.rules.source.y).terrain = "source";
      this.message = "Dig east from the blue spring, then branch toward the three gold-ringed valleys.";
      return this.snapshot();
    }

    act(tool, x, y) {
      const index = this.validateAction(tool, x, y);
      const cell = this.cells[index];
      if (this.status === "complete") {
        return this.reject("All three valleys are restored. Restart to trace another water route.");
      } else if (cell.terrain === "source" || (cell.target && tool !== "tree")) {
        return this.reject("Keep the spring and valley soil intact. Dig beside a valley, then plant it.");
      } else if (tool === "tree" && cell.terrain !== "soil") {
        return this.reject("Trees need soil beside water. Fill this conduit first, or choose nearby soil.");
      } else if ((tool === "tree" && cell.stage > 0) || cell.terrain === tool || (tool === "fill" && cell.terrain === "soil")) {
        return this.reject("That tile already has this feature. Choose another tile, or let rain fall.");
      } else {
        if (tool === "tree") {
          cell.stage = 1;
        } else {
          cell.terrain = tool === "fill" ? "soil" : tool;
          cell.stage = 0;
          cell.age = 0;
          cell.water = 0;
        }
        return this.advance(`${tool === "fill" ? "Soil replaced" : tool === "tree" ? "Tree planted" : "Waterway shaped"}.`);
      }
    }

    waterDistances() {
      const start = this.index(this.rules.source.x, this.rules.source.y);
      const distances = new Map([[start, 0]]);
      const queue = [start];
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const index = queue[cursor];
        const nextTiles = this.neighbors(index).filter(next => !distances.has(next) &&
          this.cells[next].terrain !== "soil" && this.cells[next].elevation <= this.cells[index].elevation);
        for (const next of nextTiles) {
          distances.set(next, distances.get(index) + 1);
          queue.push(next);
        }
      }
      return distances;
    }

    isRain(beat) {
      return beat > 0 && (beat - 1) % this.rules.rainCycle < this.rules.rainyBeats;
    }

    advance(message) {
      this.turn += 1;
      const distances = this.waterDistances();
      // Rain pulses travel one connected tile per beat. No loop can create water from itself.
      this.cells = this.cells.map((cell, index) => {
        const pulse = distances.has(index) && this.isRain(this.turn - distances.get(index));
        const storage = cell.terrain === "channel" ? this.rules.channelStorage : this.rules.pondStorage;
        return { ...cell, water: pulse ? storage : Math.max(0, cell.water - 1) };
      });
      const watered = this.cells;
      this.cells = watered.map((cell, index) => this.grow(cell, this.neighbors(index).some(next => watered[next].water > 0)));
      const complete = this.restoredValleys() === this.rules.targets.length;
      return this.finish(complete ? "Three dry valleys are now watered forests. The watershed is restored." : `${message} ${this.isRain(this.turn + 1) ? "Rain" : "A dry beat"} comes next.`, complete);
    }

    grow(cell, wetNeighbor) {
      const storage = cell.stage > 0 ? this.rules.treeStorage : this.rules.soilStorage;
      const moisture = wetNeighbor ? storage : Math.max(0, cell.moisture - 1);
      if (cell.terrain !== "soil" || moisture === 0) {
        return { ...cell, moisture };
      } else {
        const age = cell.age + 1;
        return { ...cell, moisture, age, stage: Math.max(cell.stage, Math.min(3, Math.ceil(age / this.rules.matureAge * 3))) };
      }
    }

    restoredValleys() {
      return this.cells.filter(cell => cell.target && cell.stage === 3 && cell.moisture > 0).length;
    }

    wait() {
      if (this.status === "complete") {
        return this.reject("The watershed is complete. Restart to play again.");
      } else {
        return this.advance("A season passes through the channels.");
      }
    }

    snapshot() {
      return { turn: this.turn, status: this.status, restored: this.restoredValleys(),
        wet: this.cells.filter(cell => cell.moisture > 0).length, raining: this.isRain(this.turn + 1) };
    }

    tileView(index) {
      const cell = this.cells[index];
      const growth = ["soil", "meadow", "shrub", "forest"][cell.stage];
      const kind = cell.terrain === "soil" ? growth : cell.terrain;
      return { kind, mark: E.MARKS[kind], badge: cell.target ? "◎" : String(cell.elevation),
        highlight: cell.water > 0 || cell.moisture > 0,
        detail: `${cell.target ? "Valley goal. " : ""}${kind}, height ${cell.elevation}, water ${cell.water}, soil moisture ${cell.moisture}.` };
    }
  }
  return Object.freeze({ WatershedModel });
});
