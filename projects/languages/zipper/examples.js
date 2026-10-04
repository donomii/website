/** @typedef {import("./types.js").Example} Example */
export const examples = [
  {
    id: "hello",
    title: "01 · Hello, browser",
    description: "Zipper sequences the work. Unresolved calls go straight to the browser.",
    source: `seq(
  emit("Hello, browser!\\n"),
  Reflect.set(document.querySelector("#message"),
    "textContent", "I was changed by a Zipper program."),
  Reflect.set(Reflect.get(document.querySelector("#card"), "style"),
    "background", "#dfff85")
)`,
  },
  {
    id: "functions",
    title: "02 · Make a function",
    description: "A Zipper argument is a delayed program. Here who() supplies a value to emit.",
    source: `seq(
  define(greet, who, q{
    seq(emit("Hello, "), emit(who()), emit("!\\n"))
  }),
  greet("Jeremy"),
  greet("world")
)`,
  },
  {
    id: "lazy",
    title: "03 · Do it twice",
    description: "Zipper repeats a delayed action. Browser methods run only when that action is reached.",
    source: `seq(
  define(twice, action, q{ seq(action(), action()) }),
  define(addItem, q{
    call(document.querySelector("#items"), "insertAdjacentHTML",
      "beforeend", "<li>Added by Zipper</li>")
  }),
  twice(emit("Again!\\n")),
  twice(addItem())
)`,
  },
  {
    id: "canvas",
    title: "04 · Draw on a canvas",
    description: "Zipper defines the drawing helpers. Every browser method is its own visible step.",
    source: `seq(
  define(canvas, q{ document.querySelector("#drawing") }),
  define(ctx, q{ call(canvas(), "getContext", "2d") }),
  define(colour, paint, q{ Reflect.set(ctx(), "fillStyle", paint()) }),
  Reflect.set(document.querySelector("#heading"), "textContent", "A tiny landscape"),
  Reflect.set(Reflect.get(canvas(), "style"), "display", "block"),
  colour("#dcece5"),
  call(ctx(), "fillRect", 0, 0, 400, 150),
  colour("#174d39"),
  call(ctx(), "beginPath"),
  call(ctx(), "moveTo", 0, 150),
  call(ctx(), "lineTo", 125, 25),
  call(ctx(), "lineTo", 250, 150),
  call(ctx(), "fill"),
  colour("#dfff85"),
  call(ctx(), "beginPath"),
  call(ctx(), "arc", 310, 42, 24, 0, 6.283185307179586),
  call(ctx(), "fill"),
  emit("A landscape, one call at a time.\\n")
)`,
  },
  {
    id: "fetch",
    title: "05 · Fetch some data",
    description: "fetch returns a response; call invokes its json method. Promises are awaited automatically.",
    source: `seq(
  emit("Reading a JSON response...\\n"),
  Reflect.set(document.querySelector("#message"), "textContent",
    Reflect.get(
      call(fetch("data:application/json,%7B%22message%22%3A%22Hello%20from%20fetch!%22%7D"), "json"),
      "message")),
  emit(Reflect.get(document.querySelector("#message"), "textContent")),
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
