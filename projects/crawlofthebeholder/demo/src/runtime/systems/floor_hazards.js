(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installFloorHazards = function (context) {
    with (context) {
      // Deterministic per-floor ambient hazard. Derived from floor id so the
      // same dungeon always has the same flavor, plus an NG+ shift for variety.
      const HAZARDS = {
        none: { id: "none", name: "" },
        dark: { id: "dark", name: "Darkness", description: "Vision is halved here." },
        frozen: { id: "frozen", name: "Frozen", description: "Ice underfoot — moves sometimes slip." },
        haunted: { id: "haunted", name: "Haunted", description: "Restless dead wander more often." },
        cursed: { id: "cursed", name: "Cursed air", description: "Healing is less effective here." }
      };

      function hashString(text) {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
        return hash >>> 0;
      }

      function floorHazardId(floorIndex) {
        const floor = resources.floors[floorIndex];
        if (!floor) return "none";
        // D:1 is always calm so new players aren't blindsided.
        if (floorIndex === 0) return "none";
        const ng = state.ascension || 0;
        const seed = hashString(`${floor.id}|haz|${ng}`);
        // ~45% of floors are calm; the rest pick one of four hazards.
        const roll = seed % 100;
        if (roll < 55) return "none";
        const pick = (seed >> 7) % 4;
        return ["dark", "frozen", "haunted", "cursed"][pick];
      }

      function currentHazard() {
        return HAZARDS[floorHazardId(state.floorIndex)] || HAZARDS.none;
      }

      function hazardActive(id) {
        if (context.hazardsDisabled) return false;
        return floorHazardId(state.floorIndex) === id;
      }

      // Hooks queried by other systems:
      function hazardVisionDelta() {
        return hazardActive("dark") ? -2 : 0;
      }

      function hazardSlipChance() {
        return hazardActive("frozen") ? 0.18 : 0;
      }

      function hazardWanderBonus() {
        return hazardActive("haunted") ? 0.25 : 0;
      }

      function hazardHealScale() {
        return hazardActive("cursed") ? 0.5 : 1;
      }

      Object.assign(context, {
        HAZARDS,
        floorHazardId,
        currentHazard,
        hazardActive,
        hazardVisionDelta,
        hazardSlipChance,
        hazardWanderBonus,
        hazardHealScale
      });
    }
  };
}());
