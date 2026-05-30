(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Runtime procedural dungeon generation.
  //
  // The game previously shipped 15 fixed floors baked from single DCSS arrival
  // vaults — identical every run. This builds fresh, larger rooms-and-corridors
  // levels in the browser per run, then stamps a real DCSS vault into a room as
  // a set-piece. It deliberately reuses DCSS *content*: tile assets and
  // monster/item/decor templates are pooled from the baked resources, so
  // generated floors render with real DCSS art and real monster stats.
  //
  // Generation is fully seeded — a run seed reproduces the exact dungeon, which
  // powers daily-seed mode and shareable runs. Depth maps onto a DCSS-flavoured
  // biome (Lair, Swamp, Shoals, Snake, Crypt, Vaults) that picks the tile theme,
  // sprinkles water/lava, and biases which monsters spawn.
  //
  // Glyphs match the engine: "x" wall, "." floor, "+" door, "w"/"W" water,
  // "l" lava. Stairs are coordinates (stairs.up/down), not glyphs.
  window.CotBRuntime.installMapgen = function installMapgen(context) {
    with (context) {
      const DEFAULTS = { width: 40, height: 28, rooms: 9, minRoom: 4, maxRoom: 10 };

      // ── Seeded RNG ──────────────────────────────────────────────────────────
      function hashStr(text) {
        let h = 2166136261;
        const s = String(text);
        for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
        return h >>> 0 || 1;
      }
      // Returns a deterministic [0,1) generator for a seed, or Math.random when
      // no seed is given (e.g. the harness's own deterministic Math in tests).
      function makeRng(seed) {
        if (seed === undefined || seed === null) return Math.random;
        let s = (typeof seed === "number" ? (seed >>> 0) : hashStr(seed)) || 1;
        return function () {
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          return s / 4294967296;
        };
      }

      // ── DCSS-flavoured biomes by depth ─────────────────────────────────────
      // tag biases monster selection; assetHint matches a baked branch floor for
      // the tile theme; water/lava are per-floor-tile sprinkle chances.
      const BIOMES = [
        { key: "dungeon", name: "Dungeon",   tag: null,         assetHint: null,     water: 0,    lava: 0 },
        { key: "lair",    name: "Lair",      tag: "beast",      assetHint: "lair",   water: 0.05, lava: 0, cave: true },
        { key: "orc",     name: "Orcish Mines", tag: "orc",     assetHint: "orc",    water: 0,    lava: 0, cave: true },
        { key: "swamp",   name: "Swamp",     tag: "amphibious", assetHint: "swamp",  water: 0.12, lava: 0, cave: true },
        { key: "snake",   name: "Snake Pit", tag: "reptile",    assetHint: "snake",  water: 0,    lava: 0 },
        { key: "shoals",  name: "Shoals",    tag: "water",      assetHint: "shoals", water: 0.18, lava: 0 },
        { key: "spider",  name: "Spider Nest", tag: "spider",   assetHint: "spider", water: 0,    lava: 0, cave: true },
        { key: "slime",   name: "Slime Pits", tag: "slime",     assetHint: "slime",  water: 0,    lava: 0, cave: true },
        { key: "crypt",   name: "Crypt",     tag: "undead",     assetHint: "crypt",  water: 0,    lava: 0 },
        { key: "vaults",  name: "Vaults",    tag: null,         assetHint: "vault",  water: 0,    lava: 0.04 },
        { key: "depths",  name: "The Depths", tag: null,        assetHint: null,     water: 0.03, lava: 0.05 }
      ];
      context.MAPGEN_BIOMES = BIOMES;
      function biomeForDepth(index) { return BIOMES[Math.min(index, BIOMES.length - 1)]; }

      // Assets for a biome: borrow from a baked floor whose id/name matches the
      // hint (so the theme reads right), else the first floor's assets.
      function assetsForBiome(biome) {
        if (biome && biome.assetHint) {
          const match = resources.floors.find((f) =>
            `${f.id} ${f.name}`.toLowerCase().includes(biome.assetHint));
          if (match) return match.assets;
        }
        return resources.floors[0].assets;
      }

      // Monster templates matching a biome tag (by habitat/traits/name), with a
      // graceful fallback to the whole pool when nothing matches.
      function _matchesTag(mon, tag) {
        if (!tag) return true;
        const hay = `${mon.name || ""} ${mon.habitat || ""} ${Object.keys(mon.traits || {}).join(" ")}`.toLowerCase();
        if (tag === "water") return /water|eel|fish|shoal|kraken|octopus|amphib/.test(hay) || mon.habitat === "water";
        if (tag === "amphibious") return /water|frog|swamp|hydra|amphib|newt|slug/.test(hay);
        if (tag === "beast") return /beast|bear|wolf|cat|spider|rat|bat|hog|yak|elephant|hound/.test(hay);
        if (tag === "reptile") return /snake|naga|lizard|reptile|salamander|drake|serpent/.test(hay);
        if (tag === "undead") return /undead|skeleton|zombie|wraith|ghost|lich|mummy|vampire|necro/.test(hay) || (mon.traits && mon.traits.undead);
        if (tag === "orc") return /orc|ogre|goblin|warg|cyclops/.test(hay);
        if (tag === "spider") return /spider|scorpion|web|wasp|insect|bug|demonic crawler/.test(hay);
        if (tag === "slime") return /slime|jelly|ooze|blob|pulsating|eye|elemental/.test(hay);
        return true;
      }
      function _filterByTag(monsters, tag) {
        if (!tag) return monsters;
        const matched = monsters.filter((m) => _matchesTag(m, tag));
        return matched.length >= 3 ? matched : monsters;
      }

      // ── Layout: non-overlapping rooms joined by corridors (+ a loop or two) ──
      function generateLayout(opts = {}) {
        const cfg = { ...DEFAULTS, ...opts };
        const rng = opts.rng || makeRng(opts.seed);
        const rint = (n) => Math.floor(rng() * n);
        const rrange = (lo, hi) => lo + rint(hi - lo + 1);
        const W = cfg.width;
        const H = cfg.height;
        const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "x"));

        const carveRoom = (r) => {
          for (let y = r.y; y < r.y + r.h; y += 1) {
            for (let x = r.x; x < r.x + r.w; x += 1) grid[y][x] = ".";
          }
        };
        const carveH = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) grid[y][x] = "."; };
        const carveV = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) grid[y][x] = "."; };
        const connect = (a, b) => {
          if (rng() < 0.5) { carveH(a.cx, b.cx, a.cy); carveV(a.cy, b.cy, b.cx); }
          else { carveV(a.cy, b.cy, a.cx); carveH(a.cx, b.cx, b.cy); }
        };

        const rooms = [];
        const overlaps = (r) => rooms.some((o) =>
          r.x < o.x + o.w + 1 && r.x + r.w + 1 > o.x && r.y < o.y + o.h + 1 && r.y + r.h + 1 > o.y);

        let attempts = 0;
        while (rooms.length < cfg.rooms && attempts < cfg.rooms * 12) {
          attempts += 1;
          const w = rrange(cfg.minRoom, cfg.maxRoom);
          const h = rrange(cfg.minRoom, cfg.maxRoom);
          const x = rrange(1, W - w - 2);
          const y = rrange(1, H - h - 2);
          const room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
          if (overlaps(room)) continue;
          carveRoom(room);
          rooms.push(room);
        }

        // Spanning chain guarantees connectivity…
        for (let i = 1; i < rooms.length; i += 1) connect(rooms[i - 1], rooms[i]);
        // …plus a couple of extra links so levels aren't pure trees (loops).
        const loops = Math.min(2, Math.max(0, rooms.length - 2));
        for (let i = 0; i < loops; i += 1) {
          const a = rooms[rint(rooms.length)];
          const b = rooms[rint(rooms.length)];
          if (a !== b) connect(a, b);
        }

        // Re-seal the outer border.
        for (let x = 0; x < W; x += 1) { grid[0][x] = "x"; grid[H - 1][x] = "x"; }
        for (let y = 0; y < H; y += 1) { grid[y][0] = "x"; grid[y][W - 1] = "x"; }

        return { rows: grid.map((row) => row.join("")), rooms, width: W, height: H };
      }

      // Place doors where a one-tile corridor passes through a wall gap into a
      // room (a floor cell walled on two opposite sides). Doors are openable, so
      // they don't break connectivity.
      function placeDoors(layout, rng, chance = 0.35) {
        const grid = layout.rows.map((row) => [...row]);
        const doors = [];
        for (let y = 1; y < layout.height - 1; y += 1) {
          for (let x = 1; x < layout.width - 1; x += 1) {
            if (grid[y][x] !== ".") continue;
            const wallLR = grid[y][x - 1] === "x" && grid[y][x + 1] === "x" && grid[y - 1][x] === "." && grid[y + 1][x] === ".";
            const wallUD = grid[y - 1][x] === "x" && grid[y + 1][x] === "x" && grid[y][x - 1] === "." && grid[y][x + 1] === ".";
            if ((wallLR || wallUD) && rng() < chance) {
              grid[y][x] = "+";
              doors.push(`${x},${y}`);
            }
          }
        }
        layout.rows = grid.map((row) => row.join(""));
        return doors;
      }

      // Sprinkle biome liquid onto interior floor tiles (never the border). Water
      // and lava read as walkable-but-hazardous terrain, so paths stay open.
      function sprinkleTerrain(layout, biome, rng, protectedKeys) {
        if (!biome || (!biome.water && !biome.lava)) return;
        const grid = layout.rows.map((row) => [...row]);
        for (let y = 2; y < layout.height - 2; y += 1) {
          for (let x = 2; x < layout.width - 2; x += 1) {
            if (grid[y][x] !== ".") continue;
            if (protectedKeys && protectedKeys.has(`${x},${y}`)) continue;
            const roll = rng();
            if (biome.water && roll < biome.water) grid[y][x] = roll < biome.water * 0.4 ? "W" : "w";
            else if (biome.lava && roll < biome.lava) grid[y][x] = "l";
          }
        }
        layout.rows = grid.map((row) => row.join(""));
      }

      function embedVault(layout, vaultRows, avoidRoomIndex = 0, rng = Math.random) {
        if (!vaultRows || !vaultRows.length) return false;
        const vh = vaultRows.length;
        const vw = Math.max(...vaultRows.map((r) => r.length));
        const grid = layout.rows.map((row) => [...row]);
        const candidates = layout.rooms
          .map((room, idx) => ({ room, idx }))
          .filter(({ idx, room }) => idx !== avoidRoomIndex && room.w >= vw && room.h >= vh);
        if (!candidates.length) return false;
        const { room } = candidates[Math.floor(rng() * candidates.length)];
        for (let y = 0; y < vh; y += 1) {
          for (let x = 0; x < vw; x += 1) {
            const g = vaultRows[y][x];
            if (g === undefined || g === " ") continue;
            const ty = room.y + y;
            const tx = room.x + x;
            if (ty <= 0 || tx <= 0 || ty >= layout.height - 1 || tx >= layout.width - 1) continue;
            grid[ty][tx] = "xX.wWlH+".includes(g) ? (g === "X" ? "x" : g) : ".";
          }
        }
        layout.rows = grid.map((row) => row.join(""));
        return true;
      }

      // ── Cave layout: cellular automata for organic DCSS branches ────────────
      // (Lair/Swamp/Slime/Spider read as caverns rather than built corridors.)
      // Random-fill → smooth → keep the largest connected region → synthesise
      // start/end "rooms" from its extremes so the rest of the pipeline (start,
      // stairs, entity placement) is unchanged. Vault embedding is skipped for
      // caves (no rectangular host rooms), matching their organic feel.
      function generateCaveLayout(opts = {}) {
        const cfg = { ...DEFAULTS, ...opts };
        const rng = opts.rng || makeRng(opts.seed);
        const W = cfg.width, H = cfg.height;
        let grid = Array.from({ length: H }, (_, y) =>
          Array.from({ length: W }, (_, x) =>
            (x === 0 || y === 0 || x === W - 1 || y === H - 1) ? "x" : (rng() < 0.45 ? "x" : ".")));

        const wallCount = (g, cx, cy) => {
          let n = 0;
          for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= W || y >= H || g[y][x] === "x") n += 1;
          }
          return n;
        };
        for (let pass = 0; pass < 4; pass += 1) {
          const next = grid.map((row) => [...row]);
          for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
            next[y][x] = wallCount(grid, x, y) >= 5 ? "x" : ".";
          }
          grid = next;
        }

        // Keep only the largest connected floor region.
        const seen = Array.from({ length: H }, () => Array(W).fill(false));
        let best = [];
        for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
          if (grid[y][x] !== "." || seen[y][x]) continue;
          const region = [], q = [{ x, y }];
          seen[y][x] = true;
          while (q.length) {
            const c = q.shift();
            region.push(c);
            for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
              const nx = c.x + dx, ny = c.y + dy;
              if (nx <= 0 || ny <= 0 || nx >= W - 1 || ny >= H - 1) continue;
              if (grid[ny][nx] !== "." || seen[ny][nx]) continue;
              seen[ny][nx] = true;
              q.push({ x: nx, y: ny });
            }
          }
          if (region.length > best.length) best = region;
        }
        // Too sparse a cave is unplayable — fall back to rooms-and-corridors.
        if (best.length < (W * H) / 12) return generateLayout(opts);

        const keep = new Set(best.map((c) => `${c.x},${c.y}`));
        for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
          if (grid[y][x] === "." && !keep.has(`${x},${y}`)) grid[y][x] = "x";
        }

        // Start = first region cell; end = farthest cell from it (BFS), so the
        // descent is a real trek. Synthesise 1x1 rooms at both ends.
        const start = best[0];
        const dist = new Map([[`${start.x},${start.y}`, 0]]);
        const q2 = [start];
        let far = start;
        while (q2.length) {
          const c = q2.shift();
          const d = dist.get(`${c.x},${c.y}`);
          if (d > dist.get(`${far.x},${far.y}`)) far = c;
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const nx = c.x + dx, ny = c.y + dy;
            const k = `${nx},${ny}`;
            if (grid[ny] && grid[ny][nx] === "." && !dist.has(k)) { dist.set(k, d + 1); q2.push({ x: nx, y: ny }); }
          }
        }
        const mk = (c) => ({ x: c.x, y: c.y, w: 1, h: 1, cx: c.x, cy: c.y });
        return {
          rows: grid.map((row) => row.join("")),
          rooms: [mk(start), mk(far)],
          width: W, height: H, cave: true
        };
      }

      // ── Entity template pools, drawn from the baked DCSS floors ─────────────
      function _pools() {
        const monsters = [], items = [], decor = [], traps = [];
        for (const floor of resources.floors) {
          for (const m of floor.encounters || []) monsters.push(m);
          for (const it of floor.floorItems || []) items.push(it);
          for (const d of floor.decor || []) decor.push(d);
          for (const t of floor.traps || []) traps.push(t);
        }
        return { monsters, items, decor, traps };
      }
      function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }

      function _openCells(layout, taken) {
        const cells = [];
        for (let y = 1; y < layout.height - 1; y += 1) {
          for (let x = 1; x < layout.width - 1; x += 1) {
            if (layout.rows[y][x] !== ".") continue;
            if (taken.has(`${x},${y}`)) continue;
            cells.push({ x, y });
          }
        }
        return cells;
      }

      // ── Assemble a full floor object matching the engine's contract ─────────
      function generateFloor(opts = {}) {
        const index = opts.index || 0;
        const rng = opts.rng || makeRng(opts.seed);
        const rint = (n) => Math.floor(rng() * n);
        const rrange = (lo, hi) => lo + rint(hi - lo + 1);
        const pick = (a) => a[rint(a.length)];

        const biome = opts.biome || biomeForDepth(index);
        const layout = (biome && biome.cave)
          ? generateCaveLayout({ ...opts, rng })
          : generateLayout({ ...opts, rng });
        const pools = opts.pools || _pools();
        const assets = opts.assets || assetsForBiome(biome);

        const startRoom = layout.rooms[0];
        const endRoom = layout.rooms[layout.rooms.length - 1] || startRoom;
        const start = { x: startRoom.cx, y: startRoom.cy, dir: 1 };
        const downCell = { x: endRoom.cx, y: endRoom.cy };
        const upCell = index > 0 ? { x: startRoom.x, y: startRoom.y } : null;

        if (opts.vaults && opts.vaults.length) embedVault(layout, pick(opts.vaults), 0, rng);

        // Keep stairs/start clear of liquids, then sprinkle biome terrain.
        const protectedKeys = new Set([`${start.x},${start.y}`, `${downCell.x},${downCell.y}`]);
        if (upCell) protectedKeys.add(`${upCell.x},${upCell.y}`);
        sprinkleTerrain(layout, biome, rng, protectedKeys);

        const doors = placeDoors(layout, rng);

        const taken = new Set(protectedKeys);
        const open = _openCells(layout, taken);
        const draw = () => {
          if (!open.length) return null;
          const cell = open.splice(rint(open.length), 1)[0];
          taken.add(`${cell.x},${cell.y}`);
          return cell;
        };

        const monsterPool = _filterByTag(pools.monsters, biome.tag);
        const encounters = [];
        const monsterCount = Math.min(opts.monsters ?? rrange(5, 9), Math.floor(open.length / 8));
        for (let i = 0; i < monsterCount && monsterPool.length; i += 1) {
          const cell = draw();
          if (!cell) break;
          const mon = _clone(pick(monsterPool));
          mon.id = `gen-mon-${index}-${i}`;
          mon.x = cell.x; mon.y = cell.y; mon.hp = mon.maxHp; mon.energy = 0;
          encounters.push(mon);
        }

        const floorItems = [];
        const itemCount = Math.min(opts.items ?? rrange(2, 5), pools.items.length);
        for (let i = 0; i < itemCount; i += 1) {
          const cell = draw();
          if (!cell) break;
          const it = _clone(pick(pools.items));
          it.id = `gen-item-${index}-${i}`;
          it.x = cell.x; it.y = cell.y;
          floorItems.push(it);
        }

        const traps = [];
        const trapCount = Math.min(opts.traps ?? rrange(0, 2), pools.traps.length);
        for (let i = 0; i < trapCount; i += 1) {
          const cell = draw();
          if (!cell) break;
          const tr = _clone(pick(pools.traps));
          tr.id = `gen-trap-${index}-${i}`;
          tr.x = cell.x; tr.y = cell.y; tr.armed = true;
          traps.push(tr);
        }

        return {
          id: `gen-floor-${index}`,
          name: `${biome.name} ${index + 1}`,
          biome: biome.key,
          assets: { ...assets },
          map: { name: "generated", width: layout.width, height: layout.height, rows: layout.rows, source: "procedural" },
          start,
          doors,
          stairs: { up: upCell, down: downCell },
          floorItems,
          traps,
          decor: [],
          encounters
        };
      }

      function generateDungeon(count, opts = {}) {
        const pools = opts.pools || _pools();
        const vaults = opts.vaults || _vaultPool();
        const baseSeed = opts.seed ?? null;
        const floors = [];
        for (let i = 0; i < count; i += 1) {
          // Per-floor seed derived from the run seed → reproducible yet varied.
          const seed = baseSeed === null ? undefined : `${baseSeed}:${i}`;
          floors.push(generateFloor({ ...opts, index: i, pools, vaults, seed }));
        }
        return floors;
      }

      // Vault embed pool: the curated DCSS vault corpus if present, else the
      // baked floor geometries.
      function _vaultPool() {
        // The curated DCSS vault corpus (vaults.generated.js sets window.CotBVaults
        // — a true global in the browser, a sandbox property under test).
        const corpus = (typeof window !== "undefined" && window.CotBVaults) || null;
        if (Array.isArray(corpus) && corpus.length) return corpus.map((v) => v.rows);
        return resources.floors.map((f) => f.map.rows);
      }

      function regenerateWorld(count, opts = {}) {
        // Daily-seed runs reproduce; otherwise mint a shareable run seed.
        let seed = opts.seed;
        if (seed === undefined) {
          if (state.dailySeed) seed = `daily:${state.dailySeed}`;
          else { state.runSeed = state.runSeed || Math.floor(Math.random() * 1e9); seed = `run:${state.runSeed}`; }
        }
        const floors = generateDungeon(count || resources.floors.length, { ...opts, seed });
        resources.floors = floors;
        state.floors = floors.map((floor) => ({
          openedDoors: new Set(),
          discovered: new Set(),
          floorItems: floor.floorItems.map((i) => ({ ...i })),
          traps: floor.traps.map((t) => ({ ...t, armed: t.armed ?? true })),
          clouds: [],
          floorMarks: [],
          usedDecor: new Set(),
          allies: [],
          monsters: floor.encounters.map((m) => ({ ...m, hp: m.maxHp, energy: 0 }))
        }));
        state.floorIndex = 0;
        state.x = floors[0].start.x;
        state.y = floors[0].start.y;
        state.dir = floors[0].start.dir;
        return floors.length;
      }

      context.makeRng = makeRng;
      context.biomeForDepth = biomeForDepth;
      context.generateLayout = generateLayout;
      context.generateCaveLayout = generateCaveLayout;
      context.embedVault = embedVault;
      context.generateFloor = generateFloor;
      context.generateDungeon = generateDungeon;
      context.regenerateWorld = regenerateWorld;
    }
  };
}());
