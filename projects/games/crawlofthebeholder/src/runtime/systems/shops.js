(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installShops = function (context) {
    with (context) {
      // Floors that get a merchant. Pinned indexes so the same encounter shows
      // up reliably across runs and tests.
      const MERCHANT_FLOORS = [1, 4, 7, 10];

      function findOpenShopCell(floor) {
        const taken = new Set();
        for (const item of floor.floorItems || []) taken.add(`${item.x},${item.y}`);
        for (const trap of floor.traps || []) taken.add(`${trap.x},${trap.y}`);
        for (const decor of floor.decor || []) taken.add(`${decor.x},${decor.y}`);
        for (const enc of floor.encounters || []) taken.add(`${enc.x},${enc.y}`);
        for (const stair of Object.values(floor.stairs || {})) {
          if (stair) taken.add(`${stair.x},${stair.y}`);
        }
        taken.add(`${floor.start.x},${floor.start.y}`);

        // Try BFS from start first so the merchant sits near the entrance.
        const queue = [{ x: floor.start.x, y: floor.start.y }];
        const visited = new Set([`${floor.start.x},${floor.start.y}`]);
        const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
        while (queue.length > 0) {
          const cell = queue.shift();
          for (const dir of dirs) {
            const x = cell.x + dir.x;
            const y = cell.y + dir.y;
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (x < 0 || y < 0 || x >= floor.map.width || y >= floor.map.height) continue;
            const c = floor.map.rows[y]?.[x] || " ";
            if (c !== ".") continue;
            if (!taken.has(key)) return { x, y };
            queue.push({ x, y });
          }
        }
        // Fallback: any dry floor cell anywhere on the map (handy on swamp/shoals floors).
        for (let y = 1; y < floor.map.height - 1; y += 1) {
          for (let x = 1; x < floor.map.width - 1; x += 1) {
            const c = floor.map.rows[y]?.[x] || " ";
            if (c !== ".") continue;
            const key = `${x},${y}`;
            if (taken.has(key)) continue;
            return { x, y };
          }
        }
        return null;
      }

      function seedShops() {
        for (const floorIndex of MERCHANT_FLOORS) {
          const floor = resources.floors[floorIndex];
          if (!floor) continue;
          floor.decor = floor.decor || [];
          if (floor.decor.some((d) => d.kind === "merchant")) continue;
          const cell = findOpenShopCell(floor);
          if (!cell) continue;
          const sampleDecor = floor.decor[0];
          floor.decor.push({
            id: `merchant-${floorIndex}`,
            name: "weathered merchant",
            shortName: "shop",
            kind: "merchant",
            tile: sampleDecor?.tile || "",
            x: cell.x,
            y: cell.y
          });
        }
      }

      function shopFor(decor) {
        if (!decor || decor.kind !== "merchant") return null;
        return ensureShopStockOnCurrentFloor(decor);
      }

      function ensureShopStockOnCurrentFloor(decor) {
        const floorState = currentFloorState();
        if (floorState.shopStock && floorState.shopStock.length > 0) return floorState.shopStock;
        floorState.shopStock = generateShopStock(state.floorIndex);
        return floorState.shopStock;
      }

      function generateShopStock(floorIndex) {
        const templates = resources.inventory.filter((item) => item.kind !== "quest");
        if (templates.length === 0) return [];
        const stock = [];
        const count = 5;
        for (let i = 0; i < count; i += 1) {
          const template = templates[((floorIndex + 1) * 7 + i * 11) % templates.length];
          if (!template) continue;
          const base = typeof itemValue === "function" ? itemValue(template) : (template.power || 1) * 8;
          const price = Math.max(5, Math.round(base * 1.4));
          stock.push({
            ...template,
            id: `shop-${floorIndex}-${i}`,
            price
          });
        }
        return stock;
      }

      function openShopAt(decor) {
        if (decor.kind !== "merchant") return false;
        ensureShopStockOnCurrentFloor(decor);
        if (typeof showModal === "function") showModal("shopModal");
        if (typeof renderShopModalBody === "function") renderShopModalBody();
        return true;
      }

      function renderShopModalBody() {
        if (!els.shopList) return;
        const floorState = currentFloorState();
        const stock = floorState.shopStock || [];
        if (els.shopGoldLine) els.shopGoldLine.textContent = `Purse: ${state.gold || 0}g. Enchantments cost 60g per +1.`;
        const enchantBlock = `<li>
          <div>
            <div class="shop-row-name">Enchant a weapon or armour</div>
            <span class="shop-row-meta">60g · adds +1 to the next equipped weapon (or armour if no weapon)</span>
          </div>
          <button type="button" class="shop-buy" data-shop-enchant="1" ${(state.gold || 0) < 60 ? "disabled" : ""}>Enchant</button>
        </li>`;
        if (stock.length === 0) {
          els.shopList.innerHTML = `${enchantBlock}<li><strong>Stock cleared.</strong><span>The merchant has nothing else to sell.</span></li>`;
          return;
        }
        const rows = stock.map((entry) => {
          const tooPoor = (state.gold || 0) < entry.price;
          const sold = entry.sold;
          const disabled = sold || tooPoor;
          const meta = `${entry.kind || "item"}${entry.power ? ` · pwr ${entry.power}` : ""}${entry.charges ? ` · ${entry.charges} charges` : ""}`;
          return `<li>
            <div>
              <div class="shop-row-name">${escapeHtml(entry.name)}</div>
              <span class="shop-row-meta">${escapeHtml(meta)} · ${entry.price}g${sold ? " · sold" : tooPoor ? " · cannot afford" : ""}</span>
            </div>
            <button type="button" class="shop-buy" data-shop-buy="${escapeHtml(entry.id)}" ${disabled ? "disabled" : ""}>${sold ? "Sold" : "Buy"}</button>
          </li>`;
        }).join("");
        els.shopList.innerHTML = `${enchantBlock}${rows}`;
      }

      function enchantInventoryItem() {
        if ((state.gold || 0) < 60) {
          setMessage("60 gold is too steep for an enchantment.");
          renderShopModalBody();
          return false;
        }
        // Prefer the front-line's weapon, then armour.
        const leader = state.party[0];
        let target = null;
        for (const slot of ["weapon", "armour", "talisman", "ring", "amulet"]) {
          if (leader?.[slot]) { target = leader[slot]; break; }
        }
        if (!target) {
          setMessage("No equippable gear to enchant on the leader.");
          renderShopModalBody();
          return false;
        }
        state.gold -= 60;
        state.goldSpent = (state.goldSpent || 0) + 60;
        target.enchantment = (target.enchantment || 0) + 1;
        target.maxEnchantment = Math.max(target.maxEnchantment || 0, target.enchantment);
        if (typeof target.power === "number") target.power += 1;
        state.enchantedSomething = true;
        state.message = `${target.name} hums brighter (+${target.enchantment}).`;
        renderShopModalBody();
        if (typeof renderChrome === "function") renderChrome();
        if (typeof saveGame === "function") saveGame();
        return true;
      }

      function buyShopItem(entryId) {
        const floorState = currentFloorState();
        const stock = floorState.shopStock || [];
        const entry = stock.find((e) => e.id === entryId);
        if (!entry || entry.sold) return false;
        if ((state.gold || 0) < entry.price) {
          setMessage(`${entry.price}g is too steep for the party's purse.`);
          renderShopModalBody();
          return false;
        }
        state.gold -= entry.price;
        state.goldSpent = (state.goldSpent || 0) + entry.price;
        entry.sold = true;
        state.boughtFromShop = true;
        // Hand a fresh copy to inventory so charges/state aren't shared with the stock row.
        const copy = { ...entry, id: `bought-${state.lootSerial += 1}` };
        delete copy.price;
        delete copy.sold;
        state.inventory.push(copy);
        state.itemsCollected = (state.itemsCollected || 0) + 1;
        state.message = `Bought ${entry.name} for ${entry.price}g.`;
        renderShopModalBody();
        if (typeof renderChrome === "function") renderChrome();
        if (typeof saveGame === "function") saveGame();
        return true;
      }

      Object.assign(context, {
        MERCHANT_FLOORS,
        seedShops,
        findOpenShopCell,
        shopFor,
        generateShopStock,
        openShopAt,
        renderShopModalBody,
        buyShopItem,
        enchantInventoryItem
      });

      if (!context.shopsDisabled) seedShops();
    }
  };
}());
