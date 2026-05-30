(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyCombat = function (context) {
    with (context) {

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
        // Guard hd/exp so a malformed monster never yields NaN gold.
        const hd = Number.isFinite(monster?.hd) ? monster.hd : 1;
        const base = Math.max(2, hd + Math.ceil((monster?.exp || 1) / 8));
        const bossMultiplier = monster?.boss ? 6 : 1;
        const difficultyScale = typeof currentDifficulty === "function" ? (currentDifficulty().goldScale || 1) : 1;
        return Math.max(1, Math.round(base * bossMultiplier * difficultyScale));
      }


      function comboGoldMultiplier() {
        // Every 3 kills in a combo adds +25% gold, capped at +150%.
        // Shrine of fortune blessings stack a flat luck bonus on top.
        const combo = state.killCombo || 0;
        const deityGold = typeof deityGoldScale === "function" ? (deityGoldScale() - 1) : 0;
        return 1 + Math.min(1.5, Math.floor(combo / 3) * 0.25) + (state.luckBonus || 0) + deityGold;
      }


      function dropMonsterLoot(monster) {
        if (itemAt(monster.x, monster.y)) return "";
        // Bosses may drop a named DCSS artefact instead of gold (opt-in; a no-op
        // by default so gold-drop snapshots are unchanged).
        if (typeof coronateDrop === "function") {
          const legendary = coronateDrop(monster);
          if (legendary) return legendary;
        }
        const value = Math.round(monsterLootValue(monster) * comboGoldMultiplier());
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
        state.monstersDefeated = (state.monstersDefeated || 0) + 1;
        if (monster.boss) state.bossKilled = true;
        if (typeof recordKilled === "function") recordKilled(monster);
        if (typeof recordBountyKill === "function") recordBountyKill(monster);
        if (typeof chargeRelics === "function") chargeRelics(monster);
        if (typeof recordCorpse === "function") recordCorpse(monster);
        if (typeof recordHarvest === "function") recordHarvest(monster);
        if (typeof noteMoraleKill === "function") noteMoraleKill();
        if (typeof notePietyKill === "function") notePietyKill();
        // Kill combo: each kill without taking damage raises the multiplier.
        state.killCombo = (state.killCombo || 0) + 1;
        if (state.killCombo > (state.bestCombo || 0)) state.bestCombo = state.killCombo;
        const messages = [`${awardExperience(monster)} ${dropMonsterLoot(monster)}`.trim()];
        removeMonster(monster);
        if (monster.immolationTurns > 0) explodeMonster(monster, messages);
        return messages.filter(Boolean).join(" ");
      }


      function awardExperience(monster) {
        const base = Math.max(1, monster.exp || 1);
        // Killing-blow bonus: 25% extra XP for finishing the foe.
        const difficultyXp = typeof currentDifficulty === "function" ? (currentDifficulty().xpScale || 1) : 1;
        const deityXp = typeof deityXpScale === "function" ? deityXpScale() : 1;
        const runeBonus = typeof runeXpBonus === "function" ? runeXpBonus(monster) : 0;
        const skyXp = typeof constellationXpBonus === "function" ? constellationXpBonus() : 0;
        const gained = Math.max(1, Math.round(base * 1.25 * difficultyXp * deityXp)) + runeBonus + skyXp;
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
          state.talentPoints = (state.talentPoints || 0) + 1;
          messages.push(`Party reaches level ${state.level}. (+1 talent)`);
          if (typeof showToast === "function") showToast(`Party reaches level ${state.level}! +1 talent.`);
          if (typeof pulse === "function") pulse("levelUp");
        }
        if (typeof evaluateAchievements === "function") {
          const fresh = evaluateAchievements();
          if (fresh.length > 0 && typeof pulse === "function") pulse("achievement");
          for (const id of fresh) {
            if (typeof showToast !== "function") continue;
            const list = typeof getAchievements === "function" ? getAchievements() : [];
            const entry = list.find((a) => a.id === id);
            if (entry) showToast(`Achievement: ${entry.name}`);
          }
        }

        return messages.join(" ");
      }


      function memberAttackDamage(member, index, target) {
        const formation = index < 2 ? 0.72 : 0.5;
        const mastery = typeof meleeMasteryBonus === "function" ? meleeMasteryBonus(member, target) : 0;
        const bloodlinePwr = typeof bloodlinePowerBonus === "function" ? bloodlinePowerBonus(member) : 0;
        const mutationPwr = typeof mutationPowerBonus === "function" ? mutationPowerBonus(member) : 0;
        const leyBonus = typeof leyLineCombatBonus === "function" ? leyLineCombatBonus() : 0;
        const herbPwr = typeof herbVoidPowerBonus === "function" ? herbVoidPowerBonus(member) : 0;
        const resonancePwr = typeof resonancePowerBonus === "function" ? resonancePowerBonus(member) : 0;
        const harvestPwr  = typeof harvestPowerBonus  === "function" ? harvestPowerBonus(member)  : 0;
        const cookingPwr  = typeof cookingPowerBonus  === "function" ? cookingPowerBonus(member)  : 0;
        const bardicPwr   = typeof bardicPowerBonus   === "function" ? bardicPowerBonus(member)   : 0;
        const timePwr     = typeof timeEchoBonus      === "function" ? timeEchoBonus(member)      : 0;
        const moralePwr   = typeof moralePowerBonus   === "function" ? moralePowerBonus(member)   : 0;
        const skyPwr      = typeof constellationPowerBonus === "function" ? constellationPowerBonus(member) : 0;
        const deityPwr    = typeof deityPowerBonus     === "function" ? deityPowerBonus()          : 0;
        return Math.max(1, Math.round(memberPower(member) * formation + Math.random() * 3 - target.ac / 3) + mastery + bloodlinePwr + mutationPwr + leyBonus + herbPwr + resonancePwr + harvestPwr + cookingPwr + bardicPwr + timePwr + moralePwr + skyPwr + deityPwr);
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


      function rollCriticalChance() {
        return Math.random() < 0.08;
      }


      // The front-line's weapon proc (if any) triggers on a landed hit.
      function activeWeaponProc() {
        const leader = state.party[0];
        return leader && leader.hp > 0 ? leader.weapon?.proc || null : null;
      }


      function applyWeaponProc(target, damage) {
        const proc = activeWeaponProc();
        if (!proc || damage <= 0 || target.hp <= 0) return "";
        if (proc === "vampiric") {
          const heal = Math.max(1, Math.ceil(damage / 4));
          const wounded = liveMembers().filter((m) => m.hp < m.maxHp).sort((a, b) => a.hp - b.hp)[0];
          if (wounded) wounded.hp = Math.min(wounded.maxHp, wounded.hp + heal);
          return ` Lifesteal heals ${heal}.`;
        }
        if (proc === "freeze") {
          target.slowedTurns = Math.max(target.slowedTurns || 0, 3);
          return ` ${target.name} is frozen sluggish.`;
        }
        if (proc === "weaken") {
          target.weakenedTurns = Math.max(target.weakenedTurns || 0, 3);
          return ` ${target.name} is weakened.`;
        }
        if (proc === "knockback") {
          return knockbackMonster(target);
        }
        return "";
      }


      // Shove a monster one tile directly away from the party. Into a wall/
      // occupied tile deals bonus impact damage; into lava/deep water is lethal-ish.
      function knockbackMonster(target) {
        const dx = Math.sign(target.x - state.x);
        const dy = Math.sign(target.y - state.y);
        if (dx === 0 && dy === 0) return "";
        const bx = target.x + dx;
        const by = target.y + dy;
        const terrain = terrainAt(bx, by);
        if (!solidAt(bx, by) && !monsterAt(bx, by) && !allyAt(bx, by) && !(bx === state.x && by === state.y)) {
          target.x = bx;
          target.y = by;
          if ((terrain === "lava" || terrain === "deep-water")) {
            const drop = Math.max(4, Math.ceil(target.maxHp / 3));
            target.hp = Math.max(0, target.hp - drop);
            addDamageMark(target, terrain === "lava" ? "fire" : "cold", drop);
            const note = ` ${target.name} is hurled into the ${terrain === "lava" ? "lava" : "deep water"} for ${drop}.`;
            if (target.hp === 0) return `${note} ${killMonster(target)}`.trimEnd();
            return note;
          }
          return ` ${target.name} is knocked back.`;
        }
        // Blocked — slam damage instead.
        const slam = Math.max(2, Math.ceil(target.maxHp / 10));
        target.hp = Math.max(0, target.hp - slam);
        addDamageMark(target, null, slam);
        const note = ` ${target.name} slams into stone for ${slam}.`;
        if (target.hp === 0) return `${note} ${killMonster(target)}`.trimEnd();
        return note;
      }


      function attackTarget(target, options = {}) {
        const attackers = liveMembers();
        if (attackers.length === 0) {
          setMessage("The party is down.");
          return;
        }

        addEffect(options.sweep ? "smite" : "impact", [{ x: target.x, y: target.y }]);
        let damage = 0;
        const names = [];
        for (let index = 0; index < attackers.length; index += 1) {
          damage += memberAttackDamage(attackers[index], index, target);
          names.push(attackers[index].name);
        }
        const critRolled = !options.sweep && rollCriticalChance();
        if (critRolled) {
          damage = Math.round(damage * 2);
          state.criticalHits = (state.criticalHits || 0) + 1;
          if (typeof flashCrit === "function") flashCrit();
          if (typeof shakeViewport === "function") shakeViewport(2);
          if (typeof pulse === "function") pulse("crit");
        } else if (typeof pulse === "function") {
          pulse("attack");
        }
        if (typeof queueFloater === "function") queueFloater(damage, critRolled ? "crit" : "damage");
        if (options.chargeBonus) damage = Math.round(damage * options.chargeBonus);
        if (typeof consumeRestedAttack === "function") damage = consumeRestedAttack(damage);
        if (typeof applyOmen === "function") damage = applyOmen(damage);
        // Execution finisher: when target sits below 10% HP, finish them.
        const executed = target.maxHp > 0 && target.hp > 0 && target.hp <= Math.max(2, Math.ceil(target.maxHp * 0.1)) && !options.skipExecution;
        if (executed) damage = Math.max(damage, target.hp);

        const previousHp = target.hp;
        target.hp = Math.max(0, target.hp - damage);
        addDamageMark(target, null, damage);
        // Damaging a target alerts every monster on this floor within 6 tiles.
        for (const monster of currentFloorState().monsters) {
          if (monster.hp > 0 && distanceToPlayer(monster) <= 6) monster.alerted = true;
        }
        state.damageDealt = (state.damageDealt || 0) + Math.min(damage, previousHp);
        // Practising a weapon type raises its mastery over time.
        if (typeof gainAttackMastery === "function") gainAttackMastery(attackers, target);
        if (typeof applyWeaponEnchantment === "function") applyWeaponEnchantment(attackers, target);
        const lead = names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(" and ");
        const drops = names.length === 1 ? "drops" : "drop";
        const hits = names.length === 1 ? "hits" : "hit";
        if (target.hp === 0 && executed) {
          state.message = `${lead} execute${names.length === 1 ? "s" : ""} the ${target.name} for ${damage}. ${killMonster(target)}`.trim();
        } else if (target.hp === 0 && critRolled) {
          state.message = `Critical! ${lead} drop${names.length === 1 ? "s" : ""} the ${target.name} for ${damage}. ${killMonster(target)}`.trim();
        } else if (target.hp === 0) {
          state.message = `${lead} ${drops} the ${target.name} for ${damage}. ${killMonster(target)}`.trim();
        } else if (critRolled) {
          state.message = `Critical! ${lead} ${hits} the ${target.name} for ${damage}.${applyWeaponProc(target, damage)}${reactiveElectricDischarge(target, damage)}`;
        } else {
          state.message = `${lead} ${hits} the ${target.name} for ${damage}.${applyWeaponProc(target, damage)}${reactiveElectricDischarge(target, damage)}`;
        }
        if (state.defeated) { render(); return; }
        if (!options.skipTurnAdvance) {
          advanceTurn();
          render();
        }
      }


      function chargeAttack() {
        // Move forward then attack in the same turn; if a wall sits in front, fall back to regular attack.
        const forward = dirAt(0);
        const aheadX = state.x + forward.x;
        const aheadY = state.y + forward.y;
        const target = monsterAt(aheadX + forward.x, aheadY + forward.y);
        if (!target) {
          setMessage("Nothing to charge.");
          return;
        }
        if (closedDoorAt(aheadX, aheadY) || solidAt(aheadX, aheadY) || monsterAt(aheadX, aheadY)) {
          setMessage("Charge blocked.");
          return;
        }
        state.x = aheadX;
        state.y = aheadY;
        reveal();
        attackTarget(target, { chargeBonus: 1.5 });
      }


      function sweepAttack() {
        const forward = dirAt(0);
        const left = dirAt(-1);
        const right = dirAt(1);
        const cells = [
          { x: state.x + forward.x, y: state.y + forward.y },
          { x: state.x + left.x, y: state.y + left.y },
          { x: state.x + right.x, y: state.y + right.y }
        ];
        const targets = cells.map((cell) => monsterAt(cell.x, cell.y)).filter(Boolean);
        if (targets.length === 0) {
          setMessage("The sweep finds no targets.");
          return;
        }
        for (const target of targets) {
          attackTarget(target, { sweep: true, skipTurnAdvance: true });
          if (state.defeated) { render(); return; }
        }
        state.message = `The party sweeps through ${targets.length} foe${targets.length === 1 ? "" : "s"}.`;
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

      Object.assign(context, {
        removeMonster,
        goldLootTile,
        monsterLootValue,
        comboGoldMultiplier,
        dropMonsterLoot,
        explodeMonster,
        killMonster,
        awardExperience,
        memberAttackDamage,
        reactiveElectricDischarge,
        rollCriticalChance,
        activeWeaponProc,
        applyWeaponProc,
        knockbackMonster,
        attackTarget,
        chargeAttack,
        sweepAttack,
        attackForward,
      });
    }
  };
}());
