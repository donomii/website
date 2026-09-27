(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Class portrait art for the party UI (2D rows, VR party cards, character
  // create). Each class offers a CHOICE: our original 96×96 piece (see
  // art/manifest.json) plus DCSS tiles that suit the class. The pick lives on
  // the member as portraitKey (persisted with the save); first entry is the
  // default.
  // NOTE: tools/build_static.sh greps this file for vendor/ and art/ paths,
  // so every portrait referenced here ships with the static build.
  window.CotBRuntime.installPortraits = function (context) {
    with (context) {
      const DCSS_HUMANS = "vendor/crawl/crawl-ref/source/rltiles/mon/humanoids/humans";
      const PORTRAITS = {
        warrior: [
          { id: "cob-warrior", label: "Crested helm", src: "art/warrior_96.png" },
          { id: "dcss-vault-guard", label: "Vault guard", src: `${DCSS_HUMANS}/vault_guard.png` },
          { id: "dcss-myrmidon", label: "Imperial myrmidon", src: `${DCSS_HUMANS}/imperial_myrmidon.png` }
        ],
        mage: [
          { id: "cob-mage", label: "Hooded arcanist", src: "art/mage_96.png" },
          { id: "dcss-arcanist", label: "Arcanist", src: `${DCSS_HUMANS}/arcanist.png` },
          { id: "dcss-occultist", label: "Occultist", src: `${DCSS_HUMANS}/occultist.png` }
        ],
        rogue: [
          { id: "cob-rogue", label: "Wrapped face", src: "art/rogue_96.png" },
          { id: "dcss-whispers", label: "Servant of whispers", src: `${DCSS_HUMANS}/servant_of_whispers.png` },
          { id: "dcss-sentinel", label: "Vault sentinel", src: `${DCSS_HUMANS}/vault_sentinel.png` }
        ],
        cleric: [
          { id: "cob-cleric", label: "Haloed cowl", src: "art/cleric_96.png" },
          { id: "dcss-acolyte", label: "Burial acolyte", src: `${DCSS_HUMANS}/burial_acolyte.png` },
          { id: "dcss-hierophant", label: "Ragged hierophant", src: `${DCSS_HUMANS}/ragged_hierophant.png` }
        ]
      };

      function classPortraits(classKey) {
        return PORTRAITS[classKey] || [];
      }

      function classPortrait(classKey) {
        const list = classPortraits(classKey);
        return list.length > 0 ? list[0].src : null;
      }

      function memberPortraitEntry(member) {
        const list = classPortraits(member?.classKey);
        if (list.length === 0) return null;
        return list.find((entry) => entry.id === member.portraitKey) || list[0];
      }

      function memberPortrait(member) {
        return memberPortraitEntry(member)?.src || null;
      }

      // Step to the next portrait choice for this member's class and record
      // the pick on the member (persists with the save).
      function cycleMemberPortrait(member) {
        const list = classPortraits(member?.classKey);
        if (list.length === 0) return null;
        // No stored key means the member is showing the default (index 0).
        const current = Math.max(0, list.findIndex((entry) => entry.id === member.portraitKey));
        const next = list[(current + 1) % list.length];
        member.portraitKey = next.id;
        return next;
      }

      Object.assign(context, {
        classPortraits,
        classPortrait,
        memberPortraitEntry,
        memberPortrait,
        cycleMemberPortrait,
      });
    }
  };
}());
