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
The pale doorway or menu Return exits. Re-entry in this tab retains the
graph and pauses/resumes crew traversal without advancing while away.
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

The Stars & Ships orbital gallery reinterprets the original space chart in 3D and uses planet names from its existing dataset. Click a planet or moon or choose it from the destination list to dispatch a ship. Selecting another destination reroutes the ship from its current position. After arrival, open the attached map conversion, solid modelling, or Zipper exhibit. The standalone chart links directly to the orbital gallery in the courtyard for VR. The original Processing game remains linked.

Programmable sculpture runs the existing Zipper interpreter. The default program defines a pillar and builds a bridge. Step performs one rewrite, Run continues to completion, and Reset sculpture clears the blocks and rewinds the current program. Executing an edited program starts from an empty plinth. The only host action is block(x, y, z, colour), which places or recolours a cell using integer x/z from −3 to 3, y from 0 to 5, and bronze, gold or teal. The host accepts typed literal arguments only. Each run is bounded by 240 rewrites and 6,000 source characters. The status reports rewrites, blocks and interpreter errors.

The map conversion bench accepts newline-separated unnamed GeoJSON Point features. Convert points validates the entire input and produces the two point streams from the Entirety converter: little-endian float64 pairs of latitude multiplied by 60 and longitude multiplied by −60, plus three zero float64 attributes per point. The globe reads the output pairs to place pins. Drag to rotate, inspect the byte totals and first pair, or download either stream. Conversion is local and remains available without WebGL. Invalid input reports the line and keeps the previous successful conversion.

Pocket Bonsai Foundry interprets a subset of the Pocket Bonsai turtle vocabulary to generate a 3D solid. Edit the whitespace-separated replacement for X, choose zero to four generations, and select Build solid. F and remaining X draw a branch and advance. Brackets save or restore the position, orientation and size. Y/y, P/p and R/r rotate around local axes and s shrinks subsequent steps. The build takes the voxel union of rounded branches on a grid of up to 58 cells per axis, then displays only the exposed voxel faces. It reports branch and occupied voxel counts. Invalid rules leave the previous model visible. Drag the stage to orbit the result.

The Jump stage reinterprets the original articulated Racket figure in WebGL. Play built-in jump shows a jump and knee bend. Drag on the desktop stage to pose the figure's right hand. In immersive VR, controller or wrist poses move the figure's hands. Headset height drives crouch and jump, and small physical steps move the whole figure horizontally. Recording calibrates position and horizontal heading from the first tracked headset pose. The figure follows steps along that heading, up to 0.65 meters in either direction on each axis. If a hand loses tracking, keep its last pose. While headset tracking is unavailable, hold the displayed pose and skip recording samples. Start or stop a recording with Record movement or the VR grip. Capture up to 12 seconds at no more than 30 samples per second, keep the latest phrase in memory, and interpolate poses on replay. Loop the dance or the VR trigger starts or stops continuous imitation. Resample every 50 ms and compare the first two cycles for candidate periods of at least 600 ms, including horizontal movement in the pose comparison. Use the shortest period with movement in both cycles and low pose mismatch. If no period matches, use the full phrase. Blend the last pose back to the first over up to 180 ms. The original Racket project remains linked.

The Datatree gallery starts with a bundled sample archive. Branches are rendered as connected 3D plaques. Select a branch to display its children and breadcrumb, select a leaf to read its value, or select Up to return to the parent. Containers show three entries per page with Previous and Next controls. Desktop visitors may click plaques or use the corresponding HTML buttons, including when WebGL is unavailable. In immersive VR, point and select a plaque with a controller.

Open local ZIP or Datatree snapshot accepts a version 1 JSON file from Datatree's Save visible tree action. Expanded resources become branches and leaves show the resource kind and size. The viewer preserves duplicate names by adding numeric suffixes. Snapshots are limited to 4 MiB, 12 levels and 5,000 resources and are read in browser memory.

Open local ZIP reads a chosen file in browser memory. No data leaves the browser and files are never extracted to disk. It supports single-disk ZIP archives with UTF-8 entry names, stored or DEFLATE entries, nested ZIPs, JSON, and UTF-8 text. Other entry types display their size. Unsupported, encrypted, truncated, or corrupt data reports an error. The gallery limits the root to 16 MiB, ZIP directories to 4,096 entries, individual previews to 2 MiB, and navigation to 16 levels. Restore sample releases the loaded tree and returns to the original archive. The gallery does not connect to a Datatree server.

The portfolio homepage links to a walkable Roman courtyard. The gallery has a tiled floor, arcades, planters, benches and a fountain. The first wall exhibits are Entirety, JavaScript Raymarcher, Stars & Ships and Creatures. They link to the existing projects. Other candidates in the portfolio inventory include L-World, Mona Lisa Overdraw, Crawl of the Beholder, Pocket Bonsai, Datatree and Jump.

Drag on the scene to look around and use WASD or arrow keys to walk. Choose an exhibit in the navigation strip to jump to it. Close to an exhibit, show its summary and the link to the project. Until approached, each wall display shows a procedural mosaic. Load its existing project preview only when a visitor approaches or jumps to it. Keep project links usable when WebGL is unavailable.

On a browser that supports immersive WebXR, offer Enter VR. The headset supplies the view pose. The courtyard, Datatree, Orbit, and Jump show tracked controller models and, when the headset grants hand tracking, show the tracked joints of each hand. Select by pointing and pulling the trigger or pinching. In Jump, the wrist can pose the figure's hand, the left pinch toggles recording, and the right pinch toggles the dance loop.

