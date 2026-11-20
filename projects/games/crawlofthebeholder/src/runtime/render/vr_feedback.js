(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installVrFeedback = function (c) {
    // Presentation-only records: never serialized or used to decide combat.
    let song = null;
    const STATUS = [
      ["snaredTurns", "NET", "Held: movement attempts struggle against the snare."],
      ["rootedTurns", "NET", "Rooted: unable to move."],
      ["poisonedTurns", "POISON", "Poison: takes damage over time."],
      ["burningTurns", "FIRE", "Burning: takes fire damage."],
      ["immolationTurns", "INNER FLAME", "Inner flame: explodes on death."],
      ["slowedTurns", "SLOW", "Slowed: enemies gain extra opportunities to act."],
      ["dazedTurns", "DAZED", "Dazed: actions may fail."],
      ["confusedTurns", "CONFUSED", "Confused: movement is unreliable."],
      ["stunnedTurns", "STUN", "Stunned: unable to act normally."],
      ["fearTurns", "FEAR", "Frightened: flees from danger."],
      ["corrodedTurns", "CORROSION", "Corroded: armour is weakened."],
      ["engulfedTurns", "ENGULFED", "Engulfed: trapped in water."],
      ["barbedTurns", "BARBS", "Barbs: movement causes damage."],
      ["vitrifiedTurns", "BRITTLE", "Vitrified: more vulnerable to damage."],
      ["hasteTurns", "HASTE", "Haste: acts faster."],
      ["mightTurns", "MIGHT", "Might: increased attack power."],
      ["rageTurns", "RAGE", "Rage: increased attack power."],
      ["resistanceTurns", "RESIST", "Resistance: reduced elemental damage."],
      ["silenceTurns", "SILENCE", "Silence: suppresses spellcasting."],
      ["silencedTurns", "SILENCE", "Silenced: cannot cast spells."],
      ["weakenedTurns", "WEAK", "Weakened: reduced attack power."],
      ["markedTurns", "MARKED", "Marked: attracts enemies."]
    ];

    function vrStatusInfo(subject) {
      return STATUS.filter(([field]) => subject[field] > 0)
        .map(([field, label, description]) => ({ label, turns: subject[field], description }));
    }

    function noteVrRangedStatus(ranged, monster) {
      if (ranged.status === "lure" && monster) {
        song = { floor: c.currentFloor(), turn: c.state.turnCount,
          duration: ranged.statusTurns || 4, id: monster.id, name: monster.name };
      } else {
        return;
      }
    }

    function vrActiveSong() {
      if (song && song.floor === c.currentFloor() && c.state.turnCount >= song.turn
          && c.state.turnCount - song.turn < song.duration && c.state.slowedTurns > 0) {
        return song;
      } else {
        song = null;
        return null;
      }
    }

    function vrBoardLabels() {
      const statuses = vrStatusInfo(c.state);
      const active = vrActiveSong();
      const text = statuses.map((s) => `${s.label} ${s.turns}`).join(" · ");
      const labels = text ? [{ x: c.state.x, y: c.state.y, text: active ? `SONG · ${text}` : text }] : [];
      if (active) {
        const caster = c.currentFloorState().monsters.find((m) => m.id === active.id && m.hp > 0);
        if (caster && c.currentFloorState().discovered.has(c.keyOf(caster.x, caster.y))) {
          labels.push({ x: caster.x, y: caster.y, text: "SONG → PARTY" });
        } else {
          return labels;
        }
      } else {
        return labels;
      }
      return labels;
    }

    function vrSwampTreeAt(x, y) {
      const floor = c.currentFloor();
      const inside = x > 0 && y > 0 && x < floor.map.width - 1 && y < floor.map.height - 1;
      if (/^swamp:/i.test(floor.id) && inside && c.cellAt(x, y) === "x"
          && c.dirs.some((dir) => !c.solidAt(x + dir.x, y + dir.y))) {
        const tile = `vendor/crawl/crawl-ref/source/rltiles/dngn/trees/mangrove${1 + c.cellHash(x, y, 219) % 3}.png`;
        return { name: "mangrove", texture: c.environmentAsset(tile) };
      } else {
        return null;
      }
    }

    function vrShoreSurfaces(x, y) {
      if (/^swamp:/i.test(c.currentFloor().id) && c.terrainAt(x, y) === "floor") {
        const edges = [[0, -1, "top"], [1, 0, "rgt"], [0, 1, "btm"], [-1, 0, "lft"]];
        return edges.filter(([dx, dy]) => ["water", "deep-water"].includes(c.terrainAt(x + dx, y + dy)))
          .map(([, , side]) => ({ kind: "decal", x, y,
            texture: c.environmentAsset(`vendor/crawl/crawl-ref/source/rltiles/dngn/water/murky_bord_${side}.png`),
            inset: 0, lift: 0.008, alpha: 0.85 }));
      } else {
        return [];
      }
    }

    function vrCloudGraphic(cloud) {
      const assets = c.graphicsAssets();
      const cold = assets.iceCloud || assets.effectIce;
      const flame = assets.flameCloud || assets.effectFlame;
      return { poison: assets.poisonCloud, petrify: assets.petrifyCloud,
        flame, fire: flame, cold, frost: cold }[cloud.kind] || assets.fog;
    }

    function partyDetails() {
      const lines = [];
      for (const member of c.state.party) {
        const klass = c.CLASSES[member.classKey];
        lines.push(`${member.name} · ${klass?.name || "Adventurer"} · health ${Math.max(0, member.hp)}/${member.maxHp} · power ${member.power} defense ${member.defense}`);
        lines.push(`Gear: ${member.weapon?.shortName || member.weapon?.name || "unarmed"} / ${member.armour?.shortName || member.armour?.name || "no armour"}`);
        if (klass) {
          lines.push(`${klass.signature.label}: ${member.signatureCooldown > 0 ? member.signatureCooldown + " turns" : "ready"} · ${klass.ultimate.label}: ${member.ultimateCooldown > 0 ? member.ultimateCooldown + " turns" : "ready"}`);
        } else {
          continue;
        }
      }
      for (const status of vrStatusInfo(c.state)) lines.push(`${status.label} ${status.turns} turns — ${status.description}`);
      const active = vrActiveSong();
      if (active) {
        lines.push(`${active.name}'s song pulls and slows the party; SLOW ${c.state.slowedTurns} turns.`);
      } else {
        lines.push("Point to inspect. Trigger on the party waits; grip grabs it.");
      }
      return lines;
    }

    function vrCellDetails(x, y) {
      const fs = c.currentFloorState();
      const lines = [];
      const here = (p) => p.x === x && p.y === y;
      if (x === c.state.x && y === c.state.y) {
        lines.push(...partyDetails());
      } else {
        lines.push(c.solidAt(x, y) ? (vrSwampTreeAt(x, y) ? "Mangrove: solid terrain." : "Wall: blocks movement and sight.") :
          `${c.terrainAt(x, y)} · ${x},${y}`);
      }
      for (const m of fs.monsters.filter((m) => here(m) && m.hp > 0)) {
        lines.push(`${m.name} · health ${m.hp}/${m.maxHp} · power ${m.power || 0} defense ${m.defense || 0}`);
        const abilities = [m.ranged, m.support, m.mobility, m.self, m.summon].filter(Boolean);
        for (const ability of abilities) lines.push(`${ability.name}${ability.range ? " · range " + ability.range : ""}${ability.status ? " · " + (ability.status === "lure" ? "pulls and slows the party" : ability.status) : ""}`);
        for (const status of vrStatusInfo(m)) lines.push(`${status.label} ${status.turns} turns — ${status.description}`);
        const resists = c.monsterResistanceLabels(m);
        if (resists.length) {
          lines.push(`Resists: ${resists.join(", ")}`);
        } else {
          lines.push("No elemental resistances.");
        }
      }
      for (const ally of (fs.allies || []).filter((a) => here(a) && a.hp > 0)) {
        lines.push(`${ally.name} · ally · health ${ally.hp}/${ally.maxHp}`);
      }
      for (const item of fs.floorItems.filter(here)) {
        const info = c.itemInfo(item);
        lines.push(`${info.name} — ${info.effect}`, info.stats.join(" · "));
      }
      for (const trap of fs.traps.filter(here)) lines.push(`${trap.name} — ${trap.armed ? "armed; adjacent selection disarms" : "disarmed"}`);
      const stairs = c.stairsAt(x, y);
      if (stairs) {
        lines.push(`Stairs ${stairs.direction}; select while standing here to travel.`);
      } else {
        lines.push(c.solidAt(x, y) ? "Point to inspect solid terrain." : "Trigger selects this tile; grip moves the board or party piece.");
      }
      const decor = c.decorAt(x, y);
      const piece = c.furnitureAt(x, y);
      for (const object of [decor, piece].filter(Boolean)) lines.push(`${object.name} — ${object.interact || object.kind || "fixture"}`);
      for (const cloud of fs.clouds.filter((cloud) => here(cloud) && cloud.turns > 0)) lines.push(`${cloud.kind} cloud · ${cloud.turns} turns`);
      for (const mark of c.floorMarksAt(x, y)) lines.push(`${mark.kind} floor mark`);
      return lines.filter(Boolean);
    }

    function vrInspectCell(x, y) {
      if (c.mapContains(x, y) && c.currentFloorState().discovered.has(c.keyOf(x, y))) {
        const party = x === c.state.x && y === c.state.y;
        return { x, y, title: party ? "Party" : `Board · ${x},${y}`, lines: vrCellDetails(x, y) };
      } else {
        return null;
      }
    }

    function drawVrInspection(ctx, width, height, model) {
      ctx.fillStyle = "rgba(14, 12, 10, 0.96)";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#d9b65e";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, width - 4, height - 4);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#f1d07a";
      ctx.font = "bold 36px system-ui, sans-serif";
      ctx.fillText(model.title, 20, 14);
      const lines = [];
      for (const text of model.lines) {
        let line = "";
        for (const word of text.split(/\s+/)) {
          const next = line ? line + " " + word : word;
          if (next.length > 76 && line) {
            lines.push(line);
            line = word;
          } else {
            line = next;
          }
        }
        lines.push(line);
      }
      const font = Math.min(30, Math.floor((height - 78) / Math.max(1, lines.length)) - 2);
      ctx.font = `${font}px system-ui, sans-serif`;
      ctx.fillStyle = "#f3e4c5";
      lines.forEach((line, i) => ctx.fillText(line, 20, 62 + i * (font + 2)));
    }

    Object.assign(c, { vrStatusInfo, noteVrRangedStatus, vrActiveSong, vrBoardLabels,
      vrSwampTreeAt, vrShoreSurfaces, vrCloudGraphic, vrInspectCell, drawVrInspection });
  };
})();
