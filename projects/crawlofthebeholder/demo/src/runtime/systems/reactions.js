(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Environmental element reactions: damaging elements interact with clouds and
  // water/lava terrain to produce emergent effects (combustion, steam, ice,
  // electrified water). Everything here is inert until an element actually lands
  // on a reactive tile, so it never perturbs combat that ignores terrain.
  window.CotBRuntime.installReactions = function (context) {
    with (context) {
      const FREEZE_TURNS = 8;
      const STEAM_TURNS = 3;

      function frozenTiles() {
        const floorState = currentFloorState();
        if (!floorState.frozenTiles) floorState.frozenTiles = new Map();
        return floorState.frozenTiles;
      }

      function freezeTile(x, y, turns = FREEZE_TURNS) {
        const tiles = frozenTiles();
        tiles.set(keyOf(x, y), Math.max(tiles.get(keyOf(x, y)) || 0, turns));
      }

      function thawTile(x, y) {
        frozenTiles().delete(keyOf(x, y));
      }

      function rawCell(x, y) {
        return cellAt(x, y);
      }

      function isWaterCell(x, y) {
        const cell = rawCell(x, y);
        return cell === "w" || cell === "W";
      }

      // Flood-fill the contiguous body of (unfrozen) water that includes (x, y).
      function connectedWater(x, y) {
        if (!isWaterCell(x, y) || isFrozenTile(x, y)) return [];
        const seen = new Set([keyOf(x, y)]);
        const stack = [{ x, y }];
        const region = [];
        while (stack.length) {
          const cell = stack.pop();
          region.push(cell);
          for (const dir of dirs) {
            const nx = cell.x + dir.x;
            const ny = cell.y + dir.y;
            const key = keyOf(nx, ny);
            if (seen.has(key) || !mapContains(nx, ny)) continue;
            if (isWaterCell(nx, ny) && !isFrozenTile(nx, ny)) {
              seen.add(key);
              stack.push({ x: nx, y: ny });
            }
          }
        }
        return region;
      }

      function damageMonsterAt(x, y, amount, element, messages) {
        const monster = monsterAt(x, y);
        if (!monster || monster.hp <= 0) return false;
        const damage = monsterElementDamage(monster, Math.max(1, amount), element);
        monster.hp = Math.max(0, monster.hp - damage);
        if (typeof addDamageMark === "function") addDamageMark(monster, element, damage);
        if (monster.hp === 0 && typeof killMonster === "function") {
          const note = killMonster(monster);
          if (note) messages.push(note);
        }
        return true;
      }

      function electrifyWater(x, y, power, messages) {
        const region = connectedWater(x, y);
        if (region.length === 0) return null;
        let hits = 0;
        for (const cell of region) {
          if (damageMonsterAt(cell.x, cell.y, Math.max(2, power), "elec", messages)) hits += 1;
        }
        // The party is shocked too if it shares the water body.
        if (region.some((cell) => cell.x === state.x && cell.y === state.y)) {
          const target = liveMember();
          if (target) {
            const shock = partyElementDamage(Math.max(1, Math.ceil(power / 2)), "elec");
            target.hp = Math.max(0, target.hp - shock);
            state.damageTaken = (state.damageTaken || 0) + shock;
            messages.push(`The charged water shocks ${target.name} for ${shock}.`);
            if (!liveMember()) {
              state.defeated = true;
              state.message = `${target.name} is electrocuted in the water.`;
            }
          }
        }
        messages.push(hits > 0
          ? `Electricity arcs through the water, jolting ${hits} foe${hits === 1 ? "" : "s"}.`
          : "Electricity crackles across the still water.");
        return "electrify";
      }

      // Apply a damaging element to a single cell and resolve any environmental
      // reaction there. Returns a short reaction tag, or null if nothing reacted.
      function reactionAt(x, y, element, power = 4, messages = []) {
        if (!element || !mapContains(x, y)) return null;
        const cloud = cloudAt(x, y);

        // Fire ignites flammable gas (poison) and fog into a flash of flame.
        if (element === "fire" && cloud && (cloud.kind === "poison" || cloud.kind === "fog")) {
          cloud.kind = "flame";
          cloud.turns = Math.max(cloud.turns, STEAM_TURNS);
          if (!damageMonsterAt(x, y, Math.max(2, power), "fire", messages)) {
            messages.push("The gas ignites in a sheet of flame.");
          } else {
            messages.push("The gas ignites.");
          }
          return "ignite";
        }

        // Water or cold smothers a flame cloud, leaving vision-blocking steam.
        if ((element === "water" || element === "cold") && cloud && cloud.kind === "flame") {
          cloud.kind = "steam";
          cloud.turns = Math.max(cloud.turns, STEAM_TURNS);
          messages.push("The flames hiss out into a cloud of steam.");
          return "steam";
        }

        // Cold freezes water/lava into a temporary walkable crust.
        if (element === "cold" && !isFrozenTile(x, y) && (isWaterCell(x, y) || rawCell(x, y) === "l")) {
          freezeTile(x, y);
          messages.push(rawCell(x, y) === "l" ? "The lava crusts over with cooled rock." : "The water freezes into a sheet of ice.");
          return "freeze";
        }

        // Fire thaws a frozen tile back to open water.
        if (element === "fire" && isFrozenTile(x, y)) {
          thawTile(x, y);
          messages.push("The ice cracks and melts away.");
          return "thaw";
        }

        // Electricity arcs through a connected body of water.
        if (element === "elec" && isWaterCell(x, y) && !isFrozenTile(x, y)) {
          return electrifyWater(x, y, power, messages);
        }

        return null;
      }

      // Per-turn upkeep: frozen crusts thaw over time.
      function tickFrozenTiles(messages) {
        const floorState = currentFloorState();
        const tiles = floorState.frozenTiles;
        if (!tiles || tiles.size === 0) return false;
        for (const [key, turns] of [...tiles.entries()]) {
          if (turns <= 1) {
            tiles.delete(key);
            if (floorState.discovered.has(key)) messages.push("A sheet of ice melts back to water.");
          } else {
            tiles.set(key, turns - 1);
          }
        }
        return false;
      }

      if (Array.isArray(turnHooks)) turnHooks.push(tickFrozenTiles);

      Object.assign(context, {
        freezeTile,
        thawTile,
        connectedWater,
        electrifyWater,
        reactionAt,
        tickFrozenTiles
      });
    }
  };
}());
