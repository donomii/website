const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scripts = ["vendor/crawlmap/crawlmap.js", "levels.js"];
const source = scripts.map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
const { ArenaLevel, ARENA_MAPS } = vm.runInNewContext(source.join("\n") + "\n;({ ArenaLevel, ARENA_MAPS })");

function follow(level, from, to) {
  const actor = { x: from.x - 32, y: from.y - 32, width: 64, height: 64 };
  for (let tick = 0; tick < 2600; tick++) {
    const here = { x: actor.x + 32, y: actor.y + 32 };
    if (Math.hypot(to.x - here.x, to.y - here.y) < 1) return;
    const target = level.chaseTarget(here, to, 16);
    const dx = target.x - here.x, dy = target.y - here.y;
    const length = Math.hypot(dx, dy);
    assert.ok(length > 0, "pursuit should keep moving at a corridor turn");
    const step = Math.min(4, length) / length;
    level.move(actor, dx * step, dy * step);
    assert.ok(level.canStand(actor.x + 32, actor.y + 32, 16));
  }
  assert.fail("monster could not reach the player from " + JSON.stringify(from));
}

for (const [index, branch] of Object.keys(ARENA_MAPS).entries()) {
  test(branch + " generates repeatable connected stairs and navigable corridors", () => {
    const maps = new Set();
    for (let seed = 0; seed < 20; seed++) {
      const level = new ArenaLevel(branch, seed, 64);
      const rows = level.rows.join("\n");
      assert.equal(new ArenaLevel(branch, seed, 64).rows.join("\n"), rows);
      maps.add(rows);
      assert.equal(level.terrain(level.entry.x, level.entry.y), ".");
      assert.equal(level.terrain(level.exit.x, level.exit.y), ".");
      assert.equal(level.stairAt(level.entry, index, 2), index === 0 ? 0 : -1);
      assert.equal(level.stairAt(level.exit, index, 2), index === 2 ? 0 : 1);
      follow(level, level.exit, level.entry);
      follow(level, level.entry, level.exit);
    }
    assert.ok(maps.size > 1);
  });
}

test("walls stop actors and bolts, including shots that graze a corner", () => {
  const level = new ArenaLevel("dungeon", 1, 64);
  level.rows = ["xxxxx", "x..xx", "x.x.x", "x...x", "xxxxx"];
  const actor = { x: 64, y: 128, width: 64, height: 64 };
  for (let tick = 0; tick < 20; tick++) level.move(actor, 4, 0);
  assert.equal(actor.x, 76);
  assert.equal(level.clearPath(level.center(1, 2), level.center(3, 2), 0), false);
  assert.equal(level.clearPath(level.center(1, 1), level.center(1, 3), 0), true);
  assert.equal(level.clearPath({ x: 127, y: 130 }, { x: 134, y: 116.5 }, 0), false);
});

test("custom sizes and wet layouts use dry stairs and traversable shallows", () => {
  const original = ARENA_MAPS.dungeon;
  try {
    for (const family of ["swamp", "shoals"]) {
      ARENA_MAPS.dungeon = { family, width: 20, height: 17, influences: { waterLevel: 2 } };
      const level = new ArenaLevel("dungeon", 42, 64);
      assert.equal(level.width, 1280);
      assert.equal(level.height, 1088);
      assert.equal(level.terrain(level.entry.x, level.entry.y), ".");
      assert.equal(level.terrain(level.exit.x, level.exit.y), ".");
      follow(level, level.entry, level.exit);
      for (const [row, terrain] of level.rows.entries()) {
        for (const [col, tile] of [...terrain].entries()) {
          const p = level.center(col, row);
          assert.equal(level.canStand(p.x, p.y, 16), tile === "." || tile === "w");
          assert.equal(level.clearPath(p, p, 0), tile !== "x");
        }
      }
    }
  } finally {
    ARENA_MAPS.dungeon = original;
  }
});
