(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Arcane system: spell scrolls (one-use area spells), glyph wards (floor
  // deployables that trigger on monster contact), and arcane attunement
  // (passive magic resistance that accumulates as scrolls are used).
  // Player-action driven — no turn hook needed.
  window.CotBRuntime.installArcane = function (context) {
    with (context) {
      const SCROLLS = [
        { id: "scroll-fireball",  name: "scroll of fireball",   kind: "scroll", spell: "fireball",  power: 18, radius: 2, value: 16,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/scroll0.png" },
        { id: "scroll-freeze",    name: "scroll of freeze",      kind: "scroll", spell: "freeze",    power: 10, radius: 2, value: 14,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/scroll1.png" },
        { id: "scroll-lightning", name: "scroll of lightning",   kind: "scroll", spell: "lightning", power: 22, radius: 1, value: 18,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/scroll2.png" },
        { id: "scroll-haste",     name: "scroll of haste",       kind: "scroll", spell: "haste",     speedTurns: 8, value: 15,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/scroll3.png" },
        { id: "scroll-timestop",  name: "scroll of time-stop",   kind: "scroll", spell: "time-stop", frozenTurns: 3, value: 22,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/scroll4.png" },
        { id: "scroll-reveal",    name: "scroll of revelation",  kind: "scroll", spell: "reveal",    value: 10,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/scroll/scroll5.png" }
      ];
      const GLYPH = { id: "glyph-ward", name: "glyph of warding", kind: "glyph", power: 20, value: 18,
        tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune.png" };

      // Register items (idempotent).
      (function registerArcaneItems() {
        for (const tpl of [...SCROLLS, GLYPH]) {
          if (!resources.inventory.some((i) => i.id === tpl.id)) {
            resources.inventory.push({ ...tpl });
          }
        }
      }());

      // Attunement: each scroll cast increments a counter; every 4 scrolls
      // adds +1 magic resist (stacks up to 5).
      function arcaneAttunement() {
        return Math.min(5, Math.floor((state.scrollsCast || 0) / 4));
      }

      function recordScrollCast() {
        state.scrollsCast = (state.scrollsCast || 0) + 1;
      }

      // Cast a spell scroll effect.
      function castScroll(item, messages) {
        const spell = item.spell;
        const floorState = currentFloorState();
        const step = dirs[state.dir];
        const tx = state.x + step.x;
        const ty = state.y + step.y;

        if (spell === "fireball") {
          const radius = item.radius || 2;
          const power  = item.power  || 18;
          if (!floorState.clouds) floorState.clouds = [];
          // Place fire cloud at target.
          floorState.clouds = floorState.clouds.filter((c) => !(c.x === tx && c.y === ty));
          floorState.clouds.push({ x: tx, y: ty, kind: "flame", turns: 4 });
          let hits = 0;
          for (const m of floorState.monsters.filter((m) => m.hp > 0)) {
            if (Math.abs(m.x - tx) <= radius && Math.abs(m.y - ty) <= radius) {
              const dmg = Math.max(1, Math.round(power - (m.ac || 0) / 4));
              m.hp = Math.max(0, m.hp - dmg);
              messages.push(`${m.name} burned for ${dmg}.`);
              hits += 1;
            }
          }
          messages.push(hits > 0 ? "Fireball erupts!" : "Fireball roars into stone.");
          return true;
        }

        if (spell === "freeze") {
          const radius = item.radius || 2;
          const power  = item.power  || 10;
          let hits = 0;
          for (const m of floorState.monsters.filter((m) => m.hp > 0)) {
            if (Math.abs(m.x - tx) <= radius && Math.abs(m.y - ty) <= radius) {
              const dmg = Math.max(1, Math.round(power - (m.ac || 0) / 4));
              m.hp = Math.max(0, m.hp - dmg);
              m.slowedTurns = Math.max(m.slowedTurns || 0, 4);
              messages.push(`${m.name} frozen for ${dmg}.`);
              hits += 1;
            }
          }
          messages.push(hits > 0 ? "Freeze blast lands!" : "Freeze blast chills the air.");
          return true;
        }

        if (spell === "lightning") {
          // Chain lightning: damages first target in a line, then arcs to adjacent.
          const power = item.power || 22;
          let primary = null;
          for (let depth = 1; depth <= 6; depth += 1) {
            const lx = state.x + step.x * depth;
            const ly = state.y + step.y * depth;
            if (solidAt(lx, ly)) break;
            const m = floorState.monsters.find((m) => m.hp > 0 && m.x === lx && m.y === ly);
            if (m) { primary = m; break; }
          }
          if (!primary) { messages.push("Lightning arcs into the void."); return true; }
          const dmg = Math.max(1, power - (primary.ac || 0) / 4);
          primary.hp = Math.max(0, primary.hp - Math.round(dmg));
          messages.push(`${primary.name} struck for ${Math.round(dmg)}.`);
          // Arc to a random adjacent monster.
          const adjacent = floorState.monsters.filter((m) =>
            m !== primary && m.hp > 0 && Math.abs(m.x - primary.x) <= 1 && Math.abs(m.y - primary.y) <= 1
          );
          if (adjacent.length > 0) {
            const arc = adjacent[Math.floor(Math.random() * adjacent.length)];
            const arcDmg = Math.round(dmg * 0.6);
            arc.hp = Math.max(0, arc.hp - arcDmg);
            messages.push(`Lightning arcs to ${arc.name} for ${arcDmg}.`);
          }
          return true;
        }

        if (spell === "haste") {
          // Grant speed turns to all live members.
          const turns = item.speedTurns || 8;
          for (const m of liveMembers()) m.speedTurns = Math.max(m.speedTurns || 0, turns);
          messages.push(`The party hurtles forward for ${turns} turns.`);
          return true;
        }

        if (spell === "time-stop") {
          // Freeze all monsters for frozenTurns turns.
          const turns = item.frozenTurns || 3;
          for (const m of floorState.monsters) if (m.hp > 0) m.frozenTurns = Math.max(m.frozenTurns || 0, turns);
          messages.push(`Time shudders to a halt for ${turns} turns.`);
          return true;
        }

        if (spell === "reveal") {
          // Reveal the full map.
          if (typeof revealAll === "function") revealAll();
          messages.push("The dungeon lays bare before you.");
          return true;
        }

        messages.push(`The scroll crumbles without effect.`);
        return true;
      }

      // Place a glyph of warding deployable on the tile ahead.
      function deployGlyph(item, messages) {
        const step = dirs[state.dir];
        const tx = state.x + step.x;
        const ty = state.y + step.y;
        if (!mapContains(tx, ty) || solidAt(tx, ty) || monsterAt(tx, ty)) {
          messages.push("Cannot place the glyph here.");
          return false;
        }
        const floorState = currentFloorState();
        if (!floorState.glyphs) floorState.glyphs = [];
        if (floorState.glyphs.some((g) => g.x === tx && g.y === ty)) {
          messages.push("A glyph already marks this spot.");
          return false;
        }
        const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
        floorState.glyphs.push({ id: `glyph-${serial}`, x: tx, y: ty, power: item.power || 20 });
        messages.push("Glyph of warding inscribed.");
        return true;
      }

      // Check glyphs each turn: if a monster stands on one, trigger it.
      function tickGlyphs(messages) {
        const floorState = currentFloorState();
        if (!floorState.glyphs || floorState.glyphs.length === 0) return false;
        const spent = [];
        for (const glyph of floorState.glyphs) {
          const m = floorState.monsters.find((m) => m.hp > 0 && m.x === glyph.x && m.y === glyph.y);
          if (!m) continue;
          const dmg = Math.max(1, glyph.power - (m.ac || 0) / 4);
          m.hp = Math.max(0, m.hp - Math.round(dmg));
          messages.push(`Glyph detonates! ${m.name} struck for ${Math.round(dmg)}.`);
          spent.push(glyph);
        }
        floorState.glyphs = floorState.glyphs.filter((g) => !spent.includes(g));
        return false;
      }

      turnHooks.push(tickGlyphs);

      context.castScroll      = castScroll;
      context.deployGlyph     = deployGlyph;
      context.arcaneAttunement = arcaneAttunement;
      context.recordScrollCast = recordScrollCast;
      context.ARCANE_SCROLLS  = SCROLLS;
    }
  };
}());
