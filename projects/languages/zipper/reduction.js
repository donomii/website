import { CURSOR, requireValue } from "./types.js?v=20261004-2";
import { blockContent, callAt, cursorPosition, definitionsBefore, nextCall } from "./syntax.js?v=20261004-2";
import { lastValue, readValue, valueText } from "./values.js?v=20261004-2";

const forms = new Set(["seq", "define", "def", "value"]);

/** @typedef {import("./types.js").Reduction} Reduction */
/** Select one rewrite, descending into eager arguments from left to right. */
function select(source, call, offset, environment, nested, argument = false) {
  const selected = { ...call, start: call.start + offset, end: call.end + offset, environment, nested, argument };
  if (call.name === "value") {
    requireValue(call.args.length === 1, "Internal value form needs one q{...} tape.");
    const body = blockContent(call.args[0], "q");
    const bodyStart = source.indexOf("{", call.start) + 1;
    const inner = nextCall(body);
    if (inner === null) {
      return { ...selected, replacement: valueText(lastValue(body)) };
    } else {
      const local = new Map([...environment, ...definitionsBefore(body, inner.start)]);
      return select(body, inner, offset + bodyStart, local, true);
    }
  } else if (argument && (forms.has(call.name) || environment.has(call.name))) {
    return { ...selected, replacement: "value(q{" + source.slice(call.start, call.end) + "})" };
  } else if (forms.has(call.name) || environment.has(call.name)) {
    return selected;
  } else {
    requireValue(call.name !== "emit" || call.args.length === 1, "emit needs exactly one value.");
    const args = [];
    let start = source.indexOf("(", call.start) + 1;
    for (const expression of call.args) {
      const trimmed = expression.trim();
      const leading = expression.length - expression.trimStart().length;
      const child = callAt(source, start + leading);
      if (child !== null) {
        requireValue(child.end === start + expression.trimEnd().length,
          "Expected one argument expression; method calls on returned objects use call(object, method, ...).");
        return select(source, child, offset, environment, true, true);
      } else {
        args.push(readValue(trimmed));
        start += expression.length + 1;
      }
    }
    return { ...selected, values: args, external: call.name !== "emit" };
  }
}

export function nextReduction(tape) {
  const call = nextCall(tape, cursorPosition(tape) + CURSOR.length);
  return call === null ? null : select(tape, call, 0, definitionsBefore(tape, call.start), false);
}
