(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installMobile = function (context) {
    with (context) {
      const SWIPE_THRESHOLD = 36; // pixels
      const SWIPE_TIMEOUT_MS = 600;
      const LONG_PRESS_MS = 380;

      function isMobileLayout() {
        if (typeof window === "undefined") return false;
        return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
      }

      function setActiveTab(name) {
        if (!name) return;
        state.activeMobileTab = name;
        if (typeof document === "undefined") return;
        if (typeof document.querySelectorAll !== "function") return;
        const tabs = document.querySelectorAll(".mobile-tab[data-tab]");
        if (tabs && typeof tabs.forEach === "function") {
          tabs.forEach((tab) => {
            tab.setAttribute?.("aria-pressed", tab.dataset?.tab === name ? "true" : "false");
          });
        }
        const panels = document.querySelectorAll(".side-panel .tool-panel[data-panel]");
        if (panels && typeof panels.forEach === "function") {
          panels.forEach((panel) => {
            panel.setAttribute?.("data-active", panel.dataset?.panel === name ? "true" : "false");
          });
        }
      }

      function ensureDefaultTab() {
        if (!state.activeMobileTab) setActiveTab("map");
        else setActiveTab(state.activeMobileTab);
      }

      function bindMobileTabs() {
        if (typeof document === "undefined") return;
        document.querySelectorAll(".mobile-tab[data-tab]").forEach((tab) => {
          tab.addEventListener("click", (event) => {
            event.preventDefault();
            setActiveTab(tab.dataset.tab);
          });
        });
        ensureDefaultTab();
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

      // Touch swipe detection on the viewport.
      function bindViewportTouch() {
        const node = els.viewport;
        if (!node || typeof node.addEventListener !== "function") return;
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let longPressTimer = 0;
        let suppressed = false;

        node.addEventListener("touchstart", (event) => {
          if (event.touches.length !== 1) return;
          const touch = event.touches[0];
          startX = touch.clientX;
          startY = touch.clientY;
          startTime = Date.now();
          suppressed = false;
          if (typeof window.clearTimeout === "function") {
            longPressTimer = window.setTimeout(() => {
              suppressed = true;
              if (typeof handleAction === "function") handleAction("examine");
            }, LONG_PRESS_MS);
          }
        }, { passive: true });

        node.addEventListener("touchmove", (event) => {
          if (event.touches.length !== 1) return;
          const touch = event.touches[0];
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
            if (longPressTimer) { window.clearTimeout(longPressTimer); longPressTimer = 0; }
          }
        }, { passive: true });

        node.addEventListener("touchend", (event) => {
          if (longPressTimer) { window.clearTimeout(longPressTimer); longPressTimer = 0; }
          if (suppressed) return;
          if (Date.now() - startTime > SWIPE_TIMEOUT_MS) return;
          const touch = event.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) {
            // Treated as a tap — attack if a monster is in front, otherwise step forward.
            if (typeof handleAction === "function") {
              const forward = dirAt(0);
              const ahead = monsterAt(state.x + forward.x, state.y + forward.y);
              handleAction(ahead ? "attack" : "moveForward");
            }
            return;
          }

          if (absX > absY) {
            // Horizontal swipe = sidestep.
            handleAction(dx > 0 ? "moveRight" : "moveLeft");
          } else {
            // Vertical swipe up = forward, down = back.
            handleAction(dy < 0 ? "moveForward" : "moveBack");
          }
        }, { passive: true });

        // Two-finger tap = wait.
        node.addEventListener("touchend", (event) => {
          if (event.changedTouches.length === 2) {
            handleAction("wait");
          }
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
        bindMobileTabs();
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

      function pulse(kind) {
        // Fire the matching sound effect (if installed) alongside the haptic.
        // playSound has its own settings/gate so this stays orthogonal.
        if (typeof playSound === "function") playSound(kind);
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
        setActiveTab,
        bindMobile,
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
