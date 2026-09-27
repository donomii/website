(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installInventoryExtras = function (context) {
    with (context) {
      const UNIDENTIFIED_PREFIXES = ["weathered", "ancient", "etched", "tarnished", "humming", "scarred", "twisted", "glossy"];

      function isUnidentified(item) {
        if (!item) return false;
        if (state.identifiedKinds && state.identifiedKinds.has(item.kind)) return false;
        return !!item.unidentified;
      }

      function isCursed(item) {
        return !!item?.cursed;
      }

      function isBlessed(item) {
        return !!item?.blessed;
      }

      function identifyItem(item) {
        if (!item) return false;
        const changed = !!item.unidentified;
        if (item.unidentified) item.unidentified = false;
        if (item.kind && state.identifiedKinds) state.identifiedKinds.add(item.kind);
        return changed;
      }

      function identifyAllOfKind(kind) {
        if (!kind || !state.identifiedKinds) return 0;
        state.identifiedKinds.add(kind);
        let count = 0;
        for (const item of state.inventory) {
          if (item.kind === kind && item.unidentified) {
            item.unidentified = false;
            count += 1;
          }
        }
        return count;
      }

      function identifyAll() {
        let count = 0;
        for (const item of state.inventory) {
          if (item.unidentified) { item.unidentified = false; count += 1; }
          if (item.kind && state.identifiedKinds) state.identifiedKinds.add(item.kind);
        }
        return count;
      }

      function unidentifiedLabel(item) {
        if (!item) return "?";
        // Pick a deterministic prefix per (kind, id).
        const seed = `${item.kind || "item"}-${item.id || item.name}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
        const prefix = UNIDENTIFIED_PREFIXES[hash % UNIDENTIFIED_PREFIXES.length];
        return `${prefix} ${item.kind || "item"}`;
      }

      function displayItemName(item) {
        if (!item) return "";
        if (isUnidentified(item)) return unidentifiedLabel(item);
        const enchant = item.enchantment ? ` +${item.enchantment}` : "";
        const flag = isBlessed(item) ? " (blessed)" : isCursed(item) ? " (cursed)" : "";
        return `${item.name}${enchant}${flag}`;
      }

      function annotateItem(item, options) {
        if (!item || item.kind === "quest" || item.kind === "gold") return item;
        if (options.unidentified) item.unidentified = true;
        if (options.cursed) {
          item.cursed = true;
        }
        if (options.blessed) {
          item.blessed = true;
          if (typeof item.power === "number") item.power += 1;
        }
        if (typeof options.enchantment === "number" && options.enchantment > 0) {
          item.enchantment = (item.enchantment || 0) + options.enchantment;
          if (typeof item.power === "number") item.power += options.enchantment;
        }
        return item;
      }

      // Apply curses, blessings, and unidentified flags to items spawned on
      // floors, based on floor depth. Runs once per resources load.
      function seedItemFlags() {
        if (context.itemFlagsDisabled || state.itemFlagsSeeded) return;
        state.itemFlagsSeeded = true;
        for (let floorIndex = 0; floorIndex < resources.floors.length; floorIndex += 1) {
          const floor = resources.floors[floorIndex];
          const depth = floorIndex + 1;
          for (const item of floor.floorItems || []) {
            if (item.kind === "gold" || item.kind === "quest") continue;
            // Hash-based deterministic seeding by id.
            const idHash = hashStringDeterministic(item.id || `${item.name}-${item.x}-${item.y}-${floorIndex}`);
            const cursedRoll = (idHash % 10);
            const blessedRoll = ((idHash >> 4) % 14);
            const unknownRoll = ((idHash >> 8) % 10);
            if (depth >= 2 && cursedRoll < 1) annotateItem(item, { cursed: true });
            if (depth >= 1 && blessedRoll < 1) annotateItem(item, { blessed: true });
            if (depth >= 2 && unknownRoll < 4 && !item.cursed) annotateItem(item, { unidentified: true });
          }
        }
      }

      function hashStringDeterministic(text) {
        let hash = 5381;
        for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
        return hash;
      }

      // One-line "what it does" per kind, mirroring the ITEM_USE handlers.
      const ITEM_EFFECT_LINES = {
        healing: (item) => `Drink once: heals the most wounded living member ${item.power || 0} HP${(item.name || "").includes("curing") ? "; cures poison and barbs" : ""}. Does not revive fallen members.`,
        mapping: () => "Read: reveals the whole floor.",
        might: (item) => `Drink: party might for ${item.turns || 18} turns.`,
        resistance: (item) => `Drink: halves elemental damage for ${item.turns || 16} turns.`,
        haste: (item) => `Drink: party haste for ${item.turns || 14} turns.`,
        blink: () => "Use: short random teleport.",
        teleport: () => "Use: teleports the party far away.",
        fear: () => "Read: sends nearby monsters fleeing.",
        confuse: (item) => `Read: confuses nearby monsters for ${item.turns || 5} turns.`,
        fog: (item) => `Use: sight-blocking fog for ${item.turns || 7} turns.`,
        poison: (item) => `Use: fills nearby tiles with poison for ${item.turns || 6} turns.`,
        immolation: () => "Read: ignites visible monsters from within.",
        silence: (item) => `Read: silence for ${item.turns || 10} turns — ranged casters go quiet.`,
        identify: () => "Read: names an unknown item.",
        remove_curse: () => "Read: lifts curses from worn gear.",
        food: (item) => context.hungerDisabled ? "Legacy food: not needed; this expedition has no hunger clock." : `Eat: restores ${item.power || 0} satiety.`,
        torch: () => "Carried: extends the party's sight.",
        throwable: (item) => `Throw at the nearest foe: ${item.power || 0} damage${item.status ? `, inflicts ${item.status}` : ""}.`,
        evocable: (item) => `Evoke: ${item.charges != null ? `${item.charges} charge${item.charges === 1 ? "" : "s"} of ` : ""}${item.name}.`,
        wand: (item) => `Zap at the nearest foe (${item.charges != null ? `${item.charges} charges` : "charged"}).`,
        scroll: () => "Read: casts the spell written on it.",
        glyph: () => "Read: inscribes a ward on this tile.",
        charm: () => "Use: sways a nearby monster to your side.",
        taming: () => "Use: tames a nearby beast.",
        recall: () => "Use: recalls the party to the upstairs.",
        trapkit: () => "Use: deploys a trap on the tile ahead.",
        treasure_map: () => "Read: marks a cache on the floor.",
        "alch-fire": (item) => `Throw: fire burst, ${item.power || 0} damage.`,
        weapon: (item) => `Equip: weapon, +${item.power || 0} power.${item.proc === "vampiric" ? " Lifesteal is inactive; use recovery supplies." : ""}`,
        armour: (item) => `Equip: armour${item.power ? `, ${item.power} protection` : ""}.`,
        talisman: (item) => `Equip: talisman${item.power ? `, +${item.power} power` : ""}.`,
        ring: (item) => `Equip: ring${item.bonus ? ` of ${item.bonus}` : ""}.`,
        amulet: (item) => `Equip: amulet${item.bonus ? ` of ${item.bonus}` : ""}.${/regeneration|vitality/.test(item.name || "") || item.bonus === "regen" ? " Does not restore health while waiting." : ""}`,
        quest: () => "The reason the party came down here.",
        gold: () => "Spends itself."
      };

      // Everything a front end needs to present an item at a glance — the 2D
      // tooltip and the VR detail strip both read this.
      function itemInfo(item) {
        if (!item) return null;
        const unidentified = isUnidentified(item);
        const effect = unidentified
          ? "Unidentified — use it to learn what it does."
          : (ITEM_EFFECT_LINES[item.kind] || (() => "Usable from the pack."))(item);
        const stats = [];
        if (!unidentified) {
          if (typeof item.power === "number" && item.power !== 0) stats.push(`power ${item.power}`);
          if (item.turns) stats.push(`${item.turns} turns`);
          if (item.charges != null) stats.push(`${item.charges} charges`);
          const elements = item.elements || (item.element ? [item.element] : []);
          if (elements.length > 0) stats.push(elements.join("/"));
        }
        if (typeof itemWeight === "function") stats.push(`wt ${itemWeight(item)}`);
        if (typeof itemValue === "function") stats.push(`${itemValue(item)}g`);
        const spec = !unidentified && typeof equipKindSpec === "function" ? equipKindSpec(item.kind) : null;
        return {
          name: displayItemName(item),
          kind: item.kind,
          effect,
          stats,
          slot: spec ? spec.slot : null,
          cursed: !unidentified && isCursed(item),
          blessed: !unidentified && isBlessed(item),
          lore: !unidentified && typeof itemLore === "function" ? itemLore(item.name) || "" : ""
        };
      }

      Object.assign(context, {
        isUnidentified,
        isCursed,
        isBlessed,
        identifyItem,
        identifyAllOfKind,
        identifyAll,
        unidentifiedLabel,
        displayItemName,
        itemInfo,
        annotateItem,
        seedItemFlags
      });

      seedItemFlags();
    }
  };
}());
