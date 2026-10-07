(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installDifficulty = function (context) {
    with (context) {
      const DIFFICULTIES = {
        easy: { name: "Easy", monsterHpScale: 0.75, monsterDamageScale: 0.75, xpScale: 1.0, goldScale: 1.25 },
        normal: { name: "Normal", monsterHpScale: 1, monsterDamageScale: 1, xpScale: 1, goldScale: 1 },
        hard: { name: "Hard", monsterHpScale: 1.4, monsterDamageScale: 1.25, xpScale: 1.5, goldScale: 0.8 }
      };

      function currentDifficulty() {
        return DIFFICULTIES[state.difficulty || "normal"] || DIFFICULTIES.normal;
      }

      function setDifficulty(key) {
        if (!DIFFICULTIES[key]) return false;
        if (state.difficultyApplied) {
          // Re-applying once stats are baked into floors would compound; refuse.
          setMessage(`Difficulty is locked once the run begins.`);
          return false;
        }
        state.difficulty = key;
        return true;
      }

      function applyDifficultyToFloors() {
        if (state.difficultyApplied) return;
        state.difficultyApplied = true;
        const cfg = currentDifficulty();
        for (const floorState of state.floors) {
          for (const monster of floorState.monsters) {
            monster.maxHp = Math.max(1, Math.round(monster.maxHp * cfg.monsterHpScale));
            monster.hp = monster.maxHp;
            if (monster.power) monster.power = Math.max(1, Math.round(monster.power * cfg.monsterDamageScale));
            if (Array.isArray(monster.attacks)) {
              monster.attacks = monster.attacks.map((a) => ({ ...a, damage: Math.max(1, Math.round((a.damage || 1) * cfg.monsterDamageScale)) }));
            }
          }
        }
      }

      function difficultyLabel() {
        return currentDifficulty().name;
      }

      // New Game+ : read the persisted ascension tier and apply it to a fresh
      // run — tougher monsters (+15% HP/damage per tier) and a carryover gold
      // bonus. Runs once, after difficulty scaling.
      function applyNewGamePlus() {
        if (state.ascensionApplied) return 0;
        state.ascensionApplied = true;
        const meta = typeof readMeta === "function" ? readMeta() : {};
        const tier = meta.ascension || 0;
        state.ascension = tier;
        if (tier <= 0) return 0;
        const scale = 1 + 0.15 * tier;
        for (const floorState of state.floors) {
          for (const monster of floorState.monsters) {
            monster.maxHp = Math.max(1, Math.round(monster.maxHp * scale));
            monster.hp = monster.maxHp;
            if (monster.power) monster.power = Math.max(1, Math.round(monster.power * scale));
            if (Array.isArray(monster.attacks)) {
              monster.attacks = monster.attacks.map((a) => ({ ...a, damage: Math.max(1, Math.round((a.damage || 1) * scale)) }));
            }
          }
        }
        state.gold = (state.gold || 0) + tier * 50;
        return tier;
      }

      Object.assign(context, {
        DIFFICULTIES,
        currentDifficulty,
        setDifficulty,
        applyDifficultyToFloors,
        applyNewGamePlus,
        difficultyLabel
      });
    }
  };
}());
