(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installPartyFixtures = function (context) {
    with (context) {

      function fixtureTarget() {
        const here = decorAt(state.x, state.y);
        if (here) return { decor: here, x: state.x, y: state.y };
        const forward = dirAt(0);
        const x = state.x + forward.x;
        const y = state.y + forward.y;
        const decor = decorAt(x, y);
        return decor ? { decor, x, y } : null;
      }


      function healParty(amount) {
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        const scale = typeof hazardHealScale === "function" ? hazardHealScale() : 1;
        const scaled = Math.max(1, Math.round(amount * scale));
        let healed = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          const before = member.hp;
          member.hp = Math.min(member.maxHp, member.hp + scaled);
          healed += member.hp - before;
        }
        return healed;
      }


      function clearFixtureAilments() {
        const cleared = [];
        if (state.poisonedTurns > 0) {
          state.poisonedTurns = 0;
          cleared.push("poison");
        }
        if (state.engulfedTurns > 0) {
          state.engulfedTurns = 0;
          cleared.push("water");
        }
        if (state.barbedTurns > 0) {
          state.barbedTurns = 0;
          cleared.push("barbs");
        }
        return cleared;
      }


      function fixtureBenefitMessage(decor, benefits, fallback) {
        state.message = benefits.length > 0 ? `${decor.name} ${benefits.join(" and ")}.` : fallback;
      }


      function useFountain(decor, target) {
        if (decor.name.includes("dry")) {
          addEffect("impact", [target]);
          state.message = `${decor.name} coughs dust across the floor.`;
          return;
        }

        const healed = healParty(decor.name.includes("tidal") ? 8 : 10);
        const cleared = clearFixtureAilments();
        const benefits = [];
        if (healed > 0) benefits.push(`heals ${healed}`);
        if (cleared.length > 0) benefits.push(`clears ${cleared.join(", ")}`);
        if (decor.name.includes("tidal")) {
          state.resistanceTurns = Math.max(state.resistanceTurns, 8);
          benefits.push("raises resistance");
        }
        // Fountain repair: if the leader's equipment lost enchantment, top it up by 1 (capped at original).
        const leader = liveMember();
        let repaired = 0;
        if (leader) {
          for (const slot of ["weapon", "armour", "talisman", "ring", "amulet"]) {
            const item = leader[slot];
            if (!item) continue;
            const max = item.maxEnchantment ?? item.enchantment ?? 0;
            if ((item.enchantment || 0) < max) {
              item.enchantment = (item.enchantment || 0) + 1;
              if (typeof item.power === "number") item.power += 1;
              repaired += 1;
            }
          }
        }
        if (repaired > 0) benefits.push(`repairs ${repaired} item${repaired === 1 ? "" : "s"}`);
        addEffect("ice", [target, { x: state.x, y: state.y }]);
        fixtureBenefitMessage(decor, benefits, `${decor.name} runs cool over the party.`);
      }


      function useIdol(decor, target) {
        state.mightTurns = Math.max(state.mightTurns, 12);
        addEffect("smite", [target, { x: state.x, y: state.y }]);
        state.message = `${decor.name} drums strength into the party.`;
      }


      function useStatue(decor, target) {
        state.resistanceTurns = Math.max(state.resistanceTurns, 10);
        addEffect("halo", [target, { x: state.x, y: state.y }]);
        state.message = `${decor.name} hardens the party's guard.`;
      }


      function useLantern(decor, target) {
        revealAll();
        addEffect("halo", [target]);
        state.message = `${decor.name} throws clean light across the floor.`;
      }


      function useColumn(decor, target) {
        state.resistanceTurns = Math.max(state.resistanceTurns, 8);
        addEffect("impact", [target]);
        state.message = `${decor.name} gives the party a stone brace.`;
      }


      function useDais(decor, target) {
        state.mightTurns = Math.max(state.mightTurns, 8);
        state.resistanceTurns = Math.max(state.resistanceTurns, 8);
        addEffect("magic", [target, { x: state.x, y: state.y }]);
        state.message = `${decor.name} wakes underfoot.`;
      }


      function respecTalents() {
        let refunded = 0;
        if (state.talents) {
          for (const value of Object.values(state.talents)) refunded += value || 0;
          state.talents = {};
        }
        state.talentPoints = (state.talentPoints || 0) + refunded;
        return refunded;
      }


      function useAltar(decor, target) {
        const refunded = respecTalents();
        addEffect("halo", [target, { x: state.x, y: state.y }]);
        state.message = refunded > 0
          ? `${decor.name} unwinds the party's training — ${refunded} talent point${refunded === 1 ? "" : "s"} reclaimed.`
          : `${decor.name} hums, but there is no training to undo.`;
      }


      // Shrines grant a permanent run-long blessing. The blessing is chosen
      // deterministically from the shrine's id so it reads the same each run.
      function shrineBlessingFor(decor) {
        const seed = `${decor.id || decor.name}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
        return ["vigor", "blade", "aegis", "fortune"][hash % 4];
      }


      function useShrine(decor, target) {
        const blessing = shrineBlessingFor(decor);
        addEffect("halo", [target, { x: state.x, y: state.y }]);
        if (blessing === "vigor") {
          for (const member of state.party) { member.maxHp += 5; member.hp = Math.min(member.maxHp, member.hp + 5); }
          state.message = `${decor.name} blesses the party with vigor (+5 max HP).`;
        } else if (blessing === "blade") {
          for (const member of state.party) member.power += 1;
          state.message = `${decor.name} sharpens the party's strikes (+1 power).`;
        } else if (blessing === "aegis") {
          for (const member of state.party) member.defense += 1;
          state.message = `${decor.name} hardens the party's guard (+1 defense).`;
        } else {
          state.luckBonus = (state.luckBonus || 0) + 0.25;
          state.message = `${decor.name} smiles on the party — richer pickings ahead.`;
        }
      }


      // Fixtures share one interface — use(decor, target) — and are matched by a
      // name token. Detect the token once (priority order preserved; "pillar"
      // aliases the column behavior) and dispatch through the table instead of a
      // chain of name.includes branches. Adding a fixture is one row.
      const FIXTURE_TOKENS = [
        ["shrine", useShrine],
        ["altar", useAltar],
        ["fountain", useFountain],
        ["idol", useIdol],
        ["statue", useStatue],
        ["lantern", useLantern],
        ["column", useColumn],
        ["pillar", useColumn],
        ["dais", useDais]
      ];

      function useFixture(decor, target) {
        const name = decor.name.toLowerCase();
        const match = FIXTURE_TOKENS.find(([token]) => name.includes(token));
        if (match) {
          match[1](decor, target);
          return;
        }
        addEffect("magic", [target]);
        state.message = `${decor.name} hums once.`;
      }


      function chestSpawnCell(decor) {
        if (!monsterAt(decor.x, decor.y) && !(decor.x === state.x && decor.y === state.y)) return { x: decor.x, y: decor.y };
        for (const dir of dirs) {
          const x = decor.x + dir.x;
          const y = decor.y + dir.y;
          if (!solidAt(x, y) && !closedDoorAt(x, y) && !monsterAt(x, y) && !(x === state.x && y === state.y)) return { x, y };
        }
        return null;
      }


      function openChest(decor) {
        if (decorUsed(decor)) { setMessage(`${decor.name} is already open.`); return true; }
        markDecorUsed(decor);
        currentFloorState().discovered.add(keyOf(decor.x, decor.y));
        // ~25% of chests are mimics.
        if (Math.random() < 0.25) {
          const cell = chestSpawnCell(decor);
          if (cell) {
            state.summonSerial = (state.summonSerial || 0) + 1;
            const tier = 1 + state.floorIndex;
            const mimic = {
              id: `mimic-${state.floorIndex}-${state.summonSerial}`,
              name: "mimic",
              x: cell.x, y: cell.y,
              maxHp: 18 + tier * 3, hp: 18 + tier * 3,
              power: 5 + tier, hd: 3, ac: 2, ev: 0, speed: 10, exp: 6 + tier,
              energy: 0, alerted: true, resists: {}, traits: {},
              attacks: [{ type: "bite", damage: 15 + tier * 2 }]
            };
            currentFloorState().monsters.push(mimic);
            currentFloorState().discovered.add(keyOf(cell.x, cell.y));
            if (typeof addEffect === "function") addEffect("impact", [cell]);
            state.message = `${decor.name} lurches — it was a mimic!`;
            advanceTurn();
            render();
            return true;
          }
        }
        // Loot: gold scaled by depth and luck, plus an occasional consumable.
        const gold = Math.round((12 + state.floorIndex * 6) * (typeof comboGoldMultiplier === "function" ? comboGoldMultiplier() : 1));
        state.gold = (state.gold || 0) + gold;
        state.itemsCollected = (state.itemsCollected || 0) + 1;
        let extra = "";
        if (Math.random() < 0.5) {
          state.lootSerial += 1;
          const sample = resources.inventory.find((i) => i.kind === "healing") || resources.inventory[0];
          if (sample) {
            state.inventory.push({ ...sample, id: `chest-loot-${state.lootSerial}` });
            extra = ` and a ${sample.name}`;
          }
        }
        if (typeof pulse === "function") pulse("pickup");
        state.message = `${decor.name} yields ${gold} gold${extra}.`;
        advanceTurn();
        render();
        return true;
      }


      function interactFixture() {
        const target = fixtureTarget();
        if (!target) return false;
        // Chests open into loot (or a mimic ambush).
        if (target.decor.kind === "chest") {
          openChest(target.decor);
          return true;
        }
        // NPCs open a dialogue modal and never get used up.
        if (target.decor.kind === "npc" && typeof openNpcDialogue === "function" && openNpcDialogue(target.decor)) {
          currentFloorState().discovered.add(keyOf(target.decor.x, target.decor.y));
          return true;
        }
        // Merchant decor opens a shop modal instead of being marked as a one-shot fixture.
        if (target.decor.kind === "merchant" && typeof openShopAt === "function" && openShopAt(target.decor)) {
          currentFloorState().discovered.add(keyOf(target.decor.x, target.decor.y));
          return true;
        }
        if (decorUsed(target.decor)) {
          setMessage(`${target.decor.name} is spent.`);
          return true;
        }
        markDecorUsed(target.decor);
        currentFloorState().discovered.add(keyOf(target.decor.x, target.decor.y));
        useFixture(target.decor, target);
        advanceTurn();
        render();
        return true;
      }

      Object.assign(context, {
        fixtureTarget,
        healParty,
        clearFixtureAilments,
        fixtureBenefitMessage,
        useFountain,
        useIdol,
        useStatue,
        useLantern,
        useColumn,
        useDais,
        respecTalents,
        useAltar,
        shrineBlessingFor,
        useShrine,
        useFixture,
        chestSpawnCell,
        openChest,
        interactFixture,
      });
    }
  };
}());
