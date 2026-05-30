(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  window.CotBRuntime.installTotems = function installTotems(context) {
    with (context) {
      const TOTEM_KINDS  = ["shrine", "beacon", "ward", "conduit"];
      const TOTEM_RANGE  = 3;
      const TOTEM_DURATION = 25;

      context.TOTEM_KINDS = TOTEM_KINDS;

      // ── Item template ──────────────────────────────────────────────────────
      const CARVING_STONE = {
        id: "totem-carving-stone", name: "carving stone",
        kind: "carving-stone", charges: 2, value: 14,
        desc: "Carve a totem of any type onto a floor tile."
      };

      if (!resources.inventory.some((i) => i.id === CARVING_STONE.id)) {
        resources.inventory.push({ ...CARVING_STONE });
      }

      // ── State ─────────────────────────────────────────────────────────────
      function totems() {
        const fs = currentFloorState();
        if (!fs.totems) fs.totems = [];
        return fs.totems;
      }

      function _consumeStone(messages) {
        const stone = state.inventory.find((i) => i.kind === "carving-stone");
        if (!stone) { messages.push("You need a carving stone."); return false; }
        stone.charges = Math.max(0, (stone.charges || 1) - 1);
        if (stone.charges === 0) state.inventory = state.inventory.filter((i) => i !== stone);
        return true;
      }

      function _dist(ax, ay, bx, by) {
        return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
      }

      // ── Carve totem ────────────────────────────────────────────────────────
      function carveTotem(kind, messages) {
        if (context.totemsDisabled) { messages.push("Totems are not active."); return false; }
        if (!TOTEM_KINDS.includes(kind)) {
          messages.push(`Unknown totem kind: ${kind}. Choose: ${TOTEM_KINDS.join(", ")}.`);
          return false;
        }
        if (totemAt(state.x, state.y)) {
          messages.push("A totem already stands here.");
          return false;
        }
        if (!_consumeStone(messages)) return false;
        const totem = {
          id:      `totem-${state.lootSerial = (state.lootSerial || 0) + 1}`,
          kind,
          x:       state.x,
          y:       state.y,
          turnsRemaining: TOTEM_DURATION
        };
        totems().push(totem);
        if (typeof addEffect === "function") addEffect("magic", [{ x: state.x, y: state.y }]);
        messages.push(`A ${kind} totem rises from the stone.`);
        return true;
      }

      function totemAt(x, y) {
        if (context.totemsDisabled) return null;
        return totems().find((t) => t.x === x && t.y === y) || null;
      }

      // ── Ward bonus: reduce incoming damage when party is near a ward totem ─
      function totemWardBonus() {
        if (context.totemsDisabled) return 0;
        const hasWard = totems().some((t) => t.kind === "ward" && _dist(state.x, state.y, t.x, t.y) <= TOTEM_RANGE);
        return hasWard ? 2 : 0;
      }

      // ── Conduit bonus: party near conduit gets spell amplification ─────────
      function totemConduitActive() {
        if (context.totemsDisabled) return false;
        return totems().some((t) => t.kind === "conduit" && _dist(state.x, state.y, t.x, t.y) <= TOTEM_RANGE);
      }

      // ── Turn hook ─────────────────────────────────────────────────────────
      function tickTotems(messages) {
        if (context.totemsDisabled) return;
        const fs = currentFloorState();
        if (!fs.totems || !fs.totems.length) return;

        for (const totem of fs.totems) {
          totem.turnsRemaining -= 1;
          const inRange = _dist(state.x, state.y, totem.x, totem.y) <= TOTEM_RANGE;

          switch (totem.kind) {
            case "shrine":
              if (inRange) {
                for (const m of state.party) {
                  if ((m.hp || 0) > 0 && m.hp < (m.maxHp || m.hp)) {
                    m.hp = Math.min(m.maxHp, m.hp + 1);
                  }
                }
              }
              break;
            case "beacon":
              if (fs.discovered) {
                for (let dy = -TOTEM_RANGE; dy <= TOTEM_RANGE; dy++) {
                  for (let dx = -TOTEM_RANGE; dx <= TOTEM_RANGE; dx++) {
                    const tx = totem.x + dx;
                    const ty = totem.y + dy;
                    if (typeof solidAt === "function" && !solidAt(tx, ty)) {
                      fs.discovered.add(`${tx},${ty}`);
                    }
                  }
                }
              }
              break;
            // ward and conduit: passive, no per-turn message needed
          }
        }

        // Prune expired totems.
        fs.totems = fs.totems.filter((t) => t.turnsRemaining > 0);
      }

      context.carveTotem       = carveTotem;
      context.totemAt          = totemAt;
      context.totemWardBonus   = totemWardBonus;
      context.totemConduitActive = totemConduitActive;
      context.totems           = totems;

      turnHooks.push(tickTotems);
    }
  };
}());
