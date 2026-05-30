(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installPsionics = function installPsionics(context) {
    with (context) {
      const PSI_MAX_ENERGY      = 10;
      const PSI_REGEN_PER_TURN  = 1;
      const MIND_BLAST_COST     = 3;
      const TELEPATHY_COST      = 2;
      const PSI_SHIELD_COST     = 4;
      const PRECOG_COST         = 1;
      const MIND_BLAST_STUN     = 2; // stunnedTurns
      const PRECOG_HINTS = [
        "A shadow of danger lurks on the next floor.",
        "Fortune favours the bold — combat holds hidden reward.",
        "Tread carefully; the floor remembers those who stumbled.",
        "A powerful foe draws near; prepare your defences.",
        "The path ahead carries the scent of old magic."
      ];

      // ── State initialisation ──────────────────────────────────────────────
      if (!state.psionicEnergy)    state.psionicEnergy    = 0;
      if (!state.psiShieldActive)  state.psiShieldActive  = false;

      // ── Mind Blast: stun the nearest monster ─────────────────────────────
      function mindBlast(messages) {
        if (context.psionicsDisabled) { messages.push("Psionics are not active."); return false; }
        if ((state.psionicEnergy || 0) < MIND_BLAST_COST) {
          messages.push(`Not enough psionic energy (need ${MIND_BLAST_COST}, have ${state.psionicEnergy || 0}).`);
          return false;
        }
        const fs = currentFloorState();
        const living = (fs.monsters || []).filter((m) => (m.hp || 0) > 0);
        if (!living.length) { messages.push("No minds within reach to blast."); return false; }
        const nearest = living.reduce((best, m) => {
          const d = Math.abs(m.x - state.x) + Math.abs(m.y - state.y);
          const bd = Math.abs(best.x - state.x) + Math.abs(best.y - state.y);
          return d < bd ? m : best;
        });
        state.psionicEnergy -= MIND_BLAST_COST;
        nearest.stunnedTurns = Math.max(nearest.stunnedTurns || 0, MIND_BLAST_STUN);
        messages.push(`You unleash a mind blast at the ${nearest.name || "creature"}! It reels, stunned.`);
        return true;
      }

      // ── Telepathy: reveal all monster positions on current floor ─────────
      function telepathy(messages) {
        if (context.psionicsDisabled) { messages.push("Psionics are not active."); return false; }
        if ((state.psionicEnergy || 0) < TELEPATHY_COST) {
          messages.push(`Not enough psionic energy (need ${TELEPATHY_COST}, have ${state.psionicEnergy || 0}).`);
          return false;
        }
        state.psionicEnergy -= TELEPATHY_COST;
        const fs = currentFloorState();
        const count = (fs.monsters || []).filter((m) => (m.hp || 0) > 0).length;
        // Mark all living monsters as detected (visible on minimap).
        for (const m of (fs.monsters || [])) {
          if ((m.hp || 0) > 0) m.detected = true;
        }
        messages.push(count > 0
          ? `Your mind reaches out — ${count} lifeform${count > 1 ? "s" : ""} detected on this floor.`
          : "Your mind reaches out — no living foes sensed.");
        return true;
      }

      // ── Psi Shield: the next hit deals zero damage ────────────────────────
      function psiShield(messages) {
        if (context.psionicsDisabled) { messages.push("Psionics are not active."); return false; }
        if ((state.psionicEnergy || 0) < PSI_SHIELD_COST) {
          messages.push(`Not enough psionic energy (need ${PSI_SHIELD_COST}, have ${state.psionicEnergy || 0}).`);
          return false;
        }
        state.psionicEnergy -= PSI_SHIELD_COST;
        state.psiShieldActive = true;
        messages.push("A psionic barrier crystallises around the party.");
        return true;
      }

      // Called from hurtLiveMember to intercept incoming damage.
      function absorbPsiShield(damage) {
        if (!state.psiShieldActive) return damage;
        state.psiShieldActive = false;
        return 0;
      }

      // ── Precognition: a vague but true prophetic hint ─────────────────────
      function precognition(messages) {
        if (context.psionicsDisabled) { messages.push("Psionics are not active."); return false; }
        if ((state.psionicEnergy || 0) < PRECOG_COST) {
          messages.push(`Not enough psionic energy (need ${PRECOG_COST}, have ${state.psionicEnergy || 0}).`);
          return false;
        }
        state.psionicEnergy -= PRECOG_COST;
        const hint = PRECOG_HINTS[Math.floor(Math.random() * PRECOG_HINTS.length)];
        messages.push(`A vision flickers: "${hint}"`);
        return true;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickPsionics(_messages) {
        if (context.psionicsDisabled) return;
        if (!state.psionicEnergy) state.psionicEnergy = 0;
        state.psionicEnergy = Math.min(PSI_MAX_ENERGY, state.psionicEnergy + PSI_REGEN_PER_TURN);
      }

      context.mindBlast       = mindBlast;
      context.telepathy       = telepathy;
      context.psiShield       = psiShield;
      context.absorbPsiShield = absorbPsiShield;
      context.precognition    = precognition;

      turnHooks.push(tickPsionics);
    }
  };
}());
