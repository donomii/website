(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installHerbalism = function installHerbalism(context) {
    with (context) {
      // ── Constants ──────────────────────────────────────────────────────────
      const HERB_TEMPLATES = [
        { id: "herb-healbark",  name: "healbark sprig",    kind: "herb", subkind: "healbark",  value: 5  },
        { id: "herb-clearweed", name: "clearweed bunch",   kind: "herb", subkind: "clearweed", value: 4  },
        { id: "herb-thornroot", name: "thornroot cluster", kind: "herb", subkind: "thornroot", value: 5  },
        { id: "herb-voidmoss",  name: "voidmoss patch",    kind: "herb", subkind: "voidmoss",  value: 6  },
        { id: "herb-sunpetal",  name: "sunpetal bloom",    kind: "herb", subkind: "sunpetal",  value: 6  }
      ];

      const POULTICE_TEMPLATE = {
        id: "herb-poultice", name: "herb poultice", kind: "poultice", value: 3,
        desc: "Mix with an herb to apply its effect."
      };

      context.HERB_TEMPLATES = HERB_TEMPLATES;

      // ── Item registration ─────────────────────────────────────────────────
      for (const tpl of HERB_TEMPLATES) {
        if (!resources.inventory.some((i) => i.id === tpl.id)) resources.inventory.push({ ...tpl });
      }
      if (!resources.inventory.some((i) => i.id === POULTICE_TEMPLATE.id)) {
        resources.inventory.push({ ...POULTICE_TEMPLATE });
      }

      // ── State initialisation ──────────────────────────────────────────────
      if (!("thornrootTurns" in state)) state.thornrootTurns = 0;
      if (!("voidmossTurns"  in state)) state.voidmossTurns  = 0;
      if (!("herbGathered"   in state)) state.herbGathered   = 0;

      // ── Per-floor accessors ───────────────────────────────────────────────
      function herbedTiles() {
        const fs = currentFloorState();
        if (!fs.herbedTiles) fs.herbedTiles = new Set();
        return fs.herbedTiles;
      }

      function tileKey(x, y) { return `${x},${y}`; }

      // ── Gather ────────────────────────────────────────────────────────────
      function gatherHerb(messages) {
        if (context.herbalismDisabled) {
          messages.push("Herbalism is not active.");
          return false;
        }
        const key = tileKey(state.x, state.y);
        if (herbedTiles().has(key)) {
          messages.push("You have already searched here.");
          return false;
        }
        herbedTiles().add(key);
        if (Math.random() < 0.4) {
          const tpl = HERB_TEMPLATES[Math.floor(Math.random() * HERB_TEMPLATES.length)];
          const item = { ...tpl, id: `herb-${state.lootSerial = (state.lootSerial || 0) + 1}` };
          state.inventory.push(item);
          state.herbGathered += 1;
          messages.push(`You find a ${item.name} among the roots.`);
          return true;
        }
        messages.push("No useful plants here.");
        return false;
      }

      // ── Make poultice ─────────────────────────────────────────────────────
      function makePoultice(herbId, messages) {
        if (context.herbalismDisabled) {
          messages.push("Herbalism is not active.");
          return false;
        }
        const herb = state.inventory.find((i) => i.id === herbId && i.kind === "herb");
        if (!herb) {
          messages.push("Herb not found in inventory.");
          return false;
        }
        const poultice = state.inventory.find((i) => i.kind === "poultice");
        if (!poultice) {
          messages.push("You need a poultice to apply the herb.");
          return false;
        }
        // Consume both.
        state.inventory = state.inventory.filter((i) => i !== herb && i !== poultice);
        // Apply effect.
        switch (herb.subkind) {
          case "healbark": {
            let healed = 0;
            for (const m of state.party) {
              if ((m.hp || 0) > 0) {
                const gain = Math.min(10, (m.maxHp || m.hp) - m.hp);
                m.hp += gain;
                healed += gain;
              }
            }
            messages.push(`Healbark poultice heals the party for ${healed} HP.`);
            break;
          }
          case "clearweed":
            state.poisonedTurns = 0;
            messages.push("Clearweed poultice clears all poison.");
            break;
          case "thornroot":
            state.thornrootTurns = Math.max(state.thornrootTurns || 0, 5);
            messages.push("Thornroot poultice toughens the party (+5 defense for 5 turns).");
            break;
          case "voidmoss":
            state.voidmossTurns = Math.max(state.voidmossTurns || 0, 5);
            messages.push("Voidmoss poultice sharpens the party (+1 power for 5 turns).");
            break;
          case "sunpetal":
            for (const m of state.party) {
              if ((m.hp || 0) > 0) m.hp = Math.min(m.maxHp || m.hp, m.hp + 5);
            }
            messages.push("Sunpetal poultice restores 5 HP to each party member.");
            break;
          default:
            messages.push(`Applied ${herb.name}.`);
        }
        return true;
      }

      // ── Passive bonuses ───────────────────────────────────────────────────
      function herbismBonus() {
        if (context.herbalismDisabled) return 0;
        return state.inventory.some((i) => i.kind === "herb") ? 1 : 0;
      }

      function herbThornsDefenseBonus() {
        if (context.herbalismDisabled) return 0;
        return (state.thornrootTurns || 0) > 0 ? 5 : 0;
      }

      function herbVoidPowerBonus(_member) {
        if (context.herbalismDisabled) return 0;
        return (state.voidmossTurns || 0) > 0 ? 1 : 0;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickHerbalism(_messages) {
        if (context.herbalismDisabled) return;
        if ((state.thornrootTurns || 0) > 0) state.thornrootTurns -= 1;
        if ((state.voidmossTurns  || 0) > 0) state.voidmossTurns  -= 1;
        // Every 10 turns: 20% chance to re-allow gathering on previously searched tiles.
        if ((state.floorTurnCount || 0) > 0 && state.floorTurnCount % 10 === 0) {
          const ht = herbedTiles();
          for (const key of Array.from(ht)) {
            if (Math.random() < 0.2) ht.delete(key);
          }
        }
      }

      context.gatherHerb             = gatherHerb;
      context.makePoultice            = makePoultice;
      context.herbismBonus            = herbismBonus;
      context.herbThornsDefenseBonus  = herbThornsDefenseBonus;
      context.herbVoidPowerBonus      = herbVoidPowerBonus;
      context.herbedTiles             = herbedTiles;

      turnHooks.push(tickHerbalism);
    }
  };
}());
