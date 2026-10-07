(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installHiddenPassages = function (context) {
    with (context) {
      const NEIGHBOURS = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
      ];

      function hiddenCandidatesForFloor(floor) {
        const candidates = [];
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            const cell = floor.map.rows[y]?.[x];
            if (cell !== "x") continue;
            let floorNeighbours = 0;
            for (const dir of NEIGHBOURS) {
              const nc = floor.map.rows[y + dir.y]?.[x + dir.x];
              if (nc === ".") floorNeighbours += 1;
            }
            // We want walls touching exactly one floor cell — a believable
            // candidate for a hidden passage off the side of a corridor.
            if (floorNeighbours === 1) candidates.push({ x, y });
          }
        }
        return candidates;
      }

      function pickHiddenCells(candidates, count, salt) {
        const picks = [];
        for (let i = 0; i < count && i < candidates.length; i += 1) {
          const idx = ((i + 1) * 19 + salt) % candidates.length;
          picks.push(candidates[idx]);
        }
        return picks;
      }

      function seedHiddenPassages() {
        if (context.hiddenPassagesDisabled) return;
        for (let floorIndex = 0; floorIndex < resources.floors.length; floorIndex += 1) {
          const floor = resources.floors[floorIndex];
          const candidates = hiddenCandidatesForFloor(floor);
          if (candidates.length === 0) continue;
          const salt = (floor.id || "").length + floorIndex * 7;
          const picks = pickHiddenCells(candidates, 2, salt);
          for (const cell of picks) {
            const row = floor.map.rows[cell.y];
            if (row[cell.x] !== "x") continue;
            floor.map.rows[cell.y] = `${row.slice(0, cell.x)}H${row.slice(cell.x + 1)}`;
          }
        }
      }

      function isHiddenAt(x, y) {
        return cellAt(x, y) === "H";
      }

      function revealHiddenPassageAt(x, y) {
        if (!isHiddenAt(x, y)) return false;
        const floor = currentFloor();
        const row = floor.map.rows[y];
        floor.map.rows[y] = `${row.slice(0, x)}.${row.slice(x + 1)}`;
        currentFloorState().discovered.add(keyOf(x, y));
        state.revealedHiddenPassage = true;
        addEffect("impact", [{ x, y }]);
        return true;
      }

      function searchHiddenPassages() {
        if (state.victory || state.defeated) return false;
        const here = { x: state.x, y: state.y };
        // The party searches all 4 neighbours; ~60% chance to spot each H.
        const found = [];
        for (const dir of NEIGHBOURS) {
          const x = here.x + dir.x;
          const y = here.y + dir.y;
          if (!isHiddenAt(x, y)) continue;
          if (Math.random() < 0.6) {
            if (revealHiddenPassageAt(x, y)) found.push({ x, y });
          }
        }
        if (found.length > 0) {
          state.message = found.length === 1
            ? "The party finds a hidden passage!"
            : `The party finds ${found.length} hidden passages!`;
        } else {
          // Even on a miss, mark adjacent hidden walls as "noticed" via a faint
          // hint by keeping them discovered (still showing as wall on the map).
          let nearby = 0;
          for (const dir of NEIGHBOURS) {
            if (isHiddenAt(state.x + dir.x, state.y + dir.y)) nearby += 1;
          }
          state.message = nearby > 0
            ? "The party runs their hands along the wall. Something faint moves under their fingers."
            : "The party searches the walls but finds nothing new.";
        }
        advanceTurn();
        render();
        return found.length > 0;
      }

      Object.assign(context, {
        seedHiddenPassages,
        hiddenCandidatesForFloor,
        pickHiddenCells,
        isHiddenAt,
        revealHiddenPassageAt,
        searchHiddenPassages
      });

      seedHiddenPassages();
    }
  };
}());
