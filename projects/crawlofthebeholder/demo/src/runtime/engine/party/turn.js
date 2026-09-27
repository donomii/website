(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyTurn = function (context) {
    with (context) {

      function toggleRunMode() {
        state.runMode = !state.runMode;
        state.message = state.runMode ? "The party hurries — two steps per turn." : "The party slows to a normal pace.";
        render();
      }


      function dropMapMarker(kind) {
        state.mapMarkers = state.mapMarkers || [];
        const existing = state.mapMarkers.findIndex((m) => m.floorIndex === state.floorIndex && m.x === state.x && m.y === state.y);
        if (existing >= 0) state.mapMarkers.splice(existing, 1);
        state.mapMarkers.push({ floorIndex: state.floorIndex, x: state.x, y: state.y, kind, turn: state.turnCount });
        state.message = `Marker dropped (${kind}).`;
        if (typeof renderMarkersList === "function") renderMarkersList();
        render();
      }


      function clearMapMarkerHere() {
        state.mapMarkers = (state.mapMarkers || []).filter((m) => !(m.floorIndex === state.floorIndex && m.x === state.x && m.y === state.y));
        state.message = "Marker cleared.";
        if (typeof renderMarkersList === "function") renderMarkersList();
        render();
      }


      function cycleFormation() {
        if (state.party.length < 2) {
          setMessage("The party has no formation to cycle.");
          return;
        }
        if (state.victory || state.defeated) return;
        const aliveCount = liveMembers().length;
        if (aliveCount === 0) {
          setMessage("No one is upright to lead.");
          return;
        }
        // Rotate until a living member sits in front (slot 0).
        let rotations = 0;
        while (state.party[0].hp <= 0 || rotations === 0) {
          const lead = state.party.shift();
          state.party.push(lead);
          rotations += 1;
          if (rotations > state.party.length) break;
        }
        state.message = `${state.party[0].name} steps to the front.`;
        render();
      }


      function waitTurn() {
        const adjacentThreat = currentFloorState().monsters.some((monster) => monster.hp > 0 && distanceToPlayer(monster) === 1);
        if (adjacentThreat) {
          state.message = "The party braces.";
        } else {
          state.message = "The party waits. Waiting does not restore health; use recovery supplies.";
        }
        advanceTurn();
        render();
      }


      function restNearbyThreat() {
        const floorState = currentFloorState();
        return floorState.monsters.find((monster) =>
          monster.hp > 0
          && floorState.discovered.has(keyOf(monster.x, monster.y))
          && distanceToPlayer(monster) <= 5
        );
      }


      function restPartyWounded() {
        return state.party.some((member) => member.hp > 0 && member.hp < member.maxHp);
      }


      function restBlockingCondition() {
        if (state.poisonedTurns > 0) return "poison";
        if (state.engulfedTurns > 0) return "engulfed";
        if (state.barbedTurns > 0) return "barbs";
        if (state.snaredTurns > 0) return "snared";
        if (state.dazedTurns > 0) return "dazed";
        if (state.corrodedTurns > 0) return "corrosion";
        if (state.vitrifiedTurns > 0) return "vitrified";
        if (cloudAt(state.x, state.y)) return "cloud";
        return null;
      }


      function restUntilReady() {
        if (state.victory || state.defeated) {
          return;
        } else {
          setMessage("Rest does not restore health. Use a healing consumable from the shared pack; wait to pass one turn.");
        }
      }


      // Player commands keyed by action id; each is a thunk run by handleAction.
      // This replaces a 28-branch if-chain that re-tested the action string on
      // every branch. Actions backed by optional modules (signatures, stances,
      // hidden passages) keep their typeof guard inside the thunk so they no-op
      // cleanly when that system isn't installed.
      const ACTIONS = {
        turnLeft: () => turn(-1),
        turnRight: () => turn(1),
        moveForward: () => { const forward = dirAt(0); moveBy(forward.x, forward.y); },
        moveLeft: () => { const left = dirAt(-1); moveBy(left.x, left.y); },
        moveRight: () => { const right = dirAt(1); moveBy(right.x, right.y); },
        moveBack: () => { const back = dirAt(2); moveBy(back.x, back.y); },
        attack: () => attackForward(),
        interact: () => interact(),
        pickup: () => pickupCurrentItem(),
        disarm: () => disarmTrapTarget(),
        stairs: () => useStairs(),
        wait: () => waitTurn(),
        rest: () => restUntilReady(),
        cycleFormation: () => cycleFormation(),
        autoExplore: () => autoExplore(),
        travelToStairs: () => travelToStairs(),
        travelToLoot: () => { if (typeof travelToLoot === "function") travelToLoot(); },
        charge: () => chargeAttack(),
        sweep: () => sweepAttack(),
        toggleRun: () => toggleRunMode(),
        dropItem: () => dropFrontItem(),
        examine: () => examineMode(),
        signature: () => triggerSignature(),
        ultimate: () => { if (typeof triggerUltimate === "function") triggerUltimate(); },
        search: () => { if (typeof searchHiddenPassages === "function") searchHiddenPassages(); },
        craft: () => craftCombine(),
        autoEquip: () => autoEquipBest(),
        cycleStance: () => { if (typeof cycleStanceAction === "function") cycleStanceAction(); },
        rally: () => { if (typeof rallyPartyAction === "function") rallyPartyAction(); }
      };

      function handleAction(action) {
        if (state.victory || state.defeated) return;
        const run = ACTIONS[action];
        if (run) run();
      }

      Object.assign(context, {
        toggleRunMode,
        dropMapMarker,
        clearMapMarkerHere,
        cycleFormation,
        waitTurn,
        restNearbyThreat,
        restPartyWounded,
        restBlockingCondition,
        restUntilReady,
        handleAction,
      });
    }
  };
}());
