(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Locked doors — a deterministic quarter of each floor's doors are locked.
  // An iron key opens one instantly (consumed); without one the party can
  // shoulder-bash, which costs the turn and may fail. Keys are seeded onto
  // floors that have locked doors, so no route is ever sealed for good.
  window.CotBRuntime.installLocks = function installLocks(context) {
    with (context) {
      const KEY_TILE = "vendor/crawl/crawl-ref/source/rltiles/item/misc/misc_voucher.png";
      const LOCK_SALT = 71;
      const LOCK_RATE = 4; // 1 in 4 doors

      function floorDoorKeys() {
        const floor = currentFloor();
        const doorKeys = new Set(floor.doors || []);
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            if (cellAt(x, y) === "+") doorKeys.add(keyOf(x, y));
          }
        }
        return doorKeys;
      }

      function seedKeysFor(lockedCount) {
        const floorState = currentFloorState();
        const floor = currentFloor();
        const open = [];
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            if (cellAt(x, y) !== ".") continue;
            if (floorState.floorItems.some((item) => item.x === x && item.y === y)) continue;
            if (x === state.x && y === state.y) continue;
            open.push({ x, y });
          }
        }
        const keys = Math.max(1, Math.ceil(lockedCount / 2));
        for (let index = 0; index < keys && open.length > 0; index += 1) {
          const pick = cellHash(index + 1, state.floorIndex, 73) % open.length;
          const cell = open.splice(pick, 1)[0];
          floorState.floorItems.push({
            id: `door-key-${state.floorIndex}-${index}`,
            name: "iron key", shortName: "key", kind: "door-key",
            value: 10, weight: 0, tile: KEY_TILE, x: cell.x, y: cell.y
          });
        }
      }

      function lockedDoorSet() {
        const floorState = currentFloorState();
        if (!floorState.lockedDoors) {
          const set = new Set();
          for (const key of floorDoorKeys()) {
            const [x, y] = key.split(",").map(Number);
            if (cellHash(x, y, LOCK_SALT) % LOCK_RATE === 0) set.add(key);
          }
          floorState.lockedDoors = set;
          if (set.size > 0) seedKeysFor(set.size);
        }
        return floorState.lockedDoors;
      }

      function doorLocked(x, y) {
        if (context.locksDisabled) return false;
        return closedDoorAt(x, y) && lockedDoorSet().has(keyOf(x, y));
      }

      // Called from openDoor: true blocks the door from opening this turn.
      function doorLockBlocks(x, y) {
        if (!doorLocked(x, y)) return false;
        const key = state.inventory.find((item) => item.kind === "door-key");
        if (key) {
          state.inventory = state.inventory.filter((item) => item !== key);
          lockedDoorSet().delete(keyOf(x, y));
          state.message = "The iron key grinds the lock open.";
          return false; // proceed to open
        }
        const leader = liveMember();
        const might = (leader ? leader.power : 4) + (state.mightTurns > 0 ? 3 : 0);
        if (Math.random() < Math.min(0.8, 0.25 + might * 0.04)) {
          lockedDoorSet().delete(keyOf(x, y));
          state.message = "The lock splinters under a heavy shoulder!";
          return false;
        }
        if (typeof pulse === "function") pulse("bump", { x, y });
        state.message = "The door is locked — the bash glances off. An iron key would help.";
        advanceTurn();
        render();
        return true;
      }

      Object.assign(context, { lockedDoorSet, doorLocked, doorLockBlocks });
    }
  };
}());
