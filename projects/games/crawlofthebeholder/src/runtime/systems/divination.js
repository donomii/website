(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installDivination = function installDivination(context) {
    with (context) {
      // ── Item templates ─────────────────────────────────────────────────────
      const DIVINATION_ITEMS = [
        { id: "div-crystal-ball",    name: "crystal ball",      kind: "divination", subkind: "crystal-ball",  value: 18 },
        { id: "div-tarot-deck",      name: "tarot deck",        kind: "divination", subkind: "tarot",         value: 14 },
        { id: "div-rune-bones",      name: "rune bones",        kind: "divination", subkind: "rune-bones",    value: 12 },
        { id: "div-prophecy-scroll", name: "prophecy scroll",   kind: "divination", subkind: "prophecy",      value: 10 }
      ];

      context.DIVINATION_ITEMS = DIVINATION_ITEMS;

      // ── Item registration ─────────────────────────────────────────────────
      for (const tpl of DIVINATION_ITEMS) {
        if (!resources.inventory.some((i) => i.id === tpl.id)) resources.inventory.push({ ...tpl });
      }

      // ── State initialisation ──────────────────────────────────────────────
      if (!("omenKind"  in state)) state.omenKind  = null;
      if (!("omenTurns" in state)) state.omenTurns = 0;

      // ── Helpers ────────────────────────────────────────────────────────────
      function _consumeBySubkind(subkind, messages, label) {
        const item = state.inventory.find((i) => i.subkind === subkind && i.kind === "divination");
        if (!item) {
          messages.push(`You need a ${label} to do this.`);
          return null;
        }
        state.inventory = state.inventory.filter((i) => i !== item);
        return item;
      }

      // ── Crystal ball ──────────────────────────────────────────────────────
      function castCrystalBall(messages) {
        if (context.divinationDisabled) { messages.push("Divination is not active."); return false; }
        if (!_consumeBySubkind("crystal-ball", messages, "crystal ball")) return false;
        const fs = currentFloorState();
        if (!fs.discovered) fs.discovered = new Set();
        const floor = currentFloor ? currentFloor() : null;
        if (floor) {
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const x = state.x + dx;
              const y = state.y + dy;
              if (!solidAt(x, y)) fs.discovered.add(`${x},${y}`);
            }
          }
        }
        if (typeof addEffect === "function") addEffect("halo", [{ x: state.x, y: state.y }]);
        messages.push("The crystal ball glows — surrounding passages are revealed.");
        return true;
      }

      // ── Tarot deck ────────────────────────────────────────────────────────
      function readTarot(messages) {
        if (context.divinationDisabled) { messages.push("Divination is not active."); return false; }
        if (!_consumeBySubkind("tarot", messages, "tarot deck")) return false;
        const kind = Math.random() < 0.5 ? "boon" : "bane";
        state.omenKind  = kind;
        state.omenTurns = 5;
        messages.push(kind === "boon"
          ? "The cards reveal a favorable omen — the next strike deals +3 damage."
          : "The cards reveal a dark portent — the next strike deals −2 damage.");
        return true;
      }

      // Called from attackTarget to modify outgoing damage.
      function applyOmen(damage) {
        if (context.divinationDisabled) return damage;
        if (!state.omenKind || (state.omenTurns || 0) <= 0) return damage;
        const kind = state.omenKind;
        state.omenKind  = null;
        state.omenTurns = 0;
        return kind === "boon" ? damage + 3 : Math.max(1, damage - 2);
      }

      // ── Rune bones (sense traps) ───────────────────────────────────────────
      function senseTraps(messages) {
        if (context.divinationDisabled) { messages.push("Divination is not active."); return false; }
        if (!_consumeBySubkind("rune-bones", messages, "rune bones")) return false;
        const fs = currentFloorState();
        const traps = fs.traps || [];
        let count = 0;
        for (const trap of traps) {
          if (!trap.sensed) { trap.sensed = true; count += 1; }
          if (fs.discovered) fs.discovered.add(`${trap.x},${trap.y}`);
        }
        messages.push(`Rune bones rattle — ${count} trap${count !== 1 ? "s" : ""} revealed on this floor.`);
        return true;
      }

      // ── Prophecy scroll ───────────────────────────────────────────────────
      function prophesize(messages) {
        if (context.divinationDisabled) { messages.push("Divination is not active."); return false; }
        if (!_consumeBySubkind("prophecy", messages, "prophecy scroll")) return false;
        const fs = currentFloorState();
        const monsters = fs.monsters || [];
        // Tally monster kinds.
        const tally = {};
        for (const m of monsters) {
          const k = m.kind || (m.name || "unknown");
          tally[k] = (tally[k] || 0) + 1;
        }
        const kinds = Object.keys(tally);
        if (!kinds.length) {
          messages.push("The scroll whispers: 'This floor holds no great threat.'");
          return true;
        }
        const dominant = kinds.sort((a, b) => tally[b] - tally[a])[0];
        const hints = {
          undead:   "The dead walk these halls.",
          beast:    "Wild creatures hunt here.",
          humanoid: "Intelligent foes lurk nearby.",
          demon:    "Dark forces corrupt this place.",
          dragon:   "Ancient power fills this level."
        };
        const hint = hints[dominant] || `Beware the ${dominant}.`;
        messages.push(`The scroll whispers: '${hint}'`);
        return true;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickDivination(_messages) {
        if (context.divinationDisabled) return;
        if ((state.omenTurns || 0) > 0) {
          state.omenTurns -= 1;
          if (state.omenTurns === 0) state.omenKind = null;
        }
      }

      context.castCrystalBall = castCrystalBall;
      context.readTarot       = readTarot;
      context.applyOmen       = applyOmen;
      context.senseTraps      = senseTraps;
      context.prophesize      = prophesize;

      turnHooks.push(tickDivination);
    }
  };
}());
