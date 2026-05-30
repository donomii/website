(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Bloodlines: each party member carries a bloodline that grants passive
  // combat and defense bonuses, awakens at level 5 for a tier-2 effect,
  // and synergizes when multiple members share the same bloodline.
  // Hooks: bloodlinePowerBonus (memberAttackDamage), bloodlineDefenseBonus (hurtLiveMember).
  window.CotBRuntime.installBloodlines = function (context) {
    with (context) {
      // name, power (flat attack bonus), defense (flat damage reduction),
      // awakened (bonus at level >=5), synergy (bonus per matching ally).
      const BLOODLINE_DEFS = {
        human:    { label: "Human",    power: 0, defense: 0, awaken: { power: 2 }, synergy: { power: 1 } },
        elf:      { label: "Elf",      power: 1, defense: 0, awaken: { power: 2 }, synergy: { defense: 1 } },
        dwarf:    { label: "Dwarf",    power: 0, defense: 2, awaken: { defense: 2 }, synergy: { defense: 1 } },
        halfling: { label: "Halfling", power: 1, defense: 1, awaken: { power: 1, defense: 1 }, synergy: { power: 1 } },
        orc:      { label: "Orc",      power: 3, defense: 0, awaken: { power: 3 }, synergy: { power: 2 } },
        tiefling: { label: "Tiefling", power: 2, defense: 0, awaken: { power: 2, defense: 1 }, synergy: { power: 1, defense: 1 } }
      };
      const BLOODLINE_KINDS = Object.keys(BLOODLINE_DEFS);

      function bloodlineOf(member) {
        return member.bloodline || null;
      }

      function setBloodline(member, kind) {
        if (!BLOODLINE_DEFS[kind]) return false;
        member.bloodline = kind;
        return true;
      }

      // Auto-assign bloodlines to party members who don't have one yet
      // (random from BLOODLINE_KINDS, seeded by member name length).
      function ensureBloodlines() {
        for (let i = 0; i < state.party.length; i += 1) {
          const m = state.party[i];
          if (!m.bloodline) {
            m.bloodline = BLOODLINE_KINDS[i % BLOODLINE_KINDS.length];
          }
        }
      }

      ensureBloodlines();

      function awakenBonus(member, key) {
        const def = BLOODLINE_DEFS[member.bloodline];
        if (!def) return 0;
        const level = member.level || 1;
        return level >= 5 ? (def.awaken[key] || 0) : 0;
      }

      function synergyBonus(member, key) {
        const def = BLOODLINE_DEFS[member.bloodline];
        if (!def || !(def.synergy[key] > 0)) return 0;
        const matches = state.party.filter((m) => m !== member && m.bloodline === member.bloodline && m.hp > 0);
        return matches.length * (def.synergy[key] || 0);
      }

      // Flat attack bonus from bloodline (called in memberAttackDamage).
      // Gated by context.bloodlinesDisabled so pinned snapshot tests stay stable.
      function bloodlinePowerBonus(member) {
        if (context.bloodlinesDisabled) return 0;
        const def = BLOODLINE_DEFS[member.bloodline];
        if (!def) return 0;
        return def.power + awakenBonus(member, "power") + synergyBonus(member, "power");
      }

      // Flat defense bonus from bloodline (called in hurtLiveMember).
      function bloodlineDefenseBonus(member) {
        if (context.bloodlinesDisabled) return 0;
        const def = BLOODLINE_DEFS[member.bloodline];
        if (!def) return 0;
        return def.defense + awakenBonus(member, "defense") + synergyBonus(member, "defense");
      }

      // Display name for a member's bloodline.
      function bloodlineName(member) {
        return BLOODLINE_DEFS[member.bloodline]?.label || "Unknown";
      }

      context.bloodlineOf          = bloodlineOf;
      context.setBloodline         = setBloodline;
      context.ensureBloodlines     = ensureBloodlines;
      context.bloodlinePowerBonus  = bloodlinePowerBonus;
      context.bloodlineDefenseBonus = bloodlineDefenseBonus;
      context.bloodlineName        = bloodlineName;
      context.BLOODLINE_DEFS       = BLOODLINE_DEFS;
      context.BLOODLINE_KINDS      = BLOODLINE_KINDS;
    }
  };
}());
