(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installLeyLines = function installLeyLines(context) {
    with (context) {
      const LEY_NODE_MIN    = 2;
      const LEY_NODE_MAX    = 4;
      const LEY_COMBAT_BONUS = 2;
      const LEY_DISRUPT_DMG  = 20;
      const LEY_DISRUPT_RADIUS = 3;

      // ── Seed ley-line nodes for the current floor ──────────────────────────
      function ensureLeyLines() {
        if (context.leyLinesDisabled) return;
        const fs = currentFloorState ? currentFloorState() : null;
        if (!fs) return;
        if (fs.leyLines && fs.leyLines.length > 0) return; // idempotent
        fs.leyLines = [];
        const floor = currentFloor ? currentFloor() : null;
        if (!floor) return;
        const rows = floor.map && floor.map.rows ? floor.map.rows : [];
        const passable = [];
        for (let y = 0; y < rows.length; y++) {
          const row = rows[y];
          for (let x = 0; x < (row ? row.length : 0); x++) {
            if (!solidAt(x, y)) passable.push({ x, y });
          }
        }
        if (!passable.length) return;
        const count = LEY_NODE_MIN + Math.floor(Math.random() * (LEY_NODE_MAX - LEY_NODE_MIN + 1));
        for (let i = 0; i < count && passable.length; i++) {
          const idx = Math.floor(Math.random() * passable.length);
          fs.leyLines.push({ ...passable[idx], active: true });
          passable.splice(idx, 1);
        }
      }

      function leyLineAt(x, y) {
        if (context.leyLinesDisabled) return null;
        const fs = currentFloorState ? currentFloorState() : null;
        if (!fs || !fs.leyLines) return null;
        return fs.leyLines.find((n) => n.x === x && n.y === y && n.active) || null;
      }

      function onLeyLine() {
        return !!leyLineAt(state.x, state.y);
      }

      function leyLineCombatBonus() {
        if (context.leyLinesDisabled) return 0;
        return onLeyLine() ? LEY_COMBAT_BONUS : 0;
      }

      function disruptLeyLine(messages) {
        if (context.leyLinesDisabled) {
          messages.push("No ley lines active.");
          return false;
        }
        const node = leyLineAt(state.x, state.y);
        if (!node) {
          messages.push("No ley line here to disrupt.");
          return false;
        }
        node.active = false;
        // AOE damage to all monsters within radius.
        const fs = currentFloorState ? currentFloorState() : null;
        const monsters = fs ? (fs.monsters || []).filter((m) => (m.hp || 0) > 0) : [];
        let count = 0;
        for (const m of monsters) {
          const dx = m.x - state.x;
          const dy = m.y - state.y;
          if (Math.sqrt(dx * dx + dy * dy) <= LEY_DISRUPT_RADIUS) {
            m.hp = Math.max(0, (m.hp || 0) - LEY_DISRUPT_DMG);
            count += 1;
          }
        }
        messages.push(`Ley line disrupted! ${count} monster${count !== 1 ? "s" : ""} take ${LEY_DISRUPT_DMG} arcane damage.`);
        return true;
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      let _lastX = null;
      let _lastY = null;

      function tickLeyLines(messages) {
        if (context.leyLinesDisabled) return;
        // Notify player on newly entering a node.
        if (_lastX !== state.x || _lastY !== state.y) {
          _lastX = state.x;
          _lastY = state.y;
          if (onLeyLine()) {
            messages.push("You stand on a ley-line node. Your power surges.");
          }
        }
      }

      context.ensureLeyLines     = ensureLeyLines;
      context.leyLineAt          = leyLineAt;
      context.onLeyLine          = onLeyLine;
      context.leyLineCombatBonus = leyLineCombatBonus;
      context.disruptLeyLine     = disruptLeyLine;

      turnHooks.push(tickLeyLines);
    }
  };
}());
