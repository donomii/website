(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Party morale (0–100, starts at 50). Victories lift it, taking heavy hits or
  // losing a member drops it. High morale lends the party +1 power; low morale
  // saps -1. Each turn morale drifts back toward the neutral midpoint. Distinct
  // from monster morale in the ecology system (that governs whether monsters
  // flee; this governs the party's own edge).
  window.CotBRuntime.installMorale = function installMorale(context) {
    with (context) {
      const MORALE_MIN   = 0;
      const MORALE_MAX   = 100;
      const MORALE_MID   = 50;
      const HIGH_MORALE  = 75;   // at/above → +1 power
      const LOW_MORALE   = 25;   // at/below → -1 power
      const KILL_GAIN    = 6;
      const HIT_LOSS     = 4;    // when a heavy hit lands on the party
      const FALL_LOSS    = 20;   // when a member is downed
      const DRIFT        = 1;    // per-turn pull toward MORALE_MID

      if (typeof state.morale !== "number") state.morale = MORALE_MID;

      function _clamp(v) { return Math.max(MORALE_MIN, Math.min(MORALE_MAX, v)); }

      function adjustMorale(delta) {
        if (context.moraleDisabled) return state.morale;
        state.morale = _clamp((state.morale ?? MORALE_MID) + delta);
        return state.morale;
      }

      // Combat hooks (called from the kill/hurt paths via typeof guards).
      function noteMoraleKill() { adjustMorale(KILL_GAIN); }
      function noteMoraleHit() { adjustMorale(-HIT_LOSS); }
      function noteMoraleFall() { adjustMorale(-FALL_LOSS); }

      function moralePowerBonus(_member) {
        if (context.moraleDisabled) return 0;
        const m = state.morale ?? MORALE_MID;
        if (m >= HIGH_MORALE) return 1;
        if (m <= LOW_MORALE) return -1;
        return 0;
      }

      function moraleLabel() {
        const m = state.morale ?? MORALE_MID;
        if (m >= HIGH_MORALE) return "emboldened";
        if (m <= LOW_MORALE) return "shaken";
        return "steady";
      }

      // Track downed members across turns so a fall is counted once.
      function tickMorale(messages) {
        if (context.moraleDisabled) return;
        const downed = state.party.filter((m) => (m.hp || 0) === 0).length;
        const prev = state.moraleDownedSeen || 0;
        if (downed > prev) {
          const wasHigh = (state.morale ?? MORALE_MID) >= HIGH_MORALE;
          noteMoraleFall();
          if (wasHigh && messages) messages.push("The party's spirits sink as one of their own falls.");
        }
        state.moraleDownedSeen = downed;

        // Drift toward the midpoint.
        const m = state.morale ?? MORALE_MID;
        if (m > MORALE_MID) state.morale = _clamp(m - DRIFT);
        else if (m < MORALE_MID) state.morale = _clamp(m + DRIFT);
      }

      context.adjustMorale     = adjustMorale;
      context.noteMoraleKill   = noteMoraleKill;
      context.noteMoraleHit    = noteMoraleHit;
      context.noteMoraleFall   = noteMoraleFall;
      context.moralePowerBonus = moralePowerBonus;
      context.moraleLabel      = moraleLabel;

      turnHooks.push(tickMorale);
    }
  };
}());
