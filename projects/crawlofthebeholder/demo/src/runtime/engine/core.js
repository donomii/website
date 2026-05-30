(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.createCoreContext = function (resources, document) {
    const dirs = [
      { name: "N", x: 0, y: -1 },
      { name: "E", x: 1, y: 0 },
      { name: "S", x: 0, y: 1 },
      { name: "W", x: -1, y: 0 }
    ];
    const viewFrames = [
      { left: -18, top: -12, right: 118, bottom: 112 },
      { left: 16, top: 13, right: 84, bottom: 87 },
      { left: 28, top: 23, right: 72, bottom: 77 },
      { left: 37, top: 31, right: 63, bottom: 69 },
      { left: 43, top: 38, right: 57, bottom: 62 }
    ];
    const geometry = {
      1: { front: [16, 13, 68, 74], sprite: [31, 24, 38, 52], item: [45, 68, 10, 10], tile: 152, light: 0.92, z: 14 },
      2: { front: [28, 23, 44, 54], sprite: [39, 32, 22, 32], item: [47, 61, 7, 7], tile: 116, light: 0.72, z: 11 },
      3: { front: [37, 31, 26, 38], sprite: [44, 38, 12, 19], item: [48, 56, 5, 5], tile: 82, light: 0.56, z: 8 },
      4: { front: [43, 38, 14, 24], sprite: [47, 42, 6, 11], item: [49, 53, 3, 3], tile: 54, light: 0.42, z: 5 }
    };

    const state = {
      floorIndex: 0,
      x: resources.floors[0].start.x,
      y: resources.floors[0].start.y,
      dir: resources.floors[0].start.dir,
      floors: resources.floors.map((floor) => ({
        openedDoors: new Set(),
        discovered: new Set(),
        floorItems: floor.floorItems.map((item) => ({ ...item })),
        traps: floor.traps.map((trap) => ({ ...trap, armed: true })),
        clouds: [],
        floorMarks: [],
        usedDecor: new Set(),
        allies: [],
        // monster.maxHp / hp are the raw values; difficulty scaling is applied
        // by applyDifficultyToFloors() once the player picks (or restores) a
        // difficulty setting.
        monsters: floor.encounters.map((monster) => ({ ...monster, hp: monster.maxHp, energy: 0 }))
      })),
      party: resources.party.map((member) => ({ ...member, weapon: null, armour: null, talisman: null, ring: null, amulet: null })),
      inventory: resources.inventory.map((item) => ({ ...item })),
      gold: 0,
      lootSerial: 0,
      summonSerial: 0,
      level: 1,
      experience: 0,
      nextLevel: 12,
      hasteTurns: 0,
      mightTurns: 0,
      rageTurns: 0,
      resistanceTurns: 0,
      silenceTurns: 0,
      snaredTurns: 0,
      barbedTurns: 0,
      engulfedTurns: 0,
      slowedTurns: 0,
      poisonedTurns: 0,
      dazedTurns: 0,
      corrodedTurns: 0,
      vitrifiedTurns: 0,
      bleedingTurns: 0,
      stunnedTurns: 0,
      burningTurns: 0,
      turnCount: 0,
      floorTurnCount: 0,
      monstersDefeated: 0,
      damageDealt: 0,
      damageTaken: 0,
      itemsCollected: 0,
      potionsUsed: 0,
      doorsOpened: 0,
      trapsDisarmed: 0,
      stairsTaken: 0,
      floorsCleared: 0,
      criticalHits: 0,
      runStartedAt: Date.now(),
      runMode: false,
      inventorySort: "default",
      inventoryFilter: "all",
      tutorialSeen: false,
      characterCreated: false,
      classStatsApplied: false,
      difficulty: "normal",
      deity: "none",
      dailySeed: null,
      identifiedKinds: new Set(),
      satiety: 1000,
      talentPoints: 0,
      talents: {},
      mapMarkers: [],
      activeMobileTab: "map",
      mapZoom: 1,
      goldSpent: 0,
      claimedQuests: {},
      autoPickup: true,
      killCombo: 0,
      bestCombo: 0,
      ascension: 0,
      ascensionApplied: false,
      luckBonus: 0,
      victory: false,
      defeated: false,
      endRecorded: false,
      effects: [],
      lastLoggedMessage: "",
      messageLog: [],
      message: "A bat blocks the entry. Stairs descend nearby."
    };

    const els = {
      viewport: document.getElementById("viewport"),
      party: document.getElementById("party"),
      map: document.getElementById("map"),
      mapScroller: document.getElementById("mapScroller"),
      mapZoomIn: document.getElementById("mapZoomIn"),
      mapZoomOut: document.getElementById("mapZoomOut"),
      mapZoomReset: document.getElementById("mapZoomReset"),
      inventory: document.getElementById("inventory"),
      inventoryCount: document.getElementById("inventoryCount"),
      messageLine: document.getElementById("messageLine"),
      statusLine: document.getElementById("statusLine"),
      versionBadge: document.getElementById("versionBadge"),
      floorBadge: document.getElementById("floorBadge"),
      facingBadge: document.getElementById("facingBadge"),
      threatBadge: document.getElementById("threatBadge"),
      nearby: document.getElementById("nearby"),
      log: document.getElementById("log"),
      logCount: document.getElementById("logCount"),
      helpModal: document.getElementById("helpModal"),
      endModal: document.getElementById("endModal"),
      endModalTitle: document.getElementById("endModalTitle"),
      endModalBody: document.getElementById("endModalBody"),
      endModalStats: document.getElementById("endModalStats"),
      endModalNewRun: document.getElementById("endModalNewRun"),
      legendModal: document.getElementById("legendModal"),
      settingsModal: document.getElementById("settingsModal"),
      achievementsModal: document.getElementById("achievementsModal"),
      achievementsList: document.getElementById("achievementsList"),
      historyModal: document.getElementById("historyModal"),
      historyList: document.getElementById("historyList"),
      tutorialModal: document.getElementById("tutorialModal"),
      characterModal: document.getElementById("characterModal"),
      characterList: document.getElementById("characterList"),
      talentsModal: document.getElementById("talentsModal"),
      talentsList: document.getElementById("talentsList"),
      talentPointsBadge: document.getElementById("talentPointsBadge"),
      markersModal: document.getElementById("markersModal"),
      markersList: document.getElementById("markersList"),
      saveSlotsModal: document.getElementById("saveSlotsModal"),
      saveSlotList: document.getElementById("saveSlotList"),
      moreActionsModal: document.getElementById("moreActionsModal"),
      bestiaryModal: document.getElementById("bestiaryModal"),
      bestiaryList: document.getElementById("bestiaryList"),
      statsModal: document.getElementById("statsModal"),
      statsList: document.getElementById("statsList"),
      questsModal: document.getElementById("questsModal"),
      questsList: document.getElementById("questsList"),
      questsBadge: document.getElementById("questsBadge"),
      characterCreateModal: document.getElementById("characterCreateModal"),
      characterCreateList: document.getElementById("characterCreateList"),
      characterCreateStart: document.getElementById("characterCreateStart"),
      characterCreateRandom: document.getElementById("characterCreateRandom"),
      characterCreateDifficulty: document.getElementById("characterCreateDifficulty"),
      characterCreateDeity: document.getElementById("characterCreateDeity"),
      characterCreateDaily: document.getElementById("characterCreateDaily"),
      characterCreateDailyDesc: document.getElementById("characterCreateDailyDesc"),
      dialogueModal: document.getElementById("dialogueModal"),
      dialogueTitle: document.getElementById("dialogueTitle"),
      dialogueBody: document.getElementById("dialogueBody"),
      dialogueChoices: document.getElementById("dialogueChoices"),
      shopModal: document.getElementById("shopModal"),
      shopList: document.getElementById("shopList"),
      shopGoldLine: document.getElementById("shopGoldLine"),
      critFlash: document.getElementById("critFlash"),
      toast: document.getElementById("toast"),
      compass: document.getElementById("compass")
    };
    const imageCache = new Map();

    function keyOf(x, y) {
      return `${x},${y}`;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      })[character]);
    }

    function currentFloor() {
      return resources.floors[state.floorIndex];
    }

    function currentFloorState() {
      return state.floors[state.floorIndex];
    }

    function currentAssets() {
      return currentFloor().assets;
    }

    function cellAt(x, y) {
      const row = currentFloor().map.rows[y];
      return row ? row[x] || " " : " ";
    }

    function setCellAt(x, y, value) {
      const rows = currentFloor().map.rows;
      const row = rows[y];
      rows[y] = `${row.slice(0, x)}${value}${row.slice(x + 1)}`;
    }

    function dirAt(turns) {
      return dirs[(state.dir + turns + dirs.length) % dirs.length];
    }

    function doorCellAt(x, y) {
      return cellAt(x, y) === "+" || currentFloor().doors.includes(keyOf(x, y));
    }

    function closedDoorAt(x, y) {
      const key = keyOf(x, y);
      return doorCellAt(x, y) && !currentFloorState().openedDoors.has(key);
    }

    function mapKind(x, y) {
      if (closedDoorAt(x, y)) return "door";
      const cell = cellAt(x, y);
      if (cell === "x" || cell === " " || cell === "H") return "wall";
      return "floor";
    }

    function isFrozenTile(x, y) {
      const floorState = currentFloorState();
      return !!(floorState.frozenTiles && (floorState.frozenTiles.get(keyOf(x, y)) || 0) > 0);
    }

    function bridgedTile(x, y) {
      const floorState = currentFloorState();
      return !!(floorState.bridges && floorState.bridges.has(keyOf(x, y)));
    }

    function barricadeAt(x, y) {
      const floorState = currentFloorState();
      return !!(floorState.barricades && floorState.barricades.has(keyOf(x, y)));
    }

    function terrainAt(x, y) {
      // A frozen water/lava tile or a deployed bridge reads as solid floor
      // (walkable crust/planks) instead of the hazardous liquid beneath.
      if (isFrozenTile(x, y) || bridgedTile(x, y)) return "floor";
      const cell = cellAt(x, y);
      if (cell === "W") return "deep-water";
      if (cell === "w") return "water";
      if (cell === "l") return "lava";
      return "floor";
    }

    function mapContains(x, y) {
      const floor = currentFloor();
      return x >= 0 && x < floor.map.width && y >= 0 && y < floor.map.height;
    }

    function boundaryWallCell(x, y) {
      if (mapContains(x, y)) return true;
      return dirs.some((dir) => {
        const adjacentX = x + dir.x;
        const adjacentY = y + dir.y;
        return mapContains(adjacentX, adjacentY) && mapKind(adjacentX, adjacentY) === "floor";
      });
    }

    function solidAt(x, y) {
      // A deployed barricade blocks the tile like a temporary wall.
      return barricadeAt(x, y) || mapKind(x, y) !== "floor";
    }

    function monsterAt(x, y) {
      return currentFloorState().monsters.find((monster) => monster.x === x && monster.y === y && monster.hp > 0);
    }

    function allyAt(x, y) {
      const floorState = currentFloorState();
      if (!floorState.allies) return undefined;
      return floorState.allies.find((ally) => ally.x === x && ally.y === y && ally.hp > 0);
    }

    function itemAt(x, y) {
      return currentFloorState().floorItems.find((item) => item.x === x && item.y === y);
    }

    function trapAt(x, y) {
      return currentFloorState().traps.find((trap) => trap.x === x && trap.y === y && trap.armed);
    }

    function decorAt(x, y) {
      return (currentFloor().decor || []).find((decor) => decor.x === x && decor.y === y);
    }

    function decorKey(decor) {
      return decor.id || keyOf(decor.x, decor.y);
    }

    function usedDecor() {
      const floorState = currentFloorState();
      if (!floorState.usedDecor) floorState.usedDecor = new Set();
      return floorState.usedDecor;
    }

    function decorUsed(decor) {
      return usedDecor().has(decorKey(decor));
    }

    function markDecorUsed(decor) {
      usedDecor().add(decorKey(decor));
    }

    function cloudAt(x, y) {
      return currentFloorState().clouds.find((cloud) => cloud.x === x && cloud.y === y && cloud.turns > 0);
    }

    function cloudBlocksLine(x, y) {
      const kind = cloudAt(x, y)?.kind;
      return kind === "fog" || kind === "steam";
    }

    function stairsAt(x, y) {
      const stairs = currentFloor().stairs;
      if (stairs.down && stairs.down.x === x && stairs.down.y === y) return { direction: "down", ...stairs.down };
      if (stairs.up && stairs.up.x === x && stairs.up.y === y) return { direction: "up", ...stairs.up };
      return null;
    }

    function liveMember() {
      return state.party.find((member) => member.hp > 0);
    }

    function liveMembers() {
      return state.party.filter((member) => member.hp > 0);
    }

    function equipmentPower(item) {
      if (!item) return 0;
      if (item.kind === "talisman") return item.power || 0;
      return item.bonus === "power" ? item.power || 0 : 0;
    }

    function memberPower(member) {
      const gearPower = [
        member.weapon?.power || 0,
        equipmentPower(member.talisman),
        equipmentPower(member.ring),
        equipmentPower(member.amulet)
      ].reduce((sum, power) => sum + power, 0);
      const buffPower = state.mightTurns > 0 ? 3 : 0;
      const classPower = member.classKey === "warrior" ? 1 : 0;
      const talentPower = (state.talents && state.talents[`warrior:heavyswing`] && member.classKey === "warrior") ? state.talents[`warrior:heavyswing`] : 0;
      // Patron power is applied in memberAttackDamage alongside the other dynamic
      // power sources (morale, constellations, mastery…), not here, so it tracks
      // live piety without core.js needing to reach the deity module.
      return member.power + gearPower + buffPower + classPower + talentPower + setBonusPower();
    }

    // Estimated party melee damage against a target, ignoring the random roll
    // (uses the average of the 0..3 spread the real formula adds).
    function estimatedPartyDamage(target) {
      const attackers = liveMembers();
      if (attackers.length === 0 || !target) return 0;
      let damage = 0;
      for (let index = 0; index < attackers.length; index += 1) {
        const formation = index < 2 ? 0.72 : 0.5;
        const avgRoll = 1.5; // average of Math.random()*3
        damage += Math.max(1, Math.round(memberPower(attackers[index]) * formation + avgRoll - (target.ac || 0) / 3));
      }
      return damage;
    }

    function combatPreview(target) {
      if (!target) return null;
      const perTurn = estimatedPartyDamage(target);
      const turnsToKill = perTurn > 0 ? Math.max(1, Math.ceil(target.hp / perTurn)) : 99;
      return { perTurn, turnsToKill };
    }

    // Encumbrance: each carried item has a weight (default 1, heavier for gear).
    function itemWeight(item) {
      if (!item) return 0;
      if (typeof item.weight === "number") return item.weight;
      if (item.kind === "weapon" || item.kind === "armour") return 3;
      if (item.kind === "talisman" || item.kind === "amulet" || item.kind === "ring") return 1;
      if (item.kind === "evocable" || item.kind === "wand") return 2;
      if (item.kind === "quest") return 0;
      return 1;
    }

    function carriedWeight() {
      return state.inventory.reduce((sum, item) => sum + itemWeight(item), 0);
    }

    function carryCapacity() {
      // Base 30, +2 per warrior in the party (they carry the load).
      const warriors = state.party.filter((m) => m.hp > 0 && m.classKey === "warrior").length;
      return 30 + warriors * 6;
    }

    function isOverEncumbered() {
      return carriedWeight() > carryCapacity();
    }

    function equippedItems() {
      return liveMembers().flatMap((member) => [
        member.weapon,
        member.armour,
        member.talisman,
        member.ring,
        member.amulet
      ].filter(Boolean));
    }

    function hasEquippedNamed(slot, fragment) {
      const needle = fragment.toLowerCase();
      return liveMembers().some((member) => member[slot]?.name.toLowerCase().includes(needle));
    }

    function hasAnyEquippedNamed(slot, fragments) {
      return fragments.some((fragment) => hasEquippedNamed(slot, fragment));
    }

    function hasEquippedElement(element) {
      return equippedItems().some((item) => item.element === element || item.elements?.includes(element));
    }

    // Item set bonuses: 2+ equipped items sharing an element form a set that
    // grants party power (+1 for a pair, +3 for three or more).
    function activeSetBonuses() {
      const counts = {};
      for (const item of equippedItems()) {
        const elements = item.elements || (item.element ? [item.element] : []);
        for (const element of elements) counts[element] = (counts[element] || 0) + 1;
      }
      const sets = [];
      for (const element of Object.keys(counts)) {
        const pieces = counts[element];
        if (pieces >= 2) sets.push({ element, pieces, power: pieces >= 3 ? 3 : 1 });
      }
      return sets;
    }

    function setBonusPower() {
      return activeSetBonuses().reduce((sum, set) => sum + set.power, 0);
    }

    function resistedDamage(damage) {
      return state.resistanceTurns > 0 ? Math.max(1, Math.ceil(damage / 2)) : damage;
    }

    function waterAdapted() {
      return hasAnyEquippedNamed("talisman", ["water", "eel"]) || hasEquippedNamed("ring", "flight") || hasEquippedNamed("amulet", "air");
    }

    function fireAdapted() {
      return hasEquippedNamed("talisman", "dragon") || hasEquippedNamed("armour", "fire dragon") || hasEquippedElement("fire");
    }

    function poisonAdapted() {
      return hasEquippedNamed("armour", "swamp dragon") || hasEquippedElement("poison") || hasEquippedNamed("amulet", "alchemy");
    }

    function coldAdapted() {
      return hasEquippedNamed("armour", "ice dragon")
        || hasEquippedElement("cold")
        || hasEquippedNamed("ring", "ice")
        || hasEquippedNamed("amulet", "four winds");
    }

    function electricAdapted() {
      return hasEquippedElement("elec")
        || hasEquippedNamed("amulet", "air")
        || hasEquippedNamed("amulet", "four winds")
        || hasEquippedNamed("ring", "air");
    }

    function acidAdapted() {
      return hasEquippedElement("acid") || hasEquippedNamed("ring", "corrosion");
    }

    function partyElementDamage(damage, element) {
      if (!element) return damage;
      const resisted = resistedDamage(damage);
      if (element === "fire" && fireAdapted()) return Math.max(1, Math.ceil(resisted / 2));
      if (element === "poison" && poisonAdapted()) return Math.max(1, Math.ceil(resisted / 2));
      if (element === "cold" && coldAdapted()) return Math.max(1, Math.ceil(resisted / 2));
      if (element === "elec" && electricAdapted()) return Math.max(1, Math.ceil(resisted / 2));
      if (element === "acid" && acidAdapted()) return Math.max(1, Math.ceil(resisted / 2));
      return resisted;
    }

    function monsterElementDamage(monster, damage, element) {
      if (!element) return damage;
      const resist = monster.resists?.[element] || 0;
      if (resist >= 3) return 0;
      if (resist === 2) return Math.max(1, Math.ceil(damage / 3));
      if (resist === 1) return Math.max(1, Math.ceil(damage / 2));
      if (resist < 0) return Math.ceil(damage * 1.5);
      return damage;
    }

    function monsterDamageNote(baseDamage, damage) {
      if (damage === 0) return " It resists.";
      if (damage > baseDamage) return " Vulnerable.";
      if (damage < baseDamage) return " Resisted.";
      return "";
    }

    function partyDamageNote(hit) {
      return hit.damage < hit.baseDamage ? " Resisted." : "";
    }

    return {
      resources,
      dirs,
      viewFrames,
      geometry,
      state,
      els,
      imageCache,
      viewportCanvas: null,
      viewportContext: null,
      // Per-turn hooks registered by feature modules; advanceTurn iterates these
      // each turn so new systems can tick without editing monster_ai directly.
      turnHooks: [],
      effectTimer: 0,
      toastTimer: 0,
      critFlashTimer: 0,
      shakeTimer: 0,
      keyOf,
      escapeHtml,
      currentFloor,
      currentFloorState,
      currentAssets,
      cellAt,
      setCellAt,
      dirAt,
      doorCellAt,
      closedDoorAt,
      mapKind,
      isFrozenTile,
      bridgedTile,
      barricadeAt,
      terrainAt,
      mapContains,
      boundaryWallCell,
      solidAt,
      monsterAt,
      allyAt,
      itemAt,
      trapAt,
      decorAt,
      decorKey,
      usedDecor,
      decorUsed,
      markDecorUsed,
      cloudAt,
      cloudBlocksLine,
      stairsAt,
      liveMember,
      liveMembers,
      equipmentPower,
      equippedItems,
      memberPower,
      estimatedPartyDamage,
      combatPreview,
      itemWeight,
      carriedWeight,
      carryCapacity,
      isOverEncumbered,
      hasEquippedNamed,
      hasAnyEquippedNamed,
      hasEquippedElement,
      activeSetBonuses,
      setBonusPower,
      resistedDamage,
      waterAdapted,
      fireAdapted,
      poisonAdapted,
      coldAdapted,
      electricAdapted,
      acidAdapted,
      partyElementDamage,
      monsterElementDamage,
      monsterDamageNote,
      partyDamageNote,
    };
  };
}());
