(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Constellations: a slow celestial cycle. One sign is ascendant at a time and
  // rotates every CYCLE_TURNS, each lending the party a small themed edge —
  // power, defense, or bonus experience. Purely passive and deterministic in
  // order (no RNG), so it reads the same across a run.
  window.CotBRuntime.installConstellations = function installConstellations(context) {
    with (context) {
      const CYCLE_TURNS = 30;
      const SIGNS = [
        { key: "warrior",  label: "the Warrior",  power: 1, defense: 0, xp: 0 },
        { key: "tortoise", label: "the Tortoise", power: 0, defense: 1, xp: 0 },
        { key: "scholar",  label: "the Scholar",  power: 0, defense: 0, xp: 5 },
        { key: "twins",    label: "the Twins",    power: 1, defense: 1, xp: 0 }
      ];

      context.CONSTELLATION_SIGNS = SIGNS;

      if (typeof state.skyIndex !== "number") state.skyIndex = 0;
      if (typeof state.skyTimer !== "number") state.skyTimer = 0;

      function currentSign() {
        return SIGNS[(state.skyIndex || 0) % SIGNS.length];
      }

      function constellationPowerBonus(_member) {
        if (context.constellationsDisabled) return 0;
        return currentSign().power;
      }

      function constellationDefenseBonus() {
        if (context.constellationsDisabled) return 0;
        return currentSign().defense;
      }

      function constellationXpBonus() {
        if (context.constellationsDisabled) return 0;
        return currentSign().xp;
      }

      function constellationName() {
        if (context.constellationsDisabled) return null;
        return currentSign().label;
      }

      function tickConstellations(messages) {
        if (context.constellationsDisabled) return;
        state.skyTimer = (state.skyTimer || 0) + 1;
        if (state.skyTimer >= CYCLE_TURNS) {
          state.skyTimer = 0;
          state.skyIndex = ((state.skyIndex || 0) + 1) % SIGNS.length;
          if (messages) messages.push(`The stars wheel — ${currentSign().label} is now ascendant.`);
        }
      }

      context.currentSign                = currentSign;
      context.constellationPowerBonus    = constellationPowerBonus;
      context.constellationDefenseBonus  = constellationDefenseBonus;
      context.constellationXpBonus       = constellationXpBonus;
      context.constellationName          = constellationName;

      turnHooks.push(tickConstellations);
    }
  };
}());
