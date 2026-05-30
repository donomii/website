(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyMovement = function (context) {
    with (context) {
      function collectFloorItem() {
        const found = itemAt(state.x, state.y);
        if (!found) return false;
        const floorState = currentFloorState();
        floorState.floorItems = floorState.floorItems.filter((item) => item !== found);
        if (found.kind === "gold") {
          state.gold += found.value || 0;
          const verb = found.value === 1 ? "clinks" : "clink";
          state.message = `${found.name} ${verb} into the purse.`;
          state.itemsCollected = (state.itemsCollected || 0) + 1;
          return true;
        }
        state.inventory.push(found);
        state.itemsCollected = (state.itemsCollected || 0) + 1;
        if (typeof pulse === "function") pulse("pickup");
        state.message = found.kind === "quest" ? `${found.name} flares in the pack. The way out matters now.` : `${found.name} slides into the pack.`;
        return true;
      }


      function triggerTrap() {
        const trap = trapAt(state.x, state.y);
        if (!trap) return false;
        // The party never springs its own laid traps.
        if (trap.playerLaid) return false;
        trap.armed = false;

        if (trap.kind === "alarm") {
          const floorState = currentFloorState();
          for (const monster of floorState.monsters) floorState.discovered.add(keyOf(monster.x, monster.y));
          addEffect("smite", [{ x: state.x, y: state.y }]);
          state.message = `${trap.name} screams through the halls.`;
          return true;
        }

        if (trap.kind === "teleport") {
          const origin = { x: state.x, y: state.y };
          const moved = teleportParty();
          addEffect(moved ? "blink" : "impact", moved ? [origin, { x: state.x, y: state.y }] : [origin]);
          state.message = moved ? `${trap.name} folds the corridor underfoot.` : `${trap.name} snaps, but has nowhere to send the party.`;
          return true;
        }

        const target = liveMember();
        if (!target) return true;
        const damage = Math.max(1, trap.power);
        addEffect(trap.kind === "snare" ? "impact" : "smite", [{ x: state.x, y: state.y }]);
        target.hp = Math.max(0, target.hp - damage);
        addDamageMark(state, null, damage);
        state.message = `${target.name} triggers ${trap.name} for ${damage}.`;
        if (!liveMember()) {
          state.defeated = true;
          state.message = `${trap.name} finishes the party.`;
        }
        if (trap.kind === "snare" && !state.defeated) {
          state.snaredTurns = Math.max(state.snaredTurns, 3);
          state.message = `${state.message} The net catches the party.`;
        }
        return true;
      }


      function openDoor(x, y) {
        currentFloorState().openedDoors.add(keyOf(x, y));
        state.doorsOpened = (state.doorsOpened || 0) + 1;
        if (typeof pulse === "function") pulse("door");
        state.message = "The door grinds into the wall.";
        reveal();
        advanceTurn();
        render();
      }


      function closeDoor(x, y) {
        if (monsterAt(x, y) || itemAt(x, y)) {
          setMessage("Something blocks the doorway.");
          return;
        }
        currentFloorState().openedDoors.delete(keyOf(x, y));
        state.message = "The door grinds shut.";
        reveal();
        advanceTurn();
        render();
      }


      function moveBy(dx, dy) {
        if (state.snaredTurns > 0) {
          state.message = "The net holds the party in place.";
          advanceTurn();
          render();
          return;
        }
        if (state.stunnedTurns > 0) {
          state.message = "The party is too stunned to move.";
          advanceTurn();
          render();
          return;
        }

        const step = state.dazedTurns > 0 ? dirs[Math.floor(Math.random() * dirs.length)] : { x: dx, y: dy };
        const nextX = state.x + step.x;
        const nextY = state.y + step.y;
        const target = monsterAt(nextX, nextY);
        if (target) {
          attackTarget(target);
          return;
        }
        // Swap places with a friendly ally rather than being blocked by it.
        if (typeof allyAt === "function" && allyAt(nextX, nextY) && typeof tryAllySwap === "function") {
          tryAllySwap(nextX, nextY);
          state.message = "The party slips past their ally.";
          reveal();
          advanceTurn();
          render();
          return;
        }
        if (closedDoorAt(nextX, nextY)) {
          openDoor(nextX, nextY);
          return;
        }
        if (solidAt(nextX, nextY)) {
          if (typeof pulse === "function") pulse("bump");
          setMessage("Stone refuses the party.");
          return;
        }

        state.x = nextX;
        state.y = nextY;
        if (typeof pulse === "function") pulse("move");
        const slipChance = typeof hazardSlipChance === "function" ? hazardSlipChance() : 0;
        const slipped = slipChance > 0 && Math.random() < slipChance;
        state.message = `${slipped ? "The party slides on the ice." : state.dazedTurns > 0 ? "The party stumbles through the haze." : "Boots scrape across old floor."}${applyBarbedMovement()}`;
        if (state.defeated) {
          reveal();
          render();
          return;
        }
        if (!triggerTrap() && state.autoPickup !== false) collectFloorItem();
        else if (state.autoPickup === false && itemAt(state.x, state.y)) state.message = `${itemAt(state.x, state.y).name} lies underfoot. Press pick up.`;
        if (stairsAt(state.x, state.y)) state.message = "Stairs wait underfoot.";
        reveal();
        // Run mode: try a second step in the same direction, no extra turn cost.
        // A slip on icy floors forfeits the bonus step.
        if (state.runMode && !slipped && !state.snaredTurns && !state.stunnedTurns && !state.defeated) {
          const followX = state.x + step.x;
          const followY = state.y + step.y;
          const followTarget = monsterAt(followX, followY);
          if (!followTarget && !closedDoorAt(followX, followY) && !solidAt(followX, followY) && !trapAt(followX, followY)) {
            state.x = followX;
            state.y = followY;
            collectFloorItem();
            reveal();
          }
        }
        advanceTurn();
        render();
      }


      function applyBarbedMovement() {
        if (state.barbedTurns <= 0) return "";
        const target = liveMember();
        if (!target) return "";
        const damage = Math.max(1, Math.ceil(target.maxHp / 12));
        target.hp = Math.max(0, target.hp - damage);
        addEffect("impact", [{ x: state.x, y: state.y }]);
        if (!liveMember()) {
          state.defeated = true;
          return ` Barbs tear ${target.name} for ${damage}.`;
        }
        return ` Barbs tear ${target.name} for ${damage}.`;
      }


      function turn(delta) {
        state.dir = (state.dir + delta + dirs.length) % dirs.length;
        state.message = `Facing ${dirs[state.dir].name}.`;
        reveal();
        render();
      }


      function changeFloor(nextFloorIndex, direction) {
        if (typeof pulse === "function") pulse("stairs");
        const previousIndex = state.floorIndex;
        const previousFloorState = state.floors[previousIndex];
        if (previousFloorState && previousFloorState.monsters.filter((m) => m.hp > 0 && !m.summoned).length === 0) {
          state.floorsCleared = (state.floorsCleared || 0) + 1;
        }

        // Multi-floor pursuit: lift close, ground-bound monsters into a "chasing"
        // queue on the destination floor. They arrive at the entry stairs after
        // a few turns.
        const pursuitEnabled = context.pursuitEnabled !== false;
        const pursuers = pursuitEnabled
          ? (previousFloorState?.monsters || []).filter((m) =>
              m.hp > 0
              && !m.summoned
              && !m.boss
              && !m.traits?.stationary
              && distanceToPlayer(m) <= 5
            )
          : [];
        const destFloorState = state.floors[nextFloorIndex];
        if (destFloorState && pursuers.length > 0) {
          destFloorState.pendingArrivals = destFloorState.pendingArrivals || [];
          for (const m of pursuers) {
            // Clone so the original reference can be removed cleanly.
            const queued = { ...m, energy: 0, arrivalAt: 3, pendingPursuit: true };
            destFloorState.pendingArrivals.push(queued);
          }
          previousFloorState.monsters = previousFloorState.monsters.filter((m) => !pursuers.includes(m));
        }

        state.floorIndex = nextFloorIndex;
        state.floorTurnCount = 0;
        state.stairsTaken = (state.stairsTaken || 0) + 1;
        // Banked gold earns interest each time the party delves deeper.
        if (direction === "down" && typeof accrueBankInterest === "function") accrueBankInterest();
        const floor = currentFloor();
        if (typeof trackVisitedBranch === "function") trackVisitedBranch();
        const landing = direction === "down" ? floor.stairs.up || floor.start : floor.stairs.down || floor.start;
        state.x = landing.x;
        state.y = landing.y;
        state.dir = floor.start.dir;
        const pursuitNote = pursuers.length > 0 ? ` Footsteps echo from above…` : "";
        state.message = `The party enters ${floor.id}: ${floor.name}.${pursuitNote}`;
        reveal();
        render();
      }


      function findPursuitLanding() {
        // Try the party tile's neighbors, then a small spiral.
        for (let radius = 1; radius <= 4; radius += 1) {
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              if (Math.abs(dx) + Math.abs(dy) > radius) continue;
              const x = state.x + dx;
              const y = state.y + dy;
              if (x === state.x && y === state.y) continue;
              if (!mapContains(x, y)) continue;
              if (solidAt(x, y) || closedDoorAt(x, y) || monsterAt(x, y) || trapAt(x, y)) continue;
              return { x, y };
            }
          }
        }
        return null;
      }


      function processPursuitArrivals(messages) {
        const floorState = currentFloorState();
        if (!floorState.pendingArrivals || floorState.pendingArrivals.length === 0) return;
        const remaining = [];
        for (const queued of floorState.pendingArrivals) {
          queued.arrivalAt = (queued.arrivalAt || 0) - 1;
          if (queued.arrivalAt > 0) {
            remaining.push(queued);
            continue;
          }
          const landing = findPursuitLanding();
          if (!landing) {
            // Try again next turn.
            queued.arrivalAt = 1;
            remaining.push(queued);
            continue;
          }
          const arrived = { ...queued };
          delete arrived.arrivalAt;
          delete arrived.pendingPursuit;
          arrived.x = landing.x;
          arrived.y = landing.y;
          arrived.energy = 0;
          floorState.monsters.push(arrived);
          floorState.discovered.add(keyOf(arrived.x, arrived.y));
          if (messages) messages.push(`${arrived.name} arrives in pursuit.`);
        }
        floorState.pendingArrivals = remaining;
      }


      function useStairs() {
        const stairs = stairsAt(state.x, state.y);
        if (!stairs) {
          setMessage("No stairs here.");
          return;
        }
        if (stairs.direction === "down") {
          if (state.floorIndex === resources.floors.length - 1) {
            setMessage("The stairs descend into the next chunk of game that does not exist yet.");
            return;
          }
          changeFloor(state.floorIndex + 1, "down");
          return;
        }
        if (state.floorIndex === 0) {
          if (hasPrize()) {
            state.victory = true;
            state.message = `The party escapes with the Orb of Zot Soup and ${state.gold} gold.`;
            render();
            return;
          }
          setMessage("The exit is behind you, but the prize is still below.");
          return;
        }
        changeFloor(state.floorIndex - 1, "up");
      }

      Object.assign(context, {
        collectFloorItem,
        triggerTrap,
        openDoor,
        closeDoor,
        moveBy,
        applyBarbedMovement,
        turn,
        changeFloor,
        findPursuitLanding,
        processPursuitArrivals,
        useStairs,
      });
    }
  };
}());
