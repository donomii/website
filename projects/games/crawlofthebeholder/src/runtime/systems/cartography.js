(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Cartography: enriched map tracking — room labels auto-assigned on first
  // entry, player-set waypoints, danger zones where the party took heavy
  // damage, a first-visit scouting XP bonus, and a floor-completion detector.
  // No turn hook; triggered by movement/damage events via optional hooks.
  window.CotBRuntime.installCartography = function (context) {
    with (context) {
      // ── Room labels ────────────────────────────────────────────────────────

      const ROOM_NAMES = [
        "Entry Hall", "Guard Room", "Trophy Room", "Armory", "Chapel",
        "Crypt", "Library", "Kitchen", "Throne Room", "Vault",
        "Barracks", "Cistern", "Shrine", "Forge", "Observatory",
        "Pit", "Cellar", "Gallery", "Prison", "Sanctum"
      ];

      function roomLabels() {
        const fs = currentFloorState();
        if (!fs.roomLabels) fs.roomLabels = {};
        return fs.roomLabels;
      }

      // Auto-assign a label to the current tile's "room" (keyed by rough quadrant).
      function labelCurrentRoom() {
        const qx = Math.floor(state.x / 5);
        const qy = Math.floor(state.y / 5);
        const key = `${qx},${qy}`;
        const labels = roomLabels();
        if (!labels[key]) {
          const idx = (Object.keys(labels).length) % ROOM_NAMES.length;
          labels[key] = ROOM_NAMES[idx];
          return labels[key];
        }
        return null;
      }

      function currentRoomLabel() {
        const qx = Math.floor(state.x / 5);
        const qy = Math.floor(state.y / 5);
        return roomLabels()[`${qx},${qy}`] || null;
      }

      // ── Waypoints ──────────────────────────────────────────────────────────

      function waypoints() {
        if (!state.waypoints) state.waypoints = {};
        return state.waypoints;
      }

      // Set a named waypoint at the current position (or clear it if already set).
      function toggleWaypoint(name) {
        const wps = waypoints();
        const key = `${state.floorIndex},${state.x},${state.y}`;
        if (wps[key]) {
          delete wps[key];
          return false; // cleared
        }
        wps[key] = name || `WP${Object.keys(wps).length + 1}`;
        return true; // set
      }

      function waypointAt(floorIndex, x, y) {
        return waypoints()[`${floorIndex},${x},${y}`] || null;
      }

      function clearWaypoints() {
        state.waypoints = {};
      }

      // ── Danger zones ───────────────────────────────────────────────────────

      function dangerZones() {
        const fs = currentFloorState();
        if (!fs.dangerZones) fs.dangerZones = new Set();
        return fs.dangerZones;
      }

      // Mark the current tile as a danger zone (call after heavy damage).
      function markDangerZone() {
        dangerZones().add(keyOf(state.x, state.y));
      }

      function isDangerZone(x, y) {
        return dangerZones().has(keyOf(x, y));
      }

      // ── Scouting bonus ─────────────────────────────────────────────────────

      // Award +10% XP the first time each room quadrant is entered.
      // Stored as floorState.scoutedRooms (Set of quadrant keys).
      function checkScoutingBonus() {
        const fs = currentFloorState();
        if (!fs.scoutedRooms) fs.scoutedRooms = new Set();
        const qx = Math.floor(state.x / 5);
        const qy = Math.floor(state.y / 5);
        const key = `${qx},${qy}`;
        if (fs.scoutedRooms.has(key)) return 0;
        fs.scoutedRooms.add(key);
        const bonus = Math.round((state.experience || 0) * 0.02); // tiny XP bump
        if (bonus > 0) {
          state.experience += bonus;
        }
        labelCurrentRoom();
        return bonus;
      }

      // ── Floor completion ───────────────────────────────────────────────────

      // Returns true when the party has discovered ≥ 85% of passable tiles.
      function isFloorComplete() {
        const fs = currentFloorState();
        const discovered = fs.discovered ? fs.discovered.size : 0;
        const floor = currentFloor();
        let passable = 0;
        for (let y = 0; y < floor.height; y += 1) {
          for (let x = 0; x < floor.width; x += 1) {
            if (!solidAt(x, y)) passable += 1;
          }
        }
        return passable > 0 && discovered >= Math.ceil(passable * 0.85);
      }

      // Shortest-path distance estimate (Manhattan) to any floor stairs.
      function distanceToStairs() {
        const floor = currentFloor();
        const stairCells = [floor.stairs?.down, floor.stairs?.up].filter(Boolean);
        if (stairCells.length === 0) return Infinity;
        return Math.min(...stairCells.map((s) => Math.abs(s.x - state.x) + Math.abs(s.y - state.y)));
      }

      context.labelCurrentRoom  = labelCurrentRoom;
      context.currentRoomLabel  = currentRoomLabel;
      context.toggleWaypoint    = toggleWaypoint;
      context.waypointAt        = waypointAt;
      context.clearWaypoints    = clearWaypoints;
      context.markDangerZone    = markDangerZone;
      context.isDangerZone      = isDangerZone;
      context.checkScoutingBonus = checkScoutingBonus;
      context.isFloorComplete   = isFloorComplete;
      context.distanceToStairs  = distanceToStairs;
      context.ROOM_NAMES        = ROOM_NAMES;
    }
  };
}());
