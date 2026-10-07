(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ecology-common.js"));
  } else {
    root.Corridors = factory(root.GreenEcology);
  }
})(typeof globalThis === "object" ? globalThis : this, function (E) {
  "use strict";

  class CorridorsModel extends E.GridModel {
    constructor(seed = E.RULES.corridors.seed) {
      super(E.RULES.corridors, ["meadow", "shrub", "forest"]);
      this.reset(seed);
    }

    reset(seed) {
      this.create(seed, (x, y) => ({ habitat: this.rules.rocks.some(p => p.x === x && p.y === y) ? "rock" : "soil", age: 0 }));
      this.routes = this.rules.animals.map(animal => ({ ...animal, path: [],
        position: this.index(animal.from.x, animal.from.y), arrived: false }));
      for (const route of this.routes) {
        this.getCell(route.from.x, route.from.y).habitat = "home";
        this.getCell(route.to.x, route.to.y).habitat = "home";
      }
      this.message = "Join matching shelters across the map. Different animals need different vegetation.";
      return this.snapshot();
    }

    act(tool, x, y) {
      const cell = this.cells[this.validateAction(tool, x, y)];
      if (this.status === "complete") {
        return this.reject("All three migrations have arrived on connected routes. Restart to plan new corridors.");
      } else if (["rock", "home"].includes(cell.habitat)) {
        return this.reject("Shelters and rocks stay in place. Plant a route around them.");
      } else if (cell.habitat === tool) {
        return this.reject("This habitat is already planted. Choose another tile or watch the migration.");
      } else {
        cell.habitat = tool;
        cell.age = 0;
        return this.advance(`${tool === "forest" ? "Young woodland" : tool} planted.`);
      }
    }

    suitable(index, route) {
      const cell = this.cells[index];
      return cell.habitat === "home" || (route.accepts.includes(cell.habitat) &&
        (cell.habitat !== "forest" || cell.age >= this.rules.matureAge));
    }

    scatter(route) {
      const soil = this.neighbors(route.position).find(index => this.cells[index].habitat === "soil");
      if (soil === undefined) {
        return 0;
      } else {
        this.cells[soil] = { habitat: route.seed, age: 0 };
        return 1;
      }
    }

    advance(message) {
      this.turn += 1;
      this.cells = this.cells.map(cell => ({ ...cell, age: cell.age + 1 }));
      // Compute paths together; seeds carried this season can help routes only next season.
      const paths = this.routes.map(route => E.findPath(this, this.index(route.from.x, route.from.y),
        this.index(route.to.x, route.to.y), index => this.suitable(index, route)));
      let scattered = 0;
      this.routes.forEach((route, index) => {
        route.path = paths[index];
        if (route.path.length === 0) {
          route.position = this.index(route.from.x, route.from.y);
        } else {
          const previous = Math.max(0, route.path.indexOf(route.position));
          const next = Math.min(route.path.length - 1, previous + this.rules.animalStride);
          route.position = route.path[next];
          route.arrived = route.arrived || next === route.path.length - 1;
          scattered += this.scatter(route);
        }
      });
      const complete = this.routes.every(route => route.arrived && route.path.length > 0);
      return this.finish(complete ? "Rabbits, birds, and deer have reached their shelters. All three corridors are connected." :
        `${message} Animals carried seeds to ${scattered} new tile${scattered === 1 ? "" : "s"}.`, complete);
    }

    wait() {
      if (this.status === "complete") {
        return this.reject("The migrations are complete. Restart to play again.");
      } else {
        return this.advance("The animals take another two steps.");
      }
    }

    snapshot() {
      return { turn: this.turn, status: this.status, connected: this.routes.filter(route => route.path.length > 0).length,
        arrived: this.routes.filter(route => route.arrived).length,
        routes: this.routes.map(route => ({ id: route.id, label: route.label, connected: route.path.length > 0,
          arrived: route.arrived, steps: Math.max(0, route.path.indexOf(route.position)) })) };
    }

    tileView(index) {
      const cell = this.cells[index];
      const shelter = this.routes.find(route => [this.index(route.from.x, route.from.y), this.index(route.to.x, route.to.y)].includes(index));
      const animals = this.routes.filter(route => route.position === index);
      const onRoute = this.routes.filter(route => route.path.includes(index));
      const mark = cell.habitat === "forest" && cell.age < this.rules.matureAge ? "♣" : E.MARKS[cell.habitat];
      return { kind: cell.habitat, mark, highlight: onRoute.length > 0,
        badge: animals.map(route => route.mark).join("") || (shelter ? shelter.mark : ""),
        detail: `${shelter ? shelter.label + " shelter" : cell.habitat}. ${animals.map(route => route.label + " here").join(". ")}${onRoute.length ? " Connected route: " + onRoute.map(route => route.label).join(", ") : ""}` };
    }
  }
  return Object.freeze({ CorridorsModel });
});
