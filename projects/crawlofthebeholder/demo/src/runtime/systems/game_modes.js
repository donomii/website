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
        },
        foresight: {
          key: "foresight",
          name: "Foresight Tactics",
          shortName: "Foresight",
          summary: "Into the Breach tactical combat: every enemy telegraphs its next strike or step in 2D & VR, and every melee hit shoves foes into walls, hazards, traps, or friendly fire."
        },
        oldschool: {
          key: "oldschool",
          name: "Oldschool Wireframe",
          shortName: "Oldschool",
          summary: "Wizardry & Grimrock Oldschool Mode: neon green CRT phosphor vector wireframe 2D & VR geometry, automap disabled, and 1.25x XP."
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
        if (isGameMode("sprint")) return 2;
        if (isGameMode("oldschool")) return 1.25;
        return 1;
      }

      function modeGoldScale() {
        return isGameMode("sprint") ? 2 : 1;
      }

      function isWireframeStyle() {
        return state.tileset === "wireframe" || isGameMode("oldschool");
      }

      function isAutomapDisabled() {
        return isGameMode("oldschool");
      }

      function modeStatusLabel() {
        const mode = currentGameMode();
        if (mode.key === "standard") return "";
        if (mode.key === "sprint") {
          const held = typeof runesHeld === "function" ? runesHeld() : 0;
          const seal = isSprintVaultSealed() ? `Seal ${held}/3` : "Vault Open";
          return `[Sprint · ${seal}]`;
        }
        if (mode.key === "foresight") {
          const floorState = typeof currentFloorState === "function" ? currentFloorState() : null;
          const threats = (floorState?.monsters || []).filter((m) => m.hp > 0 && m.foresight && ["melee", "reach", "ranged"].includes(m.foresight.kind)).length;
          return `[Foresight · ${threats} Telegraphs]`;
        }
        if (mode.key === "oldschool") {
          return "[Oldschool · No Map]";
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

      // ── Mode 2: Foresight Tactics (Into the Breach intents + push) ────────
      function planForesightIntent(monster) {
        if (!monster || monster.hp <= 0) return null;
        if ((monster.stunnedTurns || 0) > 0 || (monster.frozenTurns || 0) > 0 || (monster.sleepingTurns || 0) > 0 || (monster.rootedTurns || 0) > 0) {
          monster.foresight = { kind: "canceled", label: "STUNNED" };
          return monster.foresight;
        }
        const distance = distanceToPlayer(monster);
        const vision = typeof monsterVisionRange === "function" ? monsterVisionRange() : 7;
        const canSee = typeof clearSightBetween === "function" ? clearSightBetween(monster, state) : distance <= vision;
        if (!monster.alerted && (distance > vision || !canSee)) {
          monster.foresight = { kind: "idle", label: "IDLE" };
          return monster.foresight;
        }
        if (distance <= vision && canSee) monster.alerted = true;
        if (distance === 1) {
          monster.foresight = {
            kind: "melee",
            dx: state.x - monster.x,
            dy: state.y - monster.y,
            dmg: monster.attack || 4,
            label: `HIT ${monster.attack || 4}`
          };
          return monster.foresight;
        }
        if (distance === 2 && monster.traits?.reachDamage && typeof clearLineToPlayer === "function" && clearLineToPlayer(monster)) {
          monster.foresight = {
            kind: "reach",
            dx: state.x - monster.x,
            dy: state.y - monster.y,
            dmg: monster.traits.reachDamage,
            label: `REACH ${monster.traits.reachDamage}`
          };
          return monster.foresight;
        }
        if (monster.ranged && (monster.silencedTurns || 0) <= 0 && typeof rangedCanTargetPlayer === "function" && rangedCanTargetPlayer(monster)) {
          const power = (monster.ranged.power || 5) + ((monster.mightTurns || 0) > 0 ? 2 : 0);
          monster.foresight = {
            kind: "ranged",
            dx: state.x - monster.x,
            dy: state.y - monster.y,
            dmg: power,
            spellName: monster.ranged.name || "bolt",
            label: `${String(monster.ranged.name || "BOLT").slice(0, 10)} ${power}`
          };
          return monster.foresight;
        }
        if (distance <= 8 && typeof monsterPathStep === "function") {
          const step = monsterPathStep(monster);
          if (step && (step.x !== state.x || step.y !== state.y)) {
            monster.foresight = { kind: "step", x: step.x, y: step.y, label: "STEP" };
            return monster.foresight;
          }
        }
        monster.foresight = { kind: "idle", label: "HOLD" };
        return monster.foresight;
      }

      function planAllForesightIntents() {
        if (!isGameMode("foresight")) return;
        const floorState = typeof currentFloorState === "function" ? currentFloorState() : null;
        if (!floorState) return;
        for (const monster of floorState.monsters || []) {
          if (monster.hp > 0) planForesightIntent(monster);
          else monster.foresight = null;
        }
      }

      function foresightResolvedTargets(monster) {
        const intent = monster?.foresight;
        if (!intent || monster.hp <= 0) return { kind: "idle", cells: [], impact: null };
        if (intent.kind === "canceled" || intent.kind === "idle") return { kind: intent.kind, cells: [], impact: null };
        if (intent.kind === "step") {
          return { kind: "step", cells: [{ x: intent.x, y: intent.y }], impact: { x: intent.x, y: intent.y } };
        }
        if (intent.kind === "melee") {
          const tx = monster.x + intent.dx;
          const ty = monster.y + intent.dy;
          const cells = typeof mapContains === "function" && mapContains(tx, ty) ? [{ x: tx, y: ty }] : [];
          return { kind: "melee", cells, impact: cells[0] || null };
        }
        if (intent.kind === "reach" || intent.kind === "ranged") {
          const endX = monster.x + intent.dx;
          const endY = monster.y + intent.dy;
          const raw = typeof lineCells === "function" ? lineCells(monster, { x: endX, y: endY }) : [{ x: endX, y: endY }];
          const cells = [];
          let impact = null;
          for (const pt of raw) {
            if (pt.x === monster.x && pt.y === monster.y) continue;
            if (typeof mapContains === "function" && !mapContains(pt.x, pt.y)) break;
            cells.push(pt);
            impact = pt;
            if (solidAt(pt.x, pt.y)) break;
            if ((pt.x === state.x && pt.y === state.y) || monsterAt(pt.x, pt.y)) break;
          }
          return { kind: intent.kind, cells, impact };
        }
        return { kind: "idle", cells: [], impact: null };
      }

      function foresightThreatCells() {
        const attacks = new Map();
        const steps = new Map();
        if (!isGameMode("foresight")) return { attacks, steps };
        const floorState = typeof currentFloorState === "function" ? currentFloorState() : null;
        if (!floorState) return { attacks, steps };
        for (const monster of floorState.monsters || []) {
          if (monster.hp <= 0 || !monster.foresight) continue;
          const resolved = foresightResolvedTargets(monster);
          if (["melee", "reach", "ranged"].includes(resolved.kind)) {
            for (const cell of resolved.cells) {
              const k = keyOf(cell.x, cell.y);
              if (!attacks.has(k)) attacks.set(k, []);
              attacks.get(k).push({
                monster,
                kind: resolved.kind,
                dmg: monster.foresight.dmg || 4,
                label: monster.foresight.label,
                isImpact: resolved.impact && cell.x === resolved.impact.x && cell.y === resolved.impact.y
              });
            }
          } else if (resolved.kind === "step") {
            for (const cell of resolved.cells) {
              const k = keyOf(cell.x, cell.y);
              if (!steps.has(k)) steps.set(k, []);
              steps.get(k).push({ monster, label: monster.foresight.label });
            }
          }
        }
        return { attacks, steps };
      }

      function foresightShoveMonster(target, fromX = state.x, fromY = state.y) {
        if (!isGameMode("foresight") || !target || target.hp <= 0 || target.traits?.stationary) return "";
        const dx = Math.sign(target.x - fromX);
        const dy = Math.sign(target.y - fromY);
        if (dx === 0 && dy === 0) return "";
        const bx = target.x + dx;
        const by = target.y + dy;
        const slam = Math.max(3, Math.ceil((target.maxHp || 10) / 8));
        if (!mapContains(bx, by) || solidAt(bx, by)) {
          target.hp = Math.max(0, target.hp - slam);
          target.stunnedTurns = Math.max(target.stunnedTurns || 0, 1);
          target.foresight = { kind: "canceled", label: "STUNNED" };
          if (typeof addDamageMark === "function") addDamageMark(target, null, slam);
          if (typeof addEffect === "function") addEffect("impact", [{ x: target.x, y: target.y }]);
          const note = ` ${target.name} slams into stone for ${slam} and is stunned!`;
          if (target.hp === 0 && typeof killMonster === "function") return `${note} ${killMonster(target)}`.trimEnd();
          return note;
        }
        const other = monsterAt(bx, by);
        if (other) {
          target.hp = Math.max(0, target.hp - slam);
          other.hp = Math.max(0, other.hp - slam);
          other.alerted = true;
          if (typeof addDamageMark === "function") {
            addDamageMark(target, null, slam);
            addDamageMark(other, null, slam);
          }
          if (typeof addEffect === "function") addEffect("impact", [{ x: target.x, y: target.y }, { x: other.x, y: other.y }]);
          const notes = [` ${target.name} crashes into ${other.name} for ${slam} each!`];
          if (target.hp === 0 && typeof killMonster === "function") notes.push(killMonster(target));
          if (other.hp === 0 && typeof killMonster === "function") notes.push(killMonster(other));
          return notes.join(" ");
        }
        if (bx === state.x && by === state.y) return "";
        target.x = bx;
        target.y = by;
        const terrain = terrainAt(bx, by);
        if (terrain === "lava" || terrain === "deep-water") {
          const drop = Math.max(6, Math.ceil((target.maxHp || 12) / 2));
          target.hp = Math.max(0, target.hp - drop);
          if (typeof addDamageMark === "function") addDamageMark(target, terrain === "lava" ? "fire" : "cold", drop);
          const note = ` ${target.name} is shoved into ${terrain === "lava" ? "lava" : "deep water"} for ${drop}!`;
          if (target.hp === 0 && typeof killMonster === "function") return `${note} ${killMonster(target)}`.trimEnd();
          return note;
        }
        const trap = currentFloorState().traps?.find((t) => t.armed && t.x === bx && t.y === by);
        if (trap) {
          trap.armed = false;
          const trapDmg = Math.max(4, trap.power || 8);
          target.hp = Math.max(0, target.hp - trapDmg);
          target.foresight = { kind: "canceled", label: "TRAPPED" };
          if (typeof addDamageMark === "function") addDamageMark(target, null, trapDmg);
          if (typeof addEffect === "function") addEffect("impact", [{ x: bx, y: by }]);
          const note = ` ${target.name} is shoved onto ${trap.name} for ${trapDmg}!`;
          if (target.hp === 0 && typeof killMonster === "function") return `${note} ${killMonster(target)}`.trimEnd();
          return note;
        }
        return ` ${target.name} is shoved!`;
      }

      function executeForesightMonsterAction(monster, floorState, messages) {
        if (!isGameMode("foresight") || !monster.foresight) return null;
        const intent = monster.foresight;
        const discovered = floorState.discovered.has(keyOf(monster.x, monster.y));
        if (intent.kind === "canceled") {
          if (discovered) messages.push(`${monster.name}'s action was canceled.`);
          return false;
        }
        if (intent.kind === "idle") return false;
        if (intent.kind === "melee" || intent.kind === "reach") {
          const tx = monster.x + intent.dx;
          const ty = monster.y + intent.dy;
          if (tx === state.x && ty === state.y) {
            return monsterMelee(monster, messages);
          }
          const victim = monsterAt(tx, ty);
          if (victim && victim !== monster) {
            const dmg = Math.max(2, intent.dmg || monster.attack || 4);
            victim.hp = Math.max(0, victim.hp - dmg);
            if (typeof addDamageMark === "function") addDamageMark(victim, null, dmg);
            if (typeof addEffect === "function") addEffect("impact", [{ x: tx, y: ty }]);
            if (discovered || floorState.discovered.has(keyOf(tx, ty))) {
              messages.push(`${monster.name}'s telegraphed strike hits ${victim.name} for ${dmg}!`);
            }
            if (victim.hp === 0 && typeof killMonster === "function") messages.push(killMonster(victim));
            return false;
          }
          if (typeof addEffect === "function" && mapContains(tx, ty)) addEffect("impact", [{ x: tx, y: ty }]);
          if (discovered) messages.push(`${monster.name}'s telegraphed strike misses empty air!`);
          return false;
        }
        if (intent.kind === "ranged") {
          const resolved = foresightResolvedTargets(monster);
          const impact = resolved.impact;
          const effectKind = typeof spellEffectKind === "function" ? spellEffectKind(monster.ranged || {}) : "magic";
          if (resolved.cells.length > 0 && typeof addEffect === "function") addEffect(effectKind, resolved.cells);
          if (!impact || solidAt(impact.x, impact.y)) {
            if (discovered) messages.push(`${monster.name}'s ${intent.spellName} hits the wall!`);
            return false;
          }
          const victim = monsterAt(impact.x, impact.y);
          if (victim && victim !== monster) {
            const dmg = Math.max(2, intent.dmg || 5);
            victim.hp = Math.max(0, victim.hp - dmg);
            if (typeof addDamageMark === "function") addDamageMark(victim, monster.ranged?.element || null, dmg);
            if (discovered || floorState.discovered.has(keyOf(impact.x, impact.y))) {
              messages.push(`${monster.name}'s ${intent.spellName} blasts ${victim.name} for ${dmg}!`);
            }
            if (victim.hp === 0 && typeof killMonster === "function") messages.push(killMonster(victim));
            return false;
          }
          if (impact.x === state.x && impact.y === state.y) {
            const defender = liveMember();
            const rangedPower = Math.max(1, intent.dmg || 5);
            const hit = typeof hurtLiveMember === "function" ? hurtLiveMember(rangedPower, 2, monster.ranged?.element, monster) : { defender, damage: 0 };
            if (!hit) return true;
            if (monster.ranged?.cloud && typeof spreadCloud === "function") spreadCloud(monster.ranged.cloud, 4, cellsNear(state, 1));
            messages.push(`${monster.name}'s ${intent.spellName} hits ${hit.defender.name} for ${hit.damage}.`);
            if (!liveMember()) {
              state.defeated = true;
              state.message = `${hit.defender.name} falls. The dungeon takes the party.`;
              return true;
            }
            return false;
          }
          if (discovered) messages.push(`${monster.name}'s ${intent.spellName} streaks wide!`);
          return false;
        }
        if (intent.kind === "step") {
          if (typeof monsterCanMoveTo === "function" && monsterCanMoveTo(monster, intent.x, intent.y)) {
            monster.x = intent.x;
            monster.y = intent.y;
            if (typeof triggerPlayerTrap === "function") triggerPlayerTrap(monster, messages);
            return false;
          }
          return null;
        }
        return null;
      }

      function onModeRunStarted() {
        if (isGameMode("foresight")) planAllForesightIntents();
      }

      function onModeTurnEnd() {
        if (isGameMode("foresight")) planAllForesightIntents();
      }

      function onModeFloorEntered() {
        if (isGameMode("foresight")) planAllForesightIntents();
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
        isWireframeStyle,
        isAutomapDisabled,
        modeStatusLabel,
        makeSprintFloor,
        startSprintMode,
        isSprintVaultSealed,
        sprintDoorBlocks,
        onModeItemCollected,
        onModeMonsterKilled,
        restartInGameMode,
        cycleGameMode,
        planForesightIntent,
        planAllForesightIntents,
        foresightResolvedTargets,
        foresightThreatCells,
        foresightShoveMonster,
        executeForesightMonsterAction,
        onModeRunStarted,
        onModeTurnEnd,
        onModeFloorEntered
      });
    }
  };
}());
