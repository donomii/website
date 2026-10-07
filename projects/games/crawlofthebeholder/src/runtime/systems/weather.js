(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Dynamic floor weather: each floor can have a weather condition that shifts
  // over time and affects the environment — rain douses fires, wind drifts
  // clouds, heat from lava tiles injures the party, blizzards freeze water,
  // and arcane storms boost magic damage.
  // Gated: context.weatherDisabled = true in the test harness keeps tickWeather inert.
  window.CotBRuntime.installWeather = function (context) {
    with (context) {
      const WEATHER_KINDS = ["clear", "rain", "wind", "heat", "blizzard", "arcane-storm"];
      const WEATHER_DURATION = { clear: 30, rain: 15, wind: 12, heat: 18, blizzard: 14, "arcane-storm": 10 };
      const WEATHER_NAMES = {
        clear: "The air is still.",
        rain: "A damp drizzle fills the corridor.",
        wind: "Gusts rush through the tunnels.",
        heat: "Scorching vapors rise from below.",
        blizzard: "Ice crystals swirl in the frigid air.",
        "arcane-storm": "The ether crackles with wild magic."
      };

      function weatherState() {
        const floorState = currentFloorState();
        if (!floorState.weather) floorState.weather = { kind: "clear", turnsLeft: 30, arcaneAmplify: false };
        return floorState.weather;
      }

      function currentWeather() {
        return weatherState().kind;
      }

      function setWeather(kind, turns) {
        const ws = weatherState();
        ws.kind = WEATHER_KINDS.includes(kind) ? kind : "clear";
        ws.turnsLeft = turns || WEATHER_DURATION[ws.kind] || 20;
        ws.arcaneAmplify = ws.kind === "arcane-storm";
      }

      // Rain: extinguish all flame clouds on this floor.
      function applyRain(messages) {
        const floorState = currentFloorState();
        if (!floorState.clouds) return;
        const before = floorState.clouds.length;
        floorState.clouds = floorState.clouds.filter((c) => c.kind !== "flame");
        const doused = before - floorState.clouds.length;
        if (doused > 0) messages.push(`Rain douses ${doused} fire${doused === 1 ? "" : "s"}.`);
      }

      // Wind: drift clouds by 1 tile in a consistent direction each turn.
      function applyWind(messages) {
        const floorState = currentFloorState();
        if (!floorState.clouds || floorState.clouds.length === 0) return;
        const dx = 1; // drift east
        const moved = [];
        for (const cloud of floorState.clouds) {
          const nx = cloud.x + dx;
          if (mapContains(nx, cloud.y) && !solidAt(nx, cloud.y)) {
            cloud.x = nx;
            moved.push(cloud);
          }
        }
        if (moved.length > 0) messages.push("Wind carries the vapors.");
      }

      // Heat: lava tiles deal 1 chip damage to the lead party member each turn.
      function applyHeat(messages) {
        const floorState = currentFloorState();
        // Check every discovered lava tile near the party (within 2 tiles).
        let nearLava = false;
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const tx = state.x + dx;
            const ty = state.y + dy;
            if (mapContains(tx, ty) && cellAt(tx, ty) === "l") { nearLava = true; break; }
          }
          if (nearLava) break;
        }
        if (!nearLava) return;
        const member = liveMember();
        if (!member) return;
        const dmg = 1;
        member.hp = Math.max(0, member.hp - dmg);
        messages.push(`Heat scorches ${member.name} for ${dmg}.`);
        if (!liveMember()) state.defeated = true;
      }

      // Blizzard: freeze any water tiles adjacent to the party.
      function applyBlizzard(messages) {
        if (typeof freezeTile !== "function") return;
        const floorState = currentFloorState();
        let froze = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const tx = state.x + dx;
            const ty = state.y + dy;
            if (!mapContains(tx, ty)) continue;
            const cell = cellAt(tx, ty);
            if (cell === "W" || cell === "w") {
              if (typeof isFrozenTile !== "function" || !isFrozenTile(tx, ty)) {
                freezeTile(tx, ty, 6);
                froze += 1;
              }
            }
          }
        }
        if (froze > 0) messages.push(`Blizzard freezes ${froze} water tile${froze === 1 ? "" : "s"}.`);
      }

      // Arcane storm: mark active on floorState so magic-using systems can read it.
      function applyArcaneStorm() {
        weatherState().arcaneAmplify = true;
      }

      function arcaneAmplified() {
        return !!(weatherState().arcaneAmplify && weatherState().kind === "arcane-storm");
      }

      function tickWeather(messages) {
        if (context.weatherDisabled) return false;
        const ws = weatherState();
        ws.turnsLeft = (ws.turnsLeft || 1) - 1;

        // Apply per-turn weather effect.
        switch (ws.kind) {
          case "rain":        applyRain(messages);     break;
          case "wind":        applyWind(messages);     break;
          case "heat":        applyHeat(messages);     break;
          case "blizzard":    applyBlizzard(messages); break;
          case "arcane-storm": applyArcaneStorm();     break;
          default: break;
        }

        // Shift to new weather when duration expires.
        if (ws.turnsLeft <= 0) {
          const next = WEATHER_KINDS[Math.floor(Math.random() * WEATHER_KINDS.length)];
          const duration = WEATHER_DURATION[next] || 20;
          ws.kind = next;
          ws.turnsLeft = duration;
          ws.arcaneAmplify = (next === "arcane-storm");
          if (next !== "clear") messages.push(WEATHER_NAMES[next] || "The weather shifts.");
        }
        return false;
      }

      turnHooks.push(tickWeather);

      context.currentWeather   = currentWeather;
      context.setWeather       = setWeather;
      context.arcaneAmplified  = arcaneAmplified;
      context.weatherState     = weatherState;
      context.WEATHER_KINDS    = WEATHER_KINDS;
    }
  };
}());
