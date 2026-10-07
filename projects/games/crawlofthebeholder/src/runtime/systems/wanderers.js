(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installWanderers = function (context) {
    with (context) {
      const WANDER_CHECK_INTERVAL = 25; // floor turns between wander rolls
      const WANDER_PROBABILITY = 0.35;
      const MAX_WANDERERS_PER_FLOOR = 3;

      function eligibleSpawnCell() {
        const floor = currentFloor();
        const candidates = [];
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            if (cellAt(x, y) !== ".") continue;
            if (Math.abs(x - state.x) + Math.abs(y - state.y) < 8) continue;
            if (currentFloorState().discovered.has(keyOf(x, y))) continue;
            if (monsterAt(x, y) || itemAt(x, y) || trapAt(x, y)) continue;
            candidates.push({ x, y });
          }
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
      }

      function spawnWanderer() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const template = (floor.encounters || []).filter((m) => !m.boss)[Math.floor(Math.random() * Math.max(1, (floor.encounters || []).length))];
        if (!template) return false;
        const cell = eligibleSpawnCell();
        if (!cell) return false;
        state.summonSerial += 1;
        const wanderer = {
          ...template,
          id: `wander-${state.floorIndex}-${state.summonSerial}`,
          x: cell.x,
          y: cell.y,
          hp: template.maxHp,
          energy: 0,
          alerted: false,
          wandering: true
        };
        floorState.monsters.push(wanderer);
        floorState.wandererCount = (floorState.wandererCount || 0) + 1;
        return wanderer;
      }

      function maybeSpawnWanderer() {
        if (context.wanderersDisabled) return null;
        if (state.victory || state.defeated) return null;
        const floorState = currentFloorState();
        if ((floorState.wandererCount || 0) >= MAX_WANDERERS_PER_FLOOR) return null;
        if ((state.floorTurnCount || 0) === 0) return null;
        if ((state.floorTurnCount || 0) % WANDER_CHECK_INTERVAL !== 0) return null;
        const hazardBonus = typeof hazardWanderBonus === "function" ? hazardWanderBonus() : 0;
        if (Math.random() >= WANDER_PROBABILITY + hazardBonus) return null;
        return spawnWanderer();
      }

      Object.assign(context, {
        WANDER_CHECK_INTERVAL,
        WANDER_PROBABILITY,
        MAX_WANDERERS_PER_FLOOR,
        eligibleSpawnCell,
        spawnWanderer,
        maybeSpawnWanderer
      });
    }
  };
}());
