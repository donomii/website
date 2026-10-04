import { CURSOR } from "./types.js?v=20261004-2";
import { cursorPosition } from "./syntax.js?v=20261004-2";

export function elements(root) {
  return Object.fromEntries([...root.querySelectorAll("[id]")].map(element =>
    [element.id.replace("zl-", "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), element]));
}

export function drawTape(target, machine) {
  const text = machine.tape;
  const cursor = cursorPosition(text);
  let next = null;
  try {
    next = machine.next;
  } catch {
    next = null;
  }
  const fragments = [];
  const points = [...new Set([0, text.length, cursor, cursor + CURSOR.length,
    next?.start ?? text.length, next?.end ?? text.length])].sort((a, b) => a - b);
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const span = document.createElement(start === next?.start ? "mark" : "span");
    span.textContent = text.slice(start, end);
    span.className = start === cursor ? "zl-cursor" : "";
    fragments.push(span);
  }
  target.replaceChildren(...fragments);
  return next;
}

export function updateView(ui, machine, { running, busy, dirty, editing }) {
  const next = drawTape(ui.tape, machine);
  const label = running ? "Running" : ({ ready: "Ready", halted: "Finished", error: "Error",
    waiting: "Browser call", limit: "Step limit" }[machine.status]);
  ui.status.textContent = dirty ? "Edited" : label;
  ui.status.dataset.status = machine.status;
  ui.stepCount.textContent = machine.steps + (machine.steps === 1 ? " rewrite" : " rewrites");
  ui.message.textContent = dirty ? "Your edits will start from the beginning on Run or Step." : machine.message;
  ui.next.textContent = next === null ? "No call remaining" : "Next: " + next.name + "(…)";
  ui.output.textContent = machine.output;
  ui.outputCount.textContent = machine.output.length + " characters";
  ui.run.innerHTML = running ? '<span aria-hidden="true">Ⅱ</span> Pause' : '<span aria-hidden="true">▶</span> Run';
  ui.run.disabled = editing || (!running && busy);
  ui.step.disabled = editing || busy || running || (!dirty && ["halted", "error", "limit"].includes(machine.status));
  ui.back.disabled = editing || busy || running || dirty || !machine.canBack;
  ui.editTape.disabled = editing || busy || running || dirty;
  ui.source.readOnly = editing || busy || running;
  ui.source.setAttribute("aria-readonly", String(ui.source.readOnly));
  ui.load.disabled = busy || running;
  ui.example.disabled = busy || running;
}

export function updateLines(ui) {
  const count = ui.source.value.split("\n").length;
  ui.lines.textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n");
  ui.lines.scrollTop = ui.source.scrollTop;
}
