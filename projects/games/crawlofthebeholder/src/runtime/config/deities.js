(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installDeities = function (context) {
    with (context) {
      // The full worshippable DCSS pantheon. Names + flavor are condensed from
      // the checked-out crawl source (dat/descript/gods.txt). Mechanics are
      // faithful-but-adapted to this party engine's four influence hooks —
      // party power, gold yield, XP, and rest healing — rather than DCSS's full
      // invocation/conduct machinery, with each god's identity steering which
      // hook(s) it favours and which deepens at high piety (`primary`).
      //
      // Favor is earned through piety (kills in the god's name); joining grants
      // starting favor so the boon is felt at once. Gozag, as in DCSS, takes no
      // piety — its golden touch is always on.
      const START_PIETY  = 30;
      const PIETY_PER_KILL = 3;
      const PIETY_MAX    = 200;
      const RANK1_PIETY  = 30;
      const RANK2_PIETY  = 120;

      const DEITIES = {
        none:            { key: "none", name: "No patron", primary: null, description: "Walk the dungeon unblessed." },
        zin:             { key: "zin", name: "Zin", primary: "rest", rest: 1, description: "A god of discipline and purity. Followers stay pure of body and soul, shielded from corruption and sustained against decay." },
        the_shining_one: { key: "the_shining_one", name: "The Shining One", primary: "power", power: 1, rest: 1, description: "A god of justice and honour, lending divine vigour to those who smite evil and the unclean dead." },
        kikubaaqudgha:   { key: "kikubaaqudgha", name: "Kikubaaqudgha", primary: "xp", power: 1, xp: 0.15, description: "A terrible Demon-God of death. Slay as many creatures as you can; in return, master the dark arts of necromancy." },
        yredelemnul:     { key: "yredelemnul", name: "Yredelemnul", primary: "power", power: 1, description: "A grim god who despoils the works of the living and binds the souls of the slain into a deathly host." },
        xom:             { key: "xom", name: "Xom", primary: "xp", xp: 0.2, description: "A wild, unpredictable god of chaos who seeks not worshippers but playthings — its whimsy as likely to bless as to bane." },
        vehumet:         { key: "vehumet", name: "Vehumet", primary: "xp", xp: 0.2, description: "A god of the destructive powers of magic, granting command of the hermetic arts to the studious and the bold." },
        okawaru:         { key: "okawaru", name: "Okawaru", primary: "power", power: 1, xp: 0.15, description: "A dangerous god of battle. Followers must prove themselves in combat by their own strength, channeling his might." },
        makhleb:         { key: "makhleb", name: "Makhleb the Destroyer", primary: "power", power: 1, rest: 1, description: "A fearsome deity of bloodshed. Cleanse the world through suffering and death; the carnage sustains the faithful." },
        sif_muna:        { key: "sif_muna", name: "Sif Muna the Loreminder", primary: "xp", xp: 0.25, description: "A contemplative deity served by those who seek magical knowledge, rewarding triumph with power and understanding." },
        trog:            { key: "trog", name: "Trog", primary: "power", power: 2, description: "Ancient god of anger and violence. His faithful gain raw battle-fury — but are forbidden all spell magic." },
        nemelex_xobeh:   { key: "nemelex_xobeh", name: "Nemelex Xobeh", primary: "gold", gold: 0.3, xp: 0.1, description: "A trickster god of chance, whose powers are invoked through packs of cards painted in demon ichor. Fortune favours the daring." },
        elyvilon:        { key: "elyvilon", name: "Elyvilon the Healer", primary: "rest", rest: 2, description: "Welcomes all kind souls prepared to help others, granting powerful healing by which bloodshed may be avoided." },
        lugonu:          { key: "lugonu", name: "Lugonu the Unformed", primary: "power", power: 1, xp: 0.1, description: "Banished to the Abyss, Lugonu seeks followers to spread bloodshed and corruption across the overworld." },
        beogh:           { key: "beogh", name: "Beogh", primary: "power", power: 1, description: "A god of outcasts and the dispossessed. Prove your strength and gain lifelong companions the equal of any adventurer." },
        jiyva:           { key: "jiyva", name: "Jiyva", primary: "rest", gold: 0.25, rest: 1, description: "The ancient deity of the slimes, who rewards those who feed and spread its gelatinous flock with the bounty of digested treasure." },
        fedhas:          { key: "fedhas", name: "Fedhas Madash", primary: "rest", rest: 1, xp: 0.1, description: "God of plant and fungal life, granting the slow, patient strength of growing things to those who tend the wild." },
        cheibriados:     { key: "cheibriados", name: "Cheibriados", primary: "power", power: 1, rest: 1, description: "A god of deliberation. Move with care and attain perfection of mind and body as the mysteries of time unfold." },
        ashenzari:       { key: "ashenzari", name: "Ashenzari the Shackled", primary: "xp", xp: 0.25, description: "The bound god, all-knowing and all-seeing. Devoted worshippers grasp shreds of knowledge and foresight — at a price." },
        dithmenos:       { key: "dithmenos", name: "Dithmenos", primary: "power", power: 1, description: "God of night and of things half-seen in flickering torchlight, cloaking followers in shadow and stealth." },
        qazlal:          { key: "qazlal", name: "Qazlal Stormbringer", primary: "power", power: 1, xp: 0.1, description: "A violent god of tempests who delights in unleashing the raw forces of nature against the unsuspecting." },
        ru:              { key: "ru", name: "Ru", primary: "rest", power: 1, rest: 1, description: "Of all the gods, only Ru opposed creation. Initiates sacrifice pieces of themselves to open channels to deeper power." },
        uskayaw:         { key: "uskayaw", name: "Uskayaw the Reveller", primary: "power", power: 1, xp: 0.1, description: "A god of ecstatic dance who prizes the passion and rhythm of combat, rewarding followers for every blow struck." },
        hepliaklqana:    { key: "hepliaklqana", name: "Hepliaklqana the Forgotten", primary: "power", power: 1, description: "Accepts the worship of those who remember their forebears and fight alongside an ancestral spirit of ages past." },
        wu_jian:         { key: "wu_jian", name: "The Wu Jian Council", primary: "power", power: 2, description: "A congregation of martial monks ascended to divinity. Disciples turn movement itself into a deadly art." },
        ignis:           { key: "ignis", name: "Ignis the Dying Flame", primary: "power", power: 1, description: "The last embers of a dying fire god, offering unconditional power over flame to any who would deign to worship." },
        gozag:           { key: "gozag", name: "Gozag Ym Sagoz", primary: "gold", gold: 0.5, noPiety: true, description: "The Greedy God teaches that the world belongs to the rich. His worshippers have the touch of gold, and earn no piety — only fortune." }
      };

      function currentDeity() {
        return DEITIES[state.deity || "none"] || DEITIES.none;
      }

      function pietyRank() {
        const god = currentDeity();
        if (!god || god.key === "none") return 0;
        if (god.noPiety) return 1;
        const piety = state.piety || 0;
        if (piety >= RANK2_PIETY) return 2;
        if (piety >= RANK1_PIETY) return 1;
        return 0;
      }

      function godValue(field) {
        const god = currentDeity();
        const base = god[field] || 0;
        if (!base) return 0;
        const rank = pietyRank();
        if (rank < 1) return 0;
        if (rank >= 2 && god.primary === field) {
          return (field === "power" || field === "rest") ? base + 1 : base + 0.25;
        }
        return base;
      }

      function deityPowerBonus() { return godValue("power"); }
      function deityGoldScale() { return 1 + godValue("gold"); }
      function deityRestBonus() { return godValue("rest"); }
      function deityXpScale() { return 1 + godValue("xp"); }

      function deityDescription(key) {
        return (DEITIES[key || state.deity || "none"] || DEITIES.none).description;
      }

      function notePietyKill() {
        const god = currentDeity();
        if (!god || god.key === "none" || god.noPiety) return;
        state.piety = Math.min(PIETY_MAX, (state.piety || 0) + PIETY_PER_KILL);
      }

      function setDeity(key) {
        if (!DEITIES[key]) return false;
        state.deity = key;
        state.piety = key === "none" ? 0 : START_PIETY;
        return true;
      }

      function getDeityDefinitions() {
        return Object.values(DEITIES);
      }

      Object.assign(context, {
        DEITIES,
        currentDeity,
        pietyRank,
        deityPowerBonus,
        deityGoldScale,
        deityRestBonus,
        deityXpScale,
        deityDescription,
        notePietyKill,
        setDeity,
        getDeityDefinitions
      });
    }
  };
}());
