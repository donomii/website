(() => {
  let port = null;
  let maxOutputLength = 100000;
  let maxReferences = 10000;
  const references = new Map();
  const ids = new Map();

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

  function decode(record) {
    if (record?.kind === "reference" && references.has(record.id)) {
      return references.get(record.id);
    } else if (record?.kind === "literal" && (record.value === null ||
      ["string", "number", "boolean", "undefined"].includes(typeof record.value))) {
      return record.value;
    } else {
      throw new Error("Invalid or expired browser value; Reset and rerun the program.");
    }
  }

  function encode(value) {
    if (value === null || ["string", "number", "boolean", "undefined"].includes(typeof value)) {
      if (typeof value === "string" && value.length > maxOutputLength) {
        throw new Error("Browser result exceeds " + maxOutputLength + " characters.");
      } else {
        return { kind: "literal", value };
      }
    } else if (ids.has(value)) {
      return { kind: "reference", id: ids.get(value) };
    } else {
      if (references.size >= maxReferences) {
        throw new Error("Browser reference limit reached; Reset starts a fresh page.");
      } else {
        const id = references.size + 1;
        references.set(id, value);
        ids.set(value, id);
        return { kind: "reference", id };
      }
    }
  }

  function resolve(name) {
    if (!/^[\p{L}_][\p{L}\p{N}_-]*(?:\.[\p{L}_][\p{L}\p{N}_-]*)*$/u.test(name)) {
      throw new Error("Invalid JavaScript function name: " + name);
    } else {
      const parts = name.split(".");
      let receiver = window;
      for (const part of parts.slice(0, -1)) {
        receiver = Reflect.get(receiver, part);
      }
      const method = Reflect.get(receiver, parts.at(-1));
      if (typeof method !== "function") {
        throw new Error("Unresolved function " + name + ": no callable JavaScript function exists.");
      } else {
        return { receiver, method };
      }
    }
  }

  async function execute(message) {
    try {
      if (message.type !== "execute" || typeof message.name !== "string" ||
        !Array.isArray(message.args) || !Number.isSafeInteger(message.id)) {
        throw new Error("Invalid browser request; expected a function name, argument values, and request number.");
      } else {
        const args = message.args.map(decode);
        const { receiver, method } = resolve(message.name);
        const result = await Reflect.apply(method, receiver, args);
        port.postMessage({ type: "result", id: message.id, value: encode(result) });
      }
    } catch (error) {
      port.postMessage({ type: "error", id: message.id, error: error?.message ?? String(error) });
    }
  }

  // A method call needs its owning object as this, including DOM and Response methods.
  window.call = (receiver, name, ...args) => {
    if (typeof name !== "string" || typeof Reflect.get(receiver, name) !== "function") {
      throw new Error("call expects an object and the name of one of its methods.");
    } else {
      return Reflect.apply(Reflect.get(receiver, name), receiver, args);
    }
  };
  for (const name of ["log", "info", "warn", "error", "debug"]) {
    console[name] = sendConsole;
  }

  window.addEventListener("message", event => {
    if (event.source === parent && event.data?.type === "zipper:init" && event.ports.length === 1 && port === null) {
      port = event.ports[0];
      maxOutputLength = event.data.maxOutputLength;
      maxReferences = event.data.maxHostReferences;
      port.onmessage = event => { void execute(event.data); };
      port.postMessage({ type: "ready" });
    } else {
      return;
    }
  });
})();
