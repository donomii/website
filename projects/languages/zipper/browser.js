import { DEFAULTS, requireValue } from "./types.js";

/** Owns a fresh, isolated page and one private message channel per reset. */
export class BrowserBridge {
  constructor(container, onConsole = () => {}) {
    this.container = container;
    this.onConsole = onConsole;
    this.pending = new Map();
    this.sequence = 0;
    this.port = null;
    this.reset();
  }

  reset(reason = "The live page was reset.") {
    for (const request of this.pending.values()) {
      request.finish(new Error(reason));
    }
    this.port?.close();
    this.ready = false;
    const frame = document.createElement("iframe");
    frame.title = "Live page controlled by your Zipper program";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.src = new URL("./preview.html", import.meta.url).href;
    frame.addEventListener("load", () => this.connect(frame), { once: true });
    this.frame = frame;
    this.container.replaceChildren(frame);
  }

  connect(frame) {
    if (frame !== this.frame) {
      return;
    } else {
      const channel = new MessageChannel();
      this.port = channel.port1;
      this.port.onmessage = event => {
        if (frame === this.frame) {
          this.receive(event.data);
        } else {
          return;
        }
      };
      frame.contentWindow.postMessage({ type: "zipper:init", maxOutputLength: DEFAULTS.maxOutputLength },
        "*", [channel.port2]);
    }
  }

  receive(message) {
    if (message?.type === "ready") {
      this.ready = true;
      for (const request of this.pending.values()) {
        this.port.postMessage({ type: "execute", id: request.id, code: request.code });
      }
    } else if (message?.type === "console" && typeof message.text === "string") {
      this.onConsole(message.text.slice(0, DEFAULTS.maxOutputLength));
    } else {
      const request = this.pending.get(message?.id);
      if (request === undefined) {
        return;
      } else if (message.type === "result" && typeof message.text === "string") {
        request.finish(null, message.text);
      } else {
        request.finish(new Error(typeof message.error === "string" ? message.error : "Invalid response from the browser page."));
      }
    }
  }

  evaluate(code, signal) {
    requireValue(typeof code === "string", "Browser code must be a string.");
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const abort = () => finish(new Error("Browser call cancelled by Reset."));
      const timer = setTimeout(() => this.reset(
        `Browser call exceeded ${DEFAULTS.browserTimeout / 1000} seconds. The live page was reset.`),
      DEFAULTS.browserTimeout);
      const finish = (error, value = "") => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        this.pending.delete(id);
        if (error === null) {
          resolve(value);
        } else {
          reject(error);
        }
      };
      this.pending.set(id, { id, code, finish });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
      } else if (this.ready) {
        this.port.postMessage({ type: "execute", id, code });
      } else {
        return;
      }
    });
  }
}
