(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyTraversal = function (context) {
    with (context) {

      function bfsNextStep(targets, options = {}) {
        if (!targets || targets.length === 0) return null;
        const floor = currentFloor();
        const floorState = currentFloorState();
        const requireDiscovered = options.requireDiscovered !== false;
        const allowMonsterTiles = options.allowMonsterTiles === true;
        const goalKeys = new Set(targets.map((cell) => keyOf(cell.x, cell.y)));
        const start = keyOf(state.x, state.y);
        if (goalKeys.has(start)) return { reached: true };

        const visited = new Map([[start, null]]);
        const queue = [{ x: state.x, y: state.y }];

        while (queue.length > 0) {
          const current = queue.shift();
          for (const dir of dirs) {
            const x = current.x + dir.x;
            const y = current.y + dir.y;
            const key = keyOf(x, y);
            if (visited.has(key)) continue;
            if (!mapContains(x, y)) continue;
            if (requireDiscovered && !floorState.discovered.has(key)) continue;
            const isGoal = goalKeys.has(key);
            if (closedDoorAt(x, y) && !isGoal) continue;
            if (solidAt(x, y) && !isGoal) continue;
            if (!allowMonsterTiles && monsterAt(x, y) && !isGoal) continue;
            visited.set(key, { x: current.x, y: current.y });
            if (isGoal) {
              let cursor = { x, y };
              while (true) {
                const previous = visited.get(keyOf(cursor.x, cursor.y));
                if (!previous) return null;
                if (previous.x === state.x && previous.y === state.y) {
                  return { dx: cursor.x - state.x, dy: cursor.y - state.y, target: { x, y } };
                }
                cursor = previous;
              }
            }
            queue.push({ x, y });
          }
        }
        return null;
      }


      function autoExploreTarget() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const targets = [];
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            const key = keyOf(x, y);
            if (!floorState.discovered.has(key)) continue;
            if (mapKind(x, y) !== "floor") continue;
            const hasUnknownNeighbour = dirs.some((dir) => {
              const nx = x + dir.x;
              const ny = y + dir.y;
              if (!mapContains(nx, ny)) return false;
              const ncell = floor.map.rows[ny]?.[nx] || " ";
              if (ncell === " " || ncell === "x" || ncell === "H") return false;
              return !floorState.discovered.has(keyOf(nx, ny));
            });
            if (hasUnknownNeighbour) targets.push({ x, y });
          }
        }
        return targets;
      }


      function snapshotDiscoveredMonsters() {
        const floorState = currentFloorState();
        return new Set(floorState.monsters
          .filter((m) => m.hp > 0 && floorState.discovered.has(keyOf(m.x, m.y)))
          .map((m) => m.id));
      }


      function autoExplore() {
        if (state.victory || state.defeated) return;
        const initialThreat = restNearbyThreat();
        if (initialThreat) {
          setMessage(`${initialThreat.name} is too close. The party cannot wander freely.`);
          return;
        }
        const blocker = restBlockingCondition();
        if (blocker) {
          setMessage(`The party cannot wander while ${blocker} lingers.`);
          return;
        }
        const targets = autoExploreTarget();
        if (targets.length === 0) {
          setMessage("Nothing more to explore on this floor.");
          return;
        }
        let steps = 0;
        const maxSteps = 200;
        let knownIds = snapshotDiscoveredMonsters();
        while (steps < maxSteps && !state.defeated && !state.victory) {
          const remaining = autoExploreTarget();
          if (remaining.length === 0) break;
          const move = bfsNextStep(remaining);
          if (!move || move.reached) break;
          const before = { x: state.x, y: state.y };
          moveBy(move.dx, move.dy);
          steps += 1;
          if (state.x === before.x && state.y === before.y) break;
          const nowKnown = snapshotDiscoveredMonsters();
          let newSpotted = false;
          for (const id of nowKnown) {
            if (!knownIds.has(id)) { newSpotted = true; break; }
          }
          if (newSpotted) {
            state.message = "A new figure enters view. Stopping.";
            break;
          }
          knownIds = nowKnown;
          if (restNearbyThreat()) break;
          if (restBlockingCondition()) break;
          if (itemAt(state.x, state.y)) break;
        }
        if (steps === 0) {
          state.message = "The way ahead is unclear.";
        } else if (state.defeated || state.victory) {
          // Don't overwrite endgame messages.
        } else if (restNearbyThreat()) {
          state.message = `${state.message} The party halts as something approaches.`;
        } else if (autoExploreTarget().length === 0) {
          state.message = `The party explores ${steps} step${steps === 1 ? "" : "s"} and finds no more secrets.`;
        } else {
          state.message = `The party explores ${steps} step${steps === 1 ? "" : "s"}.`;
        }
        render();
      }


      function travelToStairsTarget() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const stairs = [];
        if (floor.stairs.down && floorState.discovered.has(keyOf(floor.stairs.down.x, floor.stairs.down.y))) {
          stairs.push({ ...floor.stairs.down, direction: "down" });
        }
        if (floor.stairs.up && floorState.discovered.has(keyOf(floor.stairs.up.x, floor.stairs.up.y))) {
          stairs.push({ ...floor.stairs.up, direction: "up" });
        }
        return stairs;
      }


      function travelToStairs() {
        if (state.victory || state.defeated) return;
        const initialThreat = restNearbyThreat();
        if (initialThreat) {
          setMessage(`${initialThreat.name} blocks the way. Travel is unsafe.`);
          return;
        }
        const blocker = restBlockingCondition();
        if (blocker) {
          setMessage(`The party cannot travel while ${blocker} lingers.`);
          return;
        }
        const stairs = travelToStairsTarget();
        if (stairs.length === 0) {
          setMessage("No known stairs on this floor.");
          return;
        }
        // Prefer downstairs unless the party already has the prize and is on floor 0.
        const preferUp = state.floorIndex === 0 && hasPrize();
        const ordered = stairs.sort((a, b) => {
          if (preferUp) return a.direction === "up" ? -1 : 1;
          return a.direction === "down" ? -1 : 1;
        });
        let steps = 0;
        const maxSteps = 200;
        const targetDir = ordered[0].direction;
        const goals = [ordered[0]];
        while (steps < maxSteps && !state.defeated && !state.victory) {
          if (stairsAt(state.x, state.y)) break;
          const move = bfsNextStep(goals);
          if (!move || move.reached) break;
          const before = { x: state.x, y: state.y };
          moveBy(move.dx, move.dy);
          steps += 1;
          if (state.x === before.x && state.y === before.y) break;
          if (restNearbyThreat()) break;
          if (restBlockingCondition()) break;
        }
        if (steps === 0 && !stairsAt(state.x, state.y)) {
          state.message = "No clear route to the stairs.";
        } else if (stairsAt(state.x, state.y)) {
          state.message = `The party arrives at the ${targetDir === "down" ? "down" : "up"}stairs.`;
        } else if (restNearbyThreat()) {
          state.message = `${state.message} The party stops short of the stairs.`;
        } else {
          state.message = `The party travels ${steps} step${steps === 1 ? "" : "s"} toward the stairs.`;
        }
        render();
      }


      function nearestMonsterDistance(point) {
        const monsters = currentFloorState().monsters.filter((monster) => monster.hp > 0);
        if (monsters.length === 0) return 99;
        return Math.min(...monsters.map((monster) => Math.abs(point.x - monster.x) + Math.abs(point.y - monster.y)));
      }

      Object.assign(context, {
        bfsNextStep,
        autoExploreTarget,
        snapshotDiscoveredMonsters,
        autoExplore,
        travelToStairsTarget,
        travelToStairs,
        nearestMonsterDistance,
      });
    }
  };
}());
