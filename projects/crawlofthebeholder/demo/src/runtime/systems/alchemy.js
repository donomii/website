(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Alchemy: ingredient gathering, potion crafting by recipe, alchemical
  // transmutation (item → gold), and alchemist's fire (throwable AOE igniter).
  // No turn hook needed — every action is player-initiated.
  window.CotBRuntime.installAlchemy = function (context) {
    with (context) {
      const INGREDIENTS = [
        { id: "ing-nightshade", name: "nightshade leaf", kind: "ingredient", subkind: "herb",    value: 4,  tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/herb.png" },
        { id: "ing-bloodmoss",  name: "bloodmoss clump", kind: "ingredient", subkind: "herb",    value: 4,  tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/herb.png" },
        { id: "ing-glowcap",    name: "glowcap mushroom", kind: "ingredient", subkind: "fungus", value: 3,  tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/mushroom.png" },
        { id: "ing-ironweed",   name: "ironweed sprig",  kind: "ingredient", subkind: "herb",    value: 3,  tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/herb.png" },
        { id: "ing-crystalshard", name: "crystal shard", kind: "ingredient", subkind: "mineral", value: 6,  tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/crystal.png" },
        { id: "ing-saltpeter",  name: "saltpeter pinch", kind: "ingredient", subkind: "mineral", value: 3,  tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/powder.png" }
      ];

      // Recipe: sorted pair of subkinds → output template.
      const RECIPES = [
        { inputs: ["herb",    "herb"],    out: { name: "healing potion",    kind: "healing",  hp: 25,          value: 12 } },
        { inputs: ["herb",    "fungus"],  out: { name: "speed potion",      kind: "haste",    speedTurns: 6,   value: 14 } },
        { inputs: ["fungus",  "mineral"], out: { name: "strength potion",   kind: "might",    mightTurns: 8,   value: 16 } },
        { inputs: ["mineral", "mineral"], out: { name: "stoneskin draught", kind: "stoneskin", stoneskinTurns: 10, value: 18 } },
        { inputs: ["herb",    "mineral"], out: { name: "alchemist's fire",  kind: "alch-fire", power: 12, radius: 1, value: 14 } }
      ];

      // Register ingredients + alch-fire as purchasable items (idempotent).
      (function registerAlchemyItems() {
        const toAdd = [
          ...INGREDIENTS,
          { id: "alch-fire-shop", name: "alchemist's fire", kind: "alch-fire", power: 12, radius: 1, value: 14,
            tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/potion.png" }
        ];
        for (const tpl of toAdd) {
          if (!resources.inventory.some((i) => i.id === tpl.id)) {
            resources.inventory.push({ ...tpl });
          }
        }
      }());

      function matchRecipe(subA, subB) {
        const key = [subA, subB].sort().join("|");
        return RECIPES.find((r) => [...r.inputs].sort().join("|") === key) || null;
      }

      // Craft a potion from two ingredient IDs currently in inventory.
      // Removes both ingredients and adds the resulting item.
      function craftPotion(idA, idB, messages) {
        const inv = state.inventory;
        const a = inv.find((i) => i.id === idA && i.kind === "ingredient");
        const b = inv.find((i) => i.id === idB && i.kind === "ingredient" && i !== a);
        if (!a || !b) { messages.push("Those ingredients are not in the pack."); return false; }
        const recipe = matchRecipe(a.subkind, b.subkind);
        if (!recipe) { messages.push(`${a.name} and ${b.name} fizzle without effect.`); return false; }
        state.inventory = inv.filter((i) => i !== a && i !== b);
        const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
        const out = { ...recipe.out, id: `${recipe.out.kind}-brewed-${serial}` };
        state.inventory.push(out);
        messages.push(`Brewed: ${out.name}.`);
        return true;
      }

      // Convert any non-quest item into gold (half its value, min 1).
      function alchemizeItem(itemId, messages) {
        const item = state.inventory.find((i) => i.id === itemId);
        if (!item) { messages.push("Item not found."); return false; }
        if (item.kind === "quest") { messages.push("Quest items resist transmutation."); return false; }
        const gold = Math.max(1, Math.floor((item.value || 2) / 2));
        state.inventory = state.inventory.filter((i) => i !== item);
        state.gold += gold;
        messages.push(`${item.name} transmutes into ${gold} gold.`);
        return true;
      }

      // Throw alchemist's fire: ignites a flame cloud in the cell ahead
      // and scorches monsters within the blast radius.
      function useAlchemistFire(item, messages) {
        const step = dirs[state.dir];
        const tx = state.x + step.x;
        const ty = state.y + step.y;
        if (!mapContains(tx, ty)) { messages.push("No room ahead for the fire."); return false; }
        const floorState = currentFloorState();
        if (!floorState.clouds) floorState.clouds = [];
        floorState.clouds = floorState.clouds.filter((c) => !(c.x === tx && c.y === ty));
        floorState.clouds.push({ x: tx, y: ty, kind: "flame", turns: 5 });
        const radius = item.radius || 1;
        const power  = item.power  || 12;
        let hit = false;
        for (const m of floorState.monsters.filter((m) => m.hp > 0)) {
          if (Math.abs(m.x - tx) <= radius && Math.abs(m.y - ty) <= radius) {
            const dmg = Math.max(1, Math.round(power - (m.ac || 0) / 4));
            m.hp = Math.max(0, m.hp - dmg);
            messages.push(`${m.name} scorched for ${dmg}.`);
            hit = true;
          }
        }
        messages.push("Alchemist's fire ignites!");
        if (!hit) messages.push("The flames consume only air.");
        return true;
      }

      context.craftPotion      = craftPotion;
      context.alchemizeItem    = alchemizeItem;
      context.matchRecipe      = matchRecipe;
      context.useAlchemistFire = useAlchemistFire;
      context.ALCHEMY_RECIPES  = RECIPES;
    }
  };
}());
