(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Relics: six unique charged items with powerful active abilities.
  // Relics gain charges from kills (chargeRelics called from killMonster).
  // Passive effects tick each turn. Active abilities cost charges.
  // Gated by context.relicsDisabled.
  window.CotBRuntime.installRelics = function (context) {
    with (context) {
      const RELIC_DEFS = [
        {
          id: "relic-aegis",     name: "Aegis of the Fallen", kind: "relic", relicKind: "aegis",
          description: "Active (3 charges): Shield all members for 8 turns (+4 armor).",
          chargesMax: 3, chargesPerKill: 1, value: 80,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/armour/large_shield.png"
        },
        {
          id: "relic-wrathstone", name: "Wrathstone",         kind: "relic", relicKind: "wrathstone",
          description: "Active (4 charges): Next attack deals triple damage.",
          chargesMax: 4, chargesPerKill: 1, value: 80,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/stone.png"
        },
        {
          id: "relic-soulbell",  name: "Soulbell",             kind: "relic", relicKind: "soulbell",
          description: "Active (2 charges): Restore 30% max HP to all live members.",
          chargesMax: 2, chargesPerKill: 1, value: 80,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/bell.png"
        },
        {
          id: "relic-voidlens",  name: "Void Lens",            kind: "relic", relicKind: "voidlens",
          description: "Active (3 charges): Reveal all monsters on this floor for 5 turns.",
          chargesMax: 3, chargesPerKill: 1, value: 80,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/lens.png"
        },
        {
          id: "relic-timeglass", name: "Timeglass",            kind: "relic", relicKind: "timeglass",
          description: "Active (5 charges): Freeze all monsters for 4 turns.",
          chargesMax: 5, chargesPerKill: 1, value: 80,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/hourglass.png"
        },
        {
          id: "relic-bonecrown", name: "Bonecrown",            kind: "relic", relicKind: "bonecrown",
          description: "Passive: Nearby undead deal -2 damage. Active (6 charges): Convert one monster to an ally.",
          chargesMax: 6, chargesPerKill: 1, value: 80,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/armour/crown_of_demonkind.png"
        }
      ];

      // Register relics as purchasable (idempotent).
      (function registerRelics() {
        for (const tpl of RELIC_DEFS) {
          if (!resources.inventory.some((i) => i.id === tpl.id)) {
            resources.inventory.push({ ...tpl, charges: 0 });
          }
        }
      }());

      function equippedRelics() {
        // Relics in inventory are "equipped" by virtue of being carried.
        return state.inventory.filter((i) => i.kind === "relic");
      }

      // Add 1 charge to every carried relic on kill.
      function chargeRelics(monster) {
        if (context.relicsDisabled) return;
        for (const relic of equippedRelics()) {
          const def = RELIC_DEFS.find((d) => d.relicKind === relic.relicKind);
          if (!def) continue;
          const gain = def.chargesPerKill || 1;
          relic.charges = Math.min(def.chargesMax || 6, (relic.charges || 0) + gain);
        }
      }

      // Activate a relic's ability, spending charges.
      function activateRelic(itemId, messages) {
        const relic = state.inventory.find((i) => i.id === itemId && i.kind === "relic");
        if (!relic) { messages.push("Relic not found."); return false; }
        const def = RELIC_DEFS.find((d) => d.relicKind === relic.relicKind);
        if (!def) { messages.push("Unknown relic."); return false; }
        if ((relic.charges || 0) < def.chargesMax) {
          messages.push(`${relic.name} needs ${def.chargesMax} charges (has ${relic.charges || 0}).`);
          return false;
        }
        relic.charges = 0;
        const floorState = currentFloorState();

        switch (relic.relicKind) {
          case "aegis":
            for (const m of liveMembers()) m.shieldTurns = Math.max(m.shieldTurns || 0, 8);
            messages.push(`${relic.name} raises a barrier around the party!`);
            break;
          case "wrathstone":
            state.wrathstoneActive = true;
            messages.push(`${relic.name} hums — the next blow will be devastating.`);
            break;
          case "soulbell":
            for (const m of liveMembers()) {
              const heal = Math.max(1, Math.ceil(m.maxHp * 0.3));
              m.hp = Math.min(m.maxHp, m.hp + heal);
            }
            messages.push(`${relic.name} chimes — wounds knit closed.`);
            break;
          case "voidlens":
            for (const m of floorState.monsters) {
              if (m.hp > 0) floorState.discovered.add(keyOf(m.x, m.y));
            }
            state.voidlensTurns = 5;
            messages.push(`${relic.name} pulses — every foe is revealed!`);
            break;
          case "timeglass":
            for (const m of floorState.monsters) if (m.hp > 0) m.frozenTurns = Math.max(m.frozenTurns || 0, 4);
            messages.push(`${relic.name} shatters time — the dungeon stands still.`);
            break;
          case "bonecrown": {
            // Attempt to convert the nearest undead monster to an ally.
            const undead = floorState.monsters.filter((m) => m.hp > 0 && m.traits?.undead);
            if (undead.length === 0) { messages.push(`${relic.name} finds no undead to turn.`); relic.charges = def.chargesMax; return false; }
            const nearest = undead.reduce((best, m) => {
              const d = Math.abs(m.x - state.x) + Math.abs(m.y - state.y);
              const bd = Math.abs(best.x - state.x) + Math.abs(best.y - state.y);
              return d < bd ? m : best;
            });
            nearest.ally = true;
            nearest.alerted = false;
            messages.push(`${relic.name} commands — ${nearest.name} serves the crown!`);
            break;
          }
          default:
            messages.push(`${relic.name} releases its energy.`);
        }
        return true;
      }

      // Passive tick: voidlens tracks turns, bonecrown reduces undead damage.
      function tickRelicPassives(messages) {
        if (context.relicsDisabled) return false;
        if (state.voidlensTurns > 0) {
          state.voidlensTurns -= 1;
          if (state.voidlensTurns === 0) messages.push("The Void Lens dims.");
        }
        return false;
      }

      turnHooks.push(tickRelicPassives);

      context.chargeRelics   = chargeRelics;
      context.activateRelic  = activateRelic;
      context.equippedRelics = equippedRelics;
      context.RELIC_DEFS     = RELIC_DEFS;
    }
  };
}());
