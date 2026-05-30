(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Field engineering: deployable gadgets the party places on the floor —
  // barricades, caltrops, timed bombs, decoy beacons, tripwires, and folding
  // bridges. Each is an inventory item handled by useItem; the per-turn upkeep
  // is registered as a turn hook and is inert until something is deployed.
  window.CotBRuntime.installEngineering = function (context) {
    with (context) {
      const ENGINEERING_ITEMS = [
        { id: "eng-barricade", name: "barricade kit", shortName: "wall", kind: "barricade", power: 0, turns: 12, weight: 3, tile: "vendor/crawl/crawl-ref/source/rltiles/dngn/wall/brick_brown0.png" },
        { id: "eng-caltrops", name: "bag of caltrops", shortName: "caltrops", kind: "caltrops", power: 6, turns: 10, radius: 1, weight: 2, tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/caltrops.png" },
        { id: "eng-bomb", name: "timed bomb", shortName: "bomb", kind: "bomb", power: 14, fuse: 3, weight: 2, tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/bomb.png" },
        { id: "eng-decoy", name: "decoy beacon", shortName: "decoy", kind: "decoy", power: 0, turns: 8, radius: 3, weight: 2, tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/horn.png" },
        { id: "eng-tripwire", name: "tripwire snare", shortName: "wire", kind: "tripwire", power: 0, weight: 1, tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/net.png" },
        { id: "eng-bridge", name: "folding bridge", shortName: "bridge", kind: "bridge", power: 0, weight: 3, tile: "vendor/crawl/crawl-ref/source/rltiles/dngn/floor/grey_dirt0.png" }
      ];
      const ENGINEERING_KINDS = new Set(ENGINEERING_ITEMS.map((item) => item.kind));

      // Make the gadgets purchasable: append templates to the shared item pool
      // (used by shops / drops). Idempotent so it survives re-installs.
      (function registerEngineeringItems() {
        for (const template of ENGINEERING_ITEMS) {
          if (!resources.inventory.some((item) => item.kind === template.kind)) {
            resources.inventory.push({ ...template });
          }
        }
      }());

      function deployables() {
        const floorState = currentFloorState();
        if (!floorState.deployables) floorState.deployables = [];
        return floorState.deployables;
      }

      function barricadeSet() {
        const floorState = currentFloorState();
        if (!floorState.barricades) floorState.barricades = new Set();
        return floorState.barricades;
      }

      function bridgeSet() {
        const floorState = currentFloorState();
        if (!floorState.bridges) floorState.bridges = new Set();
        return floorState.bridges;
      }

      function cellAhead() {
        const step = dirs[state.dir];
        return { x: state.x + step.x, y: state.y + step.y };
      }

      // A dry, empty, walkable tile fit for placing a gadget.
      function openForDeploy(x, y) {
        if (!mapContains(x, y)) return false;
        if (x === state.x && y === state.y) return false;
        if (closedDoorAt(x, y) || solidAt(x, y)) return false;
        if (terrainAt(x, y) !== "floor") return false;
        if (monsterAt(x, y) || allyAt(x, y)) return false;
        return true;
      }

      function deployBarricade(messages = [], opts = {}) {
        const cell = opts.cell || cellAhead();
        if (barricadeAt(cell.x, cell.y)) { messages.push("A barricade already blocks the way."); return null; }
        if (!openForDeploy(cell.x, cell.y)) { messages.push("There's no clear space ahead to wedge a barricade."); return null; }
        barricadeSet().add(keyOf(cell.x, cell.y));
        const dep = { kind: "barricade", x: cell.x, y: cell.y, turns: opts.turns || 12 };
        deployables().push(dep);
        messages.push("A barricade slams into place, blocking the path.");
        return dep;
      }

      function deployCaltrops(messages = [], opts = {}) {
        const center = opts.cell || cellAhead();
        const cells = cellsNear(center, opts.radius ?? 1).filter((cell) => terrainAt(cell.x, cell.y) === "floor");
        if (cells.length === 0) { messages.push("No open ground to scatter caltrops."); return null; }
        const dep = { kind: "caltrops", cells, turns: opts.turns || 10, power: opts.power || 6 };
        deployables().push(dep);
        for (const cell of cells) {
          if (typeof addFloorMark === "function") addFloorMark("hazard", cell.x, cell.y, 1);
        }
        messages.push(`Caltrops scatter across ${cells.length} tile${cells.length === 1 ? "" : "s"}.`);
        return dep;
      }

      function deployBomb(messages = [], opts = {}) {
        const cell = opts.cell || cellAhead();
        if (!openForDeploy(cell.x, cell.y)) { messages.push("No clear spot to set the bomb."); return null; }
        const dep = { kind: "bomb", x: cell.x, y: cell.y, fuse: opts.fuse ?? 3, power: opts.power || 14 };
        deployables().push(dep);
        messages.push(`A bomb is primed and ticking (${dep.fuse}).`);
        return dep;
      }

      function deployDecoy(messages = [], opts = {}) {
        const cell = opts.cell || cellAhead();
        if (!openForDeploy(cell.x, cell.y)) { messages.push("No clear spot for a decoy."); return null; }
        const dep = { kind: "decoy", x: cell.x, y: cell.y, turns: opts.turns || 8, radius: opts.radius || 3 };
        deployables().push(dep);
        messages.push("A decoy beacon clatters down, shrieking to bewilder nearby foes.");
        return dep;
      }

      function deployTripwire(messages = [], opts = {}) {
        const cell = opts.cell || cellAhead();
        if (!openForDeploy(cell.x, cell.y)) { messages.push("No clear span to string a tripwire."); return null; }
        const dep = { kind: "tripwire", x: cell.x, y: cell.y };
        deployables().push(dep);
        messages.push("A tripwire is strung taut across the way.");
        return dep;
      }

      function buildBridge(messages = [], opts = {}) {
        const cell = opts.cell || cellAhead();
        if (!mapContains(cell.x, cell.y)) { messages.push("There's nothing there to bridge."); return null; }
        if (bridgeSet().has(keyOf(cell.x, cell.y))) { messages.push("A bridge already spans this gap."); return null; }
        const raw = cellAt(cell.x, cell.y);
        if (raw !== "w" && raw !== "W" && raw !== "l") { messages.push("A bridge needs water or lava to span."); return null; }
        bridgeSet().add(keyOf(cell.x, cell.y));
        messages.push("A folding bridge clacks open across the gap.");
        return { kind: "bridge", x: cell.x, y: cell.y };
      }

      function detonateBomb(dep, messages) {
        const blast = cellsNear({ x: dep.x, y: dep.y }, 1);
        let hits = 0;
        for (const cell of blast) {
          const monster = monsterAt(cell.x, cell.y);
          if (monster && monster.hp > 0) {
            const damage = monsterElementDamage(monster, Math.max(2, dep.power), "fire");
            monster.hp = Math.max(0, monster.hp - damage);
            if (typeof addDamageMark === "function") addDamageMark(monster, "fire", damage);
            hits += 1;
            if (monster.hp === 0 && typeof killMonster === "function") {
              const note = killMonster(monster);
              if (note) messages.push(note);
            }
          }
          // Chain into environmental reactions (igniting gas, shattering ice).
          if (typeof reactionAt === "function") reactionAt(cell.x, cell.y, "fire", dep.power, messages);
        }
        if (Math.abs(state.x - dep.x) + Math.abs(state.y - dep.y) <= 1) {
          const target = liveMember();
          if (target) {
            const damage = partyElementDamage(Math.max(1, Math.ceil(dep.power / 2)), "fire");
            target.hp = Math.max(0, target.hp - damage);
            state.damageTaken = (state.damageTaken || 0) + damage;
            messages.push(`The blast catches ${target.name} for ${damage}.`);
            if (!liveMember()) {
              state.defeated = true;
              state.message = `${target.name} is caught in the blast.`;
            }
          }
        }
        if (typeof addEffect === "function") addEffect("flame", blast);
        if (typeof shakeViewport === "function") shakeViewport(2);
        messages.push(hits > 0
          ? `The bomb detonates, blasting ${hits} foe${hits === 1 ? "" : "s"}.`
          : "The bomb detonates in a gout of flame.");
      }

      function tickDeployables(messages) {
        const floorState = currentFloorState();
        const list = floorState.deployables;
        if (!list || list.length === 0) return false;
        const survivors = [];
        for (const dep of list) {
          if (dep.kind === "barricade") {
            dep.turns -= 1;
            if (dep.turns <= 0) {
              barricadeSet().delete(keyOf(dep.x, dep.y));
              if (floorState.discovered.has(keyOf(dep.x, dep.y))) messages.push("A barricade splinters and collapses.");
            } else {
              survivors.push(dep);
            }
          } else if (dep.kind === "caltrops") {
            let hits = 0;
            for (const cell of dep.cells) {
              const monster = monsterAt(cell.x, cell.y);
              if (monster && monster.hp > 0) {
                const damage = monsterElementDamage(monster, Math.max(1, dep.power), null);
                monster.hp = Math.max(0, monster.hp - damage);
                monster.slowedTurns = Math.max(monster.slowedTurns || 0, 2);
                if (typeof addDamageMark === "function") addDamageMark(monster, null, damage);
                hits += 1;
                if (monster.hp === 0 && typeof killMonster === "function") {
                  const note = killMonster(monster);
                  if (note) messages.push(note);
                }
              }
            }
            if (hits > 0) messages.push(`Caltrops bite ${hits} foe${hits === 1 ? "" : "s"}.`);
            dep.turns -= 1;
            if (dep.turns > 0) survivors.push(dep);
          } else if (dep.kind === "bomb") {
            dep.fuse -= 1;
            if (dep.fuse <= 0) detonateBomb(dep, messages);
            else survivors.push(dep);
          } else if (dep.kind === "decoy") {
            let confused = 0;
            for (const monster of floorState.monsters) {
              if (monster.hp > 0 && Math.abs(monster.x - dep.x) + Math.abs(monster.y - dep.y) <= dep.radius) {
                monster.confusedTurns = Math.max(monster.confusedTurns || 0, 2);
                confused += 1;
              }
            }
            if (confused > 0 && floorState.discovered.has(keyOf(dep.x, dep.y))) {
              messages.push(`The decoy bewilders ${confused} foe${confused === 1 ? "" : "s"}.`);
            }
            dep.turns -= 1;
            if (dep.turns > 0) survivors.push(dep);
          } else if (dep.kind === "tripwire") {
            const monster = monsterAt(dep.x, dep.y);
            if (monster && monster.hp > 0) {
              monster.rootedTurns = Math.max(monster.rootedTurns || 0, 3);
              if (typeof addEffect === "function") addEffect("impact", [{ x: dep.x, y: dep.y }]);
              if (floorState.discovered.has(keyOf(dep.x, dep.y))) messages.push(`${monster.name} stumbles into a tripwire and is snared.`);
            } else {
              survivors.push(dep);
            }
          } else {
            survivors.push(dep);
          }
        }
        floorState.deployables = survivors;
        return false;
      }

      function isEngineeringItem(item) {
        return !!item && ENGINEERING_KINDS.has(item.kind);
      }

      // Dispatch a used engineering item to its deploy routine.
      function deployFromItem(item, messages = []) {
        if (item.kind === "barricade") return deployBarricade(messages, item);
        if (item.kind === "caltrops") return deployCaltrops(messages, item);
        if (item.kind === "bomb") return deployBomb(messages, item);
        if (item.kind === "decoy") return deployDecoy(messages, item);
        if (item.kind === "tripwire") return deployTripwire(messages, item);
        if (item.kind === "bridge") return buildBridge(messages, item);
        return null;
      }

      if (Array.isArray(turnHooks)) turnHooks.push(tickDeployables);

      Object.assign(context, {
        ENGINEERING_ITEMS,
        ENGINEERING_KINDS,
        deployBarricade,
        deployCaltrops,
        deployBomb,
        deployDecoy,
        deployTripwire,
        buildBridge,
        detonateBomb,
        tickDeployables,
        isEngineeringItem,
        deployFromItem
      });
    }
  };
}());
