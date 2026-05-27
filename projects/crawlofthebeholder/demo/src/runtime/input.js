(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installInput = function (context) {
    with (context) {
      function bindInput() {
        document.querySelector(".command-strip").addEventListener("click", (event) => {
          const button = event.target.closest("button[data-action]");
          if (button) handleAction(button.dataset.action);
        });

        els.inventory.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-item]");
          if (button) useItem(button.dataset.item);
        });

        window.addEventListener("keydown", (event) => {
          const inventoryIndex = inventoryIndexForKey(event.key);
          if (inventoryIndex >= 0) {
            const item = state.inventory[inventoryIndex];
            if (!item) return;
            event.preventDefault();
            useItem(item.id);
            return;
          }

          const keyMap = {
            ArrowLeft: "turnLeft",
            a: "turnLeft",
            A: "turnLeft",
            ArrowRight: "turnRight",
            d: "turnRight",
            D: "turnRight",
            q: "moveLeft",
            Q: "moveLeft",
            e: "moveRight",
            E: "moveRight",
            ArrowUp: "moveForward",
            w: "moveForward",
            W: "moveForward",
            ArrowDown: "moveBack",
            s: "moveBack",
            S: "moveBack",
            " ": "attack",
            ">": "interact",
            "<": "interact",
            Enter: "interact",
            u: "interact",
            U: "interact",
            ",": "pickup",
            g: "pickup",
            G: "pickup",
            x: "disarm",
            X: "disarm",
            ".": "wait",
            r: "wait",
            R: "wait"
          };
          const action = keyMap[event.key];
          if (!action) return;
          event.preventDefault();
          handleAction(action);
        });

        if ("ResizeObserver" in window) {
          const viewportObserver = new ResizeObserver(() => renderViewport());
          viewportObserver.observe(els.viewport);
        } else {
          window.addEventListener("resize", () => renderViewport());
        }

      }
      Object.assign(context, {
        bindInput,
      });
    }
  };
}());
