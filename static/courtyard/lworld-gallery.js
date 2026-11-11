import * as T from "../../projects/games/domino-rush/vendor/three.module.js";
import { exhibitDocument, galleryRoom } from "./gallery-room.js?v=20261111";

const project = "/projects/lworld/";

export async function createLWorldRoom() {
    const source = await exhibitDocument(project + "lworld.html");
    const program = source.querySelector("#lsystem").value.trim().split(/\s+/);
    const script = Array.from(source.scripts).map(node => node.textContent).join("\n");
    const procedures = new Map();
    for (const match of script.matchAll(/^\s*procedures\["(\w+)"\]\s*=\s*"([^"]*)"\.split\(" "\)/gm)) {
        procedures.set(match[1], match[2].trim().split(/\s+/));
    }
    const scene = new T.Scene();
    scene.background = new T.Color(0x282428);
    const sculpture = new T.Group();
    scene.add(sculpture);
    const loader = new T.TextureLoader();
    const materials = new Map();
    const colors = { ripples: 0x367da8, burngrid: 0xc7592d, "lazer-line": 0xe5bf6b, plain: 0x876b56 };
    const panel = new T.PlaneGeometry(2, 2);
    function draw(transform, finish) {
        if (!materials.has(finish)) {
            const texture = ["grass_tile", "cement_tile", "dirt_tile"].includes(finish) ? loader.load(project + finish + ".png") : null;
            if (texture) texture.colorSpace = T.SRGBColorSpace;
            materials.set(finish, new T.MeshBasicMaterial({ color: texture ? 0xffffff : colors[finish] ?? colors.plain,
                map: texture, side: T.DoubleSide, wireframe: finish === "lazer-line" }));
        }
        const tile = new T.Mesh(panel, materials.get(finish));
        tile.matrixAutoUpdate = false;
        tile.matrix.copy(transform);
        sculpture.add(tile);
    }

    const turns = {
        p: new T.Matrix4().makeRotationX(Math.PI / 2), P: new T.Matrix4().makeRotationX(-Math.PI / 2),
        y: new T.Matrix4().makeRotationZ(-Math.PI / 2), Y: new T.Matrix4().makeRotationZ(Math.PI / 2),
        t: new T.Matrix4().makeRotationY(-Math.PI / 6), T: new T.Matrix4().makeRotationY(Math.PI / 6),
    };
    const stack = [];
    let transform = new T.Matrix4().makeScale(0.5, 0.5, 0.5);
    let finish = "plain";
    let steps = 0;
    function execute(tokens, depth) {
        if (depth > 10) throw new Error("The L-World sample is too deeply nested.");
        for (const token of tokens) {
            if (++steps > 5000) throw new Error("The L-World sample exceeds 5,000 commands.");
            if (procedures.has(token)) {
                execute(procedures.get(token), depth + 1);
            } else if (Object.hasOwn(turns, token)) {
                transform.multiply(turns[token]);
            } else if (token === "[") {
                stack.push(transform.clone());
            } else if (token === "]") {
                if (!stack.length) throw new Error("An L-World branch closes before it opens.");
                transform = stack.pop();
            } else if (token === "S" || token === "s") {
                transform.scale(new T.Vector3().setScalar(token === "S" ? 2 : 0.5));
            } else if (["f", "ff", "fh", "F"].includes(token)) {
                transform.multiply(new T.Matrix4().makeTranslation(0, token === "F" ? -1 : token === "fh" ? 0.5 : 1, 0));
                if (token === "f" || token === "F") draw(transform, token === "f" ? "dirt_tile" : finish);
            } else if (token.startsWith("set_shader_")) {
                finish = token.slice(11);
            } else if (token.startsWith("shader_")) {
                finish = token.slice(7);
                draw(transform, finish);
            } else if (token === "z") {
                draw(transform, finish);
            } else if (token.startsWith("p")) {
                draw(transform, token.slice(1));
            } else if (token !== "u" && token !== "U") {
                throw new Error(`Unsupported L-World sample command ${token}.`);
            }
        }
    }
    execute(program, 0);
    if (stack.length || !sculpture.children.length) throw new Error("Invalid L-World sample geometry.");
    const bounds = new T.Box3().setFromObject(sculpture);
    const center = bounds.getCenter(new T.Vector3());
    const extent = bounds.getSize(new T.Vector3());
    const scale = 4.2 / Math.max(extent.x, extent.y, extent.z);
    const stand = new T.Group();
    sculpture.scale.setScalar(scale);
    sculpture.position.set(-center.x * scale, 0.3 - bounds.min.y * scale, -center.z * scale);
    stand.add(sculpture);
    stand.position.z = -0.9;
    scene.add(stand);
    return galleryRoom(scene, {
        actions: [["Turn model", () => { stand.rotation.y += Math.PI / 4; }]],
        canStand: (x, z) => Math.hypot(x, z + 0.9) > 2.2,
    });
}
