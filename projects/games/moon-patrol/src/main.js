import { clearPointerAim, createGame, press, release, setPointerAim, setPointerFire, update } from "./game.js";

(() => {
  const canvas = document.getElementById("game");
  const shell = document.getElementById("game-shell");
  const roverImage = document.getElementById("rover-asset");
  const hudScore = document.getElementById("hud-score");
  const hudDistance = document.getElementById("hud-distance");
  const hudIntegrity = document.getElementById("hud-integrity");
  const hudTime = document.getElementById("hud-time");
  const ctx = canvas.getContext("2d");
  const game = createGame();
  const pointer = { active: false, inside: false, x: 0, y: 0 };
  // The first animation-frame timestamp can precede script startup.
  let last = null;

  function resize() {
    const rect = shell.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.floor(rect.width));
    const cssHeight = Math.max(240, Math.floor(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const bufferWidth = Math.floor(cssWidth * pixelRatio);
    const bufferHeight = Math.floor(cssHeight * pixelRatio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }
  }

  function updateHud() {
    hudScore.textContent = `Score ${game.score}`;
    hudDistance.textContent = `Distance ${Math.floor(game.distance)}m`;
    hudIntegrity.textContent = `Integrity ${Math.max(0, Math.floor(game.rover.integrity))}`;
    hudTime.textContent = `Time ${Math.ceil(game.time)}`;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    press(event.code);
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyS", "KeyW"].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => release(event.code));
  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("pointerenter", (event) => {
    pointer.inside = true;
    updatePointer(event);
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.inside = pointer.active;
    refreshPointerAim();
  });
  canvas.addEventListener("pointerdown", (event) => {
    pointer.active = true;
    pointer.inside = true;
    setPointerFire(true);
    updatePointer(event);
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
    event.preventDefault();
  });
  canvas.addEventListener("pointerup", (event) => {
    pointer.active = false;
    pointer.inside = false;
    setPointerFire(false);
    updatePointer(event);
  });
  canvas.addEventListener("pointercancel", () => {
    pointer.active = false;
    pointer.inside = false;
    setPointerFire(false);
    clearPointerAim();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    pointer.x = (event.clientX - rect.left) * scaleX;
    pointer.y = (event.clientY - rect.top) * scaleY;
    refreshPointerAim();
  }

  function refreshPointerAim() {
    if (!pointer.inside) {
      clearPointerAim();
      return;
    }
    const player = window.MoonPatrolRender.playerScreenPosition(game, canvas);
    const x = pointer.x - player.x;
    const y = pointer.y - player.y;
    if (Math.hypot(x, y) > 6) {
      setPointerAim({ x, y });
    } else {
      clearPointerAim();
    }
  }

  function frame(now) {
    const dt = last === null ? 0 : Math.min(0.033, (now - last) / 1000);
    last = now;
    refreshPointerAim();
    update(game, dt);
    updateHud();
    window.MoonPatrolRender.render(ctx, game, canvas, roverImage);
    requestAnimationFrame(frame);
  }

  resize();
  updateHud();
  window.MoonPatrolRender.render(ctx, game, canvas, roverImage);
  canvas.focus();
  requestAnimationFrame(frame);
})();
