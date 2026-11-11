# Portfolio Courtyard

The scene opens unobstructed, with only a small gallery-menu icon and, in
Asteroid Farmer, the aiming crosshair. The title, status prose, navigation,
Return button and help remain hidden until the visitor opens that menu.
Escape or gamepad Start opens or closes it; the icon also toggles it.
Choose an exhibit and select Visit to enter it and close the menu.
Controls expands the input reference only on request. Project links remain
available in the menu; standalone 2D games and the L-World editor are destination
choices. Without WebGL, open the menu and retain the original project links
instead of the 3D picker. The scene page does not scroll. Immersive VR has no
automatically displayed instruction placards.
Gamepads use D-pad up/down to focus controls and left/right to change a focused
destination picker; A/Cross visits the selected exhibit.

Accumulative Station is a demand-loaded orbital construction hangar, entered
from the menu or southwest courtyard doorway. Reuse the original station
simulation from the separate 2D game. A raised platform holds a spatial graph
of colored modules, tubes, lit windows and moving astronauts. The surrounding
hangar has structural ribs, a grid floor and a star/planet view.

The console's four small, labeled module models choose the next type, with
Habitat selected by default. Select a built module and then one of its six
glowing ports to extend it. A free neighbor shows a wireframe blueprint; an
occupied neighbor can close a loop with a tube. Connected ports disappear.
The selected module has a gold outline, and successful construction selects
the destination. Keep the graph's position for small additions; fit it into
the platform's viewing volume only when necessary. Pick volumes remain usable
as the graph shrinks. Support 96 modules and up to 24 astronauts using the
original graph and route rules. Crew visibly walk and climb on the structure.

Desktop clicks, controller triggers and pinches select physical targets;
Space and ordinary gamepad A/Cross select the crosshair. Walking and floor
teleportation stay outside the platform and inside the hangar. Counts and
results remain in the closed menu; no floating instruction panel appears.
Walk back through the East Space Hall doorway to leave. Re-entry or looking
away pauses/resumes crew traversal without advancing while inactive.
Reload begins a new station. The 2D game remains a separate session.

Art Deco salon is available in the destination menu and through the northeast
courtyard doorway. Load its geometry only on entry and retain the existing
renderer, camera rig, XR session and controller/hand inputs. The room is twelve
meters wide, sixteen deep and six and a half high, with emerald walls, a matte
jade stone floor with thin brass borders and stepped corner inlays, fluted pilasters, stepped capitals,
sunburst wall reliefs, opal chandeliers, velvet lounges and geometric palms.
A brass armillary turns slowly above an octagonal plinth. The entry view has
no text panels. Menu, help and readouts remain closed by default.

The flat floor accepts walking, gamepad movement and controller/pinch
teleportation. Keep visitors inside the walls and outside the sculpture plinth,
lounges and planters. A pale doorway behind the spawn point returns to the
courtyard by approach or selection; Return is also available in the menu.
Architecture uses instanced boxes and procedural geometry,
with no image assets, external fetches, extra renderer or animation loop.
The room exposes scene, floor surface, exit, floor-height and walkability
functions, spawn and movement limits, and an update function for the sculpture.

Asteroid Farmer is a demand-loaded room entered through its labeled west
doorway or the destination picker. It imports the original game's simulation
and validated save module. Soil beds plant and harvest; physical depot, turret
and ship blueprints buy the named construction for its labeled price. Select
Cinder Shoal's ring to settle, or Redoubt's ring to raid. Crops grow visibly and
show countdowns. Ships orbit Lantern Farm, with at most twelve drawn. The side
board and on-demand menu status show credits, fleet, raid countdown and action
results. There is no in-world instruction board; asteroid names are small signs
attached to their rims.
Mouse clicks, VR trigger rays and pinch rays share the same targets. In this
room the desktop canvas takes focus, a crosshair appears, and Space or gamepad
A/Cross selects its target. D-pad focus can still reach Return.
Walking and floor teleportation remain available around the asteroids.
Leaving stops updates and saves; re-entry loads the current same-origin
asteroid-farmer-v1 state, with up to five minutes of crop growth and no away
raids. Invalid saves are preserved and that visit plays without saving.
The 2D game link works without entering the room. Use one game view at a time.

Open the L-World editor loads the existing WebGL editor in an interactive same-origin frame. The frame retains its command list, texture and shader controls, editable L-system line and original camera interaction. The editor page's Scene commands field starts with the original editor value. Apply to world checks balanced brackets, then forwards the whitespace-separated commands to the original renderer's input. The editor page links back to the courtyard and to the original standalone page.

