(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Exploration & world features: teleport portals, pressure plates wired to
  // doors, collapsing-floor pits, and hidden loot caches (revealed by treasure
  // maps). Triggers fire from a turn hook once the party is standing on a
  // feature; the hook is inert on floors that have none. Auto-seeding of
  // features is gated behind context.worldFeaturesDisabled so floor snapshots
  // stay stable in tests (opt-in via { world: true }).
  window.CotBRuntime.installExploration = function (context) {
    with (context) {
      const TREASURE_MAP_ITEM = { id: "treasure-map", name: "tattered treasure map", shortName: "map", kind: "treasure_map", power: 0, weight: 0, tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/i-magic-mapping.png" };

      (function registerItems() {
        if (!resources.inventory.some((item) => item.kind === "treasure_map")) {
          resources.inventory.push({ ...TREASURE_MAP_ITEM });
        }
      }());

      function portals() { const fs = currentFloorState(); if (!fs.portals) fs.portals = []; return fs.portals; }
      function plates() { const fs = currentFloorState(); if (!fs.plates) fs.plates = []; return fs.plates; }
      function pits() { const fs = currentFloorState(); if (!fs.pits) fs.pits = []; return fs.pits; }
      function caches() { const fs = currentFloorState(); if (!fs.caches) fs.caches = []; return fs.caches; }

      function addPortalPair(a, b) {
        const list = portals();
        list.push({ x: a.x, y: a.y, partnerX: b.x, partnerY: b.y });
        list.push({ x: b.x, y: b.y, partnerX: a.x, partnerY: a.y });
        return list;
      }

      function addPressurePlate(spec) {
        const plate = { x: spec.x, y: spec.y, doorX: spec.doorX, doorY: spec.doorY, pressed: false, momentary: !!spec.momentary };
        plates().push(plate);
        return plate;
      }

      function addPit(spec) {
        const pit = { x: spec.x, y: spec.y, to: Number.isInteger(spec.to) ? spec.to : state.floorIndex + 1, used: false };
        pits().push(pit);
        return pit;
      }

      function addCache(spec) {
        const cache = { x: spec.x, y: spec.y, gold: spec.gold, item: spec.item || null, found: false, revealed: !!spec.revealed };
        caches().push(cache);
        return cache;
      }

      function openCache(cache, messages = []) {
        if (!cache || cache.found) return null;
        cache.found = true;
        const gold = Number.isFinite(cache.gold) ? cache.gold : 20 + (state.floorIndex || 0) * 10;
        state.gold = (state.gold || 0) + gold;
        state.goldEarned = (state.goldEarned || 0) + gold;
        let itemName = null;
        if (cache.item) {
          state.lootSerial = (state.lootSerial || 0) + 1;
          const item = { ...cache.item, id: `cache-${state.floorIndex}-${state.lootSerial}` };
          state.inventory.push(item);
          itemName = item.name;
        }
        if (typeof addFloorMark === "function") addFloorMark("loot", cache.x, cache.y, 1);
        messages.push(itemName
          ? `A hidden cache yields ${gold} gold and ${itemName}!`
          : `A hidden cache yields ${gold} gold!`);
        return { gold, itemName };
      }

      // Treasure map: mark every cache on the floor without collecting them.
      function revealCaches() {
        let revealed = 0;
        for (const cache of caches()) {
          if (cache.found) continue;
          cache.revealed = true;
          revealed += 1;
          currentFloorState().discovered.add(keyOf(cache.x, cache.y));
          if (typeof addFloorMark === "function") addFloorMark("loot", cache.x, cache.y, 1);
        }
        return revealed;
      }

      function useTreasureMap(item) {
        const revealed = revealCaches();
        removeInventoryItem(item);
        state.message = revealed > 0
          ? `The map reveals ${revealed} hidden cache${revealed === 1 ? "" : "s"} on this floor.`
          : "The map shows no caches on this floor.";
        advanceTurn();
        render();
      }

      function openCells() {
        const floor = currentFloor();
        const cells = [];
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            if (terrainAt(x, y) !== "floor" || solidAt(x, y) || closedDoorAt(x, y)) continue;
            if (x === state.x && y === state.y) continue;
            if (stairsAt(x, y)) continue;
            cells.push({ x, y });
          }
        }
        return cells;
      }

      // One hidden cache per floor (deterministic placement) plus a collapsing
      // pit on deeper floors. Only runs in the live game; opt-in for tests.
      function ensureWorldFeatures() {
        if (context.worldFeaturesDisabled) return false;
        const fs = currentFloorState();
        if (fs.worldSeeded) return false;
        fs.worldSeeded = true;
        const cells = openCells();
        if (cells.length === 0) return false;
        const pick = (offset) => cells[(Math.floor(Math.random() * cells.length) + offset) % cells.length];
        addCache({ x: pick(0).x, y: pick(0).y, gold: 25 + (state.floorIndex || 0) * 12 });
        // A pit on deeper, non-final floors gives a risky shortcut down.
        if (state.floorIndex >= 2 && state.floorIndex < resources.floors.length - 1 && cells.length > 4) {
          const spot = pick(3);
          addPit({ x: spot.x, y: spot.y });
        }
        return true;
      }

      function runWorldTriggers(messages) {
        ensureWorldFeatures();
        const fs = currentFloorState();

        // Teleport portals. The destination is "anchored" so the party doesn't
        // immediately bounce back; the anchor clears once they step off.
        const portal = (fs.portals || []).find((p) => p.x === state.x && p.y === state.y);
        if (portal) {
          if (state.portalAnchorKey !== keyOf(portal.x, portal.y)) {
            state.x = portal.partnerX;
            state.y = portal.partnerY;
            state.portalAnchorKey = keyOf(portal.partnerX, portal.partnerY);
            if (typeof reveal === "function") reveal();
            if (typeof addEffect === "function") addEffect("magic", [{ x: state.x, y: state.y }]);
            messages.push("The party steps through a shimmering portal.");
          }
        } else {
          state.portalAnchorKey = null;
        }

        // Pressure plates open (or, if momentary, hold open) a linked door.
        for (const plate of fs.plates || []) {
          const standing = state.x === plate.x && state.y === plate.y;
          if (standing && !plate.pressed) {
            plate.pressed = true;
            fs.openedDoors.add(keyOf(plate.doorX, plate.doorY));
            messages.push("A pressure plate clicks; a door grinds open.");
          } else if (!standing && plate.pressed && plate.momentary) {
            plate.pressed = false;
            fs.openedDoors.delete(keyOf(plate.doorX, plate.doorY));
            messages.push("The pressure plate rises; the door swings shut.");
          }
        }

        // Collapsing-floor pit: drop to a lower level.
        const pit = (fs.pits || []).find((p) => p.x === state.x && p.y === state.y && !p.used);
        if (pit) {
          pit.used = true;
          const to = pit.to;
          if (to >= 0 && to < resources.floors.length && typeof changeFloor === "function") {
            messages.push("The floor gives way — the party tumbles to the level below!");
            changeFloor(to, "down");
            return false;
          }
        }

        // Loot caches are found by standing on them.
        const cache = (fs.caches || []).find((c) => c.x === state.x && c.y === state.y && !c.found);
        if (cache) openCache(cache, messages);
        return false;
      }

      if (Array.isArray(turnHooks)) turnHooks.push(runWorldTriggers);

      Object.assign(context, {
        TREASURE_MAP_ITEM,
        addPortalPair,
        addPressurePlate,
        addPit,
        addCache,
        openCache,
        revealCaches,
        useTreasureMap,
        ensureWorldFeatures,
        runWorldTriggers
      });
    }
  };
}());
