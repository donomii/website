(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installCombatMath = function (context) {
    with (context) {
      function armourBonus(item) {
        return item ? Math.max(1, item.power || 0) : 0;
      }

      function equipmentDefense(item) {
        return item?.bonus === "defense" || item?.bonus === "evasion" ? Math.max(1, item.power || 0) : 0;
      }

      function memberDefense(member) {
        const encumbrancePenalty = typeof isOverEncumbered === "function" && isOverEncumbered() ? 2 : 0;
        const penalty = (state.corrodedTurns > 0 ? 1 : 0) + (state.vitrifiedTurns > 0 ? 1 : 0) + encumbrancePenalty;
        const armourDefense = armourBonus(member.armour) + Math.floor((member.talisman?.power || 0) / 2);
        const jewelleryDefense = equipmentDefense(member.ring) + equipmentDefense(member.amulet);
        const classDefense = typeof classPassiveDefense === "function" ? classPassiveDefense(member) : 0;
        const talentDefense = (state.talents && member.classKey === "warrior") ? (state.talents["warrior:ironskin"] || 0) : 0;
        return Math.max(0, member.defense + armourDefense + jewelleryDefense + classDefense + talentDefense - penalty);
      }

      Object.assign(context, {
        armourBonus,
        equipmentDefense,
        memberDefense,
      });
    }
  };
}());
