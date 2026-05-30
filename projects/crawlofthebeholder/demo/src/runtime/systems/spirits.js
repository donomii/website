(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installSpirits = function installSpirits(context) {
    with (context) {
      const SPIRIT_TURNS      = 20;  // how long a spirit lingers before fading
      const SPIRIT_SHIELD_REDUCTION = 0.5; // incoming damage multiplier when shield used
      const RESTORE_COST      = 30;  // gold to restore a spirit to 1 HP

      // ── State initialisation ──────────────────────────────────────────────
      if (!state.spirits) state.spirits = [];

      // ── Helpers ────────────────────────────────────────────────────────────
      function _spiritForMember(member) {
        return state.spirits.find((s) => s.memberName === member.name && s.active);
      }

      // ── Spawn a spirit for a fallen member (called from tickSpirits) ──────
      function _spawnSpirit(member) {
        if (_spiritForMember(member)) return; // already has a spirit
        state.spirits.push({
          memberName:    member.name,
          power:         Math.max(1, Math.floor((member.power || 5) * 0.5)),
          turns:         SPIRIT_TURNS,
          shieldCharges: 1,
          active:        true
        });
      }

      // ── Spirit shield: absorb the next hit at 50% damage ─────────────────
      function spiritShield(messages) {
        if (context.spiritsDisabled) { messages.push("Spirits are not active."); return false; }
        const spirit = state.spirits.find((s) => s.active && (s.shieldCharges || 0) > 0);
        if (!spirit) { messages.push("No spirit with a shield charge available."); return false; }
        spirit.shieldCharges -= 1;
        // Set a flag that hurtLiveMember can check.
        state.spiritShieldActive = true;
        messages.push(`${spirit.memberName}'s spirit wraps the party in a protective veil.`);
        return true;
      }

      // Called from hurtLiveMember to apply the shield.
      function consumeSpiritShield(damage) {
        if (!state.spiritShieldActive) return damage;
        state.spiritShieldActive = false;
        return Math.max(1, Math.ceil(damage * SPIRIT_SHIELD_REDUCTION));
      }

      // ── Spirit whisper: hint about the dominant nearby monster ───────────
      function spiritWhisper(messages) {
        if (context.spiritsDisabled) { messages.push("Spirits are not active."); return false; }
        if (!state.spirits.some((s) => s.active)) {
          messages.push("No lingering spirits to whisper guidance.");
          return false;
        }
        const fs = currentFloorState();
        const monsters = (fs.monsters || []).filter((m) => (m.hp || 0) > 0);
        if (!monsters.length) { messages.push("The spirits sense no threats near."); return true; }
        // Find nearest living monster.
        const nearest = monsters.reduce((best, m) => {
          const d = Math.abs(m.x - state.x) + Math.abs(m.y - state.y);
          const bd = Math.abs(best.x - state.x) + Math.abs(best.y - state.y);
          return d < bd ? m : best;
        });
        const dir = nearest.x > state.x ? "east" : nearest.x < state.x ? "west" : nearest.y > state.y ? "south" : "north";
        messages.push(`The spirits whisper: a ${nearest.name || "creature"} lurks to the ${dir}.`);
        return true;
      }

      // ── Restore a spirit to 1 HP ──────────────────────────────────────────
      function restoreSpirit(memberName, messages) {
        if (context.spiritsDisabled) { messages.push("Spirits are not active."); return false; }
        if ((state.gold || 0) < RESTORE_COST) {
          messages.push(`Not enough gold (need ${RESTORE_COST}).`);
          return false;
        }
        const member = state.party.find((m) => m.name === memberName && (m.hp || 0) === 0);
        if (!member) { messages.push(`${memberName} is not fallen.`); return false; }
        state.gold -= RESTORE_COST;
        member.hp = 1;
        // Remove the spirit.
        state.spirits = state.spirits.filter((s) => s.memberName !== memberName);
        messages.push(`${memberName} is restored by the spirit's lingering will. (${RESTORE_COST} gold spent)`);
        return true;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickSpirits(messages) {
        if (context.spiritsDisabled) return;

        // Detect newly-fallen members and spawn spirits.
        for (const m of state.party) {
          if ((m.hp || 0) === 0) _spawnSpirit(m);
        }

        // Tick spirit duration.
        for (const spirit of state.spirits) {
          if (!spirit.active) continue;
          spirit.turns -= 1;
          if (spirit.turns <= 0) {
            spirit.active = false;
            messages.push(`${spirit.memberName}'s spirit fades away.`);
          }
        }

        // Prune fully-expired spirits.
        state.spirits = state.spirits.filter((s) => s.active || s.turns > 0);
      }

      context.spiritShield       = spiritShield;
      context.consumeSpiritShield = consumeSpiritShield;
      context.spiritWhisper      = spiritWhisper;
      context.restoreSpirit      = restoreSpirit;

      turnHooks.push(tickSpirits);
    }
  };
}());
