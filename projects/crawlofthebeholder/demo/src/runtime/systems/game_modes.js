(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Selectable game modes and rule/visual variations across both 2D and VR.
  window.CotBRuntime.installGameModes = function installGameModes(context) {
    with (context) {
      const BASELINE_FLOORS = JSON.parse(JSON.stringify(resources.floors));
      const BASELINE_PARTY = JSON.parse(JSON.stringify(resources.party));
      const BASELINE_INVENTORY = JSON.parse(JSON.stringify(resources.inventory));
      const clone = (value) => JSON.parse(JSON.stringify(value));

      const GAME_MODES = {
        standard: {
          key: "standard",
          name: "Standard Crawl",
          shortName: "Standard",
          summary: "Classic DCSS-inspired delve across curated branches or The Four Ways."
        },
        sprint: {
          key: "sprint",
          name: "Dungeon Sprint",
          shortName: "Sprint",
          summary: "DCSS Dungeon Sprint: single-floor 21x15 gauntlet arena, 2x XP & gold, combo Might rush, reinforcement waves, and a 3-rune Sanctum vault."
        }
      };

      function getGameModeDefinitions() {
        return Object.values(GAME_MODES);
      }

      function isValidGameMode(key) {
        return typeof key === "string" && Object.hasOwn(GAME_MODES, key);
      }

      function normalizeGameMode(key) {
        return isValidGameMode(key) ? key : "standard";
      }

      function currentGameMode() {
        return GAME_MODES[normalizeGameMode(state.gameMode)] || GAME_MODES.standard;
      }

      function isGameMode(key) {
        return normalizeGameMode(state.gameMode) === key;
      }

      function setGameMode(key) {
        if (!isValidGameMode(key)) return false;
        state.gameMode = key;
        return true;
      }

      function modeXpScale() {
        return isGameMode("sprint") ? 2 : 1;
      }

      function modeGoldScale() {
        return isGameMode("sprint") ? 2 : 1;
      }

      function modeStatusLabel() {
        const mode = currentGameMode();
        if (mode.key === "standard") return "";
        if (mode.key === "sprint") {
          const held = typeof runesHeld === "function" ? runesHeld() : 0;
          const seal = isSprintVaultSealed() ? `Seal ${held}/3` : "Vault Open";
          return `[Sprint · ${seal}]`;
        }
        return `[${mode.shortName}]`;
      }

      // ── Mode 1: Dungeon Sprint ────────────────────────────────────────────
      const SPRINT_ROWS = [
        "xxxxxxxxxxxxxxxxxxxxx",
        "x.....x.......x.....x",
        "x..x..+.......+..x..x",
        "x.....x.......x.....x",
        "xx+xxxx..x.x..xxxxxxx",
        "x........x.x..x.....x",
        "x.............x.....x",
        "x.............+.....x",
        "x.............x.....x",
        "x........x.x..x.....x",
        "xx+xxxx..x.x..xxxxxxx",
        "x.....x.......x.....x",
        "x..x..+.......+..x..x",
        "x.....x.......x.....x",
        "xxxxxxxxxxxxxxxxxxxxx"
      ];
      const SPRINT_DOORS = ["2,4", "6,2", "14,2", "14,7", "2,10", "6,12", "14,12"];
      const SPRINT_SEAL_DOOR = "14,7";

      function findMonsterTemplate(name) {
        const tmpl = BASELINE_FLOORS.flatMap((floor) => floor.encounters || []).find((m) => m.name === name);
        if (!tmpl) throw new Error(`Missing baseline monster template '${name}' for Sprint mode.`);
        return clone(tmpl);
      }

      function findItemTemplate(kind) {
        const tmpl = BASELINE_FLOORS.flatMap((floor) => floor.floorItems || []).find((item) => item.kind === kind);
        if (!tmpl) throw new Error(`Missing baseline item template '${kind}' for Sprint mode.`);
        return clone(tmpl);
      }

      function makeSprintFloor() {
        const assetsSource = BASELINE_FLOORS.find((f) => f.id === "Vaults:1") || BASELINE_FLOORS[0];
        const floor = {
          id: "Sprint:1",
          name: "The Gauntlet of Zot",
          biome: "vaults",
          assets: clone(assetsSource.assets),
          map: {
            name: "The Gauntlet of Zot",
            width: SPRINT_ROWS[0].length,
            height: SPRINT_ROWS.length,
            rows: [...SPRINT_ROWS],
            source: "sprint-v1"
          },
          start: { x: 1, y: 7, dir: 1 },
          doors: [...SPRINT_DOORS],
          sprintSealDoor: SPRINT_SEAL_DOOR,
          stairs: {
            up: {
              x: 1, y: 7, direction: "up",
              label: "Surface gate",
              detail: "Escape here with the Orb of Zot Soup."
            },
            down: null
          },
          floorItems: [],
          traps: [
            { id: "sprint-trap-n", name: "blade trap", kind: "blade", power: 5, x: 8, y: 3, armed: true },
            { id: "sprint-trap-s", name: "snare net", kind: "snare", power: 4, x: 8, y: 11, armed: true }
          ],
          decor: [],
          encounters: []
        };

        const monsterDefs = [
          ["goblin", 4, 2],
          ["gnoll", 9, 2],
          ["orc priest", 12, 2],
          ["adder", 4, 12],
          ["killer bee", 9, 12],
          ["orc warrior", 12, 12],
          ["ogre", 12, 7],
          ["wight", 17, 6],
          ["orc knight", 17, 8]
        ];
        monsterDefs.forEach(([name, x, y], idx) => {
          const m = findMonsterTemplate(name);
          m.id = `sprint-m-${idx}-${name.replace(/\s+/g, "-")}`;
          m.x = x;
          m.y = y;
          floor.encounters.push(m);
        });

        const runeTiles = (typeof RUNE_TEMPLATES !== "undefined" && RUNE_TEMPLATES) ? RUNE_TEMPLATES : [];
        const sprintRunes = [
          { idx: 1, x: 10, y: 2, id: "sprint-rune-north" },
          { idx: 2, x: 10, y: 12, id: "sprint-rune-south" },
          { idx: 4, x: 13, y: 7, id: "sprint-rune-core" }
        ];
        sprintRunes.forEach((spec, slot) => {
          const baseRune = runeTiles[spec.idx] || runeTiles[slot];
          if (baseRune) {
            floor.floorItems.push({ ...clone(baseRune), id: spec.id, x: spec.x, y: spec.y });
          }
        });

        if (typeof ORB_TEMPLATE !== "undefined" && ORB_TEMPLATE) {
          floor.floorItems.push({ ...clone(ORB_TEMPLATE), id: "sprint-orb-of-zot", x: 18, y: 7 });
        }

        const bonusItems = [
          ["healing", 3, 6],
          ["haste", 3, 8],
          ["wand", 17, 2],
          ["armour", 17, 12],
          ["weapon", 17, 1],
          ["healing", 18, 12],
          ["gold", 6, 7]
        ];
        bonusItems.forEach(([kind, x, y], idx) => {
          const item = findItemTemplate(kind);
          item.id = `sprint-item-${idx}-${kind}`;
          item.x = x;
          item.y = y;
          floor.floorItems.push(item);
        });

        return floor;
      }

      function startSprintMode() {
        const sprintFloor = makeSprintFloor();
        resources.floors = [sprintFloor];
        state.gameMode = "sprint";
        state.expedition = "campaign";
        state.floors = [{
          openedDoors: new Set(),
          discovered: new Set(),
          usedDecor: new Set(),
          floorItems: clone(sprintFloor.floorItems),
          traps: sprintFloor.traps.map((t) => ({ ...t, armed: true })),
          clouds: [],
          floorMarks: [],
          allies: [],
          monsters: sprintFloor.encounters.map((m) => ({ ...clone(m), hp: m.maxHp, energy: 0 }))
        }];
        state.floorIndex = 0;
        state.x = sprintFloor.start.x;
        state.y = sprintFloor.start.y;
        state.dir = sprintFloor.start.dir;
        state.zotFloorIndex = 0;
        state.runesInWorld = 3;
        state.orbRun = false;
        state.orbRunTurns = 0;
        state.sprintWavesSpawned = 0;
        state.sprintSealed = true;
        // Starter Sprint supply
        const starter = findItemTemplate("might");
        starter.id = "sprint-starter-might";
        state.inventory.push(starter);
        state.message = "Dungeon Sprint: seize all 3 runes to unseal the Zot Sanctum, claim the Orb, and sprint back to the Surface gate.";
      }

      function isSprintVaultSealed() {
        if (!isGameMode("sprint")) return false;
        if (!state.sprintSealed) return false;
        const held = typeof runesHeld === "function" ? runesHeld() : 0;
        return held < 3;
      }

      function sprintDoorBlocks(x, y) {
        if (!isGameMode("sprint")) return false;
        const floor = currentFloor();
        const sealDoor = floor?.sprintSealDoor || SPRINT_SEAL_DOOR;
        if (keyOf(x, y) !== sealDoor) return false;
        if (!isSprintVaultSealed()) return false;
        const held = typeof runesHeld === "function" ? runesHeld() : 0;
        setMessage(`The Zot Sanctum is sealed — claim all 3 runes (${held}/3).`);
        return true;
      }

      function spawnSprintWave(waveNum) {
        const floorState = currentFloorState();
        const waveSpawns = waveNum === 1
          ? [["gnoll", 1, 2], ["adder", 1, 12]]
          : [["orc warrior", 17, 3], ["orc priest", 17, 11]];
        const added = [];
        for (const [name, x, y] of waveSpawns) {
          if (solidAt(x, y) || monsterAt(x, y) || (state.x === x && state.y === y)) continue;
          const tmpl = findMonsterTemplate(name);
          state.summonSerial = (state.summonSerial || 0) + 1;
          const monster = {
            ...tmpl,
            id: `sprint-wave-${waveNum}-${state.summonSerial}`,
            x,
            y,
            hp: tmpl.maxHp,
            energy: 0,
            alerted: true,
            wandering: true
          };
          floorState.monsters.push(monster);
          floorState.discovered.add(keyOf(x, y));
          added.push(monster.name);
        }
        return added;
      }

      function onModeItemCollected(item) {
        if (!isGameMode("sprint") || !item) return;
        const held = typeof runesHeld === "function" ? runesHeld() : 0;
        if (typeof isRuneItem === "function" && isRuneItem(item)) {
          if (held >= 3 && state.sprintSealed) {
            state.sprintSealed = false;
            const sealDoor = currentFloor()?.sprintSealDoor || SPRINT_SEAL_DOOR;
            currentFloorState().openedDoors.add(sealDoor);
            const [sx, sy] = sealDoor.split(",").map(Number);
            if (typeof addEffect === "function") addEffect("spell", [{ x: sx, y: sy }]);
            state.message = "All 3 runes claimed — the Zot Sanctum unseals!";
            if (typeof showToast === "function") showToast("Sanctum Vault Unsealed!");
          } else if (held > (state.sprintWavesSpawned || 0)) {
            state.sprintWavesSpawned = held;
            const added = spawnSprintWave(held);
            if (added.length > 0) {
              state.message = `${item.name} seized (${held}/3). Wave ${held} enters the arena!`;
              if (typeof showToast === "function") showToast(`Sprint Wave ${held}: ${added.join(", ")}`);
            }
          }
        }
      }

      function onModeMonsterKilled() {
        if (isGameMode("sprint")) {
          if ((state.killCombo || 0) > 0 && state.killCombo % 3 === 0) {
            state.mightTurns = Math.max(state.mightTurns || 0, 2);
            return "Sprint rush! +2 Might.";
          }
        }
        return "";
      }

      function restartInGameMode(modeKey, opts = {}) {
        const nextMode = normalizeGameMode(modeKey);
        const preservedClasses = state.party.map((m) => m.classKey || "warrior");
        const preservedDifficulty = state.difficulty || "normal";
        const preservedDeity = state.deity || "none";
        const preservedTileset = state.tileset || "classic";

        // Restore fresh resources & clean party/inventory baseline
        resources.floors = clone(BASELINE_FLOORS);
        state.party = BASELINE_PARTY.map((member, index) => ({
          ...clone(member),
          classKey: preservedClasses[index % preservedClasses.length],
          weapon: null, armour: null, talisman: null, ring: null, amulet: null
        }));
        state.inventory = clone(BASELINE_INVENTORY);
        state.gold = 0;
        state.level = 1;
        state.experience = 0;
        state.nextLevel = 12;
        state.turnCount = 0;
        state.floorTurnCount = 0;
        state.monstersDefeated = 0;
        state.damageDealt = 0;
        state.damageTaken = 0;
        state.itemsCollected = 0;
        state.potionsUsed = 0;
        state.doorsOpened = 0;
        state.trapsDisarmed = 0;
        state.stairsTaken = 0;
        state.floorsCleared = 0;
        state.criticalHits = 0;
        state.killCombo = 0;
        state.bestCombo = 0;
        state.talentPoints = 0;
        state.talents = {};
        state.mapMarkers = [];
        state.victory = false;
        state.defeated = false;
        state.endRecorded = false;
        state.characterCreated = false;
        state.classStatsApplied = false;
        state.difficultyApplied = false;
        state.ascensionApplied = false;
        state.orbRun = false;
        state.orbRunTurns = 0;
        state.sprintWavesSpawned = 0;
        state.sprintSealed = false;
        state.runSeed = Math.floor(Math.random() * 1e9);
        state.tileset = preservedTileset;
        for (const field of [
          "hasteTurns", "mightTurns", "rageTurns", "resistanceTurns", "silenceTurns",
          "snaredTurns", "barbedTurns", "engulfedTurns", "slowedTurns", "poisonedTurns",
          "dazedTurns", "corrodedTurns", "vitrifiedTurns", "bleedingTurns", "burningTurns", "stunnedTurns"
        ]) {
          state[field] = 0;
        }
        state.effects = [];
        state.messageLog = [];
        state.lastLoggedMessage = "";
        context.saveLoadError = null;

        if (typeof beginRun === "function") {
          beginRun({
            gameMode: nextMode,
            expedition: opts.expedition || "campaign",
            classes: preservedClasses,
            difficulty: preservedDifficulty,
            deity: preservedDeity
          });
        }
        if (typeof vrInvalidateAll === "function") vrInvalidateAll();
        if (typeof render === "function") render();
        return nextMode;
      }

      function cycleGameMode(delta = 1) {
        const defs = getGameModeDefinitions();
        const curIdx = defs.findIndex((d) => d.key === normalizeGameMode(state.gameMode));
        const nextIdx = ((curIdx >= 0 ? curIdx : 0) + delta + defs.length) % defs.length;
        const nextMode = defs[nextIdx];
        restartInGameMode(nextMode.key);
        if (typeof showToast === "function") showToast(`Mode: ${nextMode.name}`);
        return nextMode.key;
      }

      Object.assign(context, {
        GAME_MODES,
        getGameModeDefinitions,
        isValidGameMode,
        normalizeGameMode,
        currentGameMode,
        isGameMode,
        setGameMode,
        modeXpScale,
        modeGoldScale,
        modeStatusLabel,
        makeSprintFloor,
        startSprintMode,
        isSprintVaultSealed,
        sprintDoorBlocks,
        onModeItemCollected,
        onModeMonsterKilled,
        restartInGameMode,
        cycleGameMode
      });
    }
  };
}());
