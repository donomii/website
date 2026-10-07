(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Legendary artefacts named from the real DCSS unrandart corpus (unrand.txt,
  // exposed via artefactNames()/artefactLore() in lore.js). Bosses can drop a
  // named artefact weapon — "Singing Sword", "Wrath of Trog", etc. — carrying
  // its authentic flavour. Opt-in (disabled by default in tests) so existing
  // loot snapshots are unperturbed; deterministic naming keeps seeded runs
  // reproducible.
  window.CotBRuntime.installArtefacts = function installArtefacts(context) {
    with (context) {
      function _hash(text) {
        let h = 2166136261;
        const s = String(text);
        for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
        return h >>> 0;
      }

      function _titleCase(name) {
        return name.replace(/\b\w/g, (c) => c.toUpperCase());
      }

      // Deterministically pick a real unrandart name for a given seed.
      function legendaryName(seed) {
        const pool = typeof artefactNames === "function" ? artefactNames() : [];
        if (!pool.length) return null;
        return _titleCase(pool[_hash(seed) % pool.length]);
      }

      // Brand an item as a named DCSS artefact (idempotent for a given seed).
      function nameArtefact(item, seed) {
        const pool = typeof artefactNames === "function" ? artefactNames() : [];
        if (!pool.length || !item) return item;
        const key = pool[_hash(seed) % pool.length];
        item.artefactName = _titleCase(key);
        item.name = item.artefactName;
        item.legendary = true;
        item.lore = typeof artefactLore === "function" ? artefactLore(key) : "";
        return item;
      }

      // Boss drop hook (called from dropMonsterLoot). Returns a message when it
      // drops a legendary, or null to fall through to the normal gold drop.
      function coronateDrop(monster) {
        if (context.artefactsDisabled) return null;
        if (!monster || !monster.boss) return null;
        if (itemAt(monster.x, monster.y)) return null;
        const template = resources.inventory.find((i) => i.kind === "weapon") || { kind: "weapon", tile: "" };
        state.lootSerial = (state.lootSerial || 0) + 1;
        const item = {
          ...template,
          id: `loot-artefact-${state.floorIndex}-${state.lootSerial}`,
          kind: "weapon",
          power: 6 + (monster.hd || 1),
          value: 200,
          bonus: "power",
          x: monster.x,
          y: monster.y
        };
        nameArtefact(item, monster.id || `${monster.name}:${monster.x},${monster.y}`);
        currentFloorState().floorItems.push(item);
        return `${item.artefactName} lies where ${monster.name} fell!`;
      }

      context.legendaryName = legendaryName;
      context.nameArtefact = nameArtefact;
      context.coronateDrop = coronateDrop;
    }
  };
}());
