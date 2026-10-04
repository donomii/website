/** @typedef {import("./types.js").Example} Example */
export const examples = [
  {
    id: "hello",
    title: "01 · Hello, browser",
    description: "Print a greeting, change the live page, then give it a new colour.",
    source: `seq(
  emit("Hello, browser!\\n"),
  js("document.querySelector('#message').textContent = 'I was changed by a Zipper program.'"),
  js("document.querySelector('#card').style.background = '#dfff85'")
)`,
  },
  {
    id: "functions",
    title: "02 · Make a function",
    description: "Arguments are little programs. Calling who() runs the argument where it is needed.",
    source: `seq(
  define(greet, who, q{
    seq(emit("Hello, "), who(), emit("!\\n"))
  }),
  greet(emit("Jeremy")),
  greet(emit("world"))
)`,
  },
  {
    id: "lazy",
    title: "03 · Do it twice",
    description: "The same delayed argument can run more than once. Watch it expand on the tape.",
    source: `seq(
  define(twice, action, q{ seq(action(), action()) }),
  twice(emit("Again!\\n")),
  twice(js("const list = document.querySelector('#items'); const item = document.createElement('li'); item.textContent = 'Added by Zipper'; list.append(item)"))
)`,
  },
  {
    id: "canvas",
    title: "04 · Draw on a canvas",
    description: "Use the browser canvas API from Zipper. Each js call is one visible step.",
    source: `seq(
  js("document.querySelector('#heading').textContent = 'A tiny landscape'"),
  js("const canvas = document.querySelector('#drawing'); canvas.style.display = 'block'; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#dcece5'; ctx.fillRect(0, 0, 400, 150)"),
  js("const ctx = document.querySelector('#drawing').getContext('2d'); ctx.fillStyle = '#174d39'; ctx.beginPath(); ctx.moveTo(0,150); ctx.lineTo(125,25); ctx.lineTo(250,150); ctx.fill()"),
  js("const ctx = document.querySelector('#drawing').getContext('2d'); ctx.fillStyle = '#dfff85'; ctx.beginPath(); ctx.arc(310,42,24,0,Math.PI*2); ctx.fill()"),
  emit("A landscape in four browser calls.\\n")
)`,
  },
  {
    id: "fetch",
    title: "05 · Fetch some data",
    description: "Await the browser's fetch API. This example uses a built-in data URL, so it also works offline.",
    source: `seq(
  emit("Reading a JSON response...\\n"),
  js("const response = await fetch('data:application/json,%7B%22message%22%3A%22Hello%20from%20fetch!%22%7D'); if (!response.ok) { throw new Error('HTTP ' + response.status); } else { const data = await response.json(); document.querySelector('#message').textContent = data.message; return data.message; }"),
  emit("\\nDone.\\n")
)`,
  },
  {
    id: "closure",
    title: "06 · Remember a definition",
    description: "A function keeps the definitions that existed when it was created.",
    source: `seq(
  define(colour, q{ emit("green") }),
  define(remember, q{ colour() }),
  define(colour, q{ emit("purple") }),
  remember(),
  emit(" — the captured definition.\\n")
)`,
  },
];
