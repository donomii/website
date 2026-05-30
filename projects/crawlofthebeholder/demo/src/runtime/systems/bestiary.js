(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installBestiary = function (context) {
    with (context) {
      function ensureBestiary() {
        if (!state.bestiary) state.bestiary = {};
        if (!state.bestiarySeenIds) state.bestiarySeenIds = new Set();
        return state.bestiary;
      }

      function recordSeen(monster) {
        if (!monster || !monster.name) return false;
        ensureBestiary();
        if (state.bestiarySeenIds.has(monster.id)) return false;
        state.bestiarySeenIds.add(monster.id);
        const entry = state.bestiary[monster.name] || (state.bestiary[monster.name] = {
          name: monster.name,
          seen: 0,
          killed: 0,
          firstFloor: state.floorIndex
        });
        entry.seen += 1;
        return true;
      }

      function recordKilled(monster) {
        if (!monster || !monster.name) return false;
        ensureBestiary();
        const entry = state.bestiary[monster.name] || (state.bestiary[monster.name] = {
          name: monster.name,
          seen: 0,
          killed: 0,
          firstFloor: state.floorIndex
        });
        entry.killed += 1;
        return true;
      }

      function scanDiscoveredMonsters() {
        const floorState = currentFloorState();
        if (!floorState) return;
        for (const monster of floorState.monsters) {
          if (monster.hp <= 0) continue;
          if (!floorState.discovered.has(keyOf(monster.x, monster.y))) continue;
          recordSeen(monster);
        }
      }

      function bestiaryEntries() {
        ensureBestiary();
        return Object.values(state.bestiary).sort((a, b) => (b.killed - a.killed) || (b.seen - a.seen) || a.name.localeCompare(b.name));
      }

      // Real DCSS flavour text for a monster, looked up by name from the
      // generated corpus (monster_flavour.generated.js → window.CotBMonsterFlavour).
      function monsterDescription(name) {
        const corpus = (typeof window !== "undefined" && window.CotBMonsterFlavour) || null;
        if (!corpus || !name) return "";
        const key = String(name).toLowerCase();
        return corpus[key]
          || corpus[key.replace(/^(a|an|the)\s+/, "")]
          || corpus[key.replace(/s$/, "")]
          || "";
      }

      function renderBestiaryModal() {
        if (!els.bestiaryList) return;
        const entries = bestiaryEntries();
        if (entries.length === 0) {
          els.bestiaryList.innerHTML = `<li><strong>Empty bestiary</strong><span>Spot a monster to add it here.</span></li>`;
          return;
        }
        els.bestiaryList.innerHTML = entries.map((entry) => {
          const firstFloorId = resources.floors[entry.firstFloor || 0]?.id || "?";
          const flavour = monsterDescription(entry.name);
          const flavourLine = flavour ? `<span class="bestiary-flavour">${escapeHtml(flavour)}</span>` : "";
          return `<li><strong>${escapeHtml(entry.name)}</strong><span>seen ${entry.seen} · killed ${entry.killed} · first met on ${escapeHtml(firstFloorId)}</span>${flavourLine}</li>`;
        }).join("");
      }

      Object.assign(context, {
        ensureBestiary,
        recordSeen,
        recordKilled,
        scanDiscoveredMonsters,
        bestiaryEntries,
        monsterDescription,
        renderBestiaryModal
      });
    }
  };
}());
