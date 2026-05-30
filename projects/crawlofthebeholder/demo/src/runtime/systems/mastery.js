(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Weapon mastery & combat stances: the party grows proficient with each
  // weapon family the more they swing it, can adopt aggressive/defensive/
  // balanced stances, backstabs unaware foes, fights harder at death's door,
  // and can sound a rallying cry. Gated behind context.masteryDisabled so the
  // historical balance suite is untouched (opt-in via { mastery: true }).
  window.CotBRuntime.installMastery = function (context) {
    with (context) {
      const MAX_MASTERY = 5;
      const WEAPON_TYPES = [
        { type: "dagger", keys: ["dagger", "knife", "rapier", "stiletto"] },
        { type: "blade", keys: ["sword", "blade", "sabre", "scimitar", "katana", "falchion", "broadsword"] },
        { type: "axe", keys: ["axe", "hatchet"] },
        { type: "blunt", keys: ["mace", "hammer", "flail", "club", "morningstar", "maul", "cudgel"] },
        { type: "polearm", keys: ["spear", "lance", "halberd", "glaive", "trident", "pike", "scythe", "partisan"] },
        { type: "staff", keys: ["staff", "rod", "quarterstaff"] },
        { type: "whip", keys: ["whip", "lash", "scourge"] }
      ];
      const STANCES = {
        balanced: { name: "balanced", power: 0, defense: 0, blurb: "even footing" },
        aggressive: { name: "aggressive", power: 2, defense: -1, blurb: "all-out attack" },
        defensive: { name: "defensive", power: -1, defense: 2, blurb: "shields up" }
      };
      const STANCE_ORDER = ["balanced", "aggressive", "defensive"];

      function weaponType(weapon) {
        if (!weapon) return "unarmed";
        const name = String(weapon.category || weapon.name || "").toLowerCase();
        for (const entry of WEAPON_TYPES) {
          if (entry.keys.some((key) => name.includes(key))) return entry.type;
        }
        return "other";
      }

      function masteryStore() {
        if (!state.weaponMastery) state.weaponMastery = {};
        return state.weaponMastery;
      }

      function masteryXp(type) {
        return masteryStore()[type] || 0;
      }

      // Diminishing returns: level = floor(sqrt(xp / 8)), capped at MAX_MASTERY.
      function masteryLevel(type) {
        if (!type || type === "unarmed") return 0;
        return Math.min(MAX_MASTERY, Math.floor(Math.sqrt(masteryXp(type) / 8)));
      }

      function gainWeaponMastery(type, amount = 1) {
        if (!type || type === "unarmed") return 0;
        const before = masteryLevel(type);
        masteryStore()[type] = masteryXp(type) + amount;
        const after = masteryLevel(type);
        if (after > before && typeof showToast === "function") showToast(`Weapon mastery: ${type} ${after}.`);
        return after;
      }

      function gainAttackMastery(attackers, target) {
        if (context.masteryDisabled || !Array.isArray(attackers)) return;
        const counted = new Set();
        for (const member of attackers) {
          const type = weaponType(member?.weapon);
          if (type === "unarmed" || counted.has(type)) continue;
          counted.add(type);
          gainWeaponMastery(type, 1);
        }
      }

      function currentStance() {
        return STANCES[state.stance || "balanced"] || STANCES.balanced;
      }

      function setStance(name) {
        if (!STANCES[name]) return false;
        state.stance = name;
        return true;
      }

      function cycleStance() {
        const next = STANCE_ORDER[(STANCE_ORDER.indexOf(state.stance || "balanced") + 1) % STANCE_ORDER.length];
        state.stance = next;
        return next;
      }

      function stancePowerBonus() {
        return context.masteryDisabled ? 0 : currentStance().power;
      }

      // Signed: defensive subtracts incoming damage, aggressive adds a little.
      function stanceDefenseBonus() {
        return context.masteryDisabled ? 0 : currentStance().defense;
      }

      // Flat melee bonus folded into each attacker's blow.
      function meleeMasteryBonus(member, target) {
        if (context.masteryDisabled) return 0;
        let bonus = masteryLevel(weaponType(member?.weapon));
        bonus += stancePowerBonus();
        // Backstab: a foe that hasn't noticed the party is wide open.
        if (target && target.alerted === false) bonus += 3;
        // Last stand: a badly wounded fighter swings with desperate force.
        if (member && member.maxHp > 0 && member.hp / member.maxHp <= 0.3) bonus += 2;
        return bonus;
      }

      // Rallying cry: grant the whole party Might, on a cooldown.
      function rallyParty() {
        const cooldownLeft = (state.rallyReadyAt || 0) - (state.turnCount || 0);
        if (cooldownLeft > 0) return { ok: false, cooldownLeft };
        state.mightTurns = Math.max(state.mightTurns || 0, 8);
        state.rallyReadyAt = (state.turnCount || 0) + 30;
        return { ok: true };
      }

      // ----- Player-facing action wrappers -----
      function cycleStanceAction() {
        const next = cycleStance();
        const stance = STANCES[next];
        setMessage(`Stance: ${next} (${stance.blurb}).`);
        if (typeof renderChrome === "function") renderChrome();
      }

      function rallyPartyAction() {
        const result = rallyParty();
        if (!result.ok) {
          setMessage(`The party can't rally again yet (${result.cooldownLeft} turns).`);
          return;
        }
        setMessage("A rallying cry surges through the party. Might rises!");
        if (typeof addEffect === "function") addEffect("magic", [{ x: state.x, y: state.y }]);
        advanceTurn();
        render();
      }

      Object.assign(context, {
        WEAPON_TYPES,
        STANCES,
        weaponType,
        masteryXp,
        masteryLevel,
        gainWeaponMastery,
        gainAttackMastery,
        currentStance,
        setStance,
        cycleStance,
        stancePowerBonus,
        stanceDefenseBonus,
        meleeMasteryBonus,
        rallyParty,
        cycleStanceAction,
        rallyPartyAction
      });
    }
  };
}());
