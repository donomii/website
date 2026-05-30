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
          row.innerHTML = `
            <div class="party-name">${classLabel ? `<span class="class-tag">${escapeHtml(klass.glyph)}</span>` : ""}${escapeHtml(member.name)}</div>
            <div class="meter" aria-label="${member.name} hit points"><div class="meter-fill" style="--value:${percent(member.hp, member.maxHp)}"></div></div>
            <div class="hp-text">${member.hp}/${member.maxHp}</div>
            <div class="party-stats">${memberPower(member)}/${memberDefense(member)}</div>
          `;
          els.party.appendChild(row);
        }
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

      function renderCharacterCreate() {
        if (!els.characterCreateList) return;
        const klasses = typeof getClassDefinitions === "function" ? getClassDefinitions() : [];
        els.characterCreateList.innerHTML = state.party.map((member, index) => {
          const current = member.classKey || "";
          const optionsHtml = klasses.map((k) => `<option value="${k.key}" ${current === k.key ? "selected" : ""}>${k.glyph} ${k.name}</option>`).join("");
          const desc = klasses.find((k) => k.key === current)?.description || "";
          // Append the real DCSS background flavour the class echoes.
          const lore = typeof classLore === "function" ? classLore(current) : "";
          const loreHtml = lore ? `<span class="character-create-lore">${escapeHtml(lore)}</span>` : "";
          return `<div class="character-create-row">
            <label>
              <strong>${escapeHtml(member.name)}</strong>
              <select data-member-index="${index}">${optionsHtml}</select>
            </label>
            <p class="character-create-desc" data-desc-for="${index}">${escapeHtml(desc)}${loreHtml}</p>
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
          const sig = klass ? `<span>${escapeHtml(klass.signature.label)}: ${escapeHtml(klass.signature.body)} (${cd > 0 ? `cooldown ${cd}` : "ready"})</span>` : "";
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
        els.inventoryCount.textContent = `${view.length}/${state.inventory.length}${filterLabel}${sortLabel}`;
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
          const valueText = typeof itemValue === "function" ? ` · ${itemValue(item)}g` : "";
          // Real DCSS item flavour in the tooltip (identified items only).
          const lore = !unidentified && typeof itemLore === "function" ? itemLore(item.name) : "";
          const loreText = lore ? `\n${lore}` : "";
          wrapper.innerHTML = `
            <button type="button" title="${shortcut ? `${shortcut}: ` : ""}${escapeHtml(displayName)}${valueText}${escapeHtml(loreText)}" aria-label="${escapeHtml(displayName)}" data-item="${item.id}">
              <img src="${item.tile}" alt="">
              ${shortcut ? `<b class="inventory-key">${shortcut}</b>` : ""}
            </button>
            <span>${escapeHtml(displayName)}${item.charges ? ` ${item.charges}` : ""}</span>
          `;
          els.inventory.appendChild(wrapper);
        }
      }

      function renderNearby() {
        const forward = dirAt(0);
        const target = monsterAt(state.x + forward.x, state.y + forward.y);
        const item = itemAt(state.x, state.y);
        const stairs = stairsAt(state.x, state.y);
        const doorX = state.x + forward.x;
        const doorY = state.y + forward.y;
        const currentTrap = trapAt(state.x, state.y);
        const frontTrap = trapAt(doorX, doorY);
        const frontDoor = doorCellAt(doorX, doorY) ? { x: doorX, y: doorY, closed: closedDoorAt(doorX, doorY) } : null;
        const features = visibleFeatures();
        const rangedThreat = features.find((feature) => feature.ranged);
        els.threatBadge.textContent = target ? "front" : currentTrap || frontTrap ? "trap" : item ? "item" : stairs ? "stairs" : frontDoor ? "door" : rangedThreat ? "ranged" : `${features.length} seen`;
        if (target) {
          const traitDetails = [];
          if (target.fearTurns > 0) traitDetails.push(`afraid ${target.fearTurns}`);
          if (target.rootedTurns > 0) traitDetails.push(`rooted ${target.rootedTurns}`);
          if (target.poisonedTurns > 0) traitDetails.push(`poisoned ${target.poisonedTurns}`);
          if (target.immolationTurns > 0) traitDetails.push(`inner flame ${target.immolationTurns}`);
          if (target.hasteTurns > 0) traitDetails.push(`hasted ${target.hasteTurns}`);
          if (target.mightTurns > 0) traitDetails.push(`might ${target.mightTurns}`);
          if (target.rageTurns > 0) traitDetails.push(`rage ${target.rageTurns}`);
          if (target.summoned) traitDetails.push(`summoned ${target.summonTurns || 0}`);
          if (target.traits?.airborne) traitDetails.push("airborne");
          if (target.traits?.maintainRange) traitDetails.push("keeps range");
          if (target.speed !== 10) traitDetails.push(`spd ${target.speed}`);
          if (target.ranged && state.silenceTurns > 0) traitDetails.push("silenced");
          if (target.ranged && state.silenceTurns <= 0) traitDetails.push(target.ranged.name);
          if (target.ranged?.element) traitDetails.push(target.ranged.element);
          if (target.ranged?.cloud) traitDetails.push(`${target.ranged.cloud} cloud`);
          if (target.ranged?.status) traitDetails.push(target.ranged.status);
          traitDetails.push(...supportSpellLabels(target));
          traitDetails.push(...mobilitySpellLabels(target));
          traitDetails.push(...selfSpellLabels(target));
          traitDetails.push(...summonSpellLabels(target));
          if (target.traits?.drainDamage) traitDetails.push("drain");
          if (target.traits?.blinkWith) traitDetails.push("blink");
          if (target.traits?.poisonTurns) traitDetails.push("poison");
          if (target.traits?.acidDamage) traitDetails.push("acid");
          if (target.traits?.electricDamage) traitDetails.push("discharge");
          if (target.traits?.fireDamage) traitDetails.push("fire");
          if (target.traits?.coldDamage) traitDetails.push("cold");
          if (target.traits?.vampiricDamage) traitDetails.push("vampiric");
          if (target.traits?.reachDamage) traitDetails.push("reach");
          if (target.traits?.dragDamage) traitDetails.push("drag");
          if (target.traits?.floodTurns) traitDetails.push("engulf");
          if (target.traits?.drownDamage) traitDetails.push("drown");
          if (target.traits?.rageTurns) traitDetails.push("rage");
          if (target.traits?.paralyseTurns) traitDetails.push("paralyse");
          if (target.traits?.barbedTurns) traitDetails.push("barbs");
          traitDetails.push(...monsterResistanceLabels(target));
          const habitat = monsterHabitatLabel(target);
          if (habitat) traitDetails.push(habitat);
          const traitDetail = traitDetails.length > 0 ? `, ${traitDetails.join(", ")}` : "";
          const intent = typeof predictMonsterIntent === "function" ? predictMonsterIntent(target) : "";
          const intentTag = intent ? `<br><em class="intent">next: ${escapeHtml(intent)}</em>` : "";
          const preview = typeof combatPreview === "function" ? combatPreview(target) : null;
          const previewTag = preview ? `<br><em class="preview">~${preview.perTurn}/turn · ${preview.turnsToKill} ${preview.turnsToKill === 1 ? "turn" : "turns"} to kill</em>` : "";
          els.nearby.innerHTML = `<strong>${target.name}</strong>${intentTag}${previewTag}<br>${target.hp}/${target.maxHp} HP, AC ${target.ac}, EV ${target.ev}${traitDetail}`;
          return;
        }
        if (currentTrap || frontTrap) {
          const trap = currentTrap || frontTrap;
          const place = currentTrap ? "underfoot" : "front";
          els.nearby.innerHTML = `<strong>${trap.name}</strong><br>${place} · ${trap.kind} ${trap.power} · Use disarms`;
          return;
        }
        if (item) {
          const detail = item.kind === "gold" ? `${item.value || 0} gold` : item.kind;
          els.nearby.innerHTML = `<strong>${item.name}</strong><br>at feet · ${detail}`;
          return;
        }
        if (stairs) {
          els.nearby.innerHTML = `<strong>${stairs.direction === "down" ? "Downstairs" : "Upstairs"}</strong><br>${hasPrize() && state.floorIndex === 0 ? "surface route" : currentFloor().name}`;
          return;
        }
        if (frontDoor) {
          const blocked = !frontDoor.closed && (monsterAt(frontDoor.x, frontDoor.y) || itemAt(frontDoor.x, frontDoor.y));
          const detail = frontDoor.closed ? "Use opens it" : blocked ? "blocked open" : "Use closes it";
          els.nearby.innerHTML = `<strong>${frontDoor.closed ? "Closed door" : "Open door"}</strong><br>${detail}`;
          return;
        }
        if (!features.length) {
          els.nearby.innerHTML = `<span class="nearby-empty">Only old air moves.</span>`;
          return;
        }
        els.nearby.innerHTML = `<div class="nearby-list">${features.map((feature) => `
          <div class="nearby-row ${feature.danger ? "danger" : ""} ${feature.ranged ? "ranged" : ""} ${feature.type === "prize" ? "prize" : ""} ${feature.type === "gold" ? "gold" : ""} ${feature.type === "trap" ? "trap" : ""} ${feature.type === "door" ? "door" : ""}">
            <em>${escapeHtml(feature.bearing)}</em>
            <strong>${escapeHtml(feature.name)}</strong>
            <span>${escapeHtml(feature.detail)} · ${feature.distance}</span>
          </div>
        `).join("")}</div>`;
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
        const hungerTag = satiety <= 0 ? " · famished" : satiety < 50 ? " · starving" : satiety < 200 ? " · hungry" : satiety < 400 ? " · peckish" : "";
        const talentTag = (state.talentPoints || 0) > 0 ? ` · ${state.talentPoints} talent` : "";
        const comboTag = (state.killCombo || 0) >= 3 ? ` · combo x${Math.floor(state.killCombo / 3) + 1}` : "";
        const allyTag = typeof liveAllies === "function" && liveAllies().length > 0 ? ` · ${liveAllies().length} ally` : "";
        const deityTag = state.deity && state.deity !== "none" ? ` · ${state.deity}` : "";
        const encTag = typeof isOverEncumbered === "function" && isOverEncumbered() ? " · over-encumbered" : "";
        els.statusLine.textContent = `T${state.turnCount} (F${state.floorTurnCount || 0}) · L${state.level} ${state.experience}/${state.nextLevel} XP · ${state.gold}g${hasteStatus}${mightStatus}${rageStatus}${resistanceStatus}${silenceStatus}${snareStatus}${barbedStatus}${engulfedStatus}${slowStatus}${poisonStatus}${dazedStatus}${corrodedStatus}${vitrifiedStatus}${hungerTag}${talentTag}${comboTag}${allyTag}${deityTag}${encTag} · ${hasPrize() ? "orb held" : "orb below"} · ${state.party.filter((member) => member.hp > 0).length}/4 up${difficultyTag}${dailyTag}`;
        els.versionBadge.textContent = `v${resources.version}`;
        const hazard = typeof currentHazard === "function" && !context.hazardsDisabled ? currentHazard() : null;
        const hazardTag = hazard && hazard.id !== "none" ? ` · ${hazard.name}` : "";
        els.floorBadge.textContent = `${currentFloor().id}/${resources.floors.length} · ${floorExploredPercent()}%${hazardTag}`;
        els.facingBadge.textContent = dirs[state.dir].name;
        renderParty();
        renderInventory();
        renderNearby();
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
            ["Orb of Zot Soup", hasPrize() || state.victory ? "recovered" : "still below"]
          ];
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
        renderNearby,
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
