(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installCooking = function installCooking(context) {
    with (context) {
      // ── Meal definitions ──────────────────────────────────────────────────
      const MEAL_DEFS = {
        "hearty-stew": { heal: 15, powerTurns: 0, defenseTurns: 0, label: "Hearty Stew"  },
        "battle-brew":  { heal: 0,  powerTurns: 8, defenseTurns: 0, label: "Battle Brew"  },
        "iron-ration":  { heal: 0,  powerTurns: 0, defenseTurns: 8, label: "Iron Ration"  },
        "wild-feast":   { heal: 5,  powerTurns: 5, defenseTurns: 5, label: "Wild Feast"   }
      };

      const COOKING_POWER_BONUS   = 2;
      const COOKING_DEFENSE_BONUS = 2;

      context.MEAL_DEFS = MEAL_DEFS;

      // ── Item registration ─────────────────────────────────────────────────
      const ITEMS = [
        { id: "cooking-pot",  name: "cooking pot",  kind: "cooking-pot",  charges: 3, value: 10,
          desc: "A camp cooking pot. Cook a meal to gain lasting buffs." },
        { id: "raw-meat",     name: "raw meat",     kind: "ingredient",   value: 2  },
        { id: "dried-herbs",  name: "dried herbs",  kind: "ingredient",   value: 2  },
        { id: "iron-root",    name: "iron root",    kind: "ingredient",   value: 2  }
      ];
      for (const item of ITEMS) {
        if (!resources.inventory.some((i) => i.id === item.id)) {
          resources.inventory.push({ ...item });
        }
      }

      // ── State initialisation ──────────────────────────────────────────────
      if (!state.cookingBuffs) state.cookingBuffs = { powerTurns: 0, defenseTurns: 0 };

      // ── Cook a meal ───────────────────────────────────────────────────────
      function cookMeal(kind, messages) {
        if (context.cookingDisabled) { messages.push("Cooking is not active."); return false; }
        const def = MEAL_DEFS[kind];
        if (!def) {
          messages.push(`Unknown meal: ${kind}. Choose: ${Object.keys(MEAL_DEFS).join(", ")}.`);
          return false;
        }
        const pot = state.inventory.find((i) => i.kind === "cooking-pot" && (i.charges || 0) > 0);
        if (!pot) { messages.push("You need a cooking pot with charges."); return false; }
        pot.charges -= 1;
        if (pot.charges === 0) state.inventory = state.inventory.filter((i) => i !== pot);

        // Apply heal immediately.
        if (def.heal > 0) {
          for (const m of state.party) {
            if ((m.hp || 0) > 0) m.hp = Math.min(m.maxHp || m.hp, m.hp + def.heal);
          }
        }
        // Stack buff turns (don't reset shorter remaining buffs).
        if (def.powerTurns   > 0) state.cookingBuffs.powerTurns   = Math.max(state.cookingBuffs.powerTurns,   def.powerTurns);
        if (def.defenseTurns > 0) state.cookingBuffs.defenseTurns = Math.max(state.cookingBuffs.defenseTurns, def.defenseTurns);

        messages.push(`${def.label} cooked and served.${def.heal > 0 ? ` Party healed ${def.heal} HP.` : ""}`);
        return true;
      }

      // ── Passive bonuses ───────────────────────────────────────────────────
      function cookingPowerBonus(_member) {
        if (context.cookingDisabled) return 0;
        return (state.cookingBuffs?.powerTurns || 0) > 0 ? COOKING_POWER_BONUS : 0;
      }

      function cookingDefenseBonus() {
        if (context.cookingDisabled) return 0;
        return (state.cookingBuffs?.defenseTurns || 0) > 0 ? COOKING_DEFENSE_BONUS : 0;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickCooking(messages) {
        if (context.cookingDisabled) return;
        if (!state.cookingBuffs) return;
        let changed = false;
        if (state.cookingBuffs.powerTurns > 0) {
          state.cookingBuffs.powerTurns -= 1;
          if (state.cookingBuffs.powerTurns === 0) {
            messages.push("The battle brew's warmth fades.");
            changed = true;
          }
        }
        if (state.cookingBuffs.defenseTurns > 0) {
          state.cookingBuffs.defenseTurns -= 1;
          if (state.cookingBuffs.defenseTurns === 0) {
            messages.push("The iron ration's fortifying effect wears off.");
            changed = true;
          }
        }
      }

      context.cookMeal           = cookMeal;
      context.cookingPowerBonus  = cookingPowerBonus;
      context.cookingDefenseBonus = cookingDefenseBonus;

      turnHooks.push(tickCooking);
    }
  };
}());
