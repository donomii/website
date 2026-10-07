(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ecology-common.js"));
  } else {
    root.TravellingSpring = factory(root.GreenEcology);
  }
})(typeof globalThis === "object" ? globalThis : this, function (E) {
  "use strict";

  class SpringModel extends E.GridModel {
    constructor(seed = E.RULES.spring.seed) {
      super(E.RULES.spring, ["move"]);
      this.reset(seed);
    }

    reset(seed) {
      this.create(seed, (x, y) => ({ rock: this.rules.rocks.some(p => p.x === x && p.y === y), rooted: false,
        lastVisit: -1, awakeAt: -1, level: 0, bloomed: false,
        grove: this.rules.groves.some(p => p.x === x && p.y === y), awakened: false }));
      this.head = { ...this.rules.start };
      Object.assign(this.getCell(this.head.x, this.head.y), { rooted: true, lastVisit: 0, awakeAt: 0, level: 1 });
      this.lastBloom = -1;
      this.message = "Move to a neighboring tile. Visit the three ancient groves, then return along older roots to flower.";
      return this.snapshot();
    }

    act(tool, x, y) {
      const index = this.validateAction(tool, x, y);
      const cell = this.cells[index];
      if (this.status === "complete") {
        return this.reject("Spring has awakened every grove and six flowering reunions. Restart to travel again.");
      } else if (Math.abs(x - this.head.x) + Math.abs(y - this.head.y) !== 1 || cell.rock) {
        return this.reject("Move one tile up, down, left, or right. Rocks stay still; choose a path around them.");
      } else {
        this.turn += 1;
        const reunion = cell.lastVisit >= 0 && this.turn - cell.lastVisit >= this.rules.reunionGap;
        const newBloom = reunion && !cell.bloomed;
        cell.level = Math.min(3, cell.level + 1);
        cell.rooted = true;
        cell.awakeAt = this.turn;
        cell.lastVisit = this.turn;
        cell.bloomed = cell.bloomed || reunion;
        cell.awakened = cell.awakened || cell.grove;
        this.head = { x, y };
        this.lastBloom = reunion ? index : -1;
        if (reunion) {
          this.flower(index);
        } else {
          this.lastBloom = -1;
        }
        const state = this.snapshot();
        const complete = state.groves === this.rules.groves.length && state.blooms >= this.rules.bloomGoal;
        return this.finish(complete ? "All ancient groves are awake and six old paths are flowering. Spring has come full circle." :
          newBloom ? "A new flowering reunion! Nearby roots wake and bare soil receives seeds." :
          reunion ? "This old meeting flowers again. Find another unflowered root for a new reunion." :
          cell.grove ? "An ancient grove wakes. Its roots will remember your return." : "Spring advances. Roots behind you rest, never disappear.", complete);
      }
    }

    flower(index) {
      for (const next of this.neighbors(index).filter(next => !this.cells[next].rock)) {
        const cell = this.cells[next];
        cell.rooted = true;
        cell.awakeAt = this.turn;
        cell.level = Math.max(1, cell.level);
      }
    }

    move(key) {
      const direction = E.DIRECTIONS[key];
      if (!direction) {
        throw new Error(`Unknown spring direction ${String(key)}; expected arrow key or W/A/S/D.`);
      } else {
        const x = this.head.x + direction[0];
        const y = this.head.y + direction[1];
        if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) {
          return this.reject("The edge holds the spring in place. Turn toward the landscape.");
        } else {
          return this.act("move", x, y);
        }
      }
    }

    isActive(cell) {
      return cell.rooted && this.turn - cell.awakeAt <= this.rules.warmBeats;
    }

    snapshot() {
      return { turn: this.turn, status: this.status, groves: this.cells.filter(cell => cell.awakened).length,
        blooms: this.cells.filter(cell => cell.bloomed).length, roots: this.cells.filter(cell => cell.rooted).length };
    }

    tileView(index) {
      const cell = this.cells[index];
      const active = this.isActive(cell);
      const kind = cell.rock ? "rock" : !cell.rooted ? "soil" : !active ? "dormant" :
        cell.bloomed ? "bloom" : ["soil", "meadow", "shrub", "forest"][Math.min(3, cell.level + Math.floor((this.turn - cell.awakeAt) / 2))];
      const head = index === this.index(this.head.x, this.head.y);
      return { kind, mark: head ? "✦" : E.MARKS[kind], highlight: index === this.lastBloom,
        badge: cell.grove ? (cell.awakened ? "★" : "☆") : cell.bloomed ? "✿" : "",
        detail: `${head ? "Spring front. " : ""}${cell.grove ? "Ancient grove, " + (cell.awakened ? "awakened. " : "not visited. ") : ""}${kind}. ${cell.bloomed ? "Already counted as a flowering reunion." : cell.rooted ? "Remembered roots: revisit after four beats to flower." : "Bare soil."}` };
    }
  }
  return Object.freeze({ SpringModel });
});
