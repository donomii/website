import { CURSOR, DEFAULTS, requireValue } from "./types.js";
import { blockContent, cursorPosition, definitionsBefore, environmentDefinitions, nextCall,
  parseString, validName, validateTape } from "./syntax.js";

/** @typedef {import("./types.js").Call} Call */
/** @typedef {import("./types.js").Snapshot} Snapshot */
const reserved = new Set(["seq", "emit", "define", "def", "js"]);

function sequence(args) {
  switch (args.length) {
    case 0: return "";
    case 1: return args[0];
    default: return args[0] + "\nseq(" + args.slice(1).join(",") + ")";
  }
}

function define(tape, call) {
  requireValue(call.args.length >= 2, "define needs a name, optional parameters, and q{body}.");
  const names = call.args.slice(0, -1).map(name => name.trim());
  requireValue(names.every(validName), "Function and parameter names must be identifiers.");
  requireValue(names.every(name => !reserved.has(name)), "Built-in names cannot be used for functions or parameters.");
  requireValue(new Set(names).size === names.length, "Function and parameter names must be distinct.");
  blockContent(call.args.at(-1), "q");
  const captured = [...definitionsBefore(tape, call.start).values()].map(item => item.text);
  return "def(" + [...names, call.args.at(-1), "env{" + captured.join(" ") + "}"].join(",") + ")";
}

function expand(tape, call) {
  const definition = definitionsBefore(tape, call.start).get(call.name);
  requireValue(definition !== undefined, `Unknown function "${call.name}" at character ${call.start + 1}; define it before calling it.`);
  requireValue(definition.args.length >= 3, `Invalid def record for ${call.name}; expected a body and environment.`);
  const params = definition.args.slice(1, -2).map(name => name.trim());
  requireValue(params.every(validName) && new Set(params).size === params.length,
    `Invalid parameters in def(${call.name}, ...).`);
  requireValue(params.length === call.args.length,
    `${call.name} expects ${params.length} argument(s), received ${call.args.length}.`);
  const body = blockContent(definition.args.at(-2), "q");
  const environment = environmentDefinitions(definition.args.at(-1));
  const bindings = params.map((name, index) => `def(${name},q{${call.args[index]}},env{})`);
  const expressions = body.trim() === "" ? [] : [body];
  return environment.length + bindings.length === 0 ? body : "seq(" + [...environment, ...bindings, ...expressions].join(",") + ")";
}

function rewrite(tape, call) {
  switch (call.name) {
    case "seq": return sequence(call.args);
    case "define": return define(tape, call);
    default: return expand(tape, call);
  }
}

/** A resumable interpreter. All browser access is supplied explicitly by the host. */
export class Zipper {
  constructor(source, { evaluateJavaScript = null, stepLimit = DEFAULTS.stepLimit } = {}) {
    this.evaluateJavaScript = evaluateJavaScript;
    this.generation = 0;
    this.pending = null;
    this.setStepLimit(stepLimit);
    this.reset(source);
  }

  setStepLimit(limit) {
    requireValue(Number.isInteger(limit) && limit >= 1 && limit <= DEFAULTS.maxStepLimit,
      `Step limit must be a whole number from 1 to ${DEFAULTS.maxStepLimit}.`);
    this.stepLimit = limit;
    if (this.status === "limit" && this.steps < limit) {
      this.status = "ready";
      this.message = "Step limit raised. Continue with Run or Step.";
    } else {
      return;
    }
  }

  reset(source) {
    const tape = validateTape(source);
    this.pending?.abort();
    this.generation += 1;
    this.pending = null;
    this.tape = tape;
    this.output = "";
    this.steps = 0;
    this.history = [];
    this.historyBytes = 0;
    this.status = "ready";
    this.message = "Ready. Step through the first call or run the program.";
    return this.snapshot();
  }

  get next() {
    return nextCall(this.tape, cursorPosition(this.tape) + CURSOR.length);
  }

  get canBack() {
    return this.pending === null && this.history.length > 0 && !this.history.at(-1).external;
  }

  snapshot(external = false) {
    return { tape: this.tape, output: this.output, steps: this.steps,
      status: this.status, message: this.message, external };
  }

  remember(snapshot) {
    this.history.push(snapshot);
    this.historyBytes += 2 * (snapshot.tape.length + snapshot.output.length);
    while (this.history.length > DEFAULTS.maxHistoryLength || this.historyBytes > DEFAULTS.maxHistoryBytes) {
      const oldest = this.history.shift();
      this.historyBytes -= 2 * (oldest.tape.length + oldest.output.length);
    }
  }

