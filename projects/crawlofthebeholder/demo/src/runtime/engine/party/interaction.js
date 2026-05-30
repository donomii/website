(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyInteraction = function (context) {
    with (context) {

      function examineMode() {
        const forward = dirAt(0);
        const ahead = { x: state.x + forward.x, y: state.y + forward.y };
        const monster = monsterAt(ahead.x, ahead.y);
        const item = itemAt(ahead.x, ahead.y) || itemAt(state.x, state.y);
        const trap = trapAt(ahead.x, ahead.y) || trapAt(state.x, state.y);
        const decor = decorAt(ahead.x, ahead.y) || decorAt(state.x, state.y);
        const stairs = stairsAt(ahead.x, ahead.y) || stairsAt(state.x, state.y);
        if (monster) {
          setMessage(`${monster.name}: ${monster.hp}/${monster.maxHp} HP, AC ${monster.ac}, EV ${monster.ev}.`);
        } else if (trap) {
          setMessage(`${trap.name}: ${trap.kind} ${trap.power}.`);
        } else if (item) {
          setMessage(`${item.name}: ${item.kind}${item.power ? ` ${item.power}` : ""}${item.value ? ` worth ${item.value}g` : ""}.`);
        } else if (decor) {
          setMessage(`${decor.name}: ${decor.kind}${decorUsed(decor) ? " (spent)" : ""}.`);
        } else if (stairs) {
          setMessage(`${stairs.direction === "down" ? "Downstairs" : "Upstairs"}.`);
        } else {
          setMessage("Nothing of note ahead.");
        }
      }


      function doorTarget() {
        const forward = dirAt(0);
        const x = state.x + forward.x;
        const y = state.y + forward.y;
        return doorCellAt(x, y) ? { x, y } : null;
      }


      function interactDoor() {
        const door = doorTarget();
        if (!door) return false;
        if (closedDoorAt(door.x, door.y)) {
          openDoor(door.x, door.y);
          return true;
        }
        closeDoor(door.x, door.y);
        return true;
      }


      function trapTarget() {
        const here = trapAt(state.x, state.y);
        if (here) return here;
        const forward = dirAt(0);
        const baseReach = typeof classDisarmReach === "function" ? classDisarmReach() : 1;
        const talentReach = typeof talentExtraDisarmReach === "function" ? talentExtraDisarmReach() : 0;
        const reach = baseReach + talentReach;
        for (let depth = 1; depth <= reach; depth += 1) {
          const t = trapAt(state.x + forward.x * depth, state.y + forward.y * depth);
          if (t) return t;
        }
        return null;
      }


      function disarmTrapTarget() {
        const trap = trapTarget();
        if (!trap) {
          setMessage("No armed trap is close enough.");
          return;
        }
        trap.armed = false;
        state.trapsDisarmed = (state.trapsDisarmed || 0) + 1;
        currentFloorState().discovered.add(keyOf(trap.x, trap.y));
        addEffect("impact", [{ x: trap.x, y: trap.y }]);
        state.message = `${trap.name} is disarmed.`;
        advanceTurn();
        render();
      }


      function interactTrap() {
        if (!trapTarget()) return false;
        disarmTrapTarget();
        return true;
      }


      function pickupCurrentItem() {
        if (!collectFloorItem()) {
          setMessage("Nothing lies at the party's feet.");
          return;
        }
        advanceTurn();
        render();
      }


      function interactItem() {
        if (!itemAt(state.x, state.y)) return false;
        pickupCurrentItem();
        return true;
      }


      function interact() {
        if (interactItem()) return;
        if (stairsAt(state.x, state.y)) {
          useStairs();
          return;
        }
        if (interactTrap()) return;
        if (interactFixture()) return;
        if (interactDoor()) return;
        setMessage("Nothing here answers.");
      }

      Object.assign(context, {
        examineMode,
        doorTarget,
        interactDoor,
        trapTarget,
        disarmTrapTarget,
        interactTrap,
        pickupCurrentItem,
        interactItem,
        interact,
      });
    }
  };
}());
