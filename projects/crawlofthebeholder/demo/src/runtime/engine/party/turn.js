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
        if (!adjacentThreat) {
          const baseHeal = hasEquippedNamed("amulet", "regeneration") || hasEquippedNamed("amulet", "vitality") ? 2 : 1;
          const restBonus = typeof classRestBonus === "function" ? classRestBonus() : 0;
          const talentBonus = typeof talentBonusRestHeal === "function" ? talentBonusRestHeal() : 0;
          const deityBonus = typeof deityRestBonus === "function" ? deityRestBonus() : 0;
          const healing = baseHeal + restBonus + talentBonus + deityBonus;
          for (const member of state.party) {
            if (member.hp > 0 && member.hp < member.maxHp) member.hp = Math.min(member.maxHp, member.hp + healing);
          }
          state.message = healing > 2 ? "The party catches a blessed breath." : healing > 1 ? "The party catches a strong breath." : "The party catches a breath.";
        } else {
          state.message = "The party braces.";
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
        if (state.victory || state.defeated) return;
        if (!restPartyWounded()) {
          setMessage("The party is already at full strength.");
          return;
        }
        const blocker = restBlockingCondition();
        if (blocker) {
          setMessage(`The party cannot rest while ${blocker} lingers.`);
          return;
        }
        const initialThreat = restNearbyThreat();
        if (initialThreat) {
          setMessage(`${initialThreat.name} is too close. The party cannot rest.`);
          return;
        }

        let turns = 0;
        const maxTurns = 80;
        let stoppedBy = null;
        while (turns < maxTurns && restPartyWounded() && !state.defeated && !state.victory) {
          waitTurn();
          turns += 1;
          const intruder = restNearbyThreat();
          if (intruder) {
            stoppedBy = `${intruder.name} closes in`;
            break;
          }
          const newBlocker = restBlockingCondition();
          if (newBlocker) {
            stoppedBy = `${newBlocker} sets in`;
            break;
          }
        }
        if (turns === 0) {
          state.message = "The party finds no rest.";
        } else if (stoppedBy) {
          state.message = `The party rests ${turns} turn${turns === 1 ? "" : "s"} until ${stoppedBy}.`;
        } else if (!restPartyWounded()) {
          state.message = `The party rests ${turns} turn${turns === 1 ? "" : "s"} and stands ready.`;
        } else {
          state.message = `The party rests ${turns} turn${turns === 1 ? "" : "s"} but is still wounded.`;
        }
        render();
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
