(() => {
  "use strict";

  const WIDTH = 1200;
  const HEIGHT = 700;
  const RULES = Object.freeze({
    duration: 240, phases: [60, 150], royalDepartures: [26, 65, 103, 138, 170, 198, 222],
    speed: 220, breathRange: 144, capacity: 155, maxHealth: 100, dashCooldown: 2.5,
    lairRadius: 54, bankTime: 0.34, pickupRadius: 39, lootLifetime: 19, royalValue: 165,
    rivalStart: 0.85, rivalRest: 0.90,
    districtBonus: 0.25, royalPriority: 170, rebuildScale: 1, knockoutPenalty: 0,
    upgradeScores: [450, 1500], upgradeNames: ["Deep pockets", "Hotter breath"],
    towerWindup: 0.54, towerLock: 0.17, boltSpeed: 380,
    towerInterval: [2.60, 1.65, 1.16], towerDamage: [21, 32, 40]
  });
  const VARIANTS = Object.freeze({
    classic: Object.freeze({name: "Classic", description: "Four-minute raid. Bank more gold than your rival.", rules: RULES}),
    blitz: Object.freeze({name: "Blitz", description: "90 seconds. Towns rebuild sooner and upgrades cost less.", rules: Object.freeze({
      ...RULES, duration: 90, phases: [25, 58], royalDepartures: [15, 41, 66], upgradeScores: [300, 900], rebuildScale: 0.65
    })}),
    "crown-chase": Object.freeze({name: "Crown Chase", description: "Frequent royal carriages. Each princess pays 260 gold.", rules: Object.freeze({
      ...RULES, duration: 150, phases: [45, 100], royalDepartures: [12, 24, 38, 52, 68, 82, 98, 114, 130, 140],
      royalValue: 260, royalPriority: 295
    })}),
    "high-stakes": Object.freeze({name: "High Stakes", description: "Each extra district adds 40% to a deposit. A knockout costs a quarter of your banked gold.", rules: Object.freeze({
      ...RULES, duration: 180, phases: [40, 105], royalDepartures: [26, 65, 103, 138, 170], districtBonus: 0.40, knockoutPenalty: 0.25
    })})
  });
  const LAIRS = [{x: 148, y: 486, name: "Cinder Crag"}, {x: 1045, y: 182, name: "Blue Roost"}];
  const TOWNS = [
    {name: "Hushwick", x: 333, y: 451, color: "#d97951", road: [[333,451],[365,483],[444,512],[542,526]]},
    {name: "Highmere", x: 405, y: 205, color: "#d39a5e", road: [[405,205],[353,258],[315,299],[299,378],[333,451]]},
    {name: "Rosebridge", x: 542, y: 526, color: "#c36867", road: [[542,526],[589,475],[646,431],[719,446],[820,486]]},
    {name: "Saltmarket", x: 820, y: 486, color: "#d09453", road: [[820,486],[875,468],[921,422],[895,365],[883,311]]},
    {name: "Bellwatch", x: 883, y: 311, color: "#b76762", road: [[883,311],[829,267],[786,225],[740,175],[724,143]]},
    {name: "Northglass", x: 724, y: 143, color: "#c99361", road: [[724,143],[659,137],[601,168],[561,214],[488,225],[405,205]]}
  ];
  const ROYAL_ROUTES = [
    [[542,526],[589,475],[646,431],[719,446],[820,486],[875,468],[921,422],[895,365],[883,311]],
    [[724,143],[659,137],[601,168],[561,214],[488,225],[405,205],[353,258],[315,299],[299,378],[333,451]],
    [[883,311],[829,267],[786,225],[740,175],[724,143],[659,137],[601,168],[561,214],[488,225],[405,205]]
  ];
  const plots = [[-25,-12,"house",0.48,26],[17,-21,"hall",0.73,38],[-11,24,"house",0.48,26],[27,17,"tower",1.22,41]];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const bearing = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const angleDelta = (a, b) => Math.atan2(Math.sin(b-a), Math.cos(b-a));
  const routes = new WeakMap();

  function pointOnRoad(road, distance) {
    if (!routes.has(road)) {
      const segments = road.slice(1).map(([x,y], i) => Math.hypot(x-road[i][0], y-road[i][1]));
      routes.set(road, segments);
    }
    const segments = routes.get(road);
    for (const [i, length] of segments.entries()) {
      const [x, y] = road[i];
      const [nextX, nextY] = road[i+1];
      if (distance <= length) {
        const amount = clamp(distance / length, 0, 1);
        return {x: x+(nextX-x)*amount, y: y+(nextY-y)*amount, angle: Math.atan2(nextY-y, nextX-x), arrived: false};
      }
      distance -= length;
    }
    const [x, y] = road.at(-1);
    return {x, y, arrived: true, angle: 0};
  }

  function dragon(index) {
    const home = LAIRS[index];
    return {id: index, x: home.x, y: home.y, vx: 0, vy: 0, angle: index === 0 ? -0.24 : 2.7,
      health: RULES.maxHealth, breath: 1, firing: false, winded: false, invulnerable: 0, dash: 0, carry: 0, royal: false,
      marks: new Map(), bank: 0, score: 0, rank: 0, recover: 0, lastDash: false, returning: false,
      readyAt: index === 1 ? RULES.rivalStart : 0};
  }

  function resolveVariant(id) {
    return Object.hasOwn(VARIANTS,id) ? id : "classic";
  }

  function createGame(id) {
    const variant = resolveVariant(id);
    const {rules} = VARIANTS[variant];
    return {
      variant, rules, time: 0, phase: 0, ended: false, seed: 75643, royalCount: 0,
      dragons: [dragon(0), dragon(1)], events: [], bolts: [], loot: [],
      wagons: [makeWagon(0, false, 21), makeWagon(4, false, 54)],
      towns: TOWNS.map((town,id) => ({...town, id, attention: 0, prosperity: 0, guard: 1 + id*0.24, launch: 0,
        nextWagon: 5 + id*2.8, buildings: plots.map(([x,y,type,health,value]) => ({
          x: town.x+x, y: town.y+y, type, health, maxHealth: health, value, rebuild: 0, burning: 0
        }))
      })),
      stats: {sorties: 0, royals: 0, burns: 0, knockouts: 0}
    };
  }

  function random(game) {
    game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0;
    return game.seed / 4294967296;
  }

  function makeWagon(town, royal, progress = 0, ordinal = 0, value = 48) {
    const road = royal ? ROYAL_ROUTES[ordinal % ROYAL_ROUTES.length] : TOWNS[town].road;
    const position = pointOnRoad(road, progress);
    const rich = !royal && value >= 72;
    return {...position, town, royal, rich, road, progress, health: royal ? 0.66 : rich ? 0.40 : 0.31,
      value, burning: 0, underAttack: false};
  }

  function event(game, type, x, y, amount = 0, actor = 0) {
    game.events.push({type, x, y, amount, actor});
  }

  function scatter(game, x, y, value, town, royal = false) {
    const portions = royal ? 1 : clamp(Math.round(value/17), 1, 5);
    for (let i = 0; i < portions; i += 1) {
      const direction = random(game)*Math.PI*2;
      const radius = royal ? 0 : 9+random(game)*15;
      game.loot.push({x: x+Math.cos(direction)*radius, y: y+Math.sin(direction)*radius,
        value: Math.floor(value/portions)+(i < value%portions ? 1 : 0), town, royal, life: RULES.lootLifetime});
    }
  }

  function capacity(drake) {
    return RULES.capacity + (drake.rank >= 1 ? 55 : 0);
  }

  function inCone(drake, target) {
    const range = RULES.breathRange + (drake.rank >= 2 ? 20 : 0);
    return gap(drake, target) < range && Math.abs(angleDelta(drake.angle, bearing(drake,target))) < 0.42;
  }

  function rivalInput(game, rival) {
    const player = game.dragons[0];
    const home = LAIRS[1];
    if (game.time < rival.readyAt) return steerTo(rival, home);
    const available = game.loot.filter(item => item.royal ? !rival.royal : rival.carry < capacity(rival));
    const prize = available.reduce((best,item) => !best || gap(rival,item)-(item.royal?100:0) < gap(rival,best)-(best.royal?100:0) ? item : best, null);
    if (rival.health < 50 || (rival.returning && rival.health < 80) || rival.royal || rival.carry >= capacity(rival)*0.73 ||
        (game.rules.duration-game.time < gap(rival,home)/(RULES.speed*.8)+1 && rival.carry > 0)) {
      rival.returning = true;
      return steerTo(rival, home);
    }
    rival.returning = false;
    if (prize && gap(rival, prize) < 200) {
      return steerTo(rival, prize);
    }
    const options = game.towns.flatMap(town => town.buildings.filter(building => !building.rebuild));
    options.push(...game.wagons);
    const target = options.reduce((best,item) => {
      const cost = object => gap(rival,object) + (gap(player,object)<120 && !object.royal && !object.rich ? 60 : 0)
        - (object.royal ? game.rules.royalPriority : object.rich ? 52 : 0);
      return !best || cost(item) < cost(best) ? item : best;
    }, null);
    if (target) {
      const distance = gap(rival,target);
      const range = RULES.breathRange+(rival.rank >= 2 ? 20 : 0);
      return steerTo(rival,target,distance<range-6,distance<range-6 && rival.breath>0.13);
    }
    return steerTo(rival, home);
  }

  function steerTo(drake, target, slow = false, fire = false) {
    const direction = bearing(drake, target);
    const thrust = clamp(gap(drake,target)/55, 0, slow?0.46:1);
    return {x: Math.cos(direction)*thrust, y: Math.sin(direction)*thrust, aim: direction, fire, dash: false};
  }

  function moveDragon(game, drake, input, dt) {
    drake.invulnerable = Math.max(0, drake.invulnerable-dt);
    drake.dash = Math.max(0, drake.dash-dt);
    if (drake.recover > 0) {
      drake.recover = Math.max(0,drake.recover-dt);
      return;
    }
    const magnitude = Math.max(1, Math.hypot(input.x, input.y));
    const x = input.x/magnitude;
    const y = input.y/magnitude;
    const moving = Math.hypot(x,y)>0.07;
    const heading = moving ? Math.atan2(y,x) : drake.angle;
    if (!input.fire) drake.winded = false;
    drake.firing = Boolean(input.fire && !drake.winded);
    const aim = drake.firing ? input.aim ?? heading : heading;
    const dash = input.dash && !drake.lastDash && drake.dash === 0;
    drake.lastDash = input.dash;
    drake.angle += angleDelta(drake.angle, aim)*(1-Math.exp(-(drake.firing ? 34 : 22)*dt));
    if (dash) {
      const direction = moving ? heading : input.aim ?? drake.angle;
      if (!moving && !drake.firing) drake.angle = direction;
      drake.dash = RULES.dashCooldown;
      drake.vx = Math.cos(direction)*585;
      drake.vy = Math.sin(direction)*585;
      event(game, "dash", drake.x, drake.y, 0, drake.id);
    }
    const atHome = gap(drake, LAIRS[drake.id]) < RULES.lairRadius;
    const burden = drake.royal ? 0.80 : 1-0.14*(drake.carry/capacity(drake));
    const speed = RULES.speed * burden * (drake.firing?0.90:1);
    const damping = 1-Math.exp(-(drake.dash > RULES.dashCooldown-0.15 ? 3 : moving ? 13 : 15)*dt);
    drake.vx += (x*speed-drake.vx)*damping;
    drake.vy += (y*speed-drake.vy)*damping;
    drake.x = clamp(drake.x+drake.vx*dt, 26, WIDTH-26);
    drake.y = clamp(drake.y+drake.vy*dt, 27, HEIGHT-33);
    drake.breath = clamp(drake.breath + (drake.firing ? -0.46 : atHome ? 1.42 : 0.63)*dt,0,1);
    if (drake.breath === 0) drake.winded = true;
    if (atHome) {
      drake.health = Math.min(RULES.maxHealth, drake.health+32*dt);
    }
  }

  function raid(game, drake, dt) {
    if (!drake.firing) return;
    const heat = dt*(drake.rank >= 2 ? 1.38 : 1);
    for (const town of game.towns) {
      if (gap(drake,town) > 215) continue;
      for (const building of town.buildings) {
        if (building.rebuild || !inCone(drake,building)) continue;
        building.health -= heat;
        building.burning = 1.1;
        town.attention = Math.min(1,town.attention+dt*0.7);
        if (building.health <= 0) {
          building.rebuild = (31+random(game)*10)*game.rules.rebuildScale;
          scatter(game, building.x, building.y, building.value, town.id);
          event(game, "burn", building.x, building.y, 0, drake.id);
          game.stats.burns += drake.id === 0 ? 1 : 0;
        }
      }
    }
    for (const wagon of game.wagons) {
      if (wagon.health <= 0 || !inCone(drake,wagon)) continue;
      wagon.health -= heat;
      wagon.burning = 0.8;
      if (wagon.royal) wagon.underAttack = true;
      if (wagon.health <= 0) {
        scatter(game, wagon.x, wagon.y, wagon.value, wagon.town, wagon.royal);
        event(game, wagon.royal ? "royalOpen" : "burn", wagon.x, wagon.y, 0, drake.id);
      }
    }
  }

  function collectAndBank(game, drake, dt) {
    if (drake.recover > 0) return;
    for (const item of game.loot) {
      if (item.life <= 0 || gap(drake,item)>RULES.pickupRadius) continue;
      if (item.royal && !drake.royal) {
        drake.royal = true;
        item.life = 0;
        event(game,"royal",item.x,item.y,0,drake.id);
      } else if (!item.royal && drake.carry < capacity(drake)) {
        const amount = Math.min(item.value,capacity(drake)-drake.carry);
        drake.carry += amount;
        drake.marks.set(item.town,(drake.marks.get(item.town) ?? 0)+amount);
        item.value -= amount;
        item.life = item.value > 0 ? item.life : 0;
        event(game,"coin",item.x,item.y,amount,drake.id);
      }
    }
    if (gap(drake,LAIRS[drake.id])<RULES.lairRadius && (drake.carry || drake.royal)) {
      drake.bank += dt;
      if (drake.bank >= RULES.bankTime) {
        const multiplier = 1+game.rules.districtBonus*clamp(drake.marks.size-1,0,3);
        const amount = Math.round(drake.carry*multiplier) + (drake.royal ? game.rules.royalValue : 0);
        drake.score += amount;
        if (drake.id === 0) {
          game.stats.sorties += 1;
          game.stats.royals += drake.royal ? 1 : 0;
        } else {
          drake.readyAt = game.time + RULES.rivalRest;
        }
        drake.carry = 0;
        drake.bank = 0;
        drake.royal = false;
        drake.marks.clear();
        event(game,"bank",drake.x,drake.y,amount,drake.id);
        const rank = game.rules.upgradeScores.filter(score => drake.score >= score).length;
        if (rank > drake.rank) {
          drake.rank = rank;
          event(game,"upgrade",drake.x,drake.y,rank,drake.id);
        }
      }
    } else {
      drake.bank = 0;
    }
  }

  function damage(game, drake, amount) {
    if (drake.invulnerable > 0 || drake.recover > 0) return;
    drake.health = Math.max(0,drake.health-amount);
    drake.invulnerable = 0.57;
    event(game,"hit",drake.x,drake.y,amount,drake.id);
    if (drake.health === 0) {
      for (const [town, value] of drake.marks) scatter(game,drake.x,drake.y,value,town);
      if (drake.royal) scatter(game,drake.x,drake.y,game.rules.royalValue,0,true);
      const penalty = Math.ceil(drake.score*game.rules.knockoutPenalty);
      drake.score -= penalty;
      event(game,"fall",drake.x,drake.y,penalty,drake.id);
      game.stats.knockouts += drake.id === 0 ? 1 : 0;
      Object.assign(drake,{x:LAIRS[drake.id].x,y:LAIRS[drake.id].y,vx:0,vy:0,
        breath:1,health:RULES.maxHealth,recover:1.65,invulnerable:2.4,firing:false,winded:false,carry:0,royal:false,bank:0});
      drake.marks.clear();
    }
  }

  function guardShot(game, town, tower, dt) {
    if (town.launch > 0) {
      const target = game.dragons[town.target];
      // Freeze the aiming line before release so a turn can clear the shot.
      if (town.launch > RULES.towerLock) town.shotAngle = towerAim(tower,target);
      town.launch = Math.max(0,town.launch-dt);
      if (town.launch === 0) {
        game.bolts.push({x:tower.x,y:tower.y,angle:town.shotAngle,age:0});
        event(game,"bolt",tower.x,tower.y);
      }
    } else {
      const range = 148+game.phase*23;
      const enemy = game.dragons.filter(drake => drake.recover === 0 && gap(drake,tower)<range)
        .sort((a,b) => gap(a,tower)-gap(b,tower))[0];
      if (!town.guard && enemy && (town.attention>0.12 || game.phase>0)) {
        town.target = enemy.id;
        town.shotAngle = towerAim(tower,enemy);
        town.launch = RULES.towerWindup;
        town.guard = RULES.towerInterval[game.phase];
      }
    }
  }

  function towerAim(tower,target) {
    const lead = Math.min(0.53,gap(tower,target)/RULES.boltSpeed+RULES.towerLock);
    return bearing(tower,{x:target.x+target.vx*lead,y:target.y+target.vy*lead});
  }

  function updateKingdom(game, dt) {
    for (const town of game.towns) {
      town.attention = Math.max(0,town.attention-dt*0.065);
      town.guard = Math.max(0,town.guard-dt);
      let intact = 0;
      for (const building of town.buildings) {
        if (building.rebuild > 0) {
          building.rebuild = Math.max(0,building.rebuild-dt);
          if (building.rebuild === 0) building.health = building.maxHealth;
        } else {
          intact += 1;
        }
        building.burning = Math.max(0,building.burning-dt);
      }
      const tower = town.buildings[3];
      if (!tower.rebuild) {
        guardShot(game,town,tower,dt);
      } else {
        town.launch = 0;
      }
      const change = intact === 4 ? dt/18 : -dt/5;
      town.prosperity = clamp(town.prosperity+change,0,1);
      if (game.time >= town.nextWagon) {
        const value = Math.round(32+intact*6+33*town.prosperity);
        if (intact >= 2) game.wagons.push(makeWagon(town.id,false,0,0,value));
        town.nextWagon += 14+(4-intact)*3+random(game)*4-2*town.prosperity;
      }
    }
    if (game.time >= (game.rules.royalDepartures[game.royalCount] ?? Infinity)) {
      const district = [2,5,4][game.royalCount%3];
      const wagon = makeWagon(district,true,0,game.royalCount,game.rules.royalValue);
      game.wagons.push(wagon);
      event(game,"royalDeparture",wagon.x,wagon.y);
      game.royalCount += 1;
    }
    for (const wagon of game.wagons) {
      wagon.progress += dt*(wagon.royal ? (wagon.underAttack ? 56 : 46) : 32);
      Object.assign(wagon,pointOnRoad(wagon.road,wagon.progress));
      wagon.burning = Math.max(0,wagon.burning-dt);
    }
    game.wagons = game.wagons.filter(wagon => wagon.health>0 && !wagon.arrived);
    for (const bolt of game.bolts) {
      bolt.age += dt;
      bolt.x += Math.cos(bolt.angle)*RULES.boltSpeed*dt;
      bolt.y += Math.sin(bolt.angle)*RULES.boltSpeed*dt;
      const victim = game.dragons.find(drake => gap(drake,bolt)<16 && drake.recover === 0 &&
        drake.invulnerable === 0 && gap(drake,LAIRS[drake.id])>RULES.lairRadius);
      if (victim) {
        damage(game,victim,RULES.towerDamage[game.phase]);
        bolt.age = 2;
      }
    }
    game.bolts = game.bolts.filter(bolt => bolt.age<0.83);
    for (const loot of game.loot) loot.life -= dt;
    game.loot = game.loot.filter(loot => loot.life>0);
  }

  function step(game, input, dt) {
    game.events.length = 0;
    if (game.ended) return;
    game.time = Math.min(game.rules.duration,game.time+dt);
    const phase = game.rules.phases.filter(time => game.time>=time).length;
    if (phase !== game.phase) {
      game.phase = phase;
      event(game,"phase",0,0,phase);
    }
    moveDragon(game,game.dragons[0],input,dt);
    moveDragon(game,game.dragons[1],rivalInput(game,game.dragons[1]),dt);
    for (const drake of game.dragons) raid(game,drake,dt);
    for (const drake of game.dragons) collectAndBank(game,drake,dt);
    updateKingdom(game,dt);
    if (game.time >= game.rules.duration) {
      game.ended = true;
      event(game,"finish",0,0);
    }
  }

  globalThis.Cinder = {WIDTH, HEIGHT, RULES, VARIANTS, LAIRS, TOWNS, createGame, step, gap, bearing, angleDelta, clamp, capacity};
})();

if (typeof process !== "undefined" && process.argv[2] === "-test") require("./game.test.cjs");
