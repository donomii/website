(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyInventory = function (context) {
    with (context) {

      function dropFrontItem() {
        const lastItem = state.inventory.at(-1);
        if (!lastItem) {
          setMessage("Pack is empty.");
          return;
        }
        if (lastItem.kind === "quest") {
          setMessage(`${lastItem.name} refuses to leave the pack.`);
          return;
        }
        if (itemAt(state.x, state.y)) {
          setMessage("Something already lies here.");
          return;
        }
        const dropped = { ...lastItem, x: state.x, y: state.y };
        currentFloorState().floorItems.push(dropped);
        removeInventoryItem(lastItem);
        state.message = `${lastItem.name} drops at the party's feet.`;
        advanceTurn();
        render();
      }


      // Auto-equip the strongest available gear into each empty/weaker slot.
      // Skips cursed currently-equipped items (they can't be swapped out).
      function autoEquipBest() {
        const slotKinds = { weapon: "weapon", armour: "armour", talisman: "talisman", ring: "ring", amulet: "amulet" };
        let equipped = 0;
        for (const member of liveMembers()) {
          for (const slot of Object.keys(slotKinds)) {
            const kind = slotKinds[slot];
            // Find the best inventory candidate for this slot.
            const candidates = state.inventory.filter((item) => item.kind === kind);
            if (candidates.length === 0) continue;
            const best = candidates.reduce((a, b) => ((b.power || 0) > (a.power || 0) ? b : a));
            const current = member[slot];
            if (current && current.cursed) continue; // can't remove cursed gear
            if (current && (current.power || 0) >= (best.power || 0)) continue;
            // Equip best; the previous item returns to inventory.
            removeInventoryItem(best);
            if (current) state.inventory.push(current);
            member[slot] = best;
            equipped += 1;
          }
        }
        if (equipped > 0) {
          state.message = `The party gears up — ${equipped} upgrade${equipped === 1 ? "" : "s"} equipped.`;
          advanceTurn();
          render();
        } else {
          setMessage("No gear upgrades available.");
        }
        return equipped;
      }


      function removeInventoryItem(item) {
        state.inventory = state.inventory.filter((entry) => entry !== item);
      }


      // Crafting: combine the two earliest same-kind consumables into one
      // stronger copy. Returns the crafted item or null when nothing matched.
      const CRAFTABLE_KINDS = new Set(["healing", "might", "resistance", "haste", "fog", "poison", "fear", "immolation", "silence", "food"]);

      function craftCombine() {
        const seen = new Map();
        for (const item of state.inventory) {
          if (!CRAFTABLE_KINDS.has(item.kind)) continue;
          // Match on kind + name so we only fuse genuinely identical potions.
          const key = `${item.kind}:${item.name}`;
          if (seen.has(key)) {
            const first = seen.get(key);
            const crafted = {
              ...first,
              id: `craft-${state.lootSerial += 1}`,
              name: `concentrated ${first.name}`,
              shortName: `c-${first.shortName || first.kind}`,
              power: Math.round((first.power || 0) * 1.6) + 2,
              turns: first.turns ? Math.round(first.turns * 1.5) : first.turns
            };
            removeInventoryItem(first);
            removeInventoryItem(item);
            state.inventory.push(crafted);
            state.message = `Combined two ${first.name}s into ${crafted.name}.`;
            if (typeof renderChrome === "function") renderChrome();
            if (typeof saveGame === "function") saveGame();
            return crafted;
          }
          seen.set(key, item);
        }
        setMessage("Need two identical potions or scrolls to combine.");
        return null;
      }


      function equipItem(item, slot, verb) {
        const target = liveMember();
        if (!target) return false;
        const previous = target[slot];
        if (previous && previous.cursed) {
          if (typeof identifyItem === "function") identifyItem(previous);
          setMessage(`${previous.name} is cursed and will not come off.`);
          return false;
        }
        removeInventoryItem(item);
        target[slot] = item;
        if (previous) state.inventory.push(previous);
        if (item.cursed && typeof identifyItem === "function") {
          identifyItem(item);
          state.message = `${target.name} ${verb} ${item.name}. It clings ominously.`;
        } else {
          state.message = previous ? `${target.name} swaps ${previous.name} for ${item.name}.` : `${target.name} ${verb} ${item.name}.`;
        }
        return true;
      }

      Object.assign(context, {
        dropFrontItem,
        autoEquipBest,
        removeInventoryItem,
        craftCombine,
        equipItem,
      });
    }
  };
}());
