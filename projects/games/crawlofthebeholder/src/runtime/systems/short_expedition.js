(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installShortExpedition = function installShortExpedition(context) {
    with (context) {
      // Keep the campaign templates separate so switching save slots can restore
      // either world without retaining the other world's names or encounters.
      const campaign = JSON.parse(JSON.stringify(resources.floors));
      const clone = (value) => JSON.parse(JSON.stringify(value));
      const branches = [
        { name: "Watchpost", x: 4, y: 1, warning: "A priest supports a gnoll. Break their sight line.", monsters: [["gnoll", 8, 4], ["orc priest", 10, 3]] },
        { name: "Venom halls", x: 8, y: 1, warning: "Two fast adders guard the rune. Poison spends healing quickly.", monsters: [["adder", 7, 3], ["adder", 10, 5]] },
        { name: "Flooded gallery", x: 4, y: 7, warning: "An electric eel covers the water. Dry causeways link the islands; water offers shortcuts.", monsters: [["electric eel", 6, 4]] },
        { name: "Ogre vault", x: 8, y: 7, warning: "An ogre guards a rune and a flame wand. Its heavy blows make this a costly detour.", monsters: [["ogre", 8, 4]] }
      ];
      const branchRows = [
        "xxxxxxxxxxxxx", "x...........x", "x.....x.....x",
        "x.....x.....x", "x.....x.....x", "x.....x.....x",
        "x...........x", "x...........x", "xxxxxxxxxxxxx"
      ];

      function encounter(name, index, x, y) {
        const template = campaign.flatMap((floor) => floor.encounters).find((monster) => monster.name === name);
        if (!template) {
          throw new Error(`Short expedition requires the existing monster '${name}', but no campaign template was found.`);
        } else {
          return { ...clone(template), id: `short-${index}-${name}-${x}-${y}`, x, y };
        }
      }

      function shortFloor(id, name, rows) {
        return {
          id, name, assets: clone(campaign[0].assets),
          map: { name, width: rows[0].length, height: rows.length, rows: [...rows], source: "short-expedition-v1" },
          start: { x: 1, y: 4, dir: 1 }, doors: [], stairs: {},
          floorItems: [], traps: [], decor: [], encounters: []
        };
      }

      function shortSupply(kind, index, x, y) {
        const template = campaign.flatMap((floor) => floor.floorItems).find((item) => item.kind === kind);
        if (!template) {
          throw new Error(`Short expedition requires an existing ${kind} supply, but no campaign template was found.`);
        } else {
          return { ...clone(template), id: `short-supply-${index}`, x, y };
        }
      }

      function makeShortExpedition() {
        const hub = shortFloor("Entry:1", "The Four Ways", [
          "xxxxxxxxxxxxxxxxx", "x...............x", "x...............x",
          "x..x..x..x..x...x", "x...............x", "x..x..x..x..x...x",
          "x...............x", "x...............x", "xxxxxxxxxxxxxxxxx"
        ]);
        hub.stairs.up = { x: 1, y: 4, direction: "up", label: "Surface exit", detail: "Return here with the Orb to escape." };
        hub.stairs.down = { x: 15, y: 4, direction: "down", targetFloor: 5, landing: { x: 1, y: 4 }, label: "Zot sanctum", detail: "Requires three of the four branch runes. Take the Orb, then return to the surface exit." };
        const floors = [hub];
        branches.forEach((branch, offset) => {
          const index = offset + 1;
          const floor = shortFloor(`Detour:${index}`, branch.name, branchRows);
          hub.stairs[`branch${index}`] = {
            x: branch.x, y: branch.y, direction: "down", targetFloor: index, landing: { x: 1, y: 4 },
            label: branch.name, detail: `${branch.warning} One rune; return by the same stairs. Any one branch can be skipped.`
          };
          floor.stairs.up = { x: 1, y: 4, direction: "up", targetFloor: 0, landing: { x: branch.x, y: branch.y }, label: "The Four Ways", detail: "Return to this branch's entrance in the hub." };
          floor.stairs.down = null;
          if (index === 3) {
            floor.assets = clone(campaign.find((template) => template.id === "Shoals:1").assets);
            floor.map.rows = [
              "xxxxxxxxxxxxx", "x...........x", "x...........x",
              "x...xxxxx...x", "x...wwwww...x", "x...xxxxx...x",
              "x...........x", "x...........x", "xxxxxxxxxxxxx"
            ];
          } else {
            floor.doors = ["6,6"];
          }
          floor.floorItems = [{ ...clone(RUNE_TEMPLATES[offset]), x: 11, y: 4 }];
          if (index <= 2) {
            floor.floorItems.push(shortSupply("healing", index, 10, 7));
          } else if (index === 4) {
            floor.floorItems.push(shortSupply("wand", index, 10, 7));
          } else {
            floor.floorItems.push(shortSupply("gold", index, 10, 7));
          }
          floor.encounters = branch.monsters.map(([name, x, y]) => encounter(name, index, x, y));
          floors.push(floor);
        });
        const zot = shortFloor("Zot:1", "The Small Sanctum", branchRows);
        zot.stairs = { up: { x: 1, y: 4, direction: "up", targetFloor: 0, landing: { x: 15, y: 4 }, label: "The Four Ways", detail: "The surface exit is at the far end of the hub. The Orb draws pursuit." }, down: null };
        zot.floorItems = [{ ...clone(ORB_TEMPLATE), x: 11, y: 4 }];
        zot.encounters = [encounter("wight", 5, 10, 4), encounter("gnoll", 5, 8, 6)];
        floors.push(zot);
        return floors;
      }

      function restoreExpeditionResources(mode) {
        resources.floors = mode === "short" ? makeShortExpedition() : clone(campaign);
        state.expedition = mode;
      }

      function startShortExpedition() {
        state.runSeed = state.runSeed || Math.floor(Math.random() * 1e9);
        const floors = compactShortFloors(makeShortExpedition(), `short:${state.runSeed}`);
        resources.floors = floors;
        state.expedition = "short";
        state.floors = resources.floors.map((floor) => ({
          openedDoors: new Set(), discovered: new Set(), usedDecor: new Set(),
          floorItems: clone(floor.floorItems), traps: [], clouds: [], floorMarks: [], allies: [],
          monsters: floor.encounters.map((monster) => ({ ...clone(monster), hp: monster.maxHp, energy: 0 }))
        }));
        state.floorIndex = 0;
        state.x = resources.floors[0].start.x;
        state.y = resources.floors[0].start.y;
        state.dir = resources.floors[0].start.dir;
        state.message = "The Four Ways: choose any three of four rune branches, open Zot, and bring the Orb back to this surface exit. Examine each stair for its danger and reward.";
        normalizeCampaign();
      }

      function linkedStairProblem(stair, floors) {
        const floor = floors[stair.targetFloor];
        const landing = stair.landing;
        if (!Number.isInteger(stair.targetFloor) || !floor || !["up", "down"].includes(stair.direction)) {
          return `expected an up/down connection to an existing floor; got ${stair.direction} to ${stair.targetFloor}.`;
        } else if (!landing || !Number.isInteger(landing.x) || !Number.isInteger(landing.y) || floor.map?.rows?.[landing.y]?.[landing.x] !== "." || floor.doors?.includes(keyOf(landing.x, landing.y))) {
          return `expected an open landing on floor ${stair.targetFloor}; got ${JSON.stringify(landing)}.`;
        } else {
          return null;
        }
      }

      function expeditionSaveProblem(saved) {
        const mode = saved.expedition ?? "campaign";
        if (!["campaign", "short"].includes(mode)) {
          return `Cannot load expedition '${mode}': expected campaign or short. The saved data has been preserved.`;
        } else if (mode === "campaign") {
          return null;
        } else {
          return shortSaveProblem(saved);
        }
      }

      function shortSaveProblem(saved) {
        const expected = makeShortExpedition();
        const floors = saved.worldFloors;
        const error = "Cannot load short expedition: expected six connected floors with their original return stairs and valid campaign progress. The saved data has been preserved.";
        if (!Array.isArray(floors) || floors.length !== expected.length || !Array.isArray(saved.floors) || saved.floors.length !== expected.length || !Number.isInteger(saved.floorIndex) || !floors[saved.floorIndex]) return error;
        for (let index = 0; index < expected.length; index += 1) {
          const floor = floors[index];
          const reference = expected[index];
          const compact = floor?.map?.source === "dcss-compact-v1";
          const width = compact ? (index === 3 ? 24 : 18) : reference.map.width;
          const height = compact ? (index === 3 ? 18 : 14) : reference.map.height;
          if (!floor?.map || floor.map.width !== width || floor.map.height !== height || !Array.isArray(floor.map.rows) || floor.map.rows.length !== floor.map.height || floor.map.rows.some((row) => typeof row !== "string" || row.length !== floor.map.width || /[^xX.+wWlH]/.test(row))) return error;
          if (!floor.stairs || Object.keys(floor.stairs).length !== Object.keys(reference.stairs).length) return error;
          for (const [key, stair] of Object.entries(reference.stairs)) {
            const actual = floor.stairs[key];
            if (!stair) {
              if (actual !== null) return error;
            } else if (!actual || !Number.isInteger(actual.x) || !Number.isInteger(actual.y) || (!compact && (actual.x !== stair.x || actual.y !== stair.y)) || actual.direction !== stair.direction || actual.targetFloor !== stair.targetFloor || floor.map.rows[actual.y]?.[actual.x] !== ".") {
              return error;
            } else if (Object.hasOwn(actual, "targetFloor") && linkedStairProblem(actual, floors)) {
              return error;
            } else if (Object.hasOwn(actual, "targetFloor")) {
              const reverse = Object.values(floors[actual.targetFloor].stairs).find((entry) => entry && entry.targetFloor === index);
              if (!reverse || actual.landing.x !== reverse.x || actual.landing.y !== reverse.y || reverse.landing?.x !== actual.x || reverse.landing?.y !== actual.y) return error;
            }
          }
          const floorState = saved.floors[index];
          if (!floorState || !["monsters", "floorItems", "openedDoors", "discovered", "traps"].every((key) => Array.isArray(floorState[key]))) return error;
        }
        if (!Number.isInteger(saved.x) || !Number.isInteger(saved.y) || ![".", "w", "W", "l"].includes(floors[saved.floorIndex].map.rows[saved.y]?.[saved.x]) || saved.zotFloorIndex !== 5 || saved.runesInWorld !== 4 || typeof saved.orbRun !== "boolean" || !Number.isInteger(saved.orbRunTurns) || saved.orbRunTurns < 0) return error;
        return null;
      }

      Object.assign(context, { makeShortExpedition, startShortExpedition, restoreExpeditionResources, linkedStairProblem, expeditionSaveProblem });
    }
  };
}());
