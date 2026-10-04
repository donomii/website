import { requireValue } from "./types.js?v=20261004-2";
import { callAt, groupEnd, parseString, stringEnd } from "./syntax.js?v=20261004-2";

/** @typedef {import("./types.js").HostValue} HostValue */

/** Read a tape value without evaluating JavaScript source. */
export function readValue(source) {
  const text = source.trim();
  if (text.startsWith('"')) {
    return { kind: "literal", value: parseString(text) };
  } else if (/^ref\{[1-9][0-9]*\}$/.test(text)) {
    const id = Number(text.slice(4, -1));
    requireValue(Number.isSafeInteger(id), "Browser reference id is outside the safe integer range.");
    return { kind: "reference", id };
  } else if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(text)) {
    const value = Number(text);
    requireValue(Number.isFinite(value), "Numeric literal is outside the finite number range: " + text);
    return { kind: "literal", value };
  } else {
    const constants = new Map([["true", true], ["false", false], ["null", null],
      ["undefined", undefined], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity]]);
    requireValue(constants.has(text), "Expected a value or function call, received " + text.slice(0, 70) + ".");
    return { kind: "literal", value: constants.get(text) };
  }
}

export function valueText(result) {
  requireValue(result !== null && typeof result === "object", "Browser host returned an invalid value record.");
  if (result.kind === "reference") {
    requireValue(Number.isSafeInteger(result.id) && result.id > 0, "Browser reference must have a positive integer id.");
    return "ref{" + result.id + "}";
  } else {
    requireValue(result.kind === "literal" && (result.value === null ||
      ["string", "number", "boolean", "undefined"].includes(typeof result.value)), "Browser host returned an invalid literal.");
    return typeof result.value === "string" ? JSON.stringify(result.value) : String(result.value);
  }
}

export function outputText(value) {
  return value.kind === "reference" ? valueText(value) : value.value === undefined ? "" : String(value.value);
}

/** A completed local tape returns its last literal; definitions do not return values. */
export function lastValue(tape) {
  let position = 0;
  let result = { kind: "literal", value: undefined };
  while (position < tape.length) {
    if (/\s/u.test(tape[position])) {
      position += 1;
    } else if (tape.startsWith("def", position) && callAt(tape, position)?.name === "def") {
      position = callAt(tape, position).end;
    } else if (tape.startsWith("q{", position) || tape.startsWith("env{", position)) {
      position = groupEnd(tape, tape.indexOf("{", position));
    } else {
      const end = tape[position] === '"' ? stringEnd(tape, position) :
        position + (tape.slice(position).match(/^ref\{[1-9][0-9]*\}|^[^\s]+/)?.[0].length ?? 0);
      result = readValue(tape.slice(position, end));
      position = end;
    }
  }
  return result;
}