  back() {
    requireValue(this.canBack, "Cannot rewind this step. Browser effects cannot be undone; Reset starts a fresh page.");
    const snapshot = this.history.pop();
    this.historyBytes -= 2 * (snapshot.tape.length + snapshot.output.length);
    Object.assign(this, { tape: snapshot.tape, output: snapshot.output, steps: snapshot.steps,
      status: "ready", message: "Rewound one rewrite. Run or Step continues from here." });
    return this.snapshot();
  }

  editTape(source) {
    requireValue(this.pending === null, "Wait for the current step or Reset before editing the tape.");
    const tape = validateTape(source, true);
    this.remember(this.snapshot());
    this.tape = tape;
    this.status = "ready";
    this.message = "Tape edited. Output and browser effects are preserved.";
    return this.snapshot();
  }

  async browserCall(call, signal) {
    requireValue(call.args.length === 1, "js needs exactly one double-quoted JavaScript string.");
    const code = parseString(call.args[0]);
    requireValue(this.evaluateJavaScript !== null, "js requires a browser host. Open the playground to use browser calls.");
    this.status = "waiting";
    this.message = "Waiting for JavaScript. Reset cancels this page.";
    return await this.evaluateJavaScript(code, signal);
  }

  commit(call, replacement, emitted, literal) {
    const cursor = cursorPosition(this.tape);
    const prefix = this.tape.slice(0, cursor) + this.tape.slice(cursor + CURSOR.length, call.start);
    const suffix = this.tape.slice(call.end);
    // Emitted text is quoted on the tape, so printed code remains literal data.
    const inserted = literal ? (emitted === "" ? "" : JSON.stringify(emitted)) + CURSOR : CURSOR + replacement;
    const tape = prefix + inserted + suffix;
    requireValue(tape.length <= DEFAULTS.maxTapeLength, `Rewrite exceeds the ${DEFAULTS.maxTapeLength}-character tape limit.`);
    requireValue(this.output.length + emitted.length <= DEFAULTS.maxOutputLength,
      `Output exceeds the ${DEFAULTS.maxOutputLength}-character output limit.`);
    this.tape = tape;
    this.output += emitted;
    this.steps += 1;
    this.status = "ready";
    this.message = `Rewrote ${call.name}(…).`;
  }

  async reduce(call, signal) {
    if (call.name === "emit") {
      requireValue(call.args.length === 1, "emit needs exactly one double-quoted string.");
      return { replacement: "", emitted: parseString(call.args[0]), literal: true };
    } else if (call.name === "js") {
      const emitted = await this.browserCall(call, signal);
      requireValue(typeof emitted === "string", "The JavaScript host must return a string result.");
      return { replacement: "", emitted, literal: true };
    } else {
      return { replacement: rewrite(this.tape, call), emitted: "", literal: false };
    }
  }

  async step() {
    requireValue(this.pending === null, "A step is already in progress.");
    if (this.status === "halted" || this.status === "error") {
      return this.snapshot();
    } else {
      return await this.performStep();
    }
  }

  async performStep() {
    const generation = this.generation;
    const before = this.snapshot();
    try {
      const call = this.next;
      if (call === null) {
        this.status = "halted";
        this.message = "Finished. No calls remain to the right of the cursor.";
      } else if (this.steps >= this.stepLimit) {
        this.status = "limit";
        this.message = `Paused at ${this.stepLimit} rewrites. Raise the step limit to continue.`;
      } else {
        before.external = call.name === "js";
        this.pending = new AbortController();
        const result = await this.reduce(call, this.pending.signal);
        if (generation !== this.generation) {
          return this.snapshot();
        } else {
          this.commit(call, result.replacement, result.emitted, result.literal);
          this.remember(before);
          this.finishStep();
        }
      }
    } catch (error) {
      if (generation !== this.generation) {
        return this.snapshot();
      } else {
        this.status = "error";
        this.message = error?.message ?? String(error);
        if (this.history.at(-1) !== before) {
          this.remember(before);
        } else {
          this.message = "The rewrite completed, but the next call is invalid: " + (error?.message ?? String(error));
        }
      }
    }
    this.pending = null;
    return this.snapshot();
  }

  finishStep() {
    if (this.next === null) {
      this.status = "halted";
      this.message = "Finished. No calls remain to the right of the cursor.";
    } else if (this.steps >= this.stepLimit) {
      this.status = "limit";
      this.message = `Paused at ${this.stepLimit} rewrites. Raise the step limit to continue.`;
    } else {
      return;
    }
  }
}
