const frame = document.querySelector("#world");
const program = document.querySelector("#scene-program");
const apply = document.querySelector("#apply-scene");
const status = document.querySelector("#scene-status");

frame.addEventListener("load", () => {
    const original = frame.contentDocument?.querySelector("#lsystem");
    if (original) {
        program.value = original.value;
        apply.disabled = false;
    }
});
frame.src = "/projects/lworld/lworld.html";

document.querySelector("#scene-form").addEventListener("submit", event => {
    event.preventDefault();
    const original = frame.contentDocument?.querySelector("#lsystem");
    if (!original) {
        status.textContent = "The original world is still loading.";
        return;
    }
    const tokens = program.value.trim().split(/\s+/);
    let depth = 0;
    for (const token of tokens) {
        if (token === "[") depth++;
        else if (token === "]") depth--;
        if (depth < 0) break;
    }
    if (depth !== 0) {
        status.textContent = "Match each opening bracket with a closing bracket.";
        return;
    }
    original.value = tokens.join(" ");
    status.textContent = `Applied ${tokens.length} commands to the original renderer.`;
});
