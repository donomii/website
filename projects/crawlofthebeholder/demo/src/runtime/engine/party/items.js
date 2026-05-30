(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyItems = function (context) {
    with (context) {

      function teleportDestinations() {
        const floor = currentFloor();
        const cells = [];
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            if (x === state.x && y === state.y) continue;
            if (mapKind(x, y) !== "floor" || monsterAt(x, y) || trapAt(x, y)) continue;
            cells.push({ x, y });
          }
        }
        return cells;
      }


      function teleportParty() {
        const cells = teleportDestinations();
        if (cells.length === 0) return false;
        const landing = cells[Math.floor(Math.random() * cells.length)];
        state.x = landing.x;
        state.y = landing.y;
        reveal();
        return true;
      }


      function blinkDestinations() {
        const floor = currentFloor();
        const cells = [];
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            const range = Math.abs(x - state.x) + Math.abs(y - state.y);
            if (range < 1 || range > 4) continue;
            if (mapKind(x, y) !== "floor" || monsterAt(x, y) || trapAt(x, y)) continue;
            cells.push({ x, y, safety: nearestMonsterDistance({ x, y }) * 10 + range });
          }
        }
        cells.sort((a, b) => b.safety - a.safety);
        return cells;
      }


      function blinkParty() {
        const cells = blinkDestinations();
        if (cells.length === 0) return false;
        const bestSafety = cells[0].safety;
        const bestCells = cells.filter((cell) => cell.safety === bestSafety);
        const landing = bestCells[Math.floor(Math.random() * bestCells.length)];
        state.x = landing.x;
        state.y = landing.y;
        reveal();
        return true;
      }


      function fogCells() {
        const cells = [];
        for (let y = state.y - 2; y <= state.y + 2; y += 1) {
          for (let x = state.x - 2; x <= state.x + 2; x += 1) {
            if (Math.abs(x - state.x) + Math.abs(y - state.y) > 2) continue;
            if (mapKind(x, y) !== "floor") continue;
            cells.push({ x, y });
          }
        }
        return cells;
      }


      function cellsNear(point, range) {
        const cells = [];
        for (let y = point.y - range; y <= point.y + range; y += 1) {
          for (let x = point.x - range; x <= point.x + range; x += 1) {
            if (Math.abs(x - point.x) + Math.abs(y - point.y) > range) continue;
            if (mapKind(x, y) !== "floor") continue;
            cells.push({ x, y });
          }
        }
        return cells;
      }


      function uniqueCells(cells) {
        const seen = new Set();
        return cells.filter((cell) => {
          const key = keyOf(cell.x, cell.y);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }


      function spreadCloud(kind, turns, cells) {
        const floorState = currentFloorState();
        const unique = uniqueCells(cells);
        for (const cell of unique) {
          const cloud = cloudAt(cell.x, cell.y);
          if (cloud) {
            cloud.kind = kind;
            cloud.turns = Math.max(cloud.turns, turns);
          } else {
            floorState.clouds.push({ ...cell, kind, turns });
          }
          floorState.discovered.add(keyOf(cell.x, cell.y));
        }
        return unique.length;
      }


      function spreadFog(turns) {
        return spreadCloud("fog", turns, fogCells());
      }


      function poisonCells() {
        const floorState = currentFloorState();
        const targets = floorState.monsters.filter((monster) => monster.hp > 0 && floorState.discovered.has(keyOf(monster.x, monster.y)) && distanceToPlayer(monster) <= 7);
        if (targets.length === 0) return cellsNear(state, 2);
        return targets.flatMap((monster) => cellsNear(monster, 1));
      }


      function spreadPoison(turns) {
        return spreadCloud("poison", turns, poisonCells());
      }


      function consumeWandCharge(item) {
        item.charges = Math.max(0, (item.charges || 1) - 1);
        if (item.charges === 0) removeInventoryItem(item);
      }


      function consumeStackItem(item) {
        if (!item.charges) {
          removeInventoryItem(item);
          return;
        }
        item.charges = Math.max(0, item.charges - 1);
        if (item.charges === 0) removeInventoryItem(item);
      }


      function digTarget(range) {
        const forward = dirAt(0);
        for (let depth = 1; depth <= range; depth += 1) {
          const x = state.x + forward.x * depth;
          const y = state.y + forward.y * depth;
          if (!mapContains(x, y) || cellAt(x, y) === " ") return null;
          if (closedDoorAt(x, y)) return { x, y, kind: "door" };
          if (monsterAt(x, y)) return null;
          if ((cellAt(x, y) === "x" || cellAt(x, y) === "H") && x > 0 && y > 0 && x < currentFloor().map.width - 1 && y < currentFloor().map.height - 1) return { x, y, kind: "wall" };
        }
        return null;
      }


      function useDiggingWand(item) {
        const target = digTarget(5);
        if (!target) {
          setMessage(`${item.name} finds no diggable stone.`);
          return;
        }
        if (target.kind === "door") currentFloorState().openedDoors.add(keyOf(target.x, target.y));
        if (target.kind === "wall") setCellAt(target.x, target.y, ".");
        currentFloorState().discovered.add(keyOf(target.x, target.y));
        addEffect("impact", lineCells(state, target));
        consumeWandCharge(item);
        state.message = target.kind === "door" ? `${item.name} grinds the door open.` : `${item.name} drills a gap in the wall.`;
        advanceTurn();
        render();
      }


      function useCloudWand(item) {
        const clouds = item.name.includes("clouds") ? spreadPoison(6) : 0;
        if (clouds === 0) {
          setMessage(`${item.name} finds no air to fill.`);
          return;
        }
        addEffect("poison", poisonCells());
        consumeWandCharge(item);
        state.message = `${item.name} fills ${clouds} tiles with choking clouds.`;
        advanceTurn();
        render();
      }


      function throwableTargetShots(item) {
        const forward = dirAt(0);
        const shots = [];
        for (let depth = 1; depth <= (item.range || 4); depth += 1) {
          const x = state.x + forward.x * depth;
          const y = state.y + forward.y * depth;
          if (solidAt(x, y) || cloudBlocksLine(x, y)) break;
          const target = monsterAt(x, y);
          if (!target) continue;
          shots.push({ target, depth });
          if (!item.pierce) break;
        }
        return shots;
      }


      function throwableEffectKind(item) {
        if (item.effect) return item.effect;
        if (item.element === "poison") return "poison";
        return "impact";
      }


      function throwableStatusMessage(item, target) {
        if (item.status === "rooted") {
          target.rootedTurns = Math.max(target.rootedTurns || 0, item.statusTurns || 4);
          return `${target.name} is tangled.`;
        }
        if (item.status === "poisoned") {
          target.poisonedTurns = Math.max(target.poisonedTurns || 0, item.statusTurns || 4);
          target.poisonPower = Math.max(target.poisonPower || 0, item.poisonPower || 1);
          return `${target.name} is poisoned.`;
        }
        if (item.status === "afraid") {
          target.fearTurns = Math.max(target.fearTurns || 0, item.statusTurns || 2);
          return `${target.name} flinches back.`;
        }
        if (item.status === "slowed") {
          target.slowedTurns = Math.max(target.slowedTurns || 0, item.statusTurns || 4);
          return `${target.name} slows.`;
        }
        if (item.status === "weakened") {
          target.weakenedTurns = Math.max(target.weakenedTurns || 0, item.statusTurns || 4);
          return `${target.name} weakens.`;
        }
        if (item.status === "silenced") {
          target.silencedTurns = Math.max(target.silencedTurns || 0, item.statusTurns || 4);
          return `${target.name} cannot speak its spells.`;
        }
        if (item.status === "confused") {
          target.confusedTurns = Math.max(target.confusedTurns || 0, item.statusTurns || 4);
          return `${target.name} reels in confusion.`;
        }
        return "";
      }


      function throwableHitMessage(item, shot, baseDamage, damage, statusMessage) {
        const note = monsterDamageNote(baseDamage, damage);
        if (item.name.includes("net")) return `${item.name} wraps ${shot.target.name}.${statusMessage ? ` ${statusMessage}` : ""}`;
        if (item.name.includes("curare")) return `${item.name} strikes ${shot.target.name} for ${damage}.${note}${statusMessage ? ` ${statusMessage}` : ""}`;
        if (item.name.includes("javelin")) return `${item.name} skewers ${shot.target.name} for ${damage}.${note}`;
        if (damage === 0) return `${item.name} glances off ${shot.target.name}.`;
        return `${item.name} hits ${shot.target.name} for ${damage}.${note}${statusMessage ? ` ${statusMessage}` : ""}`;
      }


      function useThrowable(item) {
        const shots = throwableTargetShots(item);
        if (shots.length === 0) {
          setMessage(`${item.name} finds no target.`);
          return;
        }

        const baseDamage = Math.max(1, (item.power || 1) + Math.floor(Math.random() * (item.spread || 3)));
        const last = shots[shots.length - 1].target;
        const messages = [];
        addEffect(throwableEffectKind(item), lineCells(state, last));
        for (const shot of shots) {
          const shotBaseDamage = shot.depth === shots[0].depth ? baseDamage : Math.max(1, Math.ceil(baseDamage / 2));
          const damage = monsterElementDamage(shot.target, shotBaseDamage, item.element || null);
          shot.target.hp = Math.max(0, shot.target.hp - damage);
          addDamageMark(shot.target, item.element || null, damage);
          const canApplyStatus = shot.target.hp > 0 && (item.status !== "poisoned" || damage > 0);
          const statusMessage = canApplyStatus ? throwableStatusMessage(item, shot.target) : "";
          messages.push(throwableHitMessage(item, shot, shotBaseDamage, damage, statusMessage));
          if (shot.target.hp === 0) messages.push(killMonster(shot.target));
        }
        consumeStackItem(item);
        state.message = messages.filter(Boolean).join(" ");
        advanceTurn();
        render();
      }


      function evocableShot(item) {
        const shot = firstTargetInLine(item.range || 4);
        if (!shot) setMessage(`${item.name} finds no target.`);
        return shot;
      }


      function evocableDamageMessage(item, target, baseDamage, damage, verb) {
        return damage > 0 ? `${target.name} ${verb} for ${damage}.${monsterDamageNote(baseDamage, damage)}` : `${target.name} resists ${item.name}.`;
      }


      function useLightningRod(item) {
        const shot = evocableShot(item);
        if (!shot) return;
        const cells = areaCells(shot.target, item.radius || 1);
        const targets = monstersInCells(cells);
        const baseDamage = (item.power || 9) + Math.floor(Math.random() * 5);
        const messages = [];
        addEffect("smite", uniqueCells([...lineCells(state, shot.target), ...cells]));
        for (const target of targets) {
          const direct = target === shot.target;
          const targetBaseDamage = direct ? baseDamage : Math.max(1, Math.ceil(baseDamage / 2));
          const damage = monsterElementDamage(target, targetBaseDamage, "elec");
          target.hp = Math.max(0, target.hp - damage);
          addDamageMark(target, "elec", damage);
          messages.push(evocableDamageMessage(item, target, targetBaseDamage, damage, direct ? "is blasted" : "arcs"));
          if (target.hp === 0) messages.push(killMonster(target));
        }
        consumeStackItem(item);
        state.message = `${item.name} spits blue fire. ${messages.filter(Boolean).join(" ")}`.trim();
        advanceTurn();
        render();
      }


      function useTremorstones(item) {
        const shot = evocableShot(item);
        if (!shot) return;
        const cells = areaCells(shot.target, item.radius || 1);
        const targets = monstersInCells(cells);
        const baseDamage = (item.power || 8) + Math.floor(Math.random() * 4);
        const messages = [];
        addEffect("impact", uniqueCells([...lineCells(state, shot.target), ...cells]));
        for (const cell of cells) addFloorMark("blood", cell.x, cell.y, 1);
        for (const target of targets) {
          const direct = target === shot.target;
          const targetBaseDamage = direct ? baseDamage : Math.max(1, Math.ceil(baseDamage / 2));
          target.hp = Math.max(0, target.hp - targetBaseDamage);
          addDamageMark(target, null, targetBaseDamage);
          messages.push(`${target.name} is battered for ${targetBaseDamage}.`);
          if (target.hp === 0) messages.push(killMonster(target));
        }
        consumeStackItem(item);
        state.message = `${item.name} shake the floor. ${messages.filter(Boolean).join(" ")}`.trim();
        advanceTurn();
        render();
      }


      function floodTargetCells(center, range) {
        return areaCells(center, range).filter((cell) => !stairsAt(cell.x, cell.y) && !closedDoorAt(cell.x, cell.y));
      }


      function usePhial(item) {
        const shot = evocableShot(item);
        if (!shot) return;
        const cells = floodTargetCells(shot.target, item.radius || 1);
        if (cells.length === 0) {
          setMessage(`${item.name} has nowhere to flood.`);
          return;
        }
        for (const cell of cells) {
          setCellAt(cell.x, cell.y, "w");
          currentFloorState().discovered.add(keyOf(cell.x, cell.y));
        }
        const targets = monstersInCells(cells);
        for (const target of targets) target.rootedTurns = Math.max(target.rootedTurns || 0, item.statusTurns || 2);
        addEffect("ice", uniqueCells([...lineCells(state, shot.target), ...cells]));
        consumeStackItem(item);
        const caught = targets.length === 0 ? "" : ` ${targets.length} monster${targets.length === 1 ? "" : "s"} flounder.`;
        state.message = `${item.name} floods ${cells.length} tiles.${caught}`;
        advanceTurn();
        render();
      }


      function useEvocable(item) {
        if (item.evocation === "lightning") {
          useLightningRod(item);
          return;
        }
        if (item.evocation === "tremor") {
          useTremorstones(item);
          return;
        }
        if (item.evocation === "flood") {
          usePhial(item);
          return;
        }
        setMessage(`${item.name} hums without effect.`);
      }


      function areaCells(center, range) {
        return cellsNear(center, range).filter((cell) => mapKind(cell.x, cell.y) === "floor");
      }


      function monstersInCells(cells) {
        const keys = new Set(cells.map((cell) => keyOf(cell.x, cell.y)));
        return currentFloorState().monsters.filter((monster) => monster.hp > 0 && keys.has(keyOf(monster.x, monster.y)));
      }


      function useIceblastWand(item, shot) {
        const blastCells = areaCells(shot.target, 1);
        const targets = monstersInCells(blastCells);
        const baseDamage = item.power + Math.floor(Math.random() * 5);
        const messages = [];
        addEffect("ice", uniqueCells([...lineCells(state, shot.target), ...blastCells]));
        for (const target of targets) {
          const direct = target === shot.target;
          const targetBaseDamage = direct ? baseDamage : Math.max(1, Math.ceil(baseDamage / 2));
          const damage = monsterElementDamage(target, targetBaseDamage, "cold");
          target.hp = Math.max(0, target.hp - damage);
          addDamageMark(target, "cold", damage);
          messages.push(`${target.name} ${direct ? "freezes" : "is caught"} for ${damage}.${monsterDamageNote(targetBaseDamage, damage)}`);
          if (target.hp === 0) messages.push(killMonster(target));
        }
        consumeWandCharge(item);
        state.message = `${item.name} erupts in ice. ${messages.filter(Boolean).join(" ")}`.trim();
        advanceTurn();
        render();
      }


      function affectNearbyMonsters(center, range, apply) {
        let count = 0;
        for (const monster of monstersInCells(areaCells(center, range))) {
          if (apply(monster)) count += 1;
        }
        return count;
      }


      function frightenMonsters() {
        const floorState = currentFloorState();
        const targets = floorState.monsters.filter((monster) => monster.hp > 0 && floorState.discovered.has(keyOf(monster.x, monster.y)) && distanceToPlayer(monster) <= 7);
        for (const monster of targets) monster.fearTurns = Math.max(monster.fearTurns || 0, 6);
        if (targets.length > 0) addEffect("fear", targets);
        return targets.length;
      }


      function confuseMonsters(turns = 5) {
        const floorState = currentFloorState();
        const targets = floorState.monsters.filter((monster) => monster.hp > 0 && floorState.discovered.has(keyOf(monster.x, monster.y)) && distanceToPlayer(monster) <= 6);
        for (const monster of targets) monster.confusedTurns = Math.max(monster.confusedTurns || 0, turns);
        if (targets.length > 0) addEffect("magic", targets);
        return targets.length;
      }


      function immolateMonsters() {
        const floorState = currentFloorState();
        const targets = floorState.monsters.filter((monster) => monster.hp > 0 && floorState.discovered.has(keyOf(monster.x, monster.y)) && distanceToPlayer(monster) <= 7);
        for (const monster of targets) monster.immolationTurns = Math.max(monster.immolationTurns || 0, 18);
        if (targets.length > 0) addEffect("immolation", targets);
        return targets.length;
      }



      Object.assign(context, {
        teleportDestinations,
        teleportParty,
        blinkDestinations,
        blinkParty,
        fogCells,
        cellsNear,
        uniqueCells,
        spreadCloud,
        spreadFog,
        poisonCells,
        spreadPoison,
        consumeWandCharge,
        consumeStackItem,
        digTarget,
        useDiggingWand,
        useCloudWand,
        throwableTargetShots,
        throwableEffectKind,
        throwableStatusMessage,
        throwableHitMessage,
        useThrowable,
        evocableShot,
        evocableDamageMessage,
        useLightningRod,
        useTremorstones,
        floodTargetCells,
        usePhial,
        useEvocable,
        areaCells,
        monstersInCells,
        useIceblastWand,
        affectNearbyMonsters,
        frightenMonsters,
        confuseMonsters,
        immolateMonsters,
      });
    }
  };
}());
