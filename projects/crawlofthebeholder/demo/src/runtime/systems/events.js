(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Random floor events: every N turns the dungeon throws a curveball —
  // ambushes, gold showers, wandering merchants, monster migrations,
  // divine blessings, and curses. Gated by context.eventsDisabled.
  window.CotBRuntime.installEvents = function (context) {
    with (context) {
      const EVENT_KINDS = ["ambush", "windfall", "migration", "blessing", "curse", "rift"];
      // Minimum turns between events.
      const EVENT_COOLDOWN = 18;

      function eventQueue() {
        const floorState = currentFloorState();
        if (!floorState.eventQueue) floorState.eventQueue = [];
        return floorState.eventQueue;
      }

      function eventCooldown() {
        const floorState = currentFloorState();
        return floorState.eventCooldown || 0;
      }

      // Schedule an event N turns from now.
      function scheduleEvent(spec) {
        eventQueue().push({ ...spec });
      }

      // Trigger an event immediately, returning a message array.
      function triggerEvent(spec, messages) {
        const kind = spec.kind || "windfall";
        const floorState = currentFloorState();

        if (kind === "windfall") {
          const gold = 20 + Math.floor(Math.random() * 30);
          state.gold += gold;
          messages.push(`Gold rains from above! +${gold} gold.`);
          return;
        }

        if (kind === "ambush") {
          // Spawn 1–3 monsters near the party by cloning a random floor monster.
          const templates = (resources.monsters || []).filter((m) => !m.boss && (m.hd || 1) <= (state.floorIndex + 2));
          if (templates.length === 0) { messages.push("Shadows stir, but nothing emerges."); return; }
          const count = 1 + Math.floor(Math.random() * 3);
          let spawned = 0;
          for (let attempt = 0; attempt < 20 && spawned < count; attempt += 1) {
            const dx = (Math.floor(Math.random() * 5) - 2);
            const dy = (Math.floor(Math.random() * 5) - 2);
            const x = state.x + dx;
            const y = state.y + dy;
            if (!mapContains(x, y) || solidAt(x, y) || monsterAt(x, y) || (x === state.x && y === state.y)) continue;
            const tpl = templates[Math.floor(Math.random() * templates.length)];
            const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
            const m = { ...tpl, id: `ambush-${serial}`, x, y, hp: tpl.maxHp || tpl.hp || 10, energy: 0, alerted: true };
            floorState.monsters.push(m);
            spawned += 1;
          }
          messages.push(spawned > 0 ? `Ambush! ${spawned} creature${spawned === 1 ? "" : "s"} close in!` : "Shadows stir, but scatter.");
          return;
        }

        if (kind === "migration") {
          // Add a harmless wanderer herd to the floor.
          const herds = (resources.monsters || []).filter((m) => !m.boss && m.traits?.herd);
          const templates = herds.length > 0 ? herds : (resources.monsters || []).filter((m) => !m.boss && (m.hd || 1) === 1);
          if (templates.length === 0) { messages.push("A rumble passes through the walls."); return; }
          const tpl = templates[Math.floor(Math.random() * templates.length)];
          let added = 0;
          for (let attempt = 0; attempt < 30 && added < 4; attempt += 1) {
            const x = 1 + Math.floor(Math.random() * (currentFloor().width - 2));
            const y = 1 + Math.floor(Math.random() * (currentFloor().height - 2));
            if (solidAt(x, y) || monsterAt(x, y)) continue;
            const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
            floorState.monsters.push({ ...tpl, id: `herd-${serial}`, x, y, hp: tpl.maxHp || tpl.hp || 6, energy: 0 });
            added += 1;
          }
          messages.push(added > 0 ? `A herd of ${tpl.name}s stampedes through!` : "Distant hooves fade away.");
          return;
        }

        if (kind === "blessing") {
          const member = liveMember();
          if (!member) { messages.push("A blessing falls on empty air."); return; }
          member.mightTurns = Math.max(member.mightTurns || 0, 12);
          messages.push(`A divine blessing empowers ${member.name}!`);
          return;
        }

        if (kind === "curse") {
          const member = liveMember();
          if (!member) return;
          member.slowedTurns = Math.max(member.slowedTurns || 0, 6);
          messages.push(`A curse settles on ${member.name}!`);
          return;
        }

        if (kind === "rift") {
          // A spatial rift teleports the party to a random location.
          if (typeof teleportParty === "function") {
            teleportParty();
            messages.push("A rift tears open — the party is flung elsewhere!");
          } else {
            messages.push("Space warps briefly, then stabilizes.");
          }
          return;
        }

        messages.push("Something shifts in the dungeon.");
      }

      function tickEvents(messages) {
        if (context.eventsDisabled) return false;
        const floorState = currentFloorState();
        floorState.eventCooldown = Math.max(0, (floorState.eventCooldown || EVENT_COOLDOWN) - 1);

        // Trigger any scheduled events that are due.
        const queue = eventQueue();
        const due = queue.filter((e) => (e.turnsLeft = (e.turnsLeft || 1) - 1) <= 0);
        for (const ev of due) triggerEvent(ev, messages);
        floorState.eventQueue = queue.filter((e) => !due.includes(e));

        // Spontaneous event when cooldown expires.
        if (floorState.eventCooldown === 0) {
          const kind = EVENT_KINDS[Math.floor(Math.random() * EVENT_KINDS.length)];
          triggerEvent({ kind }, messages);
          floorState.eventCooldown = EVENT_COOLDOWN + Math.floor(Math.random() * 10);
        }
        return false;
      }

      turnHooks.push(tickEvents);

      context.scheduleEvent = scheduleEvent;
      context.triggerEvent  = triggerEvent;
      context.EVENT_KINDS   = EVENT_KINDS;
    }
  };
}());
