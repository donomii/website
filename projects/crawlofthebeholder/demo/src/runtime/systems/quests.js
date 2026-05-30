(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installQuests = function (context) {
    with (context) {
      const QUESTS = [
        {
          id: "descend",
          name: "Descend deeper",
          description: "Reach D:3 or any branch.",
          progress: () => state.floorIndex || 0,
          target: () => 2,
          done: () => (state.floorIndex || 0) >= 2,
          reward: { gold: 20 }
        },
        {
          id: "orb",
          name: "Recover the Orb",
          description: "Pick up the Orb of Zot Soup.",
          progress: () => state.inventory.some((i) => i.kind === "quest") || state.victory ? 1 : 0,
          target: () => 1,
          done: () => state.inventory.some((i) => i.kind === "quest") || state.victory
        },
        {
          id: "escape",
          name: "Escape alive",
          description: "Return to the surface with the orb.",
          progress: () => state.victory ? 1 : 0,
          target: () => 1,
          done: () => !!state.victory
        },
        {
          id: "boss",
          name: "Topple a champion",
          description: "Defeat a boss monster.",
          progress: () => state.bossKilled ? 1 : 0,
          target: () => 1,
          done: () => !!state.bossKilled,
          reward: { gold: 60, xp: 30 }
        },
        {
          id: "branches",
          name: "Survey the dungeon",
          description: "Visit three distinct branches (Lair, Orc, Swamp…).",
          progress: () => uniqueBranchCount(),
          target: () => 3,
          done: () => uniqueBranchCount() >= 3,
          reward: { gold: 40 }
        },
        {
          id: "spend",
          name: "Patron of the road",
          description: "Spend 100 gold at merchants.",
          progress: () => state.goldSpent || 0,
          target: () => 100,
          done: () => (state.goldSpent || 0) >= 100,
          reward: { xp: 20 }
        },
        {
          id: "kills",
          name: "Many notches",
          description: "Defeat 25 monsters.",
          progress: () => state.monstersDefeated || 0,
          target: () => 25,
          done: () => (state.monstersDefeated || 0) >= 25,
          reward: { gold: 50 }
        },
        {
          id: "sage",
          name: "Sage of names",
          description: "Identify 5 item types.",
          progress: () => state.identifiedKinds ? state.identifiedKinds.size : 0,
          target: () => 5,
          done: () => state.identifiedKinds && state.identifiedKinds.size >= 5,
          reward: { gold: 30 }
        }
      ];

      function uniqueBranchCount() {
        const visited = state.visitedBranches || new Set();
        return visited.size;
      }

      function trackVisitedBranch() {
        if (!state.visitedBranches) state.visitedBranches = new Set();
        const id = currentFloor().id || "";
        const branch = id.split(":")[0] || "D";
        state.visitedBranches.add(branch);
      }

      function questEntries() {
        return QUESTS.map((q) => ({
          id: q.id,
          name: q.name,
          description: q.description,
          progress: q.progress(),
          target: q.target(),
          done: q.done(),
          reward: q.reward || null,
          claimed: !!(state.claimedQuests && state.claimedQuests[q.id])
        }));
      }

      function rewardSummary(reward) {
        if (!reward) return "";
        const bits = [];
        if (reward.gold) bits.push(`${reward.gold}g`);
        if (reward.xp) bits.push(`${reward.xp} XP`);
        return bits.join(" + ");
      }

      // Pay out rewards for any newly-completed quests. Called each turn from
      // advanceTurn so completion is detected the moment the condition holds.
      function settleQuestRewards() {
        if (!state.claimedQuests) state.claimedQuests = {};
        const paid = [];
        for (const quest of QUESTS) {
          if (!quest.reward) continue;
          if (state.claimedQuests[quest.id]) continue;
          if (!quest.done()) continue;
          state.claimedQuests[quest.id] = true;
          if (quest.reward.gold) state.gold = (state.gold || 0) + quest.reward.gold;
          if (quest.reward.xp && typeof awardExperience === "function") {
            // awardExperience expects a monster-ish object with .exp.
            awardExperience({ exp: quest.reward.xp, boss: false });
          }
          paid.push(quest);
        }
        if (paid.length > 0) {
          // Surface via toast + message log only — never clobber the action's
          // own state.message, which the caller sets right after advanceTurn.
          for (const quest of paid) {
            const line = `Objective complete — ${quest.name} (${rewardSummary(quest.reward)}).`;
            if (typeof showToast === "function") showToast(line);
            state.messageLog.unshift(line);
          }
          state.messageLog = state.messageLog.slice(0, 30);
          if (typeof pulse === "function") pulse("achievement");
        }
        return paid;
      }

      function renderQuestModal() {
        if (!els.questsList) return;
        const entries = questEntries();
        const complete = entries.filter((q) => q.done).length;
        els.questsList.innerHTML = entries.map((q) => {
          const pct = Math.max(0, Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100)));
          const rewardText = q.reward ? ` · reward ${rewardSummary(q.reward)}` : "";
          return `<li class="${q.done ? "unlocked" : "locked"}">
            <strong>${escapeHtml(q.name)}${q.done ? " ✓" : ""}</strong>
            <span>${escapeHtml(q.description)} (${q.progress}/${q.target})${escapeHtml(rewardText)}</span>
            <div class="meter" aria-label="${escapeHtml(q.name)} progress"><div class="meter-fill" style="--value:${pct}%"></div></div>
          </li>`;
        }).join("");
        if (els.questsBadge) els.questsBadge.textContent = `${complete}/${entries.length}`;
      }

      Object.assign(context, {
        QUESTS,
        uniqueBranchCount,
        trackVisitedBranch,
        questEntries,
        rewardSummary,
        settleQuestRewards,
        renderQuestModal
      });
    }
  };
}());
