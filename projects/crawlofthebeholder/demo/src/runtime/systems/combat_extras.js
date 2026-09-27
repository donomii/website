(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Combat texture: sneak attacks on unaware foes, a death recap naming the
  // killer, bosses that enrage when wounded, and vengeance fury when a party
  // member falls.
  window.CotBRuntime.installCombatExtras = function installCombatExtras(context) {
    with (context) {
      const SNEAK_MULTIPLIER = 0.5;   // extra damage fraction vs unalerted foes
      const ENRAGE_THRESHOLD = 0.3;   // bosses enrage below this HP fraction
      const VENGEANCE_TURNS = 8;

      // Called from attackTarget: extra damage when the target hasn't noticed
      // the party yet. Bosses are too vigilant to be caught off guard.
      function sneakAttackBonus(target, damage) {
        if (context.combatExtrasDisabled) return 0;
        if (!target || target.alerted || target.boss) return 0;
        const bonus = Math.max(1, Math.round(damage * SNEAK_MULTIPLIER));
        if (typeof queueFloater === "function") queueFloater("sneak!", "crit");
        return bonus;
      }

      // Called from the monster attack paths so the end modal can name the killer.
      function noteAttacker(monster) {
        if (context.combatExtrasDisabled || !monster) return;
        state.lastAttacker = monster.name;
      }

      function tickEnrage(messages) {
        if (context.combatExtrasDisabled) return;
        for (const monster of currentFloorState().monsters) {
          if (!monster.boss || monster.enraged || monster.hp <= 0) continue;
          if (monster.hp >= monster.maxHp * ENRAGE_THRESHOLD) continue;
          monster.enraged = true;
          if (typeof monster.power === "number") monster.power = Math.round(monster.power * 1.25);
          if (Array.isArray(monster.attacks)) {
            monster.attacks = monster.attacks.map((attack) => ({ ...attack, damage: Math.round((attack.damage || 1) * 1.25) }));
          }
          messages.push(`${monster.name} flies into a desperate rage!`);
          if (typeof showToast === "function") showToast(`${monster.name} enrages!`);
        }
      }

      function tickVengeance(messages) {
        if (context.combatExtrasDisabled) return;
        const alive = liveMembers().length;
        if (state.vengeanceAlive == null) { state.vengeanceAlive = alive; return; }
        if (alive < state.vengeanceAlive && alive > 0) {
          state.rageTurns = Math.max(state.rageTurns || 0, VENGEANCE_TURNS);
          messages.push("The survivors burn with vengeance!");
        }
        state.vengeanceAlive = alive;
      }

      turnHooks.push(tickEnrage);
      turnHooks.push(tickVengeance);
      Object.assign(context, { sneakAttackBonus, noteAttacker, tickEnrage, tickVengeance });
    }
  };
}());
