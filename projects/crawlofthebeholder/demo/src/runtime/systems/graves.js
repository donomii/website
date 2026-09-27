(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Graves of the fallen — if the previous recorded run ended in defeat, a
  // gravestone stands near where that party fell. Tending it recovers part of
  // the lost gold, and its epitaph names the turn and floor of the death.
  window.CotBRuntime.installGraves = function installGraves(context) {
    with (context) {
      const GRAVE_TILE = "vendor/crawl/crawl-ref/source/rltiles/dngn/vaults/gravestone_writing2.png";
      const SALVAGE_RATE = 0.25;

      function lastFallenRun() {
        if (typeof readMeta !== "function") return null;
        const runs = readMeta().runs || [];
        return runs.find((run) => run.outcome === "defeat") || null;
      }

      function seedGrave() {
        if (context.gravesDisabled || state.graveSeeded) return null;
        state.graveSeeded = true;
        const fallen = lastFallenRun();
        if (!fallen) return null;
        const floorIndex = Math.min(Math.max(0, fallen.floorIndex || 0), resources.floors.length - 1);
        const floor = resources.floors[floorIndex];
        if (!floor || !floor.map) return null;
        // The exact tile of death isn't recorded — the grave stands where that
        // party entered the floor, the last place they were seen whole.
        const anchor = (floor.stairs && floor.stairs.up) || floor.start || { x: 1, y: 1 };
        let cell = null;
        for (const dir of dirs) {
          const x = anchor.x + dir.x;
          const y = anchor.y + dir.y;
          const row = floor.map.rows[y];
          if (row && row[x] === "." && !(floor.decor || []).some((d) => d.x === x && d.y === y)) { cell = { x, y }; break; }
        }
        if (!cell) return null;
        const salvage = Math.max(5, Math.round((fallen.gold || 0) * SALVAGE_RATE));
        const grave = {
          id: `gravestone-${fallen.finishedAt || 0}`,
          name: `gravestone — a party fell here on turn ${fallen.turns || "?"} (${fallen.floor || "the depths"})`,
          shortName: "gravestone",
          kind: "memorial",
          salvage,
          tile: GRAVE_TILE,
          x: cell.x,
          y: cell.y
        };
        floor.decor = floor.decor || [];
        floor.decor.push(grave);
        return grave;
      }

      function useGraveFixture(decor, target) {
        const salvage = decor.salvage || 0;
        state.gold = (state.gold || 0) + salvage;
        if (typeof addEffect === "function") addEffect("halo", [target]);
        state.message = salvage > 0
          ? `The party tends the grave and recovers ${salvage} gold from the cairn. Rest well.`
          : "The party bows before the weathered grave.";
      }

      Object.assign(context, { lastFallenRun, seedGrave, useGraveFixture });
      seedGrave();
    }
  };
}());
