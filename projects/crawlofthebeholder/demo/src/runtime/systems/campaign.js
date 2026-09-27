(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // The endgame arc — the spine that turns a stack of floors into a game you can
  // win. Descend through the branches, gather runes from their depths, break the
  // seal of Zot, lift the Orb from its sanctum, then flee back to the surface
  // with the whole dungeon roused behind you.
  //
  // Two worlds flow through here. The authored campaign (the default run) is the
  // hand-crafted DCSS dungeon: Zot:1 already holds the Orb and the branches hold
  // their runes, so normalize only has to identify the spine and clear a stray
  // decoy. A seeded/daily run regenerates generic floors instead, so normalize
  // also has to *place* the Orb and runes and seal off the bottom.
  window.CotBRuntime.installCampaign = function installCampaign(context) {
    with (context) {
      const RUNES_TO_ENTER_ZOT = 3;    // seal of Zot opens once this many runes are held
      const ORB_RUN_SPAWN_INTERVAL = 6; // floor-turns between Orb-run pursuers
      const TILE_ROOT = "vendor/crawl/crawl-ref/source/rltiles/item/misc";

      const ORB_TEMPLATE = {
        id: "orb-of-zot", name: "the Orb of Zot Soup", shortName: "orb", kind: "quest",
        power: 0, tile: `${TILE_ROOT}/uncollected_orb.png`
      };

      // Canonical rune set for generated worlds (paths match baked DCSS assets
      // already in the resource index, so they render without a rebuild).
      const RUNE_TEMPLATES = [
        { id: "rune-swamp", name: "swamp rune glimmer", shortName: "swamp", tile: `${TILE_ROOT}/uncollected_runes/rune_swamp.png` },
        { id: "rune-shoals", name: "barnacled rune glimmer", shortName: "shoals", tile: `${TILE_ROOT}/uncollected_runes/rune_shoals.png` },
        { id: "rune-snake", name: "serpentine rune glimmer", shortName: "snake", tile: `${TILE_ROOT}/uncollected_runes/rune_snake.png` },
        { id: "rune-spider", name: "gossamer rune glimmer", shortName: "spider", tile: `${TILE_ROOT}/uncollected_runes/rune_spider.png` },
        { id: "rune-slime", name: "slimy rune of Zot Soup", shortName: "slime", tile: `${TILE_ROOT}/runes/rune_slime.png` }
      ].map((rune) => ({ ...rune, kind: "quest", power: 0 }));

      function zotFloorIndex() {
        return state.zotFloorIndex != null ? state.zotFloorIndex : resources.floors.length - 1;
      }

      function requiredRunesForZot() {
        // Never demand more runes than the world actually contains.
        return Math.min(RUNES_TO_ENTER_ZOT, state.runesInWorld != null ? state.runesInWorld : RUNES_TO_ENTER_ZOT);
      }

      // The Zot floor: the authored Zot branch if present, else whichever floor
      // holds the Orb, else the deepest floor.
      function findZotIndex() {
        const floors = resources.floors;
        let idx = floors.findIndex((f) => /^zot:/i.test(f.id || ""));
        if (idx >= 0) return idx;
        idx = floors.findIndex((f) => (f.floorItems || []).some(isOrbItem));
        if (idx >= 0) return idx;
        return floors.length - 1;
      }

      // Which generated floors carry a rune: spread across the deep half, always
      // above Zot so the party collects them on the way down.
      function runeFloorIndices(floorCount) {
        const zot = floorCount - 1;
        const lo = Math.max(1, Math.floor(floorCount * 0.27));
        const hi = zot - 1;
        if (hi < lo) return [];
        const span = hi - lo;
        const count = Math.min(RUNE_TEMPLATES.length, span + 1);
        const indices = [];
        for (let i = 0; i < count; i += 1) {
          const idx = count === 1 ? lo : lo + Math.round((i * span) / (count - 1));
          if (!indices.includes(idx)) indices.push(idx);
        }
        return indices;
      }

      function openAt(floor, x, y) {
        const rows = floor.map.rows;
        return y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] === ".";
      }

      // The reachable open cell farthest from the entry, skipping stairs, the
      // start tile, and occupied cells. Deterministic, so a seed reproduces it.
      function pickDeepCell(floor) {
        const avoid = new Set();
        const mark = (p) => { if (p) avoid.add(keyOf(p.x, p.y)); };
        mark(floor.start);
        mark(floor.stairs && floor.stairs.up);
        mark(floor.stairs && floor.stairs.down);
        for (const item of floor.floorItems || []) avoid.add(keyOf(item.x, item.y));

        let seed = floor.start || (floor.stairs && floor.stairs.up) || { x: 1, y: 1 };
        if (!openAt(floor, seed.x, seed.y)) {
          seed = null;
          for (let y = 0; y < floor.map.rows.length && !seed; y += 1) {
            for (let x = 0; x < floor.map.rows[y].length; x += 1) {
              if (openAt(floor, x, y)) { seed = { x, y }; break; }
            }
          }
        }
        if (!seed) return null;

        const dist = new Map([[keyOf(seed.x, seed.y), 0]]);
        const queue = [seed];
        while (queue.length) {
          const cell = queue.shift();
          const d = dist.get(keyOf(cell.x, cell.y));
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            const key = keyOf(nx, ny);
            if (openAt(floor, nx, ny) && !dist.has(key)) { dist.set(key, d + 1); queue.push({ x: nx, y: ny }); }
          }
        }

        let best = null;
        for (const [key, d] of dist) {
          if (avoid.has(key)) continue;
          const [x, y] = key.split(",").map(Number);
          if (!best || d > best.d || (d === best.d && (y < best.y || (y === best.y && x < best.x)))) best = { x, y, d };
        }
        return best ? { x: best.x, y: best.y } : null;
      }

      function countRunesInWorld() {
        return state.floors.reduce((sum, fs) => sum + (fs.floorItems || []).filter(isRuneItem).length, 0);
      }

      // ── Authored campaign: identify the spine, clear the decoy Orb ──────────
      function normalizeCuratedCampaign() {
        const zot = findZotIndex();
        state.zotFloorIndex = zot;

        // An early decoy "Orb of Zot Soup" lingers in the baked data; strip any
        // Orb that isn't the one in the sanctum so it can't be claimed early.
        for (let i = 0; i < state.floors.length; i += 1) {
          if (i === zot) continue;
          const floorState = state.floors[i];
          if (floorState && floorState.floorItems) floorState.floorItems = floorState.floorItems.filter((it) => !isOrbItem(it));
        }

        // Defensive: guarantee the sanctum actually holds the Orb.
        const zotState = state.floors[zot];
        if (zotState && !(zotState.floorItems || []).some(isOrbItem)) {
          const cell = pickDeepCell(resources.floors[zot]);
          if (cell) zotState.floorItems.push({ ...ORB_TEMPLATE, x: cell.x, y: cell.y });
        }

        state.runesInWorld = countRunesInWorld();
        state.orbRun = false;
        state.orbRunTurns = 0;
      }

      // ── Seeded/daily campaign: place the Orb + runes onto generated floors ──
      function normalizeGeneratedCampaign() {
        const floors = resources.floors;
        const zot = floors.length - 1;

        // Strip any quest items the generic loot draw scattered.
        for (const floor of floors) floor.floorItems = (floor.floorItems || []).filter((item) => item.kind !== "quest");

        // Sow runes through the deep floors.
        let placed = 0;
        runeFloorIndices(floors.length).forEach((floorIndex, slot) => {
          const floor = floors[floorIndex];
          const cell = pickDeepCell(floor);
          if (!cell) return;
          const template = RUNE_TEMPLATES[slot % RUNE_TEMPLATES.length];
          floor.floorItems.push({ ...template, id: `${template.id}-f${floorIndex}`, x: cell.x, y: cell.y });
          placed += 1;
        });

        // The Orb rests in the deepest vault — nothing lies below it.
        const zotFloor = floors[zot];
        const orbCell = pickDeepCell(zotFloor);
        if (orbCell) zotFloor.floorItems.push({ ...ORB_TEMPLATE, x: orbCell.x, y: orbCell.y });
        if (zotFloor.stairs) zotFloor.stairs = { ...zotFloor.stairs, down: null };

        state.zotFloorIndex = zot;
        state.runesInWorld = placed;
        state.orbRun = false;
        state.orbRunTurns = 0;
      }

      // Called at run start (curated) and from regenerateWorld (generated).
      function normalizeCampaign(opts = {}) {
        if (context.campaignDisabled) return;
        if (!resources.floors || resources.floors.length === 0) return;
        if (opts.generated) normalizeGeneratedCampaign();
        else normalizeCuratedCampaign();
      }

      // The seal of Zot: descending into the sanctum needs enough runes. Only
      // active once a campaign has been normalized, so fixture/snapshot tests on
      // the baked world are unaffected.
      function runeGateBlocks(nextIndex) {
        if (context.campaignDisabled) return false;
        if (state.zotFloorIndex == null) return false;
        if (nextIndex !== state.zotFloorIndex) return false;
        return runesHeld() < requiredRunesForZot();
      }

      function runeGateMessage() {
        return `The seal of Zot bars the way — bring ${requiredRunesForZot()} runes (you hold ${runesHeld()}).`;
      }

      // ── The Orb run ────────────────────────────────────────────────────────
      function orbHunterTemplate() {
        const here = (currentFloor().encounters || []).filter((m) => !m.boss);
        if (here.length) return here[Math.floor(Math.random() * here.length)];
        for (const floor of resources.floors) {
          const pool = (floor.encounters || []).filter((m) => !m.boss);
          if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
        }
        return null;
      }

      function orbHunterCell() {
        const floor = currentFloor();
        const candidates = [];
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            if (cellAt(x, y) !== ".") continue;
            const d = Math.abs(x - state.x) + Math.abs(y - state.y);
            if (d < 4 || d > 14) continue;
            if (solidAt(x, y) || monsterAt(x, y) || itemAt(x, y) || trapAt(x, y)) continue;
            candidates.push({ x, y, d });
          }
        }
        if (!candidates.length) return null;
        candidates.sort((a, b) => b.d - a.d);
        const band = candidates.slice(0, Math.max(1, Math.floor(candidates.length / 2)));
        return band[Math.floor(Math.random() * band.length)];
      }

      function spawnOrbHunter() {
        const template = orbHunterTemplate();
        if (!template) return null;
        const cell = orbHunterCell();
        if (!cell) return null;
        state.summonSerial = (state.summonSerial || 0) + 1;
        const hunter = {
          ...template,
          id: `orbhunter-${state.floorIndex}-${state.summonSerial}`,
          x: cell.x, y: cell.y, hp: template.maxHp, energy: 0,
          alerted: true, wandering: true, orbHunter: true
        };
        currentFloorState().monsters.push(hunter);
        currentFloorState().discovered.add(keyOf(cell.x, cell.y));
        return hunter;
      }

      function beginOrbRun(messages) {
        state.orbRun = true;
        state.orbRunTurns = 0;
        // Every monster on the floor now knows exactly where the party is.
        const floorState = currentFloorState();
        for (const monster of floorState.monsters || []) {
          if (monster.hp > 0) { monster.alerted = true; floorState.discovered.add(keyOf(monster.x, monster.y)); }
        }
        if (messages) messages.push("The Orb of Zot Soup blazes — the dungeon rouses! Flee to the surface!");
        if (typeof showToast === "function") showToast("The Orb awakens the dungeon — run!");
        if (typeof pulse === "function") pulse("achievement");
      }

      function tickOrbRun(messages) {
        if (context.campaignDisabled) return;
        if (state.victory || state.defeated) return;
        if (!state.orbRun) {
          if (hasOrb()) beginOrbRun(messages);
          return;
        }
        state.orbRunTurns = (state.orbRunTurns || 0) + 1;
        const floorState = currentFloorState();
        const liveHunters = (floorState.monsters || []).filter((m) => m.hp > 0 && m.orbHunter).length;
        const cap = Math.min(4, 2 + Math.floor(state.floorIndex / 4));
        if (liveHunters >= cap) return;
        if (state.orbRunTurns % ORB_RUN_SPAWN_INTERVAL !== 0) return;
        const spawned = spawnOrbHunter();
        if (spawned && messages) messages.push(`${spawned.name} surges out of the dark, drawn to the Orb!`);
      }

      Object.assign(context, {
        RUNES_TO_ENTER_ZOT,
        RUNE_TEMPLATES,
        ORB_TEMPLATE,
        zotFloorIndex,
        requiredRunesForZot,
        findZotIndex,
        runeFloorIndices,
        pickDeepCell,
        normalizeCampaign,
        runeGateBlocks,
        runeGateMessage,
        beginOrbRun,
        spawnOrbHunter,
        tickOrbRun
      });

      turnHooks.push(tickOrbRun);
    }
  };
}());
