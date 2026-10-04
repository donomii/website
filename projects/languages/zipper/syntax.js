import { CURSOR, DEFAULTS, requireValue } from "./types.js";

/** @typedef {import("./types.js").Call} Call */
const identifier = /^[\p{L}_][\p{L}\p{N}_-]*/u;
const identifierWhole = /^[\p{L}_][\p{L}\p{N}_-]*$/u;

export function validName(name) {
  return identifierWhole.test(name);
}

export function stringEnd(text, start) {
  let position = start + 1;
  while (position < text.length) {
    if (text[position] === "\\") {
      position += 2;
    } else if (text[position] === '"') {
      return position + 1;
    } else {
      position += 1;
    }
  }
  throw new Error(`Unclosed string at character ${start + 1}; expected a closing double quote.`);
}

export function groupEnd(text, start) {
  const stack = [];
  let position = start;
  while (position < text.length) {
    const character = text[position];
    if (character === '"') {
      position = stringEnd(text, position);
    } else if (character === "(" || character === "{") {
      stack.push(character === "(" ? ")" : "}");
      requireValue(stack.length <= DEFAULTS.maxNesting, `Code nesting exceeds ${DEFAULTS.maxNesting} levels.`);
      position += 1;
    } else if (character === ")" || character === "}") {
      requireValue(stack.pop() === character, `Unexpected ${character} at character ${position + 1}; check balanced brackets.`);
      if (stack.length === 0) {
        return position + 1;
      } else {
        position += 1;
      }
    } else {
      position += 1;
    }
  }
  throw new Error(`Unclosed block at character ${start + 1}; expected ${stack.at(-1)}.`);
}

export function parseString(source) {
  const text = source.trim();
  requireValue(text.startsWith('"') && stringEnd(text, 0) === text.length,
    `Expected one double-quoted string, received ${text.slice(0, 70)}.`);
  return text.slice(1, -1).replace(/\\([\s\S])/g, (_, character) => {
    switch (character) {
      case "n": return "\n";
      case "t": return "\t";
      default: return character;
    }
  });
}

export function blockContent(source, kind) {
  const text = source.trim();
  requireValue(text.startsWith(kind + "{"), `Expected ${kind}{...}, received ${text.slice(0, 70)}.`);
  requireValue(groupEnd(text, kind.length) === text.length, `Unexpected text after ${kind}{...} block.`);
  return text.slice(kind.length + 1, -1);
}

export function splitArgs(text) {
  const args = [];
  let start = 0;
  let position = 0;
  while (position < text.length) {
    const character = text[position];
    if (character === '"') {
      position = stringEnd(text, position);
    } else if (character === "(" || character === "{") {
      position = groupEnd(text, position);
    } else if (character === ",") {
      requireValue(text.slice(start, position).trim() !== "", "Empty argument before comma; supply an expression.");
      args.push(text.slice(start, position));
      start = ++position;
    } else {
      requireValue(character !== ")" && character !== "}", `Unexpected ${character} in argument list.`);
      position += 1;
    }
  }
  const last = text.slice(start);
  requireValue(args.length === 0 || last.trim() !== "", "Trailing comma; supply an argument after the comma.");
  return last.trim() === "" ? args : [...args, last];
}

/** @returns {Call | null} */
export function callAt(text, start) {
  const match = text.slice(start).match(identifier);
  if (match === null) {
    return null;
  } else {
    const name = match[0];
    let open = start + name.length;
    while (/\s/u.test(text[open] ?? "") && open < text.length) {
      open += 1;
    }
    if (text[open] !== "(") {
      return null;
    } else {
      const end = groupEnd(text, open);
      return { name, args: splitArgs(text.slice(open + 1, end - 1)), start, end };
    }
  }
}

/** Strings and quoted/environment blocks are data, never hidden executable calls. */
export function nextCall(text, from = 0, includeDefinitions = false) {
  let position = from;
  while (position < text.length) {
    if (text[position] === '"') {
      position = stringEnd(text, position);
    } else if (text.startsWith("q{", position) || text.startsWith("env{", position)) {
      position = groupEnd(text, text.indexOf("{", position));
    } else {
      const match = text.slice(position).match(identifier);
      const call = match === null ? null : callAt(text, position);
      if (call !== null && (includeDefinitions || call.name !== "def")) {
        return call;
      } else {
        position = call?.end ?? position + (match?.[0].length ?? 1);
      }
    }
  }
  return null;
}

