(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installUiChrome = function (context) {
    with (context) {
      function renderParty() {
        els.party.innerHTML = "";
        for (const member of state.party) {
          const row = document.createElement("div");
          row.className = "party-row";
          const gear = [
            member.weapon?.shortName,
            member.armour?.shortName,
            member.talisman?.shortName,
            member.ring?.shortName,
            member.amulet?.shortName
          ].filter(Boolean).join(" / ");
          row.title = gear ? `${member.name}: ${gear}` : member.name;
          row.innerHTML = `
            <div class="party-name">${member.name}</div>
            <div class="meter" aria-label="${member.name} hit points"><div class="meter-fill" style="--value:${percent(member.hp, member.maxHp)}"></div></div>
            <div class="hp-text">${member.hp}/${member.maxHp}</div>
            <div class="party-stats">${memberPower(member)}/${memberDefense(member)}</div>
          `;
          els.party.appendChild(row);
        }
      }

      function renderMap() {
        const floor = currentFloor();
        const floorState = currentFloorState();
        const width = floor.map.width;
        const height = floor.map.height;
        els.map.innerHTML = "";
        els.map.style.gridTemplateColumns = `repeat(${width}, 9px)`;

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
              node.textContent = decorUsed(decor) ? "." : "o";
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
              node.textContent = monster.name[0].toLowerCase();
              labels.push(monster.name);
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
        els.inventoryCount.textContent = String(state.inventory.length);
        for (const [index, item] of state.inventory.entries()) {
          const shortcut = inventoryShortcut(index);
          const wrapper = document.createElement("div");
          wrapper.className = "inventory-item";
          wrapper.innerHTML = `
            <button type="button" title="${shortcut ? `${shortcut}: ` : ""}${item.name}" aria-label="${item.name}" data-item="${item.id}">
              <img src="${item.tile}" alt="">
              ${shortcut ? `<b class="inventory-key">${shortcut}</b>` : ""}
            </button>
            <span>${item.shortName}${item.charges ? ` ${item.charges}` : ""}</span>
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
          els.nearby.innerHTML = `<strong>${target.name}</strong><br>${target.hp}/${target.maxHp} HP, AC ${target.ac}, EV ${target.ev}${traitDetail}`;
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
        els.statusLine.textContent = `T${state.turnCount} · L${state.level} ${state.experience}/${state.nextLevel} XP · ${state.gold}g${hasteStatus}${mightStatus}${rageStatus}${resistanceStatus}${silenceStatus}${snareStatus}${barbedStatus}${engulfedStatus}${slowStatus}${poisonStatus}${dazedStatus}${corrodedStatus}${vitrifiedStatus} · ${hasPrize() ? "orb held" : "orb below"} · ${state.party.filter((member) => member.hp > 0).length}/4 up`;
        els.versionBadge.textContent = `v${resources.version}`;
        els.floorBadge.textContent = `${currentFloor().id}/${resources.floors.length}`;
        els.facingBadge.textContent = dirs[state.dir].name;
        renderParty();
        renderInventory();
        renderNearby();
        renderLog();
      }

      function inventoryShortcut(index) {
        return index < 9 ? String(index + 1) : index === 9 ? "0" : "";
      }

      function inventoryIndexForKey(key) {
        if (key >= "1" && key <= "9") return Number.parseInt(key, 10) - 1;
        if (key === "0") return 9;
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

      function render() {
        renderViewport();
        renderMap();
        renderChrome();
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
        render,
      });
    }
  };
}());
