(function () {
  window.CotBRuntime = window.CotBRuntime || {};

  // Smithing: spend ore (mined or bought) plus a smithing-hammer charge to
  // reforge an equipped weapon or armour, permanently raising its power or
  // defense. Distinct from enchanting (which adds elemental runes) and crafting
  // (which combines consumables). Each piece can be reforged up to a cap.
  window.CotBRuntime.installSmithing = function installSmithing(context) {
    with (context) {
      const ORE_PER_REFORGE = 2;
      const REFORGE_CAP      = 3;   // max reforges per item
      const POWER_GAIN       = 1;
      const DEFENSE_GAIN     = 1;

      if (!resources.inventory.some((i) => i.id === "smithing-hammer")) {
        resources.inventory.push({
          id: "smithing-hammer", name: "smithing hammer", kind: "smithing-hammer",
          charges: 3, value: 12,
          desc: "Reforge equipped gear with ore to make it stronger."
        });
      }

      function _ore() {
        return state.inventory.filter((i) => i.kind === "ore");
      }

      function _consumeOre(n) {
        const ore = _ore();
        for (let i = 0; i < n && i < ore.length; i += 1) {
          state.inventory = state.inventory.filter((item) => item !== ore[i]);
        }
      }

      function _hammer() {
        return state.inventory.find((i) => i.kind === "smithing-hammer" && (i.charges || 0) > 0);
      }

      // Find the named member's equipped piece in the given slot ("weapon"/"armour").
      function _equipped(memberName, slot) {
        const member = (memberName
          ? state.party.find((m) => m.name === memberName)
          : liveMember());
        if (!member) return { member: null, piece: null };
        return { member, piece: member[slot] || null };
      }

      function reforge(slot, messages, memberName) {
        if (context.smithingDisabled) { messages.push("Smithing is not active."); return false; }
        if (slot !== "weapon" && slot !== "armour") { messages.push("You can only reforge a weapon or armour."); return false; }
        if (!_hammer()) { messages.push("You need a smithing hammer with charges."); return false; }
        if (_ore().length < ORE_PER_REFORGE) { messages.push(`Not enough ore (need ${ORE_PER_REFORGE}).`); return false; }
        const { member, piece } = _equipped(memberName, slot);
        if (!piece) { messages.push(`No ${slot} equipped to reforge.`); return false; }
        if ((piece.reforged || 0) >= REFORGE_CAP) { messages.push(`${piece.name} cannot be reforged any further.`); return false; }

        _consumeOre(ORE_PER_REFORGE);
        const hammer = _hammer();
        hammer.charges -= 1;
        if (hammer.charges === 0) state.inventory = state.inventory.filter((i) => i !== hammer);

        piece.reforged = (piece.reforged || 0) + 1;
        if (slot === "weapon") {
          piece.power = (piece.power || 0) + POWER_GAIN;
          messages.push(`${member.name}'s ${piece.name} is reforged sharper (+${POWER_GAIN} power, ${piece.reforged}/${REFORGE_CAP}).`);
        } else {
          piece.defense = (piece.defense || 0) + DEFENSE_GAIN;
          messages.push(`${member.name}'s ${piece.name} is reforged tougher (+${DEFENSE_GAIN} defense, ${piece.reforged}/${REFORGE_CAP}).`);
        }
        if (typeof addEffect === "function") addEffect("impact", [{ x: state.x, y: state.y }]);
        return true;
      }

      context.reforge = reforge;
    }
  };
}());
