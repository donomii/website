(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Siege system: on certain floors the dungeon launches coordinated monster
  // waves. The party must survive for a holdout period to win the siege and
  // collect a reward. Fortifying (holding a position) grants a defense bonus.
  // Gated by context.siegeDisabled.
  window.CotBRuntime.installSiege = function (context) {
    with (context) {
      function siegeFloorState() {
        const fs = currentFloorState();
        if (!fs.siege) fs.siege = { active: false, wavesLeft: 0, turnsLeft: 0, holdTurns: 0, fortified: false, fortifyTurns: 0 };
        return fs.siege;
      }

      function siegeActive() {
        return siegeFloorState().active;
      }

      // Begin a siege: wavesLeft waves, each separated by waveInterval turns.
      // holdTurns: surviving this many total turns wins the siege.
      function startSiege(options, messages) {
        const sg = siegeFloorState();
        if (sg.active) { messages.push("A siege is already underway."); return false; }
        sg.active = true;
        sg.wavesLeft = options.waves || 3;
        sg.waveInterval = options.waveInterval || 8;
        sg.turnsLeft = options.holdTurns || (sg.wavesLeft * sg.waveInterval);
        sg.holdTurns = sg.turnsLeft;
        sg.fortified = false;
        sg.fortifyTurns = 0;
        sg.waveCountdown = sg.waveInterval;
        messages.push(`Siege begins! Survive ${sg.turnsLeft} turns across ${sg.wavesLeft} waves.`);
        return true;
      }

      // Spawn a wave of monsters. Count scales with wave number.
      function spawnSiegeWave(sg, messages) {
        if (sg.wavesLeft <= 0) return;
        const floorState = currentFloorState();
        const templates = (resources.monsters || []).filter(
          (m) => !m.boss && (m.hd || 1) <= (state.floorIndex + 2)
        );
        if (templates.length === 0) { messages.push("The siege falters — no reinforcements."); return; }
        const count = 2 + Math.floor(Math.random() * 3);
        let spawned = 0;
        for (let attempt = 0; attempt < 40 && spawned < count; attempt += 1) {
          const edge = Math.random() < 0.5 ? 0 : (currentFloor().width - 1);
          const y = 1 + Math.floor(Math.random() * (currentFloor().height - 2));
          const x = edge;
          if (!mapContains(x, y) || solidAt(x, y) || monsterAt(x, y)) continue;
          const tpl = templates[Math.floor(Math.random() * templates.length)];
          const serial = (state.lootSerial = (state.lootSerial || 0) + 1);
          floorState.monsters.push({ ...tpl, id: `siege-${serial}`, x, y, hp: tpl.maxHp || tpl.hp || 10, energy: 0, alerted: true });
          spawned += 1;
        }
        sg.wavesLeft -= 1;
        messages.push(`Wave ${sg.holdTurns - sg.turnsLeft > 0 ? "" : ""}${spawned} attackers pour in! Waves remaining: ${sg.wavesLeft}.`);
      }

      // Fortify position: the party digs in, gaining +3 defense while standing still.
      // Fortification breaks if the party moves.
      function fortifyPosition(messages) {
        const sg = siegeFloorState();
        if (!sg.active) { messages.push("No siege is underway."); return false; }
        sg.fortified = true;
        sg.fortifyX = state.x;
        sg.fortifyY = state.y;
        sg.fortifyTurns = 6;
        messages.push("The party fortifies! +3 defense for 6 turns.");
        return true;
      }

      // Returns flat defense bonus from fortification (called externally).
      function siegeFortifyBonus() {
        const sg = siegeFloorState();
        if (!sg.active || !sg.fortified || sg.fortifyTurns <= 0) return 0;
        return 3;
      }

      // Reward for surviving the siege.
      function siegeVictory(messages) {
        const gold = 40 + Math.floor(Math.random() * 40);
        state.gold += gold;
        messages.push(`Siege repelled! Victory reward: ${gold} gold.`);
      }

      function tickSiege(messages) {
        if (context.siegeDisabled) return false;
        const sg = siegeFloorState();
        if (!sg.active) return false;

        // Count down fortify turns; break if party moved.
        if (sg.fortified) {
          if (state.x !== sg.fortifyX || state.y !== sg.fortifyY) {
            sg.fortified = false;
            sg.fortifyTurns = 0;
            messages.push("Fortification broken — the party moved.");
          } else {
            sg.fortifyTurns = Math.max(0, sg.fortifyTurns - 1);
            if (sg.fortifyTurns === 0) sg.fortified = false;
          }
        }

        // Spawn wave.
        sg.waveCountdown = Math.max(0, (sg.waveCountdown || 0) - 1);
        if (sg.waveCountdown === 0 && sg.wavesLeft > 0) {
          spawnSiegeWave(sg, messages);
          sg.waveCountdown = sg.waveInterval || 8;
        }

        // Count down holdout timer.
        sg.turnsLeft = Math.max(0, sg.turnsLeft - 1);
        if (sg.turnsLeft === 0) {
          sg.active = false;
          siegeVictory(messages);
        } else if (sg.turnsLeft % 5 === 0) {
          messages.push(`${sg.turnsLeft} turns remain in the siege.`);
        }

        return false;
      }

      turnHooks.push(tickSiege);

      context.siegeActive      = siegeActive;
      context.startSiege       = startSiege;
      context.fortifyPosition  = fortifyPosition;
      context.siegeFortifyBonus = siegeFortifyBonus;
    }
  };
}());
