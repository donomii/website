(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installMessagesAndVisibility = function (context) {
    with (context) {
      function hasPrize() {
        return state.inventory.some((item) => item.kind === "quest");
      }

      function percent(value, max) {
        return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
      }

      function setMessage(message) {
        state.message = message;
        renderChrome();
      }

      function rememberMessage() {
        if (!state.message || state.message === state.lastLoggedMessage) return;
        state.lastLoggedMessage = state.message;
        state.messageLog.unshift(state.message);
        state.messageLog = state.messageLog.slice(0, 30);
      }

      function torchRadius() {
        // Base radius 3; torches add 1 each (Astral Sight talent adds 1).
        let radius = 3;
        const hasTorch = state.inventory.some((item) => item?.kind === "torch");
        if (hasTorch) radius += 1;
        const astral = state.talents && state.talents["mage:astralsight"];
        if (astral) radius += astral;
        if (typeof hazardVisionDelta === "function") radius += hazardVisionDelta();
        return Math.max(2, radius);
      }

      function reveal() {
        const floorState = currentFloorState();
        const radius = torchRadius();
        for (let yy = state.y - radius; yy <= state.y + radius; yy += 1) {
          for (let xx = state.x - radius; xx <= state.x + radius; xx += 1) {
            if (Math.abs(xx - state.x) + Math.abs(yy - state.y) <= radius + 1) {
              floorState.discovered.add(keyOf(xx, yy));
            }
          }
        }

        const sightDepth = Math.max(5, radius + 2);
        for (let depth = 1; depth <= sightDepth; depth += 1) {
          const forward = dirAt(0);
          const x = state.x + forward.x * depth;
          const y = state.y + forward.y * depth;
          floorState.discovered.add(keyOf(x, y));
          floorState.discovered.add(keyOf(x + dirAt(-1).x, y + dirAt(-1).y));
          floorState.discovered.add(keyOf(x + dirAt(1).x, y + dirAt(1).y));
          if (solidAt(x, y)) break;
        }
      }

      function revealAll() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            floorState.discovered.add(keyOf(x, y));
          }
        }
      }

      function explorableCellCount() {
        const floor = currentFloor();
        let count = 0;
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            const cell = floor.map.rows[y]?.[x] || " ";
            if (cell !== " " && cell !== "x" && cell !== "H") count += 1;
          }
        }
        return count;
      }

      function discoveredFloorCount() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        let count = 0;
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            const cell = floor.map.rows[y]?.[x] || " ";
            if (cell === " " || cell === "x" || cell === "H") continue;
            if (floorState.discovered.has(keyOf(x, y))) count += 1;
          }
        }
        return count;
      }

      function floorExploredPercent() {
        const total = explorableCellCount();
        if (total === 0) return 100;
        return Math.min(100, Math.round((discoveredFloorCount() / total) * 100));
      }

      function itemRarity(item) {
        if (!item) return "common";
        if (item.rarity) return item.rarity;
        if (item.kind === "quest") return "legendary";
        const power = Math.max(item.power || 0, item.value || 0);
        if (power >= 10) return "rare";
        if (power >= 5) return "uncommon";
        return "common";
      }

      function itemValue(item) {
        if (!item) return 0;
        if (item.kind === "gold") return item.value || 1;
        if (item.kind === "quest") return 9999;
        const power = (item.power || 0) + (item.charges || 0) * 2;
        if (item.kind === "weapon" || item.kind === "armour") return 15 + power * 4;
        if (item.kind === "talisman" || item.kind === "amulet" || item.kind === "ring") return 24 + power * 5;
        if (item.kind === "wand") return 18 + power * 3;
        if (item.kind === "evocable") return 30 + power * 3;
        if (item.kind === "throwable") return 4 + power;
        return 6 + power * 2;
      }

      function inventorySortComparator(mode) {
        if (mode === "alpha") return (a, b) => a.name.localeCompare(b.name);
        if (mode === "value") return (a, b) => itemValue(b) - itemValue(a);
        if (mode === "kind") return (a, b) => (a.kind || "").localeCompare(b.kind || "") || a.name.localeCompare(b.name);
        return null;
      }

      function visibleInventory() {
        const filter = state.inventoryFilter || "all";
        let items = state.inventory.filter((item) => {
          if (filter === "all") return true;
          if (filter === "consumables") return ["healing", "mapping", "might", "resistance", "haste", "blink", "teleport", "fear", "fog", "poison", "immolation", "silence"].includes(item.kind);
          if (filter === "weapons") return item.kind === "weapon";
          if (filter === "armour") return item.kind === "armour" || item.kind === "talisman" || item.kind === "ring" || item.kind === "amulet";
          if (filter === "magic") return ["wand", "evocable", "throwable"].includes(item.kind);
          return true;
        });
        const sortMode = state.inventorySort || "default";
        const comparator = inventorySortComparator(sortMode);
        if (comparator) items = [...items].sort(comparator);
        return items;
      }

      function cycleInventorySort() {
        const order = ["default", "kind", "alpha", "value"];
        const next = order[(order.indexOf(state.inventorySort || "default") + 1) % order.length];
        state.inventorySort = next;
        return next;
      }

      function cycleInventoryFilter() {
        const order = ["all", "consumables", "weapons", "armour", "magic"];
        const next = order[(order.indexOf(state.inventoryFilter || "all") + 1) % order.length];
        state.inventoryFilter = next;
        return next;
      }

      function distanceToPlayer(actor) {
        return Math.abs(actor.x - state.x) + Math.abs(actor.y - state.y);
      }

      function relativeBearing(point) {
        const dx = point.x - state.x;
        const dy = point.y - state.y;
        if (dx === 0 && dy === 0) return "here";

        const forward = dirAt(0);
        const left = dirAt(-1);
        const forwardScore = dx * forward.x + dy * forward.y;
        const leftScore = dx * left.x + dy * left.y;
        if (Math.abs(forwardScore) >= Math.abs(leftScore)) return forwardScore > 0 ? "front" : "back";
        return leftScore > 0 ? "left" : "right";
      }

      function visibleFeatures() {
        const floorState = currentFloorState();
        const floor = currentFloor();
        const features = [];

        for (const monster of floorState.monsters) {
          if (!floorState.discovered.has(keyOf(monster.x, monster.y))) continue;
          const ranged = monster.ranged && rangedCanTargetPlayer(monster);
          const details = [`${monster.hp}/${monster.maxHp}`];
          if (monster.fearTurns > 0) details.push("afraid");
          if (monster.rootedTurns > 0) details.push("rooted");
          if (monster.poisonedTurns > 0) details.push("poisoned");
          if (monster.immolationTurns > 0) details.push("inner flame");
          if (monster.hasteTurns > 0) details.push("hasted");
          if (monster.mightTurns > 0) details.push("might");
          if (monster.rageTurns > 0) details.push("rage");
          if (monster.summoned) details.push("summoned");
          if (monster.traits?.airborne) details.push("airborne");
          if (monster.traits?.maintainRange) details.push("keeps range");
          if (monster.speed !== 10) details.push(`spd ${monster.speed}`);
          if (monster.ranged) details.push(state.silenceTurns > 0 ? "silenced" : monster.ranged.name);
          if (monster.ranged?.element) details.push(monster.ranged.element);
          if (monster.ranged?.cloud) details.push(`${monster.ranged.cloud} cloud`);
          if (monster.ranged?.status) details.push(monster.ranged.status);
          details.push(...supportSpellLabels(monster));
          details.push(...mobilitySpellLabels(monster));
          details.push(...selfSpellLabels(monster));
          details.push(...summonSpellLabels(monster));
          if (monster.traits?.drainDamage) details.push("drain");
          if (monster.traits?.blinkWith) details.push("blink");
          if (monster.traits?.poisonTurns) details.push("poison");
          if (monster.traits?.snareTurns) details.push("pin");
          if (monster.traits?.electricDamage) details.push("elec");
          if (monster.traits?.electricDamage) details.push("discharge");
          if (monster.traits?.confuseTurns) details.push("confuse");
          if (monster.traits?.acidDamage) details.push("acid");
          if (monster.traits?.fireDamage) details.push("fire");
          if (monster.traits?.coldDamage) details.push("cold");
          if (monster.traits?.vampiricDamage) details.push("vampiric");
          if (monster.traits?.reachDamage) details.push("reach");
          if (monster.traits?.dragDamage) details.push("drag");
          if (monster.traits?.floodTurns) details.push("engulf");
          if (monster.traits?.drownDamage) details.push("drown");
          if (monster.traits?.rageTurns) details.push("rage");
          if (monster.traits?.paralyseTurns) details.push("paralyse");
          if (monster.traits?.barbedTurns) details.push("barbs");
          details.push(...monsterResistanceLabels(monster));
          const habitat = monsterHabitatLabel(monster);
          if (habitat) details.push(habitat);
          const detail = details.join(" · ");
          features.push({ type: "monster", name: monster.name, distance: distanceToPlayer(monster), bearing: relativeBearing(monster), detail, danger: (monster.fearTurns || 0) <= 0 && (monster.rootedTurns || 0) <= 0, ranged: state.silenceTurns <= 0 && ranged });
        }

        for (const item of floorState.floorItems) {
          if (!floorState.discovered.has(keyOf(item.x, item.y))) continue;
          const type = item.kind === "quest" ? "prize" : item.kind === "gold" ? "gold" : "item";
          const detail = item.kind === "quest" ? "prize" : item.kind === "gold" ? "gold" : "item";
          features.push({ type, name: item.name, distance: distanceToPlayer(item), bearing: relativeBearing(item), detail });
        }

        for (const trap of floorState.traps) {
          if (!trap.armed || !floorState.discovered.has(keyOf(trap.x, trap.y))) continue;
          features.push({ type: "trap", name: trap.name, distance: distanceToPlayer(trap), bearing: relativeBearing(trap), detail: `${trap.kind} ${trap.power}` });
        }

        for (const cloud of floorState.clouds) {
          if (!floorState.discovered.has(keyOf(cloud.x, cloud.y))) continue;
          const kind = cloud.kind || "fog";
          const name = kind === "poison" ? "poison cloud" : kind === "petrify" ? "petrifying cloud" : kind === "flame" ? "flaming cloud" : "fog bank";
          features.push({ type: "cloud", name, distance: distanceToPlayer(cloud), bearing: relativeBearing(cloud), detail: `${cloud.turns}` });
        }

        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            if (!floorState.discovered.has(keyOf(x, y)) || !doorCellAt(x, y)) continue;
            const closed = closedDoorAt(x, y);
            features.push({ type: "door", name: closed ? "closed door" : "open door", distance: distanceToPlayer({ x, y }), bearing: relativeBearing({ x, y }), detail: closed ? "closed" : "open" });
          }
        }

        for (const stair of Object.values(floor.stairs).filter(Boolean)) {
          if (!floorState.discovered.has(keyOf(stair.x, stair.y))) continue;
          const direction = stairsAt(stair.x, stair.y)?.direction || "up";
          features.push({ type: "stairs", name: direction === "down" ? "downstairs" : "upstairs", distance: distanceToPlayer(stair), bearing: relativeBearing(stair), detail: direction });
        }

        for (const decor of floor.decor || []) {
          if (!floorState.discovered.has(keyOf(decor.x, decor.y))) continue;
          features.push({ type: "decor", name: decor.name, distance: distanceToPlayer(decor), bearing: relativeBearing(decor), detail: decorUsed(decor) ? "spent" : decor.kind });
        }

        return features.sort((a, b) => a.distance - b.distance || Number(b.danger) - Number(a.danger)).slice(0, 4);
      }

      Object.assign(context, {
        hasPrize,
        percent,
        setMessage,
        rememberMessage,
        torchRadius,
        reveal,
        revealAll,
        explorableCellCount,
        discoveredFloorCount,
        floorExploredPercent,
        itemRarity,
        itemValue,
        inventorySortComparator,
        visibleInventory,
        cycleInventorySort,
        cycleInventoryFilter,
        distanceToPlayer,
        relativeBearing,
        visibleFeatures,
      });
    }
  };
}());
