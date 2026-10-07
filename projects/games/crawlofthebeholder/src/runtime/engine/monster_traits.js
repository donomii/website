(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installMonsterTraits = function (context) {
    with (context) {
      function supportSpellLabels(monster) {
        if (!monster.support) return [];
        return [`support:${monster.support.name}`];
      }

      function mobilitySpellLabels(monster) {
        if (!monster.mobility) return [];
        return [`mobility:${monster.mobility.name}`];
      }

      function selfSpellLabels(monster) {
        if (!monster.self) return [];
        return [`self:${monster.self.name}`];
      }

      function summonSpellLabels(monster) {
        if (!monster.summon) return [];
        return [`summon:${monster.summon.name}`];
      }

      function pushPartyFrom(monster) {
        if (!monster) return "The blast churns around the party.";
        const dx = Math.sign(state.x - monster.x);
        const dy = Math.sign(state.y - monster.y);
        const destination = { x: state.x + dx, y: state.y + dy };
        if ((dx === 0 && dy === 0) || solidAt(destination.x, destination.y) || monsterAt(destination.x, destination.y) || trapAt(destination.x, destination.y)) {
          return "The blast crushes against stone.";
        }
        const origin = { x: state.x, y: state.y };
        state.x = destination.x;
        state.y = destination.y;
        reveal();
        addEffect("impact", [origin, destination]);
        return "Wind drives the party back.";
      }

      function pullPartyToward(monster, blockedText = "The song tugs at the party.", movedText = "The song draws the party closer.", effect = "fear") {
        if (!monster) return blockedText;
        const dx = Math.sign(monster.x - state.x);
        const dy = Math.sign(monster.y - state.y);
        const destination = { x: state.x + dx, y: state.y + dy };
        if ((dx === 0 && dy === 0) || solidAt(destination.x, destination.y) || monsterAt(destination.x, destination.y) || trapAt(destination.x, destination.y)) {
          return blockedText;
        }
        const origin = { x: state.x, y: state.y };
        state.x = destination.x;
        state.y = destination.y;
        reveal();
        addEffect(effect, [origin, destination, monster]);
        return movedText;
      }

      function applyRangedStatus(ranged, hit, monster = null) {
        const notes = [];
        if (ranged.poisonTurns && hit.damage > 0 && !poisonAdapted()) {
          state.poisonedTurns = Math.max(state.poisonedTurns, ranged.poisonTurns);
          notes.push("Poison spreads.");
        }
        if (ranged.status === "dazed") {
          state.dazedTurns = Math.max(state.dazedTurns, ranged.statusTurns || 4);
          notes.push("The party reels.");
        }
        if (ranged.status === "slow") {
          state.slowedTurns = Math.max(state.slowedTurns, ranged.statusTurns || 4);
          notes.push("The party slows.");
        }
        if (ranged.status === "lure") {
          state.slowedTurns = Math.max(state.slowedTurns, ranged.statusTurns || 4);
          notes.push(pullPartyToward(monster));
        }
        if (ranged.status === "pull" && hit.damage > 0) {
          notes.push(pullPartyToward(monster, "The line tugs at the party.", "The line drags the party closer.", "impact"));
        }
        if (ranged.status === "snared") {
          state.snaredTurns = Math.max(state.snaredTurns, ranged.statusTurns || 3);
          notes.push("The party is held.");
        }
        if (ranged.status === "vitrified") {
          state.vitrifiedTurns = Math.max(state.vitrifiedTurns, ranged.statusTurns || 4);
          notes.push("The party turns brittle.");
        }
        if (ranged.status === "corroded" && (hit.damage > 0 || (ranged.power || 0) === 0)) {
          state.corrodedTurns = Math.max(state.corrodedTurns, ranged.statusTurns || 5);
          notes.push("Armour corrodes.");
        }
        if (ranged.status === "ignite" && hit.damage > 0 && hit.defender && state.poisonedTurns > 0) {
          const burn = partyElementDamage(Math.max(2, Math.min(8, state.poisonedTurns + 2)), "fire");
          hit.defender.hp = Math.max(0, hit.defender.hp - burn);
          state.poisonedTurns = 0;
          addEffect("flame", [{ x: state.x, y: state.y }]);
          notes.push(`Poison ignites for ${burn}.`);
        }
        if (ranged.status === "barbed" && hit.damage > 0) {
          state.barbedTurns = Math.max(state.barbedTurns, ranged.statusTurns || 5);
          notes.push("Barbs lodge deep.");
        }
        if (ranged.status === "knockback" && hit.damage > 0) {
          notes.push(pushPartyFrom(monster));
        }
        if (ranged.status === "engulfed" && hit.damage > 0) {
          if (waterAdapted()) notes.push("Water rolls off.");
          else {
            state.engulfedTurns = Math.max(state.engulfedTurns, ranged.statusTurns || 4);
            notes.push("Water engulfs the party.");
          }
        }
        if (ranged.status === "drain" && hit.defender) {
          const loss = ranged.drainMax || 1;
          hit.defender.maxHp = Math.max(1, hit.defender.maxHp - loss);
          hit.defender.hp = Math.min(hit.defender.hp, hit.defender.maxHp);
          notes.push(`${hit.defender.name} is drained.`);
        }
        if (ranged.healCaster && hit.damage > 0 && monster && monster.hp < monster.maxHp) {
          const healed = Math.min(monster.maxHp - monster.hp, Math.max(1, Math.ceil(hit.damage / 2)));
          monster.hp += healed;
          notes.push(`${monster.name} drinks back ${healed}.`);
        }
        return notes.length > 0 ? ` ${notes.join(" ")}` : "";
      }

      function monsterResistanceLabels(monster) {
        const names = { acid: "rAcid", cold: "rC", elec: "rElec", fire: "rF", poison: "rPois" };
        return Object.entries(monster.resists || {}).map(([element, level]) => `${names[element] || element}${level < 0 ? "-" : level}`);
      }

      function monsterHabitatLabel(monster) {
        const habitat = monster.habitat || "land";
        if (habitat === "amphibious") return "amphib";
        if (habitat === "amphibious_lava") return "lava";
        if (habitat === "deep_water") return "deep";
        if (habitat === "water") return "water";
        return "";
      }

      function monsterCanEnterTerrain(monster, terrain) {
        const habitat = monster.habitat || "land";
        if (monster.traits?.airborne) return true;
        if (terrain === "floor") return habitat !== "water" && habitat !== "deep_water" && habitat !== "lava";
        if (terrain === "water") return habitat === "water" || habitat === "deep_water" || habitat === "amphibious";
        if (terrain === "deep-water") return habitat === "water" || habitat === "deep_water" || habitat === "amphibious";
        if (terrain === "lava") return habitat === "lava" || habitat === "amphibious_lava" || (monster.resists?.fire || 0) >= 3;
        return false;
      }

      Object.assign(context, {
        supportSpellLabels,
        mobilitySpellLabels,
        selfSpellLabels,
        summonSpellLabels,
        pushPartyFrom,
        pullPartyToward,
        applyRangedStatus,
        monsterResistanceLabels,
        monsterHabitatLabel,
        monsterCanEnterTerrain,
      });
    }
  };
}());
