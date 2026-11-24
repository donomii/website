(() => {
  const root = new URL(".", document.currentScript.src);
  const map = new URL("index.html", root);
  const onMap = [root.pathname, map.pathname].includes(location.pathname);
  const readPads = navigator.getGamepads?.bind(navigator) ?? (() => []);
  const handoffKey = "game-deck-controller-handoff";
  const controllerButtons = [0, 1, 3, 8, 12, 13, 14, 15];
  const controlRows = {
    "cinder-circuit": ".rail",
    "hadal-drift": "#dive-actions",
    "brushwork": "#hud .actions",
    "crawlofthebeholder": ".topbar .brand",
    "evilempires": ".app-bar",
    "greenwave": ".experiment-nav",
  };
  let waitingForRelease = false;
  let handoffUntil = 0;
  try {
    handoffUntil = Number(sessionStorage.getItem(handoffKey)) || 0;
    sessionStorage.removeItem(handoffKey);
  } catch (error) {
    if (error.name !== "SecurityError") throw error;
  }
  waitingForRelease = handoffUntil > Date.now();

  const catalogue = fetch(new URL("catalogue.json", root))
    .then(async response => {
      if (!response.ok) throw new Error(`Games catalogue returned HTTP ${response.status}`);
      return response.json();
    });
  catalogue.catch(error => console.error(error));

  let dialog;
  let links;
  let confirm;
  let title;
  let launcher;
  let restoreFocus;
  let selection = 0;
  let generation = 0;
  const buttonWasDown = new Map();
  let repeatDirection = 0;
  let repeatAt = 0;

  const busy = () => Boolean(dialog?.open || waitingForRelease);
  const safePads = () => {
    const pads = readPads();
    return busy() ? Array.from(pads, () => null) : pads;
  };
  if (navigator.getGamepads) {
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: safePads });
  }

  function navigate(url) {
    try {
      sessionStorage.setItem(handoffKey, String(Date.now() + 2500));
    } catch (error) {
      if (error.name !== "SecurityError" && error.name !== "QuotaExceededError") throw error;
    }
    location.assign(url);
  }

  function focusEntry(index) {
    const entries = links.querySelectorAll("a");
    if (entries.length) {
      entries[selection]?.removeAttribute("data-selected");
      selection = (index + entries.length) % entries.length;
      entries[selection].setAttribute("data-selected", "");
      entries[selection].focus({ preventScroll: true });
      entries[selection].scrollIntoView({ block: "nearest" });
    }
    confirm.disabled = !entries.length;
  }

  function close() {
    dialog.close();
    generation += 1;
    waitingForRelease = true;
    restoreFocus?.focus({ preventScroll: true });
  }

  async function open(group) {
    if (!dialog.open) {
      restoreFocus = document.activeElement;
      // A press that docks the airship must be released before it can open a link.
      const pads = Array.from(readPads()).filter(pad => pad?.connected);
      controllerButtons.forEach(index => buttonWasDown.set(index, pads.some(pad => pad.buttons[index]?.pressed)));
      // Games already clear held keys and pause as appropriate when they lose focus.
      window.dispatchEvent(new Event("blur"));
      dialog.showModal();
    }
    const ticket = ++generation;
    selection = 0;
    confirm.disabled = true;
    title.textContent = group?.name ?? "Games";
    const status = document.createElement("p");
    status.textContent = "Loading games…";
    links.replaceChildren(status);

    try {
      const groups = group ? [group] : await catalogue;
      if (ticket !== generation) return;
      const destinations = groups.flatMap(item => item.games);
      let current = 0;
      links.replaceChildren(...destinations.map((destination, index) => {
        const anchor = document.createElement("a");
        anchor.href = destination.url;
        anchor.textContent = destination.name;
        if (anchor.href === location.href) {
          anchor.setAttribute("aria-current", "page");
          current = index;
        }
        anchor.addEventListener("click", event => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            navigate(anchor.href);
          }
        });
        return anchor;
      }));
      focusEntry(current);
    } catch (error) {
      if (ticket !== generation) return;
      status.textContent = "Couldn’t load the games list.";
    }
  }

  function tick(now) {
    const pads = Array.from(readPads()).filter(pad => pad?.connected);
    const down = index => pads.some(pad => pad.buttons[index]?.pressed);
    const pressed = index => down(index) && !buttonWasDown.get(index);
    const moving = pads.some(pad => Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.55);
    waitingForRelease = waitingForRelease && (moving || controllerButtons.some(down));

    if (pressed(8) && dialog.open) {
      close();
    } else if (pressed(8) && !waitingForRelease) {
      void open();
    } else if (dialog.open) {
      const up = down(12) || pads.some(pad => pad.axes[1] < -0.55);
      const lower = down(13) || pads.some(pad => pad.axes[1] > 0.55);
      const direction = Number(lower) - Number(up);
      if (direction && (direction !== repeatDirection || now >= repeatAt)) {
        focusEntry(selection + direction);
        repeatAt = now + (direction === repeatDirection ? 115 : 290);
      }
      repeatDirection = direction;
      if (pressed(1)) close();
      else if (pressed(3) && !onMap) navigate(map.href);
      else if (pressed(0)) links.querySelectorAll("a")[selection]?.click();
    } else {
      repeatDirection = 0;
    }

    controllerButtons.forEach(index => buttonWasDown.set(index, down(index)));
    requestAnimationFrame(tick);
  }

  function mount() {
    launcher = document.querySelector("[data-deck-games]") ?? document.createElement("button");
    if (!launcher.isConnected) {
      launcher.type = "button";
      launcher.className = "game-deck-trigger";
      launcher.textContent = "Games";
      const game = location.pathname.match(/^\/projects\/games\/([^/]+)\//)?.[1];
      const row = controlRows[game] && document.querySelector(controlRows[game]);
      if (row) {
        launcher.classList.add("game-deck-inline");
        row.append(launcher);
      } else {
        if (game === "kingdomcrown" || location.pathname === "/static/courtyard/index.html") {
          launcher.classList.add("game-deck-beside-menu");
        }
        document.body.append(launcher);
      }
    }
    launcher.setAttribute("aria-keyshortcuts", "F2");
    launcher.setAttribute("aria-haspopup", "dialog");
    const badge = document.createElement("span");
    badge.className = "game-deck-key";
    badge.textContent = "View";
    badge.setAttribute("aria-hidden", "true");
    launcher.prepend(badge);
    launcher.addEventListener("click", () => void open());

    dialog = document.createElement("dialog");
    dialog.className = "game-deck-dialog";
    dialog.setAttribute("aria-labelledby", "game-deck-title");
    dialog.innerHTML = `
      <h2 id="game-deck-title">Games</h2>
      <nav aria-label="Games"></nav>
      <footer>
        ${onMap ? "" : '<button type="button" data-deck-map><span aria-hidden="true">△</span> Map</button>'}
        <button type="button" data-deck-confirm><span aria-hidden="true">×</span> Open</button>
        <button type="button" data-deck-close><span aria-hidden="true">○</span> Back</button>
      </footer>`;
    links = dialog.querySelector("nav");
    links.addEventListener("focusin", event => {
      const entries = [...links.querySelectorAll("a")];
      const index = entries.indexOf(event.target);
      if (index >= 0) {
        entries[selection]?.removeAttribute("data-selected");
        selection = index;
        entries[selection].setAttribute("data-selected", "");
      }
    });
    title = dialog.querySelector("h2");
    confirm = dialog.querySelector("[data-deck-confirm]");
    confirm.addEventListener("click", () => links.querySelectorAll("a")[selection]?.click());
    dialog.querySelector("[data-deck-map]")?.addEventListener("click", () => navigate(map.href));
    dialog.querySelector("[data-deck-close]").addEventListener("click", close);
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    document.body.append(dialog);

    window.addEventListener("keydown", event => {
      if (event.code === "F2" && !event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (dialog.open) close();
        else void open();
      } else if (dialog.open) {
        event.stopImmediatePropagation();
        if (event.code === "Escape") {
          event.preventDefault();
          close();
        } else if (event.code === "ArrowUp" || event.code === "ArrowDown") {
          event.preventDefault();
          focusEntry(selection + (event.code === "ArrowUp" ? -1 : 1));
        }
      }
    }, true);
    requestAnimationFrame(tick);
  }

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("deck.css", root);
  document.head.append(style);
  window.GameDeck = { catalogue, open, navigate, busy };
  document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
