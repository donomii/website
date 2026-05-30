(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installCamping = function installCamping(context) {
    with (context) {
      const CAMP_HEAL_FRACTION  = 0.25; // 25% of maxHp
      const CAMP_TURNS_DEFAULT  = 8;
      const CAMP_MONSTER_RADIUS = 4;
      const RESTED_MULTIPLIER   = 1.5;

      // ── State initialisation ───────────────────────────────────────────────
      if (!("campedTurns" in state)) state.campedTurns = 0;
      if (!("provisions" in state))  state.provisions  = 0;

      // ── Proximity check ────────────────────────────────────────────────────
      function monstersNearby() {
        const fs = currentFloorState ? currentFloorState() : null;
        if (!fs) return false;
        const monsters = (fs.monsters || []).filter((m) => (m.hp || 0) > 0);
        for (const m of monsters) {
          const dx = m.x - state.x;
          const dy = m.y - state.y;
          if (Math.sqrt(dx * dx + dy * dy) <= CAMP_MONSTER_RADIUS) return true;
        }
        return false;
      }

      // ── Make camp ──────────────────────────────────────────────────────────
      function makeCamp(messages) {
        if (monstersNearby()) {
          messages.push("Cannot camp — enemies are too close.");
          return false;
        }
        // Consume a provision if available.
        let provNote = "";
        if ((state.provisions || 0) > 0) {
          state.provisions -= 1;
          provNote = " The party shares provisions.";
        }
        // Heal living members.
        for (const m of state.party) {
          if ((m.hp || 0) > 0) {
            const heal = Math.max(1, Math.floor((m.maxHp || 10) * CAMP_HEAL_FRACTION));
            m.hp = Math.min(m.maxHp || m.hp, (m.hp || 0) + heal);
          }
        }
        // Herbalism passive: +1 HP per member if any herb in inventory.
        const hb = typeof herbismBonus === "function" ? herbismBonus() : 0;
        if (hb > 0) {
          for (const m of state.party) {
            if ((m.hp || 0) > 0) m.hp = Math.min(m.maxHp || m.hp, m.hp + hb);
          }
        }
        state.campedTurns = CAMP_TURNS_DEFAULT;
        messages.push(`The party makes camp and rests.${provNote} The party feels rested.`);
        return true;
      }

      // ── Rested state queries ───────────────────────────────────────────────
      function isRested() {
        return (state.campedTurns || 0) > 0;
      }

      // Called from attackTarget after damage is computed to apply the bonus.
      function consumeRestedAttack(damage) {
        if (!isRested()) return damage;
        state.campedTurns = Math.max(0, (state.campedTurns || 0) - 1);
        return Math.ceil(damage * RESTED_MULTIPLIER);
      }

      // ── Provisions ────────────────────────────────────────────────────────
      function provisionParty(n) {
        state.provisions = (state.provisions || 0) + (n || 0);
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickCamp(_messages) {
        if ((state.campedTurns || 0) > 0) {
          state.campedTurns -= 1;
        }
      }

      context.makeCamp           = makeCamp;
      context.isRested           = isRested;
      context.consumeRestedAttack = consumeRestedAttack;
      context.provisionParty     = provisionParty;

      turnHooks.push(tickCamp);
    }
  };
}());
