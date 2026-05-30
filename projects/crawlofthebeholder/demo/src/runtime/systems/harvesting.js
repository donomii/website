(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installHarvesting = function installHarvesting(context) {
    with (context) {
      // ── Reagent definitions ────────────────────────────────────────────────
      const REAGENT_DEFS = {
        "bone-dust":   { label: "Bone Dust",    passiveKind: "defense", bonus: 1 },
        "venom-gland": { label: "Venom Gland",  passiveKind: "power",   bonus: 1 },
        "hide-shard":  { label: "Hide Shard",   passiveKind: "defense", bonus: 1 },
        "mana-crystal":{ label: "Mana Crystal", passiveKind: "power",   bonus: 1 },
        "void-essence":{ label: "Void Essence", passiveKind: "power",   bonus: 2 }
      };
      const REAGENT_KINDS   = Object.keys(REAGENT_DEFS);
      const REAGENT_STACK_THRESHOLD = 3; // every 3 of a reagent = +1 bonus

      context.REAGENT_DEFS  = REAGENT_DEFS;
      context.REAGENT_KINDS = REAGENT_KINDS;

      // ── Item registration ─────────────────────────────────────────────────
      for (const [kind, def] of Object.entries(REAGENT_DEFS)) {
        const id = `reagent-${kind}`;
        if (!resources.inventory.some((i) => i.id === id)) {
          resources.inventory.push({ id, name: def.label, kind: "reagent", subkind: kind, value: 4 });
        }
      }

      // ── State initialisation ──────────────────────────────────────────────
      if (!state.harvestQueue) state.harvestQueue = [];

      // ── Hook: record a kill for harvesting ───────────────────────────────
      function recordHarvest(monster) {
        if (context.harvestingDisabled) return;
        const entry = {
          id:     monster.id || `harvest-${Date.now()}`,
          name:   monster.name || "creature",
          traits: monster.traits || {},
          hd:     monster.hd    || 1,
          x:      monster.x     || state.x,
          y:      monster.y     || state.y,
          ttl:    5 // turns before this corpse becomes unharvestable
        };
        state.harvestQueue.push(entry);
        if (state.harvestQueue.length > 8) state.harvestQueue.shift();
      }

      // ── Determine reagent drops for a corpse ─────────────────────────────
      function _reagentsFor(entry) {
        const drops = [];
        if (entry.traits.undead || entry.traits.construct)    drops.push("bone-dust");
        if (entry.traits.poison || entry.traits.venomous)     drops.push("venom-gland");
        if (entry.traits.beast  || entry.traits.dragon)       drops.push("hide-shard");
        if (entry.traits.magic  || entry.traits.spellcasting) drops.push("mana-crystal");
        if (entry.hd >= 5)                                    drops.push("void-essence");
        // Default: any monster gives bone-dust or hide-shard
        if (!drops.length) drops.push(entry.hd >= 3 ? "hide-shard" : "bone-dust");
        return drops;
      }

      // ── Harvest a specific corpse ─────────────────────────────────────────
      function harvestCorpse(harvestId, messages) {
        if (context.harvestingDisabled) { messages.push("Harvesting is not active."); return false; }
        const entry = state.harvestQueue.find((e) => e.id === harvestId);
        if (!entry) { messages.push("That corpse is no longer available."); return false; }
        const drops = _reagentsFor(entry);
        state.harvestQueue = state.harvestQueue.filter((e) => e !== entry);
        for (const kind of drops) {
          const def = REAGENT_DEFS[kind];
          state.inventory.push({
            id:      `reagent-${kind}-${state.lootSerial = (state.lootSerial || 0) + 1}`,
            name:    def.label,
            kind:    "reagent",
            subkind: kind,
            value:   4
          });
        }
        messages.push(`Harvested ${drops.map((k) => REAGENT_DEFS[k].label).join(", ")} from ${entry.name}.`);
        return true;
      }

      // Harvest the most recent corpse in the queue.
      function harvestLastKill(messages) {
        if (context.harvestingDisabled) { messages.push("Harvesting is not active."); return false; }
        if (!state.harvestQueue.length) { messages.push("No recent kill to harvest."); return false; }
        const entry = state.harvestQueue[state.harvestQueue.length - 1];
        return harvestCorpse(entry.id, messages);
      }

      // ── Reagent count query ───────────────────────────────────────────────
      function reagentCount(kind) {
        return state.inventory.filter((i) => i.kind === "reagent" && i.subkind === kind).length;
      }

      // ── Passive bonus: every THRESHOLD reagents of a power kind = +1 atk ─
      function harvestPowerBonus(member) {
        if (context.harvestingDisabled) return 0;
        let bonus = 0;
        for (const [kind, def] of Object.entries(REAGENT_DEFS)) {
          if (def.passiveKind === "power") {
            bonus += Math.floor(reagentCount(kind) / REAGENT_STACK_THRESHOLD);
          }
        }
        return bonus;
      }

      // ── Passive bonus: defense reagents ───────────────────────────────────
      function harvestDefenseBonus() {
        if (context.harvestingDisabled) return 0;
        let bonus = 0;
        for (const [kind, def] of Object.entries(REAGENT_DEFS)) {
          if (def.passiveKind === "defense") {
            bonus += Math.floor(reagentCount(kind) / REAGENT_STACK_THRESHOLD);
          }
        }
        return bonus;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickHarvesting(_messages) {
        if (context.harvestingDisabled) return;
        // Decay corpse TTL
        for (const e of state.harvestQueue) e.ttl = (e.ttl || 1) - 1;
        state.harvestQueue = state.harvestQueue.filter((e) => e.ttl > 0);
      }

      context.recordHarvest      = recordHarvest;
      context.harvestCorpse      = harvestCorpse;
      context.harvestLastKill    = harvestLastKill;
      context.reagentCount       = reagentCount;
      context.harvestPowerBonus  = harvestPowerBonus;
      context.harvestDefenseBonus = harvestDefenseBonus;

      turnHooks.push(tickHarvesting);
    }
  };
}());
