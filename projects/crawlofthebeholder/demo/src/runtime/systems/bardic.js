(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installBardic = function installBardic(context) {
    with (context) {
      const LULLABY_SLEEP_TURNS  = 3;
      const DIRGE_FEAR_TURNS     = 3;
      const HYMN_POWER_TURNS     = 5;
      const HEALING_SONG_HEAL    = 8;
      const BARDIC_POWER_BONUS   = 2;
      const BARDIC_RANGE         = 4; // tiles: lullaby/dirge range

      // ── Item registration ─────────────────────────────────────────────────
      if (!resources.inventory.some((i) => i.id === "bard-lute")) {
        resources.inventory.push({
          id: "bard-lute", name: "lute", kind: "lute", charges: 4, value: 16,
          desc: "A well-crafted lute for bardic performances."
        });
      }

      // ── State initialisation ──────────────────────────────────────────────
      if (!state.bardEffect) state.bardEffect = { kind: null, turnsRemaining: 0 };

      // ── Consume a lute charge ─────────────────────────────────────────────
      function _consumeLute(messages) {
        const lute = state.inventory.find((i) => i.kind === "lute" && (i.charges || 0) > 0);
        if (!lute) { messages.push("You need a lute with charges."); return false; }
        lute.charges -= 1;
        if (lute.charges === 0) state.inventory = state.inventory.filter((i) => i !== lute);
        return true;
      }

      // ── Bardic songs ──────────────────────────────────────────────────────

      // Battle Hymn: +BARDIC_POWER_BONUS power for HYMN_POWER_TURNS turns.
      function playBattleHymn(messages) {
        if (context.bardicDisabled) { messages.push("Bardic magic is not active."); return false; }
        if (!_consumeLute(messages)) return false;
        state.bardEffect = { kind: "battleHymn", turnsRemaining: HYMN_POWER_TURNS };
        messages.push("You strike a rousing battle hymn. The party surges with power!");
        return true;
      }

      // Lullaby: nearby monsters fall asleep.
      function playLullaby(messages) {
        if (context.bardicDisabled) { messages.push("Bardic magic is not active."); return false; }
        if (!_consumeLute(messages)) return false;
        const fs = currentFloorState();
        const targets = (fs.monsters || []).filter((m) => {
          const d = Math.abs(m.x - state.x) + Math.abs(m.y - state.y);
          return (m.hp || 0) > 0 && d <= BARDIC_RANGE;
        });
        for (const m of targets) {
          m.sleeping = true;
          m.sleepingTurns = Math.max(m.sleepingTurns || 0, LULLABY_SLEEP_TURNS);
        }
        messages.push(targets.length > 0
          ? `A soothing lullaby puts ${targets.length} creature${targets.length > 1 ? "s" : ""} to sleep.`
          : "The lullaby drifts through empty halls.");
        return true;
      }

      // Dirge: nearby monsters are seized by dread.
      function playDirge(messages) {
        if (context.bardicDisabled) { messages.push("Bardic magic is not active."); return false; }
        if (!_consumeLute(messages)) return false;
        const fs = currentFloorState();
        const targets = (fs.monsters || []).filter((m) => {
          const d = Math.abs(m.x - state.x) + Math.abs(m.y - state.y);
          return (m.hp || 0) > 0 && d <= BARDIC_RANGE;
        });
        for (const m of targets) {
          m.fearedTurns = Math.max(m.fearedTurns || 0, DIRGE_FEAR_TURNS);
        }
        messages.push(targets.length > 0
          ? `A haunting dirge fills ${targets.length} foe${targets.length > 1 ? "s" : ""} with dread.`
          : "The dirge echoes unanswered.");
        return true;
      }

      // Healing Song: restore HP to all living party members.
      function playHealingSong(messages) {
        if (context.bardicDisabled) { messages.push("Bardic magic is not active."); return false; }
        if (!_consumeLute(messages)) return false;
        let healed = 0;
        for (const m of state.party) {
          if ((m.hp || 0) > 0 && m.hp < (m.maxHp || m.hp)) {
            m.hp = Math.min(m.maxHp, m.hp + HEALING_SONG_HEAL);
            healed += 1;
          }
        }
        messages.push(healed > 0
          ? `A gentle melody mends the party's wounds. (+${HEALING_SONG_HEAL} HP each)`
          : "The healing song finds no wounded ears.");
        return true;
      }

      // ── Passive bonus ─────────────────────────────────────────────────────
      function bardicPowerBonus(_member) {
        if (context.bardicDisabled) return 0;
        return (state.bardEffect?.kind === "battleHymn" && (state.bardEffect.turnsRemaining || 0) > 0)
          ? BARDIC_POWER_BONUS : 0;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickBardic(messages) {
        if (context.bardicDisabled) return;
        if (!state.bardEffect || !state.bardEffect.kind) return;
        state.bardEffect.turnsRemaining -= 1;
        if (state.bardEffect.turnsRemaining <= 0) {
          const was = state.bardEffect.kind;
          state.bardEffect = { kind: null, turnsRemaining: 0 };
          if (was === "battleHymn") messages.push("The battle hymn's power subsides.");
        }
      }

      context.playBattleHymn  = playBattleHymn;
      context.playLullaby     = playLullaby;
      context.playDirge       = playDirge;
      context.playHealingSong = playHealingSong;
      context.bardicPowerBonus = bardicPowerBonus;

      turnHooks.push(tickBardic);
    }
  };
}());
