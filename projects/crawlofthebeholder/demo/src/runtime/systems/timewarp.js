(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installTimewarp = function installTimewarp(context) {
    with (context) {
      const TIME_MAX_CHARGES     = 3;
      const TIME_CHARGE_INTERVAL = 8;  // turns between free charge gains
      const HASTE_POWER_BONUS    = 2;
      const HASTE_TURNS          = 4;
      const SLOW_TURNS           = 4;
      const REWIND_HEAL          = 10;
      const REWIND_COST          = 2;

      // ── State initialisation ──────────────────────────────────────────────
      if (!state.timeCharges)      state.timeCharges      = 0;
      if (!state.timeChargeTimer)  state.timeChargeTimer  = 0;
      if (!state.hasteTurns)       state.hasteTurns       = 0;

      // ── Haste: surge of temporal speed → attack bonus for a few turns ────
      function hastenParty(messages) {
        if (context.timewarpDisabled) { messages.push("Time magic is not active."); return false; }
        if ((state.timeCharges || 0) < 1) { messages.push("No time charges remaining."); return false; }
        state.timeCharges -= 1;
        state.hasteTurns = Math.max(state.hasteTurns || 0, HASTE_TURNS);
        messages.push("Time bends around you — the party is hastened!");
        return true;
      }

      // ── Slow: drag the nearest monster through temporal treacle ──────────
      function slowMonster(messages) {
        if (context.timewarpDisabled) { messages.push("Time magic is not active."); return false; }
        if ((state.timeCharges || 0) < 1) { messages.push("No time charges remaining."); return false; }
        const fs = currentFloorState();
        const living = (fs.monsters || []).filter((m) => (m.hp || 0) > 0);
        if (!living.length) { messages.push("No target for the slow effect."); return false; }
        const nearest = living.reduce((best, m) => {
          const d = Math.abs(m.x - state.x) + Math.abs(m.y - state.y);
          const bd = Math.abs(best.x - state.x) + Math.abs(best.y - state.y);
          return d < bd ? m : best;
        });
        state.timeCharges -= 1;
        nearest.slowedTurns = Math.max(nearest.slowedTurns || 0, SLOW_TURNS);
        messages.push(`Time congeals around the ${nearest.name || "creature"}. It slows to a crawl.`);
        return true;
      }

      // ── Momentary Rewind: roll back a few moments of damage ──────────────
      function momentaryRewind(messages) {
        if (context.timewarpDisabled) { messages.push("Time magic is not active."); return false; }
        if ((state.timeCharges || 0) < REWIND_COST) {
          messages.push(`Not enough time charges (need ${REWIND_COST}, have ${state.timeCharges || 0}).`);
          return false;
        }
        state.timeCharges -= REWIND_COST;
        let healed = 0;
        for (const m of state.party) {
          if ((m.hp || 0) > 0 && m.hp < (m.maxHp || m.hp)) {
            m.hp = Math.min(m.maxHp, m.hp + REWIND_HEAL);
            healed += 1;
          }
        }
        messages.push(healed > 0
          ? `Time rewinds — wounds unmake themselves. (+${REWIND_HEAL} HP each)`
          : "Time rewinds but finds no wounds to undo.");
        return true;
      }

      // ── Passive bonus: haste amplifies attack power ───────────────────────
      function timeEchoBonus(_member) {
        if (context.timewarpDisabled) return 0;
        return (state.hasteTurns || 0) > 0 ? HASTE_POWER_BONUS : 0;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickTimewarp(messages) {
        if (context.timewarpDisabled) return;

        // Decrement haste.
        if ((state.hasteTurns || 0) > 0) {
          state.hasteTurns -= 1;
          if (state.hasteTurns === 0) messages.push("The haste effect fades.");
        }

        // Accumulate charge timer.
        state.timeChargeTimer = (state.timeChargeTimer || 0) + 1;
        if (state.timeChargeTimer >= TIME_CHARGE_INTERVAL) {
          state.timeChargeTimer = 0;
          if ((state.timeCharges || 0) < TIME_MAX_CHARGES) {
            state.timeCharges = (state.timeCharges || 0) + 1;
            messages.push(`A time charge crystallises. (${state.timeCharges}/${TIME_MAX_CHARGES})`);
          }
        }
      }

      context.hastenParty      = hastenParty;
      context.slowMonster      = slowMonster;
      context.momentaryRewind  = momentaryRewind;
      context.timeEchoBonus    = timeEchoBonus;

      turnHooks.push(tickTimewarp);
    }
  };
}());
