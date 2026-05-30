(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Void corruption: a 0-100 meter that rises near dark portals and cursed
  // items. At thresholds it inflicts vision blur (25), random power surges (50),
  // compelled movement (75), and summons a corruption wraith (100). Shrines
  // offer purification at a gold cost. Gated by context.corruptionDisabled.
  window.CotBRuntime.installCorruption = function (context) {
    with (context) {
      function corruptionLevel() {
        return Math.min(100, Math.max(0, state.corruption || 0));
      }

      function addCorruption(amount) {
        state.corruption = Math.min(100, (state.corruption || 0) + amount);
      }

      function reduceCorruption(amount) {
        state.corruption = Math.max(0, (state.corruption || 0) - amount);
      }

      // Purify at a shrine: removes 30 corruption, costs 50 gold.
      function purifyAtShrine(messages) {
        const cost = 50;
        if ((state.gold || 0) < cost) {
          messages.push(`Purification costs ${cost} gold (you have ${state.gold || 0}).`);
          return false;
        }
        if (corruptionLevel() === 0) {
          messages.push("You are untainted — no purification needed.");
          return false;
        }
        state.gold -= cost;
        reduceCorruption(30);
        messages.push(`Corruption purged. Level now ${corruptionLevel()}.`);
        return true;
      }

      // Corrupted monsters: those with traits.corrupted get 1.3× HP and glow.
      function markCorrupted(monster) {
        if (monster.corrupted) return;
        monster.corrupted = true;
        monster.maxHp = Math.round((monster.maxHp || monster.hp || 10) * 1.3);
        monster.hp    = Math.round((monster.hp    || monster.maxHp)    * 1.3);
      }

      function isCorrupted(monster) {
        return !!monster.corrupted;
      }

      // Summon a corruption wraith near the party.
      function summonCorruptionWraith(messages) {
        const floorState = currentFloorState();
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const x = state.x + Math.floor(Math.random() * 5) - 2;
          const y = state.y + Math.floor(Math.random() * 5) - 2;
          if (!mapContains(x, y) || solidAt(x, y) || monsterAt(x, y)) continue;
          const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
          floorState.monsters.push({
            id: `wraith-${serial}`, name: "corruption wraith", x, y,
            hp: 40, maxHp: 40, ac: 4, power: 12, hd: 5, exp: 60,
            corrupted: true, traits: {}, energy: 0, alerted: true
          });
          messages.push("A corruption wraith tears into existence!");
          return;
        }
        messages.push("The void strains but cannot tear open here.");
      }

      function tickCorruption(messages) {
        if (context.corruptionDisabled) return false;
        const level = corruptionLevel();
        if (level === 0) return false;

        // At 25+: vision blur (reduce lightRadius by 1 for this turn, passive message).
        if (level >= 25 && level < 50 && Math.random() < 0.05) {
          messages.push("Corruption blurs your vision.");
        }

        // At 50+: random power surge — deal 3 damage to a random monster, or 2 to party.
        if (level >= 50 && Math.random() < 0.06) {
          const floorState = currentFloorState();
          const targets = floorState.monsters.filter((m) => m.hp > 0);
          if (targets.length > 0 && Math.random() < 0.6) {
            const m = targets[Math.floor(Math.random() * targets.length)];
            const dmg = 3;
            m.hp = Math.max(0, m.hp - dmg);
            messages.push(`Power surge lashes ${m.name} for ${dmg}.`);
          } else {
            const member = liveMember();
            if (member) {
              member.hp = Math.max(0, member.hp - 2);
              messages.push(`Void energy scorches ${member.name}.`);
              if (!liveMember()) state.defeated = true;
            }
          }
        }

        // At 75+: compelled movement — random direction nudge (just message for now).
        if (level >= 75 && Math.random() < 0.04) {
          messages.push("Corruption compels you to stagger!");
        }

        // At 100: summon wraith. Reset corruption to 60 so it can happen again.
        if (level >= 100) {
          summonCorruptionWraith(messages);
          state.corruption = 60;
        }

        // Passive slow drain: corruption decays by 1 every 10 turns (skip turn 0).
        if ((state.floorTurnCount || 0) > 0 && (state.floorTurnCount || 0) % 10 === 0) reduceCorruption(1);

        return false;
      }

      turnHooks.push(tickCorruption);

      context.corruptionLevel       = corruptionLevel;
      context.addCorruption         = addCorruption;
      context.reduceCorruption      = reduceCorruption;
      context.purifyAtShrine        = purifyAtShrine;
      context.markCorrupted         = markCorrupted;
      context.isCorrupted           = isCorrupted;
      context.summonCorruptionWraith = summonCorruptionWraith;
    }
  };
}());
