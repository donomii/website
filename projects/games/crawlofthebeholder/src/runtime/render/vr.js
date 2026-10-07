(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Meta Quest (WebXR) mode: renders the CURRENT game as a room-scale diorama —
  // dungeon architecture in true 3D, everything that lives in it as flat
  // "paper doll" sprites standing on their tiles. This file is a front end
  // only: it reads state through the same helpers the 2D map/viewport use and
  // issues player commands exclusively through handleAction, so the game being
  // played is byte-for-byte the webpage game.
  window.CotBRuntime.installVr = function (context) {
    with (context) {
      const VR = {
        wallHeight: 0.85,       // tile units; dolls peek over the walls
        dollSize: 0.95,         // tile units, square like the source 32×32 tile
        tableMax: 1.6,          // metres; auto-fit the floor's long side to this
        tableTile: 0.085,       // metres per tile before auto-fit shrinks it
        tableHeight: 0.82,      // metres; diorama plane above the real floor
        tableDistance: 0.95,    // metres in front of the player at session start
        stickDeadzone: 0.45,
        stickRelease: 0.3,      // once deflected, only this recentres (hysteresis)
        repeatMs: 260,          // held-stick step cadence
        holdRestMs: 600,        // B/Y hold this long → rest instead of wait
        rotateSpeed: 2.4,       // rad/s at full stick deflection
        scaleSpeed: 1.1,        // ln-scale/s at full stick deflection
        scaleMin: 0.25,
        scaleMax: 4
      };
      // Thumbstick sectors, 45° each starting at north: N NE E SE S SW W NW.
      // Diagonal sectors are dead on purpose: diagonal-strafe via thumbstick
      // never registered reliably on real sticks. Sidesteps live on the
      // palette (Step L/R); point-to-move covers everything else.
      const VR_STICK_ACTIONS = ["moveForward", null, "turnRight", null, "moveBack", null, "turnLeft", null];
      const VR_MARKER_COLORS = { goal: "#58c470", warn: "#e05a3a", treasure: "#f1d07a" };
      const VR_SHADE = { floor: 1, faceNS: 0.82, faceEW: 0.68, top: 0.52, doorFace: 0.92, doorTop: 0.6 };

      // The in-VR control panel: a labelled button grid the player points at and
      // clicks with the trigger, so nobody has to remember the stick sectors or
      // grip combos. Row-major, 3 columns; a "vr:" action is a local view op,
      // everything else is a plain handleAction id — the same commands the 2D
      // page's button strip issues, so this stays a front end over one game.
      const VR_CONTROL_COLS = 3;
      const VR_CONTROL_BUTTONS = [
        { label: "Turn L", action: "turnLeft" }, { label: "Forward", action: "moveForward" }, { label: "Turn R", action: "turnRight" },
        { label: "Step L", action: "moveLeft" }, { label: "Back", action: "moveBack" }, { label: "Step R", action: "moveRight" },
        { label: "Attack", action: "attack" }, { label: "Interact", action: "interact" }, { label: "Wait", action: "wait" },
        { label: "Recovery help", action: "rest" }, { label: "Explore", action: "autoExplore" }, { label: "To Stairs", action: "travelToStairs" },
        { label: "Formation", action: "cycleFormation" }, { label: "Primary", action: "signature" }, { label: "Secondary", action: "ultimate" }, { label: "Search", action: "search" },
        { label: "Pickup", action: "pickup" }, { label: "Disarm", action: "disarm" }, { label: "Level", action: "vr:level" },
        { label: "Doll Mode", action: "vr:dolls" }, { label: "Art Style", action: "vr:art" }, { label: "Reset View", action: "vr:reset" },
        { label: "Exit VR", action: "vr:exit" }
      ];
      // Panel plane, in metres: anchored to the left of the diorama, billboarded
      // to face the head. width/height are the full quad; cols/rows tile it.
      const VR_PANEL = { offsetX: -0.6, offsetY: 0.14, offsetZ: 0.12, width: 0.5, height: 0.77 };

      let vrSession = null;
      let vrSessionMode = null;   // "immersive-vr" | "immersive-ar" while active
      let vrRefSpace = null;
      // AR tap-to-place: hit-test the real environment; while unplaced, a
      // reticle rides real surfaces and the next tap anchors the diorama.
      let vrArHitSource = null;          // viewer-centred source feeding the reticle
      let vrArTransientHitSource = null; // screen-tap rays against real geometry
      let vrArPlaced = true;             // false in AR until the user taps a spot
      let vrArReticle = null;            // room-space surface point this frame
      let vrLastHeadPose = null;         // headset pose, for positional audio
      let vrGl = null;
      let vrGlState = null;
      let vrLastArchSignature = null;
      let vrLastHudSignature = null;
      let vrLastFrameTime = 0;
      let vrDollModeValue = null;
      let vrEnterPending = false;
      let vrVrOk = false;
      let vrArOk = false;
      let vrHover = null;         // { pane, index } under the pointer, or null
      let vrPaletteDrawnHover = -2; // hover baked into each pane's canvas
      let vrPartyDrawnSig = null;
      let vrInvDrawnSig = null;
      let vrPointerSegs = [];     // laser rays to draw this frame: [{ ox,oy,oz, px,py,pz, bright }]
      let vrHandMarkers = [];     // controller positions to draw this frame: [{ x,y,z }]
      let vrDragGhosts = [];      // laser-dragged item art this frame: [{ tile, x,y,z }]
      // Game feel: dolls GLIDE between tiles instead of teleporting, flash
      // when hurt, and shed floating damage/heal numbers. All of it is
      // observation of state deltas — the game itself is untouched.
      const VR_TWEEN_MS = 150;
      const VR_FLASH_MS = 200;
      const VR_FLOATER_MS = 800;
      const vrDollAnim = new Map();  // doll id → { fx, fz, tx, tz, start }
      const vrDollHp = new Map();    // doll id → last { hp, maxHp }
      const vrDollFlash = new Map(); // doll id → flash start time
      let vrFloaters = [];           // { x, y (tile), lift, text, color, start }
      let vrPartyHitAt = 0;
      let vrLastDamageTaken = 0;
      let vrFeelFloor = -1;

      function vrArtStyle() {
        if (typeof activeTileset === "function") return activeTileset();
        return state.tileset === "linocut" ? "linocut" : "classic";
      }

      function vrRenderedAssets() {
        return typeof renderedAssets === "function" ? renderedAssets() : currentAssets();
      }

      function vrRenderedTile(src) {
        if (typeof renderedTile === "function") return renderedTile(src);
        if (typeof environmentAsset === "function") return environmentAsset(src);
        return src;
      }

      function vrNormalPath(src) {
        if (typeof normalTile !== "function") return null;
        const path = normalTile(src);
        return typeof path === "string" && path ? path : null;
      }

      function vrToggleArtStyle() {
        const next = typeof toggleTileset === "function"
          ? toggleTileset()
          : setTileset(vrArtStyle() === "linocut" ? "classic" : "linocut");
        if (typeof readSettings === "function" && typeof writeSettings === "function") {
          const settings = readSettings();
          settings.tileset = next;
          writeSettings(settings);
        }
        vrLastArchSignature = null;
        vrPaletteDrawnHover = -2;
        return next;
      }

      function vrDollAnimPos(anim, nowMs) {
        if (!anim.start) return { x: anim.tx, z: anim.tz };
        const raw = Math.min(1, (nowMs - anim.start) / VR_TWEEN_MS);
        const t = raw * raw * (3 - 2 * raw); // smoothstep
        return { x: anim.fx + (anim.tx - anim.fx) * t, z: anim.fz + (anim.tz - anim.fz) * t };
      }

      // Advance per-doll animation state for this frame; returns the tile-space
      // position to draw at. Long jumps (blink/teleport) snap.
      function vrDollFeel(doll, nowMs) {
        if (!nowMs || !doll.id) return { x: doll.x, z: doll.y };
        let anim = vrDollAnim.get(doll.id);
        if (!anim) {
          anim = { fx: doll.x, fz: doll.y, tx: doll.x, tz: doll.y, start: 0 };
          vrDollAnim.set(doll.id, anim);
        } else if (anim.tx !== doll.x || anim.tz !== doll.y) {
          const from = vrDollAnimPos(anim, nowMs);
          const dist = Math.hypot(doll.x - anim.tx, doll.y - anim.tz);
          anim.fx = from.x;
          anim.fz = from.z;
          anim.tx = doll.x;
          anim.tz = doll.y;
          anim.start = dist > 6 ? 0 : nowMs;
        }
        if (typeof doll.hp === "number") {
          const prev = vrDollHp.get(doll.id);
          if (prev && doll.hp < prev.hp) {
            vrDollFlash.set(doll.id, nowMs);
            vrFloaters.push({ x: doll.x, y: doll.y, lift: doll.h || 0.9, text: String(prev.hp - doll.hp), color: doll.kind === "party" ? "#ff6a55" : "#ffd166", start: nowMs });
          } else if (prev && doll.hp > prev.hp) {
            vrFloaters.push({ x: doll.x, y: doll.y, lift: doll.h || 0.9, text: `+${doll.hp - prev.hp}`, color: "#7fd08a", start: nowMs });
          }
          vrDollHp.set(doll.id, { hp: doll.hp, maxHp: doll.maxHp || 1 });
        }
        return vrDollAnimPos(anim, nowMs);
      }

      // Floating combat numbers: digit glyphs riding up off the doll.
      function vrEmitFloaters(model, headModel, nowMs, translucent) {
        if (!nowMs) { vrFloaters = []; return; }
        const halfW = model.width / 2;
        const halfH = model.height / 2;
        vrFloaters = vrFloaters.filter((f) => nowMs - f.start < VR_FLOATER_MS);
        for (const floater of vrFloaters) {
          const progress = (nowMs - floater.start) / VR_FLOATER_MS;
          const alpha = Math.max(0, 1 - progress * progress);
          const mx = floater.x + 0.5 - halfW;
          const mz = floater.y + 0.5 - halfH;
          const yaw = headModel ? Math.atan2(headModel.x - mx, headModel.z - mz) : 0;
          const rx = Math.cos(yaw);
          const rz = -Math.sin(yaw);
          const size = 0.34;
          const y0 = floater.lift + 0.18 + progress * 0.55;
          const chars = [...floater.text];
          const total = chars.length * size * 0.62;
          chars.forEach((ch, i) => {
            const off = -total / 2 + (i + 0.5) * size * 0.62;
            const cx = mx + rx * off;
            const cz = mz + rz * off;
            vrPushQuad(translucent, [
              [cx - rx * size / 2, y0 + size, cz - rz * size / 2],
              [cx + rx * size / 2, y0 + size, cz + rz * size / 2],
              [cx + rx * size / 2, y0, cz + rz * size / 2],
              [cx - rx * size / 2, y0, cz - rz * size / 2]
            ], vrGlyphUv(ch, floater.color), 1, 1, 1, alpha);
          });
        }
      }

      function vrResetGameFeel() {
        vrDollAnim.clear();
        vrDollHp.clear();
        vrDollFlash.clear();
        vrFloaters = [];
      }
      // Floating panes, each with an offset from the diorama position in
      // reference space. null = automatic layout; set once the user
      // grip-drags that pane somewhere. All are grabbable and billboarded.
      const vrPanelOffsets = { palette: null, hud: null, party: null, inventory: null };
      let vrAimTile = null; // dungeon tile under the laser this frame (point-to-move)
      let vrSelectedMemberIndex = 0; // equip target picked on the party pane
      // Game commands queued during an XR frame, run between frames.
      let vrPendingOps = [];
      let vrOpsScheduled = false;
      // Original 2D renderers, parked while a session is live.
      let vrSaved2d = null;
      // Diorama placement in reference space; grip-drag / grip+stick edit it.
      // The base height depends on the session's reference space ("local-floor"
      // origin is the real floor; the "local" fallback origin is head height),
      // so enterVr sets it per session and reset-view restores it.
      let vrTableBaseY = VR.tableHeight;
      // Orientation is a full quaternion [x,y,z,w]: grabbing the diorama turns
      // it with the wrist in any direction — it is NOT kept level with the
      // floor. The palette's "Level" button (and reset) squares it up again.
      const vrTable = { x: 0, y: VR.tableHeight, z: -VR.tableDistance, q: [0, 0, 0, 1], scale: 1 };

      function vrQMul(a, b) {
        return [
          a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
          a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
          a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
          a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
        ];
      }

      function vrQConj(q) {
        return [-q[0], -q[1], -q[2], q[3]];
      }

      function vrQNormalize(q) {
        const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
        return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
      }

      function vrQFromAxisAngle(axis, angle) {
        const s = Math.sin(angle / 2);
        return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
      }

      function vrQRotate(q, v) {
        // v' = q · (v,0) · q*
        const p = vrQMul(vrQMul(q, [v[0], v[1], v[2], 0]), vrQConj(q));
        return [p[0], p[1], p[2]];
      }
      const vrHands = new Map();

      function vrDollMode() {
        if (vrDollModeValue === null) {
          const settings = typeof readSettings === "function" ? readSettings() : {};
          vrDollModeValue = settings.vrDollMode === "billboard" ? "billboard" : "dungeon";
        }
        return vrDollModeValue;
      }

      function vrSetDollMode(mode) {
        vrDollModeValue = mode === "billboard" ? "billboard" : "dungeon";
        if (typeof readSettings === "function" && typeof writeSettings === "function") {
          const settings = readSettings();
          settings.vrDollMode = vrDollModeValue;
          writeSettings(settings);
        }
        return vrDollModeValue;
      }

      function vrToggleDollMode() {
        return vrSetDollMode(vrDollMode() === "billboard" ? "dungeon" : "billboard");
      }

      // ---------------------------------------------------------------------
      // Scene model. Pure reads of game state → plain data, so the behavior
      // tests can assert on it without a GL context. Coordinates are map tile
      // units centred on the floor's middle: mx = x+0.5-width/2, y up,
      // mz = y+0.5-height/2 (map north = -z).

      function vrCellDiscovered(floorState, x, y) {
        return floorState.discovered.has(keyOf(x, y));
      }

      // Mirrors the 2D map's fog of war: an in-map wall shows only once its own
      // cell is discovered; the virtual ring just outside the map (some vault
      // floors run right to the edge) shows as soon as the floor beside it is.
      function vrWallVisible(floorState, x, y) {
        if (mapContains(x, y)) return vrCellDiscovered(floorState, x, y);
        return dirs.some((dir) => {
          const nx = x + dir.x;
          const ny = y + dir.y;
          return mapContains(nx, ny) && !solidAt(nx, ny) && vrCellDiscovered(floorState, nx, ny);
        });
      }

      function vrEffectTint(kind) {
        const parts = String(effectColor(kind)).match(/[\d.]+/g) || [];
        return { r: (parts[0] || 255) / 255, g: (parts[1] || 218) / 255, b: (parts[2] || 120) / 255 };
      }

      function vrCloudTexture(cloud) {
        const assets = currentAssets();
        if (cloud.kind === "poison") return assets.poisonCloud;
        if (cloud.kind === "petrify") return assets.petrifyCloud;
        if (cloud.kind === "flame") return assets.effectFlame;
        return assets.fog;
      }

      // Static dungeon structure: floors, walls, doors, stairs, floor decor.
      // Rebuilt only when vrStructureSignature changes (discovery, doors,
      // digging) — never per turn, because a full grid walk is the single
      // most expensive thing the front end does.
      function vrStructureModel() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const assets = vrRenderedAssets();
        const width = floor.map.width;
        const height = floor.map.height;
        const surfaces = [];

        for (let y = -1; y <= height; y += 1) {
          for (let x = -1; x <= width; x += 1) {
            const inMap = mapContains(x, y);
            if (inMap && !solidAt(x, y) && vrCellDiscovered(floorState, x, y)) {
              const floorTexturePath = vrRenderedTile(floorTexture({ x, y }));
              surfaces.push({ kind: "floor", x, y, texture: floorTexturePath, normal: vrNormalPath(floorTexturePath), shade: VR_SHADE.floor });
              const openDoor = doorCellAt(x, y) && !closedDoorAt(x, y);
              if (openDoor) {
                const texture = vrRenderedTile(assets.openDoor);
                surfaces.push({ kind: "decal", x, y, texture, normal: vrNormalPath(texture), inset: 0.06, lift: 0.012, alpha: 1 });
              }
              const stairs = stairsAt(x, y);
              if (stairs) {
                const texture = vrRenderedTile(stairs.direction === "down" ? assets.stairsDown : assets.stairsUp);
                surfaces.push({ kind: "decal", x, y, texture, normal: vrNormalPath(texture), inset: 0.1, lift: 0.014, alpha: 1 });
              }
              const decor = decorAt(x, y);
              if (decor && decor.kind === "floor") {
                const texture = vrRenderedTile(decor.tile);
                surfaces.push({ kind: "decal", x, y, texture, normal: vrNormalPath(texture), inset: 0.08, lift: 0.018, alpha: decorUsed(decor) ? 0.45 : 1 });
              }
              continue;
            }

            const solid = !inMap || solidAt(x, y);
            if (!solid || !vrWallVisible(floorState, x, y)) continue;
            const door = inMap && closedDoorAt(x, y);
            const cell = { x, y };
            let anyFace = false;
            for (const dir of dirs) {
              const nx = x + dir.x;
              const ny = y + dir.y;
              if (!mapContains(nx, ny) || solidAt(nx, ny)) continue;
              // A visible wall shows every face that borders open ground, even
              // undiscovered ground: the face only depicts the wall itself, and
              // gating it on the neighbor left known walls invisible when none
              // of their open neighbors had been seen yet (the map shows them).
              anyFace = true;
              const texture = vrRenderedTile(door ? assets.door : wallSurfaceTexture(cell));
              surfaces.push({
                kind: door ? "door-face" : "wall-face",
                x, y,
                side: dir.name,
                texture,
                normal: vrNormalPath(texture),
                shade: door ? VR_SHADE.doorFace : (dir.name === "N" || dir.name === "S" ? VR_SHADE.faceNS : VR_SHADE.faceEW)
              });
            }
            // Every discovered in-map wall gets its cap so the diorama seen
            // from above matches the map's wall cells; the virtual ring just
            // outside the map is only capped where it actually shows a face.
            if (inMap || anyFace) {
              const texture = vrRenderedTile(door ? assets.door : wallSurfaceTexture(cell));
              surfaces.push({ kind: "wall-top", x, y, texture, normal: vrNormalPath(texture), shade: door ? VR_SHADE.doorTop : VR_SHADE.top });
            }
          }
        }
        return { width, height, surfaces };
      }

      // Per-turn floor decals — items, armed traps, marks, markers, clouds,
      // spell effects. Driven by the game's own lists (a few dozen entries),
      // not a grid walk, so re-emitting every frame costs nothing.
      function vrDynamicDecalSurfaces() {
        const floorState = currentFloorState();
        const surfaces = [];
        const seen = (x, y) => vrCellDiscovered(floorState, x, y);
        for (const item of floorState.floorItems) {
          if (seen(item.x, item.y)) surfaces.push({ kind: "decal", x: item.x, y: item.y, texture: item.tile, inset: 0.24, lift: 0.02, alpha: 1 });
        }
        for (const trap of floorState.traps) {
          if (trap.armed && seen(trap.x, trap.y)) {
            const texture = vrRenderedTile(trap.tile);
            surfaces.push({ kind: "decal", x: trap.x, y: trap.y, texture, normal: vrNormalPath(texture), inset: 0.18, lift: 0.016, alpha: 1 });
          }
        }
        const markCells = new Set();
        for (const mark of floorState.floorMarks || []) markCells.add(keyOf(mark.x, mark.y));
        for (const key of markCells) {
          const [x, y] = key.split(",").map(Number);
          if (!seen(x, y)) continue;
          for (const mark of floorMarksAt(x, y).slice(-2)) {
            const texture = vrRenderedTile(floorMarkTexture(mark));
            surfaces.push({ kind: "decal", x, y, texture, normal: vrNormalPath(texture), inset: 0.14, lift: 0.01, alpha: Math.min(0.8, 0.4 + mark.intensity * 0.1) });
          }
        }
        for (const marker of state.mapMarkers || []) {
          if (marker.floorIndex === state.floorIndex && seen(marker.x, marker.y)) {
            surfaces.push({ kind: "decal", x: marker.x, y: marker.y, glyph: "◆", color: VR_MARKER_COLORS[marker.kind] || "#f1d07a", inset: 0.34, lift: 0.022, alpha: 0.9 });
          }
        }
        for (const cloud of floorState.clouds) {
          if (cloud.turns > 0 && seen(cloud.x, cloud.y)) surfaces.push({ kind: "decal", x: cloud.x, y: cloud.y, texture: vrCloudTexture(cloud), inset: 0.05, lift: 0.34, alpha: 0.55 });
        }
        for (const effect of state.effects) {
          for (const cell of effect.cells) {
            if (seen(cell.x, cell.y)) surfaces.push({ kind: "decal", x: cell.x, y: cell.y, texture: effectTexture(effect.kind), inset: 0.16, lift: 0.38, alpha: 0.78, tint: vrEffectTint(effect.kind) });
          }
        }
        // Point-to-move target: the tile the laser is resting on lights up.
        if (vrAimTile) {
          surfaces.push({ kind: "decal", x: vrAimTile.x, y: vrAimTile.y, glyph: "▣", color: "#f1d07a", inset: 0.08, lift: 0.028, alpha: 0.85 });
        }
        return surfaces;
      }

      function vrStructureDims() {
        const floor = currentFloor();
        return { width: floor.map.width, height: floor.map.height };
      }

      // Combined view — structure plus live decals — for tests and tooling;
      // the frame loop uses the two halves separately.
      function vrArchitectureModel() {
        const structure = vrStructureModel();
        return { width: structure.width, height: structure.height, surfaces: structure.surfaces.concat(vrDynamicDecalSurfaces()) };
      }

      // Facing yaw: rotation about +y with 0 = facing map south (+z), so a
      // doll's plane normal is (sin yaw, 0, cos yaw).
      function vrDirYaw(dir) {
        const step = dirs[dir] || dirs[0];
        return Math.atan2(step.x, step.y);
      }

      // Paper dolls: monsters, allies, the party marker, standing decor.
      // Rebuilt every frame (small), because billboard yaw tracks the head.
      function vrDollModel() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const dolls = [];
        for (const decor of floor.decor || []) {
          if (decor.kind === "floor") continue;
          if (!vrCellDiscovered(floorState, decor.x, decor.y)) continue;
          const tall = decor.name.includes("column") || decor.name.includes("idol");
          const spent = decorUsed(decor);
          const texture = vrRenderedTile(decor.tile);
          dolls.push({ kind: "decor", id: decorKey(decor), x: decor.x, y: decor.y, w: tall ? 0.6 : 0.72, h: tall ? 0.95 : 0.72, texture, normal: vrNormalPath(texture), facing: 0, alpha: spent ? 0.5 : 1, tint: spent ? { r: 0.6, g: 0.6, b: 0.6 } : null });
        }
        for (const monster of floorState.monsters) {
          if (monster.hp <= 0) continue;
          if (!vrCellDiscovered(floorState, monster.x, monster.y)) continue;
          const size = monster.boss ? VR.dollSize * 1.15 : VR.dollSize;
          dolls.push({
            kind: "monster", id: monster.id, x: monster.x, y: monster.y, w: size, h: size,
            texture: monster.tile, facing: 0, airborne: !!monster.traits?.airborne,
            hp: monster.hp, maxHp: monster.maxHp,
            hpFrac: Math.max(0, Math.min(1, monster.hp / monster.maxHp)), alpha: 1,
            statuses: typeof monsterStatusOverlays === "function" ? monsterStatusOverlays(monster) : []
          });
        }
        for (const ally of floorState.allies || []) {
          if (ally.hp <= 0) continue;
          if (!vrCellDiscovered(floorState, ally.x, ally.y)) continue;
          dolls.push({ kind: "ally", id: ally.id, x: ally.x, y: ally.y, w: 0.8, h: 0.8, glyph: ally.name[0].toLowerCase(), color: "#7fd08a", facing: 0, hp: ally.hp, maxHp: ally.maxHp, hpFrac: Math.max(0, Math.min(1, ally.hp / ally.maxHp)), alpha: 1 });
        }
        const partyHp = state.party.reduce((sum, member) => sum + Math.max(0, member.hp), 0);
        dolls.push({ kind: "party", id: "party", x: state.x, y: state.y, w: 0.9, h: 0.9, glyph: "@", color: "#f1d07a", facing: vrDirYaw(state.dir), hp: partyHp, maxHp: 1, alpha: 1 });
        return { width: floor.map.width, height: floor.map.height, dolls };
      }

      // Billboard yaws hold still until the head has ACTUALLY moved: a raw
      // atan2 of the head position re-rotates every quad by fractions of a
      // degree on ordinary head jitter, and each micro-rotation resamples the
      // texture — the "crawl" on billboarded sprites and panes. A small
      // deadband with memory (hysteresis, so no snapping at a threshold
      // boundary) keeps them rock-still until the viewer genuinely walks.
      const VR_YAW_DEADBAND = 0.035; // rad, ≈2°
      const vrYawCache = new Map();

      function vrSteadyYaw(key, yaw) {
        const held = vrYawCache.get(key);
        if (held !== undefined) {
          let diff = yaw - held;
          diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          if (Math.abs(diff) < VR_YAW_DEADBAND) return held;
        }
        vrYawCache.set(key, yaw);
        return yaw;
      }

      // Doll plane yaw for the active rotate mode. "dungeon": the doll is
      // pinned to the dungeon (rotate the diorama and you see it edge-on).
      // "billboard": it spins about its feet to face the viewer's head.
      function vrDollYaw(doll, headModel, mode) {
        if (mode !== "billboard") return doll.facing || 0;
        if (!headModel) return doll.facing || 0;
        const yaw = Math.atan2(headModel.x - doll.mx, headModel.z - doll.mz);
        return vrSteadyYaw(`doll:${doll.id || `${doll.kind}:${doll.x},${doll.y}`}`, yaw);
      }

      // Cheap change detector for everything the architecture pass renders.
      // Turn-rate state only — doll positions are re-read every frame anyway.
      function vrArchSignature() {
        const floorState = currentFloorState();
        return [
          state.floorIndex,
          state.turnCount,
          floorState.discovered.size,
          floorState.openedDoors.size,
          floorState.floorItems.length,
          floorState.traps.filter((trap) => trap.armed).length,
          floorState.usedDecor ? floorState.usedDecor.size : 0,
          floorState.clouds.length,
          (floorState.floorMarks || []).length,
          floorState.barricades ? floorState.barricades.size : 0,
          floorState.bridges ? floorState.bridges.size : 0,
          floorState.frozenTiles ? floorState.frozenTiles.size : 0,
          // Kind + position, not just count: dropping a marker on a marked
          // tile replaces it in place without advancing the turn.
          (state.mapMarkers || []).map((m) => `${m.floorIndex}:${m.x},${m.y}:${m.kind}`).join(";"),
          state.effects.length,
          state.x, state.y, state.dir,
          state.victory ? 1 : 0,
          state.defeated ? 1 : 0,
          // Run identity: a save-slot switch or new run swaps the whole world
          // without necessarily changing any of the counters above.
          state.runStartedAt || 0
        ].join("|");
      }

      // Change detector for the STRUCTURE pass alone. Deliberately excludes
      // turn count and per-turn lists — rebuilding the full grid every turn
      // was the turn-time hitch. Digging/freezing mutate the map rows without
      // moving any counter, so the rows are hashed (a few KB of FNV per
      // frame, microseconds).
      function vrStructureSignature() {
        const floorState = currentFloorState();
        let rowsHash = 2166136261;
        for (const row of currentFloor().map.rows) {
          for (let i = 0; i < row.length; i += 1) rowsHash = Math.imul(rowsHash ^ row.charCodeAt(i), 16777619);
        }
        return [
          state.floorIndex,
          vrArtStyle(),
          floorState.discovered.size,
          floorState.openedDoors.size,
          floorState.usedDecor ? floorState.usedDecor.size : 0,
          floorState.barricades ? floorState.barricades.size : 0,
          floorState.bridges ? floorState.bridges.size : 0,
          floorState.frozenTiles ? floorState.frozenTiles.size : 0,
          rowsHash >>> 0,
          state.runStartedAt || 0
        ].join("|");
      }

      function vrHudModel() {
        const floor = currentFloor();
        const message = state.victory ? `VICTORY — ${state.message}` : state.defeated ? `DEFEATED — ${state.message}` : state.message || "";
        return {
          title: `${floor.id} ${floor.name} · T${state.turnCount} · ${state.gold}g`,
          message,
          party: state.party.map((member) => ({ name: member.name, hp: Math.max(0, member.hp), maxHp: member.maxHp })),
          mode: vrDollMode(),
          hints: "aim at a floor tile + A/X walks there · trigger clicks the palette · stick move/turn · B/Y wait (hold rest) · grip drags what you point at"
        };
      }

      // ---------------------------------------------------------------------
      // Controller mapping. One full action set per hand so either controller
      // alone plays the game. Pure against a normalized input snapshot so the
      // tests can drive it; the caller feeds results to handleAction.

      // Fresh hand state treats everything as already held (prev* true, stick
      // latched): whatever is physically down when a controller appears —
      // session start, reconnect after sleep, return from the system menu —
      // must be released once before it can fire, so stale input never turns
      // into a phantom game action.
      function vrCreateHandState() {
        return {
          prevTrigger: true,
          prevPrimary: true,
          prevSecondary: true,
          prevStickClick: true,
          secondaryDownAt: 0,
          secondaryConsumed: true,
          stickSector: -1,
          stickLatched: true,
          stickNextRepeat: 0,
          grabTarget: null,
          grabDist: 0,
          prevAnchor: null,
          prevGripQ: null,
          // Hand tracking: pinch/grab hysteresis and what THIS pinch means
          // (chosen at the pinch's start, held until release).
          handPinch: false,
          handGrab: false,
          pinchRole: null
        };
      }

      function vrReadGamepad(gamepad) {
        const axes = gamepad.axes || [];
        // xr-standard puts the thumbstick on axes 2/3; older pads use 0/1.
        const x = axes.length >= 4 ? axes[2] : axes[0] || 0;
        const y = axes.length >= 4 ? axes[3] : axes[1] || 0;
        const button = (index) => !!gamepad.buttons?.[index]?.pressed;
        return { x: x || 0, y: y || 0, trigger: button(0), squeeze: button(1), stickClick: button(3), primary: button(4), secondary: button(5) };
      }

      // Bare-hand gestures from joint positions, with hysteresis so a pinch
      // hovering at the threshold cannot machine-gun presses:
      // - grab: a FIST — the middle fingertip curls in to the wrist. Drags
      //   panes and the diorama exactly like the controller grip.
      // - pinch: thumb and index tips touch (and the hand is NOT a fist —
      //   a closing fist touches them too). The hand's "trigger".
      function vrHandGesture(joints, prev) {
        const dist = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : Infinity;
        const curl = dist(joints.middle, joints.wrist);
        const grab = prev.grab ? curl < 0.095 : curl < 0.075;
        const gap = dist(joints.thumb, joints.index);
        const pinch = !grab && (prev.pinch ? gap < 0.035 : gap < 0.02);
        return { pinch, grab };
      }

      // Read a tracked hand as if it were a controller: pinch → trigger,
      // fist → grip. No thumbstick — hands move the party by pointing at a
      // floor tile and pinching (the pinch acts as the travel button when it
      // STARTS on a lit tile), and everything else lives on the palette.
      function vrReadHand(source, frame, hand, refSpace = vrRefSpace) {
        if (!source.hand || typeof frame.getJointPose !== "function") return null;
        const joint = (name) => {
          const space = typeof source.hand.get === "function" ? source.hand.get(name) : null;
          const pose = space ? frame.getJointPose(space, refSpace) : null;
          return pose ? pose.transform.position : null;
        };
        const joints = { thumb: joint("thumb-tip"), index: joint("index-finger-tip"), middle: joint("middle-finger-tip"), wrist: joint("wrist") };
        if (!joints.thumb || !joints.index) return null; // joints not tracked this frame
        const gesture = vrHandGesture(joints, { pinch: hand.handPinch, grab: hand.handGrab });
        hand.handPinch = gesture.pinch;
        hand.handGrab = gesture.grab;
        return {
          x: 0, y: 0,
          trigger: gesture.pinch,
          squeeze: gesture.grab,
          stickClick: false, primary: false, secondary: false,
          isHand: true,
          wrist: joints.wrist
        };
      }

      function vrStickSector(input, deadzone = VR.stickDeadzone) {
        if (Math.hypot(input.x, input.y) < deadzone) return -1;
        const angle = (Math.atan2(input.x, -input.y) + Math.PI * 2) % (Math.PI * 2);
        return Math.round(angle / (Math.PI / 4)) % 8;
      }

      function vrControllerStep(hand, input, nowMs) {
        const out = { actions: [], rotate: 0, scaleRate: 0, grabbing: false, toggleDolls: false, resetView: false, click: -1, clickPane: null };
        const stickClicked = input.stickClick && !hand.prevStickClick;

        if (input.squeeze) {
          // View hand: stick steers the diorama, click re-centres it, and the
          // frame loop drags it by the grip pose. No game actions leak through.
          out.grabbing = true;
          out.rotate = Math.abs(input.x) > VR.stickDeadzone ? input.x * Math.abs(input.x) : 0;
          out.scaleRate = Math.abs(input.y) > VR.stickDeadzone ? -input.y : 0;
          if (stickClicked) out.resetView = true;
          // Latch the stick: after the grip releases it must return to centre
          // before it can step the party again, so view steering never bleeds
          // into an immediate game move.
          hand.stickSector = -1;
          hand.stickLatched = true;
          // Swallow any B/Y press that overlaps the grip so releasing it
          // after a grab can't fire a stray wait/rest.
          hand.secondaryDownAt = nowMs;
          hand.secondaryConsumed = true;
        } else {
          if (stickClicked) out.toggleDolls = true;
          // Trigger clicks the pane cell under the pointer when one is
          // highlighted; otherwise it attacks. Panes sit off to the side, so
          // aiming at the diorama (normal play) always attacks.
          if (input.trigger && !hand.prevTrigger) {
            if (input.pointerButton >= 0) {
              out.click = input.pointerButton;
              out.clickPane = input.pointerPane || "palette";
            } else {
              out.actions.push("attack");
            }
          }
          if (input.primary && !hand.prevPrimary) out.actions.push("interact");
          if (input.secondary) {
            if (!hand.prevSecondary) {
              hand.secondaryDownAt = nowMs;
              hand.secondaryConsumed = false;
            } else if (!hand.secondaryConsumed && nowMs - hand.secondaryDownAt >= VR.holdRestMs) {
              hand.secondaryConsumed = true;
              out.actions.push("rest");
            }
          } else if (hand.prevSecondary && !hand.secondaryConsumed) {
            out.actions.push("wait");
          }

          // Once deflected, only stickRelease recentres — otherwise a stick
          // hovering at the deadzone edge re-fires the "fresh deflection"
          // branch every frame.
          const sector = vrStickSector(input, hand.stickSector >= 0 ? VR.stickRelease : VR.stickDeadzone);
          if (hand.stickLatched) {
            hand.stickSector = sector;
            if (sector === -1) hand.stickLatched = false;
          } else if (sector === -1) {
            hand.stickSector = -1;
          } else if (hand.stickSector === -1) {
            // Fresh deflection from centre steps immediately.
            hand.stickSector = sector;
            hand.stickNextRepeat = nowMs + VR.repeatMs;
            if (VR_STICK_ACTIONS[sector]) out.actions.push(VR_STICK_ACTIONS[sector]);
          } else {
            // Held or drifting between sectors: the repeat gate alone paces
            // actions, so boundary jitter can never fire faster than repeatMs.
            hand.stickSector = sector;
            if (VR_STICK_ACTIONS[sector] && nowMs >= hand.stickNextRepeat) {
              hand.stickNextRepeat = nowMs + VR.repeatMs;
              out.actions.push(VR_STICK_ACTIONS[sector]);
            }
          }
        }

        hand.prevTrigger = input.trigger;
        hand.prevPrimary = input.primary;
        hand.prevSecondary = input.secondary;
        hand.prevStickClick = input.stickClick;
        return out;
      }

      // ---------------------------------------------------------------------
      // Texture atlas: every tile, glyph, and flat shape lives in one canvas
      // so the whole diorama draws from a single GL texture. Tiles stamp in
      // whenever their image finishes loading (imageCache is shared with the
      // 2D renderer, so nothing loads twice).

      // The atlas is MIPMAPPED (trilinear minification): sampling level 0 at
      // NEAREST with no mips made every distant texel fight per pixel — the
      // whole scene crawled and one-texel lines strobed with the tiniest head
      // motion. The mip chain is built BY HAND, per cell, averaging in linear
      // light: gl.generateMipmap averages raw sRGB bytes, which makes every
      // level of a high-contrast tile (magma's black/red) come out too dark —
      // each mip has different brightness, and trilinear cross-fading between
      // them paints moving bands on the wall. Cells are 64-aligned with a
      // 16px gutter of their own edge colour, so every mip level down to the
      // 64→1 collapse lands on integer texels and never samples a neighbour.
      const VR_ATLAS_PAD = 16;
      const VR_ATLAS_ALIGN = 64;
      const VR_TILE_SLOT = 128;
      const VR_LINOCUT_TILE_SLOT = 256;
      const vrAtlas = { canvas: null, ctx: null, width: 2048, height: 4096, shelfX: 0, shelfY: 0, shelfH: 0, slots: new Map(), tiles: new Map(), pending: new Set(), dirtyCells: [] };
      const vrNormalAtlas = { canvas: null, ctx: null, width: 2048, height: 4096, pending: new Set(), dirtyCells: [] };
      let vrAtlasScope = null;
      let vrAtlasesNeedClear = false;

      function vrAtlasInit() {
        if (vrAtlas.canvas) return vrAtlas.ctx !== null;
        vrAtlas.canvas = document.createElement("canvas");
        vrAtlas.canvas.width = vrAtlas.width;
        vrAtlas.canvas.height = vrAtlas.height;
        vrAtlas.ctx = vrAtlas.canvas.getContext ? vrAtlas.canvas.getContext("2d", { willReadFrequently: true }) : null;
        return vrAtlas.ctx !== null;
      }

      function vrNormalAtlasInit() {
        if (vrNormalAtlas.canvas) return vrNormalAtlas.ctx !== null;
        vrNormalAtlas.canvas = document.createElement("canvas");
        vrNormalAtlas.canvas.width = vrNormalAtlas.width;
        vrNormalAtlas.canvas.height = vrNormalAtlas.height;
        vrNormalAtlas.ctx = vrNormalAtlas.canvas.getContext ? vrNormalAtlas.canvas.getContext("2d", { willReadFrequently: true }) : null;
        return vrNormalAtlas.ctx !== null;
      }

      function vrAtlasScopeIdentity() {
        return `${state.floorIndex}|${vrArtStyle()}`;
      }

      function vrResetAtlases(scope = vrAtlasScopeIdentity()) {
        if (vrAtlas.ctx) vrAtlas.ctx.clearRect(0, 0, vrAtlas.width, vrAtlas.height);
        if (vrNormalAtlas.ctx) vrNormalAtlas.ctx.clearRect(0, 0, vrNormalAtlas.width, vrNormalAtlas.height);
        vrAtlas.shelfX = 0;
        vrAtlas.shelfY = 0;
        vrAtlas.shelfH = 0;
        vrAtlas.slots.clear();
        vrAtlas.tiles.clear();
        vrAtlas.pending.clear();
        vrAtlas.dirtyCells.length = 0;
        vrNormalAtlas.pending.clear();
        vrNormalAtlas.dirtyCells.length = 0;
        vrAtlasScope = scope;
        vrAtlasesNeedClear = true;
        vrLastArchSignature = null;
      }

      function vrEnsureAtlasScope() {
        const scope = vrAtlasScopeIdentity();
        if (scope !== vrAtlasScope) vrResetAtlases(scope);
        return scope;
      }

      // Reserves a 64-aligned cell holding width×height plus the gutter ring;
      // returns the INNER rect (the cell is recoverable via vrAtlasCellRect).
      function vrAtlasAllocate(width, height) {
        const cellW = Math.ceil((width + VR_ATLAS_PAD * 2) / VR_ATLAS_ALIGN) * VR_ATLAS_ALIGN;
        const cellH = Math.ceil((height + VR_ATLAS_PAD * 2) / VR_ATLAS_ALIGN) * VR_ATLAS_ALIGN;
        if (cellW > vrAtlas.width || cellH > vrAtlas.height) {
          throw new Error(`XR tile atlas overflow: ${width}x${height} pixels requires a ${cellW}x${cellH} cell, larger than the ${vrAtlas.width}x${vrAtlas.height} atlas`);
        }
        if (vrAtlas.shelfX + cellW > vrAtlas.width) {
          vrAtlas.shelfX = 0;
          vrAtlas.shelfY += vrAtlas.shelfH;
          vrAtlas.shelfH = 0;
        }
        if (vrAtlas.shelfY + cellH > vrAtlas.height) {
          throw new Error(`XR tile atlas overflow: ${width}x${height} pixels requires a ${cellW}x${cellH} cell at y=${vrAtlas.shelfY}, beyond the ${vrAtlas.width}x${vrAtlas.height} atlas`);
        }
        const rect = { x: vrAtlas.shelfX + VR_ATLAS_PAD, y: vrAtlas.shelfY + VR_ATLAS_PAD, w: width, h: height, cellX: vrAtlas.shelfX, cellY: vrAtlas.shelfY, cellW, cellH };
        vrAtlas.shelfX += cellW;
        vrAtlas.shelfH = Math.max(vrAtlas.shelfH, cellH);
        return rect;
      }

      function vrAtlasCellRect(rect) {
        return { x: rect.cellX, y: rect.cellY, w: rect.cellW, h: rect.cellH };
      }

      function vrAtlasPaddedRect(rect) {
        return { x: rect.x - VR_ATLAS_PAD, y: rect.y - VR_ATLAS_PAD, w: rect.w + VR_ATLAS_PAD * 2, h: rect.h + VR_ATLAS_PAD * 2 };
      }

      function vrAtlasUvFromRect(rect) {
        return {
          u0: (rect.x + 0.5) / vrAtlas.width,
          v0: (rect.y + 0.5) / vrAtlas.height,
          u1: (rect.x + rect.w - 0.5) / vrAtlas.width,
          v1: (rect.y + rect.h - 0.5) / vrAtlas.height
        };
      }

      function vrFillNeutralNormal(rect) {
        if (!vrNormalAtlasInit()) return;
        const cell = vrAtlasCellRect(rect);
        vrNormalAtlas.ctx.fillStyle = "#8080ff";
        vrNormalAtlas.ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        vrNormalAtlas.dirtyCells.push(cell);
      }

      function vrAtlasShape(key, draw, size = 64) {
        vrEnsureAtlasScope();
        const existing = vrAtlas.slots.get(key);
        if (existing) return existing;
        if (!vrAtlasInit()) return { u0: 0, v0: 0, u1: 0, v1: 0 };
        const rect = vrAtlasAllocate(size, size);
        const cell = vrAtlasCellRect(rect);
        vrAtlas.ctx.clearRect(cell.x, cell.y, cell.w, cell.h);
        draw(vrAtlas.ctx, rect, cell);
        vrAtlas.dirtyCells.push(cell);
        vrFillNeutralNormal(rect);
        const uv = vrAtlasUvFromRect(rect);
        vrAtlas.slots.set(key, uv);
        return uv;
      }

      function vrWhiteUv() {
        // Fill the whole cell, so the white stays white at every mip level.
        return vrAtlasShape("shape:white", (ctx, rect, cell) => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        }, 16);
      }

      function vrGlyphUv(glyph, color) {
        return vrAtlasShape(`glyph:${glyph}:${color}`, (ctx, rect) => {
          ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
          ctx.font = `bold ${Math.floor(rect.h * 0.82)}px "Courier New", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(10, 9, 8, 0.9)";
          ctx.strokeText(glyph, rect.x + rect.w / 2, rect.y + rect.h * 0.56);
          ctx.fillStyle = color;
          ctx.fillText(glyph, rect.x + rect.w / 2, rect.y + rect.h * 0.56);
        });
      }

      function vrArrowUv(color) {
        return vrAtlasShape(`shape:arrow:${color}`, (ctx, rect) => {
          ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
          ctx.fillStyle = color;
          ctx.beginPath();
          // Points toward -v (map north before rotation).
          ctx.moveTo(rect.x + rect.w / 2, rect.y + rect.h * 0.08);
          ctx.lineTo(rect.x + rect.w * 0.86, rect.y + rect.h * 0.86);
          ctx.lineTo(rect.x + rect.w / 2, rect.y + rect.h * 0.64);
          ctx.lineTo(rect.x + rect.w * 0.14, rect.y + rect.h * 0.86);
          ctx.closePath();
          ctx.fill();
        });
      }

      // Placeholder for not-yet-loaded art. A FLAT tone on purpose: any
      // pattern here (the old checkerboard) shimmers into moire bands under
      // nearest-neighbour minification whenever a quad briefly renders
      // before its texture stamps in.
      function vrFallbackUv() {
        return vrAtlasShape("shape:fallback", (ctx, rect, cell) => {
          ctx.fillStyle = "#2e2823";
          ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        }, 16);
      }

      // High-resolution linocut art keeps twice the atlas resolution of the
      // classic tiles without making the atlas too large for headset GPUs.
      function vrTileUv(src, normalSrc = null) {
        vrEnsureAtlasScope();
        if (!src) return vrFallbackUv();
        const slot = vrAtlas.tiles.get(src);
        if (slot) {
          if (normalSrc && !slot.normalSrc) {
            slot.normalSrc = normalSrc;
            vrNormalAtlas.pending.add(src);
          }
          return slot.uv;
        }
        imageEntry(src); // kick the load
        if (!vrAtlasInit()) return vrFallbackUv(); // headless: no canvas to allocate in
        const tileSlot = normalSrc ? VR_LINOCUT_TILE_SLOT : VR_TILE_SLOT;
        const rect = vrAtlasAllocate(tileSlot, tileSlot);
        const cell = vrAtlasCellRect(rect);
        vrAtlas.ctx.fillStyle = "#efeae2";
        vrAtlas.ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        vrAtlas.dirtyCells.push(cell);
        vrFillNeutralNormal(rect);
        const fresh = { uv: vrAtlasUvFromRect(rect), rect, stamped: false, normalSrc, normalReady: false };
        vrAtlas.tiles.set(src, fresh);
        vrAtlas.pending.add(src);
        if (normalSrc) vrNormalAtlas.pending.add(src);
        return fresh.uv;
      }

      function vrTileHasNormal(src) {
        return vrAtlas.tiles.get(src)?.normalReady === true;
      }

      // Fill white slots as their images arrive: decoded off-thread first
      // (image.decode()), at most VR_STAMP_BUDGET per frame, stamped straight
      // into the slot the geometry already points at. Only an odd-sized image
      // (slot too small) forces a relocation and a structure re-emit.
      const VR_STAMP_BUDGET = 3;

      function vrNow() {
        return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      }

      function vrStampPendingTiles() {
        let stamped = 0;
        for (const src of [...vrAtlas.pending]) {
          if (stamped >= VR_STAMP_BUDGET) break;
          const slot = vrAtlas.tiles.get(src);
          if (!slot) {
            vrAtlas.pending.delete(src);
            continue;
          }
          const entry = imageEntry(src);
          if (entry.failed) {
            // No art will ever come; the white panel stays, honestly.
            vrAtlas.pending.delete(src);
            slot.stamped = true;
            continue;
          }
          if (!entry.ready) continue;
          if (entry.image.decode && !entry.vrDecoded) {
            if (!entry.vrDecoding) {
              entry.vrDecoding = true;
              entry.vrDecodeStart = vrNow();
              entry.image.decode().then(() => { entry.vrDecoded = true; }).catch(() => { entry.vrDecoded = true; });
            }
            // decode() promises can sit unresolved forever in a throttled or
            // backgrounded tab; past the deadline just draw — a 32×32 PNG
            // decodes synchronously in microseconds, and the budget caps it.
            if (vrNow() - entry.vrDecodeStart < 150) continue;
          }
          const image = entry.image;
          vrStampWithGutter(image, slot.rect, vrAtlas);
          slot.stamped = true;
          vrAtlas.pending.delete(src);
          stamped += 1;
        }
      }

      function vrStampPendingNormals() {
        let stamped = 0;
        for (const src of [...vrNormalAtlas.pending]) {
          if (stamped >= VR_STAMP_BUDGET) break;
          const slot = vrAtlas.tiles.get(src);
          if (!slot?.normalSrc) {
            vrNormalAtlas.pending.delete(src);
            continue;
          }
          const entry = imageEntry(slot.normalSrc);
          if (entry.failed) {
            vrNormalAtlas.pending.delete(src);
            slot.normalReady = false;
            continue;
          }
          if (!entry.ready) continue;
          if (entry.image.decode && !entry.vrDecoded) {
            if (!entry.vrDecoding) {
              entry.vrDecoding = true;
              entry.vrDecodeStart = vrNow();
              entry.image.decode().then(() => { entry.vrDecoded = true; }).catch(() => { entry.vrDecoded = true; });
            }
            if (vrNow() - entry.vrDecodeStart < 150) continue;
          }
          vrStampWithGutter(entry.image, slot.rect, vrNormalAtlas);
          slot.normalReady = true;
          vrNormalAtlas.pending.delete(src);
          vrLastArchSignature = null;
          stamped += 1;
        }
      }

      // Stamp the image and replicate its outermost pixels across the whole
      // cell's gutter, so every mip level keeps sampling this tile's colours.
      function vrStampWithGutter(image, rect, atlas) {
        const ctx = atlas.ctx;
        const cell = vrAtlasCellRect(rect);
        const { x, y, w, h } = rect;
        const sourceWidth = image.naturalWidth || image.width || w;
        const sourceHeight = image.naturalHeight || image.height || h;
        const left = x - cell.x;
        const top = y - cell.y;
        const right = cell.x + cell.w - (x + w);
        const bottom = cell.y + cell.h - (y + h);
        ctx.clearRect(cell.x, cell.y, cell.w, cell.h);
        ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight, x, y, w, h);
        ctx.drawImage(image, 0, 0, sourceWidth, 1, x, cell.y, w, top);
        ctx.drawImage(image, 0, sourceHeight - 1, sourceWidth, 1, x, y + h, w, bottom);
        ctx.drawImage(image, 0, 0, 1, sourceHeight, cell.x, y, left, h);
        ctx.drawImage(image, sourceWidth - 1, 0, 1, sourceHeight, x + w, y, right, h);
        ctx.drawImage(image, 0, 0, 1, 1, cell.x, cell.y, left, top);            // corners
        ctx.drawImage(image, sourceWidth - 1, 0, 1, 1, x + w, cell.y, right, top);
        ctx.drawImage(image, 0, sourceHeight - 1, 1, 1, cell.x, y + h, left, bottom);
        ctx.drawImage(image, sourceWidth - 1, sourceHeight - 1, 1, 1, x + w, y + h, right, bottom);
        atlas.dirtyCells.push(cell);
      }

      // ---------------------------------------------------------------------
      // Geometry emission: semantic surfaces/dolls → interleaved triangles.
      // Model space here is metres-agnostic tile space;
      // the model matrix applies table position/yaw/scale.
      const VR_VERTEX_FLOATS = 16;

      function vrPushQuad(verts, corners, uv, r, g, b, a, hasNormal = false) {
        const unit = (vector) => {
          const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
          return [vector[0] / length, vector[1] / length, vector[2] / length];
        };
        const tangent = unit([corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]]);
        const bitangent = unit([corners[3][0] - corners[0][0], corners[3][1] - corners[0][1], corners[3][2] - corners[0][2]]);
        const points = [
          [corners[0], uv.u0, uv.v0],
          [corners[1], uv.u1, uv.v0],
          [corners[2], uv.u1, uv.v1],
          [corners[3], uv.u0, uv.v1]
        ];
        for (const index of [0, 1, 2, 0, 2, 3]) {
          const [p, u, v] = points[index];
          verts.push(p[0], p[1], p[2], u, v, r, g, b, a, ...tangent, ...bitangent, hasNormal ? 1 : 0);
        }
      }

      function vrRotatedFloorCorners(mx, mz, half, lift, yaw) {
        const cosYaw = Math.cos(yaw || 0);
        const sinYaw = Math.sin(yaw || 0);
        const corner = (dx, dz) => [mx + dx * cosYaw + dz * sinYaw, lift, mz - dx * sinYaw + dz * cosYaw];
        return [corner(-half, -half), corner(half, -half), corner(half, half), corner(-half, half)];
      }

      // Solid geometry keeps the depth buffer honest; anything see-through
      // (clouds, spell washes, floor marks, markers) goes to a second list
      // drawn after the dolls with depth writes off.
      function vrEmitArchitecture(model) {
        const solid = [];
        const translucent = [];
        const halfW = model.width / 2;
        const halfH = model.height / 2;
        const H = VR.wallHeight;
        for (const surface of model.surfaces) {
          const x0 = surface.x - halfW;
          const z0 = surface.y - halfH;
          const x1 = x0 + 1;
          const z1 = z0 + 1;
          const shade = surface.shade ?? 1;
          const tint = surface.tint || { r: 1, g: 1, b: 1 };
          const alpha = surface.alpha ?? 1;
          const uv = surface.glyph ? vrGlyphUv(surface.glyph, surface.color || "#f1d07a") : vrTileUv(surface.texture, surface.normal);
          const hasNormal = !surface.glyph && !!surface.normal && vrTileHasNormal(surface.texture);
          if (surface.kind === "floor") {
            vrPushQuad(solid, [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], uv, shade, shade, shade, 1, hasNormal);
          } else if (surface.kind === "wall-top") {
            vrPushQuad(solid, [[x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1]], uv, shade, shade, shade, 1, hasNormal);
          } else if (surface.kind === "wall-face" || surface.kind === "door-face") {
            const corners = {
              N: [[x1, H, z0], [x0, H, z0], [x0, 0, z0], [x1, 0, z0]],
              S: [[x0, H, z1], [x1, H, z1], [x1, 0, z1], [x0, 0, z1]],
              W: [[x0, H, z0], [x0, H, z1], [x0, 0, z1], [x0, 0, z0]],
              E: [[x1, H, z1], [x1, H, z0], [x1, 0, z0], [x1, 0, z1]]
            }[surface.side];
            vrPushQuad(solid, corners, uv, shade, shade, shade, 1, hasNormal);
          } else if (surface.kind === "decal") {
            const half = 0.5 - (surface.inset ?? 0.1);
            const corners = vrRotatedFloorCorners(x0 + 0.5, z0 + 0.5, half, surface.lift ?? 0.012, surface.rot || 0);
            const target = alpha < 1 || surface.tint ? translucent : solid;
            vrPushQuad(target, corners, uv, tint.r * shade, tint.g * shade, tint.b * shade, alpha, hasNormal);
          }
        }
        return { solid, translucent };
      }

      // Same solid/translucent split as the architecture: a see-through doll
      // (spent decor) or the party's floor arrow must not write depth, or the
      // dolls drawn after them vanish behind their transparent pixels.
      function vrEmitDolls(model, headModel, mode, nowMs = 0) {
        const solid = [];
        const translucent = [];
        const halfW = model.width / 2;
        const halfH = model.height / 2;
        const white = vrWhiteUv();
        for (const doll of model.dolls) {
          // Animated tile position: dolls glide between tiles (and flash /
          // shed damage numbers — vrDollFeel tracks the deltas).
          const feel = vrDollFeel(doll, nowMs);
          doll.mx = feel.x + 0.5 - halfW;
          doll.mz = feel.z + 0.5 - halfH;
          const yaw = vrDollYaw(doll, headModel, mode);
          const rx = Math.cos(yaw);
          const rz = -Math.sin(yaw);
          const base = doll.airborne ? 0.2 : 0;
          // Plant the artwork (not the padded tile) on the floor, same trick
          // as the 2D renderer's actorTileBounds.
          const content = doll.texture && typeof tileContentBox === "function" ? tileContentBox(doll.texture) : { bottom: 1 };
          const sink = (1 - content.bottom) * doll.h;
          const y0 = base - sink;
          const y1 = y0 + doll.h;
          const cx = doll.mx;
          const cz = doll.mz;
          const hw = doll.w / 2;
          const uv = doll.glyph ? vrGlyphUv(doll.glyph, doll.color || "#f1d07a") : vrTileUv(doll.texture, doll.normal);
          const hasNormal = !doll.glyph && !!doll.normal && vrTileHasNormal(doll.texture);
          const tint = doll.tint || { r: 1, g: 1, b: 1 };
          const alpha = doll.alpha ?? 1;
          vrPushQuad(alpha < 1 ? translucent : solid, [
            [cx - rx * hw, y1, cz - rz * hw],
            [cx + rx * hw, y1, cz + rz * hw],
            [cx + rx * hw, y0, cz + rz * hw],
            [cx - rx * hw, y0, cz - rz * hw]
          ], uv, tint.r, tint.g, tint.b, alpha, hasNormal);

          if (doll.kind === "party") {
            const arrow = vrRotatedFloorCorners(cx, cz, 0.32, 0.024, doll.facing + Math.PI);
            vrPushQuad(translucent, arrow, vrArrowUv(doll.color || "#f1d07a"), 1, 1, 1, 0.92);
          }
          // Status art over the afflicted doll, on its own plane: the net
          // wraps it, flames lick its lower half, poison washes it green,
          // fear hangs a sigil by its head. Same vocabulary as the 2D view.
          for (const status of doll.statuses || []) {
            const suv = vrTileUv(status.texture);
            const quad = (x0f, y0f, x1f, y1f, list, r, g, b, a) => vrPushQuad(list, [
              [cx - rx * hw + rx * doll.w * x0f, y0 + doll.h * y1f, cz - rz * hw + rz * doll.w * x0f],
              [cx - rx * hw + rx * doll.w * x1f, y0 + doll.h * y1f, cz - rz * hw + rz * doll.w * x1f],
              [cx - rx * hw + rx * doll.w * x1f, y0 + doll.h * y0f, cz - rz * hw + rz * doll.w * x1f],
              [cx - rx * hw + rx * doll.w * x0f, y0 + doll.h * y0f, cz - rz * hw + rz * doll.w * x0f]
            ], suv, r, g, b, a);
            if (status.badge) quad(0.62, 0.85, 1.02, 1.25, translucent, 1, 1, 1, status.alpha);
            else if (status.lower) quad(0, 0, 1, 0.55, translucent, 1, 1, 1, status.alpha);
            else quad(-0.04, -0.02, 1.04, 1.02, translucent, 1, 1, 1, status.alpha);
          }
          if (typeof doll.hpFrac === "number" && doll.hpFrac < 1) {
            const barY = base + doll.h + 0.05;
            const barW = doll.w * 0.6;
            const bar = (frac, y0b, y1b, r, g, b) => vrPushQuad(solid, [
              [cx - rx * barW / 2, y1b, cz - rz * barW / 2],
              [cx - rx * barW / 2 + rx * barW * frac, y1b, cz - rz * barW / 2 + rz * barW * frac],
              [cx - rx * barW / 2 + rx * barW * frac, y0b, cz - rz * barW / 2 + rz * barW * frac],
              [cx - rx * barW / 2, y0b, cz - rz * barW / 2]
            ], white, r, g, b, 1);
            bar(1, barY, barY + 0.06, 0.06, 0.05, 0.04);
            bar(Math.max(0.02, doll.hpFrac), barY + 0.012, barY + 0.048, 0.85, 0.32, 0.26);
          }
          // Hit flash: a white-hot wash over the doll that fades in ~200ms.
          const flashStart = nowMs && doll.id ? vrDollFlash.get(doll.id) : undefined;
          if (flashStart !== undefined && nowMs - flashStart < VR_FLASH_MS) {
            const fade = 1 - (nowMs - flashStart) / VR_FLASH_MS;
            vrPushQuad(translucent, [
              [cx - rx * hw, y1, cz - rz * hw],
              [cx + rx * hw, y1, cz + rz * hw],
              [cx + rx * hw, y0, cz + rz * hw],
              [cx - rx * hw, y0, cz - rz * hw]
            ], white, 1, 0.62, 0.5, 0.65 * fade);
          }
        }
        // Dolls that vanished (deaths, mostly) shed their final damage number
        // from where they stood, and their animation state is dropped.
        if (nowMs) {
          const present = new Set(model.dolls.map((doll) => doll.id).filter(Boolean));
          for (const [id, prev] of [...vrDollHp]) {
            if (present.has(id)) continue;
            const anim = vrDollAnim.get(id);
            if (anim && prev.hp > 0) {
              vrFloaters.push({ x: anim.tx, y: anim.tz, lift: 0.9, text: String(prev.hp), color: "#ffd166", start: nowMs });
            }
            vrDollHp.delete(id);
            vrDollAnim.delete(id);
            vrDollFlash.delete(id);
          }
        }
        vrEmitFloaters(model, headModel, nowMs, translucent);
        return { solid, translucent };
      }

      // Party statuses cover the VIEW itself, head-locked like a visor: a net
      // across everything while snared, fire licking up from the bottom while
      // burning, colour washes for poison and engulfment. Driven by the same
      // partyStatusOverlays list as the 2D viewport.
      function vrEmitPartyOverlay(headTransform, nowMs = 0) {
        const overlays = typeof partyStatusOverlays === "function" ? partyStatusOverlays() : [];
        // Transient hit pulse: a red edge that flares when the party takes
        // damage and fades within a quarter second.
        if (nowMs && vrPartyHitAt && nowMs - vrPartyHitAt < 260) {
          overlays.push({ kind: "hit", color: [214, 60, 40], alpha: 0.3 * (1 - (nowMs - vrPartyHitAt) / 260) });
        }
        if (overlays.length === 0) return [];
        const o = headTransform.orientation;
        const q = o ? [o.x, o.y, o.z, o.w] : [0, 0, 0, 1];
        const p = headTransform.position;
        const fwd = vrQRotate(q, [0, 0, -1]);
        const right = vrQRotate(q, [1, 0, 0]);
        const up = vrQRotate(q, [0, 1, 0]);
        const D = 0.5;
        const W = 1.35;
        const H = 1.0;
        const c = [p.x + fwd[0] * D, p.y + fwd[1] * D, p.z + fwd[2] * D];
        const at = (u, v) => [
          c[0] + right[0] * u * W + up[0] * v * H,
          c[1] + right[1] * u * W + up[1] * v * H,
          c[2] + right[2] * u * W + up[2] * v * H
        ];
        const verts = [];
        const white = vrWhiteUv();
        const quad = (u0, v0, u1, v1, uv, r, g, b, a) => vrPushQuad(verts, [at(u0, v1), at(u1, v1), at(u1, v0), at(u0, v0)], uv, r, g, b, a);
        for (const overlay of overlays) {
          if (overlay.kind === "net") {
            // A mesh of net tiles, not one blurry stretch.
            const uv = vrTileUv(overlay.texture);
            const cols = 6;
            const rows = 4;
            for (let i = 0; i < cols; i += 1) {
              for (let j = 0; j < rows; j += 1) {
                quad(-0.5 + i / cols, -0.5 + j / rows, -0.5 + (i + 1) / cols, -0.5 + (j + 1) / rows, uv, 1, 1, 1, overlay.alpha);
              }
            }
          } else {
            const [r, g, b] = overlay.color;
            quad(-0.5, -0.5, 0.5, 0.5, white, r / 255, g / 255, b / 255, overlay.alpha);
            if (overlay.texture) {
              const uv = vrTileUv(overlay.texture);
              const cols = 5;
              for (let i = 0; i < cols; i += 1) {
                quad(-0.5 + i / cols, -0.5, -0.5 + (i + 1) / cols, -0.28, uv, 1, 1, 1, Math.min(1, overlay.alpha * 1.8));
              }
            }
          }
        }
        return verts;
      }

      // ---------------------------------------------------------------------
      // HUD: one canvas texture floating over the diorama with the message
      // line, party bars, and the control hints.

      const vrHud = { canvas: null, ctx: null, width: 1024, height: 512 };

      function vrHudInit() {
        return vrCanvasInit(vrHud, 1024, 512);
      }

      function vrWrapText(text, max) {
        const words = String(text).split(/\s+/);
        const lines = [];
        let line = "";
        for (const word of words) {
          if (line && line.length + word.length + 1 > max) {
            lines.push(line);
            line = word;
          } else {
            line = line ? `${line} ${word}` : word;
          }
        }
        if (line) lines.push(line);
        return lines.slice(0, 3);
      }

      function vrDrawHud() {
        if (!vrHudInit()) return false;
        const model = vrHudModel();
        const ctx = vrHud.ctx;
        const w = vrHud.width;
        const h = vrHud.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(14, 12, 10, 0.86)";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(238, 193, 101, 0.4)";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillStyle = "#f1d07a";
        ctx.font = "bold 40px system-ui, sans-serif";
        ctx.fillText(model.title, 28, 22);
        ctx.fillStyle = "#e8ddc8";
        ctx.font = "34px system-ui, sans-serif";
        vrWrapText(model.message, 56).forEach((line, index) => ctx.fillText(line, 28, 84 + index * 42));

        const barTop = 232;
        model.party.forEach((member, index) => {
          const y = barTop + index * 52;
          ctx.fillStyle = member.hp > 0 ? "#e8ddc8" : "#8a7f6c";
          ctx.font = "30px system-ui, sans-serif";
          ctx.fillText(member.name, 28, y);
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.fillRect(220, y + 4, 560, 26);
          ctx.fillStyle = member.hp > 0 ? "#d86452" : "#463c34";
          ctx.fillRect(222, y + 6, 556 * Math.max(0, Math.min(1, member.hp / member.maxHp)), 22);
          ctx.fillStyle = "#f5efe2";
          ctx.font = "24px system-ui, sans-serif";
          ctx.fillText(`${member.hp}/${member.maxHp}`, 800, y + 4);
        });

        ctx.fillStyle = "#b7d2df";
        ctx.font = "26px system-ui, sans-serif";
        ctx.fillText(`paper dolls: ${model.mode === "billboard" ? "face the player" : "rotate with the dungeon"}`, 28, 452);
        ctx.fillStyle = "#8a8172";
        ctx.font = "20px system-ui, sans-serif";
        ctx.fillText(model.hints, 28, 486);
        return true;
      }

      // ---------------------------------------------------------------------
      // WebGL plumbing.

      const VR_VERTEX_SHADER = `
        attribute vec3 aPos;
        attribute vec2 aUv;
        attribute vec4 aColor;
        attribute vec3 aTangent;
        attribute vec3 aBitangent;
        attribute float aHasNormal;
        uniform mat4 uProj;
        uniform mat4 uView;
        uniform mat4 uModel;
        varying vec2 vUv;
        varying vec4 vColor;
        varying vec3 vTangent;
        varying vec3 vBitangent;
        varying float vHasNormal;
        void main() {
          vUv = aUv;
          vColor = aColor;
          mat3 modelBasis = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz);
          vTangent = normalize(modelBasis * aTangent);
          vBitangent = normalize(modelBasis * aBitangent);
          vHasNormal = aHasNormal;
          gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
        }
      `;
      // highp where available: with mediump (fp16) varyings, UVs into the
      // 2048px atlas quantise to whole-texel steps and bleed across slots on
      // mobile GPUs — exactly the hardware a Quest runs.
      const VR_FRAGMENT_SHADER = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        uniform sampler2D uTex;
        uniform sampler2D uNormalTex;
        uniform vec3 uLightDir;
        uniform float uCutoff;
        varying vec2 vUv;
        varying vec4 vColor;
        varying vec3 vTangent;
        varying vec3 vBitangent;
        varying float vHasNormal;
        void main() {
          vec4 color = texture2D(uTex, vUv) * vColor;
          if (color.a < uCutoff) discard;
          if (vHasNormal > 0.5) {
            vec3 mapped = texture2D(uNormalTex, vUv).rgb * 2.0 - 1.0;
            vec3 tileUp = normalize(-vBitangent);
            vec3 surfaceNormal = normalize(cross(vTangent, tileUp));
            vec3 worldNormal = normalize(vTangent * mapped.x + tileUp * mapped.y + surfaceNormal * mapped.z);
            float diffuse = max(dot(worldNormal, normalize(uLightDir)), 0.0);
            color.rgb *= 0.55 + diffuse * 0.45;
          }
          gl_FragColor = color;
        }
      `;

      function vrCompileProgram(gl) {
        const compile = (type, source) => {
          const shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
          return shader;
        };
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VR_VERTEX_SHADER));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, VR_FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "program link failed");
        return program;
      }

      function vrInitGl() {
        if (vrGlState) return vrGlState;
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl", { xrCompatible: true, antialias: true, alpha: true });
        if (!gl) throw new Error("WebGL unavailable");
        const program = vrCompileProgram(gl);
        const glState = {
          canvas,
          program,
          aPos: gl.getAttribLocation(program, "aPos"),
          aUv: gl.getAttribLocation(program, "aUv"),
          aColor: gl.getAttribLocation(program, "aColor"),
          aTangent: gl.getAttribLocation(program, "aTangent"),
          aBitangent: gl.getAttribLocation(program, "aBitangent"),
          aHasNormal: gl.getAttribLocation(program, "aHasNormal"),
          uProj: gl.getUniformLocation(program, "uProj"),
          uView: gl.getUniformLocation(program, "uView"),
          uModel: gl.getUniformLocation(program, "uModel"),
          uTex: gl.getUniformLocation(program, "uTex"),
          uNormalTex: gl.getUniformLocation(program, "uNormalTex"),
          uLightDir: gl.getUniformLocation(program, "uLightDir"),
          uCutoff: gl.getUniformLocation(program, "uCutoff"),
          archBuffer: gl.createBuffer(),
          archCount: 0,
          transBuffer: gl.createBuffer(),
          transCount: 0,
          dollBuffer: gl.createBuffer(),
          dollCount: 0,
          dollTransBuffer: gl.createBuffer(),
          dollTransCount: 0,
          hudBuffer: gl.createBuffer(),
          hudCount: 0,
          panelBuffer: gl.createBuffer(),
          panelCount: 0,
          partyBuffer: gl.createBuffer(),
          partyCount: 0,
          invBuffer: gl.createBuffer(),
          invCount: 0,
          pointerBuffer: gl.createBuffer(),
          pointerCount: 0,
          overlayBuffer: gl.createBuffer(),
          overlayCount: 0,
          atlasTexture: gl.createTexture(),
          normalAtlasTexture: gl.createTexture(),
          hudTexture: gl.createTexture(),
          panelTexture: gl.createTexture(),
          partyTexture: gl.createTexture(),
          invTexture: gl.createTexture(),
          identity: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        };
        for (const texture of [glState.atlasTexture, glState.normalAtlasTexture, glState.hudTexture, glState.panelTexture, glState.partyTexture, glState.invTexture]) {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        // Full-size atlas with an explicitly allocated mip chain: every level
        // is filled BY US (vrUploadCellMips) with gamma-correct downsamples —
        // gl.generateMipmap is never used. Newly stamped tiles patch all of
        // their own levels via texSubImage2D.
        glState.atlasLevels = Math.round(Math.log2(Math.max(vrAtlas.width, vrAtlas.height))) + 1;
        for (const texture of [glState.atlasTexture, glState.normalAtlasTexture]) {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          for (let level = 0; level < glState.atlasLevels; level += 1) {
            gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, Math.max(1, vrAtlas.width >> level), Math.max(1, vrAtlas.height >> level), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          }
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        // Trilinear minification: without mips, distant texels fought
        // per-pixel on every tiny head movement — the whole scene shimmered
        // and one-texel lines strobed.
        // LINEAR magnification too: mixing NEAREST-mag with trilinear-min
        // put a visible sparkle band at the exact distance where sampling
        // switched modes — worst on high-contrast tiles (magma's black/red
        // boundary). Slightly softer up close, stable at every distance.
        // Anisotropic sampling keeps floors sharp at grazing angles, where
        // plain trilinear over-blurs and lets edges shimmer.
        const aniso = gl.getExtension("EXT_texture_filter_anisotropic")
          || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic")
          || gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
        if (aniso) {
          const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
          for (const texture of [glState.atlasTexture, glState.normalAtlasTexture]) {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
          }
          glState.anisoExt = aniso;
          glState.anisoMax = Math.min(8, max);
        }
        vrGl = gl;
        vrGlState = glState;
        return glState;
      }

      function vrUploadBuffer(buffer, verts) {
        vrGl.bindBuffer(vrGl.ARRAY_BUFFER, buffer);
        vrGl.bufferData(vrGl.ARRAY_BUFFER, new Float32Array(verts), vrGl.DYNAMIC_DRAW);
        return verts.length / VR_VERTEX_FLOATS;
      }

      // Pane/HUD canvases upload with mipmaps and linear filtering: they are
      // text, and unmipped NEAREST text at any distance breaks into crawling
      // fragments. All pane canvases are allocated power-of-two (WebGL1's
      // generateMipmap requirement); content occupies a sub-region and the
      // quad's UVs stop at that edge.
      function vrUploadCanvasTexture(texture, canvas) {
        vrGl.bindTexture(vrGl.TEXTURE_2D, texture);
        vrGl.pixelStorei(vrGl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        vrGl.texImage2D(vrGl.TEXTURE_2D, 0, vrGl.RGBA, vrGl.RGBA, vrGl.UNSIGNED_BYTE, canvas);
        const pot = (n) => (n & (n - 1)) === 0;
        if (pot(canvas.width) && pot(canvas.height)) {
          vrGl.texParameteri(vrGl.TEXTURE_2D, vrGl.TEXTURE_MIN_FILTER, vrGl.LINEAR_MIPMAP_LINEAR);
          vrGl.texParameteri(vrGl.TEXTURE_2D, vrGl.TEXTURE_MAG_FILTER, vrGl.LINEAR);
          vrGl.generateMipmap(vrGl.TEXTURE_2D);
          if (vrGlState?.anisoExt) {
            vrGl.texParameterf(vrGl.TEXTURE_2D, vrGlState.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, vrGlState.anisoMax || 1);
          }
        }
      }

      // Halve an RGBA buffer, averaging in LINEAR light (gamma 2 — square /
      // square-root, visually right and fast) with alpha-weighted colour so
      // transparent texels don't drag edges dark. This is the correctness
      // gl.generateMipmap lacks: it averages raw sRGB bytes, which skews
      // every level of a high-contrast tile darker and makes trilinear
      // transitions visible as moving bands.
      function vrHalveLinear(src, w, h) {
        const nw = Math.max(1, w >> 1);
        const nh = Math.max(1, h >> 1);
        const out = new Uint8ClampedArray(nw * nh * 4);
        for (let y = 0; y < nh; y += 1) {
          const sy0 = Math.min(h - 1, y * 2);
          const sy1 = Math.min(h - 1, y * 2 + 1);
          for (let x = 0; x < nw; x += 1) {
            const sx0 = Math.min(w - 1, x * 2);
            const sx1 = Math.min(w - 1, x * 2 + 1);
            let r = 0, g = 0, b = 0, a = 0;
            for (const [sx, sy] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]]) {
              const i = (sy * w + sx) * 4;
              const al = src[i + 3] / 255;
              r += (src[i] / 255) * (src[i] / 255) * al;
              g += (src[i + 1] / 255) * (src[i + 1] / 255) * al;
              b += (src[i + 2] / 255) * (src[i + 2] / 255) * al;
              a += al;
            }
            const o = (y * nw + x) * 4;
            if (a > 0) {
              out[o] = Math.sqrt(r / a) * 255;
              out[o + 1] = Math.sqrt(g / a) * 255;
              out[o + 2] = Math.sqrt(b / a) * 255;
            }
            out[o + 3] = (a / 4) * 255;
          }
        }
        return { data: out, w: nw, h: nh };
      }

      function vrHalveNormal(src, w, h) {
        const nw = Math.max(1, w >> 1);
        const nh = Math.max(1, h >> 1);
        const out = new Uint8ClampedArray(nw * nh * 4);
        for (let y = 0; y < nh; y += 1) {
          const sy0 = Math.min(h - 1, y * 2);
          const sy1 = Math.min(h - 1, y * 2 + 1);
          for (let x = 0; x < nw; x += 1) {
            const sx0 = Math.min(w - 1, x * 2);
            const sx1 = Math.min(w - 1, x * 2 + 1);
            let nx = 0, ny = 0, nz = 0, alpha = 0;
            for (const [sx, sy] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]]) {
              const i = (sy * w + sx) * 4;
              const weight = src[i + 3] / 255;
              nx += (src[i] / 127.5 - 1) * weight;
              ny += (src[i + 1] / 127.5 - 1) * weight;
              nz += (src[i + 2] / 127.5 - 1) * weight;
              alpha += weight;
            }
            const length = Math.hypot(nx, ny, nz);
            if (length > 1e-6) {
              nx /= length;
              ny /= length;
              nz /= length;
            } else {
              nx = 0;
              ny = 0;
              nz = 1;
            }
            const o = (y * nw + x) * 4;
            out[o] = (nx * 0.5 + 0.5) * 255;
            out[o + 1] = (ny * 0.5 + 0.5) * 255;
            out[o + 2] = (nz * 0.5 + 0.5) * 255;
            out[o + 3] = (alpha / 4) * 255;
          }
        }
        return { data: out, w: nw, h: nh };
      }

      // Upload a cell's full mip chain. Cells are 64-aligned, so x>>level and
      // y>>level stay exact through the level where the cell collapses; the
      // last few 1–2px levels of overlapping cells just hold average colours.
      function vrUploadCellMips(glState, atlas, texture, cell, halve) {
        const gl = vrGl;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        let image = atlas.ctx.getImageData(cell.x, cell.y, cell.w, cell.h);
        let level = 0;
        let x = cell.x, y = cell.y, w = cell.w, h = cell.h;
        let data = image.data;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        while ((w > 1 || h > 1) && level < glState.atlasLevels - 1) {
          const halved = halve(data, w, h);
          data = halved.data;
          w = halved.w;
          h = halved.h;
          level += 1;
          x = x >> 1;
          y = y >> 1;
          gl.texSubImage2D(gl.TEXTURE_2D, level, x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        }
      }

      function vrClearAtlasTexture(glState, texture) {
        const gl = vrGl;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        for (let level = 0; level < glState.atlasLevels; level += 1) {
          gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, Math.max(1, vrAtlas.width >> level), Math.max(1, vrAtlas.height >> level), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
      }

      function vrFlushAtlas(glState) {
        if (vrAtlasesNeedClear) {
          vrClearAtlasTexture(glState, glState.atlasTexture);
          vrClearAtlasTexture(glState, glState.normalAtlasTexture);
          vrAtlasesNeedClear = false;
        }
        if (vrAtlas.ctx) {
          for (const cell of vrAtlas.dirtyCells.splice(0)) vrUploadCellMips(glState, vrAtlas, glState.atlasTexture, cell, vrHalveLinear);
        } else {
          vrAtlas.dirtyCells.length = 0;
        }
        if (vrNormalAtlas.ctx) {
          for (const cell of vrNormalAtlas.dirtyCells.splice(0)) vrUploadCellMips(glState, vrNormalAtlas, glState.normalAtlasTexture, cell, vrHalveNormal);
        } else {
          vrNormalAtlas.dirtyCells.length = 0;
        }
      }

      function vrModelMatrix() {
        const s = vrTableTileMetres();
        const [x, y, z, w] = vrTable.q;
        // T(pos) · R(q) · S(s), column-major.
        return new Float32Array([
          (1 - 2 * (y * y + z * z)) * s, (2 * (x * y + z * w)) * s, (2 * (x * z - y * w)) * s, 0,
          (2 * (x * y - z * w)) * s, (1 - 2 * (x * x + z * z)) * s, (2 * (y * z + x * w)) * s, 0,
          (2 * (x * z + y * w)) * s, (2 * (y * z - x * w)) * s, (1 - 2 * (x * x + y * y)) * s, 0,
          vrTable.x, vrTable.y, vrTable.z, 1
        ]);
      }

      function vrTableTileMetres() {
        const floor = currentFloor();
        const maxDim = Math.max(floor.map.width, floor.map.height);
        return Math.min(VR.tableTile, VR.tableMax / Math.max(1, maxDim)) * vrTable.scale;
      }

      function vrHeadToModel(position) {
        const s = vrTableTileMetres();
        const v = vrQRotate(vrQConj(vrTable.q), [position.x - vrTable.x, position.y - vrTable.y, position.z - vrTable.z]);
        return { x: v[0] / s, y: v[1] / s, z: v[2] / s };
      }

      // Positional audio spatializer, installed into the sound system while a
      // session runs: a game tile → the doll's spot on the diorama in room
      // space → the headset's listener space (x right, y up, -z ahead). The
      // sound of a hit really comes from that corner of the table.
      function vrSpatializeTile(at, headOverride) {
        const pose = headOverride || vrLastHeadPose;
        if (!pose || !pose.position) return null;
        const floor = currentFloor();
        const s = vrTableTileMetres();
        const model = [
          (at.x + 0.5 - floor.map.width / 2) * s,
          0.5 * s,
          (at.y + 0.5 - floor.map.height / 2) * s
        ];
        const w = vrQRotate(vrTable.q, model);
        const o = pose.orientation || { x: 0, y: 0, z: 0, w: 1 };
        const rel = vrQRotate(vrQConj([o.x, o.y, o.z, o.w]), [
          vrTable.x + w[0] - pose.position.x,
          vrTable.y + w[1] - pose.position.y,
          vrTable.z + w[2] - pose.position.z
        ]);
        return { x: rel[0], y: rel[1], z: rel[2] };
      }

      // Ray vs the dungeon model itself, so the laser STOPS on what it hits
      // instead of passing through: a 2D grid march (DDA) over the floor
      // plan — visible wall/door blocks stop it on their faces (y ∈ [0,
      // wallHeight]), discovered open tiles stop it where it meets the
      // ground. Undiscovered cells are void and let it through, like the
      // renderer. Returns { kind: "wall"|"floor", x, y, t, walkable } with t
      // in world metres, or null.
      function vrRayDungeonHit(origin, dir) {
        const s = vrTableTileMetres();
        const qInv = vrQConj(vrTable.q);
        const oM = vrQRotate(qInv, [origin.x - vrTable.x, origin.y - vrTable.y, origin.z - vrTable.z]);
        const dM = vrQRotate(qInv, [dir.x, dir.y, dir.z]);
        const floor = currentFloor();
        const floorState = currentFloorState();
        const mapW = floor.map.width;
        const mapH = floor.map.height;
        // Tile-grid coordinates; the ray parameter t stays in world metres.
        const ox = oM[0] / s + mapW / 2;
        const oy = oM[1];
        const oz = oM[2] / s + mapH / 2;
        const dx = dM[0] / s;
        const dy = dM[1];
        const dz = dM[2] / s;
        const wallTop = VR.wallHeight * s;
        const T_MAX = 8;

        const clip = (o, d, lo, hi) => {
          if (Math.abs(d) < 1e-9) return o >= lo && o <= hi ? [0, T_MAX] : null;
          const a = (lo - o) / d;
          const b = (hi - o) / d;
          return a < b ? [a, b] : [b, a];
        };
        const clipX = clip(ox, dx, 0, mapW);
        const clipZ = clip(oz, dz, 0, mapH);
        if (!clipX || !clipZ) return null;
        let t = Math.max(0.02, clipX[0], clipZ[0]) + 1e-5;
        const tEnd = Math.min(T_MAX, clipX[1], clipZ[1]);
        if (tEnd <= t) return null;

        let x = Math.floor(ox + dx * t);
        let z = Math.floor(oz + dz * t);
        const stepX = dx > 0 ? 1 : -1;
        const stepZ = dz > 0 ? 1 : -1;
        const tDeltaX = Math.abs(dx) < 1e-9 ? Infinity : Math.abs(1 / dx);
        const tDeltaZ = Math.abs(dz) < 1e-9 ? Infinity : Math.abs(1 / dz);
        let tMaxX = Math.abs(dx) < 1e-9 ? Infinity : ((dx > 0 ? x + 1 : x) - ox) / dx;
        let tMaxZ = Math.abs(dz) < 1e-9 ? Infinity : ((dz > 0 ? z + 1 : z) - oz) / dz;

        for (let guard = 0; guard < mapW + mapH + 4; guard += 1) {
          const tExit = Math.min(tMaxX, tMaxZ, tEnd);
          if (mapContains(x, z)) {
            if (solidAt(x, z)) {
              if (vrWallVisible(floorState, x, z)) {
                // Wall block: the segment of [t, tExit] with height in range.
                let tA = t;
                let tB = tExit;
                if (Math.abs(dy) > 1e-9) {
                  const tFloorPlane = (0 - oy) / dy;
                  const tTopPlane = (wallTop - oy) / dy;
                  tA = Math.max(tA, Math.min(tFloorPlane, tTopPlane));
                  tB = Math.min(tB, Math.max(tFloorPlane, tTopPlane));
                } else if (oy < 0 || oy > wallTop) {
                  tA = 1; tB = 0;
                }
                if (tA <= tB) return { kind: "wall", x, y: z, t: tA, walkable: false };
              }
            } else if (floorState.discovered.has(keyOf(x, z)) && Math.abs(dy) > 1e-9) {
              const tFloor = (0 - oy) / dy;
              if (tFloor >= t && tFloor <= tExit) {
                return { kind: "floor", x, y: z, t: tFloor, walkable: mapKind(x, z) === "floor" };
              }
            }
          }
          if (tExit >= tEnd) return null;
          if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; }
          else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; }
        }
        return null;
      }

      // The walkable, discovered tile the laser lands on (point-to-move).
      function vrAimTileForRay(origin, dir) {
        const hit = vrRayDungeonHit(origin, dir);
        return hit && hit.kind === "floor" && hit.walkable ? { x: hit.x, y: hit.y, t: hit.t } : null;
      }

      function vrResetTable() {
        vrTable.x = 0;
        vrTable.y = vrTableBaseY;
        vrTable.z = -VR.tableDistance;
        vrTable.q = [0, 0, 0, 1];
        vrTable.scale = 1;
        for (const key of Object.keys(vrPanelOffsets)) vrPanelOffsets[key] = null;
        vrYawCache.clear();
        vrSavePaneLayout();
        // In AR, resetting the view also re-arms tap-to-place.
        if (vrSessionMode === "immersive-ar") vrArBeginPlacement();
      }

      // Pane layout persistence: dragged pane offsets survive across sessions;
      // Reset View wipes the saved layout along with the live one.
      function vrLoadPaneLayout() {
        const settings = typeof readSettings === "function" ? readSettings() : {};
        const saved = settings.vrPaneOffsets || {};
        for (const key of Object.keys(vrPanelOffsets)) {
          const offset = saved[key];
          if (offset && Number.isFinite(offset.x) && Number.isFinite(offset.y) && Number.isFinite(offset.z)) {
            vrPanelOffsets[key] = { x: offset.x, y: offset.y, z: offset.z };
          }
        }
      }

      function vrSavePaneLayout() {
        if (typeof readSettings !== "function" || typeof writeSettings !== "function") return;
        const settings = readSettings();
        const out = {};
        for (const key of Object.keys(vrPanelOffsets)) {
          if (vrPanelOffsets[key]) out[key] = { ...vrPanelOffsets[key] };
        }
        settings.vrPaneOffsets = out;
        writeSettings(settings);
      }

      // Square the diorama back up with the real floor, keeping its heading.
      // Only runs when asked (palette "Level" button or a full view reset).
      function vrTableLevel() {
        const forward = vrQRotate(vrTable.q, [0, 0, 1]);
        if (Math.hypot(forward[0], forward[2]) > 0.05) {
          vrTable.q = vrQFromAxisAngle([0, 1, 0], Math.atan2(forward[0], forward[2]));
          return;
        }
        // Pitched straight up/down: recover the heading from the right axis.
        const right = vrQRotate(vrTable.q, [1, 0, 0]);
        vrTable.q = vrQFromAxisAngle([0, 1, 0], Math.atan2(right[0], right[2]) - Math.PI / 2);
      }

      function vrTableState() {
        return vrTable; // live object, mutated by grabs/tests
      }

      // Arm AR placement: the reticle comes back and the next tap on real
      // geometry re-anchors the diorama. (Reset View re-arms it in AR.)
      function vrArBeginPlacement() {
        vrArPlaced = false;
        vrArReticle = null;
      }

      // Anchor the diorama on a real-world surface point: sit the table base
      // there, flat, keeping whatever heading the user last gave it.
      function vrArPlaceAt(point) {
        vrTable.x = point.x;
        vrTable.y = point.y;
        vrTable.z = point.z;
        vrTableLevel();
        vrArPlaced = true;
        vrArReticle = null;
      }

      function vrArPlacementState() {
        return { placed: vrArPlaced, reticle: vrArReticle ? { ...vrArReticle } : null };
      }

      // Two-handed pinch on the diorama: the anchor pair's spread change scales
      // the table, the pair's yaw change twists it, and the midpoint carries it.
      // One frame step: prev/cur are the two grab anchors last frame and now.
      function vrTwoHandStep(p1, p2, c1, c2) {
        const prevMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, z: (p1.z + p2.z) / 2 };
        const curMid = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2, z: (c1.z + c2.z) / 2 };
        const prevSpan = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        const curSpan = Math.hypot(c2.x - c1.x, c2.y - c1.y, c2.z - c1.z);
        let ratio = prevSpan > 0.03 ? curSpan / prevSpan : 1;
        ratio = Math.max(0.6, Math.min(1.6, ratio)); // per-frame sanity
        const newScale = Math.max(VR.scaleMin, Math.min(VR.scaleMax, vrTable.scale * ratio));
        const applied = vrTable.scale > 0 ? newScale / vrTable.scale : 1;
        vrTable.scale = newScale;
        const prevYaw = Math.atan2(p2.x - p1.x, p2.z - p1.z);
        const curYaw = Math.atan2(c2.x - c1.x, c2.z - c1.z);
        let dYaw = curYaw - prevYaw;
        dYaw = ((dYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        const dq = vrQFromAxisAngle([0, 1, 0], dYaw);
        const rel = [(vrTable.x - prevMid.x) * applied, (vrTable.y - prevMid.y) * applied, (vrTable.z - prevMid.z) * applied];
        const turned = vrQRotate(dq, rel);
        vrTable.x = curMid.x + turned[0];
        vrTable.y = curMid.y + turned[1];
        vrTable.z = curMid.z + turned[2];
        vrTable.q = vrQNormalize(vrQMul(dq, vrTable.q));
      }

      // A vertical quad at `center` that yaws to face the head. Shared by the
      // stats panel and the actions palette so their hit-tests, grabbing, and
      // rendering all agree on the same plane. steadyKey engages the yaw
      // deadband so the pane doesn't micro-rotate (and re-alias its text) on
      // every twitch of the head.
      function vrBillboardFrame(center, width, height, head, steadyKey) {
        let yaw = head ? Math.atan2(head.x - center.x, head.z - center.z) : 0;
        if (steadyKey) yaw = vrSteadyYaw(steadyKey, yaw);
        const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
        const up = { x: 0, y: 1, z: 0 };
        const normal = { x: up.y * right.z - up.z * right.y, y: up.z * right.x - up.x * right.z, z: up.x * right.y - up.y * right.x };
        return { center, right, up, normal, width, height };
      }

      function vrEmitFrameQuad(frame, extent) {
        const hw = frame.width / 2;
        const hh = frame.height / 2;
        const c = frame.center;
        const r = frame.right;
        const verts = [];
        const uv = { u0: 0, v0: 0, u1: extent ? extent.u : 1, v1: extent ? extent.v : 1 };
        vrPushQuad(verts, [
          [c.x - r.x * hw, c.y + hh, c.z - r.z * hw],
          [c.x + r.x * hw, c.y + hh, c.z + r.z * hw],
          [c.x + r.x * hw, c.y - hh, c.z + r.z * hw],
          [c.x - r.x * hw, c.y - hh, c.z - r.z * hw]
        ], uv, 1, 1, 1, 1);
        return verts;
      }

      // Fraction of a pane's power-of-two canvas its content actually covers
      // (content pixels are logical size × the 2× rasterization density).
      function vrPaneExtent(pane) {
        if (!pane.canvas) return { u: 1, v: 1 };
        return { u: (pane.width * VR_PANE_DPR) / pane.canvas.width, v: (pane.height * VR_PANE_DPR) / pane.canvas.height };
      }

      // ---------------------------------------------------------------------
      // Floating panes. Every pane is a billboarded quad with an automatic
      // spot relative to the diorama, an optional user-dragged offset, and
      // (for the clickable ones) a button grid the pointer ray resolves into.

      function vrControlButtons() {
        return VR_CONTROL_BUTTONS;
      }

      function vrInventoryRows() {
        return Math.max(1, Math.ceil(state.inventory.length / 4));
      }

      // Inventory pane bands in logical canvas px; the pane's WORLD height
      // derives from the same numbers, so the drawn bands and the ray-hit
      // grid can never disagree (they used to, and clicks landed a half-row
      // off). The footer is the hovered item's detail strip.
      const VR_INV_PX = { width: 512, header: 64, cell: 112, footer: 96 };
      const VR_INV_M_PER_PX = 0.115 / VR_INV_PX.cell;

      function vrInventoryPaneHeightPx() {
        return VR_INV_PX.header + vrInventoryRows() * VR_INV_PX.cell + VR_INV_PX.footer;
      }

      const VR_PANE_DEFS = {
        palette: {
          auto: () => ({ x: VR_PANEL.offsetX, y: VR_PANEL.offsetY, z: VR_PANEL.offsetZ }),
          size: () => ({ width: VR_PANEL.width, height: VR_PANEL.height }),
          grid: () => ({ cols: VR_CONTROL_COLS, rows: Math.ceil(VR_CONTROL_BUTTONS.length / VR_CONTROL_COLS) })
        },
        hud: {
          auto: () => ({ x: 0, y: VR.wallHeight * vrTableTileMetres() + 0.34, z: 0 }),
          size: () => ({ width: 0.72, height: 0.36 }),
          grid: () => null
        },
        party: {
          auto: () => ({ x: 0.68, y: 0.44, z: 0.1 }),
          size: () => ({ width: 0.88, height: 0.44 }),
          grid: () => ({ cols: Math.max(1, state.party.length), rows: 1 })
        },
        inventory: {
          // Hangs from a fixed top edge below the party pane, growing
          // downward as the pack grows — never overlapping, never a
          // scrollbar (the grid just gets taller).
          auto: () => ({ x: 0.68, y: 0.16 - (vrInventoryPaneHeightPx() * VR_INV_M_PER_PX) / 2, z: 0.1 }),
          size: () => ({ width: 0.6, height: vrInventoryPaneHeightPx() * VR_INV_M_PER_PX }),
          grid: () => ({
            cols: 4,
            rows: vrInventoryRows(),
            v0: VR_INV_PX.header / vrInventoryPaneHeightPx(),
            v1: (VR_INV_PX.header + vrInventoryRows() * VR_INV_PX.cell) / vrInventoryPaneHeightPx()
          })
        }
      };
      const VR_PANE_KEYS = Object.keys(VR_PANE_DEFS);

      function vrPaneFrame(key, head) {
        const def = VR_PANE_DEFS[key];
        const offset = vrPanelOffsets[key] || def.auto();
        const center = { x: vrTable.x + offset.x, y: vrTable.y + offset.y, z: vrTable.z + offset.z };
        const { width, height } = def.size();
        const frame = vrBillboardFrame(center, width, height, head, `pane:${key}`);
        const grid = def.grid();
        if (grid) {
          frame.cols = grid.cols;
          frame.rows = grid.rows;
          if (grid.v0 !== undefined) {
            frame.gridV0 = grid.v0;
            frame.gridV1 = grid.v1;
          }
        }
        frame.pane = key;
        return frame;
      }

      function vrHudFrame(head) {
        return vrPaneFrame("hud", head);
      }

      function vrControlPanelFrame(head) {
        return vrPaneFrame("palette", head);
      }

      function vrEmitHud(headPosition) {
        return vrEmitFrameQuad(vrHudFrame(headPosition), vrPaneExtent(vrHud));
      }

      // What a grip at this pointer ray takes hold of: an inventory ITEM when
      // the ray rests on its cell (drag it out to equip or throw), whichever
      // pane the ray meets first otherwise, or the diorama itself. The
      // inventory pane's header/footer still grab the pane for moving it.
      function vrGrabTargetForRay(origin, dir, head) {
        let best = null;
        for (const key of VR_PANE_KEYS) {
          const hit = vrRayPanelHit(origin, dir, vrPaneFrame(key, head));
          if (!hit || hit.u < 0 || hit.u > 1 || hit.v < 0 || hit.v > 1) continue;
          if (!best || hit.t < best.t) best = { key, t: hit.t, index: hit.index };
        }
        if (best && best.key === "inventory" && best.index >= 0) {
          const item = state.inventory[best.index];
          if (item) return { kind: "item", id: item.id, tile: item.tile };
        }
        return best ? best.key : "table";
      }

      // Freeze the pane's current automatic offset so a drag starts from
      // where the pane is, then accumulates deltas.
      function vrDragOffset(target, head) {
        if (!vrPanelOffsets[target]) {
          const c = vrPaneFrame(target, head).center;
          vrPanelOffsets[target] = { x: c.x - vrTable.x, y: c.y - vrTable.y, z: c.z - vrTable.z };
        }
        return vrPanelOffsets[target];
      }

      // Ray (origin, dir in the panel's space) vs the panel plane. Returns
      // { u, v, index, point } — index is the button under the hit, or -1 if the
      // ray crosses the plane outside the grid; null if it never meets it.
      function vrRayPanelHit(origin, dir, panel) {
        const n = panel.normal;
        const denom = dir.x * n.x + dir.y * n.y + dir.z * n.z;
        if (Math.abs(denom) < 1e-6) return null;
        const t = ((panel.center.x - origin.x) * n.x + (panel.center.y - origin.y) * n.y + (panel.center.z - origin.z) * n.z) / denom;
        if (t <= 0) return null;
        const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
        const dx = point.x - panel.center.x, dy = point.y - panel.center.y, dz = point.z - panel.center.z;
        const du = dx * panel.right.x + dy * panel.right.y + dz * panel.right.z;
        const dv = dx * panel.up.x + dy * panel.up.y + dz * panel.up.z;
        const u = du / panel.width + 0.5;
        const v = 0.5 - dv / panel.height;
        if (u < 0 || u > 1 || v < 0 || v > 1) return { u, v, index: -1, point, t };
        // Panes with header/footer bands confine the button grid to
        // [gridV0, gridV1); hits outside it are on the pane but not a button.
        let gridV = v;
        if (panel.gridV0 !== undefined) {
          gridV = (v - panel.gridV0) / Math.max(1e-6, (panel.gridV1 ?? 1) - panel.gridV0);
          if (gridV < 0 || gridV >= 1) return { u, v, index: -1, point, t };
        }
        const col = Math.min((panel.cols || 1) - 1, Math.floor(u * (panel.cols || 1)));
        const row = Math.min((panel.rows || 1) - 1, Math.floor(gridV * (panel.rows || 1)));
        return { u, v, index: row * (panel.cols || 1) + col, point, t };
      }

      function vrActivateButton(index) {
        const btn = VR_CONTROL_BUTTONS[index];
        if (!btn) return;
        if (btn.action === "vr:dolls") {
          vrToggleDollMode();
          vrLastHudSignature = null;
        } else if (btn.action === "vr:art") {
          vrToggleArtStyle();
        } else if (btn.action === "vr:level") {
          vrTableLevel();
        } else if (btn.action === "vr:reset") {
          vrResetTable();
        } else if (btn.action === "vr:exit") {
          exitVr();
        } else {
          handleAction(btn.action);
        }
      }

      // The panel face: one canvas texture, redrawn only when the hovered
      // button changes (like the HUD). Rows top→bottom, columns left→right,
      // matching vrRayPanelHit's index math exactly.
      const vrPanel = { canvas: null, ctx: null, width: 512, height: 512 };

      function vrPanelInit() {
        return vrCanvasInit(vrPanel, 512, 512);
      }

      function vrDrawControlPanel(hoverIndex) {
        if (!vrPanelInit()) return false;
        const ctx = vrPanel.ctx;
        const cols = VR_CONTROL_COLS;
        const rows = Math.ceil(VR_CONTROL_BUTTONS.length / cols);
        const cw = vrPanel.width / cols;
        const ch = vrPanel.height / rows;
        ctx.clearRect(0, 0, vrPanel.width, vrPanel.height);
        ctx.fillStyle = "rgba(14, 12, 10, 0.92)";
        ctx.fillRect(0, 0, vrPanel.width, vrPanel.height);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = 0; i < VR_CONTROL_BUTTONS.length; i += 1) {
          const x = (i % cols) * cw;
          const y = Math.floor(i / cols) * ch;
          const hovered = i === hoverIndex;
          ctx.fillStyle = hovered ? "rgba(238, 193, 101, 0.92)" : "rgba(38, 33, 26, 0.92)";
          ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
          ctx.strokeStyle = "rgba(238, 193, 101, 0.5)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
          ctx.fillStyle = hovered ? "#141210" : "#f1d07a";
          ctx.font = "bold 20px system-ui, sans-serif";
          ctx.fillText(VR_CONTROL_BUTTONS[i].label, x + cw / 2, y + ch / 2);
        }
        return true;
      }

      function vrEmitControlPanel(head) {
        return vrEmitFrameQuad(vrControlPanelFrame(head), vrPaneExtent(vrPanel));
      }

      // ---------------------------------------------------------------------
      // Party pane: one card per member — portrait (class glyph), stats, and
      // current gear. Clicking a card picks that member as the equip target.
      // Inventory pane: the pack as a grid; clicking a wearable equips it on
      // the chosen member, clicking anything else uses it — both through the
      // game's own item flow, one turn and all.

      function vrPartyPaneModel() {
        const classes = typeof CLASSES === "object" && CLASSES ? CLASSES : {};
        return {
          selected: vrSelectedMemberIndex,
          members: state.party.map((member) => ({
            name: member.name,
            glyph: classes[member.classKey]?.glyph || "@",
            portrait: typeof memberPortrait === "function" ? memberPortrait(member) : null,
            className: classes[member.classKey]?.name || member.classKey || "adventurer",
            hp: Math.max(0, member.hp),
            maxHp: member.maxHp,
            power: member.power,
            defense: member.defense,
            weapon: member.weapon ? member.weapon.shortName || member.weapon.name : "—",
            armour: member.armour ? member.armour.shortName || member.armour.name : "—"
          }))
        };
      }

      function vrInventoryPaneModel() {
        return {
          selected: vrSelectedMemberIndex,
          targetName: state.party[vrSelectedMemberIndex]?.name || state.party[0]?.name || "",
          items: state.inventory.map((item) => ({
            id: item.id,
            label: item.shortName || item.name,
            tile: item.tile,
            equippable: typeof equipKindSpec === "function" && !!equipKindSpec(item.kind)
          }))
        };
      }

      function vrPartyClick(index) {
        if (index >= 0 && index < state.party.length) vrSelectedMemberIndex = index;
      }

      function vrInventoryClick(index) {
        const item = state.inventory[index];
        if (!item) return;
        if (typeof equipKindSpec === "function" && equipKindSpec(item.kind) && typeof equipItemToMember === "function") {
          equipItemToMember(vrSelectedMemberIndex, item.id);
          return;
        }
        useItem(item.id);
      }

      const vrPartyPane = { canvas: null, ctx: null, width: 1024, height: 512 };
      const vrInvPane = { canvas: null, ctx: null, width: 512, height: 0 };

      // Pane canvases are allocated at power-of-two sizes so they can carry
      // mipmaps (WebGL1 requires POT for generateMipmap); pane.width/height
      // stay the CONTENT size, and vrPaneExtent maps the quad's UVs onto it.
      // Pane canvases rasterize at 2× density: text drawn at 1× and linearly
      // magnified in the headset reads blurry, while supersampled glyphs stay
      // crisp through the trilinear chain. Draw code works in logical pixels
      // (pane.width/height); the transform maps them onto the doubled canvas.
      const VR_PANE_DPR = 2;

      function vrCanvasInit(pane, width, height) {
        if (!pane.canvas) {
          pane.canvas = document.createElement("canvas");
          pane.ctx = pane.canvas.getContext ? pane.canvas.getContext("2d") : null;
        }
        let allocW = 1;
        while (allocW < width * VR_PANE_DPR) allocW *= 2;
        let allocH = 1;
        while (allocH < height * VR_PANE_DPR) allocH *= 2;
        if (pane.canvas.width !== allocW || pane.canvas.height !== allocH) {
          pane.canvas.width = allocW;
          pane.canvas.height = allocH;
        }
        pane.width = width;
        pane.height = height;
        if (pane.ctx) {
          pane.ctx.setTransform(1, 0, 0, 1, 0, 0);
          pane.ctx.clearRect(0, 0, allocW, allocH);
          pane.ctx.setTransform(VR_PANE_DPR, 0, 0, VR_PANE_DPR, 0, 0);
        }
        return pane.ctx !== null;
      }

      function vrDrawPartyPane(hoverIndex) {
        const model = vrPartyPaneModel();
        if (!vrCanvasInit(vrPartyPane, 256 * Math.max(1, model.members.length), 512)) return false;
        const ctx = vrPartyPane.ctx;
        const cw = vrPartyPane.width / Math.max(1, model.members.length);
        ctx.fillStyle = "rgba(14, 12, 10, 0.92)";
        ctx.fillRect(0, 0, vrPartyPane.width, vrPartyPane.height);
        model.members.forEach((member, index) => {
          const x = index * cw;
          const selected = index === model.selected;
          const hovered = index === hoverIndex;
          ctx.fillStyle = hovered ? "rgba(58, 50, 38, 0.95)" : "rgba(30, 26, 20, 0.95)";
          ctx.fillRect(x + 5, 5, cw - 10, vrPartyPane.height - 10);
          ctx.strokeStyle = selected ? "#f1d07a" : "rgba(238, 193, 101, 0.35)";
          ctx.lineWidth = selected ? 6 : 2;
          ctx.strokeRect(x + 5, 5, cw - 10, vrPartyPane.height - 10);
          ctx.textAlign = "center";
          // Portrait plate: real class art once loaded, glyph until then.
          ctx.fillStyle = "rgba(48, 40, 28, 0.9)";
          ctx.fillRect(x + cw / 2 - 70, 26, 140, 140);
          ctx.strokeStyle = "rgba(238, 193, 101, 0.45)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + cw / 2 - 70, 26, 140, 140);
          const portraitEntry = member.portrait ? imageEntry(member.portrait) : null;
          if (portraitEntry && portraitEntry.ready) {
            ctx.imageSmoothingEnabled = false;
            if (member.hp <= 0) ctx.filter = "grayscale(1) brightness(0.6)";
            ctx.drawImage(portraitEntry.image, x + cw / 2 - 62, 34, 124, 124);
            ctx.filter = "none";
          } else {
            ctx.font = "bold 96px \"Courier New\", monospace";
            ctx.textBaseline = "middle";
            ctx.fillStyle = member.hp > 0 ? "#f1d07a" : "#6b6154";
            ctx.fillText(member.glyph, x + cw / 2, 102);
          }
          ctx.textBaseline = "top";
          ctx.font = "bold 30px system-ui, sans-serif";
          ctx.fillStyle = member.hp > 0 ? "#f3e4c5" : "#8a7f6c";
          ctx.fillText(member.name, x + cw / 2, 178);
          ctx.font = "22px system-ui, sans-serif";
          ctx.fillStyle = "#b3a37c";
          ctx.fillText(member.className, x + cw / 2, 214);
          // HP bar + numbers.
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.fillRect(x + 22, 250, cw - 44, 24);
          ctx.fillStyle = member.hp > 0 ? "#d86452" : "#463c34";
          ctx.fillRect(x + 24, 252, (cw - 48) * Math.max(0, Math.min(1, member.hp / member.maxHp)), 20);
          ctx.fillStyle = "#f5efe2";
          ctx.font = "22px system-ui, sans-serif";
          ctx.fillText(`${member.hp}/${member.maxHp}`, x + cw / 2, 282);
          ctx.fillText(`PWR ${member.power} · DEF ${member.defense}`, x + cw / 2, 316);
          ctx.font = "20px system-ui, sans-serif";
          ctx.fillStyle = "#cbb995";
          ctx.fillText(`⚔ ${member.weapon}`, x + cw / 2, 356);
          ctx.fillText(`🛡 ${member.armour}`, x + cw / 2, 388);
          ctx.fillStyle = selected ? "#f1d07a" : "#7d7259";
          ctx.font = "18px system-ui, sans-serif";
          ctx.fillText(selected ? "equip target" : "click to target", x + cw / 2, 452);
        });
        return true;
      }

      function vrDrawInventoryPane(hoverIndex) {
        const model = vrInventoryPaneModel();
        const rows = vrInventoryRows();
        const header = VR_INV_PX.header;
        const cell = VR_INV_PX.cell;
        const footerTop = header + rows * cell;
        if (!vrCanvasInit(vrInvPane, VR_INV_PX.width, vrInventoryPaneHeightPx())) return false;
        const ctx = vrInvPane.ctx;
        ctx.fillStyle = "rgba(14, 12, 10, 0.92)";
        ctx.fillRect(0, 0, vrInvPane.width, vrInvPane.height);
        ctx.strokeStyle = "rgba(238, 193, 101, 0.4)";
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, vrInvPane.width - 2, vrInvPane.height - 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f1d07a";
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.fillText(`Pack ${model.items.length}`, 18, header / 2);
        ctx.font = "18px system-ui, sans-serif";
        ctx.fillStyle = "#b3a37c";
        const load = typeof carriedWeight === "function" && typeof carryCapacity === "function" ? `${carriedWeight()}/${carryCapacity()}wt · ` : "";
        ctx.fillText(`${load}${state.gold}g`, 150, header / 2);
        ctx.textAlign = "right";
        ctx.font = "22px system-ui, sans-serif";
        ctx.fillStyle = "#b7d2df";
        ctx.fillText(`equip → ${model.targetName}`, vrInvPane.width - 18, header / 2);
        const cw = vrInvPane.width / 4;
        model.items.forEach((item, index) => {
          const x = (index % 4) * cw;
          const y = header + Math.floor(index / 4) * cell;
          const hovered = index === hoverIndex;
          ctx.fillStyle = hovered ? "rgba(238, 193, 101, 0.85)" : "rgba(34, 29, 22, 0.95)";
          ctx.fillRect(x + 4, y + 4, cw - 8, cell - 8);
          ctx.strokeStyle = item.equippable ? "rgba(122, 194, 210, 0.7)" : "rgba(238, 193, 101, 0.3)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 4, y + 4, cw - 8, cell - 8);
          const entry = imageEntry(item.tile);
          if (entry.ready) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(entry.image, x + cw / 2 - 28, y + 10, 56, 56);
          }
          ctx.textAlign = "center";
          ctx.font = "18px system-ui, sans-serif";
          ctx.fillStyle = hovered ? "#141210" : "#e8ddc8";
          const label = item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label;
          ctx.fillText(label, x + cw / 2, y + cell - 22);
        });
        if (model.items.length === 0) {
          ctx.textAlign = "center";
          ctx.fillStyle = "#8a7f6c";
          ctx.font = "24px system-ui, sans-serif";
          ctx.fillText("The pack is empty.", vrInvPane.width / 2, header + cell / 2);
        }
        // Detail strip: what the pointed-at item does, instantly.
        ctx.strokeStyle = "rgba(238, 193, 101, 0.3)";
        ctx.beginPath();
        ctx.moveTo(8, footerTop + 1);
        ctx.lineTo(vrInvPane.width - 8, footerTop + 1);
        ctx.stroke();
        const info = typeof itemInfo === "function" && hoverIndex >= 0 ? itemInfo(state.inventory[hoverIndex]) : null;
        ctx.textAlign = "left";
        if (info) {
          const flags = [info.cursed ? "cursed" : "", info.blessed ? "blessed" : "", info.slot ? `equips: ${info.slot}` : ""].filter(Boolean).join(" · ");
          ctx.fillStyle = "#f1d07a";
          ctx.font = "bold 20px system-ui, sans-serif";
          ctx.fillText(`${info.name}${flags ? `  —  ${flags}` : ""}`.slice(0, 52), 16, footerTop + 22);
          ctx.fillStyle = "#e8ddc8";
          ctx.font = "18px system-ui, sans-serif";
          ctx.fillText(info.effect.slice(0, 58), 16, footerTop + 48);
          ctx.fillStyle = "#b3a37c";
          ctx.font = "16px system-ui, sans-serif";
          ctx.fillText(info.stats.join(" · ").slice(0, 60), 16, footerTop + 74);
        } else {
          ctx.fillStyle = "#8a7f6c";
          ctx.font = "17px system-ui, sans-serif";
          ctx.fillText("Point at an item: details here. Trigger uses it;", 16, footerTop + 36);
          ctx.fillText("equippables go to the highlighted party member.", 16, footerTop + 62);
        }
        return true;
      }

      // Icons appear as their images load, and gear moves between pack and
      // member cards — both signatures track that so the canvases repaint.
      function vrInventoryPaneSignature(hoverIndex) {
        const model = vrInventoryPaneModel();
        const ready = model.items.filter((item) => imageEntry(item.tile).ready).length;
        return JSON.stringify([model.selected, model.targetName, hoverIndex, ready, model.items.map((item) => item.id)]);
      }

      function vrPartyPaneSignature(hoverIndex) {
        const model = vrPartyPaneModel();
        const portraitsReady = model.members.filter((member) => member.portrait && imageEntry(member.portrait).ready).length;
        return JSON.stringify([hoverIndex, portraitsReady, model]);
      }

      // Hands and lasers, drawn EVERY frame for every tracked controller: a
      // diamond marker at the hand and its ray out to whatever it touches.
      // Laser quads turn their flat side toward the head so they read as a
      // line from any angle; hovering a button brightens and thickens the ray.
      function vrEmitPointers(head) {
        const verts = [];
        const white = vrWhiteUv();
        for (const seg of vrPointerSegs) {
          const dx = seg.px - seg.ox, dy = seg.py - seg.oy, dz = seg.pz - seg.oz;
          const hx = head.x - seg.ox, hy = head.y - seg.oy, hz = head.z - seg.oz;
          let px = dy * hz - dz * hy, py = dz * hx - dx * hz, pz = dx * hy - dy * hx;
          const plen = Math.hypot(px, py, pz) || 1;
          const halfW = seg.bright ? 0.006 : 0.0035;
          px = px / plen * halfW; py = py / plen * halfW; pz = pz / plen * halfW;
          vrPushQuad(verts, [
            [seg.ox + px, seg.oy + py, seg.oz + pz],
            [seg.px + px, seg.py + py, seg.pz + pz],
            [seg.px - px, seg.py - py, seg.pz - pz],
            [seg.ox - px, seg.oy - py, seg.oz - pz]
          ], white, 0.95, 0.82, 0.48, seg.bright ? 0.95 : 0.6);
          // Tip dot where the laser lands.
          const tip = vrBillboardFrame({ x: seg.px, y: seg.py, z: seg.pz }, 0.016, 0.016, head);
          verts.push(...vrEmitFrameQuadUv(tip, vrGlyphUv("●", "#ffe9b0"), seg.bright ? 1 : 0.75));
        }
        for (const marker of vrHandMarkers) {
          const frame = vrBillboardFrame(marker, 0.05, 0.05, head);
          verts.push(...vrEmitFrameQuadUv(frame, vrGlyphUv("◆", "#f1d07a"), 0.95));
        }
        for (const ghost of vrDragGhosts) {
          const frame = vrBillboardFrame(ghost, 0.09, 0.09, head);
          verts.push(...vrEmitFrameQuadUv(frame, vrTileUv(ghost.tile), 0.95));
        }
        // AR placement reticle: a diamond lying flat on the real surface the
        // camera is looking at, plus a floating hint above it.
        if (vrArReticle) {
          const c = vrArReticle;
          const r = 0.11;
          vrPushQuad(verts, [
            [c.x - r, c.y + 0.006, c.z - r],
            [c.x + r, c.y + 0.006, c.z - r],
            [c.x + r, c.y + 0.006, c.z + r],
            [c.x - r, c.y + 0.006, c.z + r]
          ], vrGlyphUv("◆", "#7fd08a"), 1, 1, 1, 0.9);
          const hint = vrBillboardFrame({ x: c.x, y: c.y + 0.22, z: c.z }, 0.05, 0.05, head);
          verts.push(...vrEmitFrameQuadUv(hint, vrGlyphUv("▼", "#7fd08a"), 0.85));
        }
        return verts;
      }

      function vrEmitFrameQuadUv(frame, uv, alpha) {
        const hw = frame.width / 2;
        const hh = frame.height / 2;
        const c = frame.center;
        const r = frame.right;
        const verts = [];
        vrPushQuad(verts, [
          [c.x - r.x * hw, c.y + hh, c.z - r.z * hw],
          [c.x + r.x * hw, c.y + hh, c.z + r.z * hw],
          [c.x + r.x * hw, c.y - hh, c.z + r.z * hw],
          [c.x - r.x * hw, c.y - hh, c.z - r.z * hw]
        ], uv, 1, 1, 1, alpha);
        return verts;
      }

      function vrDrawBuffer(gl, glState, buffer, count, model, texture, cutoff, depthWrite) {
        if (count === 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        const stride = VR_VERTEX_FLOATS * 4;
        gl.enableVertexAttribArray(glState.aPos);
        gl.vertexAttribPointer(glState.aPos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(glState.aUv);
        gl.vertexAttribPointer(glState.aUv, 2, gl.FLOAT, false, stride, 3 * 4);
        gl.enableVertexAttribArray(glState.aColor);
        gl.vertexAttribPointer(glState.aColor, 4, gl.FLOAT, false, stride, 5 * 4);
        gl.enableVertexAttribArray(glState.aTangent);
        gl.vertexAttribPointer(glState.aTangent, 3, gl.FLOAT, false, stride, 9 * 4);
        gl.enableVertexAttribArray(glState.aBitangent);
        gl.vertexAttribPointer(glState.aBitangent, 3, gl.FLOAT, false, stride, 12 * 4);
        gl.enableVertexAttribArray(glState.aHasNormal);
        gl.vertexAttribPointer(glState.aHasNormal, 1, gl.FLOAT, false, stride, 15 * 4);
        gl.uniformMatrix4fv(glState.uModel, false, model);
        gl.uniform1f(glState.uCutoff, cutoff);
        gl.depthMask(depthWrite);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }

      // ---------------------------------------------------------------------
      // Session lifecycle + frame loop.

      function vrButtonElement() {
        return document.getElementById("vrButton");
      }

      function arButtonElement() {
        return document.getElementById("arButton");
      }

      function vrModeSupported(mode) {
        if (typeof navigator === "undefined" || !navigator.xr || typeof navigator.xr.isSessionSupported !== "function") {
          return Promise.resolve(false);
        }
        return navigator.xr.isSessionSupported(mode).catch(() => false);
      }

      function vrSupported() {
        return vrModeSupported("immersive-vr");
      }

      function arSupported() {
        return vrModeSupported("immersive-ar");
      }

      function vrSetSessionButtonsHidden(hidden) {
        for (const [button, supported] of [[vrButtonElement(), vrVrOk], [arButtonElement(), vrArOk]]) {
          if (!button?.classList) continue;
          if (hidden) button.classList.add("hidden");
          else if (supported) button.classList.remove("hidden");
        }
      }

      function bindVr() {
        const wire = (button, enter, label) => {
          if (!button || typeof button.addEventListener !== "function") return;
          button.addEventListener("click", () => {
            enter().catch((error) => {
              if (typeof showToast === "function") showToast(`${label} failed: ${error?.message || error}`);
            });
          });
        };
        wire(vrButtonElement(), enterVr, "VR");
        wire(arButtonElement(), enterAr, "AR");
        vrSupported().then((ok) => {
          vrVrOk = ok;
          if (ok && vrButtonElement()?.classList) vrButtonElement().classList.remove("hidden");
        });
        arSupported().then((ok) => {
          vrArOk = ok;
          if (ok && arButtonElement()?.classList) arButtonElement().classList.remove("hidden");
        });
      }

      // A screen tap in handheld AR: route its ray exactly like the laser —
      // pane buttons click, a walkable lit tile is a travel order. Returns
      // the op it resolves to (or null), so it can be tested headlessly.
      function vrHandleTapRay(origin, dir, head) {
        let best = null;
        for (const key of VR_PANE_KEYS) {
          const hit = vrRayPanelHit(origin, dir, vrPaneFrame(key, head));
          if (!hit || hit.u < 0 || hit.u > 1 || hit.v < 0 || hit.v > 1) continue;
          if (!best || hit.t < best.t) best = { key, hit, t: hit.t };
        }
        const dungeon = vrRayDungeonHit(origin, dir);
        if (best && (!dungeon || best.t <= dungeon.t)) {
          if (best.key === "hud" || best.hit.index < 0) return null;
          if (best.key === "party") return { kind: "party", index: best.hit.index };
          return { kind: "click", pane: best.key, index: best.hit.index };
        }
        if (dungeon && dungeon.kind === "floor" && dungeon.walkable) return { kind: "travelTo", x: dungeon.x, y: dungeon.y };
        return null;
      }

      function vrOnSelect(event) {
        if (!vrSession || !event.frame || !event.inputSource?.targetRaySpace) return;
        // Tap-to-place: while the AR diorama is unplaced, a tap that lands on
        // real-world geometry anchors the table there instead of playing the
        // game. A tap that misses (or a device without hit-test) falls
        // through, so the game is never locked behind tracking.
        if (!vrArPlaced && vrArTransientHitSource && typeof event.frame.getHitTestResultsForTransientInput === "function") {
          for (const entry of event.frame.getHitTestResultsForTransientInput(vrArTransientHitSource) || []) {
            if (entry.inputSource && entry.inputSource !== event.inputSource) continue;
            const hit = (entry.results || [])[0];
            const hitPose = hit && hit.getPose(vrRefSpace);
            if (hitPose) {
              vrArPlaceAt(hitPose.transform.position);
              return;
            }
          }
        }
        const pose = event.frame.getPose(event.inputSource.targetRaySpace, vrRefSpace);
        if (!pose) return;
        const m = pose.transform.matrix;
        const viewerPose = event.frame.getViewerPose ? event.frame.getViewerPose(vrRefSpace) : null;
        const head = viewerPose ? viewerPose.transform.position : { x: 0, y: 1.5, z: 0 };
        const op = vrHandleTapRay({ x: m[12], y: m[13], z: m[14] }, { x: -m[8], y: -m[9], z: -m[10] }, head);
        if (!op) return;
        if (op.kind === "party") {
          vrPartyClick(op.index);
          return;
        }
        vrPendingOps.push(op);
        vrScheduleOps();
      }

      function enterVr() {
        return enterXr("immersive-vr");
      }

      function enterAr() {
        return enterXr("immersive-ar");
      }

      async function enterXr(sessionMode) {
        if (vrSession) return vrSession;
        if (vrEnterPending) return null;
        if (typeof navigator === "undefined" || !navigator.xr) throw new Error("WebXR unavailable");
        vrEnterPending = true;
        try {
          const glState = vrInitGl();
          const wantedFeatures = sessionMode === "immersive-ar"
            ? ["local-floor", "hit-test", "hand-tracking"]
            : ["local-floor", "hand-tracking"];
          const session = await navigator.xr.requestSession(sessionMode, { optionalFeatures: wantedFeatures });
          vrSession = session;
          vrSessionMode = sessionMode;
          try {
            // The context is created xrCompatible; this is belt-and-braces for
            // browsers that still want the explicit call, so a refusal (e.g. no
            // XR device behind a faked session) is not fatal — XRWebGLLayer
            // itself rejects genuinely incompatible contexts.
            try {
              if (vrGl.makeXRCompatible) await vrGl.makeXRCompatible();
            } catch (error) {}
            // Edge quality: explicit MSAA, panel-native render resolution
            // (browsers default to a softer, smaller framebuffer — silhouette
            // edges shimmer at anything below native), and fixed foveated
            // rendering OFF — the Quest's adaptive foveation visibly distorts
            // the periphery, and this scene is far too cheap to need it.
            // ignoreDepthValues: the compositor otherwise reprojects pixels
            // by their depth, and the UI panes/laser draw with depth-test off
            // — their pixels carry the DUNGEON's depth, so the compositor
            // "corrected" them as if they were metres away: the panes warped
            // and their text swam with every head movement.
            const layerOptions = { antialias: true, ignoreDepthValues: true };
            if (typeof window.XRWebGLLayer.getNativeFramebufferScaleFactor === "function") {
              const native = window.XRWebGLLayer.getNativeFramebufferScaleFactor(session);
              if (native > 0) layerOptions.framebufferScaleFactor = Math.min(native, 1.5);
            }
            const layer = new window.XRWebGLLayer(session, vrGl, layerOptions);
            try {
              if ("fixedFoveation" in layer) layer.fixedFoveation = 0;
            } catch (error) {}
            session.updateRenderState({ baseLayer: layer });
            try {
              vrRefSpace = await session.requestReferenceSpace("local-floor");
              vrTableBaseY = VR.tableHeight;
            } catch (error) {
              vrRefSpace = await session.requestReferenceSpace("local");
              vrTableBaseY = -0.35; // "local" origin sits at head height, not the floor
            }
            vrTable.y = vrTableBaseY;
          } catch (error) {
            vrSession = null;
            vrSessionMode = null;
            session.end().catch(() => {});
            throw error;
          }
          // A run must exist before the front end can show it; mirror the ?new
          // boot path if the player never clicked through character create.
          // Only now, after the session is granted — starting (and saving) a
          // run that the user then never sees would be a real state change on
          // a failed entry.
          if (!state.characterCreated && typeof beginRun === "function") {
            beginRun();
            render();
          }
          vrHands.clear();
          vrLastArchSignature = null;
          vrLastHudSignature = null;
          vrLastFrameTime = 0;
          vrLoadPaneLayout();
          // Sounds come from their spot on the diorama while the session runs.
          if (typeof setSoundSpatializer === "function") setSoundSpatializer(vrSpatializeTile);
          // Handheld AR has no controllers: screen taps arrive as select
          // events with a target ray. VR must NOT get this listener — there
          // the trigger already acts through the gamepad path, and select
          // would double-fire every press.
          if (sessionMode === "immersive-ar") session.addEventListener("select", vrOnSelect);
          // AR starts unplaced: a reticle tracks real surfaces and the first
          // tap anchors the diorama there. Both hit-test sources are best
          // effort — without the feature the reticle never appears and taps
          // fall straight through to the game, exactly as before.
          vrArHitSource = null;
          vrArTransientHitSource = null;
          vrArReticle = null;
          vrArPlaced = sessionMode !== "immersive-ar";
          if (sessionMode === "immersive-ar" && typeof session.requestHitTestSource === "function") {
            session.requestReferenceSpace("viewer")
              .then((viewer) => session.requestHitTestSource({ space: viewer }))
              .then((source) => { vrArHitSource = source; })
              .catch(() => {});
          }
          if (sessionMode === "immersive-ar" && typeof session.requestHitTestSourceForTransientInput === "function") {
            session.requestHitTestSourceForTransientInput({ profile: "generic-touchscreen" })
              .then((source) => { vrArTransientHitSource = source; })
              .catch(() => {});
          }
          session.addEventListener("end", () => {
            vrSession = null;
            vrSessionMode = null;
            vrRefSpace = null;
            vrArHitSource = null;
            vrArTransientHitSource = null;
            vrArReticle = null;
            vrArPlaced = true;
            vrLastHeadPose = null;
            if (typeof setSoundSpatializer === "function") setSoundSpatializer(null);
            vrRestore2dRendering();
            vrSetSessionButtonsHidden(false);
          });
          vrSetSessionButtonsHidden(true);
          vrPark2dRendering();
          session.requestAnimationFrame(vrOnFrame);
          return session;
        } finally {
          vrEnterPending = false;
        }
      }

      function exitVr() {
        if (vrSession) vrSession.end().catch(() => {});
      }

      // The 2D page is invisible inside the headset, but every game action
      // repaints it — and multi-turn commands (rest, auto-explore, travel)
      // repaint per TURN. Those synchronous canvas/DOM paints stalled the XR
      // frame loop for whole seconds: an unforgivable freeze in an immersive
      // environment. While a session runs, swap the paint entry points for
      // stubs that keep only the state-relevant work; the VR frame loop reads
      // game state directly every frame, so it loses nothing.
      let vrSaveDirty = false;
      let vrSaveTimer = 0;
      const VR_SAVE_INTERVAL_MS = 1500;
      let vrStructureEmits = 0; // rebuild counter, for perf verification

      function vrCommitPendingSave() {
        if (!vrSaveDirty || !vrSaved2d || typeof vrSaved2d.saveGame !== "function") return false;
        const saved = vrSaved2d.saveGame();
        if (saved !== false) vrSaveDirty = false;
        return saved !== false;
      }

      function vrFlushPendingSave() {
        if (vrSaveTimer) {
          clearTimeout(vrSaveTimer);
          vrSaveTimer = 0;
        }
        return vrCommitPendingSave();
      }

      function vrPark2dRendering() {
        if (vrSaved2d) return;
        vrSaved2d = { render: context.render, renderChrome: context.renderChrome, renderViewport: context.renderViewport, saveGame: context.saveGame };
        context.render = function () {
          if (typeof context.scanDiscoveredMonsters === "function") context.scanDiscoveredMonsters();
          if (typeof context.renderEndModal === "function") context.renderEndModal(); // records run results on victory/defeat
          if (typeof context.clearEffectsSoon === "function") context.clearEffectsSoon();
        };
        context.renderChrome = function () {};
        context.renderViewport = function () {};
        // advanceTurn saves the ENTIRE game (hundreds of KB of JSON into
        // localStorage) every single turn — a large slice of the turn hitch.
        // While immersed, coalesce those into one real save per interval;
        // exiting flushes immediately, so at most ~1.5s of play is at risk.
        if (typeof vrSaved2d.saveGame === "function") {
          context.saveGame = function () {
            vrSaveDirty = true;
            if (!vrSaveTimer) {
              vrSaveTimer = setTimeout(() => {
                vrSaveTimer = 0;
                vrCommitPendingSave();
              }, VR_SAVE_INTERVAL_MS);
            }
            return true;
          };
        }
      }

      function vrRestore2dRendering() {
        if (!vrSaved2d) return;
        vrFlushPendingSave();
        context.render = vrSaved2d.render;
        context.renderChrome = vrSaved2d.renderChrome;
        context.renderViewport = vrSaved2d.renderViewport;
        if (vrSaved2d.saveGame) context.saveGame = vrSaved2d.saveGame;
        vrSaveDirty = false;
        vrSaved2d = null;
        context.render(); // repaint the page the headset stopped covering
      }

      if (typeof window.addEventListener === "function") {
        window.addEventListener("pagehide", vrFlushPendingSave);
        window.addEventListener("beforeunload", vrFlushPendingSave);
      }
      if (typeof document.addEventListener === "function") {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") vrFlushPendingSave();
        });
      }

      // Game commands never run inside the XR frame callback — a queued turn
      // (or a hundred, for auto-explore) runs between frames instead, so the
      // frame that captured the input always submits on time.
      function vrScheduleOps() {
        if (vrOpsScheduled || vrPendingOps.length === 0) return;
        vrOpsScheduled = true;
        setTimeout(vrFlushOps, 0);
      }

      function vrFlushOps() {
        vrOpsScheduled = false;
        const ops = vrPendingOps;
        vrPendingOps = [];
        for (const op of ops) {
          if (op.kind === "action") handleAction(op.action);
          else if (op.kind === "travelTo") travelTo(op.x, op.y);
          else if (op.kind === "throw") throwInventoryItem(op.id);
          else if (op.kind === "giveTo") {
            const item = state.inventory.find((entry) => entry.id === op.id);
            if (!item) continue;
            if (typeof equipKindSpec === "function" && equipKindSpec(item.kind)) equipItemToMember(op.member, op.id);
            else useItem(op.id);
          }
          else if (op.pane === "inventory") vrInventoryClick(op.index);
          else vrActivateButton(op.index);
        }
      }

      // Distance along the ray to hold a fresh grab at: panes grab at their
      // hit point; the diorama grabs at its centre's depth along the ray, so
      // the far end of the laser — not the wrist — is what carries it.
      function vrGrabAnchorDistance(target, origin, dir, head) {
        if (target && target.kind === "item") {
          const hit = vrRayPanelHit(origin, dir, vrPaneFrame("inventory", head));
          if (hit) return Math.max(0.05, hit.t);
        }
        if (target !== "table" && VR_PANE_DEFS[target]) {
          const hit = vrRayPanelHit(origin, dir, vrPaneFrame(target, head));
          if (hit) return Math.max(0.05, hit.t);
        }
        // Grab the diorama exactly where the laser touches it; fall back to
        // its centre's depth when pointing past it into the void.
        const dungeon = vrRayDungeonHit(origin, dir);
        if (dungeon) return dungeon.t;
        const toCenter = (vrTable.x - origin.x) * dir.x + (vrTable.y - origin.y) * dir.y + (vrTable.z - origin.z) * dir.z;
        return Math.min(8, Math.max(0.15, toCenter));
      }

      function vrPollControllers(frame, dt, nowMs, head) {
        vrPointerSegs = [];
        vrHandMarkers = [];
        vrDragGhosts = [];
        vrAimTile = null;
        // While the Quest system menu is up (visible-blurred) the browser
        // zeroes gamepad state but keeps delivering frames — processing that
        // would read a held button as a release and fire a phantom action.
        // Dropping the hand states re-latches everything on return.
        if (vrSession.visibilityState && vrSession.visibilityState !== "visible") {
          vrHands.clear();
          vrHover = null;
          return;
        }
        const paneFrames = VR_PANE_KEYS.map((key) => vrPaneFrame(key, head));
        const results = { rotate: 0, scaleRate: 0, resetView: false, toggleDolls: false, ops: [], clicks: [], hover: null };
        const present = new Set();
        // One hand per PANE/item grab per frame; two hands may drag two
        // different things at once. Table grabs collect here instead — one
        // hand keeps the rigid attach, two make the pinch gesture.
        const claimedTargets = new Set();
        const tableGrabs = [];
        for (const source of vrSession.inputSources || []) {
          if (!source.gamepad && !source.hand) continue;
          const key = source.handedness || "none";
          present.add(key);
          if (!vrHands.has(key)) vrHands.set(key, vrCreateHandState());
          const hand = vrHands.get(key);
          const input = source.gamepad ? vrReadGamepad(source.gamepad) : vrReadHand(source, frame, hand);
          if (!input) continue; // hand joints untracked this frame; state stays latched
          // The pointer ray aims at the palette (hover + trigger clicks) and,
          // when the grip closes, picks WHAT that hand grabs and WHERE along
          // the ray it holds it.
          let ray = null;
          let rayQ = null;
          if (source.targetRaySpace && frame.getPose) {
            const rayPose = frame.getPose(source.targetRaySpace, vrRefSpace);
            if (rayPose) {
              const m = rayPose.transform.matrix;
              ray = { origin: { x: m[12], y: m[13], z: m[14] }, dir: { x: -m[8], y: -m[9], z: -m[10] } };
              const o = rayPose.transform.orientation;
              if (o) rayQ = [o.x, o.y, o.z, o.w];
            }
          }
          // The hand itself, visible at all times.
          if (source.gripSpace && frame.getPose) {
            const gripPose = frame.getPose(source.gripSpace, vrRefSpace);
            if (gripPose) {
              const g = gripPose.transform.position;
              vrHandMarkers.push({ x: g.x, y: g.y, z: g.z });
            }
          } else if (input.wrist) {
            vrHandMarkers.push({ x: input.wrist.x, y: input.wrist.y, z: input.wrist.z });
          } else if (ray) {
            vrHandMarkers.push({ ...ray.origin });
          }
          input.pointerButton = -1;
          input.pointerPane = null;
          input.aimTile = null;
          let laserEnd = null;
          let laserBright = false;
          if (ray && !input.squeeze) {
            // The laser stops on the NEAREST thing it meets — pane or dungeon
            // geometry — never through either.
            let best = null;
            for (const paneFrame of paneFrames) {
              const hit = vrRayPanelHit(ray.origin, ray.dir, paneFrame);
              if (!hit || hit.u < 0 || hit.u > 1 || hit.v < 0 || hit.v > 1) continue;
              if (!best || hit.t < best.hit.t) best = { pane: paneFrame.pane, hit };
            }
            const dungeon = vrRayDungeonHit(ray.origin, ray.dir);
            if (best && (!dungeon || best.hit.t <= dungeon.t)) {
              laserEnd = best.hit.point;
              if (best.pane !== "hud") {
                input.pointerButton = best.hit.index;
                input.pointerPane = best.pane;
                results.hover = { pane: best.pane, index: best.hit.index };
                laserBright = true;
              }
            } else if (dungeon) {
              laserEnd = { x: ray.origin.x + ray.dir.x * dungeon.t, y: ray.origin.y + ray.dir.y * dungeon.t, z: ray.origin.z + ray.dir.z * dungeon.t };
              if (dungeon.kind === "floor" && dungeon.walkable) {
                // Walk target: lit tile, A/X travels there.
                input.aimTile = dungeon;
                vrAimTile = { x: dungeon.x, y: dungeon.y };
                laserBright = true;
              }
            }
          }
          // A bare hand has one click — the pinch. What it means is fixed at
          // the moment it STARTS (and held until release, so a pinch that
          // drifts across the scene cannot fire twice): over a lit floor
          // tile it is the travel button, anywhere else the trigger.
          if (input.isHand) {
            if (input.trigger && !hand.pinchRole) hand.pinchRole = input.aimTile ? "primary" : "trigger";
            if (!input.trigger) hand.pinchRole = null;
            if (hand.pinchRole === "primary") {
              input.primary = input.trigger;
              input.trigger = false;
            }
          }
          const step = vrControllerStep(hand, input, nowMs);
          // A/X over a lit floor tile walks there; everywhere else it stays
          // the interact button. A button, not the trigger, on purpose —
          // squeezing the trigger visibly wobbles the aim.
          for (const action of step.actions) {
            if (action === "interact" && input.aimTile) results.ops.push({ kind: "travelTo", x: input.aimTile.x, y: input.aimTile.y });
            else results.ops.push({ kind: "action", action });
          }
          if (step.click >= 0) results.clicks.push({ pane: step.clickPane, index: step.click });
          results.resetView = results.resetView || step.resetView;
          results.toggleDolls = results.toggleDolls || step.toggleDolls;
          if (step.grabbing && ray) {
            if (!hand.grabTarget) {
              hand.grabTarget = vrGrabTargetForRay(ray.origin, ray.dir, head);
              hand.grabDist = vrGrabAnchorDistance(hand.grabTarget, ray.origin, ray.dir, head);
              hand.prevAnchor = null;
              hand.prevGripQ = null;
            }
            // The grab anchor rides the END of the laser: swinging the wrist
            // sweeps the anchor through the ray's full arc, so the grabbed
            // thing tracks the line, not the hand. (Grabbing at arm's-contact
            // distance degenerates to hand-locked movement naturally.)
            const anchor = {
              x: ray.origin.x + ray.dir.x * hand.grabDist,
              y: ray.origin.y + ray.dir.y * hand.grabDist,
              z: ray.origin.z + ray.dir.z * hand.grabDist
            };
            laserEnd = anchor;
            laserBright = true;
            if (hand.grabTarget === "table") {
              // Table grabs are gathered and resolved after the hand loop:
              // one hand keeps the rigid single-hand attach, two hands make
              // the pinch-zoom/twist gesture.
              tableGrabs.push({ hand, anchor, rayQ, rotate: step.rotate, scaleRate: step.scaleRate });
            } else if (!claimedTargets.has(hand.grabTarget)) {
              claimedTargets.add(hand.grabTarget);
              if (hand.prevAnchor && typeof hand.grabTarget === "string") {
                const offset = vrDragOffset(hand.grabTarget, head);
                offset.x += anchor.x - hand.prevAnchor.x;
                offset.y += anchor.y - hand.prevAnchor.y;
                offset.z += anchor.z - hand.prevAnchor.z;
              }
              // A dragged item rides the laser tip as a ghost of its art.
              if (hand.grabTarget && hand.grabTarget.kind === "item") {
                vrDragGhosts.push({ tile: hand.grabTarget.tile, x: anchor.x, y: anchor.y, z: anchor.z });
              }
              hand.prevAnchor = anchor;
              hand.prevGripQ = rayQ;
            }
          } else if (!step.grabbing) {
            if (hand.grabTarget && hand.grabTarget.kind === "item") {
              // Dropping the dragged item: on a party card → give it to that
              // member (equip if wearable); onto the dungeon → throw it.
              if (ray) {
                const partyHit = vrRayPanelHit(ray.origin, ray.dir, vrPaneFrame("party", head));
                if (partyHit && partyHit.index >= 0 && partyHit.u >= 0 && partyHit.u <= 1 && partyHit.v >= 0 && partyHit.v <= 1) {
                  vrPendingOps.push({ kind: "giveTo", member: partyHit.index, id: hand.grabTarget.id });
                } else if (vrRayDungeonHit(ray.origin, ray.dir)) {
                  vrPendingOps.push({ kind: "throw", id: hand.grabTarget.id });
                }
                vrScheduleOps();
              }
            } else if (typeof hand.grabTarget === "string" && hand.grabTarget !== "table") {
              // A pane drag just ended: keep the arrangement across sessions.
              vrSavePaneLayout();
            }
            hand.grabTarget = null;
            hand.prevAnchor = null;
            hand.prevGripQ = null;
          }
          // The laser is always on: to the button/panel it touches, to the
          // grab anchor while dragging, or a fixed reach into the room.
          if (ray) {
            const end = laserEnd || { x: ray.origin.x + ray.dir.x * 1.5, y: ray.origin.y + ray.dir.y * 1.5, z: ray.origin.z + ray.dir.z * 1.5 };
            vrPointerSegs.push({ ox: ray.origin.x, oy: ray.origin.y, oz: ray.origin.z, px: end.x, py: end.y, pz: end.z, bright: laserBright });
          }
        }
        // A controller that left the input source list (slept, disconnected)
        // must not keep stale pressed state — its next appearance starts from
        // the everything-held latch instead of firing phantom releases.
        for (const key of [...vrHands.keys()]) {
          if (!present.has(key)) vrHands.delete(key);
        }
        // Resolve table grabs. ONE hand: the rigid single-controller attach,
        // exactly as before — translate with the laser tip, turn with the
        // wrist, stick steers. TWO hands: the pinch gesture — spread to
        // zoom, twist to rotate, carry by the midpoint (stick input is
        // ignored while both hands hold on).
        if (tableGrabs.length === 1) {
          const grab = tableGrabs[0];
          const hand = grab.hand;
          results.rotate += grab.rotate;
          results.scaleRate += grab.scaleRate;
          if (hand.prevAnchor) {
            let dq = null;
            if (grab.rayQ && hand.prevGripQ) dq = vrQNormalize(vrQMul(grab.rayQ, vrQConj(hand.prevGripQ)));
            const rel = [vrTable.x - hand.prevAnchor.x, vrTable.y - hand.prevAnchor.y, vrTable.z - hand.prevAnchor.z];
            const turned = dq ? vrQRotate(dq, rel) : rel;
            vrTable.x = grab.anchor.x + turned[0];
            vrTable.y = grab.anchor.y + turned[1];
            vrTable.z = grab.anchor.z + turned[2];
            if (dq) vrTable.q = vrQNormalize(vrQMul(dq, vrTable.q));
          }
          hand.prevAnchor = grab.anchor;
          hand.prevGripQ = grab.rayQ;
        } else if (tableGrabs.length >= 2) {
          const [grabA, grabB] = tableGrabs;
          if (grabA.hand.prevAnchor && grabB.hand.prevAnchor) {
            vrTwoHandStep(grabA.hand.prevAnchor, grabB.hand.prevAnchor, grabA.anchor, grabB.anchor);
          }
          for (const grab of tableGrabs) {
            grab.hand.prevAnchor = grab.anchor;
            grab.hand.prevGripQ = grab.rayQ;
          }
        }
        if (results.rotate) {
          vrTable.q = vrQNormalize(vrQMul(vrQFromAxisAngle([0, 1, 0], results.rotate * VR.rotateSpeed * dt), vrTable.q));
        }
        if (results.scaleRate) {
          vrTable.scale = Math.max(VR.scaleMin, Math.min(VR.scaleMax, vrTable.scale * Math.exp(results.scaleRate * VR.scaleSpeed * dt)));
        }
        if (results.resetView) vrResetTable();
        if (results.toggleDolls) {
          vrToggleDollMode();
          vrLastHudSignature = null;
        }
        vrHover = results.hover;
        // Queue, don't run: see vrScheduleOps. Clicks queue after actions so
        // an Exit VR click lands after the frame's game commands. Party-pane
        // clicks are pure front-end selection — immediate, no game turn.
        for (const op of results.ops) vrPendingOps.push(op);
        for (const click of results.clicks) {
          if (click.pane === "party") vrPartyClick(click.index);
          else vrPendingOps.push({ kind: "click", pane: click.pane, index: click.index });
        }
        vrScheduleOps();
      }

      function vrOnFrame(time, frame) {
        if (!vrSession) return;
        vrSession.requestAnimationFrame(vrOnFrame);
        const pose = frame.getViewerPose(vrRefSpace);
        if (!pose) return;
        const gl = vrGl;
        const glState = vrGlState;
        const dt = vrLastFrameTime ? Math.min(0.1, (time - vrLastFrameTime) / 1000) : 0.016;
        vrLastFrameTime = time;

        const head = pose.transform.position;
        const headO = pose.transform.orientation;
        vrLastHeadPose = {
          position: { x: head.x, y: head.y, z: head.z },
          orientation: headO ? { x: headO.x, y: headO.y, z: headO.z, w: headO.w } : { x: 0, y: 0, z: 0, w: 1 }
        };
        vrPollControllers(frame, dt, time, head);

        // AR tap-to-place reticle: while unplaced, track the real surface the
        // viewer is looking at so the user sees where a tap would anchor.
        vrArReticle = null;
        if (!vrArPlaced && vrArHitSource && typeof frame.getHitTestResults === "function") {
          const hits = frame.getHitTestResults(vrArHitSource) || [];
          const hitPose = hits.length ? hits[0].getPose(vrRefSpace) : null;
          if (hitPose) {
            const p = hitPose.transform.position;
            vrArReticle = { x: p.x, y: p.y, z: p.z };
          }
        }

        vrEnsureAtlasScope();
        vrStampPendingTiles();
        vrStampPendingNormals();
        // Structure rebuilds only on discovery/door/dig changes — NOT per
        // turn, and NOT when textures load (they stamp into pre-bound slots).
        const signature = vrStructureSignature();
        if (signature !== vrLastArchSignature) {
          vrLastArchSignature = signature;
          vrStructureEmits += 1;
          const structure = vrEmitArchitecture(vrStructureModel());
          glState.archCount = vrUploadBuffer(glState.archBuffer, structure.solid);
          glState.transCount = vrUploadBuffer(glState.transBuffer, structure.translucent);
        }

        const headModel = vrHeadToModel(head);
        // Game-feel bookkeeping: floor changes drop stale animation state, and
        // fresh party damage flares the visor.
        if (state.floorIndex !== vrFeelFloor) {
          vrFeelFloor = state.floorIndex;
          vrResetGameFeel();
        }
        if ((state.damageTaken || 0) > vrLastDamageTaken) vrPartyHitAt = time;
        vrLastDamageTaken = state.damageTaken || 0;
        const dolls = vrEmitDolls(vrDollModel(), headModel, vrDollMode(), time);
        const decals = vrEmitArchitecture({ ...vrStructureDims(), surfaces: vrDynamicDecalSurfaces() });
        glState.dollCount = vrUploadBuffer(glState.dollBuffer, dolls.solid.concat(decals.solid));
        glState.dollTransCount = vrUploadBuffer(glState.dollTransBuffer, dolls.translucent.concat(decals.translucent));
        glState.hudCount = vrUploadBuffer(glState.hudBuffer, vrEmitHud(head));
        glState.panelCount = vrUploadBuffer(glState.panelBuffer, vrEmitControlPanel(head));
        glState.partyCount = vrUploadBuffer(glState.partyBuffer, vrEmitFrameQuad(vrPaneFrame("party", head), vrPaneExtent(vrPartyPane)));
        glState.invCount = vrUploadBuffer(glState.invBuffer, vrEmitFrameQuad(vrPaneFrame("inventory", head), vrPaneExtent(vrInvPane)));
        glState.pointerCount = vrUploadBuffer(glState.pointerBuffer, vrEmitPointers(head));
        glState.overlayCount = vrUploadBuffer(glState.overlayBuffer, vrEmitPartyOverlay(pose.transform, time));

        vrFlushAtlas(glState);
        const hudSignature = JSON.stringify(vrHudModel());
        if (hudSignature !== vrLastHudSignature) {
          vrLastHudSignature = hudSignature;
          if (vrDrawHud()) vrUploadCanvasTexture(glState.hudTexture, vrHud.canvas);
        }
        // Repaint each pane face only when its content or hover changes.
        const paletteHover = vrHover?.pane === "palette" ? vrHover.index : -1;
        if (paletteHover !== vrPaletteDrawnHover) {
          vrPaletteDrawnHover = paletteHover;
          if (vrDrawControlPanel(paletteHover)) vrUploadCanvasTexture(glState.panelTexture, vrPanel.canvas);
        }
        const partySig = vrPartyPaneSignature(vrHover?.pane === "party" ? vrHover.index : -1);
        if (partySig !== vrPartyDrawnSig) {
          vrPartyDrawnSig = partySig;
          if (vrDrawPartyPane(vrHover?.pane === "party" ? vrHover.index : -1)) vrUploadCanvasTexture(glState.partyTexture, vrPartyPane.canvas);
        }
        const invSig = vrInventoryPaneSignature(vrHover?.pane === "inventory" ? vrHover.index : -1);
        if (invSig !== vrInvDrawnSig) {
          vrInvDrawnSig = invSig;
          if (vrDrawInventoryPane(vrHover?.pane === "inventory" ? vrHover.index : -1)) vrUploadCanvasTexture(glState.invTexture, vrInvPane.canvas);
        }

        const layer = vrSession.renderState.baseLayer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        // AR composites the camera feed wherever we leave alpha at zero; VR
        // paints its own void.
        if (vrSession.environmentBlendMode && vrSession.environmentBlendMode !== "opaque") gl.clearColor(0, 0, 0, 0);
        else gl.clearColor(0.028, 0.024, 0.02, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE); // paper dolls are visible from both sides
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(glState.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(glState.uTex, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, glState.normalAtlasTexture);
        gl.uniform1i(glState.uNormalTex, 1);
        gl.uniform3f(glState.uLightDir, 0.35, 0.82, 0.45);
        gl.activeTexture(gl.TEXTURE0);

        const model = vrModelMatrix();
        for (const view of pose.views) {
          const viewport = layer.getViewport(view);
          gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
          gl.uniformMatrix4fv(glState.uProj, false, view.projectionMatrix);
          gl.uniformMatrix4fv(glState.uView, false, view.transform.inverse.matrix);
          // Alpha-to-coverage on the cutout passes: with a multisampled layer
          // the sprites' alpha edge becomes per-sample coverage instead of a
          // hard one-pixel discard cliff, which is what made doll and wall-top
          // silhouettes sparkle. Harmless no-op without MSAA.
          gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
          vrDrawBuffer(gl, glState, glState.archBuffer, glState.archCount, model, glState.atlasTexture, 0.45, true);
          vrDrawBuffer(gl, glState, glState.dollBuffer, glState.dollCount, model, glState.atlasTexture, 0.45, true);
          gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
          vrDrawBuffer(gl, glState, glState.transBuffer, glState.transCount, model, glState.atlasTexture, 0.02, false);
          vrDrawBuffer(gl, glState, glState.dollTransBuffer, glState.dollTransCount, model, glState.atlasTexture, 0.02, false);
          vrDrawBuffer(gl, glState, glState.hudBuffer, glState.hudCount, glState.identity, glState.hudTexture, 0.02, false);
          // Control panel + laser as an always-visible overlay: the panel is a
          // UI console off to the side, so it should never be occluded by the
          // diorama when you turn it. Both are world-space (identity model).
          gl.disable(gl.DEPTH_TEST);
          vrDrawBuffer(gl, glState, glState.panelBuffer, glState.panelCount, glState.identity, glState.panelTexture, 0.02, false);
          vrDrawBuffer(gl, glState, glState.partyBuffer, glState.partyCount, glState.identity, glState.partyTexture, 0.02, false);
          vrDrawBuffer(gl, glState, glState.invBuffer, glState.invCount, glState.identity, glState.invTexture, 0.02, false);
          vrDrawBuffer(gl, glState, glState.pointerBuffer, glState.pointerCount, glState.identity, glState.atlasTexture, 0.02, false);
          // Party-status visor, over absolutely everything.
          vrDrawBuffer(gl, glState, glState.overlayBuffer, glState.overlayCount, glState.identity, glState.atlasTexture, 0.02, false);
          gl.enable(gl.DEPTH_TEST);
        }
        gl.depthMask(true);
      }

      bindVr();

      Object.assign(context, {
        bindVr,
        enterVr,
        enterAr,
        exitVr,
        vrSupported,
        arSupported,
        vrHandleTapRay,
        vrDollMode,
        vrSetDollMode,
        vrToggleDollMode,
        vrToggleArtStyle,
        vrArchSignature,
        vrArchitectureModel,
        vrDollModel,
        vrDollYaw,
        vrDirYaw,
        vrHudModel,
        vrCreateHandState,
        vrReadGamepad,
        vrHandGesture,
        vrReadHand,
        vrControllerStep,
        vrEmitArchitecture,
        vrEmitDolls,
        vrControlButtons,
        vrActivateButton,
        vrControlPanelFrame,
        vrHudFrame,
        vrRayPanelHit,
        vrGrabTargetForRay,
        vrGrabAnchorDistance,
        vrDragOffset,
        vrResetTable,
        vrPaneFrame,
        vrStructureModel,
        vrDynamicDecalSurfaces,
        vrStructureSignature,
        vrPartyPaneModel,
        vrInventoryPaneModel,
        vrPartyClick,
        vrInventoryClick,
        vrSelectedMember: () => vrSelectedMemberIndex,
        vrDebugStats: () => ({
          structureEmits: vrStructureEmits,
          pendingTiles: vrAtlas.pending.size,
          pendingNormals: vrNormalAtlas.pending.size,
          readyNormals: [...vrAtlas.tiles.values()].filter((slot) => slot.normalReady).length,
          tileSlots: vrAtlas.tiles.size,
          tileSlotSize: VR_TILE_SLOT,
          linocutTileSlotSize: VR_LINOCUT_TILE_SLOT,
          atlasScope: vrAtlasScope,
          atlasWidth: vrAtlas.width,
          atlasHeight: vrAtlas.height
        }),
        vrHalveLinear,
        vrHalveNormal,
        vrAtlasAllocate,
        vrEnsureAtlasScope,
        vrShaderSources: () => ({ vertex: VR_VERTEX_SHADER, fragment: VR_FRAGMENT_SHADER, vertexFloats: VR_VERTEX_FLOATS }),
        vrTableState,
        vrTableLevel,
        vrQMul,
        vrQFromAxisAngle,
        vrQRotate,
        vrPointerSegments: () => vrPointerSegs,
        vrAimTileForRay,
        vrRayDungeonHit,
        vrEmitPartyOverlay,
        vrLoadPaneLayout,
        vrSavePaneLayout,
        vrPark2dRendering,
        vrRestore2dRendering,
        vrFlushPendingSave,
        vrPaneOffsets: () => vrPanelOffsets,
        vrTwoHandStep,
        vrArBeginPlacement,
        vrArPlaceAt,
        vrArPlacementState,
        vrSpatializeTile,
        vrResetGameFeel,
        vrGameFeel: () => ({ anims: vrDollAnim.size, flashes: vrDollFlash.size, floaters: vrFloaters.map((f) => ({ text: f.text, color: f.color })) }),
        vrEmitFloaters,
      });
    }
  };
}());
