(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ecology-common.js"));
  } else {
    root.Mosaic = factory(root.GreenEcology);
  }
})(typeof globalThis === "object" ? globalThis : this, function (E) {
  "use strict";

  class MosaicModel extends E.GridModel {
    constructor(seed = E.RULES.mosaic.seed) {
      super(E.RULES.mosaic, [...E.HABITATS, "protect"]);
      this.reset(seed);
    }

    reset(seed) {
      this.create(seed, (x, y) => ({ habitat: "soil", age: 0, protected: false,
        basin: x >= this.rules.basinLeft && x <= this.rules.basinRight && y >= this.rules.basinTop && y <= this.rules.basinBottom }));
      this.stable = 0;
      this.message = "Build one connected patch with all four habitats. Protect meadows and shrubs before they mature.";
      return this.snapshot();
    }

    act(tool, x, y) {
      const cell = this.cells[this.validateAction(tool, x, y)];
      if (this.status === "complete") {
        return this.reject("The mosaic supports all four habitats. Restart to design another patch.");
      } else if ((tool === "wetland" && !cell.basin) || (cell.basin && tool !== "wetland" && tool !== "protect")) {
        return this.reject("Wetlands belong in the blue basins; meadow, shrubs, and woodland belong on dry soil.");
      } else if (tool === "protect" && cell.habitat === "soil") {
        return this.reject("Plant this tile first, then protect its current habitat from succession.");
      } else if (cell.habitat === tool) {
        return this.reject("That habitat is already here. Use Protect / release to preserve it, or choose another tile.");
      } else {
        if (tool === "protect") {
          cell.protected = !cell.protected;
        } else {
          cell.habitat = tool;
          cell.age = 0;
          cell.protected = false;
        }
        return this.advance(tool === "protect" ? (cell.protected ? "Habitat protected." : "Natural succession released.") : `${tool} established.`);
      }
    }

    advance(message) {
      this.turn += 1;
      this.cells = this.cells.map(cell => {
        if (cell.protected || !["meadow", "shrub"].includes(cell.habitat)) {
          return { ...cell };
        } else if (cell.age + 1 >= this.rules.successionAge) {
          return { ...cell, habitat: cell.habitat === "meadow" ? "shrub" : "forest", age: 0 };
        } else {
          return { ...cell, age: cell.age + 1 };
        }
      });
      const counts = this.patchCounts();
      const balanced = E.HABITATS.every(kind => counts[kind] >= this.rules.needs[kind]);
      this.stable = balanced ? this.stable + 1 : 0;
      const complete = this.stable >= this.rules.stableSeasons;
      return this.finish(complete ? "One connected mosaic has sustained four habitats for three seasons. Life has room for variety." :
        `${message} Balanced seasons: ${this.stable}/${this.rules.stableSeasons}.`, complete);
    }

    largestPatch() {
      const groups = E.components(this, index => E.HABITATS.includes(this.cells[index].habitat));
      return groups.reduce((largest, group) => group.length > largest.length ? group : largest, []);
    }

    patchCounts() {
      const counts = { meadow: 0, shrub: 0, forest: 0, wetland: 0 };
      for (const index of this.largestPatch()) counts[this.cells[index].habitat] += 1;
      return counts;
    }

    wait() {
      if (this.status === "complete") {
        return this.reject("The habitat mosaic is complete. Restart to play again.");
      } else {
        return this.advance("The unprotected patches grow older.");
      }
    }

    snapshot() {
      return { turn: this.turn, status: this.status, stable: this.stable, counts: this.patchCounts() };
    }

    tileView(index) {
      const cell = this.cells[index];
      const kind = cell.habitat === "soil" && cell.basin ? "basin" : cell.habitat;
      return { kind, mark: kind === "basin" ? "⌑" : E.MARKS[kind], highlight: cell.protected,
        badge: cell.protected ? "◇" : ["meadow", "shrub"].includes(cell.habitat) ? String(this.rules.successionAge - cell.age) : "",
        detail: `${cell.basin ? "Basin. " : ""}${cell.habitat}. ${cell.protected ? "Protected: stays in this habitat." :
          ["meadow", "shrub"].includes(cell.habitat) ? `Becomes ${cell.habitat === "meadow" ? "shrub" : "forest"} in ${this.rules.successionAge - cell.age} seasons.` : "Stable habitat."}` };
    }
  }
  return Object.freeze({ MosaicModel });
});
