(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installMonsterAi = function (context) {
    with (context) {
      function firstTargetInLine(range) {
        const forward = dirAt(0);
        for (let depth = 1; depth <= range; depth += 1) {
          const x = state.x + forward.x * depth;
          const y = state.y + forward.y * depth;
          if (solidAt(x, y)) return null;
          if (cloudBlocksLine(x, y)) return null;
          const target = monsterAt(x, y);
          if (target) return { target, depth };
        }
        return null;
      }

      function monsterStepOptions(monster) {
        return [
          { x: monster.x + Math.sign(state.x - monster.x), y: monster.y },
          { x: monster.x, y: monster.y + Math.sign(state.y - monster.y) },
          { x: monster.x - Math.sign(state.x - monster.x), y: monster.y },
          { x: monster.x, y: monster.y - Math.sign(state.y - monster.y) }
        ].filter((step) => step.x !== monster.x || step.y !== monster.y)
          .sort((a, b) => Math.abs(a.x - state.x) + Math.abs(a.y - state.y) - Math.abs(b.x - state.x) - Math.abs(b.y - state.y));
      }

      function monsterCanMoveTo(monster, x, y) {
        return !solidAt(x, y) && !monsterAt(x, y) && !allyAt(x, y) && (x !== state.x || y !== state.y) && monsterCanEnterTerrain(monster, terrainAt(x, y));
      }

      function monsterFlee(monster) {
        const steps = [
          { x: monster.x + 1, y: monster.y },
          { x: monster.x - 1, y: monster.y },
          { x: monster.x, y: monster.y + 1 },
          { x: monster.x, y: monster.y - 1 }
        ].filter((step) => monsterCanMoveTo(monster, step.x, step.y))
          .sort((a, b) => Math.abs(b.x - state.x) + Math.abs(b.y - state.y) - Math.abs(a.x - state.x) - Math.abs(a.y - state.y));

        const step = steps[0];
        if (!step) return false;
        monster.x = step.x;
        monster.y = step.y;
        return true;
      }

      function clearLineBetween(from, to) {
        if (from.x !== to.x && from.y !== to.y) return false;
        const dx = Math.sign(to.x - from.x);
        const dy = Math.sign(to.y - from.y);
        if (dx === 0 && dy === 0) return false;

        let x = from.x + dx;
        let y = from.y + dy;
        while (x !== to.x || y !== to.y) {
          if (solidAt(x, y)) return false;
          if (cloudBlocksLine(x, y)) return false;
          x += dx;
          y += dy;
        }
        return true;
      }

      function clearLineToPlayer(monster) {
        return clearLineBetween(monster, state);
      }

      function rangedCanTargetPlayer(monster) {
        if (!monster.ranged || distanceToPlayer(monster) > monster.ranged.range) return false;
        if ((monster.silencedTurns || 0) > 0) return false;
        return monster.ranged.smiteTargeted || clearLineToPlayer(monster);
      }

      function lineCells(from, to) {
        const dx = Math.sign(to.x - from.x);
        const dy = Math.sign(to.y - from.y);
        const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
        const cells = [];
        for (let step = 1; step <= steps; step += 1) cells.push({ x: from.x + dx * step, y: from.y + dy * step });
        return cells;
      }

      function rangedEffectCells(monster) {
        return monster.ranged?.smiteTargeted && !clearLineToPlayer(monster) ? [monster, state] : lineCells(monster, state);
      }

      function addEffect(kind, cells) {
        if (effectTimer) {
          clearTimeout(effectTimer);
          effectTimer = 0;
        }
        state.effects.push({ kind, cells: uniqueCells(cells).map((cell) => ({ x: cell.x, y: cell.y })) });
        state.effects = state.effects.slice(-8);
      }

      function spellEffectKind(ranged) {
        if (ranged?.effect) return ranged.effect;
        if (ranged?.element === "fire") return "flame";
        if (ranged?.element === "cold") return "ice";
        if (ranged?.element === "poison" || ranged?.element === "acid") return "poison";
        if (ranged?.element === "elec" || ranged?.spell === "SPELL_SMITING") return "smite";
        if (ranged?.status === "dazed" || ranged?.status === "slow" || ranged?.status === "drain") return "fear";
        if (ranged?.status === "snared") return "impact";
        return "magic";
      }

      function hurtLiveMember(basePower, spread, element = null) {
        const defender = liveMember();
        if (!defender) return null;
        const difficultyScale = state.difficulty === "easy" ? 0.75 : state.difficulty === "hard" ? 1.25 : 1;
        const stanceGuard = typeof stanceDefenseBonus === "function" ? stanceDefenseBonus() : 0;
        const armorRune = typeof armorEnchantBonus === "function" ? armorEnchantBonus(defender) : 0;
        const bloodlineGuard = typeof bloodlineDefenseBonus === "function" ? bloodlineDefenseBonus(defender) : 0;
        const mutationGuard = typeof mutationDefenseBonus === "function" ? mutationDefenseBonus(defender) : 0;
        const thornGuard = typeof herbThornsDefenseBonus === "function" ? herbThornsDefenseBonus() : 0;
        const resonanceGuard = typeof resonanceDefenseBonus === "function" ? resonanceDefenseBonus(defender) : 0;
        const totemGuard = typeof totemWardBonus === "function" ? totemWardBonus() : 0;
        const harvestGuard  = typeof harvestDefenseBonus  === "function" ? harvestDefenseBonus()           : 0;
        const cookingGuard  = typeof cookingDefenseBonus  === "function" ? cookingDefenseBonus()           : 0;
        const skyGuard      = typeof constellationDefenseBonus === "function" ? constellationDefenseBonus() : 0;
        const baseDamage = Math.max(1, Math.round((basePower + Math.random() * spread) * difficultyScale - memberDefense(defender) - stanceGuard - armorRune - bloodlineGuard - mutationGuard - thornGuard - resonanceGuard - totemGuard - harvestGuard - cookingGuard - skyGuard));
        const shieldedDamage = typeof consumeSpiritShield === "function" ? consumeSpiritShield(baseDamage) : baseDamage;
        const psiBlocked     = typeof absorbPsiShield     === "function" ? absorbPsiShield(shieldedDamage) : shieldedDamage;
        const damage = partyElementDamage(psiBlocked, element);
        defender.hp = Math.max(0, defender.hp - damage);
        addDamageMark(state, element, damage);
        state.damageTaken = (state.damageTaken || 0) + damage;
        if (damage > 0) state.killCombo = 0; // taking a hit breaks the combo
        if (damage > 0 && typeof pulse === "function") pulse("hit");
        if (damage > 0 && typeof queueFloater === "function") queueFloater(`-${damage}`, "hurt");
        if (damage >= 8 && typeof shakeViewport === "function") shakeViewport(1);
        return { defender, baseDamage, damage };
      }

      function attackVerb(type) {
        if (type === "hit") return "hits";
        if (type === "bite") return "bites";
        if (type === "claw") return "claws";
        if (type === "sting") return "stings";
        return `${type.replace(/_/g, " ")}s`;
      }

      function applyMonsterTraits(monster, attack, defender) {
        const messages = [];
        const flavor = attack.flavor || "";
        if (attack.flavor === "drain") {
          const loss = Math.max(1, Math.floor(attack.damage / 8));
          defender.maxHp = Math.max(1, defender.maxHp - loss);
          defender.hp = Math.min(defender.hp, defender.maxHp);
          messages.push(`${defender.name} is drained.`);
        }
        if (attack.flavor === "blink_with") {
          const blinkMessage = blinkPartyAway();
          if (blinkMessage) messages.push(blinkMessage);
        }
        if (flavor.startsWith("poison") && monster.traits?.poisonTurns) {
          state.poisonedTurns = Math.max(state.poisonedTurns, monster.traits.poisonTurns);
          addEffect("poison", [{ x: state.x, y: state.y }]);
          messages.push(`${defender.name} is poisoned.`);
        }
        if ((flavor === "crush" || flavor === "ensnare") && monster.traits?.snareTurns) {
          state.snaredTurns = Math.max(state.snaredTurns, monster.traits.snareTurns);
          messages.push(`${defender.name} is pinned.`);
        }
        if (flavor === "elec" && monster.traits?.electricDamage) {
          const shock = resistedDamage(Math.max(1, Math.ceil(monster.traits.electricDamage / 8)));
          defender.hp = Math.max(0, defender.hp - shock);
          addEffect("smite", lineCells(monster, state));
          messages.push(`Lightning arcs for ${shock}.`);
        }
        if (flavor === "confuse" && monster.traits?.confuseTurns) {
          state.dazedTurns = Math.max(state.dazedTurns, monster.traits.confuseTurns);
          addEffect("fear", [{ x: state.x, y: state.y }]);
          messages.push(`${defender.name} is dazed.`);
        }
        if (flavor === "acid" && monster.traits?.acidDamage) {
          const burn = resistedDamage(Math.max(1, Math.ceil(monster.traits.acidDamage / 10)));
          defender.hp = Math.max(0, defender.hp - burn);
          state.corrodedTurns = Math.max(state.corrodedTurns, 5);
          addEffect("poison", [{ x: state.x, y: state.y }]);
          addDamageMark(state, "acid", burn);
          messages.push(`Acid burns for ${burn}. Armour corrodes.`);
        }
        if ((flavor === "fire" || flavor === "pure_fire") && monster.traits?.fireDamage) {
          const burn = resistedDamage(Math.max(1, Math.ceil(monster.traits.fireDamage / 10)));
          defender.hp = Math.max(0, defender.hp - burn);
          addEffect("flame", [{ x: state.x, y: state.y }]);
          addDamageMark(state, "fire", burn);
          messages.push(`Flame burns for ${burn}.`);
        }
        if (flavor === "cold" && monster.traits?.coldDamage) {
          const chill = resistedDamage(Math.max(1, Math.ceil(monster.traits.coldDamage / 10)));
          defender.hp = Math.max(0, defender.hp - chill);
          addEffect("ice", [{ x: state.x, y: state.y }]);
          addDamageMark(state, "cold", chill);
          messages.push(`Cold bites for ${chill}.`);
        }
        if (flavor === "vampiric" && monster.traits?.vampiricDamage) {
          const healed = Math.max(1, Math.ceil(monster.traits.vampiricDamage / 8));
          monster.hp = Math.min(monster.maxHp, monster.hp + healed);
          messages.push(`${monster.name} drinks back ${healed} hp.`);
        }
        if (flavor === "drag" && monster.traits?.dragDamage) {
          const dragged = dragPartyFrom(monster);
          if (dragged) messages.push(dragged);
        }
        if (flavor === "flood" && monster.traits?.floodTurns) {
          addEffect("ice", [{ x: state.x, y: state.y }]);
          if (waterAdapted()) messages.push("Water rolls off.");
          else {
            state.engulfedTurns = Math.max(state.engulfedTurns, monster.traits.floodTurns);
            messages.push(`${defender.name} is engulfed.`);
          }
        }
        if (flavor === "drown" && monster.traits?.drownDamage) {
          addEffect("ice", [{ x: state.x, y: state.y }]);
          if (waterAdapted()) messages.push("Water rolls off.");
          else {
            const drown = resistedDamage(Math.max(1, Math.ceil(monster.traits.drownDamage / 6)));
            defender.hp = Math.max(0, defender.hp - drown);
            state.engulfedTurns = Math.max(state.engulfedTurns, 3);
            messages.push(`Water fills ${defender.name}'s lungs for ${drown}.`);
          }
        }
        if (flavor === "rage" && monster.traits?.rageTurns) {
          state.rageTurns = Math.max(state.rageTurns, monster.traits.rageTurns);
          state.mightTurns = Math.max(state.mightTurns, monster.traits.rageTurns);
          state.hasteTurns = Math.max(state.hasteTurns, monster.traits.rageTurns);
          addEffect("halo", [{ x: state.x, y: state.y }]);
          messages.push(`${defender.name} flies into a rage.`);
        }
        if (flavor === "poison_paralyse" && monster.traits?.paralyseTurns) {
          state.snaredTurns = Math.max(state.snaredTurns, monster.traits.paralyseTurns);
          addEffect("fear", [{ x: state.x, y: state.y }]);
          messages.push(`${defender.name} locks up.`);
        }
        if (flavor === "barbs" && monster.traits?.barbedTurns) {
          state.barbedTurns = Math.max(state.barbedTurns, monster.traits.barbedTurns);
          addEffect("impact", [{ x: state.x, y: state.y }]);
          messages.push("Barbs lodge deep.");
        }
        return messages.length > 0 ? ` ${messages.join(" ")}` : "";
      }

      function dragPartyFrom(monster) {
        const origin = { x: state.x, y: state.y };
        const terrainRank = (cell) => terrainAt(cell.x, cell.y) === "water" || terrainAt(cell.x, cell.y) === "deep-water" ? 0 : 1;
        const distanceToMonster = (cell) => Math.abs(cell.x - monster.x) + Math.abs(cell.y - monster.y);
        const landing = cellsNear(state, 1)
          .filter((cell) => cell.x !== state.x || cell.y !== state.y)
          .filter((cell) => !monsterAt(cell.x, cell.y) && !trapAt(cell.x, cell.y))
          .sort((a, b) => terrainRank(a) - terrainRank(b) || distanceToMonster(a) - distanceToMonster(b))[0];
        if (!landing) return "";
        state.x = landing.x;
        state.y = landing.y;
        reveal();
        addEffect("impact", [origin, landing, monster]);
        return terrainRank(landing) === 0 ? "The party is dragged into the water." : "The party is dragged through the muck.";
      }

      function blinkPartyAway() {
        const facing = dirAt(0);
        const candidates = [
          { x: state.x - facing.x, y: state.y - facing.y },
          { x: state.x + dirAt(-1).x, y: state.y + dirAt(-1).y },
          { x: state.x + dirAt(1).x, y: state.y + dirAt(1).y },
          { x: state.x + facing.x, y: state.y + facing.y }
        ];
        const landing = candidates.find((candidate) => !solidAt(candidate.x, candidate.y) && !monsterAt(candidate.x, candidate.y));
        if (!landing) return "";
        state.x = landing.x;
        state.y = landing.y;
        reveal();
        return "Space buckles.";
      }

      function monsterMelee(monster, messages) {
        const attacks = monster.attacks?.length ? monster.attacks : [{ type: "hit", flavor: null, damage: monster.power || 3 }];
        const weakenedScale = (monster.weakenedTurns || 0) > 0 ? 0.5 : 1;
        for (const attack of attacks) {
          const baseBlow = (attack.damage * weakenedScale) / 3 + ((monster.mightTurns || 0) > 0 ? 2 : 0) + ((monster.rageTurns || 0) > 0 ? 2 : 0);
          const hit = hurtLiveMember(baseBlow, 3);
          if (!hit || !hit.defender) return true;
          addEffect("impact", [{ x: state.x, y: state.y }]);
          // Heavy hits sometimes stun or bleed the party.
          let aftermath = "";
          if (hit.damage > 0 && hit.defender.maxHp > 0 && hit.damage >= Math.max(6, Math.ceil(hit.defender.maxHp / 3))) {
            if (Math.random() < 0.35) {
              state.stunnedTurns = Math.max(state.stunnedTurns || 0, 1);
              aftermath += " The blow stuns.";
            } else if (attack.type === "claw" || attack.type === "bite" || attack.type === "sting") {
              state.bleedingTurns = Math.max(state.bleedingTurns || 0, 3);
              aftermath += " Wounds bleed.";
            }
          }
          // Fire-element attacks can set the party burning.
          if (attack.flavor === "fire" || attack.element === "fire") {
            state.burningTurns = Math.max(state.burningTurns || 0, 3);
            aftermath += " Flames cling to the party.";
          }
          messages.push(`${monster.name} ${attackVerb(attack.type)} ${hit.defender.name} for ${hit.damage}.${applyMonsterTraits(monster, attack, hit.defender)}${aftermath}`);
          if (!liveMember()) {
            state.defeated = true;
            state.message = `${hit.defender.name} falls. The dungeon takes the party.`;
            return true;
          }
        }
        return false;
      }

      function tickPoison(messages) {
        if (state.poisonedTurns <= 0) return false;
        const target = liveMember();
        if (!target) return false;
        target.hp = Math.max(0, target.hp - 1);
        state.poisonedTurns -= 1;
        addFloorMark("poison", state.x, state.y, 1);
        messages.push(`Poison burns ${target.name} for 1.`);
        if (!liveMember()) {
          state.defeated = true;
          state.message = `${target.name} falls to poison.`;
          return true;
        }
        if (state.poisonedTurns === 0) messages.push("The poison fades.");
        return false;
      }

      function tickEngulfed(messages) {
        if (state.engulfedTurns <= 0) return false;
        const target = liveMember();
        if (!target) return false;
        state.engulfedTurns -= 1;
        if (waterAdapted()) {
          if (state.engulfedTurns === 0) messages.push("The water drains away.");
          return false;
        }
        target.hp = Math.max(0, target.hp - 1);
        addEffect("ice", [{ x: state.x, y: state.y }]);
        messages.push(`Engulfing water chokes ${target.name} for 1.`);
        if (!liveMember()) {
          state.defeated = true;
          state.message = `${target.name} drowns.`;
          return true;
        }
        if (state.engulfedTurns === 0) messages.push("The water drains away.");
        return false;
      }

      function tickClouds(messages) {
        const floorState = currentFloorState();
        for (const cloud of floorState.clouds) {
          const kind = cloud.kind || "fog";
          if (kind !== "poison" && kind !== "flame") continue;
          const monster = monsterAt(cloud.x, cloud.y);
          if (!monster) continue;
          const element = kind === "flame" ? "fire" : "poison";
          const baseDamage = kind === "flame" ? Math.max(2, Math.ceil((monster.hd || 1) / 2)) : Math.max(1, Math.ceil((monster.hd || 1) / 3));
          const damage = monsterElementDamage(monster, baseDamage, element);
          monster.hp = Math.max(0, monster.hp - damage);
          addDamageMark(monster, element, damage);
          if (kind === "flame") addFloorMark("scorch", cloud.x, cloud.y, 1);
          const damageText = kind === "flame" ? `${monster.name} burns in flame for ${damage}.` : `${monster.name} chokes in poison for ${damage}.`;
          messages.push(damage > 0 ? `${damageText}${monsterDamageNote(baseDamage, damage)}` : `${monster.name} ignores the ${kind}.`);
          if (monster.hp === 0) messages.push(`${monster.name} dies. ${killMonster(monster)}`.trim());
        }

        const partyCloud = cloudAt(state.x, state.y);
        if (partyCloud?.kind === "poison") {
          const target = liveMember();
          if (!target) return true;
          target.hp = Math.max(0, target.hp - 1);
          state.poisonedTurns = Math.max(state.poisonedTurns, 4);
          addFloorMark("poison", state.x, state.y, 1);
          messages.push(`${target.name} coughs in poison.`);
          if (!liveMember()) {
            state.defeated = true;
            state.message = `${target.name} falls in poison.`;
            return true;
          }
        }
        if (partyCloud?.kind === "flame") {
          const target = liveMember();
          if (!target) return true;
          const baseDamage = fireAdapted() ? 1 : 3;
          const damage = partyElementDamage(baseDamage, "fire");
          target.hp = Math.max(0, target.hp - damage);
          addEffect("flame", [{ x: state.x, y: state.y }]);
          addFloorMark("scorch", state.x, state.y, 1);
          messages.push(`Flames scorch ${target.name} for ${damage}.`);
          if (!liveMember()) {
            state.defeated = true;
            state.message = `${target.name} burns in flame.`;
            return true;
          }
        }
        if (partyCloud?.kind === "petrify") {
          state.vitrifiedTurns = Math.max(state.vitrifiedTurns, 3);
          addEffect("impact", [{ x: state.x, y: state.y }]);
          messages.push("Petrifying dust hardens across the party.");
        }

        floorState.clouds = floorState.clouds
          .map((cloud) => ({ ...cloud, turns: cloud.turns - 1 }))
          .filter((cloud) => cloud.turns > 0);
        return false;
      }

      function tickMonsterPoison(monster, floorState, messages) {
        if ((monster.poisonedTurns || 0) <= 0) return false;
        const visible = floorState.discovered.has(keyOf(monster.x, monster.y));
        monster.poisonedTurns -= 1;
        const baseDamage = Math.max(1, monster.poisonPower || Math.ceil((monster.hd || 1) / 3));
        const damage = monsterElementDamage(monster, baseDamage, "poison");
        monster.hp = Math.max(0, monster.hp - damage);
        addDamageMark(monster, "poison", damage);
        if (visible) messages.push(damage > 0 ? `${monster.name} sickens for ${damage}.${monsterDamageNote(baseDamage, damage)}` : `${monster.name} resists the poison.`);
        if (monster.hp === 0) {
          messages.push(`${monster.name} dies. ${killMonster(monster)}`.trim());
          return true;
        }
        if (monster.poisonedTurns === 0 && visible) messages.push(`${monster.name} fights off poison.`);
        return false;
      }

      function toxicWaterAt(x, y) {
        const terrain = terrainAt(x, y);
        return (terrain === "water" || terrain === "deep-water") && (currentAssets().water || "").includes("toxic_bog");
      }

      function tickTerrain(messages) {
        const terrain = terrainAt(state.x, state.y);
        if (terrain === "floor") return false;
        const target = liveMember();
        if (!target) return true;

        if (terrain === "lava") {
          const damage = resistedDamage(fireAdapted() ? 1 : 4);
          target.hp = Math.max(0, target.hp - damage);
          addEffect("flame", [{ x: state.x, y: state.y }]);
          addFloorMark("scorch", state.x, state.y, 1);
          messages.push(`Lava sears ${target.name} for ${damage}.`);
        }
        if (terrain === "deep-water" && !waterAdapted()) {
          target.hp = Math.max(0, target.hp - 1);
          addEffect("ice", [{ x: state.x, y: state.y }]);
          messages.push(`Deep water drags ${target.name} for 1.`);
        }
        if (toxicWaterAt(state.x, state.y) && !poisonAdapted()) {
          state.poisonedTurns = Math.max(state.poisonedTurns, 4);
          addEffect("poison", [{ x: state.x, y: state.y }]);
          addFloorMark("poison", state.x, state.y, 1);
          messages.push("Toxic bog poisons the party.");
        }
        if (!liveMember()) {
          state.defeated = true;
          state.message = `${target.name} is lost to the terrain.`;
          return true;
        }
        return false;
      }

      function shouldKeepActionMessage(message) {
        return message && message !== "Boots scrape across old floor." && !message.startsWith("Facing ");
      }

      function appendTurnMessages(messages) {
        if (messages.length === 0) return;
        const turnMessage = messages.slice(0, 2).join(" ");
        state.message = shouldKeepActionMessage(state.message) ? `${state.message} ${turnMessage}` : turnMessage;
      }

      function monsterSupportTargets(monster, floorState) {
        const support = monster.support;
        if (!support) return [];
        return floorState.monsters
          .filter((target) => target.hp > 0 && distanceToPlayer(target) <= 7 && Math.abs(target.x - monster.x) + Math.abs(target.y - monster.y) <= support.range)
          .filter((target) => target === monster || clearLineBetween(monster, target));
      }

      function monsterSupportTarget(monster, floorState) {
        const support = monster.support;
        const targets = monsterSupportTargets(monster, floorState);
        if (support.kind === "heal") {
          return targets.filter((target) => target.hp < target.maxHp)
            .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || null;
        }
        if (support.kind === "haste") {
          return targets.filter((target) => (target.hasteTurns || 0) <= 0)
            .sort((a, b) => distanceToPlayer(a) - distanceToPlayer(b))[0] || null;
        }
        if (support.kind === "might") {
          return targets.filter((target) => (target.mightTurns || 0) <= 0)
            .sort((a, b) => distanceToPlayer(a) - distanceToPlayer(b))[0] || null;
        }
        return null;
      }

      function encircleDestinations(ally) {
        return cellsNear(state, 1)
          .filter((cell) => cell.x !== state.x || cell.y !== state.y)
          .filter((cell) => !monsterAt(cell.x, cell.y) && !trapAt(cell.x, cell.y))
          .filter((cell) => monsterCanEnterTerrain(ally, terrainAt(cell.x, cell.y)))
          .sort((a, b) => cellHash(a.x, a.y, 307) - cellHash(b.x, b.y, 307));
      }

      function castMonsterEncircle(monster, floorState, support, messages) {
        const allies = monsterSupportTargets(monster, floorState)
          .filter((target) => target !== monster && distanceToPlayer(target) > 1 && (target.rootedTurns || 0) <= 0)
          .sort((a, b) => distanceToPlayer(b) - distanceToPlayer(a));
        const effectCells = [monster];
        const moved = [];

        for (const ally of allies) {
          const destination = encircleDestinations(ally)[0];
          if (!destination) continue;
          effectCells.push({ x: ally.x, y: ally.y }, destination);
          ally.x = destination.x;
          ally.y = destination.y;
          moved.push(ally);
        }

        if (moved.length === 0) return false;
        monster.supportCooldown = support.cooldown || 8;
        addEffect(support.effect || "blink", effectCells);
        messages.push(`${monster.name}'s ${support.name} rings the party with ${moved.length === 1 ? moved[0].name : "allies"}.`);
        return true;
      }

      function tideCells() {
        return cellsNear(state, 2)
          .filter((cell) => terrainAt(cell.x, cell.y) === "floor")
          .filter((cell) => !closedDoorAt(cell.x, cell.y));
      }

      function castMonsterTide(monster, support, messages) {
        const cells = tideCells();
        if (cells.length === 0) return false;
        for (const cell of cells) {
          setCellAt(cell.x, cell.y, "w");
          currentFloorState().discovered.add(keyOf(cell.x, cell.y));
        }
        monster.supportCooldown = support.cooldown || 8;
        addEffect(support.effect || "ice", cells);
        messages.push(`${monster.name}'s ${support.name} floods ${cells.length} tile${cells.length === 1 ? "" : "s"}.`);
        return true;
      }

      function castMonsterSupport(monster, floorState, messages) {
        const support = monster.support;
        if (!support || state.silenceTurns > 0 || (monster.supportCooldown || 0) > 0) return false;
        if (support.kind === "encircle") return castMonsterEncircle(monster, floorState, support, messages);
        if (support.kind === "tide") return castMonsterTide(monster, support, messages);
        const target = monsterSupportTarget(monster, floorState);
        if (!target) return false;
        monster.supportCooldown = support.cooldown || 5;
        addEffect(support.effect || "halo", [target]);
        if (support.kind === "heal") {
          const healed = Math.min(support.power || 8, target.maxHp - target.hp);
          target.hp += healed;
          messages.push(`${monster.name}'s ${support.name} restores ${healed} to ${target.name}.`);
          return true;
        }
        if (support.kind === "haste") {
          target.hasteTurns = Math.max(target.hasteTurns || 0, support.turns || 6);
          messages.push(`${monster.name}'s ${support.name} quickens ${target.name}.`);
          return true;
        }
        if (support.kind === "might") {
          target.mightTurns = Math.max(target.mightTurns || 0, support.turns || 6);
          messages.push(`${monster.name}'s ${support.name} rouses ${target.name}.`);
          return true;
        }
        return false;
      }

      function castMonsterSelf(monster, messages) {
        const self = monster.self;
        if (!self || state.silenceTurns > 0 || (monster.selfCooldown || 0) > 0) return false;
        if (self.kind === "rage") {
          if ((monster.rageTurns || 0) > 0 || monster.hp / monster.maxHp > (self.hpRatio || 0.65)) return false;
          const turns = self.turns || 8;
          monster.rageTurns = Math.max(monster.rageTurns || 0, turns);
          monster.mightTurns = Math.max(monster.mightTurns || 0, turns);
          monster.hasteTurns = Math.max(monster.hasteTurns || 0, Math.ceil(turns / 2));
          monster.selfCooldown = self.cooldown || 12;
          addEffect(self.effect || "halo", [monster]);
          messages.push(`${monster.name} flies into a rage.`);
          return true;
        }
        return false;
      }

      function summonTemplate(sourceName) {
        const normalized = sourceName.replace(/-/g, "_");
        return resources.floors.flatMap((floor) => floor.encounters).find((monster) => monster.id.startsWith(`${normalized}-`));
      }

      function summonDestinations(monster, template, summon) {
        return cellsNear(monster, summon.range || 2)
          .filter((cell) => cell.x !== state.x || cell.y !== state.y)
          .filter((cell) => !monsterAt(cell.x, cell.y) && !trapAt(cell.x, cell.y))
          .filter((cell) => monsterCanEnterTerrain(template, terrainAt(cell.x, cell.y)))
          .sort((a, b) => Math.abs(a.x - state.x) + Math.abs(a.y - state.y) - Math.abs(b.x - state.x) - Math.abs(b.y - state.y));
      }

      function createSummonedMonster(template, cell, summon) {
        state.summonSerial += 1;
        return {
          ...template,
          id: `summoned-${state.floorIndex}-${state.summonSerial}`,
          x: cell.x,
          y: cell.y,
          hp: template.maxHp,
          energy: 0,
          summoned: true,
          summonTurns: summon.turns || 16
        };
      }

      function castMonsterSummon(monster, floorState, messages) {
        const summon = monster.summon;
        if (!summon || state.silenceTurns > 0 || (monster.summonCooldown || 0) > 0) return false;
        const activeSummons = floorState.monsters.filter((entry) => entry.summoned && entry.hp > 0 && distanceToPlayer(entry) <= 8).length;
        if (activeSummons >= 5) return false;

        const spawned = [];
        for (const ally of summon.allies || []) {
          const template = summonTemplate(ally);
          if (!template) continue;
          const cells = summonDestinations(monster, template, summon).filter((cell) => !spawned.some((entry) => entry.x === cell.x && entry.y === cell.y));
          if (cells.length === 0) continue;
          spawned.push(createSummonedMonster(template, cells[0], summon));
          if (spawned.length >= (summon.count || 1)) break;
        }

        if (spawned.length === 0) return false;
        floorState.monsters.push(...spawned);
        monster.summonCooldown = summon.cooldown || 9;
        addEffect(summon.effect || "halo", [monster, ...spawned]);
        messages.push(`${monster.name} calls ${spawned.length === 1 ? spawned[0].name : summon.group || "allies"} from the dark.`);
        return true;
      }

      function monsterBlinkDestinations(monster, mobility) {
        const cells = [];
        const currentDistance = distanceToPlayer(monster);
        const range = mobility.range || 4;
        for (let y = monster.y - range; y <= monster.y + range; y += 1) {
          for (let x = monster.x - range; x <= monster.x + range; x += 1) {
            const blinkRange = Math.abs(x - monster.x) + Math.abs(y - monster.y);
            if (blinkRange < 1 || blinkRange > range) continue;
            if (!monsterCanMoveTo(monster, x, y)) continue;
            const playerDistance = Math.abs(x - state.x) + Math.abs(y - state.y);
            if (mobility.kind === "close" && playerDistance >= currentDistance) continue;
            if (mobility.kind === "away" && playerDistance <= currentDistance) continue;
            cells.push({ x, y, playerDistance, blinkRange });
          }
        }

        if (mobility.kind === "close") return cells.sort((a, b) => a.playerDistance - b.playerDistance || a.blinkRange - b.blinkRange);
        if (mobility.kind === "away") return cells.sort((a, b) => b.playerDistance - a.playerDistance || a.blinkRange - b.blinkRange);
        return cells.sort((a, b) => b.playerDistance - a.playerDistance || a.blinkRange - b.blinkRange);
      }

      function castMonsterMobility(monster, messages) {
        const mobility = monster.mobility;
        const distance = distanceToPlayer(monster);
        if (!mobility || state.silenceTurns > 0 || (monster.mobilityCooldown || 0) > 0) return false;
        if (mobility.kind === "close" && distance <= 2) return false;
        if (mobility.kind === "away" && distance > 3) return false;
        if (mobility.kind === "random" && distance > 3 && monster.hp >= monster.maxHp) return false;

        const destinations = monsterBlinkDestinations(monster, mobility);
        if (destinations.length === 0) return false;
        const origin = { x: monster.x, y: monster.y };
        const landing = destinations[0];
        monster.x = landing.x;
        monster.y = landing.y;
        monster.mobilityCooldown = mobility.cooldown || 6;
        addEffect(mobility.effect || "blink", [origin, landing]);
        if (mobility.kind === "close") messages.push(`${monster.name} blinks closer.`);
        else if (mobility.kind === "away") messages.push(`${monster.name} blinks away.`);
        else messages.push(`${monster.name} blinks.`);
        return true;
      }

      function monsterVisionRange() {
        if (context.stealthDisabled) return 6;
        const rogues = state.party.filter((m) => m.hp > 0 && m.classKey === "rogue").length;
        const talentStealth = typeof talentExtraStealth === "function" ? talentExtraStealth() : 0;
        return Math.max(2, 6 - rogues * 2 - talentStealth);
      }

      function checkMonsterAlertness(monster) {
        if (monster.alerted) return true;
        if (context.stealthDisabled) {
          monster.alerted = true;
          return true;
        }
        const distance = distanceToPlayer(monster);
        if (distance <= 1) { monster.alerted = true; return true; }
        if (distance > monsterVisionRange()) return false;
        if (!clearLineBetween(monster, state)) return false;
        monster.alerted = true;
        return true;
      }

      function confusedMonsterAction(monster, floorState, messages) {
        const discovered = floorState.discovered.has(keyOf(monster.x, monster.y));
        // 50/50: lash out at an adjacent creature (infighting), else stumble.
        if (Math.random() < 0.5) {
          const adjacent = floorState.monsters.find((other) =>
            other !== monster && other.hp > 0 &&
            Math.abs(other.x - monster.x) + Math.abs(other.y - monster.y) === 1
          );
          if (adjacent) {
            const dmg = Math.max(1, Math.round((monster.attacks?.[0]?.damage || monster.power || 3) / 3 + Math.random() * 2));
            adjacent.hp = Math.max(0, adjacent.hp - dmg);
            if (typeof addDamageMark === "function") addDamageMark(adjacent, null, dmg);
            if (discovered) messages.push(`${monster.name} lashes out at ${adjacent.name} for ${dmg} in confusion.`);
            if (adjacent.hp === 0 && typeof killMonster === "function") {
              const note = killMonster(adjacent);
              if (note && discovered) messages.push(note);
            }
            return false;
          }
        }
        // Stumble in a random direction.
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        if (monsterCanMoveTo(monster, monster.x + dir.x, monster.y + dir.y)) {
          monster.x += dir.x;
          monster.y += dir.y;
        }
        if (discovered) messages.push(`${monster.name} staggers, confused.`);
        return false;
      }

      function monsterAction(monster, floorState, messages) {
        if ((monster.confusedTurns || 0) > 0) {
          return confusedMonsterAction(monster, floorState, messages);
        }
        const distance = distanceToPlayer(monster);
        const discovered = floorState.discovered.has(keyOf(monster.x, monster.y));
        if (discovered && monster.traits?.maintainRange && monster.ranged && distance <= 2 && monsterFlee(monster)) {
          messages.push(`${monster.name} keeps its distance.`);
          return false;
        }

        if (distance === 1) {
          monster.alerted = true;
          return monsterMelee(monster, messages);
        }

        if (!checkMonsterAlertness(monster)) return false;

        if (distance === 2 && monster.traits?.reachDamage && discovered && clearLineToPlayer(monster)) {
          messages.push(`${monster.name} stretches forward.`);
          return monsterMelee(monster, messages);
        }

        if (discovered && castMonsterSelf(monster, messages)) return false;

        if (discovered && castMonsterSummon(monster, floorState, messages)) return false;

        if (discovered && castMonsterMobility(monster, messages)) return false;

        if (discovered && castMonsterSupport(monster, floorState, messages)) return false;

        if (state.silenceTurns <= 0 && discovered && rangedCanTargetPlayer(monster)) {
          const defender = liveMember();
          const rangedPower = monster.ranged.power + ((monster.mightTurns || 0) > 0 ? 2 : 0);
          const hit = rangedPower > 0 ? hurtLiveMember(rangedPower, 2, monster.ranged.element) : { defender, baseDamage: 0, damage: 0 };
          if (!hit) return true;
          addEffect(spellEffectKind(monster.ranged), rangedEffectCells(monster));
          if (monster.ranged.cloud) spreadCloud(monster.ranged.cloud, 4, cellsNear(state, 1));
          const statusNote = applyRangedStatus(monster.ranged, hit, monster);
          const hitText = rangedPower > 0 ? `hits ${hit.defender.name} for ${hit.damage}.${partyDamageNote(hit)}` : `catches ${hit.defender.name}.`;
          messages.push(`${monster.name}'s ${monster.ranged.name} ${hitText}${statusNote}`);
          if (!liveMember()) {
            state.defeated = true;
            state.message = `${hit.defender.name} falls. The dungeon takes the party.`;
            return true;
          }
          return false;
        }

        if (distance > 6 || !discovered) return false;
        const step = monsterStepOptions(monster).find((candidate) => monsterCanMoveTo(monster, candidate.x, candidate.y));
        if (step) {
          monster.x = step.x;
          monster.y = step.y;
          triggerPlayerTrap(monster, messages);
        }
        return false;
      }

      // Player-laid traps detonate on the first monster to step on them.
      function triggerPlayerTrap(monster, messages) {
        if (monster.hp <= 0) return;
        const floorState = currentFloorState();
        const trap = floorState.traps.find((t) => t.armed && t.playerLaid && t.x === monster.x && t.y === monster.y);
        if (!trap) return;
        trap.armed = false;
        const dmg = Math.max(1, trap.power || 8);
        monster.hp = Math.max(0, monster.hp - dmg);
        addDamageMark(monster, null, dmg);
        addEffect("impact", [{ x: monster.x, y: monster.y }]);
        if (floorState.discovered.has(keyOf(monster.x, monster.y))) {
          messages.push(`${monster.name} springs ${trap.name} for ${dmg}.`);
        }
        if (monster.hp === 0 && typeof killMonster === "function") {
          const note = killMonster(monster);
          if (note && floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(note);
        }
      }

      function advanceTurn() {
        if (state.victory || state.defeated) {
          if (typeof saveGame === "function") saveGame();
          return;
        }
        state.turnCount += 1;
        state.floorTurnCount = (state.floorTurnCount || 0) + 1;
        if (typeof tickClassCooldowns === "function") tickClassCooldowns();
        if (typeof settleQuestRewards === "function") settleQuestRewards();
        const messages = [];
        // Allies act on the party's side, before the monsters take their turn.
        if (typeof runAllyTurns === "function") runAllyTurns(messages);
        if (tickPoison(messages)) return;
        if (tickEngulfed(messages)) return;
        const hasted = state.hasteTurns > 0;
        if (state.hasteTurns > 0) {
          state.hasteTurns -= 1;
          if (state.hasteTurns === 0) messages.push("Haste fades.");
        }
        if (state.mightTurns > 0) {
          state.mightTurns -= 1;
          if (state.mightTurns === 0) messages.push("Might fades.");
        }
        if (state.rageTurns > 0) {
          state.rageTurns -= 1;
          if (state.rageTurns === 0) messages.push("Rage fades.");
        }
        if (state.resistanceTurns > 0) {
          state.resistanceTurns -= 1;
          if (state.resistanceTurns === 0) messages.push("Resistance fades.");
        }
        if (state.silenceTurns > 0) {
          state.silenceTurns -= 1;
          if (state.silenceTurns === 0) messages.push("Sound returns.");
        }
        if (state.snaredTurns > 0) {
          state.snaredTurns -= 1;
          if (state.snaredTurns === 0) messages.push("The net slackens.");
        }
        if (state.barbedTurns > 0) {
          state.barbedTurns -= 1;
          if (state.barbedTurns === 0) messages.push("The barbs fall away.");
        }
        const slowed = state.slowedTurns > 0;
        if (state.slowedTurns > 0) {
          state.slowedTurns -= 1;
          if (state.slowedTurns === 0) messages.push("The party moves freely again.");
        }
        if (state.dazedTurns > 0) {
          state.dazedTurns -= 1;
          if (state.dazedTurns === 0) messages.push("The haze clears.");
        }
        if (state.corrodedTurns > 0) {
          state.corrodedTurns -= 1;
          if (state.corrodedTurns === 0) messages.push("The corrosion flakes away.");
        }
        if (state.vitrifiedTurns > 0) {
          state.vitrifiedTurns -= 1;
          if (state.vitrifiedTurns === 0) messages.push("The glassy skin fades.");
        }
        if (state.bleedingTurns > 0) {
          state.bleedingTurns -= 1;
          const target = liveMember();
          if (target) {
            const bleed = Math.max(1, Math.ceil(target.maxHp / 24));
            target.hp = Math.max(0, target.hp - bleed);
            state.damageTaken = (state.damageTaken || 0) + bleed;
            addDamageMark(state, null, bleed);
            messages.push(`${target.name} bleeds for ${bleed}.`);
            if (!liveMember()) {
              state.defeated = true;
              state.message = `${target.name} bleeds out.`;
              if (typeof saveGame === "function") saveGame();
              return;
            }
          }
          if (state.bleedingTurns === 0) messages.push("The bleeding stops.");
        }
        if (state.burningTurns > 0) {
          state.burningTurns -= 1;
          const target = liveMember();
          if (target) {
            const baseBurn = Math.max(1, Math.ceil(target.maxHp / 18));
            const burn = partyElementDamage(baseBurn, "fire");
            target.hp = Math.max(0, target.hp - burn);
            state.damageTaken = (state.damageTaken || 0) + burn;
            addDamageMark(state, "fire", burn);
            messages.push(`${target.name} burns for ${burn}.`);
            if (!liveMember()) {
              state.defeated = true;
              state.message = `${target.name} is consumed by flame.`;
              if (typeof saveGame === "function") saveGame();
              return;
            }
          }
          if (state.burningTurns === 0) messages.push("The flames smother out.");
        }
        if (state.stunnedTurns > 0) {
          state.stunnedTurns -= 1;
          if (state.stunnedTurns === 0) messages.push("The stun passes.");
        }
        // Hunger ticks down every turn; once famished, each turn drains HP.
        if (!context.hungerDisabled) {
          state.satiety = Math.max(0, (state.satiety ?? 1000) - 1);
          if (state.satiety === 200) messages.push("The party feels the gnaw of hunger.");
          if (state.satiety === 50) messages.push("The party is starving.");
          if (state.satiety <= 0) {
            const target = liveMember();
            if (target) {
              const starveDamage = 1;
              target.hp = Math.max(0, target.hp - starveDamage);
              state.damageTaken = (state.damageTaken || 0) + starveDamage;
              messages.push(`${target.name} wastes away (-${starveDamage}).`);
              if (!liveMember()) {
                state.defeated = true;
                state.message = `${target.name} starves to death in the dark.`;
                if (typeof saveGame === "function") saveGame();
                return;
              }
            }
          }
        }
        if (tickTerrain(messages)) return;
        if (tickClouds(messages)) return;
        // Feature modules register per-turn hooks (deployables, frozen tiles,
        // ecology). Each is a no-op until something is actually placed/active.
        if (Array.isArray(context.turnHooks)) {
          for (const hook of context.turnHooks) {
            if (typeof hook === "function" && hook(messages) === true) return;
          }
        }
        const floorState = currentFloorState();
        if (hasted && state.turnCount % 2 === 1) {
          appendTurnMessages(messages);
          return;
        }
        if (runMonsterTurns(floorState, messages)) return;
        if (slowed && state.turnCount % 2 === 0) {
          messages.push("The dungeon takes the spare beat.");
          if (runMonsterTurns(floorState, messages)) return;
        }
        if (typeof processPursuitArrivals === "function") processPursuitArrivals(messages);
        if (typeof maybeSpawnWanderer === "function") {
          const wanderer = maybeSpawnWanderer();
          if (wanderer && currentFloorState().discovered.has(keyOf(wanderer.x, wanderer.y))) {
            messages.push(`A wandering ${wanderer.name} drifts into view.`);
          }
        }
        appendTurnMessages(messages);
        if (typeof saveGame === "function") saveGame();
      }

      function runMonsterTurns(floorState, messages) {
        for (const monster of floorState.monsters) {
          if (monster.hp <= 0) continue;
          if (monster.supportCooldown > 0) monster.supportCooldown -= 1;
          if (monster.mobilityCooldown > 0) monster.mobilityCooldown -= 1;
          if (monster.selfCooldown > 0) monster.selfCooldown -= 1;
          if (monster.summonCooldown > 0) monster.summonCooldown -= 1;
          if (monster.summonTurns > 0) {
            monster.summonTurns -= 1;
            if (monster.summonTurns === 0) {
              if (floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} fades.`);
              removeMonster(monster);
              continue;
            }
          }
          if (monster.hasteTurns > 0) monster.hasteTurns -= 1;
          if (monster.mightTurns > 0) monster.mightTurns -= 1;
          if (monster.slowedTurns > 0) monster.slowedTurns -= 1;
          if (monster.weakenedTurns > 0) monster.weakenedTurns -= 1;
          if (monster.silencedTurns > 0) monster.silencedTurns -= 1;
          if (monster.confusedTurns > 0) monster.confusedTurns -= 1;
          if (monster.rageTurns > 0) {
            monster.rageTurns -= 1;
            if (monster.rageTurns === 0 && floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name}'s rage fades.`);
          }
          if (monster.immolationTurns > 0) monster.immolationTurns -= 1;
          if (tickMonsterPoison(monster, floorState, messages)) continue;
          if (monster.rootedTurns > 0) {
            monster.rootedTurns -= 1;
            if (floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} strains against roots.`);
            if (monster.rootedTurns === 0 && floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} tears free.`);
            continue;
          }
          if (monster.fearTurns > 0) {
            monster.fearTurns -= 1;
            if (floorState.discovered.has(keyOf(monster.x, monster.y)) && monsterFlee(monster)) messages.push(`${monster.name} flees.`);
            if (monster.fearTurns === 0 && floorState.discovered.has(keyOf(monster.x, monster.y))) messages.push(`${monster.name} rallies.`);
            continue;
          }
          let monsterSpeed = (monster.speed || 10) + ((monster.hasteTurns || 0) > 0 ? 5 : 0) + ((monster.rageTurns || 0) > 0 ? 5 : 0);
          if ((monster.slowedTurns || 0) > 0) monsterSpeed = Math.max(2, Math.round(monsterSpeed / 2));
          monster.energy = (monster.energy || 0) + monsterSpeed;
          let actions = Math.min(3, Math.floor(monster.energy / 10));
          while (actions > 0) {
            monster.energy -= 10;
            actions -= 1;
            if (monsterAction(monster, floorState, messages)) return true;
            if (monster.hp <= 0) break;
          }
        }
        return false;
      }

      function predictMonsterIntent(monster) {
        if (!monster || monster.hp <= 0) return "down";
        if ((monster.rootedTurns || 0) > 0) return "rooted";
        if ((monster.fearTurns || 0) > 0) return "fleeing";
        if (!monster.alerted && !context.stealthDisabled) {
          if (distanceToPlayer(monster) > monsterVisionRange()) return "unaware";
          if (!clearLineBetween(monster, state)) return "unaware";
          return "spotted!";
        }
        if (distanceToPlayer(monster) === 1) return "melee";
        if (monster.ranged && (monster.silencedTurns || 0) <= 0 && rangedCanTargetPlayer(monster)) return "ranged";
        if ((monster.summon && monster.summonCooldown <= 0)) return "summon";
        if (monster.traits?.maintainRange && monster.ranged && distanceToPlayer(monster) <= 2) return "keeps range";
        if (distanceToPlayer(monster) <= 6) return "approach";
        return "watching";
      }

      Object.assign(context, {
        firstTargetInLine,
        monsterStepOptions,
        monsterCanMoveTo,
        monsterFlee,
        monsterVisionRange,
        checkMonsterAlertness,
        predictMonsterIntent,
        clearLineBetween,
        clearLineToPlayer,
        rangedCanTargetPlayer,
        lineCells,
        rangedEffectCells,
        addEffect,
        spellEffectKind,
        hurtLiveMember,
        attackVerb,
        applyMonsterTraits,
        dragPartyFrom,
        blinkPartyAway,
        monsterMelee,
        tickPoison,
        tickEngulfed,
        tickClouds,
        tickMonsterPoison,
        toxicWaterAt,
        tickTerrain,
        shouldKeepActionMessage,
        appendTurnMessages,
        monsterSupportTargets,
        monsterSupportTarget,
        encircleDestinations,
        castMonsterEncircle,
        tideCells,
        castMonsterTide,
        castMonsterSupport,
        castMonsterSelf,
        summonTemplate,
        summonDestinations,
        createSummonedMonster,
        castMonsterSummon,
        monsterBlinkDestinations,
        castMonsterMobility,
        monsterAction,
        confusedMonsterAction,
        triggerPlayerTrap,
        advanceTurn,
        runMonsterTurns,
      });
    }
  };
}());
