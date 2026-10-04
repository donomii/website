/**
 * Shared contracts for the interpreter, browser bridge, and debugger.
 * @typedef {{name: string, args: string[], start: number, end: number}} Call
 * @typedef {{tape: string, output: string, steps: number, status: string,
 *   message: string, external: boolean}} Snapshot
 * @typedef {Call & {text: string}} Definition
 * @typedef {{id: string, title: string, description: string, source: string}} Example
 * @typedef {(code: string, signal: AbortSignal) => Promise<string>} EvaluateJavaScript
 */
export const CURSOR = "▮";

// These defaults also appear in the playground controls where users can change them.
export const DEFAULTS = Object.freeze({
  stepLimit: 500,
  delay: 350,
  maxStepLimit: 10000,
  maxTapeLength: 200000,
  maxNesting: 100,
  maxOutputLength: 100000,
  maxHistoryLength: 100,
  maxHistoryBytes: 2000000,
  browserTimeout: 10000,
  previewPort: 8796,
});

export function requireValue(condition, message) {
  if (condition) {
    return;
  } else {
    throw new Error(message);
  }
}
