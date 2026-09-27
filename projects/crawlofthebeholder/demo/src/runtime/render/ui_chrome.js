(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installUiChrome = function (context) {
    with (context) {
      function renderParty() {
        els.party.innerHTML = "";
        for (const [index, member] of state.party.entries()) {
          const row = document.createElement("div");
          const ratio = member.maxHp > 0 ? member.hp / member.maxHp : 0;
          const hpClass = member.hp <= 0 ? "down" : ratio < 0.34 ? "low" : ratio < 0.67 ? "mid" : "ok";
          const klass = typeof classFor === "function" ? classFor(member) : null;
          row.className = `party-row hp-${hpClass}${index === 0 ? " front-line" : ""}${klass ? ` class-${klass.key}` : ""}`;
          const gear = [
            member.weapon?.shortName,
            member.armour?.shortName,
            member.talisman?.shortName,
            member.ring?.shortName,
            member.amulet?.shortName
          ].filter(Boolean).join(" / ");
          const role = index === 0 ? "front" : `back ${index}`;
          const classLabel = klass ? `${klass.glyph} ${klass.name}` : "";
          const cooldown = member.signatureCooldown || 0;
          const sigNote = index === 0 && klass ? (cooldown > 0 ? ` · sig in ${cooldown}` : " · sig ready") : "";
          row.title = `${member.name} (${role}${classLabel ? `, ${klass.name}` : ""})${sigNote}${gear ? ` — ${gear}` : ""}`;
          row.dataset.memberIndex = index;
          const portrait = typeof memberPortrait === "function" ? memberPortrait(member) : null;
          row.innerHTML = `
            <div class="party-name">${portrait ? `<img class="party-portrait" src="${portrait}" alt="">` : classLabel ? `<span class="class-tag">${escapeHtml(klass.glyph)}</span>` : ""}${escapeHtml(member.name)}</div>
            <div class="meter" aria-label="${member.name} hit points"><div class="meter-fill" style="--value:${percent(member.hp, member.maxHp)}"></div></div>
            <div class="hp-text">${member.hp}/${member.maxHp}</div>
            <div class="party-stats">${memberPower(member)}/${memberDefense(member)}</div>
          `;
          els.party.appendChild(row);
        }
        bindItemDragDrop();
      }

      function renderShopList() {
        if (typeof renderShopModalBody === "function") renderShopModalBody();
      }

      function renderStatsModal() {
        if (!els.statsList) return;
        const lt = typeof lifetimeStats === "function" ? lifetimeStats() : null;
        if (!lt) { els.statsList.innerHTML = ""; return; }
        const minutes = Math.round((lt.playMs || 0) / 60000);
        const winRate = lt.runs > 0 ? Math.round((lt.victories / lt.runs) * 100) : 0;
        const lines = [
          ["Runs played", `${lt.runs || 0}`],
          ["Victories / defeats", `${lt.victories || 0} / ${lt.defeats || 0}`],
          ["Win rate", `${winRate}%`],
          ["Total kills", `${lt.kills || 0}`],
          ["Total gold earned", `${lt.gold || 0}`],
          ["Damage dealt / taken", `${lt.damageDealt || 0} / ${lt.damageTaken || 0}`],
          ["Deepest floor", `${(lt.deepestFloor || 0) + 1}`],
          ["Best score", `${lt.bestScore || 0}`],
          ["Time played", `${minutes} min`]
        ];
        els.statsList.innerHTML = lines.map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
      }

      // Name + portrait + class picker, with the fixed action pair and its costs.
      // Keep lore out of this dialog; the rules must be visible before starting.
      // Clicking the portrait cycles through the class's choices (our
      // original art plus fitting DCSS tiles); changing class resets to that
      // class's default.
      function renderCharacterCreate() {
        if (!els.characterCreateList) return;
        const klasses = typeof getClassDefinitions === "function" ? getClassDefinitions() : [];
        const warning = context.saveLoadError ? `<p role="alert">${escapeHtml(context.saveLoadError)}</p>` : "";
        els.characterCreateList.innerHTML = warning + state.party.map((member, index) => {
          const current = member.classKey || "";
          const klass = klasses.find((entry) => entry.key === current);
          const optionsHtml = klasses.map((k) => `<option value="${k.key}" ${current === k.key ? "selected" : ""}>${k.glyph} ${k.name}</option>`).join("");
          const entry = typeof memberPortraitEntry === "function" ? memberPortraitEntry(member) : null;
          return `<div class="character-create-row">
            <label>
              ${entry ? `<button type="button" class="create-portrait" data-portrait-for="${index}" title="${escapeHtml(entry.label)} — click for another portrait"><img src="${entry.src}" alt="${escapeHtml(entry.label)}"></button>` : ""}
              <strong>${escapeHtml(member.name)}</strong>
              <select data-member-index="${index}" aria-label="Class and fixed actions for ${escapeHtml(member.name)}" ${state.characterCreated ? "disabled" : ""}>${optionsHtml}</select>
            </label>
            <p>${klass ? `${escapeHtml(klass.description)} Primary cooldown: ${klass.signatureCooldown} turns. Secondary cooldown: ${klass.ultimate.cooldown} turns.` : "Choose a class to see its two fixed actions."}</p>
          </div>`;
        }).join("");
      }

      function renderMarkersList() {
        if (!els.markersList) return;
        const markers = state.mapMarkers || [];
        if (markers.length === 0) {
          els.markersList.innerHTML = `<li><strong>No markers yet</strong><span>Stand on a cell and tap a marker button above.</span></li>`;
          return;
        }
        els.markersList.innerHTML = markers.map((m) => {
          const floor = resources.floors[m.floorIndex];
          const here = m.floorIndex === state.floorIndex && m.x === state.x && m.y === state.y ? " (here)" : "";
          return `<li><strong>${escapeHtml(m.kind)} on ${escapeHtml(floor?.id || "?")}</strong><span>(${m.x}, ${m.y})${here} · turn ${m.turn || "?"}</span></li>`;
        }).join("");
      }

      function setMapZoom(value) {
        const clamped = Math.max(0.5, Math.min(3, value));
        state.mapZoom = clamped;
        if (typeof renderMap === "function") renderMap();
      }

      function zoomMap(delta) {
        setMapZoom((state.mapZoom || 1) + delta);
      }

      function resetMapZoom() {
        setMapZoom(1);
      }

      function renderSaveSlotList() {
        if (!els.saveSlotList) return;
        const slots = typeof readSlotSummaries === "function" ? readSlotSummaries() : [];
        const active = typeof getActiveSlot === "function" ? getActiveSlot() : null;
        els.saveSlotList.innerHTML = slots.map(({ slot, index, summary }) => {
          const isActive = slot === active;
          const label = summary
            ? `Floor ${summary.floorId} · ${summary.turnCount}T · L${summary.level} · ${summary.gold}g · ${summary.difficulty}${summary.victory ? " · VICTORY" : summary.defeated ? " · defeated" : ""}`
            : "empty";
          return `<li>
            <strong>Slot ${index}${isActive ? " · ACTIVE" : ""}</strong>
            <span>${escapeHtml(label)}</span>
            <button type="button" class="dialogue-choice" data-save-slot="${escapeHtml(slot)}" ${isActive ? "disabled" : ""}>${isActive ? "In use" : "Load"}</button>
          </li>`;
        }).join("");
      }

      function showDialogue(title, body, choices) {
        if (!els.dialogueModal) return;
        if (els.dialogueTitle) els.dialogueTitle.textContent = title;
        if (els.dialogueBody) els.dialogueBody.textContent = body;
        if (els.dialogueChoices) {
          els.dialogueChoices.innerHTML = (choices || []).map((choice, idx) => `<button type="button" class="dialogue-choice" data-dialogue-idx="${idx}">${escapeHtml(choice.label)}</button>`).join("");
        }
        // Cache the choice callbacks on the context for the input handler.
        context.dialogueChoices = choices || [];
        els.dialogueModal.classList.remove("hidden");
      }

      function hideDialogue() {
        context.dialogueChoices = null;
        if (els.dialogueModal?.classList) els.dialogueModal.classList.add("hidden");
      }

      function renderCharacterList() {
        if (!els.characterList) return;
        const sets = typeof activeSetBonuses === "function" ? activeSetBonuses() : [];
        const setNote = sets.length > 0
          ? `<li><strong>Set bonuses</strong><span>${sets.map((s) => `${s.element} x${s.pieces} (+${s.power} power)`).join(", ")}</span></li>`
          : "";
        const klasses = typeof getClassDefinitions === "function" ? getClassDefinitions() : [];
        els.characterList.innerHTML = state.party.map((member, index) => {
          const klass = typeof classFor === "function" ? classFor(member) : null;
          const role = index === 0 ? "front-line" : `back ${index}`;
          const cd = member.signatureCooldown || 0;
          const secondaryCd = member.ultimateCooldown || 0;
          const sig = klass ? `<span>Primary (B): ${escapeHtml(klass.signature.label)} — ${escapeHtml(klass.signature.body)} (${cd > 0 ? `cooldown ${cd}` : "ready"}). Secondary (V): ${escapeHtml(klass.ultimate.label)} — ${escapeHtml(klass.ultimate.body)} (${secondaryCd > 0 ? `cooldown ${secondaryCd}` : "ready"}). Use Formation to bring this member to the front.</span>` : "";
          return `<li><strong>${escapeHtml(klass?.glyph || "·")} ${escapeHtml(member.name)} <em>(${escapeHtml(role)}${klass ? `, ${escapeHtml(klass.name)}` : ""})</em></strong><span>${klass ? escapeHtml(klass.description) : "No class assigned."}</span>${sig}</li>`;
        }).join("") + setNote;
      }

      function renderMap() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const width = floor.map.width;
        const height = floor.map.height;
        els.map.innerHTML = "";
        const zoom = Math.max(0.5, Math.min(3, state.mapZoom || 1));
        const cellSize = Math.round(9 * zoom);
        els.map.style.gridTemplateColumns = `repeat(${width}, ${cellSize}px)`;
        els.map.style.setProperty?.("--map-cell-size", `${cellSize}px`);

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const node = document.createElement("div");
            const seen = floorState.discovered.has(keyOf(x, y));
            const monster = seen && monsterAt(x, y);
            const item = seen && itemAt(x, y);
            const trap = seen && trapAt(x, y);
            const decor = seen && decorAt(x, y);
            const cloud = seen && cloudAt(x, y);
            const stairs = seen && stairsAt(x, y);
            const openDoor = seen && doorCellAt(x, y) && !closedDoorAt(x, y);
            const floorMarks = seen ? floorMarksAt(x, y) : [];
            const kind = seen ? mapKind(x, y) : "";
            const terrain = seen && kind === "floor" ? terrainAt(x, y) : "";
            const labels = [];
            const viewClass = seen ? mapViewClass(x, y) : "";

            node.className = `map-cell ${seen ? `seen ${kind}` : ""}`;
            if (terrain && terrain !== "floor") node.classList.add(terrain);
            if (viewClass) node.classList.add(viewClass);
            if (seen && kind === "door") {
              node.textContent = "+";
              labels.push("door");
            }
            if (openDoor) {
              node.classList.add("open-door");
              node.textContent = "/";
              labels.push("open door");
            }
            if (stairs) {
              node.classList.add("stairs");
              node.textContent = stairs.direction === "down" ? ">" : "<";
              labels.push(stairs.direction === "down" ? "downstairs" : "upstairs");
            }
            if (item) {
              node.classList.add(item.kind === "quest" ? "prize" : item.kind === "gold" ? "gold" : "item");
              node.textContent = item.kind === "quest" ? "*" : item.kind === "gold" ? "$" : "%";
              labels.push(item.name);
            }
            if (trap) {
              node.classList.add("trap");
              node.textContent = "^";
              labels.push(trap.name);
            }
            if (decor) {
              node.classList.add("decor");
              if (decorUsed(decor)) node.classList.add("spent");
              if (decor.kind === "chest") node.classList.add("chest");
              node.textContent = decorUsed(decor) ? "." : decor.kind === "chest" ? "▢" : "o";
              labels.push(decorUsed(decor) ? `${decor.name} spent` : decor.name);
            }
            if (cloud) {
              const kind = cloud.kind || "fog";
              node.classList.add("cloud", kind);
              node.textContent = kind === "poison" ? "p" : kind === "flame" ? "f" : "~";
              labels.push(`${kind} ${cloud.turns}`);
            }
            if (floorMarks.length > 0 && kind === "floor") {
              const mark = floorMarks.at(-1);
              node.classList.add("mark", mark.kind);
              if (!stairs && !item && !trap && !decor && !cloud && !monster) node.textContent = "·";
              labels.push(`${mark.kind} mark`);
            }
            if (monster) {
              node.classList.add("monster");
              if (monster.immolationTurns > 0) node.classList.add("inner-flame");
              if (monster.ranged) node.classList.add("ranged");
              if (monster.boss) node.classList.add("boss");
              node.textContent = monster.boss ? monster.name[0].toUpperCase() : monster.name[0].toLowerCase();
              labels.push(monster.name);
            }
            const ally = seen && typeof allyAt === "function" && allyAt(x, y);
            if (ally) {
              node.classList.add("ally");
              node.textContent = ally.name[0].toLowerCase();
              labels.push(`${ally.name} (ally)`);
            }
            const marker = (state.mapMarkers || []).find((m) => m.floorIndex === state.floorIndex && m.x === x && m.y === y);
            if (marker) {
              node.classList.add("mark-user", `marker-${marker.kind}`);
              if (!monster && !item && !decor) {
                node.textContent = marker.kind === "warn" ? "!" : marker.kind === "treasure" ? "★" : "⛳";
              }
              labels.push(`marker: ${marker.kind}`);
            }
            if (state.x === x && state.y === y) {
              node.classList.add("hero");
              node.textContent = "@";
              labels.unshift("party");
            }
            if (labels.length > 0) node.title = labels.join(", ");
            els.map.appendChild(node);
          }
        }
      }

      function renderInventory() {
        els.inventory.innerHTML = "";
        const view = typeof visibleInventory === "function" ? visibleInventory() : state.inventory;
        const filterLabel = state.inventoryFilter && state.inventoryFilter !== "all" ? ` ${state.inventoryFilter}` : "";
        const sortLabel = state.inventorySort && state.inventorySort !== "default" ? ` · ${state.inventorySort}` : "";
        const load = typeof carriedWeight === "function" && typeof carryCapacity === "function" ? ` · ${carriedWeight()}/${carryCapacity()}wt` : "";
        els.inventoryCount.textContent = `${view.length}/${state.inventory.length}${filterLabel}${sortLabel}${load} · ${state.gold}g`;
        for (const item of view) {
          const originalIndex = state.inventory.indexOf(item);
          const shortcut = inventoryShortcut(originalIndex);
          const rarity = typeof itemRarity === "function" ? itemRarity(item) : "common";
          const unidentified = typeof isUnidentified === "function" && isUnidentified(item);
          const cursed = typeof isCursed === "function" && isCursed(item) && !item.unidentified;
          const blessed = typeof isBlessed === "function" && isBlessed(item) && !item.unidentified;
          const wrapper = document.createElement("div");
          const classes = ["inventory-item", `rarity-${rarity}`];
          if (unidentified) classes.push("unidentified");
          if (cursed) classes.push("cursed");
          if (blessed) classes.push("blessed");
          wrapper.className = classes.join(" ");
          const displayName = typeof displayItemName === "function" ? displayItemName(item) : item.name;
          // No title attribute: the native tooltip is slow and thin. The
          // instant one is drawn by the delegated hover handler below.
          wrapper.innerHTML = `
            <button type="button" draggable="true" aria-label="${escapeHtml(displayName)}" data-item="${item.id}">
              <img src="${item.tile}" alt="">
              ${shortcut ? `<b class="inventory-key">${shortcut}</b>` : ""}
            </button>
            <span>${escapeHtml(displayName)}${item.charges ? ` ${item.charges}` : ""}</span>
          `;
          els.inventory.appendChild(wrapper);
        }
        bindItemTooltip();
        bindItemDragDrop();
      }

      // Drag items out of the pack: onto a party member to hand it to them
      // (wearables equip on that member), or into the dungeon view to throw
      // it. One delegated binding; rows/buttons are rebuilt every render.
      function dropItemOnMember(itemId, memberIndex) {
        const item = state.inventory.find((entry) => entry.id === itemId);
        if (!item) return;
        if (typeof equipKindSpec === "function" && equipKindSpec(item.kind) && typeof equipItemToMember === "function") {
          equipItemToMember(memberIndex, itemId);
          return;
        }
        useItem(itemId);
      }

      let itemDragDropBound = false;

      function bindItemDragDrop() {
        if (itemDragDropBound) return;
        if (!els.inventory?.addEventListener || !els.party?.addEventListener || !els.viewport?.addEventListener) return;
        itemDragDropBound = true;
        els.inventory.addEventListener("dragstart", (event) => {
          const button = event.target?.closest?.("button[data-item]");
          if (!button || !event.dataTransfer) return;
          event.dataTransfer.setData("text/plain", button.dataset.item);
          event.dataTransfer.effectAllowed = "move";
          hideItemTooltip();
        });
        const allowDrop = (event) => {
          if (event.dataTransfer?.types?.includes?.("text/plain")) event.preventDefault();
        };
        els.party.addEventListener("dragover", allowDrop);
        els.party.addEventListener("drop", (event) => {
          const row = event.target?.closest?.("[data-member-index]");
          const id = event.dataTransfer?.getData("text/plain");
          if (!row || !id) return;
          event.preventDefault();
          dropItemOnMember(id, Number.parseInt(row.dataset.memberIndex, 10));
        });
        els.viewport.addEventListener("dragover", allowDrop);
        els.viewport.addEventListener("drop", (event) => {
          const id = event.dataTransfer?.getData("text/plain");
          if (!id) return;
          event.preventDefault();
          if (typeof throwInventoryItem === "function") throwInventoryItem(id);
        });
      }

      // Instant, information-dense hover card for inventory items: what the
      // item does, its numbers, and its flavour — shown the moment the cursor
      // touches it, no native-tooltip delay.
      let itemTooltipNode = null;
      let itemTooltipBound = false;

      function itemTooltipHtml(info) {
        const flags = [info.cursed ? "cursed" : "", info.blessed ? "blessed" : "", info.slot ? `equips: ${info.slot}` : ""].filter(Boolean).join(" · ");
        return `
          <strong>${escapeHtml(info.name)}</strong>
          ${flags ? `<em class="tooltip-flags">${escapeHtml(flags)}</em>` : ""}
          <span class="tooltip-effect">${escapeHtml(info.effect)}</span>
          <span class="tooltip-stats">${escapeHtml(info.stats.join(" · "))}</span>
          ${info.lore ? `<span class="tooltip-lore">${escapeHtml(info.lore)}</span>` : ""}
        `;
      }

      function positionItemTooltip(event) {
        if (!itemTooltipNode || !itemTooltipNode.style) return;
        const pad = 14;
        const width = itemTooltipNode.offsetWidth || 240;
        const height = itemTooltipNode.offsetHeight || 90;
        const viewWidth = window.innerWidth || 1280;
        const viewHeight = window.innerHeight || 800;
        let x = event.clientX + pad;
        let y = event.clientY + pad;
        if (x + width > viewWidth - 4) x = event.clientX - width - pad;
        if (y + height > viewHeight - 4) y = event.clientY - height - pad;
        itemTooltipNode.style.left = `${Math.max(4, x)}px`;
        itemTooltipNode.style.top = `${Math.max(4, y)}px`;
      }

      function hideItemTooltip() {
        if (itemTooltipNode?.classList) itemTooltipNode.classList.add("hidden");
      }

      function bindItemTooltip() {
        if (itemTooltipBound) return;
        if (!els.inventory || typeof els.inventory.addEventListener !== "function") return;
        if (typeof document.createElement !== "function" || !document.body?.appendChild) return;
        itemTooltipBound = true;
        itemTooltipNode = document.createElement("div");
        itemTooltipNode.className = "item-tooltip hidden";
        document.body.appendChild(itemTooltipNode);
        els.inventory.addEventListener("mouseover", (event) => {
          const button = event.target?.closest?.("button[data-item]");
          if (!button || typeof itemInfo !== "function") return;
          const item = state.inventory.find((entry) => entry.id === button.dataset.item);
          const info = item && itemInfo(item);
          if (!info) return;
          itemTooltipNode.innerHTML = itemTooltipHtml(info);
          itemTooltipNode.classList.remove("hidden");
          positionItemTooltip(event);
        });
        els.inventory.addEventListener("mousemove", positionItemTooltip);
        els.inventory.addEventListener("mouseout", (event) => {
          if (!event.relatedTarget || !els.inventory.contains?.(event.relatedTarget)) hideItemTooltip();
        });
        els.inventory.addEventListener("click", hideItemTooltip);
      }

      function renderLog() {
        els.logCount.textContent = String(state.messageLog.length);
        els.log.innerHTML = state.messageLog.map((message) => `<div>${escapeHtml(message)}</div>`).join("");
      }

      function renderChrome() {
        rememberMessage();
        els.messageLine.textContent = state.message;
        const hasteStatus = state.hasteTurns > 0 ? ` · haste ${state.hasteTurns}` : "";
        const mightStatus = state.mightTurns > 0 ? ` · might ${state.mightTurns}` : "";
        const rageStatus = state.rageTurns > 0 ? ` · rage ${state.rageTurns}` : "";
        const resistanceStatus = state.resistanceTurns > 0 ? ` · resist ${state.resistanceTurns}` : "";
        const silenceStatus = state.silenceTurns > 0 ? ` · silence ${state.silenceTurns}` : "";
        const snareStatus = state.snaredTurns > 0 ? ` · snared ${state.snaredTurns}` : "";
        const barbedStatus = state.barbedTurns > 0 ? ` · barbs ${state.barbedTurns}` : "";
        const engulfedStatus = state.engulfedTurns > 0 ? ` · engulfed ${state.engulfedTurns}` : "";
        const slowStatus = state.slowedTurns > 0 ? ` · slow ${state.slowedTurns}` : "";
        const poisonStatus = state.poisonedTurns > 0 ? ` · poisoned ${state.poisonedTurns}` : "";
        const dazedStatus = state.dazedTurns > 0 ? ` · dazed ${state.dazedTurns}` : "";
        const corrodedStatus = state.corrodedTurns > 0 ? ` · corroded ${state.corrodedTurns}` : "";
        const vitrifiedStatus = state.vitrifiedTurns > 0 ? ` · vitrified ${state.vitrifiedTurns}` : "";
        const difficultyTag = state.difficulty && state.difficulty !== "normal" ? ` · ${state.difficulty}` : "";
        const dailyTag = state.dailySeed ? ` · daily ${state.dailySeed}` : "";
        const satiety = state.satiety ?? 1000;
        const hungerTag = context.hungerDisabled ? "" : satiety <= 0 ? " · famished" : satiety < 50 ? " · starving" : satiety < 200 ? " · hungry" : satiety < 400 ? " · peckish" : "";
        const talentTag = (state.talentPoints || 0) > 0 ? ` · ${state.talentPoints} talent` : "";
        const comboTag = (state.killCombo || 0) >= 3 ? ` · combo x${Math.floor(state.killCombo / 3) + 1}` : "";
        const allyTag = typeof liveAllies === "function" && liveAllies().length > 0 ? ` · ${liveAllies().length} ally` : "";
        const deityTag = state.deity && state.deity !== "none" ? ` · ${state.deity}` : "";
        const encTag = typeof isOverEncumbered === "function" && isOverEncumbered() ? " · over-encumbered" : "";
        const orbHeld = hasPrize();
        // Show rune progress toward the seal of Zot until the Orb is in hand.
        const runesNeeded = state.runesInWorld != null && typeof requiredRunesForZot === "function" ? requiredRunesForZot() : 0;
        const runeTag = !orbHeld && runesNeeded > 0 && typeof runesHeld === "function" ? ` · runes ${runesHeld()}/${runesNeeded}` : "";
        const orbTag = orbHeld ? " · orb held — flee!" : "orb below";
        els.statusLine.textContent = `T${state.turnCount} (F${state.floorTurnCount || 0}) · L${state.level} ${state.experience}/${state.nextLevel} XP · ${state.gold}g${hasteStatus}${mightStatus}${rageStatus}${resistanceStatus}${silenceStatus}${snareStatus}${barbedStatus}${engulfedStatus}${slowStatus}${poisonStatus}${dazedStatus}${corrodedStatus}${vitrifiedStatus}${hungerTag}${talentTag}${comboTag}${allyTag}${deityTag}${encTag}${runeTag} · ${orbTag} · ${state.party.filter((member) => member.hp > 0).length}/4 up${difficultyTag}${dailyTag}`;
        els.versionBadge.textContent = `v${resources.version}`;
        const hazard = typeof currentHazard === "function" && !context.hazardsDisabled ? currentHazard() : null;
        const hazardTag = hazard && hazard.id !== "none" ? ` · ${hazard.name}` : "";
        els.floorBadge.textContent = `${currentFloor().id}/${resources.floors.length} · ${floorExploredPercent()}%${hazardTag}`;
        els.facingBadge.textContent = dirs[state.dir].name;
        renderParty();
        renderInventory();
        renderLog();
      }

      const shiftedDigitKeys = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"];

      function inventoryShortcut(index) {
        if (index < 9) return String(index + 1);
        if (index === 9) return "0";
        if (index >= 10 && index <= 19) return shiftedDigitKeys[index - 10];
        return "";
      }

      function inventoryIndexForKey(key) {
        if (key >= "1" && key <= "9") return Number.parseInt(key, 10) - 1;
        if (key === "0") return 9;
        const shiftIndex = shiftedDigitKeys.indexOf(key);
        if (shiftIndex >= 0) return 10 + shiftIndex;
        return -1;
      }

      function clearEffectsSoon() {
        if (state.effects.length === 0 || effectTimer) return;
        effectTimer = window.setTimeout(() => {
          state.effects = [];
          effectTimer = 0;
          renderViewport();
        }, 320);
      }

      function showHelpModal() {
        if (!els.helpModal || !els.helpModal.classList) return;
        els.helpModal.classList.remove("hidden");
      }

      function hideHelpModal() {
        if (!els.helpModal || !els.helpModal.classList) return;
        els.helpModal.classList.add("hidden");
      }

      function toggleHelpModal() {
        if (!els.helpModal || !els.helpModal.classList) return;
        if (els.helpModal.classList.contains("hidden")) showHelpModal();
        else hideHelpModal();
      }

      function showModal(name) {
        const node = els[name];
        if (!node || !node.classList) return;
        if (name === "achievementsModal") renderAchievementsList();
        if (name === "historyModal") renderHistoryList();
        if (name === "characterModal") renderCharacterList();
        if (name === "characterCreateModal") renderCharacterCreate();
        if (name === "talentsModal" && typeof renderTalentsModal === "function") renderTalentsModal();
        if (name === "markersModal") renderMarkersList();
        if (name === "saveSlotsModal") renderSaveSlotList();
        if (name === "bestiaryModal" && typeof renderBestiaryModal === "function") renderBestiaryModal();
        if (name === "statsModal") renderStatsModal();
        if (name === "questsModal" && typeof renderQuestModal === "function") renderQuestModal();
        if (name === "shopModal") renderShopList();
        node.classList.remove("hidden");
      }

      function hideAllModals() {
        const modals = ["helpModal", "legendModal", "settingsModal", "achievementsModal", "historyModal", "tutorialModal", "characterModal", "characterCreateModal", "talentsModal", "markersModal", "saveSlotsModal", "shopModal", "dialogueModal", "moreActionsModal", "bestiaryModal", "questsModal", "statsModal"];
        for (const name of modals) {
          const node = els[name];
          if (node?.classList && !node.classList.contains("hidden")) node.classList.add("hidden");
        }
      }

      function renderAchievementsList() {
        if (!els.achievementsList || !els.achievementsList.innerHTML === undefined) return;
        const achievements = typeof getAchievements === "function" ? getAchievements() : [];
        const unlocked = typeof unlockedAchievements === "function" ? unlockedAchievements() : new Set();
        els.achievementsList.innerHTML = achievements.map((entry) => {
          const isUnlocked = unlocked.has(entry.id);
          return `<li class="${isUnlocked ? "unlocked" : "locked"}"><strong>${escapeHtml(entry.name)}${isUnlocked ? " ✓" : ""}</strong><span>${escapeHtml(entry.description)}</span></li>`;
        }).join("");
      }

      function renderHistoryList() {
        if (!els.historyList) return;
        const meta = typeof readMeta === "function" ? readMeta() : { runs: [] };
        const runs = meta.runs || [];
        if (runs.length === 0) {
          els.historyList.innerHTML = `<li><strong>No runs yet</strong><span>Finish a run to record it here.</span></li>`;
          return;
        }
        els.historyList.innerHTML = runs.slice(0, 10).map((run) => {
          const date = run.finishedAt ? new Date(run.finishedAt).toISOString().slice(0, 19).replace("T", " ") : "?";
          const outcome = run.outcome === "victory" ? "Victory" : run.outcome === "defeat" ? "Defeat" : "Abandoned";
          return `<li><strong>${escapeHtml(outcome)} on ${escapeHtml(run.floor || "?")}</strong><span>${escapeHtml(date)} · ${run.turns || 0} turns · ${run.gold || 0}g · ${run.monstersDefeated || 0} kills · score ${run.score || 0}</span></li>`;
        }).join("");
      }

      function showToast(text, duration = 2200) {
        if (!els.toast || !els.toast.classList) return;
        els.toast.textContent = text;
        els.toast.classList.remove("hidden");
        if (window.clearTimeout && toastTimer) window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
          els.toast?.classList?.add("hidden");
          toastTimer = 0;
        }, duration);
      }

      function shakeViewport(intensity = 1) {
        const node = els.viewport;
        if (!node || !node.classList) return;
        const cls = intensity >= 2 ? "shake-hard" : "shake";
        node.classList.remove("shake", "shake-hard");
        // Force reflow so re-adding the class restarts the animation.
        void (node.offsetWidth);
        node.classList.add(cls);
        if (shakeTimer) window.clearTimeout(shakeTimer);
        shakeTimer = window.setTimeout(() => {
          node.classList.remove("shake", "shake-hard");
          shakeTimer = 0;
        }, 360);
      }

      // Queue a floating combat number. Kept in state.floaters for testability;
      // the DOM nodes are created best-effort over the viewport.
      function queueFloater(value, kind) {
        if (!state.floaters) state.floaters = [];
        const floater = { value: String(value), kind: kind || "damage", at: Date.now() };
        state.floaters.push(floater);
        state.floaters = state.floaters.slice(-12);
        spawnFloaterNode(floater);
        return floater;
      }

      function spawnFloaterNode(floater) {
        const node = els.viewport;
        if (!node || typeof document.createElement !== "function" || typeof node.appendChild !== "function") return;
        let el;
        try {
          el = document.createElement("div");
        } catch (e) { return; }
        if (!el || !el.classList) return;
        el.className = `combat-floater floater-${floater.kind}`;
        el.textContent = floater.value;
        // Spread stacked hits deterministically (no Math.random — it must not
        // perturb the seeded combat RNG used by tests).
        const offset = 40 + ((state.floaters.length * 7) % 20);
        if (el.style) {
          el.style.left = `${offset}%`;
        }
        node.appendChild(el);
        if (window.setTimeout) {
          window.setTimeout(() => { try { el.remove?.(); } catch (e) {} }, 900);
        }
      }

      function flashCrit() {
        const node = els.critFlash;
        if (!node || !node.classList) return;
        node.classList.add("show");
        if (critFlashTimer) window.clearTimeout(critFlashTimer);
        critFlashTimer = window.setTimeout(() => {
          node.classList.remove("show");
          critFlashTimer = 0;
        }, 180);
      }

      let viewportInteractionsBound = false;

      function viewportInteractionLayer() {
        const viewport = els.viewport;
        if (!viewport) return null;
        let layer = typeof viewport.querySelector === "function" ? viewport.querySelector(".viewport-interactive-layer") : null;
        if (!layer && typeof document.createElement === "function" && typeof viewport.appendChild === "function") {
          layer = document.createElement("div");
          layer.className = "viewport-interactive-layer";
          layer.setAttribute?.("aria-label", "Viewport actions");
          viewport.appendChild(layer);
        }
        return layer;
      }

      function viewportTargetStyle(target, viewportWidth, viewportHeight) {
        const targetWidth = Math.max(target.enabled ? 68 : 44, Math.min(180, target.rect.width * 1.18));
        const targetHeight = Math.max(target.enabled ? 30 : 22, Math.min(52, target.rect.height * 1.12));
        const centerX = target.rect.x + target.rect.width / 2;
        const centerY = target.rect.y + target.rect.height / 2;
        const clampedX = Math.max(targetWidth / 2 + 4, Math.min(viewportWidth - targetWidth / 2 - 4, centerX));
        const clampedY = Math.max(targetHeight / 2 + 4, Math.min(viewportHeight - targetHeight / 2 - 4, centerY));
        return `left:${clampedX.toFixed(2)}px;top:${clampedY.toFixed(2)}px;--target-w:${targetWidth.toFixed(2)}px;--target-h:${targetHeight.toFixed(2)}px`;
      }

      function viewportTargetHtml(target, viewportWidth, viewportHeight) {
        const classes = `viewport-target ${target.enabled ? "enabled" : "passive"} target-${target.kind}`;
        const label = escapeHtml(target.label);
        const attrs = `class="${classes}" style="${viewportTargetStyle(target, viewportWidth, viewportHeight)}" data-viewport-target="${escapeHtml(target.id)}" data-kind="${escapeHtml(target.kind)}" data-enabled="${target.enabled ? "true" : "false"}" title="${label}"`;
        if (target.enabled) return `<button type="button" ${attrs} data-action="${escapeHtml(target.action)}" aria-label="${label}">${label}</button>`;
        return `<span ${attrs} aria-hidden="true">${label}</span>`;
      }

      function renderViewportInteractions(width, height) {
        const layer = viewportInteractionLayer();
        if (!layer || typeof viewportInteractionTargets !== "function") return;
        bindViewportInteractionTargets();
        layer.innerHTML = viewportInteractionTargets(width, height).map((target) => viewportTargetHtml(target, width, height)).join("");
      }

      function handleViewportInteractionClick(event) {
        const target = event.target?.closest?.(".viewport-target[data-enabled='true'][data-action]");
        if (!target) return false;
        const action = target.dataset?.action;
        if (!action || typeof handleAction !== "function") return false;
        event.preventDefault?.();
        event.stopPropagation?.();
        handleAction(action);
        return true;
      }

      function bindViewportInteractionTargets() {
        if (viewportInteractionsBound) return;
        if (!els.viewport || typeof els.viewport.addEventListener !== "function") return;
        els.viewport.addEventListener("click", handleViewportInteractionClick);
        viewportInteractionsBound = true;
      }

      function renderCompass() {
        if (!els.compass) return;
        const arrow = els.compass.querySelector(".compass-arrow");
        const coords = els.compass.querySelector(".compass-coords");
        const arrows = ["↑", "→", "↓", "←"];
        if (arrow) arrow.textContent = arrows[state.dir] || "↑";
        if (coords) coords.textContent = `${state.x},${state.y} · ${dirs[state.dir].name}`;
      }

      function updateLowHpBorder() {
        if (typeof document === "undefined" || !document.body) return;
        const leader = state.party[0];
        const critical = leader && leader.hp > 0 && leader.hp / leader.maxHp < 0.25;
        if (critical) document.body.classList?.add("low-hp-warning");
        else document.body.classList?.remove("low-hp-warning");
      }

      function renderEndModal() {
        if (!els.endModal || !els.endModal.classList) return;
        if (!state.victory && !state.defeated) {
          els.endModal.classList.add("hidden");
          return;
        }
        if (!state.endRecorded) {
          state.endRecorded = true;
          if (typeof recordRunResult === "function") recordRunResult();
          if (typeof evaluateAchievements === "function") evaluateAchievements();
          if (typeof pulse === "function") pulse(state.victory ? "victory" : "defeat");
        }
        if (els.endModalTitle) {
          els.endModalTitle.textContent = state.victory ? "Victory" : "The run ends.";
        }
        if (els.endModalBody) {
          els.endModalBody.textContent = state.message || (state.victory ? "The party emerges from the dungeon." : "The dungeon takes the party.");
        }
        if (els.endModalStats) {
          const survivors = state.party.filter((member) => member.hp > 0).length;
          const meta = typeof readMeta === "function" ? readMeta() : { best: null };
          const best = meta.best;
          const score = typeof computeRunScore === "function" ? computeRunScore({
            gold: state.gold || 0,
            monstersDefeated: state.monstersDefeated || 0,
            floorIndex: state.floorIndex || 0,
            orb: hasPrize() || state.victory,
            outcome: state.victory ? "victory" : state.defeated ? "defeat" : "abandoned",
            turns: state.turnCount || 0
          }) : 0;
          const lines = [
            ["Floor reached", `${currentFloor().id} (${state.floorIndex + 1}/${resources.floors.length})`],
            ["Turns", `${state.turnCount}`],
            ["Score", `${score}${best ? ` (best ${best.score || 0})` : ""}`],
            ["Gold", `${state.gold}`],
            ["Level", `${state.level} (${state.experience}/${state.nextLevel} XP)`],
            ["Monsters defeated", `${state.monstersDefeated || 0}`],
            ["Damage dealt / taken", `${state.damageDealt || 0} / ${state.damageTaken || 0}`],
            ["Critical hits", `${state.criticalHits || 0}`],
            ["Doors / traps / items", `${state.doorsOpened || 0} / ${state.trapsDisarmed || 0} / ${state.itemsCollected || 0}`],
            ["Party upright", `${survivors}/${state.party.length}`],
            ["Difficulty", `${state.difficulty || "normal"}${state.dailySeed ? ` · daily ${state.dailySeed}` : ""}${(state.ascension || 0) > 0 ? ` · NG+${state.ascension}` : ""}`],
            state.defeated && state.lastAttacker ? ["Slain by", `${state.lastAttacker} on ${currentFloor().id}`] : null,
            ["Orb of Zot Soup", hasPrize() || state.victory ? "recovered" : "still below"]
          ].filter(Boolean);
          els.endModalStats.innerHTML = lines.map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
        }
        els.endModal.classList.remove("hidden");
      }

      function render() {
        if (typeof scanDiscoveredMonsters === "function") scanDiscoveredMonsters();
        renderViewport();
        renderMap();
        renderChrome();
        renderEndModal();
        renderCompass();
        updateLowHpBorder();
        clearEffectsSoon();
      }

      Object.assign(context, {
        renderParty,
        renderMap,
        renderInventory,
        renderLog,
        renderChrome,
        inventoryShortcut,
        inventoryIndexForKey,
        clearEffectsSoon,
        showHelpModal,
        hideHelpModal,
        toggleHelpModal,
        showModal,
        hideAllModals,
        renderAchievementsList,
        renderHistoryList,
        renderStatsModal,
        renderCharacterList,
        renderCharacterCreate,
        renderMarkersList,
        renderSaveSlotList,
        setMapZoom,
        zoomMap,
        resetMapZoom,
        showDialogue,
        hideDialogue,
        showToast,
        flashCrit,
        viewportInteractionLayer,
        viewportTargetStyle,
        viewportTargetHtml,
        renderViewportInteractions,
        handleViewportInteractionClick,
        bindViewportInteractionTargets,
        shakeViewport,
        queueFloater,
        renderCompass,
        updateLowHpBorder,
        renderEndModal,
        render,
      });
    }
  };
}());
