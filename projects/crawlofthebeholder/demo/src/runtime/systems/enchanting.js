(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  // Enchanting: apply rune stones to weapons and armor to add elemental or
  // special effects. One rune per item; the effect fires on each successful
  // attack (weapon runes) or reduces incoming damage (armor runes).
  // No turn hook; hooks are called from attackTarget and hurtLiveMember.
  window.CotBRuntime.installEnchanting = function (context) {
    with (context) {
      const RUNES = [
        { id: "rune-fire",   name: "fire rune",    kind: "rune", runeKind: "fire",   slot: "weapon", value: 20,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune_fire.png" },
        { id: "rune-ice",    name: "ice rune",     kind: "rune", runeKind: "ice",    slot: "weapon", value: 20,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune_ice.png" },
        { id: "rune-life",   name: "life rune",    kind: "rune", runeKind: "life",   slot: "weapon", value: 24,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune_life.png" },
        { id: "rune-storm",  name: "storm rune",   kind: "rune", runeKind: "storm",  slot: "weapon", value: 22,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune_storm.png" },
        { id: "rune-shadow", name: "shadow rune",  kind: "rune", runeKind: "shadow", slot: "weapon", value: 18,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune_dark.png" },
        { id: "rune-earth",  name: "earth rune",   kind: "rune", runeKind: "earth",  slot: "armor",  value: 20,
          tile: "vendor/crawl/crawl-ref/source/rltiles/item/misc/rune_earth.png" }
      ];

      // Register rune items (idempotent).
      (function registerRunes() {
        for (const tpl of RUNES) {
          if (!resources.inventory.some((i) => i.id === tpl.id)) {
            resources.inventory.push({ ...tpl });
          }
        }
      }());

      // Apply a rune from inventory to a weapon or armor in inventory.
      function enchantItem(runeId, targetId, messages) {
        const rune   = state.inventory.find((i) => i.id === runeId   && i.kind === "rune");
        const target = state.inventory.find((i) => i.id === targetId && i.kind !== "rune");
        if (!rune || !target) { messages.push("Cannot find both items."); return false; }
        if (target.rune) { messages.push(`${target.name} already bears a rune.`); return false; }
        if (rune.slot === "weapon" && !["weapon", "sword", "axe", "mace", "staff", "dagger", "bow"].includes(target.kind)) {
          messages.push(`${rune.name} bonds only to weapons.`); return false;
        }
        if (rune.slot === "armor" && !["armor", "shield", "helm", "boots", "gloves"].includes(target.kind)) {
          messages.push(`${rune.name} bonds only to armor.`); return false;
        }
        target.rune = rune.runeKind;
        // Brand the gear with the real DCSS ego that matches the rune, and
        // attach its authentic flavour for the item tooltip.
        const brand = runeBrand(rune.runeKind);
        if (brand) {
          target.brand = brand;
          if (typeof egoLore === "function") target.brandLore = egoLore(brand);
        }
        state.inventory = state.inventory.filter((i) => i !== rune);
        const brandNote = brand ? ` (${brand})` : "";
        messages.push(`${target.name} is now imbued with ${rune.name}${brandNote}.`);
        return true;
      }

      // Map the game's rune kinds onto real DCSS weapon/armour brands (egos.txt).
      const RUNE_BRANDS = {
        fire: "flaming", ice: "freezing", storm: "electrocution",
        life: "draining", shadow: "distortion", earth: "protection"
      };
      function runeBrand(runeKind) {
        return RUNE_BRANDS[runeKind] || null;
      }

      // Called from attackTarget: trigger weapon-rune proc on the first live attacker's weapon.
      function applyWeaponEnchantment(attackers, target) {
        const attacker = attackers[0];
        if (!attacker) return;
        const weapon = (attacker.equipment || []).find((e) => e.slot === "mainhand" || e.slot === "weapon");
        if (!weapon?.rune) return;

        const floorState = currentFloorState();

        switch (weapon.rune) {
          case "fire":
            // Burn the target (add burning status).
            if (Math.random() < 0.35) {
              target.burningTurns = Math.max(target.burningTurns || 0, 3);
            }
            break;
          case "ice":
            // Slow the target.
            if (Math.random() < 0.35) {
              target.slowedTurns = Math.max(target.slowedTurns || 0, 3);
            }
            break;
          case "life":
            // Heal the lead member (5% of their max HP) on any hit.
            if (attacker.maxHp > 0) {
              const heal = Math.max(1, Math.ceil(attacker.maxHp * 0.05));
              attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            }
            break;
          case "storm":
            // Arc lightning to a random adjacent monster.
            if (Math.random() < 0.3) {
              const adj = floorState.monsters.filter(
                (m) => m !== target && m.hp > 0 && Math.abs(m.x - target.x) <= 1 && Math.abs(m.y - target.y) <= 1
              );
              if (adj.length > 0) {
                const arc = adj[Math.floor(Math.random() * adj.length)];
                const dmg = Math.max(1, Math.round(8 - (arc.ac || 0) / 4));
                arc.hp = Math.max(0, arc.hp - dmg);
              }
            }
            break;
          case "shadow":
            // Bonus damage when attacking from behind (confused/feared targets).
            // Shadow rune: 20% chance to inflict feared status.
            if (Math.random() < 0.2) {
              target.fearTurns = Math.max(target.fearTurns || 0, 2);
            }
            break;
          default:
            break;
        }
      }

      // Called from hurtLiveMember: return flat damage reduction from armor rune.
      function armorEnchantBonus(member) {
        const armor = (member.equipment || []).find((e) => e.slot === "body" || e.slot === "armor");
        if (!armor?.rune) return 0;
        if (armor.rune === "earth") return 2; // flat -2 damage per hit
        return 0;
      }

      context.enchantItem             = enchantItem;
      context.runeBrand               = runeBrand;
      context.applyWeaponEnchantment  = applyWeaponEnchantment;
      context.armorEnchantBonus       = armorEnchantBonus;
      context.ENCHANTING_RUNES        = RUNES;
    }
  };
}());
