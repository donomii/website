// Service worker for Crawl of the Beholder.
// Strategy: cache-first for the app shell + runtime modules, network fallback.
// Bump CACHE_VERSION whenever you ship new code so old caches get cleaned out.

const CACHE_VERSION = "cotb-v27-classlore";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./src/main.js",
  "./src/resources.generated.js",
  "./src/vaults.generated.js",
  "./src/monster_flavour.generated.js",
  "./src/lore.generated.js",
  "./src/runtime/engine/core.js",
  "./src/runtime/engine/monster_traits.js",
  "./src/runtime/engine/combat_math.js",
  "./src/runtime/engine/messages_and_visibility.js",
  "./src/runtime/engine/floor_marks.js",
  "./src/runtime/engine/monster_ai.js",
  "./src/runtime/engine/party/combat.js",
  "./src/runtime/engine/party/movement.js",
  "./src/runtime/engine/party/traversal.js",
  "./src/runtime/engine/party/interaction.js",
  "./src/runtime/engine/party/fixtures.js",
  "./src/runtime/engine/party/inventory.js",
  "./src/runtime/engine/items/elements.js",
  "./src/runtime/engine/party/items.js",
  "./src/runtime/engine/items/use.js",
  "./src/runtime/engine/party/turn.js",
  "./src/runtime/render/viewport_rendering.js",
  "./src/runtime/render/ui_chrome.js",
  "./src/runtime/engine/classes.js",
  "./src/runtime/engine/mapgen.js",
  "./src/runtime/io/persistence.js",
  "./src/runtime/config/difficulty.js",
  "./src/runtime/config/deities.js",
  "./src/runtime/systems/reactions.js",
  "./src/runtime/systems/economy.js",
  "./src/runtime/systems/inventory_extras.js",
  "./src/runtime/systems/talents.js",
  "./src/runtime/systems/boss_monsters.js",
  "./src/runtime/systems/shops.js",
  "./src/runtime/systems/npcs.js",
  "./src/runtime/systems/hidden_passages.js",
  "./src/runtime/render/sound.js",
  "./src/runtime/systems/bestiary.js",
  "./src/runtime/systems/wanderers.js",
  "./src/runtime/systems/quests.js",
  "./src/runtime/systems/floor_hazards.js",
  "./src/runtime/systems/allies.js",
  "./src/runtime/systems/engineering.js",
  "./src/runtime/systems/ecology.js",
  "./src/runtime/systems/mastery.js",
  "./src/runtime/systems/exploration.js",
  "./src/runtime/systems/alchemy.js",
  "./src/runtime/systems/weather.js",
  "./src/runtime/systems/arcane.js",
  "./src/runtime/systems/enchanting.js",
  "./src/runtime/systems/events.js",
  "./src/runtime/systems/corruption.js",
  "./src/runtime/systems/relics.js",
  "./src/runtime/systems/siege.js",
  "./src/runtime/systems/bloodlines.js",
  "./src/runtime/systems/gadgets.js",
  "./src/runtime/systems/cartography.js",
  "./src/runtime/systems/lore.js",
  "./src/runtime/systems/artefacts.js",
  "./src/runtime/systems/mutations.js",
  "./src/runtime/systems/camping.js",
  "./src/runtime/systems/leylines.js",
  "./src/runtime/systems/contracts.js",
  "./src/runtime/systems/herbalism.js",
  "./src/runtime/systems/divination.js",
  "./src/runtime/systems/necromancy.js",
  "./src/runtime/systems/runes.js",
  "./src/runtime/systems/harvesting.js",
  "./src/runtime/systems/totems.js",
  "./src/runtime/systems/resonance.js",
  "./src/runtime/systems/spirits.js",
  "./src/runtime/systems/cooking.js",
  "./src/runtime/systems/bardic.js",
  "./src/runtime/systems/psionics.js",
  "./src/runtime/systems/timewarp.js",
  "./src/runtime/systems/mining.js",
  "./src/runtime/systems/smithing.js",
  "./src/runtime/systems/morale.js",
  "./src/runtime/systems/constellations.js",
  "./src/runtime/render/mobile.js",
  "./src/runtime/io/input.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Best effort — if any individual fetch fails (e.g. an asset moved),
      // keep going so we never block install completely.
      await Promise.all(APP_SHELL.map(async (url) => {
        try {
          const response = await fetch(url, { cache: "reload" });
          if (response.ok) await cache.put(url, response.clone());
        } catch (e) {
          // Skip silently.
        }
      }));
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const network = await fetch(req);
      // Cache same-origin successful responses (skip opaque/error responses).
      if (network && network.ok && network.type !== "opaque") {
        try { await cache.put(req, network.clone()); } catch (e) {}
      }
      return network;
    } catch (error) {
      // Fully offline and we missed cache. Fall back to a tiny synthetic page.
      if (req.headers.get("accept")?.includes("text/html")) {
        return new Response("<!doctype html><meta charset=utf-8><title>Offline</title><p>You're offline and this page isn't cached yet.</p>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" }
        });
      }
      return new Response("", { status: 504, statusText: "offline" });
    }
  })());
});
