(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Startup options — boot the game straight into a chosen state instead of
  // clicking through character creation. Driven by URL query params (which the
  // launcher forwards from its own command-line flags), e.g.
  //   index.html?new                       → skip the menu, default party
  //   index.html?floor=Zot:1&reveal        → jump to the Zot sanctum, map shown
  //   index.html?classes=warrior,warrior,rogue,mage&difficulty=hard
  //   index.html?seed=12345   /  ?daily    → a procedural run
  //   index.html?floor=7&pos=3,4,1         → floor + exact tile/facing
  window.CotBRuntime.installDevOptions = function installDevOptions(context) {
    with (context) {
      const TRIGGER_KEYS = ["new", "autostart", "play", "floor", "classes", "seed", "daily", "difficulty", "deity", "pos"];

      function parseStartupOptions(search) {
        const raw = search != null ? search : (typeof location !== "undefined" ? location.search : "");
        const params = new URLSearchParams(raw || "");
        const opts = {};
        opts.autostart = TRIGGER_KEYS.some((key) => params.has(key));
        if (params.has("classes")) opts.classes = params.get("classes").split(",").map((s) => s.trim()).filter(Boolean);
        if (params.has("difficulty")) opts.difficulty = params.get("difficulty");
        if (params.has("deity")) opts.deity = params.get("deity");
        if (params.has("seed")) opts.seed = params.get("seed");
        opts.daily = params.has("daily");
        if (params.has("floor")) opts.floor = params.get("floor");
        if (params.has("pos")) opts.pos = params.get("pos");
        opts.reveal = params.has("reveal") || params.has("revealall");
        return opts;
      }

      // Resolve a floor reference: a numeric index, a branch id ("Zot:1"), or a
      // substring of the floor's name.
      function resolveFloorIndex(target) {
        if (target == null) return null;
        const floors = resources.floors;
        if (/^\d+$/.test(String(target))) {
          const index = Number(target);
          return index >= 0 && index < floors.length ? index : null;
        }
        const needle = String(target).toLowerCase();
        let index = floors.findIndex((floor) => (floor.id || "").toLowerCase() === needle);
        if (index < 0) index = floors.findIndex((floor) => (floor.id || "").toLowerCase().startsWith(needle));
        if (index < 0) index = floors.findIndex((floor) => (floor.name || "").toLowerCase().includes(needle));
        return index >= 0 ? index : null;
      }

      function goToFloor(target) {
        const index = resolveFloorIndex(target);
        if (index == null) return false;
        state.floorIndex = index;
        const floor = currentFloor();
        const landing = floor.start || (floor.stairs && floor.stairs.up) || { x: 1, y: 1, dir: 1 };
        state.x = landing.x;
        state.y = landing.y;
        state.dir = landing.dir != null ? landing.dir : 1;
        state.floorTurnCount = 0;
        if (typeof reveal === "function") reveal();
        return true;
      }

      function applyStartPosition(spec) {
        const parts = String(spec).split(",").map((n) => parseInt(n, 10));
        if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return false;
        state.x = parts[0];
        state.y = parts[1];
        if (parts.length >= 3 && Number.isFinite(parts[2])) state.dir = ((parts[2] % 4) + 4) % 4;
        if (typeof reveal === "function") reveal();
        return true;
      }

      // Configure and start a run without the character-create modal. Shared by
      // that modal's Start button (no config → use the on-screen selections) and
      // the URL/CLI options.
      function beginRun(config = {}) {
        if (state.characterCreated || context.saveLoadError) {
          setMessage(context.saveLoadError || "The party's classes and actions are fixed for this run. Start a new expedition to choose another party.");
          return false;
        } else if (config.classes && (!Array.isArray(config.classes) || config.classes.length === 0 || config.classes.some((key) => !getClassDefinitions().some((definition) => definition.key === key)))) {
          setMessage(`Cannot begin expedition: unsupported classes ${JSON.stringify(config.classes)}. Choose warrior, rogue, or mage; the healer is no longer available.`);
          return false;
        } else {
          ensureClassAssignments();
        }
        if (config.classes && config.classes.length && typeof getClassDefinitions === "function") {
          const valid = new Set(getClassDefinitions().map((definition) => definition.key));
          state.party.forEach((member, index) => {
            const key = config.classes[index % config.classes.length];
            if (valid.has(key)) member.classKey = key;
          });
        }
        if (config.difficulty && typeof setDifficulty === "function") setDifficulty(config.difficulty);
        if (config.deity && typeof setDeity === "function") setDeity(config.deity);
        if (config.daily && typeof dailySeed === "function") state.dailySeed = dailySeed();
        else if (config.seed) state.dailySeed = null;

        state.tutorialSeen = true;
        state.characterCreated = true;

        // Build the world: a daily/seeded run regenerates procedurally; otherwise
        // play the curated campaign.
        if (state.dailySeed && typeof regenerateWorld === "function") regenerateWorld();
        else if (config.seed && typeof regenerateWorld === "function") regenerateWorld(undefined, { seed: `run:${config.seed}` });
        else if (typeof normalizeCampaign === "function") normalizeCampaign();

        if (typeof applyClassStartingStats === "function") applyClassStartingStats();
        if (typeof applyDifficultyToFloors === "function") applyDifficultyToFloors();
        if (typeof applyNewGamePlus === "function") {
          const tier = applyNewGamePlus();
          if (tier > 0 && typeof showToast === "function") showToast(`New Game+ tier ${tier}: tougher foes, +${tier * 50} gold.`);
        }
        if (els.characterCreateModal && els.characterCreateModal.classList) els.characterCreateModal.classList.add("hidden");
        if (typeof reveal === "function") reveal();
        if (typeof saveGame === "function") saveGame();
      }

      Object.assign(context, {
        parseStartupOptions,
        resolveFloorIndex,
        goToFloor,
        applyStartPosition,
        beginRun
      });
    }
  };
}());
