(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installClassicGraphics = function (context) {
    // DCSS domino-data.h, Cohen's eight Wang tiles (Brendan Hickey, BSD-2-Clause).
    // Edges are north, east, south, west; equal colours must meet.
    const edges = [[0, 3, 1, 2], [1, 2, 1, 2], [0, 3, 0, 3], [1, 2, 0, 3],
      [0, 2, 1, 3], [1, 3, 1, 3], [0, 2, 0, 2], [1, 3, 0, 2]];
    const tilings = new WeakMap();
    const rotations = new WeakMap();

    function classicDominoIndex(cell) {
      const floor = context.currentFloor();
      const { width, height } = floor.map;
      if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
        throw new Error(`Cannot select Crypt floor at ${cell.x},${cell.y}: expected coordinates inside ${width}×${height}`);
      } else {
        let cached = tilings.get(floor);
        if (!cached || cached.width !== width || cached.height !== height) {
          const cells = [];
          for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
              const choices = edges.map((edge, index) => ({ edge, index })).filter(({ edge }) =>
                (y === 0 || edge[0] === edges[cells[(y - 1) * width + x]][2]) &&
                (x === 0 || edge[3] === edges[cells[y * width + x - 1]][1]));
              if (choices.length === 0) {
                throw new Error(`Cannot connect DCSS Crypt floor edges at ${x},${y}`);
              } else {
                cells.push(choices[context.cellHash(x, y, 617) % choices.length].index);
              }
            }
          }
          cached = { width, height, cells };
          tilings.set(floor, cached);
        } else {
          // The whole plane is tiled, so geometry and visibility do not affect seams.
          cached = tilings.get(floor);
        }
        return cached.cells[cell.y * width + cell.x];
      }
    }

    function classicFloorVariants(cell) {
      const variants = context.currentFloor().classicVariants;
      if (variants?.floorDomino0) {
        return variants[`floorDomino${classicDominoIndex(cell)}`];
      } else {
        return variants?.floor;
      }
    }

    function orientFloorImage(image, turns) {
      const rotation = ((turns % 4) + 4) % 4;
      if (rotation === 0) {
        return image;
      } else {
        const cached = rotations.get(image) || new Map();
        if (cached.has(rotation)) {
          return cached.get(rotation);
        } else {
          const width = image.naturalWidth || image.width;
          const height = image.naturalHeight || image.height;
          const canvas = document.createElement("canvas");
          canvas.width = rotation % 2 ? height : width;
          canvas.height = rotation % 2 ? width : height;
          const drawing = canvas.getContext("2d");
          if (!drawing) {
            throw new Error("Cannot orient original floor graphics: expected a 2D canvas");
          } else {
            drawing.imageSmoothingEnabled = false;
            drawing.translate(canvas.width / 2, canvas.height / 2);
            drawing.rotate(-rotation * Math.PI / 2);
            drawing.drawImage(image, -width / 2, -height / 2);
            cached.set(rotation, canvas);
            rotations.set(image, cached);
            return canvas;
          }
        }
      }
    }

    function statusIcons(subject, party = false) {
      const assets = context.graphicsAssets();
      // Original tiledgnbuf.cc places fleeing first (3 px), poison next (6 px),
      // then the remaining status icons; TRAP_NET covers the whole actor tile.
      const definitions = [
        ["net", party ? subject.snaredTurns : subject.rootedTurns, "statusNet", 0],
        ["fear", subject.fearTurns, "statusFear", 3],
        ["poison", subject.poisonedTurns, "statusPoison", 6],
        ["fire", party ? subject.burningTurns : subject.immolationTurns, party ? "statusBurning" : "statusFire", 7],
        ["haste", subject.hasteTurns, "statusHaste", 6],
        ["slow", subject.slowedTurns, "statusSlow", 6],
        ["might", subject.mightTurns, "statusMight", 6],
        ["rage", subject.rageTurns, "statusRage", 0],
        ["confused", subject.dazedTurns, "statusConfused", 6],
        ["corroded", subject.corrodedTurns, "statusCorroded", 6],
        ["constricted", subject.engulfedTurns, "statusConstricted", 11],
        ["resistance", subject.resistanceTurns, "statusResistance", 8]
      ];
      let shift = 0;
      return definitions.filter((entry) => entry[1] > 0).map(([kind, turns, key, size]) => {
        const icon = { kind, texture: assets[key], alpha: 1, classic: true, shift: size ? shift : 0 };
        shift += size;
        return icon;
      });
    }

    function monsterGraphic(monster) {
      if (context.state.tileset !== "classic" || !monster.classicTiles?.length) {
        return context.state.tileset === "classic" ? monster.classicTile || monster.tile : monster.tile;
      } else {
        let hash = 2166136261;
        for (const character of monster.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
        const total = monster.classicTiles.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = hash % total;
        for (const entry of monster.classicTiles) {
          roll -= entry.weight;
          if (roll < 0) {
            return entry.src;
          } else {
            continue;
          }
        }
        throw new Error(`Cannot select DCSS monster graphic for ${monster.id}`);
      }
    }


    Object.assign(context, { classicDominoIndex, classicFloorVariants, orientFloorImage,
      monsterGraphic,
      classicMonsterStatusOverlays: (monster) => statusIcons(monster),
      classicPartyStatusOverlays: () => statusIcons(context.state, true) });
  };
})();
