(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Economy & banking: a gold stash that persists across runs (with interest as
  // you descend), item appraisal and bulk-selling of junk, a bounty board, and
  // a small game of chance. The bank lives in the cross-run meta blob so it
  // survives death; everything else is in-run state.
  window.CotBRuntime.installEconomy = function (context) {
    with (context) {
      const BANK_INTEREST = 0.05; // 5% per floor descended
      const BANK_CAP = 100000;
      const BOUNTY_TARGETS = ["rat", "bat", "snake", "goblin", "hound", "spider", "skeleton", "zombie", "orc", "jelly"];

      // ----- Persistent bank (meta) -----
      function readBankMeta() {
        const meta = typeof readMeta === "function" ? readMeta() : {};
        return { meta, balance: Math.max(0, Math.floor(meta.bank || 0)) };
      }

      function bankBalance() {
        return readBankMeta().balance;
      }

      function writeBankBalance(balance) {
        if (typeof readMeta !== "function" || typeof writeMeta !== "function") return false;
        const meta = readMeta();
        meta.bank = Math.max(0, Math.min(BANK_CAP, Math.floor(balance)));
        return writeMeta(meta);
      }

      function depositGold(amount) {
        const want = Math.floor(amount);
        if (!Number.isFinite(want) || want <= 0) return 0;
        const moved = Math.min(want, state.gold || 0);
        if (moved <= 0) return 0;
        state.gold -= moved;
        writeBankBalance(bankBalance() + moved);
        return moved;
      }

      function withdrawGold(amount) {
        const want = Math.floor(amount);
        if (!Number.isFinite(want) || want <= 0) return 0;
        const moved = Math.min(want, bankBalance());
        if (moved <= 0) return 0;
        writeBankBalance(bankBalance() - moved);
        state.gold = (state.gold || 0) + moved;
        return moved;
      }

      function accrueBankInterest() {
        const balance = bankBalance();
        if (balance <= 0) return 0;
        const interest = Math.floor(balance * BANK_INTEREST);
        if (interest <= 0) return 0;
        writeBankBalance(balance + interest);
        return interest;
      }

      // ----- Appraisal & selling -----
      function sellValue(item) {
        if (!item || item.kind === "quest") return 0;
        const base = typeof itemValue === "function" ? itemValue(item) : (item.power || 1) * 4;
        return Math.max(1, Math.round(base * 0.5));
      }

      function isJunk(item, threshold) {
        if (!item || item.kind === "quest") return false;
        return sellValue(item) <= threshold;
      }

      // Sell every unequipped, non-quest item worth at most `threshold`.
      function sellJunk(threshold = 8) {
        const doomed = state.inventory.filter((item) => isJunk(item, threshold));
        let gold = 0;
        for (const item of doomed) {
          gold += sellValue(item);
          removeInventoryItem(item);
        }
        if (gold > 0) {
          state.gold = (state.gold || 0) + gold;
          state.goldEarned = (state.goldEarned || 0) + gold;
        }
        return { count: doomed.length, gold };
      }

      // ----- Bounty board -----
      function generateBounties(floorIndex = state.floorIndex, count = 3) {
        const bounties = [];
        for (let i = 0; i < count; i += 1) {
          const match = BOUNTY_TARGETS[((floorIndex + 1) * 3 + i * 5) % BOUNTY_TARGETS.length];
          const target = 3 + ((floorIndex + i) % 4);
          const reward = 20 + target * (8 + floorIndex * 2);
          bounties.push({
            id: `bounty-${floorIndex}-${i}`,
            match,
            name: `Cull ${target} ${match}s`,
            target,
            reward,
            progress: 0,
            claimed: false
          });
        }
        return bounties;
      }

      function activeBounties() {
        if (!Array.isArray(state.bounties)) state.bounties = [];
        return state.bounties;
      }

      function postBounties(floorIndex = state.floorIndex) {
        state.bounties = generateBounties(floorIndex);
        return state.bounties;
      }

      function recordBountyKill(monster) {
        if (!monster || !Array.isArray(state.bounties) || state.bounties.length === 0) return;
        const name = String(monster.name || "").toLowerCase();
        for (const bounty of state.bounties) {
          if (bounty.claimed || bounty.progress >= bounty.target) continue;
          if (name.includes(bounty.match)) bounty.progress += 1;
        }
      }

      function bountyComplete(bounty) {
        return !!bounty && !bounty.claimed && bounty.progress >= bounty.target;
      }

      function claimBounty(id) {
        const bounty = activeBounties().find((b) => b.id === id);
        if (!bountyComplete(bounty)) return null;
        bounty.claimed = true;
        state.gold = (state.gold || 0) + bounty.reward;
        state.goldEarned = (state.goldEarned || 0) + bounty.reward;
        return bounty.reward;
      }

      function claimableBounties() {
        return activeBounties().filter(bountyComplete);
      }

      // ----- Game of chance -----
      // Stake gold on a ~45% double-or-nothing. Deterministic under the seeded
      // RNG the tests install.
      function gamble(stake) {
        const bet = Math.floor(stake);
        if (!Number.isFinite(bet) || bet <= 0 || bet > (state.gold || 0)) return null;
        const roll = Math.random();
        const won = roll < 0.45;
        const delta = won ? bet : -bet;
        state.gold += delta;
        state.gambleNet = (state.gambleNet || 0) + delta;
        return { won, delta, roll };
      }

      Object.assign(context, {
        bankBalance,
        depositGold,
        withdrawGold,
        accrueBankInterest,
        sellValue,
        isJunk,
        sellJunk,
        generateBounties,
        activeBounties,
        postBounties,
        recordBountyKill,
        bountyComplete,
        claimBounty,
        claimableBounties,
        gamble,
        BOUNTY_TARGETS
      });
    }
  };
}());
