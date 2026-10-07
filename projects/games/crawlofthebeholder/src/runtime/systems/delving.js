(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Delving hazards and tonics: shaft traps that genuinely drop the party a
  // floor, levitation to float over terrain (and shafts), and a potion of
  // magic that recharges wands.
  window.CotBRuntime.installDelving = function installDelving(context) {
    with (context) {
      const POTION_DIR = "vendor/crawl/crawl-ref/source/rltiles/item/potion";
      const TONIC_TEMPLATES = [
        { id: "potion-levitation", name: "potion of levitation", kind: "levitation", turns: 20, value: 16, weight: 1, tile: `${POTION_DIR}/cyan.png`, desc: "Float above water, lava, and yawning shafts for a time." },
        { id: "potion-magic", name: "potion of magic", kind: "wand-recharge", power: 3, value: 18, weight: 1, tile: `${POTION_DIR}/brilliant_blue.png`, desc: "Restores charges to the party's most drained wand." }
      ];

      if (!context.delvingDisabled) {
        // Template pool AND the live pack — state.inventory was copied from
        // resources before this module installed, so push to both.
        for (const template of TONIC_TEMPLATES) {
          if (!resources.inventory.some((item) => item.id === template.id)) resources.inventory.push({ ...template });
          if (!state.inventory.some((item) => item.id === template.id)) state.inventory.push({ ...template });
        }
      }

      function levitating() {
        return (state.levitationTurns || 0) > 0;
      }

      function isShaftTrap(trap) {
        return !!trap && (trap.kind === "shaft" || /shaft/i.test(trap.name || ""));
      }

      // True when the shaft was handled here (fall or float); false hands the
      // trap back to the generic damage path.
      function shaftFall(trap) {
        if (context.delvingDisabled || !isShaftTrap(trap)) return false;
        if (levitating()) {
          state.message = "The party floats serenely over the yawning shaft.";
          return true;
        }
        if (state.floorIndex >= resources.floors.length - 1) return false;
        const target = liveMember();
        const damage = 4 + Math.floor(Math.random() * 5);
        changeFloor(state.floorIndex + 1, "down");
        if (target) {
          target.hp = Math.max(0, target.hp - damage);
          state.damageTaken = (state.damageTaken || 0) + damage;
          addDamageMark(state, null, damage);
        }
        if (target && !liveMember()) {
          state.defeated = true;
          state.message = `The floor gives way — ${target.name} dies in the fall.`;
          return true;
        }
        state.message = `The floor gives way! The party plunges to ${currentFloor().id}${target ? ` — ${target.name} takes ${damage} in the fall` : ""}.`;
        return true;
      }

      ITEM_USE.levitation = (item) => {
        state.levitationTurns = Math.max(state.levitationTurns || 0, item.turns || 20);
        removeInventoryItem(item);
        if (typeof addEffect === "function") addEffect("halo", [{ x: state.x, y: state.y }]);
        state.message = "The party's boots lift gently from the stone.";
        advanceTurn();
        render();
      };

      ITEM_USE["wand-recharge"] = (item) => {
        const wand = state.inventory
          .filter((entry) => entry.kind === "wand")
          .sort((a, b) => (a.charges || 0) - (b.charges || 0))[0];
        if (!wand) { setMessage("The party holds no wand to recharge."); return; }
        wand.charges = (wand.charges || 0) + (item.power || 3);
        removeInventoryItem(item);
        if (typeof addEffect === "function") addEffect("magic", [{ x: state.x, y: state.y }]);
        state.message = `${wand.name} crackles back to ${wand.charges} charges.`;
        advanceTurn();
        render();
      };

      function tickLevitation(messages) {
        if ((state.levitationTurns || 0) <= 0) return;
        state.levitationTurns -= 1;
        if (state.levitationTurns === 0) messages.push("The party settles back to the floor.");
      }

      turnHooks.push(tickLevitation);
      Object.assign(context, { levitating, isShaftTrap, shaftFall, tickLevitation });
    }
  };
}());
