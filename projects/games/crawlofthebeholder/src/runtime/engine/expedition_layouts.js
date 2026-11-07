(function () {
  window.CotBRuntime.installExpeditionLayouts = function (context) {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const key = (cell) => `${cell.x},${cell.y}`;

    function branchForFloor(floor) {
      const branch = floor.id.split(":")[0].toLowerCase();
      return branch === "d" ? "dungeon" : branch === "vault" ? "vaults" : branch;
    }

    function compactFloor(template, branch, options = {}) {
      const rng = context.makeRng(options.seed);
      const layout = context.generateDcssLayout({ ...options, branch, rng });
      const first = layout.rooms[0];
      const start = { x: first.cx, y: first.cy, dir: 1 };
      start.dir = context.dirs.findIndex((direction) => layout.rows[start.y + direction.y]?.[start.x + direction.x] === ".");
      const distances = context.layoutDistances(layout.rows, start);
      const cells = [...distances].map(([cell, distance]) => {
        const [x, y] = cell.split(",").map(Number);
        return { x, y, distance };
      }).sort((a, b) => b.distance - a.distance);
      const down = { x: cells[0].x, y: cells[0].y };
      const used = new Set([key(start), key(down)]);
      const doors = context.placeLayoutDoors(layout, rng, layout.family === "basic" ? 0.35 : 0, used);
      const floor = {
        ...clone(template), biome: branch,
        map: { name: template.name, width: layout.width, height: layout.height, rows: layout.rows, source: "dcss-compact-v1", family: layout.family },
        start, doors,
        stairs: { up: { x: start.x, y: start.y }, down },
        encounters: [], floorItems: [], traps: [], decor: []
      };
      for (const field of ["floorItems", "encounters", "traps", "decor"]) {
        for (const entity of template[field] || []) {
          const water = field === "encounters" && ["water", "deep_water"].includes(entity.habitat);
          const lava = field === "encounters" && entity.habitat === "lava";
          const candidates = water || lava ? liquidCells(layout.rows, water ? "wW" : "l") : cells;
          const available = candidates.filter((cell) => !used.has(key(cell)) && !doors.includes(key(cell)) && (field !== "encounters" || Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) >= 4));
          if (!available.length) {
            throw new Error(`Cannot place ${entity.name || entity.kind} on ${template.id}: no unoccupied ${water ? "water" : lava ? "lava" : "dry"} cell away from the entrance.`);
          } else {
            const cell = entity.kind === "quest" ? available[0] : available[Math.floor(rng() * available.length)];
            floor[field].push({ ...clone(entity), x: cell.x, y: cell.y });
            used.add(key(cell));
          }
        }
      }
      return floor;
    }

    function liquidCells(rows, glyphs) {
      const cells = [];
      for (let y = 1; y < rows.length - 1; y += 1) for (let x = 1; x < rows[y].length - 1; x += 1) {
        if (glyphs.includes(rows[y][x])) {
          cells.push({ x, y });
        } else {
          continue;
        }
      }
      return cells;
    }

    function installCompactFloors(floors) {
      context.resources.floors = floors;
      context.state.floors = floors.map((floor) => ({
        openedDoors: new Set(), discovered: new Set(), usedDecor: new Set(),
        floorItems: clone(floor.floorItems), traps: clone(floor.traps),
        clouds: [], floorMarks: [], allies: [],
        monsters: floor.encounters.map((monster) => ({ ...clone(monster), hp: monster.maxHp, energy: 0 }))
      }));
      context.state.floorIndex = 0;
      Object.assign(context.state, floors[0].start);
      context.normalizeCampaign();
    }

    function compactCampaign(seed) {
      const floors = context.resources.floors.map((floor, index) => compactFloor(floor, branchForFloor(floor), { seed: `${seed}:${index}` }));
      installCompactFloors(floors);
      context.state.message = "The dungeon has changed. Find the runes, take the Orb, and return to the surface.";
    }

    function compactShortFloors(floors, seed) {
      const branches = ["dungeon", "dungeon", "snake", "shoals", "orc", "zot"];
      const result = [floors[0]];
      for (let index = 1; index < floors.length; index += 1) {
        const wide = index === 3;
        const floor = compactFloor(floors[index], branches[index], { seed: `${seed}:${index}`, width: wide ? 24 : 18, height: wide ? 18 : 14 });
        floor.stairs = { up: { ...floors[index].stairs.up, x: floor.start.x, y: floor.start.y }, down: null };
        result.push(floor);
        const entrance = index === 5 ? result[0].stairs.down : result[0].stairs[`branch${index}`];
        entrance.landing = { x: floor.start.x, y: floor.start.y };
      }
      return result;
    }

    Object.assign(context, { compactFloor, compactCampaign, compactShortFloors, branchForFloor });
  };
}());
