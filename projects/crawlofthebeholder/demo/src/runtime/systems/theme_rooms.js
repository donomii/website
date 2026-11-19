(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Themed dungeon rooms, distinct corridor dressing, and procedural furniture.
  //
  // DCSS relies on intricate top-down maps without furniture, which makes
  // first-person exploration feel repetitive when every room and corridor uses
  // identical stone tiles. This module deterministically segments every floor
  // into distinct rooms vs corridors, assigns unmistakable architectural themes
  // (floor patterns, ceiling beams, wall wainscoting/banners/ivy, ambient light),
  // and furnishes rooms with cached pixel-art furniture sprites rendered in both
  // 2D first-person and VR tabletop views.
  window.CotBRuntime.installThemeRooms = function installThemeRooms(context) {
    with (context) {
      const ROOM_THEMES = [
        {
          id: "library",
          name: "Grand Library",
          shortLabel: "Library",
          floorPattern: "rug",
          floorTint: "rgba(96, 60, 32, 0.24)",
          rugColor: "rgba(42, 62, 118, 0.72)",
          rugBorder: "rgba(218, 176, 86, 0.85)",
          wallTint: "rgba(74, 46, 26, 0.22)",
          wallTrimStyle: "bookshelves",
          trimColor: "rgba(116, 74, 40, 0.82)",
          trimAccent: "rgba(216, 174, 88, 0.65)",
          ceilingTint: "rgba(56, 36, 20, 0.28)",
          ceilingBeams: true,
          beamColor: "rgba(88, 54, 28, 0.72)",
          ambientColor: [236, 174, 88],
          ambientAlpha: 0.08,
          wallProps: ["bookshelf", "bookshelf", "candelabra"],
          centerProps: ["study_desk", "brazier"],
          cornerProps: ["candelabra", "bookshelf"]
        },
        {
          id: "banquet",
          name: "Banquet Hall",
          shortLabel: "Banquet",
          floorPattern: "checker",
          floorTint: "rgba(124, 78, 44, 0.2)",
          checkerLight: "rgba(214, 184, 138, 0.16)",
          checkerDark: "rgba(32, 22, 16, 0.26)",
          wallTint: "rgba(104, 42, 32, 0.18)",
          wallTrimStyle: "banners",
          trimColor: "rgba(148, 38, 38, 0.78)",
          trimAccent: "rgba(232, 186, 86, 0.82)",
          ceilingTint: "rgba(64, 38, 22, 0.25)",
          ceilingBeams: true,
          beamColor: "rgba(96, 58, 30, 0.78)",
          ambientColor: [248, 164, 76],
          ambientAlpha: 0.1,
          wallProps: ["barrel", "candelabra", "bench"],
          centerProps: ["banquet_table", "brazier"],
          cornerProps: ["barrel", "brazier"]
        },
        {
          id: "armory",
          name: "Guard Armory",
          shortLabel: "Armory",
          floorPattern: "stone",
          floorTint: "rgba(58, 68, 82, 0.26)",
          borderColor: "rgba(148, 162, 178, 0.42)",
          wallTint: "rgba(54, 64, 78, 0.24)",
          wallTrimStyle: "iron",
          trimColor: "rgba(82, 92, 108, 0.82)",
          trimAccent: "rgba(186, 198, 212, 0.58)",
          ceilingTint: "rgba(38, 44, 56, 0.3)",
          ceilingBeams: true,
          beamColor: "rgba(74, 82, 96, 0.72)",
          ambientColor: [158, 182, 214],
          ambientAlpha: 0.08,
          wallProps: ["weapon_rack", "weapon_rack", "crate"],
          centerProps: ["anvil", "brazier"],
          cornerProps: ["crate", "barrel"]
        },
        {
          id: "alchemy",
          name: "Alchemist's Lab",
          shortLabel: "Alchemy Lab",
          floorPattern: "runes",
          floorTint: "rgba(34, 86, 78, 0.22)",
          runeColor: "rgba(86, 228, 186, 0.52)",
          wallTint: "rgba(32, 74, 68, 0.22)",
          wallTrimStyle: "arcane",
          trimColor: "rgba(56, 124, 114, 0.72)",
          trimAccent: "rgba(104, 242, 198, 0.68)",
          ceilingTint: "rgba(22, 54, 52, 0.28)",
          ceilingBeams: false,
          ambientColor: [78, 224, 178],
          ambientAlpha: 0.1,
          wallProps: ["alchemy_bench", "bookshelf", "crate"],
          centerProps: ["cauldron", "alchemy_bench"],
          cornerProps: ["barrel", "candelabra"]
        },
        {
          id: "chapel",
          name: "Sanctuary",
          shortLabel: "Sanctuary",
          floorPattern: "rug",
          floorTint: "rgba(168, 146, 104, 0.18)",
          rugColor: "rgba(138, 28, 36, 0.74)",
          rugBorder: "rgba(238, 198, 94, 0.9)",
          wallTint: "rgba(128, 110, 76, 0.16)",
          wallTrimStyle: "arches",
          trimColor: "rgba(198, 178, 134, 0.68)",
          trimAccent: "rgba(240, 206, 112, 0.76)",
          ceilingTint: "rgba(92, 78, 54, 0.2)",
          ceilingBeams: true,
          beamColor: "rgba(176, 156, 114, 0.55)",
          ambientColor: [246, 214, 128],
          ambientAlpha: 0.1,
          wallProps: ["candelabra", "pew", "urn"],
          centerProps: ["altar_stone", "pew"],
          cornerProps: ["candelabra", "urn"]
        },
        {
          id: "crypt",
          name: "Catacomb",
          shortLabel: "Catacomb",
          floorPattern: "mosaic",
          floorTint: "rgba(48, 62, 84, 0.28)",
          borderColor: "rgba(138, 166, 204, 0.42)",
          wallTint: "rgba(42, 54, 76, 0.28)",
          wallTrimStyle: "crypt",
          trimColor: "rgba(116, 130, 150, 0.68)",
          trimAccent: "rgba(124, 214, 248, 0.58)",
          ceilingTint: "rgba(26, 36, 54, 0.34)",
          ceilingBeams: true,
          beamColor: "rgba(86, 98, 118, 0.62)",
          ambientColor: [112, 178, 232],
          ambientAlpha: 0.1,
          wallProps: ["urn", "blue_brazier", "sarcophagus"],
          centerProps: ["sarcophagus", "blue_brazier"],
          cornerProps: ["urn", "blue_brazier"]
        },
        {
          id: "conservatory",
          name: "Conservatory",
          shortLabel: "Conservatory",
          floorPattern: "moss",
          floorTint: "rgba(44, 98, 52, 0.24)",
          mossColor: "rgba(74, 152, 72, 0.46)",
          wallTint: "rgba(40, 82, 46, 0.22)",
          wallTrimStyle: "ivy",
          trimColor: "rgba(56, 124, 58, 0.78)",
          trimAccent: "rgba(236, 194, 98, 0.72)",
          ceilingTint: "rgba(32, 68, 38, 0.22)",
          ceilingBeams: true,
          beamColor: "rgba(74, 118, 64, 0.62)",
          ambientColor: [106, 204, 114],
          ambientAlpha: 0.1,
          wallProps: ["planter", "planter", "garden_bench"],
          centerProps: ["garden_bench", "planter"],
          cornerProps: ["planter", "urn"]
        },
        {
          id: "treasury",
          name: "Treasury Vault",
          shortLabel: "Treasury",
          floorPattern: "marble",
          floorTint: "rgba(132, 102, 46, 0.22)",
          borderColor: "rgba(242, 198, 84, 0.72)",
          wallTint: "rgba(104, 78, 34, 0.22)",
          wallTrimStyle: "gilded",
          trimColor: "rgba(198, 154, 56, 0.8)",
          trimAccent: "rgba(255, 224, 124, 0.82)",
          ceilingTint: "rgba(72, 54, 24, 0.24)",
          ceilingBeams: true,
          beamColor: "rgba(182, 142, 58, 0.68)",
          ambientColor: [248, 204, 92],
          ambientAlpha: 0.1,
          wallProps: ["coffer", "crate", "barrel"],
          centerProps: ["pedestal", "coffer"],
          cornerProps: ["brazier", "coffer"]
        }
      ];

      const THEME_BY_ID = new Map(ROOM_THEMES.map((theme) => [theme.id, theme]));

      const DCSS_DNGN = "vendor/crawl/crawl-ref/source/rltiles/dngn";
      const FURNITURE_CATALOG = {
        bookshelf: { name: "oak bookshelf", shortName: "bookshelf", tall: true, widthScale: 0.54, heightScale: 0.76, interact: "You leaf through dusty dungeon treatises — ancient marginalia hint at chambers ahead." },
        study_desk: { name: "scholar's desk", shortName: "study desk", tall: false, widthScale: 0.56, heightScale: 0.5, interact: "Wax drips beside an open grimoire. A warm candle still burns on the corner." },
        lectern: { name: "carved lectern", shortName: "lectern", tall: true, widthScale: 0.44, heightScale: 0.66, dcssTile: `${DCSS_DNGN}/vaults/lectern.png`, interact: "An ancient leather-bound codex rests open on a carved reading lectern." },
        banquet_table: { name: "banquet table", shortName: "feast table", tall: false, widthScale: 0.64, heightScale: 0.5, heal: 3, interact: "A long oak feast table laden with pewter goblets and preserved provisions." },
        bench: { name: "oak bench", shortName: "bench", tall: false, widthScale: 0.5, heightScale: 0.4, interact: "A scarred timber bench pushed back from the hall." },
        barrel: { name: "oak barrels", shortName: "barrels", tall: false, widthScale: 0.48, heightScale: 0.54, interact: "Iron-hooped casks smell faintly of dark ale and cedar." },
        crate: { name: "supply crates", shortName: "crates", tall: false, widthScale: 0.48, heightScale: 0.5, interact: "Heavy iron-cornered supply crates stacked neatly against the masonry." },
        brazier: { name: "glowing brazier", shortName: "brazier", tall: false, widthScale: 0.42, heightScale: 0.62, heal: 2, light: true, interact: "Warm amber embers crackle in the iron fire bowl, driving back the dungeon chill." },
        blue_brazier: { name: "pale-flame brazier", shortName: "crypt brazier", tall: false, widthScale: 0.42, heightScale: 0.62, light: true, interact: "Cold sapphire flames hiss silently without giving off heat." },
        weapon_rack: { name: "weapon rack", shortName: "weapon rack", tall: true, widthScale: 0.52, heightScale: 0.72, might: 3, interact: "Racks of honed blades and iron shields stand ready — you whet your edge (+might)." },
        anvil: { name: "forged anvil", shortName: "anvil", tall: false, widthScale: 0.46, heightScale: 0.48, resistance: 4, interact: "A heavy blacksmith's anvil on a scarred oak block. You hammer a dent from your armour." },
        alchemy_bench: { name: "alchemy bench", shortName: "alchemy bench", tall: false, widthScale: 0.58, heightScale: 0.56, interact: "Glass retorts and emerald phials clink softly along the stained timber workbench." },
        cauldron: { name: "bubbling cauldron", shortName: "cauldron", tall: false, widthScale: 0.48, heightScale: 0.52, resistance: 4, interact: "Luminescent green vapour curls from the iron cauldron, steeling your nerves." },
        pew: { name: "carved pew", shortName: "pew", tall: false, widthScale: 0.56, heightScale: 0.44, interact: "Worn cathedral pews face quietly toward the sanctuary." },
        candelabra: { name: "brass candelabra", shortName: "candelabra", tall: true, widthScale: 0.36, heightScale: 0.74, light: true, interact: "Three beeswax tapers cast steady golden light across the chamber." },
        altar_stone: { name: "velvet-draped altar", shortName: "sanctuary altar", tall: false, widthScale: 0.58, heightScale: 0.58, heal: 4, interact: "A serene carved stone altar draped in crimson velvet brings a moment of calm." },
        sarcophagus: { name: "stone sarcophagus", shortName: "sarcophagus", tall: false, widthScale: 0.56, heightScale: 0.6, dcssTile: `${DCSS_DNGN}/vaults/sarcophagus_sealed.png`, interact: "A weathered stone effigy lies sealed beneath ancient wards." },
        urn: { name: "reliquary urn", shortName: "urn", tall: false, widthScale: 0.36, heightScale: 0.54, interact: "A tall carved urn etched with forgotten dungeon heraldry." },
        planter: { name: "fern planter", shortName: "planter", tall: false, widthScale: 0.46, heightScale: 0.62, dcssTile: `${DCSS_DNGN}/vaults/flower_pot_1.png`, interact: "Lush subterranean ferns and pale golden blossoms spill from a stone urn." },
        garden_bench: { name: "marble bench", shortName: "garden bench", tall: false, widthScale: 0.54, heightScale: 0.44, heal: 2, interact: "A moss-touched marble bench offers a brief breather amidst the foliage." },
        coffer: { name: "banded coffer", shortName: "coffer", tall: false, widthScale: 0.5, heightScale: 0.46, interact: "A heavy brass-bound vault coffer bolted firmly to the flagstones." },
        pedestal: { name: "gilded pedestal", shortName: "pedestal", tall: true, widthScale: 0.4, heightScale: 0.7, interact: "An ornate marble plinth crowns the chamber with a warm golden gleam." },
        torch_sconce: { name: "wall torch", shortName: "torch", tall: false, widthScale: 0.3, heightScale: 0.46, light: true, interact: "A wrought-iron wall torch flickers steadily in its bracket." },
        // Authentic DCSS outdoor branch landmarks
        shoals_statue: { name: "sea-worn statue", shortName: "sea statue", tall: true, widthScale: 0.48, heightScale: 0.74, dcssTile: `${DCSS_DNGN}/vaults/silver_statue_0.png`, interact: "Salt-crusted marble depicts an ancient mariner watching the tide." },
        shoals_pillar: { name: "weathered sea pillar", shortName: "sea pillar", tall: true, widthScale: 0.46, heightScale: 0.76, dcssTile: `${DCSS_DNGN}/statues/crumbled_column_1.png`, interact: "Barnacles cling to the base of a sunken temple column." },
        shoals_fountain: { name: "tidal fountain", shortName: "tidal fountain", tall: false, widthScale: 0.52, heightScale: 0.64, heal: 3, dcssTile: `${DCSS_DNGN}/vaults/fountain_double_decker.png`, interact: "Clear sea-cooled spring water spills down twin stone basins." },
        shoals_lantern: { name: "stone sea lantern", shortName: "sea lantern", tall: true, widthScale: 0.42, heightScale: 0.68, light: true, dcssTile: `${DCSS_DNGN}/vaults/fountain_stone_lantern.png`, interact: "A carved coastal beacon lantern guides ships through the shoals." },
        shoals_spring: { name: "tidal spring", shortName: "spring", tall: false, widthScale: 0.5, heightScale: 0.58, heal: 3, dcssTile: `${DCSS_DNGN}/decor/blue_fountain.png`, interact: "Fresh spring water bubbles up amidst the salt sand." },
        swamp_mangrove: { name: "mangrove tree", shortName: "mangrove", tall: true, widthScale: 0.58, heightScale: 0.82, dcssTile: `${DCSS_DNGN}/trees/mangrove1.png`, interact: "Tangled mangrove roots arch down into the murky fen." },
        swamp_mangrove_b: { name: "gnarled mangrove", shortName: "mangrove", tall: true, widthScale: 0.58, heightScale: 0.82, dcssTile: `${DCSS_DNGN}/trees/mangrove3.png`, interact: "Moss drapes thickly from the twisted swamp boughs." },
        swamp_dead_tree: { name: "drowned cypress", shortName: "dead tree", tall: true, widthScale: 0.54, heightScale: 0.8, dcssTile: `${DCSS_DNGN}/trees/tree_dead3.png`, interact: "Bleached branches claw skyward out of the bog." },
        lair_tree: { name: "cavern oak", shortName: "tree", tall: true, widthScale: 0.58, heightScale: 0.82, dcssTile: `${DCSS_DNGN}/trees/tree4.png`, interact: "A hardy subterranean tree thrives in the damp Lair soil." },
        lair_tree_b: { name: "mossy cavern tree", shortName: "tree", tall: true, widthScale: 0.58, heightScale: 0.82, dcssTile: `${DCSS_DNGN}/trees/tree12.png`, interact: "Thick moss and lichen coat the ancient bark." },
        lair_petrified: { name: "petrified tree", shortName: "petrified tree", tall: true, widthScale: 0.52, heightScale: 0.78, dcssTile: `${DCSS_DNGN}/trees/tree_petrified1.png`, interact: "Mineral-hard stone preserves every knot of the fallen trunk." },
        slime_crystal: { name: "ooze-etched crystal", shortName: "crystal", tall: true, widthScale: 0.46, heightScale: 0.7, dcssTile: `${DCSS_DNGN}/vaults/bedevilled_crystal_abyss_0.png`, interact: "A luminescent crystal formation hums amidst the slime." },
        slime_vat: { name: "alchemical vat", shortName: "vat", tall: false, widthScale: 0.46, heightScale: 0.58, dcssTile: `${DCSS_DNGN}/vaults/bottled_spirits.png`, interact: "Strange viscous reagents shimmer behind thick glass." }
      };

      const furnitureSpriteCache = new Map();

      function hashString(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i += 1) {
          h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
        }
        return h >>> 0;
      }

      // ── Procedural 64x64 pixel-art furniture sprites (cached once) ──────────
      function drawFurnitureArt(ctx, kind) {
        const px = (x, y, w, h, color) => {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
        };
        const circle = (cx, cy, r, color) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        };

        if (kind === "bookshelf") {
          px(8, 4, 48, 56, "#3a2212");
          px(10, 6, 44, 52, "#5a351c");
          px(6, 2, 52, 5, "#6e4223");
          px(7, 56, 50, 5, "#4a2b16");
          const bookColors = ["#a6322c", "#2d5284", "#2f7447", "#c49438", "#6d3a7a", "#8c4a26", "#2a6e74"];
          for (let shelf = 0; shelf < 4; shelf += 1) {
            const sy = 10 + shelf * 12;
            px(12, sy, 40, 9, "#24140a");
            let bx = 13;
            for (let b = 0; b < 7 && bx < 50; b += 1) {
              const bw = 4 + ((shelf * 3 + b) % 3);
              const bh = 7 + ((shelf + b) % 2);
              const col = bookColors[(shelf * 5 + b * 2) % bookColors.length];
              px(bx, sy + (9 - bh), Math.min(bw, 51 - bx), bh, col);
              px(bx, sy + (9 - bh) + 2, Math.min(bw, 51 - bx), 1, "rgba(255,228,150,0.45)");
              bx += bw + 1;
            }
            px(10, sy + 9, 44, 3, "#784928");
          }
          // Small candle on second shelf
          px(44, 24, 3, 5, "#f4ebd0");
          circle(45.5, 22, 2.5, "#ffcf54");
          return;
        }

        if (kind === "study_desk") {
          px(8, 28, 48, 8, "#6e4223");
          px(6, 26, 52, 4, "#8b5630");
          px(10, 36, 6, 24, "#4b2b16");
          px(48, 36, 6, 24, "#4b2b16");
          px(16, 36, 32, 12, "#5c361d");
          px(28, 40, 8, 3, "#d4a64a"); // drawer handle
          // Open tome & parchment
          px(16, 20, 18, 7, "#efe3c2");
          px(24, 20, 2, 7, "#8c6d42");
          px(18, 22, 5, 1, "#5c4a32");
          px(27, 22, 5, 1, "#5c4a32");
          // Candle & inkwell
          px(42, 16, 4, 10, "#f5ecd4");
          circle(44, 13, 4, "rgba(255,196,76,0.45)");
          circle(44, 13, 2.2, "#ffe57a");
          px(36, 22, 4, 4, "#1e2a3a");
          return;
        }

        if (kind === "banquet_table") {
          px(4, 28, 56, 7, "#6b3e1f");
          px(2, 26, 60, 4, "#8a532c");
          // Crimson runner
          px(12, 26, 40, 6, "#9c2628");
          px(14, 27, 36, 1, "#e2b24a");
          px(8, 35, 7, 24, "#482814");
          px(49, 35, 7, 24, "#482814");
          px(15, 44, 34, 4, "#59331a");
          // Goblets, platter, candles
          px(12, 18, 4, 8, "#dfae42");
          px(48, 18, 4, 8, "#dfae42");
          px(24, 20, 16, 6, "#c28246");
          px(22, 24, 20, 3, "#9ca4ad");
          px(31, 14, 2, 12, "#f4ecd4");
          circle(32, 12, 3, "#ffd45c");
          return;
        }

        if (kind === "bench" || kind === "pew" || kind === "garden_bench") {
          const isMarble = kind === "garden_bench";
          const isPew = kind === "pew";
          const topCol = isMarble ? "#cfd5d8" : isPew ? "#7a4926" : "#804e2a";
          const bodyCol = isMarble ? "#9aa3a8" : isPew ? "#573219" : "#5e371b";
          const darkCol = isMarble ? "#6e787d" : "#3a2010";
          if (isPew) {
            px(8, 16, 48, 18, bodyCol);
            px(6, 14, 52, 4, topCol);
            px(12, 20, 40, 2, "#d8aa4a");
          }
          px(6, 34, 52, 6, topCol);
          px(8, 40, 48, 4, bodyCol);
          px(10, 44, 7, 16, darkCol);
          px(47, 44, 7, 16, darkCol);
          if (isMarble) {
            px(10, 34, 10, 3, "#4f8d4e"); // moss accent
            px(44, 48, 6, 4, "#4f8d4e");
          }
          return;
        }

        if (kind === "barrel") {
          const drawBarrel = (ox, oy, w, h) => {
            px(ox + 2, oy, w - 4, h, "#6b3e1f");
            px(ox, oy + 4, w, h - 8, "#7e4b27");
            px(ox + 4, oy + 2, 4, h - 4, "#955c34");
            px(ox, oy + 7, w, 3, "#4a5159");
            px(ox, oy + h - 10, w, 3, "#4a5159");
            px(ox + 2, oy, w - 4, 3, "#9c6238");
          };
          drawBarrel(8, 22, 24, 36);
          drawBarrel(32, 26, 24, 32);
          return;
        }

        if (kind === "crate") {
          const drawCrate = (ox, oy, s) => {
            px(ox, oy, s, s, "#784d28");
            px(ox + 3, oy + 3, s - 6, s - 6, "#966336");
            px(ox, oy, s, 3, "#543419");
            px(ox, oy + s - 3, s, 3, "#543419");
            px(ox, oy, 3, s, "#543419");
            px(ox + s - 3, oy, 3, s, "#543419");
            // Diagonal plank
            ctx.strokeStyle = "#5d3a1c";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(ox + 4, oy + 4);
            ctx.lineTo(ox + s - 4, oy + s - 4);
            ctx.stroke();
            // Iron corner studs
            px(ox + 1, oy + 1, 3, 3, "#8a94a0");
            px(ox + s - 4, oy + 1, 3, 3, "#8a94a0");
            px(ox + 1, oy + s - 4, 3, 3, "#8a94a0");
            px(ox + s - 4, oy + s - 4, 3, 3, "#8a94a0");
          };
          drawCrate(8, 28, 28);
          drawCrate(32, 32, 24);
          drawCrate(18, 12, 20);
          return;
        }

        if (kind === "brazier" || kind === "blue_brazier") {
          const blue = kind === "blue_brazier";
          // Tripod legs
          px(18, 34, 4, 24, "#3b4048");
          px(42, 34, 4, 24, "#3b4048");
          px(30, 36, 4, 23, "#2b2f36");
          px(18, 46, 28, 3, "#505762");
          // Bowl
          px(12, 24, 40, 12, "#424852");
          px(16, 32, 32, 6, "#2c3038");
          px(10, 22, 44, 4, "#67707e");
          // Glow + flames
          circle(32, 18, 15, blue ? "rgba(86,204,255,0.28)" : "rgba(255,144,44,0.32)");
          circle(32, 20, 9, blue ? "#3ea8f5" : "#e65b22");
          circle(27, 17, 5, blue ? "#78d2ff" : "#ff9d36");
          circle(36, 16, 5, blue ? "#78d2ff" : "#ff9d36");
          circle(32, 14, 5, blue ? "#d6f5ff" : "#ffe67a");
          return;
        }

        if (kind === "weapon_rack") {
          px(8, 8, 5, 52, "#593419");
          px(51, 8, 5, 52, "#593419");
          px(6, 14, 52, 4, "#744522");
          px(6, 46, 52, 5, "#744522");
          // Swords & spear
          for (const sx of [17, 27, 45]) {
            px(sx, 10, 3, 36, "#c2ccd6");
            px(sx + 1, 10, 1, 34, "#eef4fa");
            px(sx - 3, 38, 9, 2, "#c89d42");
            px(sx, 40, 3, 6, "#4c2c16");
          }
          // Round shield
          circle(37, 30, 9, "#7d8896");
          circle(37, 30, 6, "#8c2c28");
          circle(37, 30, 2.5, "#e0b650");
          return;
        }

        if (kind === "anvil") {
          px(14, 38, 36, 22, "#633b1d");
          px(16, 40, 32, 18, "#7b4b27");
          px(14, 44, 36, 3, "#494f57");
          // Iron anvil silhouette
          px(16, 22, 34, 8, "#6a7482");
          px(8, 24, 10, 5, "#838f9e"); // horn
          px(22, 30, 20, 8, "#4c545e");
          px(14, 36, 36, 4, "#3b424b");
          // Hammer on top
          px(26, 16, 14, 4, "#7a4a24");
          px(36, 14, 8, 7, "#9ba6b4");
          return;
        }

        if (kind === "alchemy_bench") {
          px(6, 30, 52, 6, "#664023");
          px(4, 28, 56, 4, "#85542f");
          px(8, 36, 6, 24, "#4a2c16");
          px(50, 36, 6, 24, "#4a2c16");
          px(14, 48, 36, 4, "#59351c");
          // Glowing flasks & bottles
          circle(16, 22, 6, "#2ecc8f");
          px(14, 12, 4, 6, "#9be8d0");
          circle(30, 20, 7, "#3ea8e8");
          px(28, 10, 4, 6, "#b4e2fa");
          circle(44, 23, 5, "#d85282");
          px(42, 15, 4, 5, "#f2a4c2");
          // Sparkle
          circle(30, 19, 3, "rgba(210,255,240,0.65)");
          return;
        }

        if (kind === "cauldron") {
          // Glowing coals
          circle(32, 54, 12, "rgba(255,112,32,0.5)");
          px(18, 52, 28, 6, "#b83e18");
          // Iron pot
          circle(32, 38, 17, "#2d323a");
          circle(32, 36, 14, "#3d444f");
          px(14, 24, 36, 5, "#596270");
          // Bubbling green brew
          px(18, 22, 28, 4, "#48e078");
          circle(25, 16, 4, "rgba(96,248,144,0.55)");
          circle(35, 13, 5, "rgba(128,255,168,0.45)");
          circle(31, 20, 3, "#a8ffc4");
          return;
        }

        if (kind === "candelabra") {
          px(22, 56, 20, 4, "#c69838");
          px(26, 52, 12, 4, "#dfae46");
          px(30, 18, 4, 36, "#d4a440");
          px(16, 22, 32, 3, "#d4a440");
          for (const cx of [17, 30, 43]) {
            px(cx, 12, 4, 10, "#f5ecd6");
            circle(cx + 2, 9, 4.5, "rgba(255,212,92,0.38)");
            circle(cx + 2, 9, 2.2, "#ffe87c");
          }
          return;
        }

        if (kind === "altar_stone") {
          px(8, 48, 48, 12, "#8c877c");
          px(12, 28, 40, 22, "#b8b2a4");
          px(6, 24, 52, 6, "#d4cec0");
          // Crimson cloth & golden trim
          px(20, 24, 24, 24, "#9c2028");
          px(22, 24, 20, 22, "#b52832");
          px(20, 45, 24, 3, "#e4b84c");
          px(30, 30, 4, 10, "#f0c858");
          px(26, 33, 12, 3, "#f0c858");
          // Chalice
          px(28, 14, 8, 6, "#e6b848");
          px(30, 20, 4, 4, "#c89632");
          return;
        }

        if (kind === "sarcophagus") {
          px(6, 34, 52, 24, "#6f7782");
          px(10, 26, 44, 12, "#8d96a2");
          px(14, 22, 36, 6, "#aeb7c2");
          // Carved relief
          px(18, 36, 28, 14, "#59606b");
          px(30, 38, 4, 10, "#9ca8b8");
          px(24, 41, 16, 3, "#9ca8b8");
          return;
        }

        if (kind === "urn") {
          px(20, 52, 24, 8, "#767b82");
          px(24, 46, 16, 6, "#9a8a74");
          circle(32, 34, 12, "#a8764c");
          circle(30, 32, 8, "#c28e60");
          px(26, 18, 12, 6, "#94643c");
          px(24, 15, 16, 4, "#b88252");
          px(22, 33, 20, 2, "#dfba64");
          return;
        }

        if (kind === "planter") {
          px(18, 38, 28, 20, "#8f8d84");
          px(14, 34, 36, 6, "#b4b1a6");
          // Lush fern fronds & blossoms
          circle(32, 24, 14, "#2c7a38");
          circle(22, 24, 9, "#3d9c48");
          circle(42, 24, 9, "#3d9c48");
          circle(32, 16, 9, "#52b856");
          circle(24, 18, 3, "#f4d258");
          circle(40, 20, 3, "#f288a4");
          circle(33, 14, 2.5, "#ffe47a");
          return;
        }

        if (kind === "coffer") {
          px(10, 28, 44, 28, "#6a3d1c");
          px(10, 24, 44, 8, "#8c5426");
          // Gold bands
          px(16, 24, 5, 32, "#deb042");
          px(43, 24, 5, 32, "#deb042");
          px(10, 31, 44, 3, "#c49430");
          // Glinting coins peeking
          circle(28, 25, 4, "#ffe066");
          circle(35, 25, 4, "#f4c23c");
          px(29, 34, 6, 6, "#f0c858");
          return;
        }

        if (kind === "pedestal") {
          px(16, 52, 32, 8, "#9a9488");
          px(22, 26, 20, 26, "#c8c2b4");
          px(18, 22, 28, 6, "#dfd8c8");
          px(20, 26, 24, 2, "#e0b448");
          circle(32, 14, 8, "rgba(255,212,86,0.34)");
          circle(32, 14, 5.5, "#f4c648");
          circle(30, 12, 2, "#fff5b8");
          return;
        }

        if (kind === "torch_sconce") {
          px(28, 34, 8, 18, "#3e444e");
          px(24, 46, 16, 6, "#555d69");
          px(29, 22, 6, 16, "#754724");
          circle(32, 16, 11, "rgba(255,168,54,0.34)");
          circle(32, 17, 6.5, "#f06e24");
          circle(32, 14, 4, "#ffd454");
          circle(32, 13, 2, "#fff7c2");
          return;
        }
      }

      function furnitureTileKey(kind) {
        return `furniture://${kind}`;
      }

      function ensureFurnitureSprite(kind) {
        const key = furnitureTileKey(kind);
        if (furnitureSpriteCache.has(key)) return furnitureSpriteCache.get(key);
        let img = { id: key, width: 64, height: 64, naturalWidth: 64, naturalHeight: 64 };
        if (typeof document !== "undefined" && typeof document.createElement === "function") {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext ? canvas.getContext("2d") : null;
          if (ctx) {
            drawFurnitureArt(ctx, kind);
            canvas.id = key;
            img = canvas;
          }
        }
        const entry = { image: img, ready: true, failed: false, loadedSrc: key, fallbackSrc: null };
        furnitureSpriteCache.set(key, entry);
        imageCache.set(key, entry);
        return entry;
      }

      function primeFurnitureSprites() {
        for (const kind of Object.keys(FURNITURE_CATALOG)) ensureFurnitureSprite(kind);
      }

      // ── Floor room / corridor analysis & furniture placement ───────────────
      const floorThemeCache = new WeakMap();
      const classicThemeCache = new WeakMap();

      function isOutdoorBranch(floor) {
        const id = String(floor?.id || "").toLowerCase();
        const biome = String(floor?.biome || "").toLowerCase();
        return /^(shoals|swamp|lair|slime|spider|volcano|icecave|desolation):/.test(id)
          || ["shoals", "swamp", "lair", "slime", "spider"].includes(biome);
      }

      function outdoorThemeForFloor(floor, roomIndex) {
        const id = String(floor?.id || "").toLowerCase();
        const biome = String(floor?.biome || "").toLowerCase();
        if (id.startsWith("shoals:") || biome === "shoals") {
          return {
            id: "shoals_isle",
            name: roomIndex % 2 === 0 ? "Tidal Island" : "Sunken Reef",
            shortLabel: "Shoals",
            floorPattern: "none",
            floorTint: null,
            wallTint: null,
            wallTrimStyle: "none",
            trimColor: null,
            ceilingTint: null,
            ceilingBeams: false,
            ambientColor: [88, 174, 198],
            ambientAlpha: 0.04,
            wallProps: ["shoals_pillar", "shoals_lantern", "shoals_statue"],
            centerProps: ["shoals_fountain", "shoals_statue", "shoals_spring"],
            cornerProps: ["shoals_lantern", "shoals_pillar"]
          };
        }
        if (id.startsWith("swamp:") || biome === "swamp") {
          return {
            id: "swamp_fen",
            name: roomIndex % 2 === 0 ? "Mangrove Grove" : "Sunken Fen",
            shortLabel: "Swamp",
            floorPattern: "none",
            floorTint: null,
            wallTint: null,
            wallTrimStyle: "none",
            trimColor: null,
            ceilingTint: null,
            ceilingBeams: false,
            ambientColor: [84, 152, 86],
            ambientAlpha: 0.04,
            wallProps: ["swamp_mangrove", "swamp_dead_tree", "swamp_mangrove_b"],
            centerProps: ["swamp_mangrove_b", "swamp_dead_tree"],
            cornerProps: ["swamp_mangrove", "swamp_dead_tree"]
          };
        }
        if (id.startsWith("slime:") || biome === "slime") {
          return {
            id: "slime_grotto",
            name: "Ooze Cavern",
            shortLabel: "Slime",
            floorPattern: "none",
            floorTint: null,
            wallTint: null,
            wallTrimStyle: "none",
            trimColor: null,
            ceilingTint: null,
            ceilingBeams: false,
            ambientColor: [118, 198, 82],
            ambientAlpha: 0.04,
            wallProps: ["slime_crystal", "slime_vat"],
            centerProps: ["slime_crystal", "slime_vat"],
            cornerProps: ["slime_crystal"]
          };
        }
        return {
          id: "lair_grove",
          name: roomIndex % 2 === 0 ? "Cavern Grove" : "Wild Clearing",
          shortLabel: "Grove",
          floorPattern: "none",
          floorTint: null,
          wallTint: null,
          wallTrimStyle: "none",
          trimColor: null,
          ceilingTint: null,
          ceilingBeams: false,
          ambientColor: [94, 174, 108],
          ambientAlpha: 0.04,
          wallProps: ["lair_tree", "lair_tree_b", "lair_petrified"],
          centerProps: ["lair_tree_b", "planter"],
          cornerProps: ["lair_tree", "lair_petrified"]
        };
      }

      function biomeThemeOrder(floor) {
        const id = String(floor?.id || "").toLowerCase();
        if (id.startsWith("crypt") || id.startsWith("tomb") || id.startsWith("ossuary") || id.startsWith("tartarus") || id.startsWith("necropolis")) {
          return ["crypt", "chapel", "library", "treasury", "alchemy", "armory", "banquet", "conservatory"];
        }
        if (id.startsWith("orc") || id.startsWith("vault") || id.startsWith("bailey") || id.startsWith("dis")) {
          return ["armory", "banquet", "treasury", "chapel", "library", "alchemy", "crypt", "conservatory"];
        }
        if (id.startsWith("elf") || id.startsWith("wizlab") || id.startsWith("zot")) {
          return ["library", "alchemy", "treasury", "chapel", "conservatory", "armory", "banquet", "crypt"];
        }
        return ["library", "banquet", "armory", "chapel", "alchemy", "conservatory", "treasury", "crypt"];
      }

      function isWalkableFloorGlyph(rows, x, y) {
        const g = rows[y]?.[x];
        return g === ".";
      }

      function isSolidGlyph(rows, x, y) {
        const g = rows[y]?.[x];
        return !g || g === "x" || g === "X" || g === "H" || g === " ";
      }

      function analyzeFloorThemes(floor) {
        if (!floor || !floor.map || !Array.isArray(floor.map.rows)) return null;
        if (context.themeRoomsDisabled) return null;
        const rows = floor.map.rows;
        const H = rows.length;
        const W = rows[0]?.length || 0;
        const signature = `${floor.id || ""}|${W}x${H}|${rows.join("")}`;
        const cached = floorThemeCache.get(floor);
        if (cached && cached.signature === signature) return cached;

        const cellZone = new Map();     // "x,y" -> { kind: "room" | "corridor", roomId, theme }
        const wallZone = new Map();     // "x,y" -> { kind: "room" | "corridor", roomId, theme, torch: bool }
        const furnitureByCell = new Map(); // "x,y" -> furniture object
        const rooms = [];

        const order = biomeThemeOrder(floor);
        const floorHash = hashString(`${floor.id || "floor"}:${floor.map.name || ""}`);

        // 1. Identify rooms: prefer explicit layout.rooms when present, otherwise
        // detect open 2x2 room regions (and subdivide huge open arenas into
        // themed chambers so every wing looks distinct).
        const roomCellToId = new Map();

        if (Array.isArray(floor.rooms) && floor.rooms.some((r) => r.w >= 3 && r.h >= 3)) {
          floor.rooms.forEach((r) => {
            if (r.w < 3 || r.h < 3) return;
            const cells = [];
            for (let y = r.y; y < r.y + r.h; y += 1) {
              for (let x = r.x; x < r.x + r.w; x += 1) {
                if (!isWalkableFloorGlyph(rows, x, y)) continue;
                const k = keyOf(x, y);
                if (roomCellToId.has(k)) continue;
                roomCellToId.set(k, rooms.length);
                cells.push({ x, y });
              }
            }
            if (cells.length >= 4) {
              rooms.push({
                id: rooms.length,
                cells,
                minX: r.x, maxX: r.x + r.w - 1,
                minY: r.y, maxY: r.y + r.h - 1,
                cx: r.cx, cy: r.cy
              });
            }
          });
        } else {
          // Mark every cell belonging to a 2x2 open block as a room core.
          const core = new Set();
          for (let y = 1; y < H - 2; y += 1) {
            for (let x = 1; x < W - 2; x += 1) {
              if (
                isWalkableFloorGlyph(rows, x, y)
                && isWalkableFloorGlyph(rows, x + 1, y)
                && isWalkableFloorGlyph(rows, x, y + 1)
                && isWalkableFloorGlyph(rows, x + 1, y + 1)
              ) {
                core.add(keyOf(x, y));
                core.add(keyOf(x + 1, y));
                core.add(keyOf(x, y + 1));
                core.add(keyOf(x + 1, y + 1));
              }
            }
          }

          // Flood-fill connected room cores.
          const visited = new Set();
          const rawComponents = [];
          for (const k of core) {
            if (visited.has(k)) continue;
            const [sx, sy] = k.split(",").map(Number);
            const comp = [];
            const q = [{ x: sx, y: sy }];
            visited.add(k);
            while (q.length) {
              const cur = q.shift();
              comp.push(cur);
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nk = keyOf(cur.x + dx, cur.y + dy);
                if (core.has(nk) && !visited.has(nk)) {
                  visited.add(nk);
                  q.push({ x: cur.x + dx, y: cur.y + dy });
                }
              }
            }
            rawComponents.push(comp);
          }

          // If a component is huge (like Open Corners or a cavern), partition it
          // into distinct chambers by 7x7 spatial sectors so different wings have
          // different themes instead of one uniform tint.
          const pushRoomFromCells = (cells) => {
            if (cells.length < 3) return;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let sumX = 0, sumY = 0;
            const roomId = rooms.length;
            for (const c of cells) {
              if (c.x < minX) minX = c.x;
              if (c.x > maxX) maxX = c.x;
              if (c.y < minY) minY = c.y;
              if (c.y > maxY) maxY = c.y;
              sumX += c.x;
              sumY += c.y;
              roomCellToId.set(keyOf(c.x, c.y), roomId);
            }
            rooms.push({
              id: roomId,
              cells,
              minX, maxX, minY, maxY,
              cx: Math.round(sumX / cells.length),
              cy: Math.round(sumY / cells.length)
            });
          };

          for (const comp of rawComponents) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const c of comp) {
              if (c.x < minX) minX = c.x;
              if (c.x > maxX) maxX = c.x;
              if (c.y < minY) minY = c.y;
              if (c.y > maxY) maxY = c.y;
            }
            const spanW = maxX - minX + 1;
            const spanH = maxY - minY + 1;
            if (comp.length > 36 && (spanW >= 10 || spanH >= 10)) {
              const sectors = new Map();
              const midX = Math.floor((minX + maxX) / 2);
              const midY = Math.floor((minY + maxY) / 2);
              for (const c of comp) {
                const sx = spanW >= 10 ? (c.x <= midX ? 0 : 1) : 0;
                const sy = spanH >= 10 ? (c.y <= midY ? 0 : 1) : 0;
                const sk = `${sx},${sy}`;
                if (!sectors.has(sk)) sectors.set(sk, []);
                sectors.get(sk).push(c);
              }
              for (const cells of sectors.values()) pushRoomFromCells(cells);
            } else {
              pushRoomFromCells(comp);
            }
          }

          // Fallback for corridor-labyrinth arrival maps (e.g. D:1 Spiral Entry)
          // where passages are 1 tile wide: group alcoves / widened nooks (cells
          // with >= 3 adjacent open cells or dead-end chambers) into cozy themed
          // alcoves so even narrow floors have distinct themed chambers.
          if (rooms.length === 0) {
            const alcoves = [];
            for (let y = 1; y < H - 1; y += 1) {
              for (let x = 1; x < W - 1; x += 1) {
                if (!isWalkableFloorGlyph(rows, x, y)) continue;
                let wallN = 0;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                  if (isSolidGlyph(rows, x + dx, y + dy)) wallN += 1;
                }
                if (wallN >= 3 || (x === floor.start?.x && y === floor.start?.y)) {
                  alcoves.push({ x, y });
                }
              }
            }
            const claimed = new Set();
            for (const seed of alcoves) {
              if (claimed.has(keyOf(seed.x, seed.y))) continue;
              const cluster = [];
              for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                  const nx = seed.x + dx;
                  const ny = seed.y + dy;
                  const nk = keyOf(nx, ny);
                  if (isWalkableFloorGlyph(rows, nx, ny) && !claimed.has(nk)) {
                    claimed.add(nk);
                    cluster.push({ x: nx, y: ny });
                  }
                }
              }
              if (cluster.length >= 2) pushRoomFromCells(cluster);
            }
          }
        }

        // 2. Assign distinct themes to rooms (never repeating the previous room's theme).
        const outdoor = isOutdoorBranch(floor);
        for (let i = 0; i < rooms.length; i += 1) {
          const room = rooms[i];
          if (outdoor) {
            room.theme = outdoorThemeForFloor(floor, i);
          } else {
            const themeId = order[(floorHash + i) % order.length];
            room.theme = THEME_BY_ID.get(themeId) || ROOM_THEMES[i % ROOM_THEMES.length];
          }
          for (const c of room.cells) {
            cellZone.set(keyOf(c.x, c.y), { kind: "room", roomId: room.id, theme: room.theme, room, outdoor });
          }
        }

        // Mark all remaining walkable cells as corridors.
        for (let y = 0; y < H; y += 1) {
          for (let x = 0; x < W; x += 1) {
            if (!isWalkableFloorGlyph(rows, x, y)) continue;
            const k = keyOf(x, y);
            if (!cellZone.has(k)) cellZone.set(k, { kind: "corridor", roomId: -1, theme: null, room: null, outdoor });
          }
        }

        // 3. Map walls to their neighboring room theme (or corridor torch sconce).
        for (let y = 0; y < H; y += 1) {
          for (let x = 0; x < W; x += 1) {
            if (!isSolidGlyph(rows, x, y)) continue;
            let roomNeighbour = null;
            let corridorNeighbour = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nz = cellZone.get(keyOf(x + dx, y + dy));
              if (!nz) continue;
              if (nz.kind === "room" && !roomNeighbour) roomNeighbour = nz;
              if (nz.kind === "corridor") corridorNeighbour = true;
            }
            if (roomNeighbour) {
              wallZone.set(keyOf(x, y), {
                kind: "room",
                roomId: roomNeighbour.roomId,
                theme: roomNeighbour.theme,
                torch: false,
                outdoor
              });
            } else if (corridorNeighbour) {
              const torchRoll = !outdoor && (hashString(`torch:${floor.id}:${x},${y}`) % 7 === 0);
              wallZone.set(keyOf(x, y), {
                kind: "corridor",
                roomId: -1,
                theme: null,
                torch: torchRoll,
                outdoor
              });
            }
          }
        }

        // 4. Place recognizable furniture inside each room, avoiding stairs,
        // start, doors, items, traps, decor, monsters, and doorway bottlenecks.
        const blocked = new Set();
        const markBlocked = (p) => { if (p && Number.isInteger(p.x) && Number.isInteger(p.y)) blocked.add(keyOf(p.x, p.y)); };
        markBlocked(floor.start);
        for (const s of Object.values(floor.stairs || {})) markBlocked(s);
        for (const d of floor.doors || []) blocked.add(d);
        for (const it of floor.floorItems || []) markBlocked(it);
        for (const tr of floor.traps || []) markBlocked(tr);
        for (const dc of floor.decor || []) markBlocked(dc);
        for (const m of floor.encounters || []) markBlocked(m);

        // Also avoid putting furniture directly inside or blocking a doorway tile.
        const nearDoor = (x, y) => {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const g = rows[y + dy]?.[x + dx];
            if (g === "+") return true;
          }
          return false;
        };
        const isNarrowPassage = (x, y) => {
          const wL = isSolidGlyph(rows, x - 1, y);
          const wR = isSolidGlyph(rows, x + 1, y);
          const wU = isSolidGlyph(rows, x, y - 1);
          const wD = isSolidGlyph(rows, x, y + 1);
          return (wL && wR) || (wU && wD);
        };
        const adjacentWallCount = (x, y) => {
          let n = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (isSolidGlyph(rows, x + dx, y + dy)) n += 1;
          }
          return n;
        };

        const placePiece = (room, cell, kind, serial) => {
          const spec = FURNITURE_CATALOG[kind];
          if (!spec) return false;
          const k = keyOf(cell.x, cell.y);
          if (blocked.has(k) || furnitureByCell.has(k)) return false;
          blocked.add(k);
          furnitureByCell.set(k, {
            id: `furn-${floor.id || "f"}-${room.id}-${serial}-${kind}`,
            kind,
            roomId: room.id,
            roomName: room.theme.name,
            themeId: room.theme.id,
            name: spec.name,
            shortName: spec.shortName,
            tall: Boolean(spec.tall),
            widthScale: spec.widthScale,
            heightScale: spec.heightScale,
            tile: spec.dcssTile
              ? (typeof environmentAsset === "function" ? environmentAsset(spec.dcssTile) : spec.dcssTile)
              : furnitureTileKey(kind),
            x: cell.x,
            y: cell.y,
            interact: spec.interact,
            heal: spec.heal || 0,
            might: spec.might || 0,
            resistance: spec.resistance || 0
          });
          return true;
        };

        for (const room of rooms) {
          const theme = room.theme;
          const candidates = room.cells.filter((c) => !blocked.has(keyOf(c.x, c.y)) && !nearDoor(c.x, c.y) && !isNarrowPassage(c.x, c.y));
          if (candidates.length === 0) continue;

          // Deterministic sort so furniture placement is stable across reloads.
          const wallCells = [];
          const cornerCells = [];
          const centerCells = [];
          for (const c of candidates) {
            const wc = adjacentWallCount(c.x, c.y);
            if (wc >= 2) cornerCells.push(c);
            else if (wc === 1) wallCells.push(c);
            else centerCells.push(c);
          }

          const sortByHash = (arr, salt) => arr.sort((a, b) => (hashString(`${salt}:${a.x},${a.y}`) - hashString(`${salt}:${b.x},${b.y}`)));
          sortByHash(cornerCells, `${floor.id}:c:${room.id}`);
          sortByHash(wallCells, `${floor.id}:w:${room.id}`);
          // Prefer cells closest to room center for focal centerpiece furniture.
          centerCells.sort((a, b) => {
            const da = Math.abs(a.x - room.cx) + Math.abs(a.y - room.cy);
            const db = Math.abs(b.x - room.cx) + Math.abs(b.y - room.cy);
            return da - db || a.y - b.y || a.x - b.x;
          });

          const targetCount = Math.max(1, Math.min(6, Math.floor(room.cells.length / 5) + 1));
          let placed = 0;
          const spacedOk = (c) => {
            for (const existing of furnitureByCell.values()) {
              if (existing.roomId !== room.id) continue;
              if (Math.abs(existing.x - c.x) + Math.abs(existing.y - c.y) <= 1) return false;
            }
            return true;
          };

          // 1) Centerpiece furniture
          for (let i = 0; i < centerCells.length && placed < Math.min(2, targetCount); i += 1) {
            const c = centerCells[i];
            if (!spacedOk(c)) continue;
            const kind = theme.centerProps[placed % theme.centerProps.length];
            if (placePiece(room, c, kind, placed)) placed += 1;
          }
          // 2) Wall-hugging furniture
          for (let i = 0; i < wallCells.length && placed < targetCount; i += 1) {
            const c = wallCells[i];
            if (!spacedOk(c)) continue;
            const kind = theme.wallProps[placed % theme.wallProps.length];
            if (placePiece(room, c, kind, placed)) placed += 1;
          }
          // 3) Corner accents
          for (let i = 0; i < cornerCells.length && placed < targetCount; i += 1) {
            const c = cornerCells[i];
            if (!spacedOk(c)) continue;
            const kind = theme.cornerProps[placed % theme.cornerProps.length];
            if (placePiece(room, c, kind, placed)) placed += 1;
          }
        }

        // Also place occasional freestanding corridor landmarks (barrels/braziers)
        // in dead-end pockets of narrow-corridor floors if very few pieces were placed.
        if (furnitureByCell.size < 3) {
          const corridorNooks = [];
          for (let y = 1; y < H - 1; y += 1) {
            for (let x = 1; x < W - 1; x += 1) {
              if (!isWalkableFloorGlyph(rows, x, y)) continue;
              const k = keyOf(x, y);
              if (blocked.has(k) || nearDoor(x, y)) continue;
              if (adjacentWallCount(x, y) >= 3) corridorNooks.push({ x, y });
            }
          }
          const fallbackKinds = ["brazier", "barrel", "crate", "candelabra", "urn"];
          corridorNooks.slice(0, 4).forEach((c, idx) => {
            const kind = fallbackKinds[(floorHash + idx) % fallbackKinds.length];
            placePiece({ id: -1, theme: { id: "corridor", name: "Corridor" } }, c, kind, idx);
          });
        }

        const result = {
          signature,
          rooms,
          cellZone,
          wallZone,
          furnitureByCell,
          furniture: [...furnitureByCell.values()]
        };
        floorThemeCache.set(floor, result);
        return result;
      }

      function floorThemeLayout(floor = null) {
        const layout = analyzeFloorThemes(floor || currentFloor());
        if (!layout) return null;
        if (state.tileset !== "classic") {
          return layout;
        } else {
          const cached = classicThemeCache.get(layout);
          if (cached) {
            return cached;
          } else {
            // Original mode omits invented props; retain actual DCSS fixtures.
            const furniture = layout.furniture.filter((piece) => !piece.tile.startsWith("furniture://"))
              .map((piece) => ({ ...piece, tile: classicEnvironmentAsset(piece.tile) }));
            const classic = { ...layout, furniture, furnitureByCell: new Map(furniture.map((piece) => [keyOf(piece.x, piece.y), piece])) };
            classicThemeCache.set(layout, classic);
            return classic;
          }
        }
      }

      function cellThemeAt(x, y, floor = null) {
        const layout = floorThemeLayout(floor);
        if (!layout) return null;
        return layout.cellZone.get(keyOf(x, y)) || null;
      }

      function wallThemeAt(x, y, floor = null) {
        const layout = floorThemeLayout(floor);
        if (!layout) return null;
        return layout.wallZone.get(keyOf(x, y)) || null;
      }

      function furnitureAt(x, y, floor = null) {
        const layout = floorThemeLayout(floor);
        if (!layout) return null;
        return layout.furnitureByCell.get(keyOf(x, y)) || null;
      }

      function currentRoomLabel() {
        const zone = cellThemeAt(state.x, state.y);
        if (!zone) return "";
        if (zone.kind === "room" && zone.theme) return zone.theme.name;
        return "Corridor";
      }

      function furnitureTarget() {
        const here = furnitureAt(state.x, state.y);
        if (here) return { furniture: here, x: state.x, y: state.y };
        const forward = dirAt(0);
        const x = state.x + forward.x;
        const y = state.y + forward.y;
        const ahead = furnitureAt(x, y);
        return ahead ? { furniture: ahead, x, y } : null;
      }

      function useFurniture(piece) {
        if (!piece) return false;
        const floorState = currentFloorState();
        floorState.usedFurniture = floorState.usedFurniture || new Set();
        const alreadyUsed = floorState.usedFurniture.has(piece.id);
        if (alreadyUsed) {
          state.message = `${piece.name}: ${piece.interact}`;
          return true;
        }
        floorState.usedFurniture.add(piece.id);
        let bonus = "";
        if (piece.heal > 0 && typeof healParty === "function") {
          const healed = healParty(piece.heal);
          if (healed > 0) bonus = ` (+${healed} HP)`;
        }
        if (piece.might > 0) {
          state.mightTurns = Math.max(state.mightTurns || 0, piece.might);
          bonus += ` (+might ${piece.might}t)`;
        }
        if (piece.resistance > 0) {
          state.resistanceTurns = Math.max(state.resistanceTurns || 0, piece.resistance);
          bonus += ` (+resistance ${piece.resistance}t)`;
        }
        if (typeof addEffect === "function" && (piece.heal > 0 || piece.might > 0 || piece.resistance > 0)) {
          addEffect("halo", [{ x: piece.x, y: piece.y }]);
        }
        state.message = `${piece.interact}${bonus}`;
        return true;
      }

      // Announce room transitions quietly in the log when stepping into a new
      // themed room, so exploring feels rewarding without obstructing the view.
      let lastAnnouncedRoomKey = null;
      function noteRoomTransition() {
        const zone = cellThemeAt(state.x, state.y);
        if (!zone || zone.kind !== "room" || !zone.theme) {
          lastAnnouncedRoomKey = null;
          return;
        }
        const roomKey = `${state.floorIndex}:${zone.roomId}`;
        if (roomKey === lastAnnouncedRoomKey) return;
        lastAnnouncedRoomKey = roomKey;
        if (typeof logMessage === "function") {
          logMessage(`Entered ${zone.theme.name}.`);
        }
      }

      if (Array.isArray(context.turnHooks)) {
        context.turnHooks.push(() => noteRoomTransition());
      }

      Object.assign(context, {
        ROOM_THEMES,
        FURNITURE_CATALOG,
        furnitureTileKey,
        ensureFurnitureSprite,
        primeFurnitureSprites,
        analyzeFloorThemes,
        floorThemeLayout,
        cellThemeAt,
        wallThemeAt,
        furnitureAt,
        currentRoomLabel,
        furnitureTarget,
        useFurniture
      });
    }
  };
}());
