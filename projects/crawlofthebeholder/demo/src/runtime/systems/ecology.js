(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Monster ecology: emergent behaviours layered on the existing monster status
  // system (rage/might/fear/weaken/alert). Splitters divide when wounded,
  // regenerators heal, pack leaders rally allies, the desperate flee or go
  // berserk, and one tough foe per busy floor is promoted to a champion.
  // Gated by context.ecologyDisabled so historical balance tests stay stable.
  window.CotBRuntime.installEcology = function (context) {
    with (context) {
      const SPLIT_CAP = 40; // never let a floor balloon past this many monsters

      function adjacentOpenCells(x, y) {
        return dirs
          .map((dir) => ({ x: x + dir.x, y: y + dir.y }))
          .filter((cell) => mapContains(cell.x, cell.y)
            && !solidAt(cell.x, cell.y)
            && !closedDoorAt(cell.x, cell.y)
            && !monsterAt(cell.x, cell.y)
            && !allyAt(cell.x, cell.y)
            && !(cell.x === state.x && cell.y === state.y));
      }

      function splitMonster(monster, messages = []) {
        const floorState = currentFloorState();
        if (monster.hasSplit || monster.hp <= 1) return [];
        if (floorState.monsters.filter((m) => m.hp > 0).length >= SPLIT_CAP) return [];
        const spots = adjacentOpenCells(monster.x, monster.y);
        if (spots.length === 0) return [];
        monster.hasSplit = true;
        const childHp = Math.max(1, Math.floor(monster.hp / 2));
        monster.hp = Math.max(1, monster.hp - childHp);
        state.summonSerial = (state.summonSerial || 0) + 1;
        const child = {
          ...monster,
          id: `${monster.id || "split"}-s${state.summonSerial}`,
          x: spots[0].x,
          y: spots[0].y,
          hp: childHp,
          maxHp: Math.max(childHp, Math.floor((monster.maxHp || monster.hp) / 2)),
          energy: 0,
          alerted: monster.alerted,
          hasSplit: true,
          split: true,
          attacks: monster.attacks ? monster.attacks.map((attack) => ({ ...attack })) : undefined,
          resists: monster.resists ? { ...monster.resists } : undefined,
          traits: monster.traits ? { ...monster.traits } : undefined
        };
        floorState.monsters.push(child);
        if (floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} splits in two!`);
        return [child];
      }

      function enrageMonster(monster, messages = []) {
        if (monster.enraged) return false;
        monster.enraged = true;
        monster.rageTurns = Math.max(monster.rageTurns || 0, 6);
        monster.mightTurns = Math.max(monster.mightTurns || 0, 6);
        if (currentFloorState().discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} flies into a berserk rage!`);
        return true;
      }

      function regenerateMonster(monster) {
        if (!monster.traits?.regenerates) return false;
        const maxHp = monster.maxHp || monster.hp;
        if (monster.hp <= 0 || monster.hp >= maxHp) return false;
        const heal = Math.max(1, Math.ceil(maxHp / 20));
        monster.hp = Math.min(maxHp, monster.hp + heal);
        return true;
      }

      function alertPack(monster, messages = []) {
        if (!monster.alerted) return 0;
        const floorState = currentFloorState();
        let woke = 0;
        for (const other of floorState.monsters) {
          if (other === monster || other.hp <= 0 || other.alerted) continue;
          if (Math.abs(other.x - monster.x) + Math.abs(other.y - monster.y) <= 4) {
            other.alerted = true;
            woke += 1;
          }
        }
        if (woke > 0 && floorState.discovered.has(keyOf(monster.x, monster.y))) {
          messages.push(`${monster.name} bays; ${woke} nearby foe${woke === 1 ? "" : "s"} stir.`);
        }
        return woke;
      }

      function checkMonsterMorale(monster, messages = []) {
        const ratio = monster.hp / Math.max(1, monster.maxHp || monster.hp);
        if (ratio > 0.25) return false;
        if (monster.boss || monster.summoned || monster.traits?.fearless) return false;
        if (monster.traits?.berserk) return enrageMonster(monster, messages);
        if ((monster.fearTurns || 0) > 0) return false;
        monster.fearTurns = Math.max(monster.fearTurns || 0, 3);
        if (currentFloorState().discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} panics and tries to flee.`);
        return true;
      }

      function promoteToChampion(monster) {
        if (monster.champion) return false;
        monster.champion = true;
        const maxHp = monster.maxHp || monster.hp;
        monster.maxHp = Math.round(maxHp * 1.8);
        monster.hp = monster.maxHp;
        monster.power = Math.round((monster.power || 3) * 1.4) + 1;
        monster.exp = Math.round((monster.exp || 1) * 2);
        monster.hd = (monster.hd || 1) + 2;
        if (monster.attacks) monster.attacks = monster.attacks.map((attack) => ({ ...attack, damage: Math.round((attack.damage || monster.power) * 1.3) }));
        if (!/^champion /i.test(monster.name)) monster.name = `champion ${monster.name}`;
        return true;
      }

      // Promote one untouched, tough monster per busy floor, once.
      function ensureFloorChampions() {
        const floorState = currentFloorState();
        if (floorState.championsSeeded) return 0;
        floorState.championsSeeded = true;
        const candidates = floorState.monsters.filter((m) =>
          m.hp > 0 && m.hp === (m.maxHp || m.hp) && !m.summoned && !m.boss && !m.champion);
        if (candidates.length < 3) return 0;
        candidates.sort((a, b) => (b.hd || 1) - (a.hd || 1) || (b.maxHp || 0) - (a.maxHp || 0));
        promoteToChampion(candidates[0]);
        return 1;
      }

      function runEcology(messages) {
        if (context.ecologyDisabled) return false;
        const floorState = currentFloorState();
        if (!floorState.monsters || floorState.monsters.length === 0) return false;
        ensureFloorChampions();
        for (const monster of [...floorState.monsters]) {
          if (monster.hp <= 0) continue;
          regenerateMonster(monster);
          if (monster.traits?.splits && !monster.hasSplit && monster.hp < (monster.maxHp || monster.hp) / 2) {
            splitMonster(monster, messages);
          }
          if (monster.traits?.packLeader) alertPack(monster, messages);
          checkMonsterMorale(monster, messages);
        }
        return false;
      }

      if (Array.isArray(turnHooks)) turnHooks.push(runEcology);

      Object.assign(context, {
        splitMonster,
        enrageMonster,
        regenerateMonster,
        alertPack,
        checkMonsterMorale,
        promoteToChampion,
        ensureFloorChampions,
        runEcology
      });
    }
  };
}());
