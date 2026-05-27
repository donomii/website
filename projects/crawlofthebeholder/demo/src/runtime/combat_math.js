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
        const penalty = (state.corrodedTurns > 0 ? 1 : 0) + (state.vitrifiedTurns > 0 ? 1 : 0);
        const armourDefense = armourBonus(member.armour) + Math.floor((member.talisman?.power || 0) / 2);
        const jewelleryDefense = equipmentDefense(member.ring) + equipmentDefense(member.amulet);
        return Math.max(0, member.defense + armourDefense + jewelleryDefense - penalty);
      }

      Object.assign(context, {
        armourBonus,
        equipmentDefense,
        memberDefense,
      });
    }
  };
}());
