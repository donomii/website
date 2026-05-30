(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installBossMonsters = function (context) {
    with (context) {
      // Deepest floors of each branch get a boss-tier encounter.
      const BOSS_FLOORS = [2, 3, 6, 8, 10, 11, 12, 14];

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
