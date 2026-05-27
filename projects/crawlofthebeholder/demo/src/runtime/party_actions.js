(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyActions = function (context) {
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
          return true;
        }
        state.inventory.push(found);
        state.message = found.kind === "quest" ? `${found.name} flares in the pack. The way out matters now.` : `${found.name} slides into the pack.`;
        return true;
      }

      function triggerTrap() {
        const trap = trapAt(state.x, state.y);
        if (!trap) return false;
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

      function removeMonster(target) {
        const floorState = currentFloorState();
        floorState.monsters = floorState.monsters.filter((monster) => monster !== target);
      }

      function goldLootTile() {
        const localGold = currentFloor().floorItems.find((item) => item.kind === "gold");
        const fallbackGold = resources.floors.flatMap((floor) => floor.floorItems).find((item) => item.kind === "gold");
        return (localGold || fallbackGold).tile;
      }

      function monsterLootValue(monster) {
        return Math.max(2, monster.hd + Math.ceil((monster.exp || 1) / 8));
      }

      function dropMonsterLoot(monster) {
        if (itemAt(monster.x, monster.y)) return "";
        const value = monsterLootValue(monster);
        state.lootSerial += 1;
        currentFloorState().floorItems.push({
          id: `loot-gold-${state.floorIndex}-${state.lootSerial}`,
          name: `${value} gold pieces`,
          shortName: `${value}g`,
          kind: "gold",
          value,
          power: 0,
          tile: goldLootTile(),
          x: monster.x,
          y: monster.y
        });
        return `${value} gold drops.`;
      }

      function explodeMonster(monster, messages) {
        const baseDamage = Math.max(5, 4 + Math.ceil((monster.hd || 1) / 2));
        addEffect("immolation", cellsNear(monster, 1));
        for (const cell of cellsNear(monster, 1)) addFloorMark("scorch", cell.x, cell.y, 1);
        messages.push(`${monster.name} explodes.`);
        for (const other of [...currentFloorState().monsters]) {
          if (other === monster || other.hp <= 0) continue;
          if (Math.abs(other.x - monster.x) + Math.abs(other.y - monster.y) > 1) continue;
          const damage = monsterElementDamage(other, baseDamage, "fire");
          other.hp = Math.max(0, other.hp - damage);
          addDamageMark(other, "fire", damage);
          messages.push(damage > 0 ? `${other.name} burns for ${damage}.${monsterDamageNote(baseDamage, damage)}` : `${other.name} resists the blast.`);
          if (other.hp === 0) messages.push(killMonster(other));
        }

        if (Math.abs(state.x - monster.x) + Math.abs(state.y - monster.y) <= 1) {
          const hit = hurtLiveMember(baseDamage, 0);
          if (hit) addDamageMark(state, "fire", hit.damage);
          if (hit) messages.push(`${hit.defender.name} is caught for ${hit.damage}.`);
          if (hit && !liveMember()) {
            state.defeated = true;
            state.message = `${hit.defender.name} falls in the blast.`;
          }
        }
      }

      function killMonster(monster) {
        if (!currentFloorState().monsters.includes(monster)) return "";
        if (monster.summoned) {
          removeMonster(monster);
          return `${monster.name} fades.`;
        }
        const messages = [`${awardExperience(monster)} ${dropMonsterLoot(monster)}`.trim()];
        removeMonster(monster);
        if (monster.immolationTurns > 0) explodeMonster(monster, messages);
        return messages.filter(Boolean).join(" ");
      }

      function awardExperience(monster) {
        const gained = Math.max(1, monster.exp || 1);
        state.experience += gained;
        const messages = [`+${gained} XP.`];

        while (state.experience >= state.nextLevel) {
          state.experience -= state.nextLevel;
          state.level += 1;
          state.nextLevel = Math.round(state.nextLevel * 1.55 + state.level * 4);
          const hpGain = 4 + Math.ceil(state.level / 2);
          for (const member of state.party) {
            member.maxHp += hpGain;
            if (member.hp > 0) member.hp += hpGain;
            if (state.level % 2 === 0) member.power += 1;
            if (state.level % 3 === 0) member.defense += 1;
          }
          messages.push(`Party reaches level ${state.level}.`);
        }

        return messages.join(" ");
      }

      function memberAttackDamage(member, index, target) {
        const formation = index < 2 ? 0.72 : 0.5;
        return Math.max(1, Math.round(memberPower(member) * formation + Math.random() * 3 - target.ac / 3));
      }

      function reactiveElectricDischarge(monster, triggerDamage) {
        if (!monster.traits?.electricDamage || triggerDamage <= 0 || monster.hp <= 0) return "";
        const defender = liveMember();
        if (!defender) return "";
        const damage = partyElementDamage(Math.max(1, Math.ceil(monster.traits.electricDamage / 7)), "elec");
        defender.hp = Math.max(0, defender.hp - damage);
        addEffect("smite", lineCells(monster, state));
        addDamageMark(state, "elec", damage);
        if (!liveMember()) {
          state.defeated = true;
          return ` ${monster.name}'s charge arcs for ${damage}. ${defender.name} falls.`;
        }
        return ` ${monster.name}'s charge arcs for ${damage}.`;
      }

      function attackTarget(target) {
        const attackers = liveMembers();
        if (attackers.length === 0) {
          setMessage("The party is down.");
          return;
        }

        addEffect("impact", [{ x: target.x, y: target.y }]);
        let damage = 0;
        const names = [];
        for (let index = 0; index < attackers.length; index += 1) {
          damage += memberAttackDamage(attackers[index], index, target);
          names.push(attackers[index].name);
        }

        target.hp = Math.max(0, target.hp - damage);
        addDamageMark(target, null, damage);
        const lead = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(" and ");
        const drops = names.length === 1 ? "drops" : "drop";
        const hits = names.length === 1 ? "hits" : "hit";
        if (target.hp === 0) {
          state.message = `${lead} ${drops} the ${target.name} for ${damage}. ${killMonster(target)}`.trim();
        } else {
          state.message = `${lead} ${hits} the ${target.name} for ${damage}.${reactiveElectricDischarge(target, damage)}`;
          if (state.defeated) {
            render();
            return;
          }
        }
        advanceTurn();
        render();
      }

      function attackForward() {
        const forward = dirAt(0);
        const target = monsterAt(state.x + forward.x, state.y + forward.y);
        if (!target) {
          setMessage("Steel bites empty air.");
          return;
        }
        attackTarget(target);
      }

      function openDoor(x, y) {
        currentFloorState().openedDoors.add(keyOf(x, y));
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

        const step = state.dazedTurns > 0 ? dirs[Math.floor(Math.random() * dirs.length)] : { x: dx, y: dy };
        const nextX = state.x + step.x;
        const nextY = state.y + step.y;
        const target = monsterAt(nextX, nextY);
        if (target) {
          attackTarget(target);
          return;
        }
        if (closedDoorAt(nextX, nextY)) {
          openDoor(nextX, nextY);
          return;
        }
        if (solidAt(nextX, nextY)) {
          setMessage("Stone refuses the party.");
          return;
        }

        state.x = nextX;
        state.y = nextY;
        state.message = `${state.dazedTurns > 0 ? "The party stumbles through the haze." : "Boots scrape across old floor."}${applyBarbedMovement()}`;
        if (state.defeated) {
          reveal();
          render();
          return;
        }
        if (!triggerTrap()) collectFloorItem();
        if (stairsAt(state.x, state.y)) state.message = "Stairs wait underfoot.";
        reveal();
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
        state.floorIndex = nextFloorIndex;
        const floor = currentFloor();
        const landing = direction === "down" ? floor.stairs.up || floor.start : floor.stairs.down || floor.start;
        state.x = landing.x;
        state.y = landing.y;
        state.dir = floor.start.dir;
        state.message = `The party enters ${floor.id}: ${floor.name}.`;
        reveal();
        render();
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

      function fixtureTarget() {
        const here = decorAt(state.x, state.y);
        if (here) return { decor: here, x: state.x, y: state.y };
        const forward = dirAt(0);
        const x = state.x + forward.x;
        const y = state.y + forward.y;
        const decor = decorAt(x, y);
        return decor ? { decor, x, y } : null;
      }

      function healParty(amount) {
        let healed = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          const before = member.hp;
          member.hp = Math.min(member.maxHp, member.hp + amount);
          healed += member.hp - before;
        }
        return healed;
      }

      function clearFixtureAilments() {
        const cleared = [];
        if (state.poisonedTurns > 0) {
          state.poisonedTurns = 0;
          cleared.push("poison");
        }
        if (state.engulfedTurns > 0) {
          state.engulfedTurns = 0;
          cleared.push("water");
        }
        if (state.barbedTurns > 0) {
          state.barbedTurns = 0;
          cleared.push("barbs");
        }
        return cleared;
      }

      function fixtureBenefitMessage(decor, benefits, fallback) {
        state.message = benefits.length > 0 ? `${decor.name} ${benefits.join(" and ")}.` : fallback;
      }

      function useFountain(decor, target) {
        if (decor.name.includes("dry")) {
          addEffect("impact", [target]);
          state.message = `${decor.name} coughs dust across the floor.`;
          return;
        }

        const healed = healParty(decor.name.includes("tidal") ? 8 : 10);
        const cleared = clearFixtureAilments();
        const benefits = [];
        if (healed > 0) benefits.push(`heals ${healed}`);
        if (cleared.length > 0) benefits.push(`clears ${cleared.join(", ")}`);
        if (decor.name.includes("tidal")) {
          state.resistanceTurns = Math.max(state.resistanceTurns, 8);
          benefits.push("raises resistance");
        }
        addEffect("ice", [target, { x: state.x, y: state.y }]);
        fixtureBenefitMessage(decor, benefits, `${decor.name} runs cool over the party.`);
      }

      function useIdol(decor, target) {
        state.mightTurns = Math.max(state.mightTurns, 12);
        addEffect("smite", [target, { x: state.x, y: state.y }]);
        state.message = `${decor.name} drums strength into the party.`;
      }

      function useStatue(decor, target) {
        state.resistanceTurns = Math.max(state.resistanceTurns, 10);
        addEffect("halo", [target, { x: state.x, y: state.y }]);
        state.message = `${decor.name} hardens the party's guard.`;
      }

      function useLantern(decor, target) {
        revealAll();
        addEffect("halo", [target]);
        state.message = `${decor.name} throws clean light across the floor.`;
      }

      function useColumn(decor, target) {
        state.resistanceTurns = Math.max(state.resistanceTurns, 8);
        addEffect("impact", [target]);
        state.message = `${decor.name} gives the party a stone brace.`;
      }

      function useDais(decor, target) {
        state.mightTurns = Math.max(state.mightTurns, 8);
        state.resistanceTurns = Math.max(state.resistanceTurns, 8);
        addEffect("magic", [target, { x: state.x, y: state.y }]);
        state.message = `${decor.name} wakes underfoot.`;
      }

      function useFixture(decor, target) {
        const name = decor.name.toLowerCase();
        if (name.includes("fountain")) {
          useFountain(decor, target);
          return;
        }
        if (name.includes("idol")) {
          useIdol(decor, target);
          return;
        }
        if (name.includes("statue")) {
          useStatue(decor, target);
          return;
        }
        if (name.includes("lantern")) {
          useLantern(decor, target);
          return;
        }
        if (name.includes("column") || name.includes("pillar")) {
          useColumn(decor, target);
          return;
        }
        if (name.includes("dais")) {
          useDais(decor, target);
          return;
        }
        addEffect("magic", [target]);
        state.message = `${decor.name} hums once.`;
      }

      function interactFixture() {
        const target = fixtureTarget();
        if (!target) return false;
        if (decorUsed(target.decor)) {
          setMessage(`${target.decor.name} is spent.`);
          return true;
        }
        markDecorUsed(target.decor);
        currentFloorState().discovered.add(keyOf(target.decor.x, target.decor.y));
        useFixture(target.decor, target);
        advanceTurn();
        render();
        return true;
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
        return trapAt(state.x + forward.x, state.y + forward.y) || null;
      }

      function disarmTrapTarget() {
        const trap = trapTarget();
        if (!trap) {
          setMessage("No armed trap is close enough.");
          return;
        }
        trap.armed = false;
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

      function removeInventoryItem(item) {
        state.inventory = state.inventory.filter((entry) => entry !== item);
      }

      function equipItem(item, slot, verb) {
        const target = liveMember();
        if (!target) return false;
        const previous = target[slot];
        removeInventoryItem(item);
        target[slot] = item;
        if (previous) state.inventory.push(previous);
        state.message = previous ? `${target.name} swaps ${previous.name} for ${item.name}.` : `${target.name} ${verb} ${item.name}.`;
        return true;
      }

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

      function nearestMonsterDistance(point) {
        const monsters = currentFloorState().monsters.filter((monster) => monster.hp > 0);
        if (monsters.length === 0) return 99;
        return Math.min(...monsters.map((monster) => Math.abs(point.x - monster.x) + Math.abs(point.y - monster.y)));
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
          if (cellAt(x, y) === "x" && x > 0 && y > 0 && x < currentFloor().map.width - 1 && y < currentFloor().map.height - 1) return { x, y, kind: "wall" };
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

      function wandEffectKind(item) {
        if (item.name.includes("ice")) return "ice";
        if (item.name.includes("acid")) return "poison";
        if (item.name.includes("light")) return "smite";
        if (item.name.includes("roots")) return "impact";
        return "flame";
      }

      function wandElement(item) {
        if (item.name.includes("ice")) return "cold";
        if (item.name.includes("acid")) return "acid";
        if (item.name.includes("flame")) return "fire";
        return null;
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

      function wandHitMessage(item, target, baseDamage, damage) {
        if (damage === 0) return `${item.name} washes over the ${target.name}. It resists.`;
        const note = monsterDamageNote(baseDamage, damage);
        if (item.name.includes("ice")) return `${item.name} freezes the ${target.name} for ${damage}.${note}`;
        if (item.name.includes("acid")) return `${item.name} splashes the ${target.name} for ${damage}.${note}`;
        if (item.name.includes("light")) return `${item.name} flashes through the ${target.name} for ${damage}.`;
        if (item.name.includes("roots")) return `${item.name} roots the ${target.name} for ${damage}.`;
        return `${item.name} burns the ${target.name} for ${damage}.${note}`;
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

      function immolateMonsters() {
        const floorState = currentFloorState();
        const targets = floorState.monsters.filter((monster) => monster.hp > 0 && floorState.discovered.has(keyOf(monster.x, monster.y)) && distanceToPlayer(monster) <= 7);
        for (const monster of targets) monster.immolationTurns = Math.max(monster.immolationTurns || 0, 18);
        if (targets.length > 0) addEffect("immolation", targets);
        return targets.length;
      }

      function useItem(id) {
        const item = state.inventory.find((entry) => entry.id === id);
        if (!item) return;
        if (item.kind === "healing") {
          const target = state.party.reduce((lowest, member) => (member.hp / member.maxHp < lowest.hp / lowest.maxHp ? member : lowest), state.party[0]);
          target.hp = Math.min(target.maxHp, target.hp + item.power);
          const clearedPoison = item.name.includes("curing") && state.poisonedTurns > 0;
          const clearedBarbs = item.name.includes("curing") && state.barbedTurns > 0;
          if (clearedPoison) state.poisonedTurns = 0;
          if (clearedBarbs) state.barbedTurns = 0;
          removeInventoryItem(item);
          const clearNote = [clearedPoison && "Poison clears", clearedBarbs && "barbs loosen"].filter(Boolean).join("; ");
          state.message = clearNote ? `${target.name} drinks ${item.name}. ${clearNote}.` : `${target.name} drinks ${item.name}.`;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "mapping") {
          revealAll();
          removeInventoryItem(item);
          state.message = "The map floods with clean lines.";
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "might") {
          state.mightTurns = Math.max(state.mightTurns, item.turns || 18);
          removeInventoryItem(item);
          state.message = "The party's muscles surge.";
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "resistance") {
          state.resistanceTurns = Math.max(state.resistanceTurns, item.turns || 16);
          removeInventoryItem(item);
          addEffect("halo", [{ x: state.x, y: state.y }]);
          state.message = "The party feels the elements slide away.";
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "haste") {
          state.hasteTurns = Math.max(state.hasteTurns, item.turns || 14);
          removeInventoryItem(item);
          state.message = "The party speeds up.";
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "blink") {
          removeInventoryItem(item);
          const origin = { x: state.x, y: state.y };
          const moved = blinkParty();
          if (moved) addEffect("blink", [origin, { x: state.x, y: state.y }]);
          state.message = moved ? "The party blinks through a seam in space." : `${item.name} fizzles.`;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "teleport") {
          removeInventoryItem(item);
          const origin = { x: state.x, y: state.y };
          const moved = teleportParty();
          if (moved) addEffect("blink", [origin, { x: state.x, y: state.y }]);
          state.message = moved ? "The dungeon folds around the party." : `${item.name} crackles uselessly.`;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "fear") {
          removeInventoryItem(item);
          const frightened = frightenMonsters();
          state.message = frightened === 0 ? `${item.name} whispers into empty halls.` : `${item.name} sends ${frightened} monster${frightened === 1 ? "" : "s"} fleeing.`;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "fog") {
          removeInventoryItem(item);
          spreadFog(item.turns || 7);
          state.message = "Grey fog billows through the hall.";
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "poison") {
          removeInventoryItem(item);
          const clouds = spreadPoison(item.turns || 6);
          state.message = clouds === 0 ? `${item.name} hisses, but finds no open air.` : `${item.name} fills ${clouds} tiles with poison.`;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "immolation") {
          removeInventoryItem(item);
          const marked = immolateMonsters();
          state.message = marked === 0 ? `${item.name} finds nothing to ignite.` : `${item.name} lights ${marked} monster${marked === 1 ? "" : "s"} from within.`;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "silence") {
          removeInventoryItem(item);
          state.silenceTurns = Math.max(state.silenceTurns, item.turns || 10);
          addEffect("silence", cellsNear(state, 2));
          state.message = "A heavy silence falls.";
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "wand") {
          if (state.silenceTurns > 0) {
            setMessage(`${item.name} will not answer in silence.`);
            return;
          }
          if (item.name.includes("digging")) {
            useDiggingWand(item);
            return;
          }
          if (item.name.includes("clouds")) {
            useCloudWand(item);
            return;
          }
          const shot = firstTargetInLine(4);
          if (!shot) {
            setMessage(`${item.name} finds no target.`);
            return;
          }

          if (item.name.includes("iceblast")) {
            useIceblastWand(item, shot);
            return;
          }

          const baseDamage = item.power + Math.floor(Math.random() * 5);
          const damage = monsterElementDamage(shot.target, baseDamage, wandElement(item));
          addEffect(wandEffectKind(item), lineCells(state, shot.target));
          shot.target.hp = Math.max(0, shot.target.hp - damage);
          addDamageMark(shot.target, wandElement(item), damage);
          const rooted = item.name.includes("roots") ? affectNearbyMonsters(shot.target, 1, (monster) => {
            if (monster.hp <= 0) return false;
            monster.rootedTurns = Math.max(monster.rootedTurns || 0, 3);
            return true;
          }) : 0;
          if (item.name.includes("acid") && shot.target.hp > 0 && damage > 0) shot.target.ac = Math.max(0, (shot.target.ac || 0) - 1);
          const dazzled = item.name.includes("light") ? affectNearbyMonsters(shot.target, 1, (monster) => {
            monster.fearTurns = Math.max(monster.fearTurns || 0, 2);
            return true;
          }) : 0;
          consumeWandCharge(item);
          state.message = wandHitMessage(item, shot.target, baseDamage, damage);
          if (rooted > 1) state.message = `${state.message} Roots lash ${rooted} monsters.`;
          if (dazzled > 1) state.message = `${state.message} Light dazzles ${dazzled} monsters.`;
          if (shot.target.hp === 0) {
            state.message = `${state.message} ${killMonster(shot.target)}`.trim();
          }
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "throwable") {
          useThrowable(item);
          return;
        }
        if (item.kind === "evocable") {
          useEvocable(item);
          return;
        }
        if (item.kind === "weapon") {
          if (!equipItem(item, "weapon", "readies")) return;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "armour") {
          if (!equipItem(item, "armour", "buckles on")) return;
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "talisman") {
          if (!equipItem(item, "talisman", "attunes to")) return;
          addEffect("magic", [{ x: state.x, y: state.y }]);
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "ring") {
          if (!equipItem(item, "ring", "slips on")) return;
          addEffect("halo", [{ x: state.x, y: state.y }]);
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "amulet") {
          if (!equipItem(item, "amulet", "fastens")) return;
          addEffect("halo", [{ x: state.x, y: state.y }]);
          advanceTurn();
          render();
          return;
        }
        if (item.kind === "quest") {
          setMessage(`${item.name} hums toward the surface.`);
          return;
        }
        state.message = `${item.name} is ready.`;
        renderChrome();
      }

      function waitTurn() {
        const adjacentThreat = currentFloorState().monsters.some((monster) => monster.hp > 0 && distanceToPlayer(monster) === 1);
        if (!adjacentThreat) {
          const healing = hasEquippedNamed("amulet", "regeneration") || hasEquippedNamed("amulet", "vitality") ? 2 : 1;
          for (const member of state.party) {
            if (member.hp > 0 && member.hp < member.maxHp) member.hp = Math.min(member.maxHp, member.hp + healing);
          }
          state.message = healing > 1 ? "The party catches a strong breath." : "The party catches a breath.";
        } else {
          state.message = "The party braces.";
        }
        advanceTurn();
        render();
      }

      function handleAction(action) {
        if (state.victory || state.defeated) return;
        if (action === "turnLeft") turn(-1);
        if (action === "turnRight") turn(1);
        if (action === "moveForward") {
          const forward = dirAt(0);
          moveBy(forward.x, forward.y);
        }
        if (action === "moveLeft") {
          const left = dirAt(-1);
          moveBy(left.x, left.y);
        }
        if (action === "moveRight") {
          const right = dirAt(1);
          moveBy(right.x, right.y);
        }
        if (action === "moveBack") {
          const back = dirAt(2);
          moveBy(back.x, back.y);
        }
        if (action === "attack") attackForward();
        if (action === "interact") interact();
        if (action === "pickup") pickupCurrentItem();
        if (action === "disarm") disarmTrapTarget();
        if (action === "stairs") useStairs();
        if (action === "wait") waitTurn();
      }

      Object.assign(context, {
        collectFloorItem,
        triggerTrap,
        removeMonster,
        goldLootTile,
        monsterLootValue,
        dropMonsterLoot,
        explodeMonster,
        killMonster,
        awardExperience,
        memberAttackDamage,
        reactiveElectricDischarge,
        attackTarget,
        attackForward,
        openDoor,
        closeDoor,
        moveBy,
        applyBarbedMovement,
        turn,
        changeFloor,
        useStairs,
        fixtureTarget,
        healParty,
        clearFixtureAilments,
        fixtureBenefitMessage,
        useFountain,
        useIdol,
        useStatue,
        useLantern,
        useColumn,
        useDais,
        useFixture,
        interactFixture,
        doorTarget,
        interactDoor,
        trapTarget,
        disarmTrapTarget,
        interactTrap,
        pickupCurrentItem,
        interactItem,
        interact,
        removeInventoryItem,
        equipItem,
        teleportDestinations,
        teleportParty,
        nearestMonsterDistance,
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
        digTarget,
        useDiggingWand,
        useCloudWand,
        wandEffectKind,
        wandElement,
        wandHitMessage,
        frightenMonsters,
        immolateMonsters,
        useItem,
        waitTurn,
        handleAction,
      });
    }
  };
}());
