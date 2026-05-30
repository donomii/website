(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installTalents = function (context) {
    with (context) {
      const TALENT_TREES = {
        warrior: [
          { id: "ironskin", name: "Iron Skin", description: "+1 defense per rank.", maxRank: 3 },
          { id: "heavyswing", name: "Heavy Swing", description: "+1 power per rank.", maxRank: 3 },
          { id: "secondwind", name: "Second Wind", description: "Heal +1 extra per safe wait/rest tick.", maxRank: 2 }
        ],
        mage: [
          { id: "channel", name: "Channel", description: "+1 wand base damage per rank.", maxRank: 3 },
          { id: "arcanepool", name: "Arcane Pool", description: "Reduce signature cooldown by 4 per rank.", maxRank: 2 },
          { id: "astralsight", name: "Astral Sight", description: "Increase monster vision range awareness — actually further enchantment effect for free.", maxRank: 1 }
        ],
        rogue: [
          { id: "shadowfoot", name: "Shadow Foot", description: "Monster vision drops by another 1 per rank.", maxRank: 2 },
          { id: "backstab", name: "Backstab", description: "+15% party damage when alone in front.", maxRank: 2 },
          { id: "deftfingers", name: "Deft Fingers", description: "+1 disarm reach per rank.", maxRank: 1 }
        ],
        cleric: [
          { id: "laytouch", name: "Lay Touch", description: "+1 rest heal per rank.", maxRank: 3 },
          { id: "ward", name: "Ward", description: "Reduce DoT damage by 1 per rank.", maxRank: 2 },
          { id: "faith", name: "Faith", description: "Reduce blessing cooldown by 6 per rank.", maxRank: 2 }
        ]
      };

      function talentsFor(member) {
        if (!member?.classKey) return [];
        return TALENT_TREES[member.classKey] || [];
      }

      function talentKey(member, talentId) {
        return `${member?.classKey}:${talentId}`;
      }

      function getTalentRank(member, talentId) {
        if (!state.talents) state.talents = {};
        return state.talents[talentKey(member, talentId)] || 0;
      }

      function setTalentRank(member, talentId, rank) {
        if (!state.talents) state.talents = {};
        state.talents[talentKey(member, talentId)] = rank;
      }

      function spendTalentPoint(memberIndex, talentId) {
        if ((state.talentPoints || 0) <= 0) {
          setMessage("No talent points to spend.");
          return false;
        }
        const member = state.party[memberIndex];
        const def = talentsFor(member).find((t) => t.id === talentId);
        if (!def) {
          setMessage("Unknown talent.");
          return false;
        }
        const current = getTalentRank(member, talentId);
        if (current >= def.maxRank) {
          setMessage(`${def.name} is already at rank ${current}.`);
          return false;
        }
        setTalentRank(member, talentId, current + 1);
        state.talentPoints -= 1;
        state.message = `${member.name} learns ${def.name} (rank ${current + 1}).`;
        if (typeof saveGame === "function") saveGame();
        if (typeof renderChrome === "function") renderChrome();
        if (typeof renderTalentsModal === "function") renderTalentsModal();
        return true;
      }

      // Applied bonuses queried by other systems.
      function talentBonusPower(member) {
        return getTalentRank(member, "heavyswing");
      }

      function talentBonusDefense(member) {
        return getTalentRank(member, "ironskin");
      }

      function talentBonusRestHeal() {
        let total = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          total += getTalentRank(member, "secondwind");
          total += getTalentRank(member, "laytouch");
        }
        return total;
      }

      function talentWandBonus() {
        const leader = state.party[0];
        if (!leader || leader.classKey !== "mage") return 0;
        return getTalentRank(leader, "channel");
      }

      function talentSignatureCooldownReduction(member) {
        if (!member) return 0;
        if (member.classKey === "mage") return getTalentRank(member, "arcanepool") * 4;
        if (member.classKey === "cleric") return getTalentRank(member, "faith") * 6;
        return 0;
      }

      function talentExtraDisarmReach() {
        let extra = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          extra += getTalentRank(member, "deftfingers");
        }
        return extra;
      }

      function talentExtraStealth() {
        let extra = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          extra += getTalentRank(member, "shadowfoot");
        }
        return extra;
      }

      function talentDotReduction() {
        let mit = 0;
        for (const member of state.party) {
          if (member.hp <= 0) continue;
          mit += getTalentRank(member, "ward");
        }
        return mit;
      }

      function renderTalentsModal() {
        if (!els.talentsList) return;
        els.talentsList.innerHTML = state.party.map((member, index) => {
          const trees = talentsFor(member);
          if (trees.length === 0) return `<li><strong>${escapeHtml(member.name)}</strong><span>No class.</span></li>`;
          const rows = trees.map((talent) => {
            const rank = getTalentRank(member, talent.id);
            const max = talent.maxRank;
            const disabled = (state.talentPoints || 0) <= 0 || rank >= max || member.hp <= 0;
            return `<div class="talent-row">
              <span><strong>${escapeHtml(talent.name)}</strong> <em>(${rank}/${max})</em></span>
              <span class="talent-desc">${escapeHtml(talent.description)}</span>
              <button type="button" class="talent-spend" data-member="${index}" data-talent="${escapeHtml(talent.id)}" ${disabled ? "disabled" : ""}>+</button>
            </div>`;
          }).join("");
          return `<li><strong>${escapeHtml(member.name)} (${escapeHtml(member.classKey || "?")})</strong><div class="talent-list">${rows}</div></li>`;
        }).join("");
        if (els.talentPointsBadge) els.talentPointsBadge.textContent = `${state.talentPoints || 0} point${(state.talentPoints || 0) === 1 ? "" : "s"}`;
      }

      Object.assign(context, {
        TALENT_TREES,
        talentsFor,
        getTalentRank,
        setTalentRank,
        spendTalentPoint,
        talentBonusPower,
        talentBonusDefense,
        talentBonusRestHeal,
        talentWandBonus,
        talentSignatureCooldownReduction,
        talentExtraDisarmReach,
        talentExtraStealth,
        talentDotReduction,
        renderTalentsModal
      });
    }
  };
}());
