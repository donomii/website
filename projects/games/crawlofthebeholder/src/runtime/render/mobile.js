(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installMobile = function (context) {
    with (context) {
      const SWIPE_THRESHOLD = 36; // pixels
      const SWIPE_TIMEOUT_MS = 600;
      const LONG_PRESS_MS = 380;
      const TOUCH_EDGE_FRACTION = 0.18; // outer 18% of the viewport turns on a tap
      const MOBILE_LAYOUT_QUERY = "(max-width: 720px), (max-width: 920px) and (orientation: landscape) and (max-height: 540px)";

      function isMobileLayout() {
        if (typeof window === "undefined") return false;
        return window.matchMedia && window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
      }

      function bindMoreActionsSheet() {
        const grid = document.querySelector(".more-actions-grid");
        if (!grid) return;
        grid.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-action]");
          if (!button) return;
          const action = button.dataset.action;
          els.moreActionsModal?.classList.add("hidden");
          if (typeof dispatchUiAction === "function" && dispatchUiAction(action)) return;
          if (typeof handleAction === "function") handleAction(action);
        });
      }

      function isViewportInteractionEvent(event) {
        return !!event.target?.closest?.(".viewport-target");
      }

      function touchCenter(touches) {
        const points = Array.from(touches);
        return { x: points.reduce((sum, point) => sum + point.clientX, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.clientY, 0) / points.length };
      }

      function viewportTouchAction(dx, dy, fingers, tapX) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) {
          // Two-finger tap = wait.
          if (fingers === 2) return "wait";
          else if (tapX <= TOUCH_EDGE_FRACTION) return "turnLeft";
          else if (tapX >= 1 - TOUCH_EDGE_FRACTION) return "turnRight";
          else {
            // Treated as a centre tap — attack if a monster is in front, otherwise step forward.
            const forward = dirAt(0);
            return monsterAt(state.x + forward.x, state.y + forward.y) ? "attack" : "moveForward";
          }
        } else if (absX > absY) {
          return fingers === 2 ? (dx > 0 ? "moveRight" : "moveLeft") : (dx > 0 ? "turnRight" : "turnLeft");
        } else {
          // Vertical swipe up = forward, down = back.
          return fingers === 1 ? (dy < 0 ? "moveForward" : "moveBack") : null;
        }
      }

      // Touch swipe detection on the viewport. One finger turns; two sidestep.
      function bindViewportTouch() {
        const node = els.viewport;
        if (!node || typeof node.addEventListener !== "function") return;
        let gesture = null;
        let longPressTimer = 0;
        let blocked = false;
        const clearTimer = () => {
          window.clearTimeout(longPressTimer);
          longPressTimer = 0;
        };

        node.addEventListener("touchstart", (event) => {
          clearTimer();
          if (blocked || event.touches.length > 2) {
            gesture = null;
            blocked = true;
            return;
          } else if (event.touches.length === 0) {
            return;
          } else {
            gesture = { ...touchCenter(event.touches), time: Date.now(), fingers: event.touches.length,
              target: isViewportInteractionEvent(event) };
          }
          if (gesture.fingers === 1 && !gesture.target) {
            longPressTimer = window.setTimeout(() => {
              longPressTimer = 0;
              gesture = null;
              blocked = true;
              if (typeof handleAction === "function") handleAction("examine");
            }, LONG_PRESS_MS);
          } else {
            longPressTimer = 0;
          }
        }, { passive: true });

        node.addEventListener("touchmove", (event) => {
          if (!gesture || event.touches.length === 0) return;
          const point = touchCenter(event.touches);
          if (Math.abs(point.x - gesture.x) > 12 || Math.abs(point.y - gesture.y) > 12) {
            clearTimer();
          } else {
            return;
          }
        }, { passive: true });

        node.addEventListener("touchend", (event) => {
          clearTimer();
          if (blocked) {
            blocked = event.touches.length > 0;
            event.preventDefault();
            return;
          } else if (!gesture || event.changedTouches.length === 0) {
            return;
          } else {
            const start = gesture;
            gesture = null;
            blocked = event.touches.length > 0;
            const point = touchCenter([...event.changedTouches, ...event.touches]);
            const dx = point.x - start.x;
            const dy = point.y - start.y;
            const tap = Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD;
            if (start.fingers === 1 && start.target && tap) return;
            event.preventDefault(); // consume the synthetic click after a handled gesture
            if (Date.now() - start.time > SWIPE_TIMEOUT_MS) return;
            const bounds = node.getBoundingClientRect();
            const action = viewportTouchAction(dx, dy, start.fingers, (start.x - bounds.left) / bounds.width);
            if (action) handleAction(action);
          }
        }, { passive: false });

        // Cancellation is not a release and must never issue a game command.
        node.addEventListener("touchcancel", () => {
          clearTimer();
          gesture = null;
          blocked = false;
        }, { passive: true });
      }

      // Tap a known minimap cell to auto-travel there.
      function bindMinimapTaps() {
        const map = els.map;
        if (!map || typeof map.addEventListener !== "function") return;
        let mapTouchStart = 0;
        let mapMoved = false;
        map.addEventListener("touchstart", () => { mapTouchStart = Date.now(); mapMoved = false; }, { passive: true });
        map.addEventListener("touchmove", () => { mapMoved = true; }, { passive: true });
        map.addEventListener("click", (event) => {
          const cell = event.target.closest(".map-cell");
          if (!cell) return;
          // Compute the cell's coordinates from its position in the grid.
          const idx = Array.from(map.children).indexOf(cell);
          if (idx < 0) return;
          const width = currentFloor().map.width;
          const x = idx % width;
          const y = Math.floor(idx / width);
          if (!currentFloorState().discovered.has(keyOf(x, y))) return;
          travelToCell({ x, y });
        });
      }

      // Travel to a tapped minimap cell using the existing BFS step finder.
      function travelToCell(target) {
        if (state.victory || state.defeated) return false;
        if (state.x === target.x && state.y === target.y) return false;
        const threat = restNearbyThreat();
        if (threat) {
          setMessage(`${threat.name} is too close. The party cannot travel.`);
          return false;
        }
        const blocker = restBlockingCondition();
        if (blocker) {
          setMessage(`The party cannot travel while ${blocker} lingers.`);
          return false;
        }
        const goals = [target];
        let steps = 0;
        const maxSteps = 80;
        while (steps < maxSteps && !state.defeated && !state.victory) {
          if (state.x === target.x && state.y === target.y) break;
          const move = bfsNextStep(goals);
          if (!move || move.reached) break;
          const before = { x: state.x, y: state.y };
          moveBy(move.dx, move.dy);
          steps += 1;
          if (state.x === before.x && state.y === before.y) break;
          if (restNearbyThreat()) break;
          if (restBlockingCondition()) break;
        }
        if (steps > 0) {
          state.message = state.x === target.x && state.y === target.y
            ? `The party walks ${steps} step${steps === 1 ? "" : "s"} to the marked cell.`
            : `The party walks ${steps} step${steps === 1 ? "" : "s"} toward the marker.`;
        } else {
          setMessage("No clear path there.");
        }
        render();
        return true;
      }

      function bindMobile() {
        if (typeof document === "undefined") return;
        bindMoreActionsSheet();
        bindViewportTouch();
        bindMinimapTaps();
        bindWakeLock();
      }

      // Haptic feedback patterns — kept short to feel like part of the game
      // rather than a buzzing phone. Patterns mirror DCSS-style event flavor:
      // a tap for movement, a thump for melee, a flutter for criticals, etc.
      const HAPTIC_PATTERNS = {
        move: 8,
        bump: [4, 30, 4],
        attack: 18,
        crit: [25, 30, 60],
        hit: 22,
        door: 12,
        pickup: 10,
        stairs: [12, 20, 12],
        levelUp: [10, 30, 10, 30, 30],
        defeat: [80, 40, 80],
        victory: [40, 20, 40, 20, 80],
        achievement: [10, 20, 30],
        signature: [12, 18, 24]
      };

      function hapticsEnabled() {
        const settings = typeof readSettings === "function" ? readSettings() : {};
        // Default ON on touch devices, opt-in OFF via settings.
        if (settings.haptics === false) return false;
        return true;
      }

      function pulse(kind, at) {
        // Fire the matching sound effect (if installed) alongside the haptic.
        // playSound has its own settings/gate so this stays orthogonal. `at`
        // (anything with tile x/y — a monster, a door cell) positions the
        // sound; omitted means it happens to the party itself.
        if (typeof playSound === "function") playSound(kind, at);
        if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
        if (!hapticsEnabled()) return false;
        const pattern = HAPTIC_PATTERNS[kind];
        if (!pattern) return false;
        try {
          navigator.vibrate(pattern);
          return true;
        } catch (error) {
          return false;
        }
      }

      // Rotate-to-landscape hint shown once per device.
      function isPortrait() {
        if (typeof window === "undefined" || !window.matchMedia) return false;
        return window.matchMedia("(orientation: portrait)").matches;
      }

      function showRotateHint() {
        if (!isMobileLayout()) return;
        if (!isPortrait()) return;
        const settings = typeof readSettings === "function" ? readSettings() : {};
        if (settings.dismissedRotateHint) return;
        if (typeof showToast === "function") {
          showToast("Tip: rotate to landscape for the full view.", 3800);
        }
        settings.dismissedRotateHint = true;
        if (typeof writeSettings === "function") writeSettings(settings);
      }

      // Screen Wake Lock — keep the phone awake while playing.
      let activeWakeLock = null;

      function wakeLockSupported() {
        return typeof navigator !== "undefined" && navigator.wakeLock && typeof navigator.wakeLock.request === "function";
      }

      async function requestWakeLock() {
        if (!wakeLockSupported()) return false;
        if (activeWakeLock) return true;
        try {
          activeWakeLock = await navigator.wakeLock.request("screen");
          if (activeWakeLock && typeof activeWakeLock.addEventListener === "function") {
            activeWakeLock.addEventListener("release", () => { activeWakeLock = null; });
          }
          return true;
        } catch (error) {
          activeWakeLock = null;
          return false;
        }
      }

      function releaseWakeLock() {
        if (!activeWakeLock) return;
        try { activeWakeLock.release?.(); } catch (e) {}
        activeWakeLock = null;
      }

      function bindWakeLock() {
        if (!wakeLockSupported() || typeof document === "undefined") return;
        // Re-acquire when the tab regains focus.
        if (typeof document.addEventListener === "function") {
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") requestWakeLock();
          });
        }
        requestWakeLock();
      }

      Object.assign(context, {
        isMobileLayout,
        bindMobile,
        bindViewportTouch,
        viewportTouchAction,
        isViewportInteractionEvent,
        travelToCell,
        pulse,
        hapticsEnabled,
        HAPTIC_PATTERNS,
        isPortrait,
        showRotateHint,
        wakeLockSupported,
        requestWakeLock,
        releaseWakeLock
      });
    }
  };
}());
