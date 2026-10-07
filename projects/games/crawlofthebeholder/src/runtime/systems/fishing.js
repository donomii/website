(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Fishing — cast a line into adjacent water for food, or into deep water for
  // a chance at sunken treasure. Angling skill grows with every catch.
  window.CotBRuntime.installFishing = function installFishing(context) {
    with (context) {
      const ROD_TEMPLATE = {
        id: "fishing-rod", name: "fishing rod", kind: "fishing-rod",
        weight: 1, value: 8,
        tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/misc_lightning_rod_inert.png",
        desc: "Cast into adjacent water for food — deep water sometimes hides treasure."
      };
      const FISH_TILE = "vendor/crawl/crawl-ref/source/rltiles/item/food/beef_jerky.png";
      const BASE_CHANCE = 0.35;
      const SKILL_STEP = 0.05;
      const MAX_CHANCE = 0.75;
      const TREASURE_CHANCE = 0.2; // deep water only

      if (!context.fishingDisabled) {
        // Template pool AND the live pack — state.inventory was copied from
        // resources before this module installed, so push to both.
        if (!resources.inventory.some((item) => item.kind === "fishing-rod")) resources.inventory.push({ ...ROD_TEMPLATE });
        if (!state.inventory.some((item) => item.kind === "fishing-rod")) state.inventory.push({ ...ROD_TEMPLATE });
      }

      function adjacentWater() {
        for (const dir of dirs) {
          const x = state.x + dir.x;
          const y = state.y + dir.y;
          const terrain = terrainAt(x, y);
          if (terrain === "water" || terrain === "deep-water") return { x, y, terrain };
        }
        return null;
      }

      function fishingCatchChance() {
        return Math.min(MAX_CHANCE, BASE_CHANCE + (state.fishingSkill || 0) * SKILL_STEP);
      }

      // Returns true if a turn was spent casting (catch or not); false when
      // casting was impossible (no rod / no water) and no turn passes.
      function castLine(messages) {
        if (context.fishingDisabled) { messages.push("The water refuses the line."); return false; }
        if (!state.inventory.some((item) => item.kind === "fishing-rod")) { messages.push("The party has no fishing rod."); return false; }
        const spot = adjacentWater();
        if (!spot) { messages.push("No water within reach of the line."); return false; }
        if (typeof addEffect === "function") addEffect("ice", [spot]);
        if (Math.random() >= fishingCatchChance()) {
          messages.push("The line comes back empty.");
          return true;
        }
        state.fishingSkill = (state.fishingSkill || 0) + 1;
        if (spot.terrain === "deep-water" && Math.random() < TREASURE_CHANCE) {
          const gold = 10 + Math.floor(Math.random() * (10 + state.floorIndex * 5));
          state.gold = (state.gold || 0) + gold;
          messages.push(`The hook drags up sunken treasure — ${gold} gold!`);
          return true;
        }
        state.lootSerial = (state.lootSerial || 0) + 1;
        state.inventory.push({ id: `fish-${state.lootSerial}`, name: "catch of the day", shortName: "fish", kind: "food", power: 250, weight: 1, value: 6, tile: FISH_TILE });
        messages.push(`A fat catch flops on the hook. (angling ${state.fishingSkill})`);
        return true;
      }

      ITEM_USE["fishing-rod"] = (item) => {
        const messages = [];
        const cast = castLine(messages);
        if (!cast) { setMessage(messages[0] || `${item.name} has nowhere to cast.`); return; }
        state.message = messages.join(" ");
        advanceTurn();
        render();
      };

      Object.assign(context, { adjacentWater, fishingCatchChance, castLine });
    }
  };
}());
