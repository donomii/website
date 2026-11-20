"use strict";

(function runBrushwork() {
  const canvas = document.getElementById("game");
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Brushwork requires two-dimensional canvas support");
  }

  const ids = [
    "hud", "health-value", "health-bar", "ink-value", "ink-bar", "wave-value", "wave-message",
    "start-button", "menu-button", "menu", "resume-button", "dodge-button",
    "result", "result-title", "final-time", "final-score", "final-runes", "restart-button",
    "run-time", "run-score", "run-runes", "run-chain", "final-chain",
  ];
  const dom = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const combat = BrushworkCombat.create(BrushworkRunes, BrushworkEffects);
  const { game } = combat;
  const renderer = BrushworkRenderer.create({ context, game, constants: BrushworkCombat.constants, seededNoise });
  const keys = new Set();
  const touchRadius = 42;
  const touchDeadZone = 6;
  const movement = new Map([
    ["KeyW", [0, -1]], ["ArrowUp", [0, -1]], ["KeyS", [0, 1]], ["ArrowDown", [0, 1]],
    ["KeyA", [-1, 0]], ["ArrowLeft", [-1, 0]], ["KeyD", [1, 0]], ["ArrowRight", [1, 0]],
  ]);
  let paintOwner = null;
  let mousePainting = false;
  let stickOwner = null;
  let lastFrame = performance.now();
  let lastState = null;
  let lastSummary = "";

  function seededNoise(value) {
    const raw = Math.sin(value * 12.9898) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function position(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function direction() {
    let x = 0;
    let y = 0;
    // Iteration order makes the newest held key win when an axis reverses.
    for (const code of keys) {
      const [horizontal, vertical] = movement.get(code);
      x = horizontal || x;
      y = vertical || y;
    }
    if (x !== 0 || y !== 0 || game.joystick === null) {
      return { x, y };
    } else {
      const { dx, dy } = game.joystick;
      const offset = Math.hypot(dx, dy);
      const speed = Math.max(0, offset - touchDeadZone) / (touchRadius - touchDeadZone);
      const scale = speed / Math.max(1, offset);
      return { x: dx * scale, y: dy * scale };
    }
  }

  function dodge() {
    const { x, y } = direction();
    combat.dodge(x, y);
  }

  function clearInput() {
    keys.clear();
    const pointers = [paintOwner, stickOwner];
    paintOwner = null;
    mousePainting = false;
    stickOwner = null;
    game.joystick = null;
    for (const pointer of pointers) {
      if (typeof pointer === "number" && canvas.hasPointerCapture(pointer)) {
        canvas.releasePointerCapture(pointer);
      }
    }
    combat.finishPaint();
  }

  function resize() {
    clearInput();
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    combat.resize(width, height, ratio, dom.hud.offsetHeight);
    renderer.render();
  }

  function start() {
    clearInput();
    setMenu(false);
    combat.start();
    document.activeElement?.blur();
  }

  function setMenu(open) {
    const changed = open === dom.menu.hidden;
    if (!changed) {
      return;
    } else {
      clearInput();
      combat.pause();
      dom.menu.hidden = !open;
      dom["menu-button"].setAttribute("aria-expanded", String(open));
      if (open) {
        dom["resume-button"].focus();
      } else {
        const target = game.state === "playing" ? canvas : dom["menu-button"];
        target.focus();
      }
    }
  }

  function setText(element, text) {
    const value = String(text);
    if (element.textContent !== value) {
      element.textContent = value;
    }
  }

  function setMeter(name) {
    const value = game.player[name];
    setText(dom[name + "-value"], Math.ceil(value));
    dom[name + "-bar"].style.transform = "scaleX(" + (value / 100).toFixed(3) + ")";
  }

  function formatTime() {
    const seconds = Math.floor(game.elapsed);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function syncInterface() {
    setMeter("health");
    setMeter("ink");
    setText(dom["wave-value"], game.wave + " / " + game.waveCount);
    const remaining = game.queued + game.portals.length + game.enemies.length;
    const summary = game.state === "ready" ? "Ready" : game.phase === "incoming"
      ? (game.wave === 1 ? "Incoming" : "Regroup") : remaining + " left";
    if (summary !== lastSummary) {
      setText(dom["wave-message"], summary);
      lastSummary = summary;
    }
    if (!dom.menu.hidden) {
      setText(dom["run-time"], formatTime());
      setText(dom["run-score"], game.defeated);
      setText(dom["run-runes"], game.runeCount);
      setText(dom["run-chain"], game.bestChain);
    }
    dom["dodge-button"].disabled = game.player.cooldown > BrushworkCombat.constants.dashBuffer || game.state !== "playing";
    if (game.state !== lastState) {
      const finished = game.state === "defeated" || game.state === "victorious";
      dom["start-button"].hidden = game.state !== "ready";
      dom["dodge-button"].hidden = game.state !== "playing";
      dom.result.hidden = !finished;
      setText(dom["resume-button"], game.state === "paused" ? "Resume" : "Close");
      if (finished) {
        clearInput();
        setText(dom["result-title"], game.state === "victorious" ? "Page sealed" : "Overrun");
        setText(dom["final-time"], formatTime());
        setText(dom["final-score"], game.defeated);
        setText(dom["final-runes"], game.runeCount);
        setText(dom["final-chain"], game.bestChain);
        dom["restart-button"].focus();
      }
      lastState = game.state;
    }
  }

  function frame(now) {
    // Limit simulation catch-up after a stalled frame and substep fast contacts.
    let delta = Math.max(0, Math.min(0.06, (now - lastFrame) / 1000));
    lastFrame = now;
    const { x, y } = direction();
    while (delta > 0) {
      const step = Math.min(delta, 1 / 60);
      combat.update(step, x, y);
      delta -= step;
    }
    syncInterface();
    renderer.render();
    requestAnimationFrame(frame);
  }

  function handleKeyDown(event) {
    const { code } = event;
    const buttonFocused = event.target instanceof HTMLButtonElement;
    const paintKey = code === "Space" && !buttonFocused;
    const menuKey = code === "Escape" || code === "KeyP";
    const dashKey = code === "ShiftLeft" || code === "ShiftRight";
    if (movement.has(code) || paintKey || menuKey || dashKey) {
      event.preventDefault();
    }
    if (menuKey && !event.repeat) {
      setMenu(dom.menu.hidden);
    } else if (dom.menu.hidden) {
      if (movement.has(code)) {
        keys.add(code);
      }
      if (!event.repeat && game.state === "playing") {
        if (paintKey && paintOwner === null && combat.beginPaint(null)) {
          paintOwner = "space";
        } else if (dashKey) {
          dodge();
        }
      } else if (!event.repeat) {
        const ready = game.state === "ready" && code === "Enter" && !buttonFocused;
        const replay = (game.state === "defeated" || game.state === "victorious") && code === "KeyR";
        if (ready || replay) {
          start();
        }
      }
    }
  }

  function handleKeyUp(event) {
    keys.delete(event.code);
    if (event.code === "Space" && paintOwner === "space") {
      paintOwner = null;
      combat.finishPaint();
    }
  }

  function handlePointerDown(event) {
    if (event.button === 0 && game.state === "playing") {
      const point = position(event);
      const inStickArea = event.pointerType === "touch" && point.x < game.width * 0.43
        && point.y > game.arenaTop + (game.height - game.arenaTop) * 0.56;
      document.activeElement?.blur();
      if (inStickArea && stickOwner === null) {
        stickOwner = event.pointerId;
        game.joystick = { ...point, dx: 0, dy: 0 };
        canvas.setPointerCapture(event.pointerId);
      } else if (!inStickArea && paintOwner === null && combat.beginPaint(point)) {
        paintOwner = event.pointerId;
        mousePainting = event.pointerType === "mouse";
        canvas.setPointerCapture(event.pointerId);
      }
    }
  }

  function handlePointerMove(event) {
    const point = position(event);
    if (event.pointerId === stickOwner) {
      const stick = game.joystick;
      const x = point.x - stick.x;
      const y = point.y - stick.y;
      const normalize = touchRadius / Math.max(touchRadius, Math.hypot(x, y));
      stick.dx = x * normalize;
      stick.dy = y * normalize;
    } else if (event.pointerId === paintOwner) {
      const samples = event.getCoalescedEvents?.();
      if (samples?.length) {
        for (const sample of samples) {
          combat.paint(position(sample));
        }
      } else {
        combat.paint(point);
      }
    }
  }

  function releasePointer(event) {
    if (event.pointerId === stickOwner) {
      stickOwner = null;
      game.joystick = null;
    } else if (event.pointerId === paintOwner) {
      finishPointerPaint(event.type === "pointerup" ? position(event) : null);
    }
  }

  function finishPointerPaint(point) {
    const pointer = paintOwner;
    paintOwner = null;
    mousePainting = false;
    if (point !== null) {
      combat.paint(point, 1);
    }
    combat.finishPaint();
    if (canvas.hasPointerCapture(pointer)) {
      canvas.releasePointerCapture(pointer);
    }
  }

  dom["start-button"].addEventListener("click", start);
  dom["restart-button"].addEventListener("click", start);
  dom["menu-button"].addEventListener("click", () => setMenu(dom.menu.hidden));
  dom["resume-button"].addEventListener("click", () => setMenu(false));
  dom["dodge-button"].addEventListener("click", () => {
    dodge();
    dom["dodge-button"].blur();
  });
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("mouseup", (event) => {
    // A mouse pointer is still down if the right button remains held after the left is lifted.
    if (event.button === 0 && mousePainting) {
      finishPointerPaint(position(event));
    }
  });
  window.addEventListener("blur", () => {
    if (game.state === "playing") {
      setMenu(true);
    } else {
      clearInput();
    }
  });
  canvas.addEventListener("mousedown", (event) => {
    if (event.button === 2 && game.state === "playing") {
      event.preventDefault();
      dodge();
    }
  });
  canvas.addEventListener("contextmenu", (event) => {
    if (game.state === "playing") {
      event.preventDefault();
    }
  });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
