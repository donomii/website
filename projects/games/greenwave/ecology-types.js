(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.EcologyTypes = factory();
  }
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  /** @typedef {{x: number, y: number}} Position */
  /** @typedef {{advanced: boolean, message: string}} ActionResult */
  /** @typedef {{label: string, value: string, help: string}} Readout */
  /** @typedef {{kind: string, mark: string, detail: string, badge: string, highlight: boolean}} TileView */
  /** @typedef {{id: string, label: string, mark: string, help: string}} Tool */
  /** @typedef {{elevation: number, terrain: string, water: number, moisture: number, stage: number, age: number, target: boolean}} WaterCell */
  /** @typedef {{habitat: string, age: number, basin: boolean, protected: boolean}} HabitatCell */
  /** @typedef {{rock: boolean, rooted: boolean, lastVisit: number, awakeAt: number, level: number, bloomed: boolean, grove: boolean, awakened: boolean}} SpringCell */
  /** @typedef {{id: string, label: string, mark: string, accepts: string[], seed: string, from: Position, to: Position, path: number[], position: number, arrived: boolean}} AnimalRoute */

  // Editable rule defaults. Boards are deliberately small enough for individual tile decisions.
  const RULES = Object.freeze({
    watershed: Object.freeze({ columns: 12, rows: 8, seed: 1701, rainCycle: 4, rainyBeats: 2,
      channelStorage: 2, pondStorage: 4, soilStorage: 2, treeStorage: 4, matureAge: 3,
      source: { x: 0, y: 3 }, targets: [{ x: 10, y: 1 }, { x: 10, y: 4 }, { x: 10, y: 6 }] }),
    corridors: Object.freeze({ columns: 12, rows: 8, seed: 1702, matureAge: 2, animalStride: 2,
      rocks: [{ x: 5, y: 1 }, { x: 5, y: 3 }, { x: 5, y: 6 }],
      animals: [
        { id: "rabbit", label: "Rabbits", mark: "♧", accepts: ["meadow", "shrub"], seed: "meadow", from: { x: 0, y: 1 }, to: { x: 11, y: 1 } },
        { id: "bird", label: "Birds", mark: "↟", accepts: ["shrub", "forest"], seed: "shrub", from: { x: 0, y: 3 }, to: { x: 11, y: 3 } },
        { id: "deer", label: "Deer", mark: "♜", accepts: ["meadow", "forest"], seed: "meadow", from: { x: 0, y: 6 }, to: { x: 11, y: 6 } }
      ] }),
    mosaic: Object.freeze({ columns: 12, rows: 8, seed: 1703, successionAge: 6, stableSeasons: 3,
      needs: Object.freeze({ meadow: 6, shrub: 4, forest: 6, wetland: 4 }),
      basinLeft: 7, basinRight: 9, basinTop: 5, basinBottom: 6 }),
    spring: Object.freeze({ columns: 14, rows: 9, seed: 1704, warmBeats: 6, reunionGap: 4, bloomGoal: 6,
      start: { x: 1, y: 4 }, groves: [{ x: 4, y: 1 }, { x: 8, y: 6 }, { x: 12, y: 2 }],
      rocks: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }] })
  });
  const HABITATS = Object.freeze(["meadow", "shrub", "forest", "wetland"]);
  const MARKS = Object.freeze({ soil: "·", meadow: "〃", shrub: "♣", forest: "♠", wetland: "≈",
    rock: "◆", home: "⌂", channel: "⌁", pond: "≈", source: "≋", dormant: "◌", bloom: "✿" });
  const DIRECTIONS = Object.freeze({ ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0],
    w: [0, -1], d: [1, 0], s: [0, 1], a: [-1, 0] });
  return Object.freeze({ RULES, HABITATS, MARKS, DIRECTIONS });
});
