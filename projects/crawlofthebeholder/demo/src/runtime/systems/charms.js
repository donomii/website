(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installCharms = function installCharms(context) {
    with (context) {
      const SCROLL_TILE = "vendor/crawl/crawl-ref/source/rltiles/item/scroll/i-acquirement.png";
      const CHARM_DEFS = [
        { id: "charm-mending", name: "charm of mending", kind: "charm", charmKind: "mending", effect: "heal", power: 8, value: 14, tile: SCROLL_TILE },
        { id: "charm-restoration", name: "charm of restoration", kind: "charm", charmKind: "restoration", effect: "heal", power: 16, value: 24, tile: SCROLL_TILE },
        { id: "charm-revival", name: "charm of revival", kind: "charm", charmKind: "revival", effect: "revive", power: 8, value: 34, tile: SCROLL_TILE },
        { id: "charm-cleansing", name: "charm of cleansing", kind: "charm", charmKind: "cleansing", effect: "clear", fields: ["poisonedTurns", "barbedTurns", "engulfedTurns", "corrodedTurns", "dazedTurns", "vitrifiedTurns"], value: 20, tile: SCROLL_TILE },
        { id: "charm-freedom", name: "charm of freedom", kind: "charm", charmKind: "freedom", effect: "clear", fields: ["snaredTurns", "barbedTurns", "engulfedTurns"], value: 18, tile: SCROLL_TILE },
        { id: "charm-antidote", name: "charm of antidote", kind: "charm", charmKind: "antidote", effect: "clear", fields: ["poisonedTurns"], value: 10, tile: SCROLL_TILE },
        { id: "charm-battle-vow", name: "charm of battle vow", kind: "charm", charmKind: "battle-vow", effect: "party-status", statuses: { mightTurns: 10 }, value: 20, tile: SCROLL_TILE },
        { id: "charm-quickstep", name: "charm of quickstep", kind: "charm", charmKind: "quickstep", effect: "party-status", statuses: { hasteTurns: 8 }, value: 22, tile: SCROLL_TILE },
        { id: "charm-warding", name: "charm of warding", kind: "charm", charmKind: "warding", effect: "party-status", statuses: { resistanceTurns: 10 }, value: 22, tile: SCROLL_TILE },
        { id: "charm-fury", name: "charm of fury", kind: "charm", charmKind: "fury", effect: "fury", turns: 5, value: 24, tile: SCROLL_TILE },
        { id: "charm-silencebreak", name: "charm of silencebreak", kind: "charm", charmKind: "silencebreak", effect: "clear", fields: ["silenceTurns"], value: 14, tile: SCROLL_TILE },
        { id: "charm-lantern", name: "charm of lanterns", kind: "charm", charmKind: "lantern", effect: "reveal", radius: 5, value: 12, tile: SCROLL_TILE },
        { id: "charm-cartographer", name: "charm of the cartographer", kind: "charm", charmKind: "cartographer", effect: "reveal", all: true, value: 28, tile: SCROLL_TILE },
        { id: "charm-marker", name: "charm of markers", kind: "charm", charmKind: "marker", effect: "marker", value: 10, tile: SCROLL_TILE },
        { id: "charm-pathmark", name: "charm of pathmarks", kind: "charm", charmKind: "pathmark", effect: "pathmark", value: 16, tile: SCROLL_TILE },
        { id: "charm-blink", name: "charm of blinking", kind: "charm", charmKind: "blink", effect: "move", mode: "blink", value: 18, tile: SCROLL_TILE },
        { id: "charm-translocation", name: "charm of translocation", kind: "charm", charmKind: "translocation", effect: "move", mode: "teleport", value: 20, tile: SCROLL_TILE },
        { id: "charm-smoke", name: "charm of smoke", kind: "charm", charmKind: "smoke", effect: "cloud", mode: "fog", turns: 7, value: 14, tile: SCROLL_TILE },
        { id: "charm-venom-mist", name: "charm of venom mist", kind: "charm", charmKind: "venom-mist", effect: "cloud", mode: "poison", turns: 6, value: 16, tile: SCROLL_TILE },
        { id: "charm-embers", name: "charm of embers", kind: "charm", charmKind: "embers", effect: "cloud", mode: "flame-ahead", turns: 4, value: 16, tile: SCROLL_TILE },
        { id: "charm-frost", name: "charm of frost", kind: "charm", charmKind: "frost", effect: "reaction", element: "cold", power: 6, value: 14, tile: SCROLL_TILE },
        { id: "charm-thaw", name: "charm of thawing", kind: "charm", charmKind: "thaw", effect: "reaction", element: "fire", power: 6, value: 14, tile: SCROLL_TILE },
        { id: "charm-spark", name: "charm of sparks", kind: "charm", charmKind: "spark", effect: "reaction", element: "elec", power: 7, value: 16, tile: SCROLL_TILE },
        { id: "charm-clear-air", name: "charm of clear air", kind: "charm", charmKind: "clear-air", effect: "clear-clouds", range: 3, value: 12, tile: SCROLL_TILE },
        { id: "charm-raincall", name: "charm of raincall", kind: "charm", charmKind: "raincall", effect: "weather", weather: "rain", turns: 12, value: 16, tile: SCROLL_TILE },
        { id: "charm-tailwind", name: "charm of tailwind", kind: "charm", charmKind: "tailwind", effect: "weather", weather: "wind", turns: 10, value: 16, tile: SCROLL_TILE },
        { id: "charm-snowcall", name: "charm of snowcall", kind: "charm", charmKind: "snowcall", effect: "weather", weather: "blizzard", turns: 10, value: 18, tile: SCROLL_TILE },
        { id: "charm-etherstorm", name: "charm of etherstorm", kind: "charm", charmKind: "etherstorm", effect: "weather", weather: "arcane-storm", turns: 8, value: 20, tile: SCROLL_TILE },
        { id: "charm-calm", name: "charm of calm skies", kind: "charm", charmKind: "calm", effect: "weather", weather: "clear", turns: 20, value: 12, tile: SCROLL_TILE },
        { id: "charm-dread", name: "charm of dread", kind: "charm", charmKind: "dread", effect: "area-status", field: "fearTurns", turns: 6, range: 7, value: 18, tile: SCROLL_TILE },
        { id: "charm-befuddle", name: "charm of befuddlement", kind: "charm", charmKind: "befuddle", effect: "area-status", field: "confusedTurns", turns: 5, range: 6, value: 18, tile: SCROLL_TILE },
        { id: "charm-roots", name: "charm of roots", kind: "charm", charmKind: "roots", effect: "nearest-status", field: "rootedTurns", turns: 5, range: 7, value: 18, tile: SCROLL_TILE },
        { id: "charm-slowing", name: "charm of slowing", kind: "charm", charmKind: "slowing", effect: "nearest-status", field: "slowedTurns", turns: 6, range: 7, value: 16, tile: SCROLL_TILE },
        { id: "charm-frailty", name: "charm of frailty", kind: "charm", charmKind: "frailty", effect: "nearest-status", field: "weakenedTurns", turns: 6, range: 7, value: 16, tile: SCROLL_TILE },
        { id: "charm-hush", name: "charm of hush", kind: "charm", charmKind: "hush", effect: "nearest-status", field: "silencedTurns", turns: 6, range: 7, value: 18, tile: SCROLL_TILE },
        { id: "charm-daze", name: "charm of dazing", kind: "charm", charmKind: "daze", effect: "nearest-status", field: "dazedTurns", turns: 5, range: 7, value: 18, tile: SCROLL_TILE },
        { id: "charm-venom", name: "charm of venom", kind: "charm", charmKind: "venom", effect: "nearest-status", field: "poisonedTurns", turns: 6, range: 7, poisonPower: 2, value: 18, tile: SCROLL_TILE },
        { id: "charm-immolation", name: "charm of immolation", kind: "charm", charmKind: "immolation", effect: "area-status", field: "immolationTurns", turns: 14, range: 7, value: 22, tile: SCROLL_TILE },
        { id: "charm-flame-shot", name: "charm of flame shot", kind: "charm", charmKind: "flame-shot", effect: "damage", element: "fire", power: 10, range: 7, value: 20, tile: SCROLL_TILE },
        { id: "charm-ice-shot", name: "charm of ice shot", kind: "charm", charmKind: "ice-shot", effect: "damage", element: "cold", power: 9, range: 7, statusField: "slowedTurns", statusTurns: 3, value: 20, tile: SCROLL_TILE },
        { id: "charm-thunder-shot", name: "charm of thunder shot", kind: "charm", charmKind: "thunder-shot", effect: "damage", element: "elec", power: 9, range: 7, statusField: "stunnedTurns", statusTurns: 2, value: 22, tile: SCROLL_TILE },
        { id: "charm-acid-shot", name: "charm of acid shot", kind: "charm", charmKind: "acid-shot", effect: "damage", element: "acid", power: 9, range: 7, corrode: true, value: 22, tile: SCROLL_TILE },
        { id: "charm-life-leech", name: "charm of life leech", kind: "charm", charmKind: "life-leech", effect: "leech", element: "drain", power: 8, range: 7, value: 24, tile: SCROLL_TILE },
        { id: "charm-purse", name: "charm of purses", kind: "charm", charmKind: "purse", effect: "gold", amount: 25, value: 18, tile: SCROLL_TILE },
        { id: "charm-insight", name: "charm of insight", kind: "charm", charmKind: "insight", effect: "xp", amount: 8, value: 20, tile: SCROLL_TILE },
        { id: "charm-provisions", name: "charm of provisions", kind: "charm", charmKind: "provisions", effect: "provision", amount: 2, value: 14, tile: SCROLL_TILE },
        { id: "charm-ore", name: "charm of ore", kind: "charm", charmKind: "ore", effect: "ore", amount: 2, value: 16, tile: SCROLL_TILE },
        { id: "charm-purification", name: "charm of purification", kind: "charm", charmKind: "purification", effect: "purify", amount: 20, value: 18, tile: SCROLL_TILE },
        { id: "charm-relic-charge", name: "charm of relic charge", kind: "charm", charmKind: "relic-charge", effect: "relic-charge", amount: 1, value: 28, tile: SCROLL_TILE },
        { id: "charm-rally", name: "charm of rallying", kind: "charm", charmKind: "rally", effect: "summon", value: 24, tile: SCROLL_TILE }
      ];

      function charmDefinition(item) {
        return CHARM_DEFS.find((def) => def.charmKind === item?.charmKind || def.id === item?.id) || null;
      }

      function registerCharms() {
        for (const charm of CHARM_DEFS) {
          if (!resources.inventory.some((item) => item.id === charm.id)) resources.inventory.push({ ...charm });
        }
      }

      function charmSpec(item) {
        const def = charmDefinition(item) || {};
        return { ...def, ...item };
      }

      function aheadCell() {
        const step = dirs[state.dir];
        return { x: state.x + step.x, y: state.y + step.y };
      }

      function revealAround(radius) {
        const floorState = currentFloorState();
        let revealed = 0;
        for (let y = state.y - radius; y <= state.y + radius; y += 1) {
          for (let x = state.x - radius; x <= state.x + radius; x += 1) {
            if (!mapContains(x, y) || Math.abs(x - state.x) + Math.abs(y - state.y) > radius) continue;
            const key = keyOf(x, y);
            if (!floorState.discovered.has(key)) revealed += 1;
            floorState.discovered.add(key);
          }
        }
        return revealed;
      }

      function nearbyMonsters(range) {
        return currentFloorState().monsters.filter((monster) => monster.hp > 0 && distanceToPlayer(monster) <= range);
      }

      function nearestMonster(range) {
        return nearbyMonsters(range).sort((a, b) => distanceToPlayer(a) - distanceToPlayer(b))[0] || null;
      }

      function setMonsterStatus(monster, field, turns, spec) {
        monster[field] = Math.max(monster[field] || 0, turns);
        if (spec.poisonPower) monster.poisonPower = Math.max(monster.poisonPower || 0, spec.poisonPower);
      }

      function placeCloudAt(cell, kind, turns) {
        if (!mapContains(cell.x, cell.y) || solidAt(cell.x, cell.y)) return false;
        const floorState = currentFloorState();
        const cloud = cloudAt(cell.x, cell.y);
        if (cloud) {
          cloud.kind = kind;
          cloud.turns = Math.max(cloud.turns, turns);
        } else {
          floorState.clouds.push({ x: cell.x, y: cell.y, kind, turns });
        }
        floorState.discovered.add(keyOf(cell.x, cell.y));
        return true;
      }

      function clearClouds(range) {
        const floorState = currentFloorState();
        const before = floorState.clouds.length;
        floorState.clouds = floorState.clouds.filter((cloud) => Math.abs(cloud.x - state.x) + Math.abs(cloud.y - state.y) > range);
        return before - floorState.clouds.length;
      }

      function nearestStairCell() {
        const stairCells = [currentFloor().stairs?.down, currentFloor().stairs?.up].filter(Boolean);
        if (stairCells.length === 0) return null;
        return stairCells.sort((a, b) => Math.abs(a.x - state.x) + Math.abs(a.y - state.y) - Math.abs(b.x - state.x) - Math.abs(b.y - state.y))[0];
      }

      function damageCharmTarget(spec, messages) {
        const target = nearestMonster(spec.range || 7);
        if (!target) { messages.push(`${spec.name} finds no target.`); return false; }
        const base = Math.max(1, spec.power || 8);
        const damage = monsterElementDamage(target, base, spec.element);
        target.hp = Math.max(0, target.hp - damage);
        if (typeof addDamageMark === "function") addDamageMark(target, spec.element, damage);
        if (typeof addEffect === "function") addEffect(spec.element === "cold" ? "ice" : spec.element === "fire" ? "flame" : "magic", [target]);
        if (spec.statusField && target.hp > 0) setMonsterStatus(target, spec.statusField, spec.statusTurns || 3, spec);
        if (spec.corrode && target.hp > 0) target.ac = Math.max(0, (target.ac || 0) - 1);
        if (target.hp === 0) messages.push(killMonster(target));
        else messages.push(`${spec.name} strikes ${target.name} for ${damage}.`);
        return { target, damage };
      }

      function reviveMember(spec, messages) {
        const member = state.party.find((entry) => entry.hp <= 0);
        if (!member) { messages.push("No fallen party member needs revival."); return false; }
        member.hp = Math.min(member.maxHp, spec.power || 8);
        messages.push(`${member.name} staggers upright.`);
        return true;
      }

      function useCharm(item, messages = []) {
        const spec = charmSpec(item);
        if (!spec.charmKind) { messages.push(`${item?.name || "The charm"} has no readable pattern.`); return false; }

        if (spec.effect === "heal") {
          const healed = healParty(spec.power || 8);
          messages.push(healed > 0 ? `${spec.name} restores ${healed} health.` : `${spec.name} glows, but no wounds close.`);
          return true;
        }
        if (spec.effect === "revive") return reviveMember(spec, messages);
        if (spec.effect === "clear") {
          let cleared = 0;
          for (const field of spec.fields || []) {
            if ((state[field] || 0) > 0) cleared += 1;
            state[field] = 0;
          }
          messages.push(cleared > 0 ? `${spec.name} clears ${cleared} lingering effect${cleared === 1 ? "" : "s"}.` : `${spec.name} leaves the party steady.`);
          return true;
        }
        if (spec.effect === "party-status") {
          for (const [field, turns] of Object.entries(spec.statuses || {})) state[field] = Math.max(state[field] || 0, turns);
          messages.push(`${spec.name} settles over the party.`);
          return true;
        }
        if (spec.effect === "fury") {
          state.rageTurns = Math.max(state.rageTurns || 0, spec.turns || 5);
          state.mightTurns = Math.max(state.mightTurns || 0, spec.turns || 5);
          state.hasteTurns = Math.max(state.hasteTurns || 0, spec.turns || 5);
          messages.push(`${spec.name} sends the party into a controlled fury.`);
          return true;
        }
        if (spec.effect === "reveal") {
          if (spec.all) revealAll();
          else revealAround(spec.radius || 4);
          messages.push(`${spec.name} sketches the dark.`);
          return true;
        }
        if (spec.effect === "marker") {
          state.mapMarkers = state.mapMarkers || [];
          state.mapMarkers.push({ floorIndex: state.floorIndex, x: state.x, y: state.y, kind: "charm", turn: state.turnCount });
          messages.push(`${spec.name} pins this spot on the map.`);
          return true;
        }
        if (spec.effect === "pathmark") {
          const stair = nearestStairCell();
          if (!stair) { messages.push(`${spec.name} finds no stairs to mark.`); return false; }
          state.mapMarkers = state.mapMarkers || [];
          state.mapMarkers.push({ floorIndex: state.floorIndex, x: stair.x, y: stair.y, kind: "stairs", turn: state.turnCount });
          currentFloorState().discovered.add(keyOf(stair.x, stair.y));
          messages.push(`${spec.name} marks the nearest stairs.`);
          return true;
        }
        if (spec.effect === "move") {
          const origin = { x: state.x, y: state.y };
          const moved = spec.mode === "teleport" ? teleportParty() : blinkParty();
          if (!moved) { messages.push(`${spec.name} cannot find a landing.`); return false; }
          if (typeof addEffect === "function") addEffect("blink", [origin, { x: state.x, y: state.y }]);
          messages.push(`${spec.name} folds the party elsewhere.`);
          return true;
        }
        if (spec.effect === "cloud") {
          let count = 0;
          if (spec.mode === "fog") count = spreadFog(spec.turns || 7);
          else if (spec.mode === "poison") count = spreadPoison(spec.turns || 6);
          else count = placeCloudAt(aheadCell(), "flame", spec.turns || 4) ? 1 : 0;
          if (count === 0) { messages.push(`${spec.name} finds no open air.`); return false; }
          messages.push(`${spec.name} fills ${count} tile${count === 1 ? "" : "s"}.`);
          return true;
        }
        if (spec.effect === "reaction") {
          const cell = aheadCell();
          const reaction = typeof reactionAt === "function" ? reactionAt(cell.x, cell.y, spec.element, spec.power || 6, messages) : null;
          if (!reaction) { messages.push(`${spec.name} finds nothing reactive ahead.`); return false; }
          return true;
        }
        if (spec.effect === "clear-clouds") {
          const cleared = clearClouds(spec.range || 3);
          messages.push(cleared > 0 ? `${spec.name} clears ${cleared} cloud${cleared === 1 ? "" : "s"}.` : `${spec.name} stirs clean air.`);
          return true;
        }
        if (spec.effect === "weather") {
          if (typeof setWeather !== "function") { messages.push(`${spec.name} cannot touch the air here.`); return false; }
          setWeather(spec.weather, spec.turns);
          messages.push(`${spec.name} shifts the weather.`);
          return true;
        }
        if (spec.effect === "area-status") {
          const targets = nearbyMonsters(spec.range || 7);
          if (targets.length === 0) { messages.push(`${spec.name} finds no target.`); return false; }
          for (const monster of targets) setMonsterStatus(monster, spec.field, spec.turns || 4, spec);
          if (typeof addEffect === "function") addEffect("magic", targets);
          messages.push(`${spec.name} marks ${targets.length} target${targets.length === 1 ? "" : "s"}.`);
          return true;
        }
        if (spec.effect === "nearest-status") {
          const target = nearestMonster(spec.range || 7);
          if (!target) { messages.push(`${spec.name} finds no target.`); return false; }
          setMonsterStatus(target, spec.field, spec.turns || 4, spec);
          if (typeof addEffect === "function") addEffect("magic", [target]);
          messages.push(`${spec.name} settles on ${target.name}.`);
          return true;
        }
        if (spec.effect === "damage") return !!damageCharmTarget(spec, messages);
        if (spec.effect === "leech") {
          const result = damageCharmTarget(spec, messages);
          if (!result) return false;
          const healed = healParty(Math.max(1, Math.ceil(result.damage / 2)));
          if (healed > 0) messages.push(`The stolen life restores ${healed} health.`);
          return true;
        }
        if (spec.effect === "gold") {
          state.gold = (state.gold || 0) + (spec.amount || 0);
          messages.push(`${spec.name} turns warm in the purse.`);
          return true;
        }
        if (spec.effect === "xp") {
          const before = state.experience;
          awardExperience({ exp: spec.amount || 1, boss: false });
          messages.push(`${spec.name} grants ${state.experience - before} insight.`);
          return true;
        }
        if (spec.effect === "provision") {
          if (typeof provisionParty === "function") provisionParty(spec.amount || 1);
          else state.provisions = (state.provisions || 0) + (spec.amount || 1);
          messages.push(`${spec.name} packs fresh provisions.`);
          return true;
        }
        if (spec.effect === "ore") {
          for (let index = 0; index < (spec.amount || 1); index += 1) {
            state.lootSerial = (state.lootSerial || 0) + 1;
            state.inventory.push({ id: `ore-charm-${state.lootSerial}`, name: "iron ore", kind: "ore", value: 5 });
          }
          messages.push(`${spec.name} condenses ore into the pack.`);
          return true;
        }
        if (spec.effect === "purify") {
          const before = state.corruption || 0;
          if (typeof reduceCorruption === "function") reduceCorruption(spec.amount || 20);
          else state.corruption = Math.max(0, (state.corruption || 0) - (spec.amount || 20));
          messages.push(`${spec.name} purges ${before - (state.corruption || 0)} corruption.`);
          return true;
        }
        if (spec.effect === "relic-charge") {
          const relics = state.inventory.filter((entry) => entry.kind === "relic");
          if (relics.length === 0) { messages.push(`${spec.name} finds no relic to charge.`); return false; }
          for (const relic of relics) relic.charges = Math.min(relic.chargesMax || 6, (relic.charges || 0) + (spec.amount || 1));
          messages.push(`${spec.name} wakes ${relics.length} relic${relics.length === 1 ? "" : "s"}.`);
          return true;
        }
        if (spec.effect === "summon") {
          if (typeof createAlly !== "function") { messages.push(`${spec.name} has no one to rally.`); return false; }
          const cell = dirs.map((dir) => ({ x: state.x + dir.x, y: state.y + dir.y })).find((spot) => !solidAt(spot.x, spot.y) && !closedDoorAt(spot.x, spot.y) && !monsterAt(spot.x, spot.y) && !allyAt(spot.x, spot.y));
          if (!cell) { messages.push(`${spec.name} finds no room to rally an ally.`); return false; }
          const ally = createAlly({ name: "rallied guardian", power: 6, attacks: [{ type: "hit", damage: 12 }] }, { x: cell.x, y: cell.y, maxHp: 18, hp: 18, turns: 24 });
          if (!ally) { messages.push("The party already commands too many allies."); return false; }
          messages.push(`${spec.name} rallies ${ally.name}.`);
          return true;
        }
        messages.push(`${spec.name} fades without effect.`);
        return false;
      }

      registerCharms();
      Object.assign(context, { CHARM_DEFS, charmDefinition, useCharm });
    }
  };
}());
