(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installRunes = function installRunes(context) {
    with (context) {
      const RUNE_KINDS     = ["ward", "snare", "sigil", "glyph"];
      const RUNE_DURATION  = 20;
      const GLYPH_DAMAGE   = 12;
      const SNARE_TURNS    = 3;
      const SIGIL_XP_BONUS = 15;

      context.RUNE_KINDS = RUNE_KINDS;

      // ── Item template ──────────────────────────────────────────────────────
      const STONE_TEMPLATE = {
        id: "rune-inscribing-stone", name: "inscribing stone",
        kind: "inscribing-stone", charges: 3, value: 12,
        desc: "Inscribe one of four magical rune types onto a floor tile."
      };

      if (!resources.inventory.some((i) => i.id === STONE_TEMPLATE.id)) {
        resources.inventory.push({ ...STONE_TEMPLATE });
      }

      // ── Per-floor accessor ────────────────────────────────────────────────
      function runes() {
        const fs = currentFloorState();
        if (!fs.runes) fs.runes = [];
        return fs.runes;
      }

      // ── Consume one charge from the inscribing stone ───────────────────────
      function _consumeStone(messages) {
        const stone = state.inventory.find((i) => i.kind === "inscribing-stone");
        if (!stone) {
          messages.push("You need an inscribing stone.");
          return false;
        }
        stone.charges = Math.max(0, (stone.charges || 1) - 1);
        if (stone.charges === 0) state.inventory = state.inventory.filter((i) => i !== stone);
        return true;
      }

      // ── Inscribe ──────────────────────────────────────────────────────────
      function inscribeRune(kind, messages) {
        if (context.runesDisabled) { messages.push("Runes are not active."); return false; }
        if (!RUNE_KINDS.includes(kind)) {
          messages.push(`Unknown rune kind: ${kind}. Choose from: ${RUNE_KINDS.join(", ")}.`);
          return false;
        }
        if (runeAt(state.x, state.y)) {
          messages.push("A rune already marks this tile.");
          return false;
        }
        if (!_consumeStone(messages)) return false;
        const rune = {
          id: `rune-${state.lootSerial = (state.lootSerial || 0) + 1}`,
          kind,
          x: state.x,
          y: state.y,
          turnsRemaining: RUNE_DURATION
        };
        runes().push(rune);
        if (typeof addEffect === "function") addEffect("magic", [{ x: state.x, y: state.y }]);
        messages.push(`A ${kind} rune is inscribed underfoot.`);
        return true;
      }

      function runeAt(x, y) {
        if (context.runesDisabled) return null;
        return runes().find((r) => r.x === x && r.y === y) || null;
      }

      function eraseRune(x, y) {
        if (context.runesDisabled) return false;
        const fs = currentFloorState();
        const before = (fs.runes || []).length;
        fs.runes = (fs.runes || []).filter((r) => !(r.x === x && r.y === y));
        return (fs.runes.length < before);
      }

      // ── XP bonus for sigil rune ───────────────────────────────────────────
      function runeXpBonus(monster) {
        if (context.runesDisabled) return 0;
        const rune = runeAt(monster.x, monster.y);
        if (!rune || rune.kind !== "sigil") return 0;
        eraseRune(monster.x, monster.y);
        return SIGIL_XP_BONUS;
      }

      // ── Internal trigger ──────────────────────────────────────────────────
      function _triggerRune(rune, monster, messages) {
        switch (rune.kind) {
          case "ward":
            // Alert the party and reveal the monster's position.
            if (currentFloorState().discovered) {
              currentFloorState().discovered.add(`${monster.x},${monster.y}`);
            }
            monster.alerted = true;
            messages.push(`Ward rune triggered — ${monster.name} detected!`);
            eraseRune(rune.x, rune.y);
            break;
          case "snare":
            monster.rootedTurns = Math.max(monster.rootedTurns || 0, SNARE_TURNS);
            messages.push(`Snare rune roots the ${monster.name} for ${SNARE_TURNS} turns!`);
            eraseRune(rune.x, rune.y);
            break;
          case "glyph":
            monster.hp = Math.max(0, (monster.hp || 0) - GLYPH_DAMAGE);
            if (typeof addDamageMark === "function") addDamageMark(monster, "magic", GLYPH_DAMAGE);
            messages.push(`Glyph rune blasts the ${monster.name} for ${GLYPH_DAMAGE} arcane damage!`);
            eraseRune(rune.x, rune.y);
            break;
          // sigil: XP bonus is applied at kill time via runeXpBonus — no trigger here
        }
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickRunes(messages) {
        if (context.runesDisabled) return;
        const fs = currentFloorState();
        if (!fs.runes || !fs.runes.length) return;

        const monsters = (fs.monsters || []).filter((m) => (m.hp || 0) > 0);
        const toExpire = [];

        for (const rune of fs.runes) {
          rune.turnsRemaining -= 1;
          if (rune.turnsRemaining <= 0) { toExpire.push(rune); continue; }
          for (const m of monsters) {
            if (m.x === rune.x && m.y === rune.y && rune.kind !== "sigil") {
              _triggerRune(rune, m, messages);
              // _triggerRune erases the rune, so break to avoid double-processing.
              break;
            }
          }
        }

        // Prune expired runes.
        if (toExpire.length) {
          fs.runes = fs.runes.filter((r) => !toExpire.includes(r));
        }
      }

      context.inscribeRune = inscribeRune;
      context.runeAt       = runeAt;
      context.eraseRune    = eraseRune;
      context.runeXpBonus  = runeXpBonus;
      context.runes        = runes;

      turnHooks.push(tickRunes);
    }
  };
}());
