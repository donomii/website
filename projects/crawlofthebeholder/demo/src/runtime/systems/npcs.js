(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installNpcs = function (context) {
    with (context) {
      const NPC_DEFINITIONS = [
        {
          floorIndex: 0,
          id: "npc-scribe",
          name: "lost scribe",
          shortName: "scribe",
          line: "I drew the maps before the dark took them. Help me, and I'll point the way.",
          buildChoices() {
            return [
              {
                label: "Show me the floor map. (free)",
                onSelect() {
                  revealAll();
                  state.message = "The scribe traces a complete map in the dust.";
                  render();
                }
              },
              {
                label: "Take 20g — share what you know about the dungeon. (-20g)",
                disabled: (state.gold || 0) < 20,
                onSelect() {
                  if ((state.gold || 0) < 20) {
                    setMessage("The scribe waits, palm open.");
                    return;
                  }
                  state.gold -= 20;
                  state.itemsCollected = (state.itemsCollected || 0) + 1;
                  state.inventory.push({
                    id: `scribe-map-${state.lootSerial += 1}`,
                    name: "scroll of magic mapping",
                    shortName: "map",
                    kind: "mapping",
                    power: 0,
                    tile: ""
                  });
                  state.message = "The scribe presses a folded scroll into your hand.";
                  render();
                }
              },
              { label: "Leave them in peace.", onSelect() { state.message = "The scribe nods and returns to their parchment."; } }
            ];
          }
        },
        {
          floorIndex: 2,
          id: "npc-stonecaller",
          name: "stonecaller",
          shortName: "caller",
          line: "Names matter down here. I can read what your trinkets really are — for a price.",
          buildChoices() {
            return [
              {
                label: "Identify everything in my pack. (-30g)",
                disabled: (state.gold || 0) < 30,
                onSelect() {
                  if ((state.gold || 0) < 30) { setMessage("Not enough gold for the stonecaller."); return; }
                  state.gold -= 30;
                  const count = typeof identifyAll === "function" ? identifyAll() : 0;
                  state.message = count > 0 ? `Stonecaller names ${count} item${count === 1 ? "" : "s"}.` : "Stonecaller finds nothing left to name.";
                  render();
                }
              },
              {
                label: "Remove every curse in my pack and on my crew. (-45g)",
                disabled: (state.gold || 0) < 45,
                onSelect() {
                  if ((state.gold || 0) < 45) { setMessage("Not enough gold."); return; }
                  state.gold -= 45;
                  let cleansed = 0;
                  for (const member of state.party) {
                    for (const slot of ["weapon", "armour", "talisman", "ring", "amulet"]) {
                      if (member[slot]?.cursed) { member[slot].cursed = false; cleansed += 1; }
                    }
                  }
                  for (const item of state.inventory) {
                    if (item.cursed) { item.cursed = false; cleansed += 1; }
                  }
                  state.message = cleansed > 0 ? `Stonecaller breaks ${cleansed} curse${cleansed === 1 ? "" : "s"}.` : "No curses to break.";
                  render();
                }
              },
              { label: "Pass them by.", onSelect() { state.message = "The stonecaller waves you onward."; } }
            ];
          }
        }
      ];

      function findOpenNpcCell(floor) {
        const taken = new Set();
        for (const item of floor.floorItems || []) taken.add(`${item.x},${item.y}`);
        for (const trap of floor.traps || []) taken.add(`${trap.x},${trap.y}`);
        for (const decor of floor.decor || []) taken.add(`${decor.x},${decor.y}`);
        for (const enc of floor.encounters || []) taken.add(`${enc.x},${enc.y}`);
        for (const stair of Object.values(floor.stairs || {})) {
          if (stair) taken.add(`${stair.x},${stair.y}`);
        }
        taken.add(`${floor.start.x},${floor.start.y}`);
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            if (floor.map.rows[y]?.[x] !== ".") continue;
            const key = `${x},${y}`;
            if (!taken.has(key)) return { x, y };
          }
        }
        return null;
      }

      function seedNpcs() {
        if (context.npcsDisabled || state.npcsSeeded) return;
        state.npcsSeeded = true;
        for (const def of NPC_DEFINITIONS) {
          const floor = resources.floors[def.floorIndex];
          if (!floor) continue;
          floor.decor = floor.decor || [];
          if (floor.decor.some((d) => d.id === def.id)) continue;
          const cell = findOpenNpcCell(floor);
          if (!cell) continue;
          const sampleDecor = floor.decor[0];
          floor.decor.push({
            id: def.id,
            name: def.name,
            shortName: def.shortName,
            kind: "npc",
            tile: sampleDecor?.tile || "",
            x: cell.x,
            y: cell.y,
            npcDefId: def.id
          });
        }
      }

      function npcDefinitionFor(decor) {
        return NPC_DEFINITIONS.find((d) => d.id === decor?.npcDefId);
      }

      function openNpcDialogue(decor) {
        const def = npcDefinitionFor(decor);
        if (!def) return false;
        const choices = def.buildChoices ? def.buildChoices() : [];
        if (typeof showDialogue === "function") showDialogue(def.name, def.line, choices);
        return true;
      }

      Object.assign(context, {
        NPC_DEFINITIONS,
        seedNpcs,
        npcDefinitionFor,
        openNpcDialogue
      });

      seedNpcs();
    }
  };
}());
