(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Milestones and traveller QoL: bonuses for fully exploring a floor, clearing
  // it of monsters, or crossing it untouched; a second wind on reaching new
  // depths; automatic eating at starvation; and travel-to-loot.
  window.CotBRuntime.installMilestones = function installMilestones(context) {
    with (context) {
      function milestones() {
        if (!state.milestones) state.milestones = { explored: {}, cleared: {}, flawless: {}, deepest: 0 };
        return state.milestones;
      }

      function award(messages, gold, line) {
        state.gold = (state.gold || 0) + gold;
        messages.push(`${line} +${gold} gold.`);
        if (typeof pulse === "function") pulse("achievement");
      }

      function tickMilestones(messages) {
        if (context.milestonesDisabled) return;
        const ms = milestones();
        const floorIndex = state.floorIndex;

        // Thorough explorer: the whole floor mapped.
        if (!ms.explored[floorIndex] && typeof floorExploredPercent === "function" && floorExploredPercent() >= 100) {
          ms.explored[floorIndex] = true;
          award(messages, 15 + floorIndex * 3, "The floor holds no more secrets —");
        }

        // Clearance bounty: every monster on the floor put down.
        const floorState = currentFloorState();
        if (!ms.cleared[floorIndex]
          && (currentFloor().encounters || []).length > 0
          && floorState.monsters.filter((monster) => monster.hp > 0 && !monster.summoned).length === 0) {
          ms.cleared[floorIndex] = true;
          award(messages, 20 + floorIndex * 4, "The floor falls silent — clearance bounty,");
        }

        // Second wind: deeper than the party has ever been this run.
        if (floorIndex > (ms.deepest || 0)) {
          ms.deepest = floorIndex;
          messages.push("New depths reached. Recovery still requires consumable supplies.");
        }

        // Flawless passage: left the previous floor without taking a scratch.
        if (!state.flawlessFloor || state.flawlessFloor.index !== floorIndex) {
          const previous = state.flawlessFloor;
          if (previous
            && !ms.flawless[previous.index]
            && (state.damageTaken || 0) === previous.damage
            && state.turnCount - previous.turn > 5) {
            ms.flawless[previous.index] = true;
            award(messages, 12 + previous.index * 2, `Flawless passage through floor ${previous.index + 1} —`);
          }
          state.flawlessFloor = { index: floorIndex, damage: state.damageTaken || 0, turn: state.turnCount };
        }

        // Starving parties eat whatever food they carry rather than waste away.
        if (!context.hungerDisabled && (state.satiety || 0) <= 0) {
          const food = state.inventory.find((item) => item.kind === "food");
          if (food) {
            state.satiety = Math.min(1200, (state.satiety || 0) + Math.max(50, food.power || 400));
            state.inventory = state.inventory.filter((item) => item !== food);
            messages.push(`Starving, the party devours the ${food.name}.`);
          }
        }
      }

      function travelToLootTargets() {
        const floorState = currentFloorState();
        return floorState.floorItems.filter((item) => floorState.discovered.has(keyOf(item.x, item.y)));
      }

      function travelToLoot() {
        if (state.victory || state.defeated) return;
        const threat = typeof restNearbyThreat === "function" ? restNearbyThreat() : null;
        if (threat) { setMessage(`${threat.name} blocks the way. Travel is unsafe.`); return; }
        let targets = travelToLootTargets();
        if (targets.length === 0) { setMessage("No known loot lies unclaimed on this floor."); return; }
        let steps = 0;
        const maxSteps = 200;
        while (steps < maxSteps && !state.defeated && !state.victory) {
          const move = bfsNextStep(targets);
          if (!move || move.reached) break;
          const before = { x: state.x, y: state.y };
          moveBy(move.dx, move.dy);
          steps += 1;
          if (state.x === before.x && state.y === before.y) break;
          if (typeof restNearbyThreat === "function" && restNearbyThreat()) break;
          targets = travelToLootTargets();
          if (targets.length === 0) break; // auto-pickup claimed it
        }
        if (steps > 0) state.message = `The party gathers toward the loot (${steps} step${steps === 1 ? "" : "s"}). ${state.message || ""}`.trim();
        render();
      }

      turnHooks.push(tickMilestones);
      Object.assign(context, { tickMilestones, travelToLootTargets, travelToLoot });
    }
  };
}());
