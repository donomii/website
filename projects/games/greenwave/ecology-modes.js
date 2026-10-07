(function (root) {
  "use strict";
  const tool = (id, label, mark, help) => ({ id, label, mark, help });
  const stat = (label, value, help) => ({ label, value: String(value), help });
  const rules = root.EcologyTypes.RULES;

  root.EcologyModes = Object.freeze({
    watershed: {
      title: "Watershed", number: "05", theme: "water", Model: root.Watershed.WatershedModel,
      subtitle: "Trace water through a dry landscape. A channel is a promise; a forest is the answer.",
      goal: "Water all three gold-ringed valleys until each supports mature forest. Coverage alone does not win.",
      instruction: "Choose a tool, then click a tile. Each valid placement advances one season; Let rain fall advances without building.",
      note: "Start at the blue spring on the left. Channels connect edge-to-edge and flow downhill or along equal heights; small numbers are terrain heights. Branch at column 10 to reach the valley rings beside it. Rain falls for two beats, then pauses for two.",
      legend: "≋ Spring · ⌁ Channel · ≈ Pond · ◎ Valley goal · Blue outline: water or moist soil. Trees retain four beats of moisture; bare soil retains two. Growth stays when soil dries.",
      waitLabel: "Let rain fall", waitHelp: "Advance one season without placing anything. Watch rain pulses travel one connected tile per beat.",
      tools: [
        tool("channel", "Dig channel", "⌁", "Connect a shallow waterway to the spring. Carries rain and holds water for two beats."),
        tool("pond", "Form pond", "≈", "A waterway that holds four beats of water, buffering the dry interval."),
        tool("tree", "Plant tree", "♠", "Plant on soil beside a waterway. Trees hold moisture longer and mature over three wet seasons."),
        tool("fill", "Replace soil", "▧", "Fill a channel or pond to reroute water. The spring and valley goals cannot be filled.")
      ],
      readouts: model => {
        const s = model.snapshot();
        return [stat("Season", s.turn, "One per successful action or rain step."),
          stat("Valleys restored", `${s.restored}/3`, "All three need mature forest and moist soil at the same time."),
          stat("Next weather", s.raining ? "Rain" : "Dry", "Two rainy beats followed by two dry beats. Ponds buffer the cycle.")];
      }
    },
    corridors: {
      title: "Wildlife Corridors", number: "06", theme: "wildlife", Model: root.Corridors.CorridorsModel,
      subtitle: "A landscape becomes a home when life can move through it.",
      goal: "Help all three animals reach their matching eastern shelters, with all three routes still connected.",
      instruction: "Choose vegetation, then click to plant a tile and advance one season. Animals walk two route tiles each season.",
      note: "♧ Rabbits use meadow or shrubs. ↟ Birds use shrubs or mature woodland. ♜ Deer use meadow or mature woodland. Connect edges, not corners. Rocks require detours. Outlined tiles show completed paths; animal symbols show their positions.",
      legend: "⌂ Shelter · ◆ Rock · 〃 Meadow · ♣ Shrubs · ♠ Woodland. Young woodland takes two seasons to become passable. Animals carry seeds into neighboring bare soil along their journeys.",
      waitLabel: "Watch migration", waitHelp: "Advance one season: woodland matures and animals take two more steps along connected routes.",
      tools: [
        tool("meadow", "Sow meadow", "〃", "Open ground for rabbits and deer; birds need shrubs or woodland."),
        tool("shrub", "Plant shrubs", "♣", "Cover for rabbits and birds; deer need meadow or woodland."),
        tool("forest", "Plant woodland", "♠", "After two seasons, supports birds and deer. Rabbits need meadow or shrubs.")
      ],
      readouts: model => {
        const s = model.snapshot();
        return [stat("Season", s.turn, "One per planting or migration step."),
          stat("Routes connected", `${s.connected}/3`, "All three need a suitable edge-connected path at completion."),
          stat("Migrations arrived", `${s.arrived}/3`, s.routes.map(route => `${route.label}: ${route.arrived ? "arrived" : route.connected ? "travelling" : "needs a route"}`).join(" · "))];
      }
    },
    mosaic: {
      title: "Forest Mosaic", number: "07", theme: "mosaic", Model: root.Mosaic.MosaicModel,
      subtitle: "Leave room for clearings, thickets, wetlands, and shade.",
      goal: "Keep one edge-connected patch with at least 6 meadow, 4 shrub, 6 forest, and 4 wetland tiles for three consecutive seasons.",
      instruction: "Plant a habitat, then use Protect / release to hold it at that stage. Each successful click advances one season.",
      note: "Unprotected meadow becomes shrubs after six seasons; shrubs become forest after six more. Planting is free, so you can reshape the mosaic. Protect meadow and shrubs promptly. Only tiles in the largest connected patch count toward the goal.",
      legend: "〃 Meadow · ♣ Shrubs · ♠ Forest · ≈ Wetland · ⌑ Basin. A small number is seasons until succession; ◇ means protected. Wetland must occupy a basin. Protection toggles on or off.",
      waitLabel: "Observe a season", waitHelp: "Advance without planting. Unprotected patches mature; a balanced patch earns one sustained season.",
      tools: [
        tool("meadow", "Sow meadow", "〃", "Food and flowers for pollinators. Becomes shrubs after six unprotected seasons."),
        tool("shrub", "Establish shrubs", "♣", "Low shelter and berries. Becomes forest after six unprotected seasons."),
        tool("forest", "Plant forest", "♠", "Lasting canopy and shade. Stable without protection; variety still matters."),
        tool("wetland", "Restore wetland", "≈", "Lasting wet habitat. Plant only in the six blue basin tiles."),
        tool("protect", "Protect / release", "◇", "Click a planted tile to freeze its habitat, or click again to resume natural succession.")
      ],
      readouts: model => {
        const s = model.snapshot();
        return [stat("Season", s.turn, "One per planting, protection change, or observation."),
          stat("Balanced seasons", `${s.stable}/${rules.mosaic.stableSeasons}`, "Keep all four habitat requirements together for three consecutive seasons."),
          ...Object.entries(rules.mosaic.needs).map(([kind, needed]) => stat(kind, `${s.counts[kind]}/${needed}`, "Tiles of this habitat in the largest edge-connected living patch."))];
      }
    },
    spring: {
      title: "Travelling Spring", number: "08", theme: "spring", Model: root.TravellingSpring.SpringModel,
      subtitle: "What looks like an ending is a root waiting to remember.",
      goal: "Visit all three star-marked ancient groves and make six different old path tiles flower on your return.",
      instruction: "Click a neighboring tile, use the direction buttons, or press arrows / W A S D. Each move advances one beat; there is no timer.",
      note: "The bright star is your wavefront. Behind it, grass grows into trees and then rests after six beats without warmth. Revisit a tile at least four beats after your previous visit to flower and scatter seeds. Each flowering tile counts only once; immediate backtracking is safe but does not earn a reunion.",
      legend: "✦ Wavefront · ☆ Ancient grove · ★ Visited grove · ◌ Dormant roots · ✿ Flowering reunion · ◆ Rock. Roots are permanent even when greenery rests. A reunion wakes neighboring roots and seeds bare soil.",
      waitLabel: "", waitHelp: "",
      tools: [tool("move", "Guide the spring", "✦", "Move one tile at a time. Loop around and return to older roots for flowering reunions.")],
      readouts: model => {
        const s = model.snapshot();
        return [stat("Spring beat", s.turn, "One per successful movement. The edge and rocks do not spend a beat."),
          stat("Ancient groves", `${s.groves}/3`, "Step onto all three outlined star tiles to awaken them."),
          stat("Flowering reunions", `${s.blooms}/${rules.spring.bloomGoal}`, "Six different revisited tiles must flower. Repeated blooms on one tile do not count again.")];
      }
    }
  });
})(typeof globalThis === "object" ? globalThis : this);
