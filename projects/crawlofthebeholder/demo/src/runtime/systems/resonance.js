(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installResonance = function installResonance(context) {
    with (context) {
      // Bonus per element type when weapon and armor share the same rune/enchantment.
      const RESONANCE_BONUSES = {
        fire:   { power: 3, defense: 0, label: "Blazing Resonance"    },
        ice:    { power: 0, defense: 3, label: "Glacial Resonance"    },
        life:   { power: 1, defense: 2, label: "Vital Resonance"      },
        storm:  { power: 2, defense: 1, label: "Storm Resonance"      },
        shadow: { power: 2, defense: 0, label: "Shadow Resonance"     },
        earth:  { power: 0, defense: 4, label: "Stone Resonance"      }
      };

      context.RESONANCE_BONUSES = RESONANCE_BONUSES;

      // ── Query helpers ──────────────────────────────────────────────────────
      function resonanceKind(member) {
        if (context.resonanceDisabled) return null;
        const weaponRune  = member.weapon  && (member.weapon.runeKind  || member.weapon.element);
        const armourRune  = member.armour  && (member.armour.runeKind  || member.armour.element);
        if (!weaponRune || !armourRune) return null;
        if (weaponRune !== armourRune)  return null;
        return RESONANCE_BONUSES[weaponRune] ? weaponRune : null;
      }

      function resonancePowerBonus(member) {
        if (context.resonanceDisabled) return 0;
        const kind = resonanceKind(member);
        return kind ? (RESONANCE_BONUSES[kind].power || 0) : 0;
      }

      function resonanceDefenseBonus(member) {
        if (context.resonanceDisabled) return 0;
        const kind = resonanceKind(member);
        return kind ? (RESONANCE_BONUSES[kind].defense || 0) : 0;
      }

      function resonanceName(member) {
        const kind = resonanceKind(member);
        return kind ? RESONANCE_BONUSES[kind].label : null;
      }

      // ── Check if any member has resonance ─────────────────────────────────
      function partyHasResonance() {
        if (context.resonanceDisabled) return false;
        return state.party.some((m) => resonanceKind(m) !== null);
      }

      context.resonanceKind          = resonanceKind;
      context.resonancePowerBonus    = resonancePowerBonus;
      context.resonanceDefenseBonus  = resonanceDefenseBonus;
      context.resonanceName          = resonanceName;
      context.partyHasResonance      = partyHasResonance;
      // No turnHook needed — resonance is purely passive/reactive.
    }
  };
}());
