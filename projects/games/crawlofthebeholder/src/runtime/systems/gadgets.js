(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Gadgets: five new deployable item types extending the engineering system
  // with more exotic tactical options — smoke canisters, shock plates, stasis
  // pods, flare guns, and rope darts. Registered as purchasable items and
  // processed by a dedicated tickGadgets turn hook.
  window.CotBRuntime.installGadgets = function (context) {
    with (context) {
      const GADGET_DEFS = [
        { id: "gadget-smoke",   name: "smoke canister",  kind: "gadget", gadgetKind: "smoke",   turns: 8,  radius: 2, value: 12,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/canister.png" },
        { id: "gadget-shock",   name: "shock plate",     kind: "gadget", gadgetKind: "shock",   power: 14, value: 15,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/shock.png" },
        { id: "gadget-stasis",  name: "stasis pod",      kind: "gadget", gadgetKind: "stasis",  frozenTurns: 5, value: 18,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/stasis.png" },
        { id: "gadget-flare",   name: "flare gun",       kind: "gadget", gadgetKind: "flare",   radius: 3, turns: 6, value: 10,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/flare.png" },
        { id: "gadget-ropedart", name: "rope dart",      kind: "gadget", gadgetKind: "ropedart", range: 4, value: 14,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/net.png" }
      ];

      // Register gadgets as purchasable (idempotent).
      (function registerGadgets() {
        for (const tpl of GADGET_DEFS) {
          if (!resources.inventory.some((i) => i.id === tpl.id)) {
            resources.inventory.push({ ...tpl });
          }
        }
      }());

      function gadgetList() {
        const fs = currentFloorState();
        if (!fs.gadgets) fs.gadgets = [];
        return fs.gadgets;
      }

      // Deploy a gadget at the cell ahead (or a specified cell).
      function deployGadget(item, messages, options = {}) {
        const step = dirs[state.dir];
        const tx = options.cell ? options.cell.x : state.x + step.x;
        const ty = options.cell ? options.cell.y : state.y + step.y;
        const floorState = currentFloorState();

        if (!mapContains(tx, ty)) { messages.push("No room ahead."); return false; }

        const gadgetKind = item.gadgetKind || item.kind;

        // Rope dart: immediately pull nearest monster in line toward party.
        if (gadgetKind === "ropedart") {
          const range = item.range || 4;
          let pulled = null;
          for (let depth = 1; depth <= range; depth += 1) {
            const lx = state.x + step.x * depth;
            const ly = state.y + step.y * depth;
            if (solidAt(lx, ly)) break;
            const m = floorState.monsters.find((m) => m.hp > 0 && m.x === lx && m.y === ly);
            if (m) { pulled = m; break; }
          }
          if (!pulled) { messages.push("Rope dart finds no target."); return false; }
          // Pull to the adjacent tile.
          const px = state.x + step.x;
          const py = state.y + step.y;
          if (!solidAt(px, py) && !monsterAt(px, py)) { pulled.x = px; pulled.y = py; }
          pulled.alerted = true;
          messages.push(`Rope dart yanks the ${pulled.name} close!`);
          return true;
        }

        if (solidAt(tx, ty) || monsterAt(tx, ty)) { messages.push("Can't place gadget there."); return false; }

        // Flare gun: instantly startle monsters and add a light source.
        if (gadgetKind === "flare") {
          const radius = item.radius || 3;
          let startled = 0;
          for (const m of floorState.monsters.filter((m) => m.hp > 0)) {
            if (Math.abs(m.x - tx) <= radius && Math.abs(m.y - ty) <= radius) {
              m.alerted = true;
              m.fearTurns = Math.max(m.fearTurns || 0, item.turns || 3);
              startled += 1;
            }
          }
          // Reveal the area.
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              if (mapContains(tx + dx, ty + dy)) floorState.discovered.add(keyOf(tx + dx, ty + dy));
            }
          }
          messages.push(startled > 0 ? `Flare blinds ${startled} creature${startled === 1 ? "" : "s"}!` : "Flare illuminates the area.");
          return true;
        }

        // Placed gadgets go on the floor and are checked each turn.
        const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
        const placed = { ...item, id: `gadget-placed-${serial}`, x: tx, y: ty };
        if (gadgetKind === "smoke") {
          // Immediately create a fog cloud.
          if (!floorState.clouds) floorState.clouds = [];
          floorState.clouds = floorState.clouds.filter((c) => !(c.x === tx && c.y === ty));
          floorState.clouds.push({ x: tx, y: ty, kind: "fog", turns: item.turns || 8 });
          messages.push("Smoke canister hisses — vision obscured!");
          return true;
        }
        gadgetList().push(placed);
        messages.push(`${item.name} planted.`);
        return true;
      }

      // Per-turn upkeep for placed gadgets (shock plate, stasis pod).
      function tickGadgets(messages) {
        const list = gadgetList();
        if (list.length === 0) return false;
        const floorState = currentFloorState();
        const spent = [];
        for (const gadget of list) {
          const m = floorState.monsters.find((m) => m.hp > 0 && m.x === gadget.x && m.y === gadget.y);
          if (!m) continue;
          if (gadget.gadgetKind === "shock") {
            const dmg = Math.max(1, (gadget.power || 14) - (m.ac || 0) / 4);
            m.hp = Math.max(0, m.hp - Math.round(dmg));
            messages.push(`Shock plate zaps ${m.name} for ${Math.round(dmg)}!`);
            spent.push(gadget);
          } else if (gadget.gadgetKind === "stasis") {
            m.frozenTurns = Math.max(m.frozenTurns || 0, gadget.frozenTurns || 5);
            messages.push(`Stasis pod locks ${m.name} in place!`);
            spent.push(gadget);
          }
        }
        currentFloorState().gadgets = list.filter((g) => !spent.includes(g));
        return false;
      }

      turnHooks.push(tickGadgets);

      context.deployGadget  = deployGadget;
      context.tickGadgets   = tickGadgets;
      context.GADGET_DEFS   = GADGET_DEFS;
    }
  };
}());
