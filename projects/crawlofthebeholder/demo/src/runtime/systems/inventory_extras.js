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

      Object.assign(context, {
        isUnidentified,
        isCursed,
        isBlessed,
        identifyItem,
        identifyAllOfKind,
        identifyAll,
        unidentifiedLabel,
        displayItemName,
        annotateItem,
        seedItemFlags
      });

      seedItemFlags();
    }
  };
}());
