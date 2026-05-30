(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installClasses = function (context) {
    with (context) {
      const CLASSES = {
        warrior: {
          key: "warrior",
          name: "Warrior",
          glyph: "⚔",
          description: "Front-line bruiser. +2 defense passive. Signature: Rally — +3 power across the party for 4 turns.",
          passiveDefense: 2,
          passivePower: 1,
          signatureCooldown: 20,
          signature: { id: "rally", label: "Rally", body: "+3 power for 4 turns" },
          ultimate: { id: "warcry", label: "War Cry", body: "Might + frighten nearby foes", cooldown: 36 }
        },
        mage: {
          key: "mage",
          name: "Mage",
          glyph: "✦",
          description: "Spell-thrower. Wands hit 25% harder. Signature: Arcane Sight — reveals the floor and adds a charge to one held wand.",
          passiveDefense: 0,
          passivePower: 0,
          wandPowerMultiplier: 1.25,
          signatureCooldown: 28,
          signature: { id: "arcane_sight", label: "Arcane Sight", body: "Reveal the floor, +1 wand charge" },
          ultimate: { id: "meteor", label: "Meteor", body: "Heavy fire damage to all visible foes", cooldown: 40 }
        },
        rogue: {
          key: "rogue",
          name: "Rogue",
          glyph: "✦",
          description: "Knife-fighter. +1 evasion party-wide. Signature: Shadow Step — short safe blink.",
          passiveDefense: 1,
          passivePower: 0,
          disarmReach: 2,
          signatureCooldown: 16,
          signature: { id: "shadow_step", label: "Shadow Step", body: "Short blink away from danger" },
          ultimate: { id: "vanish", label: "Vanish", body: "Blink + reset every monster's alert", cooldown: 30 }
        },
        cleric: {
          key: "cleric",
          name: "Cleric",
          glyph: "✚",
          description: "Devoted healer. Rest heals +1 extra. Signature: Blessing — heals 12 HP across the party and clears poison, burn, and bleeding.",
          passiveDefense: 1,
          passivePower: 0,
          restBonus: 1,
          signatureCooldown: 24,
          signature: { id: "blessing", label: "Blessing", body: "Heal 12 HP, clear poison/burn/bleed" },
          ultimate: { id: "sanctuary", label: "Sanctuary", body: "Full heal + clear all party ailments", cooldown: 44 }
        }
      };

      // Default class assignment by member name → class.
      const DEFAULT_CLASS_BY_NAME = {
        Mino: "warrior",
        Ash: "cleric",
        Kob: "rogue",
        Vex: "mage"
      };

      function classFor(member) {
        if (!member || context.classesDisabled) return null;
        if (member.classKey === null) return null;
        if (member.classKey && CLASSES[member.classKey]) return CLASSES[member.classKey];
        const named = DEFAULT_CLASS_BY_NAME[member.name];
        if (named) return CLASSES[named];
        return null;
      }

      function ensureClassAssignments() {
        if (context.classesDisabled) return;
        for (const member of state.party) {
          if (!member.classKey) {
            const named = DEFAULT_CLASS_BY_NAME[member.name];
            if (named) member.classKey = named;
          }
          if (member.signatureCooldown === undefined) member.signatureCooldown = 0;
        }
      }

      function applyClassStartingStats() {
        if (state.classStatsApplied) return;
        state.classStatsApplied = true;
        for (const member of state.party) {
          const klass = classFor(member);
          if (!klass) continue;
          // Slight HP/max-HP nudge based on class identity.
          if (klass.key === "warrior") { member.maxHp += 6; member.hp += 6; }
          if (klass.key === "mage") { member.maxHp -= 2; member.hp = Math.max(1, member.hp - 2); }
          if (klass.key === "rogue") { member.maxHp += 2; member.hp += 2; }
          if (klass.key === "cleric") { member.maxHp += 4; member.hp += 4; }
        }
        addClassStartingItems();
      }

      function addClassStartingItems() {
        const classes = new Set(state.party.filter((m) => m.classKey).map((m) => m.classKey));
        const sample = resources.inventory.find((item) => item.tile) || {};
        const tile = sample.tile || "";
        let serial = 0;
        const make = (props) => ({ id: `starter-${++serial}-${state.lootSerial++}`, tile, ...props });
        if (classes.has("warrior")) {
          state.inventory.push(make({ name: "iron rations", shortName: "ration", kind: "food", power: 500 }));
        }
        if (classes.has("mage")) {
          state.inventory.push(make({ name: "wand of flame", shortName: "flame", kind: "wand", power: 6, charges: 3 }));
        }
        if (classes.has("rogue")) {
          state.inventory.push(make({ name: "throwing daggers", shortName: "dagger", kind: "throwable", power: 5, charges: 4, range: 4 }));
        }
        if (classes.has("cleric")) {
          state.inventory.push(make({ name: "scroll of remove curse", shortName: "rc", kind: "remove_curse" }));
          state.inventory.push(make({ name: "potion of curing", shortName: "cure", kind: "healing", power: 14 }));
        }
        // Everyone gets a torch so lighting feels like a real mechanic.
        state.inventory.push(make({ name: "weathered torch", shortName: "torch", kind: "torch" }));
      }

      function classPassivePower(member) {
        return classFor(member)?.passivePower || 0;
      }

      function classPassiveDefense(member) {
        return classFor(member)?.passiveDefense || 0;
      }

      function classWandMultiplier() {
        const leader = state.party[0];
        return classFor(leader)?.wandPowerMultiplier || 1;
      }

      function classRestBonus() {
        let bonus = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          bonus += classFor(member)?.restBonus || 0;
        }
        return bonus;
      }

      function classDisarmReach() {
        let reach = 1;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          const r = classFor(member)?.disarmReach || 1;
          if (r > reach) reach = r;
        }
        return reach;
      }

      function tickClassCooldowns() {
        for (const member of state.party) {
          if (typeof member.signatureCooldown === "number" && member.signatureCooldown > 0) {
            member.signatureCooldown -= 1;
          }
          if (typeof member.ultimateCooldown === "number" && member.ultimateCooldown > 0) {
            member.ultimateCooldown -= 1;
          }
        }
      }

      function leaderClass() {
        return classFor(state.party[0]);
      }

      function applyRally() {
        state.mightTurns = Math.max(state.mightTurns || 0, 4);
        // Add a stack of extra power for 4 turns via the existing might pipeline.
        state.message = "The warrior rallies the party!";
      }

      function applyArcaneSight() {
        revealAll();
        const wand = state.inventory.find((item) => item.kind === "wand" && (item.charges || 0) > 0);
        if (wand) {
          wand.charges = (wand.charges || 0) + 1;
          state.message = `The mage chants — the floor unfolds, and ${wand.name} hums with another charge.`;
        } else {
          state.message = "The mage chants — the floor unfolds.";
        }
      }

      function applyShadowStep() {
        const moved = blinkParty();
        state.message = moved ? "The rogue slips through the dark." : "The rogue's blink fizzles.";
      }

      function applyBlessing() {
        let healed = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          const before = member.hp;
          member.hp = Math.min(member.maxHp, member.hp + 12);
          healed += member.hp - before;
        }
        const cleared = [];
        if (state.poisonedTurns > 0) { state.poisonedTurns = 0; cleared.push("poison"); }
        if (state.burningTurns > 0) { state.burningTurns = 0; cleared.push("burn"); }
        if (state.bleedingTurns > 0) { state.bleedingTurns = 0; cleared.push("bleeding"); }
        const clearNote = cleared.length ? ` Clears ${cleared.join(", ")}.` : "";
        state.message = `The cleric blesses the party for ${healed} HP.${clearNote}`;
      }

      function triggerSignature() {
        if (state.victory || state.defeated) return;
        ensureClassAssignments();
        const leader = state.party[0];
        if (!leader || leader.hp <= 0) {
          setMessage("No conscious leader to invoke a signature.");
          return;
        }
        const klass = classFor(leader);
        if (!klass) {
          setMessage(`${leader.name} has no signature ability.`);
          return;
        }
        if ((leader.signatureCooldown || 0) > 0) {
          setMessage(`${klass.signature.label} is recharging (${leader.signatureCooldown} turns).`);
          return;
        }

        switch (klass.signature.id) {
          case "rally": applyRally(); break;
          case "arcane_sight": applyArcaneSight(); break;
          case "shadow_step": applyShadowStep(); break;
          case "blessing": applyBlessing(); break;
          default: setMessage(`${leader.name} fumbles their signature.`); return;
        }
        if (typeof pulse === "function") pulse("signature");
        leader.signatureCooldown = klass.signatureCooldown;
        advanceTurn();
        render();
      }

      function applyWarcry() {
        state.mightTurns = Math.max(state.mightTurns || 0, 8);
        let frightened = 0;
        for (const monster of currentFloorState().monsters) {
          if (monster.hp <= 0) continue;
          if (distanceToPlayer(monster) > 6) continue;
          monster.fearTurns = Math.max(monster.fearTurns || 0, 5);
          frightened += 1;
        }
        state.message = `The warrior's war cry shakes the hall. ${frightened} foe${frightened === 1 ? "" : "s"} flinch.`;
      }

      function applyMeteor() {
        const floorState = currentFloorState();
        const targets = floorState.monsters.filter((m) => m.hp > 0 && floorState.discovered.has(keyOf(m.x, m.y)) && distanceToPlayer(m) <= 8);
        let total = 0;
        for (const monster of targets) {
          const base = 18 + Math.floor(Math.random() * 8);
          const dmg = typeof monsterElementDamage === "function" ? monsterElementDamage(monster, base, "fire") : base;
          monster.hp = Math.max(0, monster.hp - dmg);
          total += 1;
          if (monster.hp === 0 && typeof killMonster === "function") killMonster(monster);
        }
        if (typeof addEffect === "function") addEffect("immolation", targets.map((m) => ({ x: m.x, y: m.y })));
        state.message = `A meteor crashes down on ${total} foe${total === 1 ? "" : "s"}.`;
      }

      function applyVanish() {
        const moved = typeof blinkParty === "function" ? blinkParty() : false;
        for (const monster of currentFloorState().monsters) monster.alerted = false;
        state.message = moved ? "The rogue vanishes; the dungeon forgets the party." : "The rogue melts into shadow; pursuers lose the trail.";
      }

      function applySanctuary() {
        for (const member of state.party) {
          if (member.hp > 0) member.hp = member.maxHp;
        }
        const ailments = ["poisonedTurns", "burningTurns", "bleedingTurns", "snaredTurns", "barbedTurns", "engulfedTurns", "dazedTurns", "stunnedTurns", "corrodedTurns", "vitrifiedTurns", "slowedTurns"];
        for (const key of ailments) state[key] = 0;
        state.message = "Sanctuary floods the party with light. All wounds and ailments wash away.";
      }

      function ultimateUnlocked() {
        return (state.level || 1) >= 10;
      }

      function triggerUltimate() {
        if (state.victory || state.defeated) return;
        ensureClassAssignments();
        const leader = state.party[0];
        if (!leader || leader.hp <= 0) {
          setMessage("No conscious leader to invoke an ultimate.");
          return;
        }
        const klass = classFor(leader);
        if (!klass || !klass.ultimate) {
          setMessage(`${leader?.name || "The leader"} has no ultimate ability.`);
          return;
        }
        if (!ultimateUnlocked()) {
          setMessage(`${klass.ultimate.label} unlocks at level 10 (currently ${state.level}).`);
          return;
        }
        if ((leader.ultimateCooldown || 0) > 0) {
          setMessage(`${klass.ultimate.label} is recharging (${leader.ultimateCooldown} turns).`);
          return;
        }
        switch (klass.ultimate.id) {
          case "warcry": applyWarcry(); break;
          case "meteor": applyMeteor(); break;
          case "vanish": applyVanish(); break;
          case "sanctuary": applySanctuary(); break;
          default: setMessage(`${leader.name} fumbles their ultimate.`); return;
        }
        if (typeof pulse === "function") pulse("signature");
        leader.ultimateCooldown = klass.ultimate.cooldown;
        advanceTurn();
        render();
      }

      function getClassDefinitions() {
        return Object.values(CLASSES);
      }

      // Each class echoes a real DCSS background; classLore() surfaces that
      // background's authentic flavour (from backgrounds.txt via lore.js).
      const CLASS_BACKGROUND = { warrior: "fighter", mage: "conjurer", rogue: "brigand", cleric: "monk" };
      function classBackground(classKey) { return CLASS_BACKGROUND[classKey] || null; }
      function classLore(classKey) {
        const bg = CLASS_BACKGROUND[classKey];
        return bg && typeof backgroundLore === "function" ? backgroundLore(bg) : "";
      }

      const ALTAR_FLOORS = [2, 6, 9];
      const SHRINE_FLOORS = [1, 5, 8];
      const CHEST_FLOORS = [1, 3, 4, 7, 10];

      function findOpenAltarCell(floor) {
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

      function placeFixtureDecor(floorIndex, idPrefix, name, shortName, kind = "fixture") {
        const floor = resources.floors[floorIndex];
        if (!floor) return;
        floor.decor = floor.decor || [];
        if (floor.decor.some((d) => d.id === `${idPrefix}-${floorIndex}`)) return;
        const cell = findOpenAltarCell(floor);
        if (!cell) return;
        const sampleDecor = floor.decor[0];
        floor.decor.push({
          id: `${idPrefix}-${floorIndex}`,
          name,
          shortName,
          kind,
          tile: sampleDecor?.tile || "",
          x: cell.x,
          y: cell.y
        });
      }

      function seedAltars() {
        if (context.altarsDisabled || state.altarsSeeded) return;
        state.altarsSeeded = true;
        for (const floorIndex of ALTAR_FLOORS) placeFixtureDecor(floorIndex, "altar", "altar of reflection", "altar");
        for (const floorIndex of SHRINE_FLOORS) placeFixtureDecor(floorIndex, "shrine", "wayside shrine", "shrine");
        for (const floorIndex of CHEST_FLOORS) placeFixtureDecor(floorIndex, "chest", "wooden chest", "chest", "chest");
      }

      Object.assign(context, {
        CLASSES,
        ALTAR_FLOORS,
        SHRINE_FLOORS,
        CHEST_FLOORS,
        seedAltars,
        placeFixtureDecor,
        findOpenAltarCell,
        classFor,
        ensureClassAssignments,
        classPassivePower,
        classPassiveDefense,
        classWandMultiplier,
        classRestBonus,
        classDisarmReach,
        tickClassCooldowns,
        leaderClass,
        applyRally,
        applyArcaneSight,
        applyShadowStep,
        applyBlessing,
        triggerSignature,
        triggerUltimate,
        ultimateUnlocked,
        applyWarcry,
        applyMeteor,
        applyVanish,
        applySanctuary,
        applyClassStartingStats,
        addClassStartingItems,
        getClassDefinitions,
        classBackground,
        classLore
      });

      ensureClassAssignments();
      seedAltars();
    }
  };
}());