Enter VR once for the courtyard and its rooms. Walk into a labeled doorway or select it to load the room on demand in the same renderer and session. The camera rig, movement controls, hand tracking, and pointing inputs move into the room together. Select Return or approach the exit to return to the doorway. Datatree's sample archive, Jump's recording and playback controls, the map conversion sample, Pocket Bonsai's generation controls, Zipper's sample program, and Themelab's three themes are interactive in their rooms. In Stars & Ships, select a destination to dispatch the ship. Select it again after arrival to enter its room and use Return to come back to the chart. The L-World workshop renders the original default turtle program as spatial panels using its local textures and simplified shader materials. Its full editor remains available through its separate link. Local file selection, downloads, and full text editors remain in the standalone exhibits.

Movement help is available in the on-demand Controls section. No control sign appears automatically inside VR. The left thumbstick moves at up to 1.7 meters per second relative to headset direction. The right stick turns 30 degrees per push and must return toward center before turning again. With one thumbstick, use it to move. Point at the courtyard floor and select to teleport within the walking bounds, outside the fountain. Point at a wall exhibit, its floor marker, or a doorway and select to visit it. Walking and turning also work in the relief maps, riverbank, and library.

Outside immersive VR, accept gamepads that the browser maps to its standard layout. Press a button to activate a gamepad. In the courtyard, the left stick walks and strafes and the right stick looks around. In the courtyard, Datatree, and Orbit, the D-pad moves focus through visible enabled buttons and links. A or Cross activates the focused control. In Jump, the left stick poses the right hand. A or Cross starts or stops recording, X or Square replays, and Y or Triangle toggles the dance loop. Ignore small stick motion around center and handle button actions once per press.

Entirety has separate Mediterranean and Japan floor rugs made from its existing map images. Select Entirety and choose a rug to jump next to it, or approach either rug on foot. Its map image loads on approach. Walk into its center or select the named Enter map button to load its separate walkable relief. Each relief is stylized and does not encode measured elevations. Return to the same rug by walking into the bronze ring or selecting Return to courtyard. In VR, point and select a rug to enter, the relief to teleport, and the ring to return.

The courtyard’s south ring and **Visit the riverbank** button open a separate, demand-loaded riverbank with a walkable path beside the water. Walk into the bronze ring or select **Return to courtyard** to return to the entrance. In VR, select the south ring to enter, the terrain to teleport, or the bronze ring to return.

**Visit the library** or the second south ring opens a demand-loaded reading room with bookcases and a central aisle. Walk into the bronze ring or select **Return to courtyard** to return next to the library entrance. VR uses the same ring and floor selection controls as the riverbank.

**Enter the Games Aquarium** or the third south ring opens a room with a raised 32×19 tank. Its simulation and meshes load on entry. The tank uses the same rules as the linked 2D aquarium. Round green builders raise walls, amber cubes break them, and pink cones hunt builders. A caught builder shrinks until its stun ends. The board shows the current tick, creature count, walls built and broken, and catches.

Select **Run / pause** to stop or restart the tank. **Step when paused** advances one tick, and **Reset tank** restores the initial layout. Choose Builder, Breaker, or Hunter, then select an empty cell to place one. The board reports the result, including occupied cells and the 40-creature limit. Desktop clicks, controller triggers, and tracked pinches use the same tank and plaques. You can walk around the tank and teleport to the surrounding floor. Returning to the courtyard suspends updates and preserves the tank for re-entry in this tab. The 2D link remains available without WebGL.

The Themelab room and standalone depth studies page offer courtyard window, iron grate, and bookshelf alley scenes. In the room, select a scene or camera control plaque by clicking or pointing at it. The exhibit renders on a fixed display with its own viewpoint. Mouse, controller, and headset input move around the gallery as usual. **Use camera tracking** requests video and uses native face detection when available. Otherwise it loads MediaPipe's face detector on demand. Only the visible face position moves the depth viewpoint through the fixed foreground frame. The view returns to center when the face leaves the frame, camera access fails, or tracking stops. Frames stay in the tab and capture stops on room or page exit.

Visiting Creatures loads the existing demo's animated Khronos Fox and Quaternius Bunny on demand. They patrol the entrance side of the courtyard and pause to face each other when they meet. Call the creatures sends them toward the visitor's side of the patrol area for a short visit. The rest of the courtyard stays available if a creature fails to load.

The Raymarcher exhibit loads a stone block when approached. Select Carve the stone to start over with a fresh block. In VR, select the exhibit again after arriving to start. Rays approach from all six faces, sphere-trace the signed distance to a torus, and remove voxels before the first hit. The display shows the rays cast and the number of chips removed. The original JavaScript Raymarcher remains linked from the exhibit.

Letter fitting loads a reference arch and an empty reconstruction. The Reference shape picker switches between Arch and Stepped pyramid and clears the fit. Select Fit the shape or select the VR marker again to start. The optimizer samples positions, scale, extrusion depth and a quarter turn for six voxel letters. Every 480 candidates, add the one that most reduces the number of missing and excess voxels. Stop when a batch finds no improvement, error reaches zero, or 24 letters have been placed. Show the accepted letters, initial and current error, candidates scored, longest CPU optimization step, and mean browser animation frame interval during the run. Stop scheduling more candidates for the current frame after 2 ms or 36 candidates. The CPU step excludes rendering and a single candidate may carry it past the threshold.
