(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Item "use" behaviors are a family of objects sharing one interface:
  // handler(item) validates, applies its effect, consumes the item, sets the
  // message, and (on success) advances the turn. useItem() does the cross-cutting
  // bookkeeping, then dispatches on item.kind through this registry instead of a
  // ~30-branch if/else chain. Adding an item kind means adding one table entry.
  //
  // Targeting/effect helpers (teleportParty, blinkParty, spreadFog, useThrowable,
  // useEvocable, frightenMonsters, wandProfile, …) live in party/items.js and
  // items/elements.js and resolve here through with(context).
  window.CotBRuntime.installItemUse = function installItemUse(context) {
    with (context) {

      function useDefaultItem(item) {
        state.message = `${item.name} is ready.`;
        renderChrome();
      }

      const ITEM_USE = {
        "alch-fire"(item) {
          if (typeof useAlchemistFire !== "function") return useDefaultItem(item);
          const messages = [];
          const ok = useAlchemistFire(item, messages);
          if (!ok) { setMessage(messages[0] || `${item.name} finds no target.`); return; }
          removeInventoryItem(item);
          state.message = messages.join(" ");
          advanceTurn(); render();
        },

        scroll(item) {
          if (typeof castScroll !== "function") return useDefaultItem(item);
          const messages = [];
          castScroll(item, messages);
          if (typeof recordScrollCast === "function") recordScrollCast();
          removeInventoryItem(item);
          state.message = messages.join(" ");
          advanceTurn(); render();
        },

        glyph(item) {
          if (typeof deployGlyph !== "function") return useDefaultItem(item);
          const messages = [];
          const ok = deployGlyph(item, messages);
          if (!ok) { setMessage(messages[0] || "Cannot place the glyph here."); return; }
          removeInventoryItem(item);
          state.message = messages.join(" ");
          advanceTurn(); render();
        },

        treasure_map(item) {
          if (typeof useTreasureMap !== "function") return useDefaultItem(item);
          useTreasureMap(item);
        },

        identify(item) {
          const count = typeof identifyAll === "function" ? identifyAll() : 0;
          removeInventoryItem(item);
          state.message = count > 0 ? `${item.name} reveals ${count} item${count === 1 ? "" : "s"}.` : `${item.name} unfurls but finds nothing to clarify.`;
          advanceTurn();
          render();
        },

        taming(item) {
          const forward = dirAt(0);
          let mon = null;
          for (let depth = 1; depth <= (item.range || 3); depth += 1) {
            const tx = state.x + forward.x * depth;
            const ty = state.y + forward.y * depth;
            if (solidAt(tx, ty)) break;
            const found = monsterAt(tx, ty);
            if (found) { mon = found; break; }
          }
          if (!mon) { setMessage(`${item.name} finds no creature to charm.`); return; }
          if (mon.boss) { setMessage(`${mon.name} is too mighty to charm.`); return; }
          const ratio = mon.maxHp > 0 ? mon.hp / mon.maxHp : 1;
          const threshold = item.threshold || 0.4;
          if (ratio > threshold) {
            setMessage(`${mon.name} is too strong to charm — weaken it first (below ${Math.round(threshold * 100)}% HP).`);
            return;
          }
          if (typeof createAlly !== "function") { setMessage("The charm fizzles."); return; }
          const ally = createAlly(mon, {
            name: mon.name,
            x: mon.x,
            y: mon.y,
            maxHp: Math.max(1, Math.round(mon.maxHp * 0.5)),
            hp: Math.max(1, Math.round(mon.maxHp * 0.5)),
            power: mon.power,
            turns: item.turns || 30
          });
          if (!ally) { setMessage("The party already commands too many allies."); return; }
          removeMonster(mon);
          removeInventoryItem(item);
          if (typeof addEffect === "function") addEffect("halo", [{ x: mon.x, y: mon.y }]);
          state.message = `${item.name} charms ${mon.name} into the party's service.`;
          advanceTurn();
          render();
        },

        summonAlly(item) {
          if (typeof createAlly !== "function") { setMessage(`${item.name} fizzles.`); return; }
          // Spawn beside the party on an open cell.
          let cell = null;
          for (const dir of dirs) {
            const cx = state.x + dir.x;
            const cy = state.y + dir.y;
            if (!solidAt(cx, cy) && !closedDoorAt(cx, cy) && !monsterAt(cx, cy) && !allyAt(cx, cy)) { cell = { x: cx, y: cy }; break; }
          }
          if (!cell) { setMessage(`${item.name} has no room to manifest.`); return; }
          const ally = createAlly({ name: item.allyName || "spirit wolf", power: item.power || 6, attacks: [{ type: "bite", damage: (item.power || 6) * 3 }] }, {
            x: cell.x, y: cell.y, maxHp: item.allyHp || 16, hp: item.allyHp || 16, turns: item.turns || 25
          });
          if (!ally) { setMessage("The party already commands too many allies."); return; }
          removeInventoryItem(item);
          if (typeof addEffect === "function") addEffect("magic", [cell]);
          state.message = `${item.name} calls forth a ${ally.name}.`;
          advanceTurn();
          render();
        },

        recall(item) {
          const marker = (state.mapMarkers || []).find((m) => m.floorIndex === state.floorIndex);
          if (!marker) {
            setMessage(`${item.name} needs a map marker on this floor to recall to.`);
            return;
          }
          if (monsterAt(marker.x, marker.y) || solidAt(marker.x, marker.y)) {
            setMessage(`${item.name} can't reach the marked spot — it's blocked.`);
            return;
          }
          const origin = { x: state.x, y: state.y };
          state.x = marker.x;
          state.y = marker.y;
          removeInventoryItem(item);
          if (typeof addEffect === "function") addEffect("blink", [origin, { x: state.x, y: state.y }]);
          reveal();
          state.message = `${item.name} pulls the party to the ${marker.kind} marker.`;
          advanceTurn();
          render();
        },

        trapkit(item) {
          const floorState = currentFloorState();
          if (floorState.traps.some((t) => t.x === state.x && t.y === state.y)) {
            setMessage("A trap is already laid here.");
            return;
          }
          state.lootSerial += 1;
          floorState.traps.push({
            id: `player-trap-${state.floorIndex}-${state.lootSerial}`,
            name: item.name || "snap trap",
            kind: item.trapKind || "spike",
            power: item.power || 10,
            armed: true,
            x: state.x,
            y: state.y,
            playerLaid: true
          });
          removeInventoryItem(item);
          state.message = `${item.name} is set underfoot.`;
          advanceTurn();
          render();
        },

        food(item) {
          const restore = Math.max(50, item.power || 400);
          state.satiety = Math.min(1200, (state.satiety || 0) + restore);
          removeInventoryItem(item);
          state.message = `${item.name} settles into the party's stomachs.`;
          advanceTurn();
          render();
        },

        remove_curse(item) {
          let cleansed = 0;
          for (const member of state.party) {
            for (const slot of ["weapon", "armour", "talisman", "ring", "amulet"]) {
              if (member[slot]?.cursed) {
                member[slot].cursed = false;
                cleansed += 1;
              }
            }
          }
          if (cleansed > 0) state.curseRemoved = true;
          removeInventoryItem(item);
          state.message = cleansed > 0 ? `${item.name} severs ${cleansed} curse${cleansed === 1 ? "" : "s"}.` : `${item.name} flickers, but no curse remains.`;
          advanceTurn();
          render();
        },

        healing(item) {
          const target = state.party.reduce((lowest, member) => (member.hp / member.maxHp < lowest.hp / lowest.maxHp ? member : lowest), state.party[0]);
          target.hp = Math.min(target.maxHp, target.hp + item.power);
          const clearedPoison = item.name.includes("curing") && state.poisonedTurns > 0;
          const clearedBarbs = item.name.includes("curing") && state.barbedTurns > 0;
          if (clearedPoison) state.poisonedTurns = 0;
          if (clearedBarbs) state.barbedTurns = 0;
          removeInventoryItem(item);
          const clearNote = [clearedPoison && "Poison clears", clearedBarbs && "barbs loosen"].filter(Boolean).join("; ");
          state.message = clearNote ? `${target.name} drinks ${item.name}. ${clearNote}.` : `${target.name} drinks ${item.name}.`;
          advanceTurn();
          render();
        },

        mapping(item) {
          revealAll();
          removeInventoryItem(item);
          state.message = "The map floods with clean lines.";
          advanceTurn();
          render();
        },

        might(item) {
          state.mightTurns = Math.max(state.mightTurns, item.turns || 18);
          removeInventoryItem(item);
          state.message = "The party's muscles surge.";
          advanceTurn();
          render();
        },

        resistance(item) {
          state.resistanceTurns = Math.max(state.resistanceTurns, item.turns || 16);
          removeInventoryItem(item);
          addEffect("halo", [{ x: state.x, y: state.y }]);
          state.message = "The party feels the elements slide away.";
          advanceTurn();
          render();
        },

        haste(item) {
          state.hasteTurns = Math.max(state.hasteTurns, item.turns || 14);
          removeInventoryItem(item);
          state.message = "The party speeds up.";
          advanceTurn();
          render();
        },

        blink(item) {
          removeInventoryItem(item);
          const origin = { x: state.x, y: state.y };
          const moved = blinkParty();
          if (moved) addEffect("blink", [origin, { x: state.x, y: state.y }]);
          state.message = moved ? "The party blinks through a seam in space." : `${item.name} fizzles.`;
          advanceTurn();
          render();
        },

        teleport(item) {
          removeInventoryItem(item);
          const origin = { x: state.x, y: state.y };
          const moved = teleportParty();
          if (moved) addEffect("blink", [origin, { x: state.x, y: state.y }]);
          state.message = moved ? "The dungeon folds around the party." : `${item.name} crackles uselessly.`;
          advanceTurn();
          render();
        },

        fear(item) {
          removeInventoryItem(item);
          const frightened = frightenMonsters();
          state.message = frightened === 0 ? `${item.name} whispers into empty halls.` : `${item.name} sends ${frightened} monster${frightened === 1 ? "" : "s"} fleeing.`;
          advanceTurn();
          render();
        },

        confuse(item) {
          removeInventoryItem(item);
          const dazed = confuseMonsters(item.turns || 5);
          state.message = dazed === 0 ? `${item.name} sparkles, but nothing is near.` : `${item.name} confuses ${dazed} monster${dazed === 1 ? "" : "s"}.`;
          advanceTurn();
          render();
        },

        fog(item) {
          removeInventoryItem(item);
          spreadFog(item.turns || 7);
          state.message = "Grey fog billows through the hall.";
          advanceTurn();
          render();
        },

        poison(item) {
          removeInventoryItem(item);
          const clouds = spreadPoison(item.turns || 6);
          state.message = clouds === 0 ? `${item.name} hisses, but finds no open air.` : `${item.name} fills ${clouds} tiles with poison.`;
          advanceTurn();
          render();
        },

        immolation(item) {
          removeInventoryItem(item);
          const marked = immolateMonsters();
          state.message = marked === 0 ? `${item.name} finds nothing to ignite.` : `${item.name} lights ${marked} monster${marked === 1 ? "" : "s"} from within.`;
          advanceTurn();
          render();
        },

        silence(item) {
          removeInventoryItem(item);
          state.silenceTurns = Math.max(state.silenceTurns, item.turns || 10);
          addEffect("silence", cellsNear(state, 2));
          state.message = "A heavy silence falls.";
          advanceTurn();
          render();
        },

        wand(item) {
          if (state.silenceTurns > 0) {
            setMessage(`${item.name} will not answer in silence.`);
            return;
          }
          if (item.name.includes("digging")) {
            useDiggingWand(item);
            return;
          }
          if (item.name.includes("clouds")) {
            useCloudWand(item);
            return;
          }
          const shot = firstTargetInLine(4);
          if (!shot) {
            setMessage(`${item.name} finds no target.`);
            return;
          }

          if (item.name.includes("iceblast")) {
            useIceblastWand(item, shot);
            return;
          }

          const wandMultiplier = typeof classWandMultiplier === "function" ? classWandMultiplier() : 1;
          const wandTalent = typeof talentWandBonus === "function" ? talentWandBonus() : 0;
          const baseDamage = Math.round(((item.power + wandTalent) + Math.floor(Math.random() * 5)) * wandMultiplier);
          const damage = monsterElementDamage(shot.target, baseDamage, wandElement(item));
          addEffect(wandEffectKind(item), lineCells(state, shot.target));
          shot.target.hp = Math.max(0, shot.target.hp - damage);
          addDamageMark(shot.target, wandElement(item), damage);
          const rooted = item.name.includes("roots") ? affectNearbyMonsters(shot.target, 1, (monster) => {
            if (monster.hp <= 0) return false;
            monster.rootedTurns = Math.max(monster.rootedTurns || 0, 3);
            return true;
          }) : 0;
          if (item.name.includes("acid") && shot.target.hp > 0 && damage > 0) shot.target.ac = Math.max(0, (shot.target.ac || 0) - 1);
          const dazzled = item.name.includes("light") ? affectNearbyMonsters(shot.target, 1, (monster) => {
            monster.fearTurns = Math.max(monster.fearTurns || 0, 2);
            return true;
          }) : 0;
          consumeWandCharge(item);
          state.message = wandHitMessage(item, shot.target, baseDamage, damage);
          // Environmental reaction at the impact cell (ignite gas, freeze/shock
          // water, etc.). Inert unless the target tile is actually reactive.
          if (typeof reactionAt === "function") {
            const reactionMessages = [];
            if (reactionAt(shot.target.x, shot.target.y, wandElement(item), baseDamage, reactionMessages) && reactionMessages.length) {
              state.message = `${state.message} ${reactionMessages.join(" ")}`.trim();
            }
          }
          if (rooted > 1) state.message = `${state.message} Roots lash ${rooted} monsters.`;
          if (dazzled > 1) state.message = `${state.message} Light dazzles ${dazzled} monsters.`;
          if (shot.target.hp === 0) {
            state.message = `${state.message} ${killMonster(shot.target)}`.trim();
          }
          advanceTurn();
          render();
        },

        throwable(item) {
          useThrowable(item);
        },

        evocable(item) {
          useEvocable(item);
        },

        weapon(item) {
          if (!equipItem(item, "weapon", "readies")) return;
          advanceTurn();
          render();
        },

        armour(item) {
          if (!equipItem(item, "armour", "buckles on")) return;
          advanceTurn();
          render();
        },

        talisman(item) {
          if (!equipItem(item, "talisman", "attunes to")) return;
          addEffect("magic", [{ x: state.x, y: state.y }]);
          advanceTurn();
          render();
        },

        ring(item) {
          if (!equipItem(item, "ring", "slips on")) return;
          addEffect("halo", [{ x: state.x, y: state.y }]);
          advanceTurn();
          render();
        },

        amulet(item) {
          if (!equipItem(item, "amulet", "fastens")) return;
          addEffect("halo", [{ x: state.x, y: state.y }]);
          advanceTurn();
          render();
        },

        quest(item) {
          setMessage(`${item.name} hums toward the surface.`);
        }
      };

      // Kinds whose use counts toward the "potions used" lifetime stat.
      const CONSUMABLE_KINDS = new Set(["healing", "mapping", "might", "resistance", "haste", "blink", "teleport", "fear", "confuse", "fog", "poison", "immolation", "silence", "identify", "remove_curse"]);

      function useItem(id) {
        const item = state.inventory.find((entry) => entry.id === id);
        if (!item) return;
        if (CONSUMABLE_KINDS.has(item.kind)) state.potionsUsed = (state.potionsUsed || 0) + 1;
        // Identify on first use of a kind.
        if (typeof identifyItem === "function") identifyItem(item);
        // Field engineering gadgets deploy onto the floor ahead. They are
        // detected by predicate rather than a single kind, so this stays a
        // pre-dispatch check rather than a registry entry.
        if (typeof isEngineeringItem === "function" && isEngineeringItem(item)) {
          const messages = [];
          const deployed = deployFromItem(item, messages);
          if (!deployed) {
            setMessage(messages[0] || `${item.name} finds no place to deploy.`);
            return;
          }
          removeInventoryItem(item);
          state.message = messages.join(" ");
          advanceTurn();
          render();
          return;
        }
        (ITEM_USE[item.kind] || useDefaultItem)(item);
      }

      context.ITEM_USE = ITEM_USE;
      context.useItem = useItem;
    }
  };
}());
