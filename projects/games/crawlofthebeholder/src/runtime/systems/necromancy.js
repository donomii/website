(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installNecromancy = function installNecromancy(context) {
    with (context) {
      const MAX_CHARGES   = 3;
      const KILLS_PER_CHARGE = 5;
      const CORPSE_QUEUE_MAX = 5;
      const UPKEEP_HP     = 1; // HP drained from undead allies per turn

      // Undead type selection by monster hd.
      function _undeadType(hd) {
        if (hd <= 2) return "skeleton";
        if (hd <= 4) return "zombie";
        if (hd <= 6) return "wraith";
        return "revenant";
      }

      const UNDEAD_TEMPLATES = {
        skeleton: { hpMult: 0.4, powerMult: 0.6, turnsMult: 30 },
        zombie:   { hpMult: 0.7, powerMult: 0.4, turnsMult: 25 },
        wraith:   { hpMult: 0.5, powerMult: 0.7, turnsMult: 20 },
        revenant: { hpMult: 0.9, powerMult: 0.8, turnsMult: 35 }
      };

      context.UNDEAD_TEMPLATES = UNDEAD_TEMPLATES;

      // ── State initialisation ──────────────────────────────────────────────
      if (!("necroCharges"     in state)) state.necroCharges     = 0;
      if (!("necroKillCount"   in state)) state.necroKillCount   = 0;
      if (!("lastNecroKills"   in state)) state.lastNecroKills   = 0;
      if (!state.corpseQueue)             state.corpseQueue       = [];

      // ── Record a monster as a corpse (called from killMonster hook) ───────
      function recordCorpse(monster) {
        if (context.necromancyDisabled) return;
        const corpse = {
          id:     monster.id   || `corpse-${Date.now()}`,
          name:   monster.name || "creature",
          x:      monster.x    || state.x,
          y:      monster.y    || state.y,
          hd:     monster.hd   || 1,
          power:  monster.power  || 4,
          maxHp:  monster.maxHp  || 8
        };
        state.corpseQueue.push(corpse);
        if (state.corpseQueue.length > CORPSE_QUEUE_MAX) state.corpseQueue.shift();
      }

      // ── Raise corpse ──────────────────────────────────────────────────────
      function raiseCorpse(monsterId, messages) {
        if (context.necromancyDisabled) { messages.push("Necromancy is not active."); return false; }
        if ((state.necroCharges || 0) <= 0) {
          messages.push("No necromantic charges remaining.");
          return false;
        }
        const corpse = state.corpseQueue.find((c) => c.id === monsterId);
        if (!corpse) {
          messages.push("That corpse is not in the queue.");
          return false;
        }
        const typeName = _undeadType(corpse.hd || 1);
        const tpl      = UNDEAD_TEMPLATES[typeName];
        const hp       = Math.max(1, Math.round((corpse.maxHp || 8) * tpl.hpMult));
        const power    = Math.max(1, Math.round((corpse.power || 4) * tpl.powerMult));

        const ally = typeof createAlly === "function"
          ? createAlly({ name: `undead ${corpse.name}`, hp, maxHp: hp, power, defense: 1 }, { undead: true, turns: tpl.turnsMult, x: state.x, y: state.y })
          : null;

        if (!ally) {
          messages.push("Cannot raise — too many allies already.");
          return false;
        }
        ally.undead = true;
        state.necroCharges -= 1;
        state.corpseQueue   = state.corpseQueue.filter((c) => c !== corpse);
        if (typeof addEffect === "function") addEffect("magic", [{ x: state.x, y: state.y }]);
        messages.push(`${corpse.name} rises as a ${typeName}. (Charges: ${state.necroCharges})`);
        return true;
      }

      // ── Necrotic aura ─────────────────────────────────────────────────────
      function necroticAura(messages) {
        if (context.necromancyDisabled) { messages.push("Necromancy is not active."); return false; }
        const undead = (typeof liveAllies === "function" ? liveAllies() : []).filter((a) => a.undead);
        if (!undead.length) {
          messages.push("No undead allies to empower.");
          return false;
        }
        for (const ally of undead) {
          if (!ally.necroticBoosted) {
            ally.power = (ally.power || 1) + 2;
            ally.necroticBoosted = true;
          }
        }
        messages.push(`A necrotic aura floods ${undead.length} undead ${undead.length === 1 ? "ally" : "allies"} (+2 power).`);
        return true;
      }

      // ── Banish undead ─────────────────────────────────────────────────────
      function banishUndead(messages) {
        if (context.necromancyDisabled) { messages.push("Necromancy is not active."); return false; }
        const undead = (typeof liveAllies === "function" ? liveAllies() : []).filter((a) => a.undead);
        if (!undead.length) {
          messages.push("No undead allies to banish.");
          return false;
        }
        const gold = 3 * undead.length;
        for (const ally of undead) ally.hp = 0;
        state.gold = (state.gold || 0) + gold;
        messages.push(`${undead.length} undead fade into dust. The party earns ${gold} gold.`);
        return true;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickNecromancy(messages) {
        if (context.necromancyDisabled) return;

        // Track kills → charge gain.
        const newKills = (state.monstersDefeated || 0) - (state.lastNecroKills || 0);
        state.lastNecroKills = state.monstersDefeated || 0;
        if (newKills > 0) {
          state.necroKillCount = (state.necroKillCount || 0) + newKills;
          while (state.necroKillCount >= KILLS_PER_CHARGE && state.necroCharges < MAX_CHARGES) {
            state.necroKillCount -= KILLS_PER_CHARGE;
            state.necroCharges   += 1;
            messages.push(`Necromantic charge gained. (${state.necroCharges}/${MAX_CHARGES})`);
          }
        }

        // Reset necrotic boost from previous turn.
        const allies = typeof liveAllies === "function" ? liveAllies() : [];
        for (const ally of allies) {
          if (ally.undead && ally.necroticBoosted) {
            ally.power = Math.max(1, (ally.power || 1) - 2);
            ally.necroticBoosted = false;
          }
        }

        // Upkeep: undead lose 1 HP per turn.
        for (const ally of allies) {
          if (!ally.undead) continue;
          ally.hp = Math.max(0, (ally.hp || 0) - UPKEEP_HP);
          if (ally.hp === 0) messages.push(`${ally.name} crumbles to dust.`);
        }
      }

      context.recordCorpse  = recordCorpse;
      context.raiseCorpse   = raiseCorpse;
      context.necroticAura  = necroticAura;
      context.banishUndead  = banishUndead;

      turnHooks.push(tickNecromancy);
    }
  };
}());
