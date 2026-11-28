// Compact adaptations of DCSS layout_basic, layout_cave_pods, and the
// Swamp/Shoals heightmap builders. See SPEC.md for source paths and departures.
// DCSS: Copyright 1997-2025 Linley Henzell, the dev team and contributors.
// SPDX-License-Identifier: GPL-2.0-or-later
const CrawlMap = (function () {
    const DEFAULTS = { width: 24, height: 18, rooms: 5, minRoom: 3, maxRoom: 7 };

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

    const PROFILES = {
      dungeon: { width: 24, height: 18, family: "basic" },
      lair: { width: 40, height: 35, family: "pods" },
      swamp: { width: 40, height: 35, family: "swamp" },
      shoals: { width: 40, height: 35, family: "shoals" },
      orc: { width: 24, height: 18, family: "pods" },
      snake: { width: 24, height: 18, family: "pods" },
      spider: { width: 24, height: 18, family: "pods" },
      slime: { width: 24, height: 18, family: "pods" },
      crypt: { width: 24, height: 18, family: "basic" },
      vaults: { width: 24, height: 18, family: "basic" },
      depths: { width: 24, height: 18, family: "basic" },
      zot: { width: 24, height: 18, family: "basic" }
    };
    const steps = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const key = (p) => `${p.x},${p.y}`;
    const integer = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    const gridOf = (w, h, fill) => Array.from({ length: h }, () => Array(w).fill(fill));
    const interior = (g, x, y) => y > 0 && y < g.length - 1 && x > 0 && x < g[0].length - 1;

    function layoutDistances(rows, start, dry = true) {
      const allowed = dry ? ".+" : ".+wWl";
      const found = new Map();
      if (!start || !allowed.includes(rows[start.y]?.[start.x] || "x")) {
        return found;
      } else {
        found.set(key(start), 0);
      }
      const queue = [start];
      for (const p of queue) {
        for (const [dx, dy] of steps) {
          const next = { x: p.x + dx, y: p.y + dy };
          if (allowed.includes(rows[next.y]?.[next.x] || "x") && !found.has(key(next))) {
            found.set(key(next), found.get(key(p)) + 1);
            queue.push(next);
          } else {
            continue;
          }
        }
      }
      return found;
    }

    function dryRegions(grid) {
      const regions = [];
      const seen = new Set();
      for (let y = 1; y < grid.length - 1; y += 1) {
        for (let x = 1; x < grid[0].length - 1; x += 1) {
          if (grid[y][x] === "." && !seen.has(`${x},${y}`)) {
            const region = [...layoutDistances(grid, { x, y }).keys()];
            region.forEach((cell) => seen.add(cell));
            regions.push(region.map((cell) => { const [cx, cy] = cell.split(",").map(Number); return { x: cx, y: cy }; }));
          } else {
            continue;
          }
        }
      }
      return regions.sort((a, b) => b.length - a.length);
    }

    function connectDryLand(grid) {
      const regions = dryRegions(grid);
      const connected = regions.shift() || [];
      for (const region of regions) {
        let best = null;
        for (const a of connected) for (const b of region) {
          const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
          if (!best || distance < best.distance) {
            best = { a, b, distance };
          } else {
            continue;
          }
        }
        const p = { ...best.a };
        while (p.x !== best.b.x || p.y !== best.b.y) {
          if (p.x !== best.b.x) {
            p.x += Math.sign(best.b.x - p.x);
          } else {
            p.y += Math.sign(best.b.y - p.y);
          }
          grid[p.y][p.x] = ".";
          connected.push({ ...p });
        }
        connected.push(...region);
      }
      return connected;
    }

    // layout_basic: short orthogonal trails supplement rooms and their links.
    function basicLayout(cfg, rng) {
      const sizes = [cfg.rooms ?? 5, cfg.minRoom ?? 5, cfg.maxRoom ?? 7];
      if (sizes.some((value) => !Number.isInteger(value)) || sizes[0] < 1 || sizes[0] > 20 || sizes[1] < 3 || sizes[2] < sizes[1] || sizes[2] > Math.min(cfg.width, cfg.height) - 2) {
        throw new Error(`DCSS rooms require 1..20 rooms with valid fitting integer sizes; got ${sizes.join(", ")}.`);
      } else {
        return trailRooms(cfg, rng);
      }
    }

    function trailRooms(cfg, rng) {
      const layout = generateLayout({ ...cfg, rng, rooms: cfg.rooms ?? 5, minRoom: cfg.minRoom ?? 5, maxRoom: cfg.maxRoom ?? 7 });
      const grid = layout.rows.map((row) => [...row]);
      for (const room of layout.rooms) {
        const p = { x: room.cx, y: room.cy };
        for (let segment = 0; segment < cfg.influences.trails; segment += 1) {
          const [dx, dy] = steps[integer(rng, 0, 3)];
          const length = integer(rng, 2, 5);
          for (let step = 0; step < length; step += 1) {
            if (interior(grid, p.x + dx, p.y + dy)) {
              p.x += dx; p.y += dy;
              grid[p.y][p.x] = ".";
            } else {
              break;
            }
          }
        }
      }
      return { ...layout, rows: grid.map((row) => row.join("")) };
    }

    // Worley F2-F1: cave pods combine a room field and a thinner passage field.
    function worleyField(w, h, spacing, rng) {
      const sites = [];
      for (let y = -spacing; y < h + spacing; y += spacing) {
        for (let x = -spacing; x < w + spacing; x += spacing) {
          sites.push({ x: x + rng() * spacing, y: y + rng() * spacing });
        }
      }
      return (x, y) => {
        let first = Infinity, second = Infinity;
        for (const site of sites) {
          const distance = Math.hypot(x - site.x, y - site.y);
          if (distance < first) {
            second = first; first = distance;
          } else {
            second = Math.min(second, distance);
          }
        }
        return (second - first) / spacing;
      };
    }

    function podGrid(cfg, rng) {
      const grid = gridOf(cfg.width, cfg.height, "x");
      const rooms = worleyField(cfg.width, cfg.height, 6, rng);
      const halls = worleyField(cfg.width, cfg.height, 8, rng);
      for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
        grid[y][x] = rooms(x, y) > cfg.influences.podThreshold || halls(x, y) < 0.12 ? "." : "x";
      }
      connectDryLand(grid);
      return grid;
    }

    // dgn_island_centred_at: deposit random height deltas near patch centres.
    function heightPatch(heights, centre, radius, points, delta, rng) {
      for (let i = 0; i < points; i += 1) {
        const r = integer(rng, 0, radius);
        const x = centre.x + integer(rng, -r, r);
        const y = centre.y + integer(rng, -r, r);
        if (interior(heights, x, y)) {
          heights[y][x] += integer(rng, delta[0], delta[1]);
        } else {
          continue;
        }
      }
    }

    function smoothHeights(heights) {
      // Symmetric weighted neighbourhood; no directional bias from scan order.
      return heights.map((row, y) => row.map((height, x) => {
        let sum = height * 4, weight = 4;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          if ((dx || dy) && heights[y + dy]?.[x + dx] !== undefined) {
            const amount = 4 - dx * dx - dy * dy;
            sum += heights[y + dy][x + dx] * amount; weight += amount;
          } else {
            continue;
          }
        }
        return sum / weight;
      }));
    }

    function wetGrid(cfg, rng) {
      const swamp = cfg.family === "swamp";
      const heights = gridOf(cfg.width, cfg.height, swamp ? -19 : -33);
      if (swamp) {
        // DCSS varies patch centres, radii and point counts. A full-strength
        // patch at every regular grid point erased the interior mangrove groves.
        for (let y = 3; y < cfg.height - 3; y += 4) for (let x = 3; x < cfg.width - 3; x += 4) {
          const centre = { x: x + integer(rng, -3, 3), y: y + integer(rng, -3, 3) };
          heightPatch(heights, centre, integer(rng, 2, 4), integer(rng, 5, 25), [8, 22], rng);
        }
      } else {
        const count = Math.max(2, Math.ceil(cfg.width * cfg.height / 240));
        const columns = Math.ceil(Math.sqrt(count * cfg.width / cfg.height));
        const rows = Math.ceil(count / columns);
        for (let island = 0; island < count; island += 1) {
          const x = Math.round(2 + (island % columns + 0.5) * (cfg.width - 4) / columns) + integer(rng, -1, 1);
          const y = Math.round(2 + (Math.floor(island / columns) + 0.5) * (cfg.height - 4) / rows) + integer(rng, -1, 1);
          heightPatch(heights, { x, y }, 4, 55, [80, 110], rng);
        }
      }
      const smooth = smoothHeights(smoothHeights(heights));
      const grid = gridOf(cfg.width, cfg.height, "x");
      for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
        const height = smooth[y][x] - cfg.influences.waterLevel;
        grid[y][x] = swamp ? (height > 6 ? "w" : height > -8 ? "." : height > -10 ? "w" : "x")
          : (height >= 88 ? "x" : height >= 0 ? "." : height >= -30 ? "w" : "W");
      }
      // First-person adaptation: dry causeways connect islands, not mandatory swimming.
      connectDryLand(grid);
      return grid;
    }

    function endpointRooms(rows) {
      const firstY = rows.findIndex((row) => row.includes("."));
      if (firstY < 0) {
        throw new Error("DCSS layout has no dry land for party entry.");
      } else {
        const first = { x: rows[firstY].indexOf("."), y: firstY };
        const distances = layoutDistances(rows, first);
        const far = [...distances].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
        const room = (x, y) => ({ x, y, w: 1, h: 1, cx: x, cy: y });
        return [room(first.x, first.y), room(far[0], far[1])];
      }
    }

    // layout_cross in DCSS layout.des carves two perpendicular rectangles.
    function crossGrid(cfg, rng) {
      const midX = Math.floor(cfg.width / 2), midY = Math.floor(cfg.height / 2);
      const arm = (span) => integer(rng, 1, Math.min(5, Math.max(1, Math.floor(span / 6))));
      const halfWidth = arm(cfg.width), halfHeight = arm(cfg.height);
      const rim = Math.max(1, Math.round(Math.min(cfg.width, cfg.height) / 7));
      const grid = gridOf(cfg.width, cfg.height, "x");
      for (let y = rim; y < cfg.height - rim; y++) for (let x = rim; x < cfg.width - rim; x++) {
        if (Math.abs(x - midX) <= halfWidth || Math.abs(y - midY) <= halfHeight) grid[y][x] = ".";
      }
      return grid;
    }

    const INFLUENCES = { trails: 4, podThreshold: 0.30, waterLevel: 0 };
    function generate(opts = {}) {
      const branch = opts.branch ?? "dungeon";
      if (!Object.prototype.hasOwnProperty.call(PROFILES, branch)) throw new Error("Unknown map branch: " + branch);
      const cfg = { ...PROFILES[branch], ...opts, influences: { ...INFLUENCES, ...opts.influences } };
      const { trails, podThreshold, waterLevel } = cfg.influences;
      if (Object.keys(cfg.influences).some(k => !Object.prototype.hasOwnProperty.call(INFLUENCES, k)) ||
          !Number.isInteger(trails) || trails < 0 || trails > 16 ||
          !Number.isFinite(podThreshold) || podThreshold < 0 || podThreshold > 0.6 ||
          !Number.isFinite(waterLevel) || waterLevel < -4 || waterLevel > 4) throw new Error("Invalid map influences: " + JSON.stringify(cfg.influences));
      if (!Number.isInteger(cfg.width) || !Number.isInteger(cfg.height) || cfg.width < 14 || cfg.height < 12 || cfg.width > 80 || cfg.height > 70)
        throw new Error("Map requires integer dimensions 14..80 by 12..70; got " + cfg.width + " by " + cfg.height);
      const rng = opts.rng || makeRng(opts.seed);
      switch (cfg.family) {
        case "basic": return { ...basicLayout(cfg, rng), family: cfg.family };
        case "pods": case "swamp": case "shoals": case "cross": {
          const build = cfg.family === "pods" ? podGrid : cfg.family === "cross" ? crossGrid : wetGrid;
          // Tiny wet maps sometimes need a fresh height field for separate landings.
          for (let attempt = 0; attempt < 32; attempt++) {
            const rows = build(cfg, rng).map(row => row.join(""));
            if (rows.join("").split(".").length >= 5)
              return { rows, width: cfg.width, height: cfg.height, rooms: endpointRooms(rows), family: cfg.family, cave: cfg.family !== "cross" };
          }
          throw new Error("Cannot place four dry landings on " + cfg.family + " " + cfg.width + " by " + cfg.height);
        }
        default: throw new Error("Unknown map family: " + cfg.family);
      }
    }
    return { profiles: PROFILES, generate, makeRng, generateLayout, layoutDistances };
}());

if (typeof module !== "undefined" && module.exports) module.exports = CrawlMap;