The Stars & Ships sector reinterprets the original 2D Processing star chart (`stars.pde` and `datasets.js`) as a free-standing 3D volume of 20 spiked 3D stars and 20 delta-winged 3D ships colored for Neutral, Bob, Tom, and Harry. Ships autonomously turn and fly between randomly chosen stars throughout the 3D space. Visitors can walk through the volume in VR, orbit on the standalone page, or click a star or ship to inspect and reroute it. The original Processing game remains linked.

Programmable sculpture runs the existing Zipper interpreter. The default program defines a pillar and builds a bridge. Step performs one rewrite, Run continues to completion, and Reset sculpture clears the blocks and rewinds the current program. Executing an edited program starts from an empty plinth. The only host action is block(x, y, z, colour), which places or recolours a cell using integer x/z from −3 to 3, y from 0 to 5, and bronze, gold or teal. The host accepts typed literal arguments only. Each run is bounded by 240 rewrites and 6,000 source characters. The status reports rewrites, blocks and interpreter errors.

The map conversion bench accepts newline-separated unnamed GeoJSON Point features. Convert points validates the entire input and produces the two point streams from the Entirety converter: little-endian float64 pairs of latitude multiplied by 60 and longitude multiplied by −60, plus three zero float64 attributes per point. The globe reads the output pairs to place pins. Drag to rotate, inspect the byte totals and first pair, or download either stream. Conversion is local and remains available without WebGL. Invalid input reports the line and keeps the previous successful conversion.

Pocket Bonsai Foundry interprets a subset of the Pocket Bonsai turtle vocabulary to generate a 3D solid. Edit the whitespace-separated replacement for X, choose zero to four generations, and select Build solid. F and remaining X draw a branch and advance. Brackets save or restore the position, orientation and size. Y/y, P/p and R/r rotate around local axes and s shrinks subsequent steps. The build takes the voxel union of rounded branches on a grid of up to 58 cells per axis, then displays only the exposed voxel faces. It reports branch and occupied voxel counts. Invalid rules leave the previous model visible. Drag the stage to orbit the result.

The Jump room restores a pair of the original blocky articulated Racket figures in WebGL (`jumping.rkt` box hierarchy with torso, waist, head, upper/lower arms, and hinged knee legs), moving, jumping, and kicking autonomously without a dance-studio stage or recording UI. Visitors can pause or resume motion and cycle the original figure color pairs; the original Racket project remains linked.

The Datatree gallery starts with a bundled sample archive. Branches are rendered as connected 3D plaques. Select a branch to display its children and breadcrumb, select a leaf to read its value, or select Up to return to the parent. Containers show three entries per page with Previous and Next controls. Desktop visitors may click plaques or use the corresponding HTML buttons, including when WebGL is unavailable. In immersive VR, point and select a plaque with a controller.

Open local ZIP or Datatree snapshot accepts a version 1 JSON file from Datatree's Save visible tree action. Expanded resources become branches and leaves show the resource kind and size. The viewer preserves duplicate names by adding numeric suffixes. Snapshots are limited to 4 MiB, 12 levels and 5,000 resources and are read in browser memory.

Open local ZIP reads a chosen file in browser memory. No data leaves the browser and files are never extracted to disk. It supports single-disk ZIP archives with UTF-8 entry names, stored or DEFLATE entries, nested ZIPs, JSON, and UTF-8 text. Other entry types display their size. Unsupported, encrypted, truncated, or corrupt data reports an error. The gallery limits the root to 16 MiB, ZIP directories to 4,096 entries, individual previews to 2 MiB, and navigation to 16 levels. Restore sample releases the loaded tree and returns to the original archive. The gallery does not connect to a Datatree server.

The portfolio homepage links to a walkable Roman courtyard. The gallery has a tiled floor, arcades, planters, benches and a fountain. The first wall exhibits are Entirety, JavaScript Raymarcher, Stars & Ships and Creatures. They link to the existing projects. Other candidates in the portfolio inventory include L-World, Mona Lisa Overdraw, Crawl of the Beholder, Pocket Bonsai, Datatree and Jump.

Drag on the scene to look around (grab-style pan axes) and hold the right mouse button or use WASD or arrow keys to walk. Choose an exhibit in the navigation strip to jump to it. Close to an exhibit, show its summary and the link to the project. Until approached, each wall display shows a procedural mosaic. Load its existing project preview only when a visitor approaches or jumps to it. Keep project links usable when WebGL is unavailable.

On a browser that supports immersive WebXR, offer Enter VR. The headset supplies the view pose. The courtyard, Datatree, Orbit, and Jump show tracked controller models and, when the headset grants hand tracking, show the tracked joints of each hand. Select by pointing and pulling the trigger or pinching.

