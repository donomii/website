(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPersistence = function (context) {
    with (context) {
      const SAVE_KEY = "cotb-save";
      const SAVE_SLOTS = ["cotb-save", "cotb-save-slot-2", "cotb-save-slot-3"];
      const META_KEY = "cotb-meta";
      const SETTINGS_KEY = "cotb-settings";
      const SAVE_SCHEMA = 2;
      const META_SCHEMA = 1;
      const ACHIEVEMENTS = [
        { id: "first_floor", name: "Step into the deep", description: "Descend below D:1." },
        { id: "first_kill", name: "First blood", description: "Defeat any monster." },
        { id: "first_crit", name: "Lightning bite", description: "Land a critical hit." },
        { id: "ten_kills", name: "Cleaver", description: "Defeat 10 monsters in one run." },
        { id: "hundred_kills", name: "Reaper", description: "Defeat 100 monsters in one run." },
        { id: "deep_diver", name: "Deep diver", description: "Reach D:5 or deeper." },
        { id: "branch_visitor", name: "Mycologist", description: "Visit a non-D branch (Lair, Orc, Swamp, etc.)." },
        { id: "orb_held", name: "Burden of light", description: "Pick up the Orb of Zot Soup." },
        { id: "victorious", name: "Survivor", description: "Escape the dungeon alive." },
        { id: "rich", name: "Heavy purse", description: "Accumulate 500 gold in a single run." },
        { id: "boss_slayer", name: "Champion's bane", description: "Defeat a branch champion." },
        { id: "identifier", name: "Sage", description: "Identify any item." },
        { id: "uncursed", name: "Cleanse", description: "Remove a curse from your gear." },
        { id: "enchanter", name: "Forgesong", description: "Enchant a weapon or armour at a merchant." },
        { id: "stealthy", name: "Unseen", description: "Pass within sight of a monster without alerting it." },
        { id: "famished", name: "Iron rations", description: "Survive a turn while famished." },
        { id: "talent_spent", name: "Trained", description: "Spend a talent point." },
        { id: "merchant", name: "Patron", description: "Buy at least one item from a merchant." },
        { id: "secret_finder", name: "Wallseeker", description: "Reveal a hidden passage." },
        { id: "daily_runner", name: "Daily climber", description: "Finish a run on a daily seed." }
      ];
      const STATUS_FIELDS = [
        "hasteTurns",
        "mightTurns",
        "rageTurns",
        "resistanceTurns",
        "silenceTurns",
        "snaredTurns",
        "barbedTurns",
        "engulfedTurns",
        "slowedTurns",
        "poisonedTurns",
        "dazedTurns",
        "corrodedTurns",
        "vitrifiedTurns"
      ];

      function safeStorage() {
        try {
          return window.localStorage || null;
        } catch (error) {
          return null;
        }
      }

      function serializeFloorState(floorState) {
        return {
          openedDoors: [...floorState.openedDoors],
          discovered: [...floorState.discovered],
          usedDecor: [...(floorState.usedDecor || new Set())],
          floorItems: floorState.floorItems.map((item) => ({ ...item })),
          traps: floorState.traps.map((trap) => ({ ...trap })),
          clouds: floorState.clouds.map((cloud) => ({ ...cloud })),
          floorMarks: (floorState.floorMarks || []).map((mark) => ({ ...mark })),
          monsters: floorState.monsters.map((monster) => ({ ...monster })),
          allies: (floorState.allies || []).map((a) => ({ ...a })),
          pendingArrivals: (floorState.pendingArrivals || []).map((m) => ({ ...m })),
          shopStock: floorState.shopStock ? floorState.shopStock.map((entry) => ({ ...entry })) : null,
          hiddenPassages: floorState.hiddenPassages ? [...floorState.hiddenPassages] : null
        };
      }

      function deserializeFloorState(saved) {
        return {
          openedDoors: new Set(saved.openedDoors || []),
          discovered: new Set(saved.discovered || []),
          usedDecor: new Set(saved.usedDecor || []),
          floorItems: (saved.floorItems || []).map((item) => ({ ...item })),
          traps: (saved.traps || []).map((trap) => ({ ...trap })),
          clouds: (saved.clouds || []).map((cloud) => ({ ...cloud })),
          floorMarks: (saved.floorMarks || []).map((mark) => ({ ...mark })),
          monsters: (saved.monsters || []).map((monster) => ({ ...monster })),
          allies: (saved.allies || []).map((a) => ({ ...a })),
          pendingArrivals: (saved.pendingArrivals || []).map((m) => ({ ...m })),
          shopStock: saved.shopStock ? saved.shopStock.map((entry) => ({ ...entry })) : null,
          hiddenPassages: saved.hiddenPassages ? [...saved.hiddenPassages] : null
        };
      }

      function cloneEquipment(item) {
        return item ? { ...item } : null;
      }

      function serializeParty() {
        return state.party.map((member) => ({
          ...member,
          classKey: member.classKey || null,
          signatureCooldown: member.signatureCooldown || 0,
          weapon: cloneEquipment(member.weapon),
          armour: cloneEquipment(member.armour),
          talisman: cloneEquipment(member.talisman),
          ring: cloneEquipment(member.ring),
          amulet: cloneEquipment(member.amulet)
        }));
      }

      function serializeState() {
        const statuses = {};
        for (const field of STATUS_FIELDS) statuses[field] = state[field] || 0;
        return {
          schema: SAVE_SCHEMA,
          version: resources.version,
          floorIndex: state.floorIndex,
          x: state.x,
          y: state.y,
          dir: state.dir,
          gold: state.gold,
          lootSerial: state.lootSerial,
          summonSerial: state.summonSerial,
          level: state.level,
          experience: state.experience,
          nextLevel: state.nextLevel,
          turnCount: state.turnCount,
          floorTurnCount: state.floorTurnCount || 0,
          monstersDefeated: state.monstersDefeated || 0,
          victory: state.victory,
          defeated: state.defeated,
          message: state.message,
          lastLoggedMessage: state.lastLoggedMessage,
          messageLog: [...state.messageLog],
          statuses,
          characterCreated: !!state.characterCreated,
          classStatsApplied: !!state.classStatsApplied,
          difficulty: state.difficulty || "normal",
          deity: state.deity || "none",
          piety: state.piety || 0,
          dailySeed: state.dailySeed || null,
          identifiedKinds: state.identifiedKinds ? [...state.identifiedKinds] : [],
          satiety: state.satiety ?? 1000,
          talentPoints: state.talentPoints || 0,
          talents: { ...(state.talents || {}) },
          mapMarkers: (state.mapMarkers || []).map((m) => ({ ...m })),
          bestiary: state.bestiary ? JSON.parse(JSON.stringify(state.bestiary)) : {},
          bestiarySeenIds: state.bestiarySeenIds ? [...state.bestiarySeenIds] : [],
          goldSpent: state.goldSpent || 0,
          visitedBranches: state.visitedBranches ? [...state.visitedBranches] : [],
          claimedQuests: { ...(state.claimedQuests || {}) },
          autoPickup: state.autoPickup !== false,
          killCombo: state.killCombo || 0,
          bestCombo: state.bestCombo || 0,
          ascension: state.ascension || 0,
          ascensionApplied: !!state.ascensionApplied,
          luckBonus: state.luckBonus || 0,
          inventory: state.inventory.map((item) => ({ ...item })),
          party: serializeParty(),
          floors: state.floors.map(serializeFloorState),
          maps: resources.floors.map((floor) => [...floor.map.rows]),
          // Full per-floor geometry, so procedurally generated worlds (whose
          // dimensions/start/stairs differ from the baked floors) resume exactly.
          worldFloors: resources.floors.map((floor) => ({
            map: { name: floor.map.name, width: floor.map.width, height: floor.map.height, rows: [...floor.map.rows], source: floor.map.source },
            start: { ...floor.start },
            doors: [...(floor.doors || [])],
            stairs: {
              up: floor.stairs.up ? { ...floor.stairs.up } : null,
              down: floor.stairs.down ? { ...floor.stairs.down } : null
            },
            decor: (floor.decor || []).map((d) => ({ ...d }))
          }))
        };
      }

      function applyState(saved) {
        state.floorIndex = saved.floorIndex;
        state.x = saved.x;
        state.y = saved.y;
        state.dir = saved.dir;
        state.gold = saved.gold;
        state.lootSerial = saved.lootSerial || 0;
        state.summonSerial = saved.summonSerial || 0;
        state.level = saved.level || 1;
        state.experience = saved.experience || 0;
        state.nextLevel = saved.nextLevel || 12;
        state.turnCount = saved.turnCount || 0;
        state.floorTurnCount = saved.floorTurnCount || 0;
        state.monstersDefeated = saved.monstersDefeated || 0;
        state.victory = !!saved.victory;
        state.defeated = !!saved.defeated;
        state.message = saved.message || "";
        state.lastLoggedMessage = saved.lastLoggedMessage || "";
        state.messageLog = saved.messageLog ? [...saved.messageLog] : [];
        state.characterCreated = !!saved.characterCreated;
        state.classStatsApplied = !!saved.classStatsApplied;
        state.difficulty = saved.difficulty || "normal";
        state.deity = saved.deity || "none";
        state.piety = saved.piety || 0;
        state.dailySeed = saved.dailySeed || null;
        state.identifiedKinds = new Set(saved.identifiedKinds || []);
        state.satiety = typeof saved.satiety === "number" ? saved.satiety : 1000;
        state.talentPoints = saved.talentPoints || 0;
        state.talents = { ...(saved.talents || {}) };
        state.mapMarkers = (saved.mapMarkers || []).map((m) => ({ ...m }));
        state.bestiary = saved.bestiary ? JSON.parse(JSON.stringify(saved.bestiary)) : {};
        state.bestiarySeenIds = new Set(saved.bestiarySeenIds || []);
        state.goldSpent = saved.goldSpent || 0;
        state.visitedBranches = new Set(saved.visitedBranches || []);
        state.claimedQuests = { ...(saved.claimedQuests || {}) };
        state.autoPickup = saved.autoPickup !== false;
        state.killCombo = saved.killCombo || 0;
        state.bestCombo = saved.bestCombo || 0;
        state.ascension = saved.ascension || 0;
        state.ascensionApplied = !!saved.ascensionApplied;
        state.luckBonus = saved.luckBonus || 0;
        for (const field of STATUS_FIELDS) state[field] = (saved.statuses || {})[field] || 0;
        state.inventory = (saved.inventory || []).map((item) => ({ ...item }));
        state.party = (saved.party || []).map((member) => ({
          ...member,
          weapon: cloneEquipment(member.weapon),
          armour: cloneEquipment(member.armour),
          talisman: cloneEquipment(member.talisman),
          ring: cloneEquipment(member.ring),
          amulet: cloneEquipment(member.amulet)
        }));
        state.floors = (saved.floors || []).map(deserializeFloorState);
        state.effects = [];
        // Prefer full geometry (handles generated worlds whose dimensions differ
        // from the baked floors); fall back to the legacy rows-only `maps`.
        if (Array.isArray(saved.worldFloors) && saved.worldFloors.length) {
          for (let index = 0; index < resources.floors.length && index < saved.worldFloors.length; index += 1) {
            const wf = saved.worldFloors[index];
            const floor = resources.floors[index];
            if (!wf || !wf.map) continue;
            floor.map.rows = [...wf.map.rows];
            floor.map.width = wf.map.width;
            floor.map.height = wf.map.height;
            floor.start = { ...wf.start };
            floor.doors = [...(wf.doors || [])];
            floor.stairs = {
              up: wf.stairs && wf.stairs.up ? { ...wf.stairs.up } : null,
              down: wf.stairs && wf.stairs.down ? { ...wf.stairs.down } : null
            };
            floor.decor = (wf.decor || []).map((d) => ({ ...d }));
          }
        } else if (Array.isArray(saved.maps)) {
          for (let index = 0; index < resources.floors.length; index += 1) {
            if (Array.isArray(saved.maps[index])) {
              resources.floors[index].map.rows = [...saved.maps[index]];
            }
          }
        }
      }

      function saveGame() {
        const storage = safeStorage();
        if (!storage) return false;
        try {
          storage.setItem(state.activeSlot || SAVE_KEY, JSON.stringify(serializeState()));
          return true;
        } catch (error) {
          return false;
        }
      }

      function readSave() {
        const storage = safeStorage();
        if (!storage) return null;
        try {
          const raw = storage.getItem(state.activeSlot || SAVE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.schema !== SAVE_SCHEMA) return null;
          if (parsed.version && parsed.version !== resources.version) return null;
          return parsed;
        } catch (error) {
          return null;
        }
      }

      function loadGame() {
        const saved = readSave();
        if (!saved) return false;
        try {
          applyState(saved);
          return true;
        } catch (error) {
          return false;
        }
      }

      function clearSave() {
        const storage = safeStorage();
        if (!storage) return;
        try {
          storage.removeItem(SAVE_KEY);
        } catch (error) {
          // ignore
        }
      }

      function newRun() {
        clearSave();
        if (typeof window.location?.reload === "function") {
          window.location.reload();
        }
      }

      function readMeta() {
        const storage = safeStorage();
        if (!storage) return { schema: META_SCHEMA, runs: [], best: null, achievements: [] };
        try {
          const raw = storage.getItem(META_KEY);
          if (!raw) return { schema: META_SCHEMA, runs: [], best: null, achievements: [] };
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.schema !== META_SCHEMA) return { schema: META_SCHEMA, runs: [], best: null, achievements: [] };
          return parsed;
        } catch (error) {
          return { schema: META_SCHEMA, runs: [], best: null, achievements: [] };
        }
      }

      function writeMeta(meta) {
        const storage = safeStorage();
        if (!storage) return false;
        try {
          storage.setItem(META_KEY, JSON.stringify({ ...meta, schema: META_SCHEMA }));
          return true;
        } catch (error) {
          return false;
        }
      }

      function readSettings() {
        const storage = safeStorage();
        if (!storage) return {};
        try {
          const raw = storage.getItem(SETTINGS_KEY);
          if (!raw) return {};
          return JSON.parse(raw) || {};
        } catch (error) {
          return {};
        }
      }

      function writeSettings(settings) {
        const storage = safeStorage();
        if (!storage) return false;
        try {
          storage.setItem(SETTINGS_KEY, JSON.stringify(settings || {}));
          return true;
        } catch (error) {
          return false;
        }
      }

      function getAchievements() {
        return ACHIEVEMENTS.slice();
      }

      function unlockedAchievements() {
        const meta = readMeta();
        return new Set(meta.achievements || []);
      }

      function unlockAchievement(id) {
        const meta = readMeta();
        const set = new Set(meta.achievements || []);
        if (set.has(id)) return false;
        set.add(id);
        meta.achievements = [...set];
        writeMeta(meta);
        return true;
      }

      function evaluateAchievements() {
        const fresh = [];
        if (state.floorIndex >= 1 && unlockAchievement("first_floor")) fresh.push("first_floor");
        if ((state.monstersDefeated || 0) >= 1 && unlockAchievement("first_kill")) fresh.push("first_kill");
        if ((state.criticalHits || 0) >= 1 && unlockAchievement("first_crit")) fresh.push("first_crit");
        if ((state.monstersDefeated || 0) >= 10 && unlockAchievement("ten_kills")) fresh.push("ten_kills");
        if ((state.monstersDefeated || 0) >= 100 && unlockAchievement("hundred_kills")) fresh.push("hundred_kills");
        if (state.floorIndex >= 4 && unlockAchievement("deep_diver")) fresh.push("deep_diver");
        const branchId = currentFloor().id || "";
        if (/^[A-Z]/.test(branchId) && !branchId.startsWith("D:") && unlockAchievement("branch_visitor")) fresh.push("branch_visitor");
        if (state.inventory.some((item) => item.kind === "quest") && unlockAchievement("orb_held")) fresh.push("orb_held");
        if (state.victory && unlockAchievement("victorious")) fresh.push("victorious");
        if ((state.gold || 0) >= 500 && unlockAchievement("rich")) fresh.push("rich");
        // Newer trigger conditions tied to recent systems.
        if (state.identifiedKinds && state.identifiedKinds.size > 0 && unlockAchievement("identifier")) fresh.push("identifier");
        if (state.curseRemoved && unlockAchievement("uncursed")) fresh.push("uncursed");
        if (state.enchantedSomething && unlockAchievement("enchanter")) fresh.push("enchanter");
        if (state.satiety <= 0 && unlockAchievement("famished")) fresh.push("famished");
        if (state.talents && Object.values(state.talents).some((v) => v > 0) && unlockAchievement("talent_spent")) fresh.push("talent_spent");
        if (state.boughtFromShop && unlockAchievement("merchant")) fresh.push("merchant");
        if (state.revealedHiddenPassage && unlockAchievement("secret_finder")) fresh.push("secret_finder");
        if (state.bossKilled && unlockAchievement("boss_slayer")) fresh.push("boss_slayer");
        if (state.victory && state.dailySeed && unlockAchievement("daily_runner")) fresh.push("daily_runner");
        return fresh;
      }

      // Save slot management.
      function getActiveSlot() {
        return state.activeSlot || SAVE_SLOTS[0];
      }

      function setActiveSlot(slotKey) {
        if (!SAVE_SLOTS.includes(slotKey)) return false;
        // Save current game to current slot before swapping.
        const previous = getActiveSlot();
        try {
          const storage = safeStorage();
          if (storage) {
            storage.setItem(previous, JSON.stringify(serializeState()));
          }
        } catch (e) {}
        state.activeSlot = slotKey;
        // Load destination slot if it exists.
        const storage = safeStorage();
        if (storage) {
          const raw = storage.getItem(slotKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.schema === SAVE_SCHEMA) {
                applyState(parsed);
                if (typeof render === "function") render();
                return true;
              }
            } catch (e) {}
          }
        }
        // Otherwise we've selected an empty slot; clear and let main.js's flow
        // re-show character creation on next render.
        return true;
      }

      function readSlotSummary(slotKey) {
        const storage = safeStorage();
        if (!storage) return null;
        try {
          const raw = storage.getItem(slotKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || parsed.schema !== SAVE_SCHEMA) return null;
          return {
            floorId: parsed.floors && parsed.floorIndex >= 0 ? (parsed.floorIndex + 1) : "?",
            turnCount: parsed.turnCount || 0,
            gold: parsed.gold || 0,
            level: parsed.level || 1,
            difficulty: parsed.difficulty || "normal",
            victory: !!parsed.victory,
            defeated: !!parsed.defeated
          };
        } catch (e) {
          return null;
        }
      }

      function readSlotSummaries() {
        return SAVE_SLOTS.map((slot, idx) => ({ slot, index: idx + 1, summary: readSlotSummary(slot) }));
      }

      function recordRunResult() {
        const meta = readMeta();
        // New Game+: each victory raises the ascension tier for future runs.
        if (state.victory) {
          meta.ascension = Math.max(meta.ascension || 0, (state.ascension || 0) + 1);
        }
        const summary = {
          finishedAt: Date.now(),
          outcome: state.victory ? "victory" : state.defeated ? "defeat" : "abandoned",
          floor: currentFloor().id,
          floorIndex: state.floorIndex,
          turns: state.turnCount,
          gold: state.gold,
          level: state.level,
          monstersDefeated: state.monstersDefeated || 0,
          damageDealt: state.damageDealt || 0,
          damageTaken: state.damageTaken || 0,
          orb: state.inventory.some((item) => item.kind === "quest") || !!state.victory,
          durationMs: Math.max(0, Date.now() - (state.runStartedAt || Date.now()))
        };
        meta.runs = [summary, ...(meta.runs || [])].slice(0, 20);
        const previousBest = meta.best;
        const score = computeRunScore(summary);
        summary.score = score;
        if (!previousBest || score > (previousBest.score || 0)) meta.best = summary;
        // Lifetime totals across every recorded run.
        const lifetime = meta.lifetime || {
          runs: 0, victories: 0, defeats: 0,
          kills: 0, gold: 0, damageDealt: 0, damageTaken: 0,
          deepestFloor: 0, playMs: 0, bestScore: 0
        };
        lifetime.runs += 1;
        if (summary.outcome === "victory") lifetime.victories += 1;
        if (summary.outcome === "defeat") lifetime.defeats += 1;
        lifetime.kills += summary.monstersDefeated || 0;
        lifetime.gold += summary.gold || 0;
        lifetime.damageDealt += summary.damageDealt || 0;
        lifetime.damageTaken += summary.damageTaken || 0;
        lifetime.deepestFloor = Math.max(lifetime.deepestFloor || 0, summary.floorIndex || 0);
        lifetime.playMs += summary.durationMs || 0;
        lifetime.bestScore = Math.max(lifetime.bestScore || 0, score);
        meta.lifetime = lifetime;
        writeMeta(meta);
        return summary;
      }

      function lifetimeStats() {
        const meta = readMeta();
        return meta.lifetime || {
          runs: 0, victories: 0, defeats: 0,
          kills: 0, gold: 0, damageDealt: 0, damageTaken: 0,
          deepestFloor: 0, playMs: 0, bestScore: 0
        };
      }

      function computeRunScore(summary) {
        let score = (summary.gold || 0) + (summary.monstersDefeated || 0) * 10 + (summary.floorIndex || 0) * 50;
        if (summary.orb) score += 500;
        if (summary.outcome === "victory") score += 1000;
        score -= Math.min(500, Math.round((summary.turns || 0) / 10));
        return Math.max(0, score);
      }

      function buildRunSummaryText() {
        const floor = currentFloor();
        const outcome = state.victory ? "Victory" : state.defeated ? "Defeat" : "In progress";
        const score = computeRunScore({
          gold: state.gold || 0,
          monstersDefeated: state.monstersDefeated || 0,
          floorIndex: state.floorIndex || 0,
          orb: state.inventory.some((item) => item.kind === "quest") || !!state.victory,
          outcome: state.victory ? "victory" : state.defeated ? "defeat" : "abandoned",
          turns: state.turnCount || 0
        });
        const classes = state.party.filter((m) => m.classKey).map((m) => m.classKey).join("/") || "—";
        const daily = state.dailySeed ? ` · daily ${state.dailySeed}` : "";
        const lines = [
          `Crawl of the Beholder — ${outcome} on ${floor.id} (${state.floorIndex + 1}/${resources.floors.length})`,
          `Turns ${state.turnCount || 0} · Score ${score} · ${classes} · ${state.difficulty || "normal"}${daily}`,
          `🐉 ${state.monstersDefeated || 0} kills · ${state.gold || 0} gold · ${state.criticalHits || 0} crits`,
          `Damage dealt ${state.damageDealt || 0} / taken ${state.damageTaken || 0}`,
          state.victory ? "Orb of Zot Soup recovered ✨" : state.inventory.some((i) => i.kind === "quest") ? "Orb in hand but never escaped" : "Orb still below"
        ];
        return lines.join("\n");
      }

      function copyRunSummary() {
        const text = buildRunSummaryText();
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
            if (typeof showToast === "function") showToast("Run summary copied to clipboard.");
            return true;
          }
        } catch (e) {}
        if (typeof showToast === "function") showToast("Copy failed; summary in console.");
        try { console.log(text); } catch (e) {}
        return false;
      }

      function dailySeed() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      }

      Object.assign(context, {
        SAVE_SLOTS,
        saveGame,
        loadGame,
        readSave,
        clearSave,
        newRun,
        serializeState,
        applyState,
        readMeta,
        writeMeta,
        readSettings,
        writeSettings,
        getAchievements,
        unlockedAchievements,
        unlockAchievement,
        evaluateAchievements,
        recordRunResult,
        lifetimeStats,
        computeRunScore,
        buildRunSummaryText,
        copyRunSummary,
        dailySeed,
        getActiveSlot,
        setActiveSlot,
        readSlotSummary,
        readSlotSummaries
      });
    }
  };
}());
