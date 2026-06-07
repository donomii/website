(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installBossMonsters = function (context) {
    with (context) {
      // Deepest floors of each branch get a boss-tier encounter.
      // Deepest floors of each branch get a boss-tier encounter. Indexes cover
      // the full DCSS progression: D:3, Orc:1, Lair:3, Swamp:2, Shoals:2,
      // Snake:1, Spider:1, Slime:2, Crypt:2, Elf:2, Vaults:2, Depths:2, Zot:1,
      // Gehenna:1, Cocytus:1, Tartarus:1, Dis:1, Abyss:1, Pan:1, Tomb:1.
      const BOSS_FLOORS = [2, 3, 6, 8, 10, 11, 12, 14, 16, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30];

      function seedBosses() {
        if (context.bossesDisabled || state.bossesSeeded) return;
        state.bossesSeeded = true;
        for (const floorIndex of BOSS_FLOORS) {
          const floorState = state.floors[floorIndex];
          if (!floorState) continue;
          const candidates = floorState.monsters.filter((m) => !m.summoned);
          if (candidates.length === 0) continue;
          candidates.sort((a, b) => (b.maxHp + (b.power || 0) * 3) - (a.maxHp + (a.power || 0) * 3));
          const boss = candidates[0];
          if (boss.boss) continue;
          boss.boss = true;
          boss.maxHp = Math.round(boss.maxHp * 1.6);
          boss.hp = boss.maxHp;
          if (typeof boss.power === "number") boss.power = Math.round(boss.power * 1.2);
          if (Array.isArray(boss.attacks)) {
            boss.attacks = boss.attacks.map((a) => ({ ...a, damage: Math.round((a.damage || 1) * 1.2) }));
          }
          // Add 'reach' trait if not present so the boss feels distinctly different.
          boss.traits = { ...(boss.traits || {}), reachDamage: (boss.traits?.reachDamage || 0) + 1 };
          boss.name = `${boss.name.replace(/, branch champion$/i, "")}, branch champion`;
          boss.exp = Math.round(((boss.exp || 1) * 2.5));
        }
      }

      Object.assign(context, {
        BOSS_FLOORS,
        seedBosses
      });

      seedBosses();
    }
  };
}());