/** Only completed top-level records count; quoted and captured definitions stay inert. */
export function definitionsBefore(tape, before) {
  const found = [];
  let position = 0;
  let call = nextCall(tape, position, true);
  while (call !== null && call.end <= before) {
    if (call.name === "def") {
      found.push({ ...call, text: tape.slice(call.start, call.end) });
    } else {
      position = call.end;
    }
    position = call.end;
    call = nextCall(tape, position, true);
  }
  const nearest = new Map();
  for (const definition of found.reverse()) {
    const name = definition.args[0]?.trim();
    requireValue(name !== undefined && validName(name), "Invalid def record; expected a function name.");
    if (nearest.has(name)) {
      continue;
    } else {
      nearest.set(name, definition);
    }
  }
  return nearest;
}

export function environmentDefinitions(source) {
  const inner = blockContent(source, "env");
  const definitions = [];
  let position = 0;
  while (position < inner.length) {
    if (/\s/u.test(inner[position])) {
      position += 1;
    } else {
      const call = callAt(inner, position);
      requireValue(call !== null && call.name === "def", "An env{...} block may contain only def(...) records.");
      definitions.push(inner.slice(call.start, call.end));
      position = call.end;
    }
  }
  return definitions;
}

export function cursorPosition(tape) {
  let found = -1;
  let position = 0;
  while (position < tape.length) {
    if (tape[position] === '"') {
      position = stringEnd(tape, position);
    } else if (tape.startsWith("q{", position) || tape.startsWith("env{", position)) {
      position = groupEnd(tape, tape.indexOf("{", position));
    } else if (tape[position] === CURSOR) {
      requireValue(found === -1, "A program may contain at most one ▮ cursor.");
      found = position++;
    } else {
      position += 1;
    }
  }
  return found;
}

function validateRecord(call) {
  requireValue(call.args.length >= 3, "A def record needs a name, quoted body, and captured environment.");
  const names = call.args.slice(0, -2).map(name => name.trim());
  requireValue(names.every(validName) && new Set(names).size === names.length,
    "A def record needs distinct, valid function and parameter names.");
  blockContent(call.args.at(-2), "q");
  environmentDefinitions(call.args.at(-1));
}

function validateCalls(text) {
  let position = 0;
  while (position < text.length) {
    if (text[position] === '"') {
      position = stringEnd(text, position);
    } else {
      const match = text.slice(position).match(identifier);
      if (match === null) {
        position += 1;
      } else {
        // Parse every call's argument separators, including delayed bodies.
        const call = callAt(text, position);
        if (call?.name === "def") {
          validateRecord(call);
        } else if (match[0] === "env" && text[position + 3] === "{") {
          environmentDefinitions(text.slice(position, groupEnd(text, position + 3)));
        } else {
          position += match[0].length;
          continue;
        }
        position += match[0].length;
      }
    }
  }
}

export function validateTape(source, requireCursor = false) {
  requireValue(typeof source === "string", "A program must be a string.");
  requireValue(source.length <= DEFAULTS.maxTapeLength, `Tape exceeds ${DEFAULTS.maxTapeLength} characters.`);
  const markers = cursorPosition(source) < 0 ? 0 : 1;
  requireValue(markers <= 1 && (!requireCursor || markers === 1),
    requireCursor ? "The edited tape must contain exactly one ▮ cursor." : "A program may contain at most one ▮ cursor.");
  const tape = markers === 0 ? CURSOR + source : source;
  const activeCursor = cursorPosition(tape);
  let position = 0;
  while (position < tape.length) {
    const character = tape[position];
    if (character === '"') {
      position = stringEnd(tape, position);
    } else if (character === "(" || character === "{") {
      const end = groupEnd(tape, position);
      const cursor = activeCursor;
      requireValue(cursor <= position || cursor >= end, "The ▮ cursor must be between top-level tape expressions.");
      position = end;
    } else {
      requireValue(character !== ")" && character !== "}", `Unexpected ${character} at character ${position + 1}.`);
      position += 1;
    }
  }
  validateCalls(tape);
  return tape;
}
