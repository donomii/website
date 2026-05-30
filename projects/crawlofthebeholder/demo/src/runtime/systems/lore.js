(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Lore system: inscriptions, tablets, and ancient tomes discovered while
  // exploring. Reading lore entries populates a codex and can unlock monster
  // knowledge (combat bonus vs. that type), permanent stat boosts from tomes,
  // and tracking of dungeon history (floors cleared this run).
  window.CotBRuntime.installLore = function (context) {
    with (context) {
      const LORE_ENTRIES = [
        { id: "lore-dwarves",   name: "Dwarven inscription",   kind: "lore", topic: "dwarf",    text: "Tunnels made by hands of stone.", bonus: { kind: "knowledge", type: "construct" }, value: 5 },
        { id: "lore-undead",    name: "Necromancer's tablet",  kind: "lore", topic: "undead",   text: "The dead do not rest here.",       bonus: { kind: "knowledge", type: "undead" },    value: 5 },
        { id: "lore-beasts",    name: "Hunter's journal",      kind: "lore", topic: "beast",    text: "These creatures fear fire.",        bonus: { kind: "knowledge", type: "beast" },     value: 5 },
        { id: "lore-demons",    name: "Warding glyph (rubbing)", kind: "lore", topic: "demon", text: "Named things hold power.",          bonus: { kind: "knowledge", type: "demon" },     value: 5 },
        { id: "lore-arcane",    name: "Arcane treatise",        kind: "lore", topic: "arcane",  text: "Magic bends where will is strong.", bonus: { kind: "power",     amount: 2 },         value: 8 },
        { id: "lore-defensive", name: "Soldier's manual",       kind: "lore", topic: "defense", text: "Shield the flank, hold the line.",  bonus: { kind: "defense",   amount: 1 },         value: 8 }
      ];

      const TOMES = [
        { id: "tome-might",    name: "tome of might",    kind: "tome", stat: "maxHp",  amount: 10, value: 30,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/book/book_brown.png" },
        { id: "tome-swiftness", name: "tome of swiftness", kind: "tome", stat: "power", amount: 2,  value: 30,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/book/book_green.png" },
        { id: "tome-warding",  name: "tome of warding",  kind: "tome", stat: "ac",    amount: 2,  value: 30,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/book/book_blue.png" }
      ];

      // Register lore and tomes as purchasable (idempotent).
      (function registerLoreItems() {
        for (const tpl of [...LORE_ENTRIES, ...TOMES]) {
          if (!resources.inventory.some((i) => i.id === tpl.id)) {
            resources.inventory.push({ ...tpl });
          }
        }
      }());

      // Codex: accumulates read lore topics.
      function codex() {
        if (!state.codex) state.codex = {};
        return state.codex;
      }

      function hasRead(topic) {
        return !!codex()[topic];
      }

      // Read a lore item: populates codex, applies one-time bonus.
      function readLore(itemId, messages) {
        const item = state.inventory.find((i) => i.id === itemId && i.kind === "lore");
        if (!item) { messages.push("Lore item not found."); return false; }
        const cx = codex();
        if (cx[item.topic]) { messages.push(`You have already studied this ${item.topic} lore.`); return false; }
        cx[item.topic] = { topic: item.topic, text: item.text, bonus: item.bonus };
        state.inventory = state.inventory.filter((i) => i !== item);
        messages.push(`${item.name}: "${item.text}"`);
        // Apply bonus.
        if (item.bonus?.kind === "power") {
          const lead = liveMember();
          if (lead) {
            lead.power = (lead.power || 10) + item.bonus.amount;
            messages.push(`+${item.bonus.amount} power gained.`);
          }
        } else if (item.bonus?.kind === "defense") {
          const lead = liveMember();
          if (lead) {
            lead.ac = (lead.ac || 0) + item.bonus.amount;
            messages.push(`+${item.bonus.amount} armor gained.`);
          }
        } else if (item.bonus?.kind === "knowledge") {
          messages.push(`Knowledge of ${item.bonus.type}s unlocked.`);
        }
        return true;
      }

      // Monster knowledge combat bonus: +2 damage vs. monster types you've read about.
      function loreKnowledgeBonus(target) {
        const cx = codex();
        for (const entry of Object.values(cx)) {
          if (entry.bonus?.kind === "knowledge") {
            const type = entry.bonus.type;
            if (target.traits?.[type] || target.kind === type) return 2;
          }
        }
        return 0;
      }

      // Read an ancient tome: permanently boosts a stat of all live members.
      function readTome(itemId, messages) {
        const item = state.inventory.find((i) => i.id === itemId && i.kind === "tome");
        if (!item) { messages.push("Tome not found."); return false; }
        const stat = item.stat;
        const amount = item.amount || 1;
        for (const m of liveMembers()) {
          m[stat] = (m[stat] || 0) + amount;
          if (stat === "maxHp") m.hp = Math.min(m.maxHp, m.hp + amount);
        }
        state.inventory = state.inventory.filter((i) => i !== item);
        messages.push(`${item.name} absorbed — +${amount} ${stat} to all.`);
        return true;
      }

      // Dungeon history: track floors cleared this run.
      function recordFloorCleared(floorIndex) {
        if (!state.floorsHistory) state.floorsHistory = [];
        if (!state.floorsHistory.includes(floorIndex)) state.floorsHistory.push(floorIndex);
      }

      function floorsClearedCount() {
        return (state.floorsHistory || []).length;
      }

      // Real DCSS flavour lookups (lore.generated.js → window.CotBLore), keyed by
      // lowercase name with article/plural fallbacks. Empty string when unknown.
      function _loreLookup(category, name) {
        const lore = (typeof window !== "undefined" && window.CotBLore) || null;
        const table = lore && lore[category];
        if (!table || !name) return "";
        const key = String(name).toLowerCase();
        return table[key]
          || table[key.replace(/^(a|an|the)\s+/, "")]
          || table[key.replace(/s$/, "")]
          || "";
      }
      function itemLore(name) { return _loreLookup("items", name); }
      function spellLore(name) { return _loreLookup("spells", name); }
      function speciesLore(name) { return _loreLookup("species", name); }
      function backgroundLore(name) { return _loreLookup("backgrounds", name); }
      function mutationLore(name) { return _loreLookup("mutations", name); }
      function branchLore(name) { return _loreLookup("branches", name); }
      function artefactLore(name) { return _loreLookup("artefacts", name); }
      function egoLore(name) { return _loreLookup("egos", name); }
      // The pool of real DCSS unrandart names, for naming legendary finds.
      function artefactNames() {
        const lore = (typeof window !== "undefined" && window.CotBLore) || null;
        return lore && lore.artefacts ? Object.keys(lore.artefacts) : [];
      }

      context.codex             = codex;
      context.itemLore          = itemLore;
      context.spellLore         = spellLore;
      context.speciesLore       = speciesLore;
      context.backgroundLore    = backgroundLore;
      context.mutationLore      = mutationLore;
      context.branchLore        = branchLore;
      context.artefactLore      = artefactLore;
      context.artefactNames     = artefactNames;
      context.egoLore           = egoLore;
      context.hasRead           = hasRead;
      context.readLore          = readLore;
      context.readTome          = readTome;
      context.loreKnowledgeBonus = loreKnowledgeBonus;
      context.recordFloorCleared = recordFloorCleared;
      context.floorsClearedCount = floorsClearedCount;
      context.LORE_ENTRIES      = LORE_ENTRIES;
      context.LORE_TOMES        = TOMES;
    }
  };
}());