Enter VR once for the courtyard and its connected rooms. Walk or teleport
through open, labeled doorways to load adjacent rooms on demand in one unified
scene with the same renderer, camera rig, hand tracking, and pointing inputs.
When looking away from a room or courtyard exhibit (or entering another wing),
heavy exhibit contents pause and fade out cleanly while architectural walls
remain solid; looking back fades them in and resumes. Datatree's sample archive,
Jump's recording and playback controls, the map conversion sample, Pocket
Bonsai's generation controls and Zipper's sample program are interactive
directly inside their rooms. L-World renders its spatial panels workshop
alongside its separate full-editor link. Local file selection, downloads, and
full text editors remain in the standalone exhibits.

Movement help is available in the on-demand Controls section. No control sign appears automatically inside VR. The left thumbstick moves at up to 1.7 meters per second relative to headset direction. The right stick turns 30 degrees per push and must return toward center before turning again. With one thumbstick, use it to move. Point at any open floor through a doorway and select to teleport cleanly within walkable bounds (blocked by solid walls). Point at an exhibit panel, gallery painting, or 3D control to select it.

Outside immersive VR, accept gamepads that the browser maps to its standard layout. Press a button to activate a gamepad. In the courtyard, the left stick walks and strafes and the right stick looks around. In the courtyard, Datatree, and Orbit, the D-pad moves focus through visible enabled buttons and links. A or Cross activates the focused control. Ignore small stick motion around center and handle button actions once per press.

Entirety's Mediterranean, Japan, Europe, and Africa maps hang as framed
gallery pictures along the courtyard's West and East walls. Select a map
from the gallery menu or click/point directly at its frame to stand before it.

The courtyard is an open-air Roman octagon under a pure black night sky,
with direct doorways on its cardinal and diagonal faces, freestanding perimeter columns (no overhead crossbars obscuring doorway signs), and no long corridors.
Framed Entirety maps (Mediterranean, Japan, Europe, and Africa) hang on the
south-west and south-east gallery walls. Inside the courtyard plaza sit the Fox
and Bunny Creatures, the Raymarcher UFO carving pedestal, the Letter fitting bench, and both the original walk-around 3D
Stars & Ships showcase and an arching overhead roof of stars and autonomous ships above the courtyard.

Surrounding direct-entry wings hold multiple related works per room:
- South archway: open sunlit **Riverbank** path and water.
- West doorway: **Library & Datatree** reading hall with shelves, tables, and the
  interactive Datatree archive wall at the back.
- North-west doorway: **Games & Worlds** combining the **Games Aquarium** tank,
  autonomous blocky **Jump** Racket figures, and the **L-World** sculpture.
- North doorway: **Art Deco salon** with emerald walls, fluted pilasters, lounges,
  palms, classic **L-system brass sunburst panels**, rotating brass armillary sphere,
  and one interactive **3D L-system design panel** on the east wall where visitors
  can cycle motifs, generation depth, turn angle, 3D relief extrusion, symmetry layout,
  or invent new symmetric L-system rules.
- North-east doorway: **Sculpture & Code Studio** combining the **Pocket Bonsai**
  turntable, **Zipper studio** plinth, and **Map conversion** globe.
- East doorway: **Space Hangar** combining **Accumulative Station** and
  **Asteroid Farmer** overlooking the deep-space planet and starfield.

The Games Aquarium tank pauses simulation when not looked at and preserves
state when walking away or returning. Select **Run / pause**, **Step when
paused**, **Reset tank**, or spawn species directly by clicking the tank.

Visiting Creatures loads the animated Khronos Fox and Quaternius Bunny, pausing
and fading out when not viewed or when exploring other wings.

The Raymarcher carving pedestal starts from a solid monolithic column of
stone blocks and has two hovering UFOs that gently pulse and zap individual
outer blocks one at a time on a relaxed ~1.35s cadence, making each hit block
shimmer and fade out until the hidden torus is revealed. It pauses and fades out
when looking away, and can be restarted by clicking the block, pedestal, **Carve
stone** plaque, or menu button.

Letter fitting loads an Arch / Stepped pyramid reference bench on the courtyard's
east side, pausing and fading out when not viewed, and can be started or
switched via the bench's 3D plaques or gallery menu.

The courtyard persists the visitor's last valid position and view orientation in
`localStorage` (`courtyard.pose.v1`) so reloading restores them in place across
courtyard plazas and connected wings unless a specific `?room=` query parameter is
provided.
