"use strict";

// Dimensions are in tiles. Trails add passages to rooms. Higher pod thresholds leave more rock.
const ARENA_MAPS = {
  dungeon: { family: "basic", width: 25, height: 25, influences: { trails: 4 } },
  crypt: { family: "cross", width: 29, height: 25 },
  zot: { family: "pods", width: 31, height: 27, influences: { podThreshold: 0.30 } }
};

class ArenaLevel {
  constructor(branch, seed, tileSize) {
    const layout = CrawlMap.generate({ ...ARENA_MAPS[branch], branch, seed: seed + "/" + branch });
    this.rows = layout.rows;
    this.tileSize = tileSize;
    this.width = layout.width * tileSize;
    this.height = layout.height * tileSize;
    this.walkRows = this.rows.map(row => row.replaceAll("w", "."));
    const first = layout.rooms[0];
    this.entry = this.center(first.cx, first.cy);
    this.cells = [];
    let farthest = -1;
    for (const [key, distance] of CrawlMap.layoutDistances(this.rows, { x: first.cx, y: first.cy })) {
      const [col, row] = key.split(",").map(Number);
      const cell = this.center(col, row);
      this.cells.push(cell);
      if (distance > farthest) {
        this.exit = cell;
        farthest = distance;
      }
    }
    this.enemies = [];
    this.decals = [];
  }

  center(col, row) {
    return { x: (col + 0.5) * this.tileSize, y: (row + 0.5) * this.tileSize };
  }

  terrain(x, y) {
    return this.rows[Math.floor(y / this.tileSize)]?.[Math.floor(x / this.tileSize)] || "x";
  }

  canStand(x, y, radius) {
    const passable = (px, py) => ".w".includes(this.terrain(px, py));
    return passable(x - radius, y - radius) && passable(x + radius, y - radius)
      && passable(x - radius, y + radius) && passable(x + radius, y + radius);
  }

  move(actor, dx, dy) {
    const x = actor.x + actor.width / 2, y = actor.y + actor.height / 2;
    const radius = actor.width / 4;
    if (this.canStand(x + dx, y, radius)) actor.x += dx;
    if (this.canStand(actor.x + actor.width / 2, y + dy, radius)) actor.y += dy;
  }

  // Trace the bolt's centre or all four corners of the monster's footprint.
  clearPath(from, to, radius) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const size = this.tileSize;
    const trace = (ox, oy) => {
      const x = from.x + ox, y = from.y + oy;
      let col = Math.floor(x / size), row = Math.floor(y / size);
      const endCol = Math.floor((to.x + ox) / size), endRow = Math.floor((to.y + oy) / size);
      while (true) {
        const terrain = this.rows[row]?.[col] || "x";
        if (terrain === "x" || (radius && terrain === "W")) return false;
        if (col === endCol && row === endRow) return true;
        const nextX = col === endCol ? Infinity : ((col + (dx > 0 ? 1 : 0)) * size - x) / dx;
        const nextY = row === endRow ? Infinity : ((row + (dy > 0 ? 1 : 0)) * size - y) / dy;
        // Crossing a vertex advances both coordinates.
        if (nextX <= nextY) col += Math.sign(dx);
        if (nextY <= nextX) row += Math.sign(dy);
      }
    };
    return radius ? trace(-radius, -radius) && trace(radius, -radius) && trace(-radius, radius) && trace(radius, radius)
      : trace(0, 0);
  }

  chaseTarget(from, player, radius) {
    if (this.clearPath(from, player, radius)) return player;
    const size = this.tileSize;
    const goal = { x: Math.floor(player.x / size), y: Math.floor(player.y / size) };
    const goalKey = goal.x + "," + goal.y;
    if (this.goal !== goalKey) {
      this.distances = CrawlMap.layoutDistances(this.walkRows, goal);
      this.goal = goalKey;
    }
    const col = Math.floor(from.x / size), row = Math.floor(from.y / size);
    const distance = this.distances.get(col + "," + row);
    for (const [x, y] of [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]]) {
      if (this.distances.get(x + "," + y) === distance - 1) {
        const next = this.center(x, y);
        return this.clearPath(from, next, radius) ? next : this.center(col, row);
      }
    }
    return player;
  }

  stairAt(point, index, last) {
    const on = stair => Math.floor(point.x / this.tileSize) === Math.floor(stair.x / this.tileSize)
      && Math.floor(point.y / this.tileSize) === Math.floor(stair.y / this.tileSize);
    if (index > 0 && on(this.entry)) return -1;
    return index < last && on(this.exit) ? 1 : 0;
  }
}
