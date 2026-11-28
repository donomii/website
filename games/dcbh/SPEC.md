# Browser arenas

A new run generates a seed. Each branch combines it with its branch ID to generate one persistent floor. The Dungeon has rooms connected by passages, the Crypt has crossing halls, and Zot has cave pods. Monsters and blood remain on their floor while the player is away. Projectiles and short-lived effects expire on travel. Health, kills, elapsed time and firing and spawn timers carry across floors.

The player starts in the first room. Place a down stair on a dry tile at the greatest walking distance from the entry. Following it places the player on the next floor's up stair. Returning places the player on the matching down stair. The Dungeon has no up stair and Zot has no down stair. A stair responds when the player enters its tile, once per entry. Crossing 25 or 60 seconds also descends to the Crypt or Zot respectively if the player is still on an earlier floor.

Players and monsters slide along rock walls. Shallow water permits movement. Deep water blocks walking. Monsters spawn on reachable dry tiles and follow connected passages when they lose sight of the player. Bolts target the nearest visible monster and stop at rock. Each branch uses the existing DCSS floor, wall and monster sprites.

## Generator settings

Edit a branch in `ARENA_MAPS` in `levels.js`. The Dungeon defaults to 25 × 25 with four trails per room. The Crypt defaults to 29 × 25. Zot defaults to 31 × 27 with a pod threshold of 0.30.

| Setting | Values and effect |
| --- | --- |
| family | `basic` for rooms, `cross` for intersecting halls, `pods` for caves, `swamp` or `shoals` for wet terrain |
| width, height | Whole tile counts including the border. Width ranges from 14 to 80 and height from 12 to 70. |
| influences.trails | 0–16 extra trail segments per room on basic maps, default 4 |
| influences.podThreshold | 0–0.6 on pod maps. Higher values leave more rock. Default 0.30. |
| influences.waterLevel | −4 to 4 on wet maps. Raising it raises the water level. Default 0. |

The vendored `crawlmap.js` is the shared generator used by Crawl of the Beholder. Its DCSS adaptations cover room trails, cave pods, crossing halls and wet branch heightmaps. See its [license](vendor/crawlmap/LICENSE).
