(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Mining: chip ore, gold, and the occasional gem out of the interior wall
  // directly ahead. Each wall tile can be mined once per floor visit. Ore feeds
  // the smithing system; gems sell; gold is immediate. Distinct from the digging
  // wand (which opens passages) — mining never removes the wall, only harvests it.
  window.CotBRuntime.installMining = function installMining(context) {
    with (context) {
      const ORE_PER_VEIN  = 1;
      const GEM_CHANCE     = 0.15;
      const GOLD_CHANCE    = 0.35;
      const GOLD_MIN       = 3;
      const GOLD_SPREAD    = 6;

      // Ore + gem reagents (ore is consumed by smithing; gems are loot).
      const ITEMS = [
        { id: "ore-iron", name: "iron ore", kind: "ore", value: 5,
          desc: "Raw ore. Smiths can forge it into stronger gear." },
        { id: "gem-raw",  name: "rough gem", kind: "gem", value: 18,
          desc: "An uncut gem. Worth a tidy sum to the right buyer." }
      ];
      for (const item of ITEMS) {
        if (!resources.inventory.some((i) => i.id === item.id)) {
          resources.inventory.push({ ...item });
        }
      }

      function _minedTiles() {
        const fs = currentFloorState();
        if (!fs.minedTiles) fs.minedTiles = new Set();
        return fs.minedTiles;
      }

      // The interior wall tile directly ahead, if any (boundary walls are skipped
      // so the dungeon shell stays intact).
      function _veinAhead() {
        const forward = dirAt(0);
        const x = state.x + forward.x;
        const y = state.y + forward.y;
        if (!mapContains(x, y)) return null;
        const cell = cellAt(x, y);
        if (cell !== "x" && cell !== "H") return null;
        const floor = currentFloor();
        if (x <= 0 || y <= 0 || x >= floor.map.width - 1 || y >= floor.map.height - 1) return null;
        return { x, y };
      }

      function _grant(kind, name, value) {
        state.lootSerial = (state.lootSerial || 0) + 1;
        state.inventory.push({ id: `${kind}-mined-${state.lootSerial}`, name, kind, value });
      }

      function mineWall(messages) {
        if (context.miningDisabled) { messages.push("Mining is not active."); return false; }
        const vein = _veinAhead();
        if (!vein) { messages.push("There is no workable rock ahead."); return false; }
        const key = keyOf(vein.x, vein.y);
        if (_minedTiles().has(key)) { messages.push("This rock is already picked clean."); return false; }
        _minedTiles().add(key);

        const yields = [];
        for (let i = 0; i < ORE_PER_VEIN; i += 1) { _grant("ore", "iron ore", 5); }
        yields.push("iron ore");
        if (Math.random() < GEM_CHANCE) { _grant("gem", "rough gem", 18); yields.push("a rough gem"); }
        if (Math.random() < GOLD_CHANCE) {
          const gold = GOLD_MIN + Math.floor(Math.random() * GOLD_SPREAD);
          state.gold = (state.gold || 0) + gold;
          yields.push(`${gold} gold`);
        }
        if (typeof addEffect === "function") addEffect("impact", [vein]);
        currentFloorState().discovered.add(key);
        messages.push(`You chip the rock and recover ${yields.join(", ")}.`);
        return true;
      }

      function oreCount() {
        return state.inventory.filter((i) => i.kind === "ore").length;
      }

      context.mineWall = mineWall;
      context.oreCount = oreCount;
    }
  };
}());
