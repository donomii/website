(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installAllies = function (context) {
    with (context) {
      const MAX_ALLIES = 3;
      const ALLY_LEASH = 8; // won't chase monsters further than this from the party

      function liveAllies() {
        const floorState = currentFloorState();
        return (floorState.allies || []).filter((ally) => ally.hp > 0);
      }

      function allyCount() {
        return liveAllies().length;
      }

      function createAlly(template, options = {}) {
        const floorState = currentFloorState();
        floorState.allies = floorState.allies || [];
        if (liveAllies().length >= MAX_ALLIES) return null;
        state.summonSerial = (state.summonSerial || 0) + 1;
        const maxHp = Math.max(1, options.maxHp ?? template.maxHp ?? template.hp ?? 8);
        const ally = {
          id: options.id || `ally-${state.floorIndex}-${state.summonSerial}`,
          name: options.name || template.name || "ally",
          x: options.x ?? template.x ?? state.x,
          y: options.y ?? template.y ?? state.y,
          maxHp,
          hp: Math.max(1, options.hp ?? maxHp),
          power: Math.max(1, options.power ?? template.power ?? 4),
          attacks: template.attacks ? template.attacks.map((a) => ({ ...a })) : [{ type: "hit", damage: (template.power || 4) * 3 }],
          allyTurns: options.turns ?? 30,
          energy: 0
        };
        floorState.allies.push(ally);
        return ally;
      }

      function nearestMonsterTo(point) {
        const monsters = currentFloorState().monsters.filter((m) => m.hp > 0);
        if (monsters.length === 0) return null;
        let best = null;
        let bestDist = Infinity;
        for (const monster of monsters) {
          const dist = Math.abs(monster.x - point.x) + Math.abs(monster.y - point.y);
          if (dist < bestDist) { bestDist = dist; best = monster; }
        }
        return best ? { monster: best, dist: bestDist } : null;
      }

      function allyCanStep(x, y) {
        if (!mapContains(x, y)) return false;
        if (solidAt(x, y) || closedDoorAt(x, y)) return false;
        if (monsterAt(x, y) || allyAt(x, y)) return false;
        if (x === state.x && y === state.y) return false;
        return true;
      }

      function allyAttack(ally, monster, messages) {
        const base = ally.power + Math.floor(Math.random() * 3);
        const damage = typeof monsterElementDamage === "function" ? monsterElementDamage(monster, base, null) : base;
        monster.hp = Math.max(0, monster.hp - damage);
        if (typeof addDamageMark === "function") addDamageMark(monster, null, damage);
        if (typeof addEffect === "function") addEffect("impact", [{ x: monster.x, y: monster.y }]);
        const seen = currentFloorState().discovered.has(keyOf(ally.x, ally.y)) || currentFloorState().discovered.has(keyOf(monster.x, monster.y));
        if (seen) messages.push(`${ally.name} strikes ${monster.name} for ${damage}.`);
        if (monster.hp === 0 && typeof killMonster === "function") {
          const note = killMonster(monster);
          if (note && seen) messages.push(note);
        }
      }

      function stepAllyToward(ally, target) {
        const options = [
          { x: ally.x + Math.sign(target.x - ally.x), y: ally.y },
          { x: ally.x, y: ally.y + Math.sign(target.y - ally.y) }
        ].filter((step) => (step.x !== ally.x || step.y !== ally.y) && allyCanStep(step.x, step.y))
          .sort((a, b) => (Math.abs(a.x - target.x) + Math.abs(a.y - target.y)) - (Math.abs(b.x - target.x) + Math.abs(b.y - target.y)));
        if (options[0]) { ally.x = options[0].x; ally.y = options[0].y; return true; }
        return false;
      }

      function runAllyTurns(messages) {
        const floorState = currentFloorState();
        if (!floorState.allies || floorState.allies.length === 0) return;
        for (const ally of [...floorState.allies]) {
          if (ally.hp <= 0) continue;
          // Expiry: the bond fades over time.
          if (typeof ally.allyTurns === "number") {
            ally.allyTurns -= 1;
            if (ally.allyTurns <= 0) {
              if (floorState.discovered.has(keyOf(ally.x, ally.y))) messages.push(`${ally.name} fades away.`);
              ally.hp = 0;
              continue;
            }
          }
          const near = nearestMonsterTo(ally);
          if (near && near.dist === 1) {
            allyAttack(ally, near.monster, messages);
            continue;
          }
          if (near && near.dist <= ALLY_LEASH) {
            if (!stepAllyToward(ally, near.monster)) {
              // Blocked — try to follow the party instead.
              stepAllyToward(ally, { x: state.x, y: state.y });
            }
            // Attack if the step brought it adjacent.
            const after = nearestMonsterTo(ally);
            if (after && after.dist === 1) allyAttack(ally, after.monster, messages);
            continue;
          }
          // No monster in range — loosely follow the party.
          if (Math.abs(ally.x - state.x) + Math.abs(ally.y - state.y) > 2) {
            stepAllyToward(ally, { x: state.x, y: state.y });
          }
        }
        // Prune dead/expired allies.
        floorState.allies = floorState.allies.filter((a) => a.hp > 0);
      }

      // Let the party swap places with an adjacent ally instead of being blocked.
      function tryAllySwap(nextX, nextY) {
        const ally = allyAt(nextX, nextY);
        if (!ally) return false;
        ally.x = state.x;
        ally.y = state.y;
        state.x = nextX;
        state.y = nextY;
        return true;
      }

      Object.assign(context, {
        MAX_ALLIES,
        liveAllies,
        allyCount,
        createAlly,
        nearestMonsterTo,
        allyCanStep,
        allyAttack,
        runAllyTurns,
        tryAllySwap
      });
    }
  };
}());
