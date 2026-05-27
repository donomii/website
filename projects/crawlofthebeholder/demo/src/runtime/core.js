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
      turnCount: 0,
      victory: false,
      defeated: false,
      effects: [],
      lastLoggedMessage: "",
      messageLog: [],
      message: "A bat blocks the entry. Stairs descend nearby."
    };

    const els = {
      viewport: document.getElementById("viewport"),
      party: document.getElementById("party"),
      map: document.getElementById("map"),
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
      logCount: document.getElementById("logCount")
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
      if (cell === "x" || cell === " ") return "wall";
      return "floor";
    }

    function terrainAt(x, y) {
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
      return mapKind(x, y) !== "floor";
    }

    function monsterAt(x, y) {
      return currentFloorState().monsters.find((monster) => monster.x === x && monster.y === y && monster.hp > 0);
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
      return cloudAt(x, y)?.kind === "fog";
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
      return member.power + gearPower + buffPower;
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
      effectTimer: 0,
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
      terrainAt,
      mapContains,
      boundaryWallCell,
      solidAt,
      monsterAt,
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
      hasEquippedNamed,
      hasAnyEquippedNamed,
      hasEquippedElement,
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
