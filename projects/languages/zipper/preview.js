(() => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let port = null;
  let maxOutputLength = 100000;

  function display(value) {
    if (value === undefined) {
      return "";
    } else if (typeof value === "string") {
      return value;
    } else {
      try {
        return JSON.stringify(value) ?? String(value);
      } catch {
        return String(value);
      }
    }
  }

  function sendConsole(...values) {
    port.postMessage({ type: "console", text: values.map(display).join(" ").slice(0, maxOutputLength) });
  }

  async function execute(message) {
    try {
      if (message.type !== "execute" || typeof message.code !== "string" || !Number.isInteger(message.id)) {
        throw new Error("Invalid browser request; expected JavaScript and a request number.");
      } else {
        const logger = { log: sendConsole, info: sendConsole, warn: sendConsole,
          error: sendConsole, debug: sendConsole };
        const value = await new AsyncFunction("console", message.code).call(window, logger);
        const text = display(value);
        if (text.length > maxOutputLength) {
          throw new Error("Browser result exceeds " + maxOutputLength + " characters.");
        } else {
          port.postMessage({ type: "result", id: message.id, text });
        }
      }
    } catch (error) {
      port.postMessage({ type: "error", id: message.id, error: error?.message ?? String(error) });
    }
  }

  window.addEventListener("message", event => {
    if (event.source === parent && event.data?.type === "zipper:init" && event.ports.length === 1 && port === null) {
      port = event.ports[0];
      maxOutputLength = event.data.maxOutputLength;
      port.onmessage = event => { void execute(event.data); };
      port.postMessage({ type: "ready" });
    } else {
      return;
    }
  });
})();
