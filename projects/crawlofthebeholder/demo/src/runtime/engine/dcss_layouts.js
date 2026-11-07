// Compact adaptations of DCSS layout_basic, layout_cave_pods, and the
// Swamp/Shoals heightmap builders. See SPEC.md for source paths and departures.
// DCSS: Copyright 1997-2025 Linley Henzell, the dev team and contributors.
// Adapted algorithms are distributed under GPL-2.0-or-later; see vendor/crawl/LICENSE.
(function () {
  window.CotBRuntime.installDcssLayouts = function (context) {
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
      const layout = context.generateLayout({ ...cfg, rng, rooms: cfg.rooms ?? 5, minRoom: cfg.minRoom ?? 5, maxRoom: cfg.maxRoom ?? 7 });
      const grid = layout.rows.map((row) => [...row]);
      for (const room of layout.rooms) {
        const p = { x: room.cx, y: room.cy };
        for (let segment = 0; segment < 4; segment += 1) {
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
        grid[y][x] = rooms(x, y) > 0.30 || halls(x, y) < 0.12 ? "." : "x";
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
        for (let y = 3; y < cfg.height - 3; y += 3) for (let x = 3; x < cfg.width - 3; x += 3) {
          const centre = { x: x + integer(rng, -1, 1), y: y + integer(rng, -1, 1) };
          heightPatch(heights, centre, 3, 24, [8, 22], rng);
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
        const height = smooth[y][x];
        grid[y][x] = swamp ? (height > 6 ? "w" : height > -8 ? "." : height > -10 ? "w" : "x")
          : (height >= 135 ? "x" : height >= 0 ? "." : height >= -30 ? "w" : "W");
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

    function connectVaultEntry(grid, room, width, height, start) {
      const reached = layoutDistances(grid, start);
      const inside = (x, y) => x >= room.x && y >= room.y && x < room.x + width && y < room.y + height;
      const queue = [];
      const seen = new Set();
      for (let y = room.y; y < room.y + height; y += 1) for (let x = room.x; x < room.x + width; x += 1) {
        if (grid[y][x] === "+") {
          for (const [dx, dy] of steps) {
            if (!inside(x + dx, y + dy) && interior(grid, x + dx, y + dy)) {
              queue.push({ x: x + dx, y: y + dy, path: [] });
            } else {
              continue;
            }
          }
        } else {
          continue;
        }
      }
      for (const cell of queue) {
        if (reached.has(key(cell))) {
          cell.path.forEach((p) => { grid[p.y][p.x] = "."; });
          return;
        } else {
          for (const [dx, dy] of steps) {
            const p = { x: cell.x + dx, y: cell.y + dy };
            if (interior(grid, p.x, p.y) && !inside(p.x, p.y) && !seen.has(key(p))) {
              seen.add(key(p));
              queue.push({ ...p, path: [...cell.path, cell] });
            } else {
              continue;
            }
          }
        }
      }
    }

    function generateDcssLayout(opts = {}) {
      const branch = opts.branch || opts.biome?.key || "dungeon";
      const profile = PROFILES[branch] || PROFILES.dungeon;
      const cfg = { ...profile, ...opts };
      if (!Number.isInteger(cfg.width) || !Number.isInteger(cfg.height) || cfg.width < 14 || cfg.height < 12 || cfg.width > profile.width || cfg.height > profile.height) {
        throw new Error(`DCSS ${branch} layout requires integer dimensions 14..${profile.width} by 12..${profile.height}; got ${cfg.width} by ${cfg.height}.`);
      } else {
        const rng = opts.rng || context.makeRng(opts.seed);
        if (cfg.family === "basic") {
          return { ...basicLayout(cfg, rng), family: cfg.family };
        } else {
          const grid = cfg.family === "pods" ? podGrid(cfg, rng) : wetGrid(cfg, rng);
          const rows = grid.map((row) => row.join(""));
          return { rows, width: cfg.width, height: cfg.height, rooms: endpointRooms(rows), family: cfg.family, cave: true };
        }
      }
    }

    Object.assign(context, { DCSS_LAYOUT_PROFILES: PROFILES, generateDcssLayout, layoutDistances, connectVaultEntry });
  };
}());
