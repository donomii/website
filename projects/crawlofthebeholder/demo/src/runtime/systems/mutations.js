(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installMutations = function installMutations(context) {
    with (context) {
      // ── Constants ──────────────────────────────────────────────────────────
      // Re-skinned with real DCSS mutation names + flavour (see
      // dat/descript/mutations.txt, surfaced at runtime via mutationLore()).
      const MUTATION_DEFS = {
        "iron-skin":     { label: "Tough Skin",   mut: "tough skin",   defBonus: 2, powerBonus: 0, desc: "Your epidermis has hardened, providing protection." },
        "predator-eyes": { label: "Acute Vision", mut: "acute vision", defBonus: 0, powerBonus: 1, desc: "Your vision is sharp; you can see invisible creatures." },
        "arcane-veins":  { label: "Augmentation", mut: "augmentation", defBonus: 0, powerBonus: 1, desc: "While in good health, you strike with greater power." },
        "stone-heart":   { label: "Rugged Scales", mut: "rugged brown scales", defBonus: 1, powerBonus: 0, desc: "Rough scales toughen your hide against harm." },
        "swift-limbs":   { label: "Fast",         mut: "fast",         defBonus: 0, powerBonus: 1, desc: "Your muscles are quick; you move and strike faster." },
        "shadow-touch":  { label: "Nightstalker", mut: "nightstalker", defBonus: 0, powerBonus: 1, desc: "You are attuned to the shadows, striking from the dark." }
      };
      const MUTATION_KINDS = Object.keys(MUTATION_DEFS);
      const EXPOSURE_THRESHOLD = 20;

      context.MUTATION_DEFS  = MUTATION_DEFS;
      context.MUTATION_KINDS = MUTATION_KINDS;

      // ── State initialisation ───────────────────────────────────────────────
      if (!state.mutationExposure) state.mutationExposure = 0;
      for (const m of state.party) {
        if (!m.mutations) m.mutations = [];
      }

      // ── Helpers ────────────────────────────────────────────────────────────
      function gainMutation(member, kind) {
        if (!MUTATION_DEFS[kind]) return false;
        if (!member.mutations) member.mutations = [];
        if (member.mutations.includes(kind)) return false; // idempotent
        member.mutations.push(kind);
        return true;
      }

      function hasMutation(member, kind) {
        return Array.isArray(member.mutations) && member.mutations.includes(kind);
      }

      function mutationPowerBonus(member) {
        if (context.mutationsDisabled) return 0;
        if (!member || !Array.isArray(member.mutations)) return 0;
        let bonus = 0;
        for (const kind of member.mutations) {
          const def = MUTATION_DEFS[kind];
          if (def) bonus += def.powerBonus;
        }
        return bonus;
      }

      function mutationDefenseBonus(member) {
        if (context.mutationsDisabled) return 0;
        if (!member || !Array.isArray(member.mutations)) return 0;
        let bonus = 0;
        for (const kind of member.mutations) {
          const def = MUTATION_DEFS[kind];
          if (def) bonus += def.defBonus;
        }
        return bonus;
      }

      function addExposure(amount) {
        if (context.mutationsDisabled) return;
        state.mutationExposure = (state.mutationExposure || 0) + amount;
        const messages = [];
        while (state.mutationExposure >= EXPOSURE_THRESHOLD) {
          state.mutationExposure -= EXPOSURE_THRESHOLD;
          // Roll a random mutation for a random live party member.
          const alive = state.party.filter((m) => (m.hp || 0) > 0);
          if (!alive.length) break;
          const target = alive[Math.floor(Math.random() * alive.length)];
          const kind = MUTATION_KINDS[Math.floor(Math.random() * MUTATION_KINDS.length)];
          const gained = gainMutation(target, kind);
          if (gained) {
            messages.push(`${target.name} mutates: ${MUTATION_DEFS[kind].label}.`);
          }
        }
        if (messages.length && typeof addMessage === "function") {
          addMessage(messages.join(" "));
        }
      }

      context.gainMutation       = gainMutation;
      context.hasMutation        = hasMutation;
      context.mutationPowerBonus = mutationPowerBonus;
      context.mutationDefenseBonus = mutationDefenseBonus;
      context.addExposure        = addExposure;
    }
  };
}());
