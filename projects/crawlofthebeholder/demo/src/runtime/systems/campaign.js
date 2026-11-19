(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // The endgame arc — the spine that turns a stack of floors into a game you can
  // win. Descend through the branches, gather runes from their depths, break the
  // seal of Zot, lift the Orb from its sanctum, then flee back to the surface
  // with the whole dungeon roused behind you.
  //
  // Two worlds flow through here. The authored campaign (the default run) is the
  // curated DCSS content on compact layouts: Zot:1 holds the Orb and the branches hold
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

      function restoreCampaignProgress(saved) {
        const generated = saved.worldFloors?.some((floor) => floor.map?.source === "procedural");
        state.zotFloorIndex = saved.zotFloorIndex ?? (generated ? saved.floors.length - 1 : findZotIndex());
        state.runesInWorld = saved.runesInWorld ?? (countRunesInWorld() + runesHeld());
        state.orbRun = saved.orbRun ?? hasPrize();
        state.orbRunTurns = saved.orbRunTurns ?? 0;
      }

      // ── Authored campaign: identify the spine, clear the decoy Orb ──────────
      context.restoreCampaignProgress = restoreCampaignProgress;

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

      const GATEWAY_ROOT = "vendor/crawl/crawl-ref/source/rltiles/dngn/gateways";
      const FLOOR_ONE_BRANCH_SPECS = [
        {
          key: "branchShoals",
          branch: "shoals",
          idPattern: /^shoals:/i,
          label: "Enter Shoals",
          detail: "Tide-washed islands, shallow surf, and merfolk shoals. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_shoals.png`
        },
        {
          key: "branchSwamp",
          branch: "swamp",
          idPattern: /^swamp:/i,
          label: "Enter Swamp",
          detail: "Sunken fen of cypresses, bogs, and hydras. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_swamp.png`
        },
        {
          key: "branchLair",
          branch: "lair",
          idPattern: /^lair:/i,
          label: "Enter Lair",
          detail: "Overgrown beast caverns and subterranean groves. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_lair.png`
        },
        {
          key: "branchSnake",
          branch: "snake",
          idPattern: /^snake:/i,
          label: "Enter Snake Pit",
          detail: "Serpentine vaults patrolled by nagas and adders. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_snake.png`
        },
        {
          key: "branchSpider",
          branch: "spider",
          idPattern: /^spider:/i,
          label: "Enter Spider Nest",
          detail: "Web-choked burrows crawling with arachnids. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_spider.png`
        },
        {
          key: "branchSlime",
          branch: "slime",
          idPattern: /^slime:/i,
          label: "Enter Slime Pits",
          detail: "Acid-slick caverns pulsing with oozes and jellies. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_slime.png`
        },
        {
          key: "branchOrc",
          branch: "orc",
          idPattern: /^orc:/i,
          label: "Enter Orcish Mines",
          detail: "Carved granite galleries held by orc warbands. Ascend its entrance stair to return to D:1.",
          tile: `${GATEWAY_ROOT}/enter_orc.png`
        }
      ];

      function findBranchFloorIndex(spec) {
        const floors = resources.floors || [];
        let idx = floors.findIndex((f, i) => i > 0 && spec.idPattern.test(f.id || ""));
        if (idx >= 0) return idx;
        idx = floors.findIndex((f, i) => i > 0 && String(f.biome || "").toLowerCase() === spec.branch);
        return idx;
      }

      function validBranchLanding(targetFloor) {
        if (!targetFloor || !targetFloor.map || !Array.isArray(targetFloor.map.rows)) return null;
        const doors = new Set(targetFloor.doors || []);
        const isGood = (p) => p && Number.isInteger(p.x) && Number.isInteger(p.y)
          && targetFloor.map.rows[p.y]?.[p.x] === "."
          && !doors.has(keyOf(p.x, p.y));
        if (isGood(targetFloor.stairs?.up)) return { x: targetFloor.stairs.up.x, y: targetFloor.stairs.up.y };
        if (isGood(targetFloor.start)) return { x: targetFloor.start.x, y: targetFloor.start.y };
        for (let y = 1; y < targetFloor.map.rows.length - 1; y += 1) {
          for (let x = 1; x < targetFloor.map.rows[y].length - 1; x += 1) {
            if (isGood({ x, y })) return { x, y };
          }
        }
        return null;
      }

      // Place direct gateways to Shoals, Swamp, Lair, Snake, Spider, Slime, and
      // Orcish Mines on Floor 1 (D:1) within easy reach of the entrance so players
      // can visit and explore the major branches immediately.
      function seedFloorOneBranchEntrances() {
        if (context.branchPortalsDisabled) return 0;
        if (state.expedition === "short") return 0;
        if (typeof isGameMode === "function" && isGameMode("sprint")) return 0;
        const floor = resources.floors?.[0];
        if (!floor || !floor.map || !Array.isArray(floor.map.rows)) return 0;
        if (!floor.stairs) floor.stairs = {};

        // Build BFS distance list of reachable dry open cells from D:1's start.
        const start = floor.start || floor.stairs.up || { x: 1, y: 1 };
        const dist = new Map();
        if (openAt(floor, start.x, start.y)) {
          dist.set(keyOf(start.x, start.y), 0);
          const q = [start];
          for (let head = 0; head < q.length; head += 1) {
            const cur = q[head];
            const d = dist.get(keyOf(cur.x, cur.y));
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
              const nx = cur.x + dx;
              const ny = cur.y + dy;
              const k = keyOf(nx, ny);
              const g = floor.map.rows[ny]?.[nx];
              if ((g === "." || g === "+") && !dist.has(k)) {
                dist.set(k, d + 1);
                q.push({ x: nx, y: ny });
              }
            }
          }
        }

        const blocked = new Set();
        const mark = (p) => { if (p && Number.isInteger(p.x) && Number.isInteger(p.y)) blocked.add(keyOf(p.x, p.y)); };
        mark(floor.start);
        mark(floor.stairs.up);
        mark(floor.stairs.down);
        for (const d of floor.doors || []) blocked.add(d);
        for (const it of floor.floorItems || []) mark(it);
        for (const tr of floor.traps || []) mark(tr);
        for (const dc of floor.decor || []) mark(dc);
        for (const m of floor.encounters || []) mark(m);

        // Also respect live floor state items/traps/monsters if already hydrated.
        const fs0 = state.floors?.[0];
        if (fs0) {
          for (const it of fs0.floorItems || []) mark(it);
          for (const tr of fs0.traps || []) mark(tr);
          for (const m of fs0.monsters || []) mark(m);
        }

        const candidates = [...dist.entries()]
          .filter(([k, d]) => d >= 2 && !blocked.has(k))
          .map(([k, d]) => {
            const [x, y] = k.split(",").map(Number);
            return { x, y, d };
          })
          .filter((c) => floor.map.rows[c.y]?.[c.x] === ".")
          .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);

        const placedCoords = [];
        let placed = 0;

        for (const spec of FLOOR_ONE_BRANCH_SPECS) {
          if (floor.stairs[spec.key]) {
            placedCoords.push(floor.stairs[spec.key]);
            placed += 1;
            continue;
          }
          const targetFloor = findBranchFloorIndex(spec);
          if (targetFloor < 0) continue;
          const landing = validBranchLanding(resources.floors[targetFloor]);
          if (!landing) continue;

          // Prefer well-spaced spots (distance >= 3 from previous portals) near start,
          // falling back to >= 2 or any open reachable candidate if floor is tight.
          let spot = candidates.find((c) =>
            !blocked.has(keyOf(c.x, c.y))
            && placedCoords.every((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 3)
          );
          if (!spot) {
            spot = candidates.find((c) =>
              !blocked.has(keyOf(c.x, c.y))
              && placedCoords.every((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 2)
            );
          }
          if (!spot) spot = candidates.find((c) => !blocked.has(keyOf(c.x, c.y)));
          if (!spot) break;

          blocked.add(keyOf(spot.x, spot.y));
          placedCoords.push(spot);
          floor.stairs[spec.key] = {
            x: spot.x,
            y: spot.y,
            direction: "down",
            targetFloor,
            landing,
            label: spec.label,
            detail: spec.detail,
            tile: spec.tile,
            branchKey: spec.branch,
            branchReturn: true
          };
          placed += 1;
        }
        return placed;
      }

      // Called at run start (curated) and from regenerateWorld (generated).
      function normalizeCampaign(opts = {}) {
        if (context.campaignDisabled) return;
        if (!resources.floors || resources.floors.length === 0) return;
        if (opts.generated) normalizeGeneratedCampaign();
        else normalizeCuratedCampaign();
        seedFloorOneBranchEntrances();
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
        FLOOR_ONE_BRANCH_SPECS,
        seedFloorOneBranchEntrances,
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
