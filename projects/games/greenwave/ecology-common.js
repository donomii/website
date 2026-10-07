(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ecology-types.js"));
  } else {
    root.GreenEcology = factory(root.EcologyTypes);
  }
})(typeof globalThis === "object" ? globalThis : this, function (Types) {
  "use strict";

  function validateSeed(seed) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new Error(`Cannot reset ecology board: expected seed integer 0..4294967295; received ${String(seed)}.`);
    } else {
      return seed;
    }
  }

  class GridModel {
    constructor(rules, tools) {
      this.rules = rules;
      this.columns = rules.columns;
      this.rows = rules.rows;
      this.tools = tools;
    }

    create(seed, makeCell) {
      this.seed = validateSeed(seed);
      this.turn = 0;
      this.status = "playing";
      this.message = "Choose a tool, then a tile. The world waits for your next action.";
      this.cells = Array.from({ length: this.columns * this.rows }, (_, index) => makeCell(index % this.columns, Math.floor(index / this.columns)));
    }

    index(x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.columns || y >= this.rows) {
        throw new Error(`Invalid tile position (${String(x)}, ${String(y)}); expected integers inside ${this.columns} by ${this.rows}.`);
      } else {
        return y * this.columns + x;
      }
    }

    getCell(x, y) {
      return this.cells[this.index(x, y)];
    }

    neighbors(index) {
      const x = index % this.columns;
      const y = Math.floor(index / this.columns);
      return [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < this.columns && ny < this.rows)
        .map(([nx, ny]) => ny * this.columns + nx);
    }

    validateAction(tool, x, y) {
      if (!this.tools.includes(tool)) {
        throw new Error(`Unknown ecology tool ${String(tool)}; expected ${this.tools.join(", ")}.`);
      } else {
        return this.index(x, y);
      }
    }

    reject(message) {
      this.message = message;
      return { advanced: false, message };
    }

    finish(message, complete) {
      this.status = complete ? "complete" : "playing";
      this.message = message;
      return { advanced: true, message };
    }

    position(index) {
      return { x: index % this.columns, y: Math.floor(index / this.columns) };
    }
  }

  // Breadth-first search returns the shortest orthogonal route, never diagonal shortcuts.
  function findPath(model, start, end, passable) {
    const parents = new Map([[start, -1]]);
    const queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      if (index === end) {
        const path = [];
        for (let at = end; at !== -1; at = parents.get(at)) path.unshift(at);
        return path;
      } else {
        for (const next of model.neighbors(index).filter(next => !parents.has(next) && passable(next))) {
          parents.set(next, index);
          queue.push(next);
        }
      }
    }
    return [];
  }

  function components(model, passable) {
    const remaining = new Set(model.cells.map((_, index) => index).filter(passable));
    const groups = [];
    while (remaining.size > 0) {
      const group = [remaining.values().next().value];
      remaining.delete(group[0]);
      for (let cursor = 0; cursor < group.length; cursor += 1) {
        for (const next of model.neighbors(group[cursor]).filter(next => remaining.has(next))) {
          remaining.delete(next);
          group.push(next);
        }
      }
      groups.push(group);
    }
    return groups;
  }

  return Object.freeze({ ...Types, GridModel, findPath, components });
});
