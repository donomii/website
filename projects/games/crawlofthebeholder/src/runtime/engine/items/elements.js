(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Wand "element variants" (ice / acid / light / roots / flame) are a small
  // family of objects that share one interface: each says what damage element
  // it deals, which impact effect to draw, and how its hit reads in the log.
  // Previously these three questions were answered by three separate functions
  // that each re-ran the same `item.name.includes(...)` chain. Here the variant
  // is detected once and the answers come from one table.
  //
  // element and effect intentionally have different key sets: a "flame" wand
  // deals fire but uses the default "flame" effect sprite; "light"/"roots" draw
  // their own effect but carry no damage element. `note` controls whether the
  // hit message appends the resist/vulnerable annotation.
  window.CotBRuntime.installItemElements = function installItemElements(context) {
    with (context) {
      const WAND_PROFILES = {
        ice:     { element: "cold", effect: "ice",    verb: "freezes",         note: true  },
        acid:    { element: "acid", effect: "poison", verb: "splashes",        note: true  },
        light:   { element: null,   effect: "smite",  verb: "flashes through", note: false },
        roots:   { element: null,   effect: "impact", verb: "roots",           note: false },
        flame:   { element: "fire", effect: "flame",  verb: "burns",           note: true  },
        default: { element: null,   effect: "flame",  verb: "burns",           note: true  }
      };
      // Checked in priority order; real wand names carry exactly one token.
      const WAND_TOKENS = ["ice", "acid", "light", "roots", "flame"];

      function wandProfile(item) {
        const token = WAND_TOKENS.find((t) => item.name.includes(t));
        return WAND_PROFILES[token] || WAND_PROFILES.default;
      }

      function wandElement(item) {
        return wandProfile(item).element;
      }

      function wandEffectKind(item) {
        return wandProfile(item).effect;
      }

      function wandHitMessage(item, target, baseDamage, damage) {
        if (damage === 0) return `${item.name} washes over the ${target.name}. It resists.`;
        const profile = wandProfile(item);
        const note = profile.note ? monsterDamageNote(baseDamage, damage) : "";
        return `${item.name} ${profile.verb} the ${target.name} for ${damage}.${note}`;
      }

      context.wandProfile = wandProfile;
      context.wandElement = wandElement;
      context.wandEffectKind = wandEffectKind;
      context.wandHitMessage = wandHitMessage;
    }
  };
}());
