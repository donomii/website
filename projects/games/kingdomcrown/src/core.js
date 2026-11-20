import { EXPANSION_CONFIG, addHumanCorpse, createExpansionState, getExpansionInteractions, performExpansionInteraction, resolveExpansionCasualties, updateExpansion } from "./expansion.js";
import { MOVEMENT_CONFIG, updateRidingPlayer } from "./movement.js";
import { advancePurchase, returnCoins } from "./purchases.js";

export const CONFIG = Object.freeze({
    worldWidth: EXPANSION_CONFIG.worldWidth,
    playerStartX: EXPANSION_CONFIG.worldWidth / 2,
    playerMaxVeil: 100,
    playerMaxStamina: 100,
    ...MOVEMENT_CONFIG,
    heartVeilRecovery: 24,
    heartMaxHealth: 320,
    interactionRange: 112,
    finalRitualCost: 16,
    finalAssaultDistance: 780,
    finalReserveDelay: 7,
    sitePositions: Object.freeze([615, 1500, 2700, 3585]),
    grovePositions: Object.freeze([260, 770, 1060, 1320, 1840, 2360, 2880, 3140, 3430, 3940]),
    siteCosts: Object.freeze([8, 14, 22]),
    siteHealth: Object.freeze([0, 145, 215, 300]),
    siteSpawnIntervals: Object.freeze([0, 5.5, 4.4, 3.5]),
    siteHorrorLimits: Object.freeze([0, 2, 3, 4]),
    firstWaveDelay: 8,
    waveEntryMargin: 285,
    wispLimit: 18,
});

const HUMAN_STATS = Object.freeze({
    soldier: Object.freeze({ health: 62, speed: 68, damage: 13, range: 34, cooldown: 1.05 }),
    archer: Object.freeze({ health: 44, speed: 54, damage: 10, range: 245, cooldown: 1.7 }),
    torchbearer: Object.freeze({ health: 78, speed: 48, damage: 22, range: 40, cooldown: 1.35 }),
});

const HORROR_STATS = Object.freeze({
    crawler: Object.freeze({ health: 64, speed: 82, damage: 18, range: 31, cooldown: 0.9 }),
    brute: Object.freeze({ health: 135, speed: 44, damage: 30, range: 45, cooldown: 1.45 }),
});

const NO_INPUT = Object.freeze({
    left: false,
    right: false,
    stop: false,
    gallop: false,
    interactPressed: false,
    interactHeld: false,
    interactTargetId: null,
});

export function seededRandom(seed = 0x51ee9) {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

export function createGame(seed = 0x51ee9) {
    const random = seededRandom(seed);
    const state = {
        status: "title",
        time: 0,
        dread: 12,
        wave: 0,
        waveTimer: CONFIG.firstWaveDelay,
        waveWarning: false,
        wispTimer: 3.5,
        ritualStarted: false,
        purchase: null,
        siegeReserveTimer: null,
        nextId: 1,
        player: {
            x: CONFIG.playerStartX,
            vx: 0,
            facing: 1,
            veil: CONFIG.playerMaxVeil,
            maxVeil: CONFIG.playerMaxVeil,
            stamina: CONFIG.playerMaxStamina,
            maxStamina: CONFIG.playerMaxStamina,
            exhausted: false,
            gaitPhase: 0,
            reformTimer: 0,
            invulnerable: 0,
        },
        heart: {
            id: "heart",
            x: CONFIG.playerStartX,
            hp: CONFIG.heartMaxHealth,
            maxHp: CONFIG.heartMaxHealth,
        },
        sites: CONFIG.sitePositions.map((x, index) => ({
            id: `site-${index + 1}`,
            x,
            level: 0,
            hp: 0,
            maxHp: 0,
            spawnTimer: 0,
            spawnCount: 0,
        })),
        ...createExpansionState(),
        humans: [],
        horrors: [],
        wisps: [],
        events: [],
        notice: { text: "", ttl: 0 },
    };
    seedInitialWisps(state, random);
    return state;
}

export function restartGame(seed = Date.now()) {
    return createGame(seed);
}

export function activeSiteCount(state) {
    return state.sites.filter((site) => site.level > 0).length;
}

export function assaultSides(wave) {
    return wave % 3 === 0 ? [-1, 1] : [wave % 2 === 1 ? -1 : 1];
}

export function assaultDirection(wave) {
    const sides = assaultSides(wave);
    return sides.length === 2 ? "Both flanks" : sides[0] < 0 ? "West" : "East";
}

export function getInteractions(state) {
    const player = state.player;
    if (player.reformTimer > 0) {
        return [];
    } else {
        const landmarks = [...state.sites, state.heart];
        const nearby = landmarks.flatMap((landmark) => {
            const distance = Math.abs(landmark.x - player.x);
            const isHeart = landmark === state.heart;
            const range = CONFIG.interactionRange + (isHeart ? 20 : 0);
            if (distance > range) {
                return [];
            } else {
                const action = isHeart ? describeHeartInteraction(state) : describeSiteInteraction(state, landmark);
                return [{ ...action, x: landmark.x, distance }];
            }
        });
        return [...nearby, ...getExpansionInteractions(state)].sort((left, right) => left.distance - right.distance);
    }
}

export function getInteraction(state, targetId = null) {
    const interactions = getInteractions(state);
    return targetId === null ? interactions[0] ?? null : interactions.find((action) => action.targetId === targetId) ?? null;
}

export function canSelectInteraction(interaction) {
    return interaction !== null && interaction.action !== "blocked" && interaction.action !== "maxed";
}

export function togglePause(state) {
    switch (state.status) {
        case "playing":
            state.status = "paused";
            break;
        case "paused":
            state.status = "playing";
            break;
        default:
            return state;
    }
    return state;
}

export function stepGame(state, suppliedInput = NO_INPUT, elapsed = 0, random = Math.random) {
    const input = { ...NO_INPUT, ...suppliedInput };
    const dt = clamp(elapsed, 0, 0.05);
    state.events.length = 0;
    if (state.status !== "playing" || dt === 0) {
        return state;
    } else {
        state.time += dt;
        updateNotice(state, dt);
        advancePurchase(state, input, (targetId) => getInteraction(state, targetId), (action) => performInteraction(state, action));
        updatePlayer(state, input, dt);
        collectWisps(state);
        updateSites(state, dt);
        updateExpansion(state, dt, random);
        updateHorrors(state, dt);
        updateHumans(state, dt);
        resolveDefeatedEntities(state, random);
        resolveExpansionCasualties(state);
        updateStructures(state, dt);
        updateNaturalWisps(state, dt, random);
        updateAssaults(state, dt);
        resolveEndState(state);
        return state;
    }
}

function seedInitialWisps(state, random) {
    const positions = [490, 930, 1340, 1950, 2250, 2860, 3270, 3710];
    for (const x of positions) {
        addWisp(state, x + (random() - 0.5) * 45, 3, random());
    }
}

function nextId(state, prefix) {
    const id = `${prefix}-${state.nextId}`;
    state.nextId += 1;
    return id;
}

function addWisp(state, x, value, phase = 0) {
    state.wisps.push({
        id: nextId(state, "wisp"),
        x: clamp(x, 70, CONFIG.worldWidth - 70),
        value,
        phase: phase * Math.PI * 2,
    });
}

function updateNotice(state, dt) {
    if (state.notice.ttl > 0) {
        state.notice.ttl = Math.max(0, state.notice.ttl - dt);
    } else {
        state.notice.text = "";
    }
}

function setNotice(state, text, ttl = 2.8) {
    state.notice = { text, ttl };
}

function updatePlayer(state, input, dt) {
    const player = state.player;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.reformTimer > 0) {
        updateReformingPlayer(state, dt);
    } else {
        const atHeart = Math.abs(player.x - state.heart.x) <= CONFIG.interactionRange;
        const threatened = state.humans.some((human) => human.hp > 0 && Math.abs(human.x - state.heart.x) <= CONFIG.interactionRange * 2);
        player.veil = player.veil > 0 && atHeart && !threatened
            ? Math.min(player.maxVeil, player.veil + CONFIG.heartVeilRecovery * dt)
            : player.veil;
        player.vx = input.stop ? 0 : player.vx;
        const becameExhausted = updateRidingPlayer(player, input, dt, CONFIG.worldWidth);
        if (becameExhausted) {
            setNotice(state, "Your steed slows to recover stamina.", 3);
        } else {
            return;
        }
    }
}

function updateReformingPlayer(state, dt) {
    const player = state.player;
    player.reformTimer = Math.max(0, player.reformTimer - dt);
    player.vx = 0;
    if (player.reformTimer === 0) {
        player.x = state.heart.x;
        player.veil = player.maxVeil;
        player.stamina = player.maxStamina;
        player.exhausted = false;
        player.gaitPhase = 0;
        player.invulnerable = 2.5;
        state.events.push({ type: "reform", x: player.x });
        setNotice(state, "Veil restored at the Heart", 3.2);
    } else {
        player.x = state.heart.x;
    }
}

function collectWisps(state) {
    const remaining = [];
    for (const wisp of state.wisps) {
        const collected = state.player.reformTimer === 0 && Math.abs(wisp.x - state.player.x) < 68;
        if (collected) {
            state.dread += wisp.value;
            state.events.push({ type: "collect", x: wisp.x, value: wisp.value });
        } else {
            remaining.push(wisp);
        }
    }
    state.wisps = remaining;
}

function performInteraction(state, interaction) {
    switch (interaction.action) {
        case "awaken":
        case "upgrade":
            buySiteLevel(state, interaction);
            break;
        case "recruit-acolyte":
        case "build-structure":
        case "upgrade-structure":
            performExpansionInteraction(state, interaction);
            break;
        case "finale":
            completeFinalRitual(state);
            break;
        case "blocked":
        case "maxed":
            setNotice(state, interaction.detail, 3.2);
            break;
        default:
            throw new Error(`Unknown ritual action '${interaction.action}' while processing player interaction.`);
    }
}

function buySiteLevel(state, interaction) {
    const site = state.sites.find((candidate) => candidate.id === interaction.targetId);
    if (site === undefined) {
        throw new Error(`Ritual site '${interaction.targetId}' was expected while buying a site level, but it does not exist.`);
    } else {
        site.level += 1;
        site.maxHp = CONFIG.siteHealth[site.level];
        site.hp = site.maxHp;
        site.spawnTimer = 1.1;
        state.events.push({ type: "awaken", x: site.x, level: site.level });
        setNotice(state, site.level === 1 ? "Brood awakened" : `Brood upgraded to level ${site.level}`, 2.4);
    }
}

function completeFinalRitual(state) {
    state.ritualStarted = true;
    state.siegeReserveTimer = CONFIG.finalReserveDelay;
    state.events.push({ type: "finale", x: state.heart.x });
    spawnSiegeGroup(state, ["soldier", "archer", "soldier"]);
    setNotice(state, "Siege begins", 3);
}

function describeSiteInteraction(state, site) {
    if (site.level === 0) {
        return makeInteraction(state, site, "awaken", "AWAKEN BROOD", CONFIG.siteCosts[0], "Plant an eldritch Brood that periodically summons crawlers.");
    } else {
        if (site.level < 3) {
            const cost = CONFIG.siteCosts[site.level];
            return makeInteraction(state, site, "upgrade", `UPGRADE BROOD TO LEVEL ${site.level + 1}`, cost, "Higher levels gain health and summon horrors more quickly.");
        } else {
            return {
                kind: "site",
                targetId: site.id,
                action: "maxed",
                label: "BROOD FULLY AWAKENED",
                detail: "This Brood is fully awakened and cannot be deepened further.",
                cost: 0,
                affordable: true,
            };
        }
    }
}

function makeInteraction(state, site, action, label, cost, detail) {
    return {
        kind: "site",
        targetId: site.id,
        action,
        label,
        detail,
        cost,
        affordable: state.dread >= cost,
    };
}

function describeHeartInteraction(state) {
    const dormant = state.sites.length - activeSiteCount(state);
    if (state.ritualStarted || dormant > 0) {
        return {
            kind: "heart",
            targetId: state.heart.id,
            action: "blocked",
            label: state.ritualStarted ? "RITUAL IN PROGRESS" : `${dormant} BROOD${dormant === 1 ? "" : "S"} STILL DORMANT`,
            detail: state.ritualStarted
                ? "Defeat the remaining crusaders to complete the ritual."
                : "Awaken every buried Brood, then return to the Heart.",
            cost: 0,
            affordable: false,
        };
    } else {
        return {
            kind: "heart",
            targetId: state.heart.id,
            action: "finale",
            label: "START FINAL SIEGE",
            detail: "Spend Dread to begin the ritual. Prepare for attacks from both sides and a second wave seven seconds later.",
            cost: CONFIG.finalRitualCost,
            affordable: state.dread >= CONFIG.finalRitualCost,
        };
    }
}

function updateSites(state, dt) {
    for (const site of state.sites) {
        if (site.level > 0) {
            site.spawnTimer = Math.max(0, site.spawnTimer - dt);
            const living = state.horrors.filter((horror) => horror.sourceId === site.id && horror.hp > 0).length;
            if (site.spawnTimer === 0 && living < CONFIG.siteHorrorLimits[site.level]) {
                spawnHorror(state, site);
                site.spawnCount += 1;
                site.spawnTimer = CONFIG.siteSpawnIntervals[site.level];
            } else {
                continue;
            }
        } else {
            site.spawnTimer = 0;
        }
    }
}

function spawnHorror(state, site) {
    const summonsBrute = site.level === 3 && site.spawnCount % 3 === 2;
    const type = summonsBrute ? "brute" : "crawler";
    const stats = HORROR_STATS[type];
    const side = site.spawnCount % 2 === 0 ? -1 : 1;
    state.horrors.push({
        id: nextId(state, type),
        type,
        sourceId: site.id,
        x: site.x + side * 28,
        vx: 0,
        facing: side,
        hp: stats.health,
        maxHp: stats.health,
        attackCooldown: 0,
        hitFlash: 0,
    });
    state.events.push({ type: "spawn-horror", x: site.x, creature: type });
}

function updateHorrors(state, dt) {
    for (const horror of state.horrors) {
        horror.attackCooldown = Math.max(0, horror.attackCooldown - dt);
        horror.hitFlash = Math.max(0, horror.hitFlash - dt);
        const target = closestLiving(state.humans, horror.x, 920);
        if (target === null) {
            patrolHorror(state, horror, dt);
        } else {
            huntHuman(state, horror, target, dt);
        }
    }
}

function patrolHorror(state, horror, dt) {
    const site = state.sites.find((candidate) => candidate.id === horror.sourceId);
    const home = site?.x ?? state.heart.x;
    const offset = Math.sin(state.time * 0.35 + numericId(horror.id)) * 105;
    const destination = home + offset;
    if (Math.abs(destination - horror.x) > 12) {
        moveToward(horror, destination, HORROR_STATS[horror.type].speed * 0.38, dt);
    } else {
        horror.vx = 0;
    }
}

function huntHuman(state, horror, human, dt) {
    const stats = HORROR_STATS[horror.type];
    const distance = Math.abs(human.x - horror.x);
    if (distance > stats.range) {
        moveToward(horror, human.x, stats.speed, dt);
    } else {
        horror.vx = 0;
        if (horror.attackCooldown === 0) {
            human.hp -= stats.damage;
            human.hitFlash = 0.16;
            horror.attackCooldown = stats.cooldown;
            state.events.push({ type: "horror-strike", x: human.x, fromX: horror.x, actorId: horror.id, creature: horror.type });
        } else {
            horror.facing = Math.sign(human.x - horror.x) || horror.facing;
        }
    }
}

function updateHumans(state, dt) {
    for (const human of state.humans.filter((candidate) => candidate.hp > 0)) {
        human.attackCooldown = Math.max(0, human.attackCooldown - dt);
        human.hitFlash = Math.max(0, human.hitFlash - dt);
        const target = chooseHumanTarget(state, human);
        const stats = HUMAN_STATS[human.type];
        const distance = Math.abs(target.x - human.x);
        if (distance > stats.range) {
            moveToward(human, target.x, stats.speed, dt);
        } else {
            human.vx = 0;
            human.facing = Math.sign(target.x - human.x) || human.facing;
            if (human.attackCooldown === 0) {
                damageHumanTarget(state, human, target, stats);
                human.attackCooldown = stats.cooldown;
            } else {
                human.attackCooldown = Math.max(0, human.attackCooldown);
            }
        }
    }
}

function chooseHumanTarget(state, human) {
    const horror = closestLiving(state.horrors, human.x, 285);
    const acolyte = closestLiving(state.acolytes, human.x, 220);
    const playerClose = state.player.reformTimer === 0 && Math.abs(state.player.x - human.x) <= 190;
    const nearbyTarget = horror !== null
        ? { kind: "horror", object: horror, x: horror.x }
        : acolyte !== null
            ? { kind: "acolyte", object: acolyte, x: acolyte.x }
            : playerClose
                ? { kind: "player", object: state.player, x: state.player.x }
                : null;
    if (nearbyTarget !== null) {
        const direction = Math.sign(nearbyTarget.x - human.x);
        const distance = Math.abs(nearbyTarget.x - human.x);
        const walls = state.structures.filter((structure) => {
            const ahead = (structure.x - human.x) * direction;
            return structure.type === "barricade" && structure.level > 0 && ahead >= 0 && ahead < distance;
        });
        const wall = closestLiving(walls, human.x, distance);
        return wall === null ? nearbyTarget : { kind: "structure", object: wall, x: wall.x };
    } else {
        const structures = state.sites
            .filter((site) => site.level > 0)
            .map((site) => ({ kind: "site", object: site, x: site.x }));
        const fixedStructures = state.structures
            .filter((structure) => structure.level > 0)
            .map((structure) => ({ kind: "structure", object: structure, x: structure.x }));
        structures.push(...fixedStructures, { kind: "heart", object: state.heart, x: state.heart.x });
        return nearestTarget(structures, human.x);
    }
}

function nearestTarget(targets, originX) {
    return targets.reduce((nearest, target) => {
        const nearestDistance = Math.abs(nearest.x - originX);
        const targetDistance = Math.abs(target.x - originX);
        return targetDistance < nearestDistance ? target : nearest;
    });
}

function damageHumanTarget(state, human, target, stats) {
    const damagesStructure = target.kind === "site" || target.kind === "heart" || target.kind === "structure";
    const structureBonus = human.type === "torchbearer" && damagesStructure ? 1.45 : 1;
    switch (target.kind) {
        case "player":
            damagePlayer(state, human, stats.damage);
            break;
        case "horror":
        case "acolyte":
            target.object.hp -= stats.damage;
            target.object.hitFlash = 0.16;
            state.events.push({ type: human.type === "archer" ? "arrow" : "human-strike", x: target.x, fromX: human.x, actorId: human.id });
            break;
        case "structure":
            target.object.hp -= stats.damage * structureBonus;
            target.object.hitFlash = 0.16;
            state.events.push({ type: human.type === "archer" ? "arrow" : "torch-strike", x: target.x, fromX: human.x, actorId: human.id });
            break;
        case "site":
        case "heart":
            target.object.hp -= stats.damage * structureBonus;
            state.events.push({ type: human.type === "archer" ? "arrow" : "torch-strike", x: target.x, fromX: human.x, actorId: human.id });
            break;
        default:
            throw new Error(`Unknown human target kind '${target.kind}' while applying attack damage.`);
    }
}

function damagePlayer(state, human, damage) {
    const player = state.player;
    if (player.invulnerable === 0) {
        player.veil -= damage;
        player.invulnerable = 0.32;
        state.events.push({ type: human.type === "archer" ? "arrow" : "player-hit", x: player.x, fromX: human.x, actorId: human.id });
    } else {
        state.events.push({ type: "veil-deflect", x: player.x });
    }
}

function resolveDefeatedEntities(state, random) {
    const livingHumans = [];
    for (const human of state.humans) {
        if (human.hp <= 0) {
            const value = human.type === "torchbearer" ? 3 : 2;
            addHumanCorpse(state, human.x, value, random());
            state.events.push({ type: "human-fall", x: human.x, human: human.type });
        } else {
            livingHumans.push(human);
        }
    }
    state.humans = livingHumans;
    const livingHorrors = [];
    for (const horror of state.horrors) {
        if (horror.hp <= 0) {
            state.events.push({ type: "horror-fall", x: horror.x, creature: horror.type });
        } else {
            livingHorrors.push(horror);
        }
    }
    state.horrors = livingHorrors;
    beginReformWhenNeeded(state, random);
}

function beginReformWhenNeeded(state, random) {
    const player = state.player;
    if (player.veil <= 0 && player.reformTimer === 0) {
        returnCoins(state);
        const lostDread = Math.min(state.dread, Math.max(2, Math.floor(state.dread * 0.25)));
        state.dread -= lostDread;
        for (let index = 0; index < lostDread; index += 1) {
            addWisp(state, player.x + (random() - 0.5) * 95, 1, random());
        }
        player.veil = 0;
        player.reformTimer = 3.4;
        state.events.push({ type: "dissolve", x: player.x, value: lostDread });
        setNotice(state, `Veil broken · ${lostDread} Dread dropped`, 3.4);
    } else {
        player.veil = Math.max(0, player.veil);
    }
}

function updateStructures(state, dt) {
    for (const site of state.sites) {
        if (site.level > 0 && site.hp <= 0) {
            collapseSite(state, site);
        } else {
            healSafeSite(state, site, dt);
        }
    }
    const enemiesNearHeart = state.humans.some((human) => Math.abs(human.x - state.heart.x) < 430);
    if (state.heart.hp <= 0) {
        state.heart.hp = 0;
    } else {
        if (enemiesNearHeart) {
            state.heart.hp = Math.min(state.heart.maxHp, Math.max(0, state.heart.hp));
        } else {
            state.heart.hp = Math.min(state.heart.maxHp, state.heart.hp + dt * 1.1);
        }
    }
}

function collapseSite(state, site) {
    site.level = 0;
    site.hp = 0;
    site.maxHp = 0;
    site.spawnTimer = 0;
    state.events.push({ type: "site-collapse", x: site.x });
    setNotice(state, "Brood destroyed", 3.4);
}

function healSafeSite(state, site, dt) {
    const threatened = state.humans.some((human) => Math.abs(human.x - site.x) < 340);
    if (site.level > 0 && !threatened) {
        site.hp = Math.min(site.maxHp, site.hp + dt * 0.7);
    } else {
        site.hp = Math.max(0, site.hp);
    }
}

function updateNaturalWisps(state, dt, random) {
    state.wispTimer -= dt;
    if (state.wispTimer <= 0) {
        if (state.wisps.length < CONFIG.wispLimit) {
            const groveIndex = Math.floor(random() * CONFIG.grovePositions.length);
            const groveX = CONFIG.grovePositions[groveIndex];
            addWisp(state, groveX + (random() - 0.5) * 125, 2, random());
        } else {
            state.wisps = state.wisps.slice(0, CONFIG.wispLimit);
        }
        state.wispTimer = 3.5 + random() * 2;
    } else {
        state.wispTimer = Math.max(Number.EPSILON, state.wispTimer);
    }
}

function updateAssaults(state, dt) {
    if (state.ritualStarted) {
        state.waveWarning = false;
        updateSiegeReserve(state, dt);
    } else {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) {
            spawnHumanWave(state);
            state.waveTimer = Math.max(14, 19 - state.wave * 1.25);
            state.waveWarning = false;
        } else if (state.waveTimer <= 5 && !state.waveWarning) {
            state.waveWarning = true;
            state.events.push({ type: "wave-warning", x: state.heart.x });
        } else {
            return;
        }
    }
}

function spawnHumanWave(state) {
    state.wave += 1;
    const sides = assaultSides(state.wave);
    const count = Math.min(6, 3 + Math.floor(state.wave / 2));
    const types = Array.from({ length: count }, (_, index) => humanTypeForWave(state.wave, index));
    for (const side of sides) {
        const entry = side < 0 ? CONFIG.waveEntryMargin : CONFIG.worldWidth - CONFIG.waveEntryMargin;
        spawnRaid(state, side, entry, types);
    }
    state.events.push({ type: "wave", x: state.heart.x, wave: state.wave });
    setNotice(state, `Raid ${state.wave} · ${assaultDirection(state.wave)}`, 3);
}

function updateSiegeReserve(state, dt) {
    if (state.siegeReserveTimer === null) {
        return;
    } else {
        state.siegeReserveTimer = Math.max(0, state.siegeReserveTimer - dt);
        if (state.siegeReserveTimer === 0) {
            state.siegeReserveTimer = null;
            spawnSiegeGroup(state, ["torchbearer", "soldier", "torchbearer"]);
            state.events.push({ type: "siege-reserve", x: state.heart.x });
            setNotice(state, "Reinforcements arriving", 3);
        } else {
            return;
        }
    }
}

function spawnSiegeGroup(state, types) {
    for (const side of [-1, 1]) {
        const entry = state.heart.x + side * CONFIG.finalAssaultDistance;
        spawnRaid(state, side, entry, types);
    }
}

function spawnRaid(state, side, entry, types) {
    for (const [index, type] of types.entries()) {
        spawnHuman(state, type, entry + side * index * 48, -side);
    }
}

function humanTypeForWave(wave, index) {
    if (wave >= 2 && index % 4 === 2) {
        return "torchbearer";
    } else {
        if (index % 4 === 1) {
            return "archer";
        } else {
            return "soldier";
        }
    }
}

function spawnHuman(state, type, x, facing) {
    const stats = HUMAN_STATS[type];
    state.humans.push({
        id: nextId(state, type),
        type,
        x: clamp(x, 38, CONFIG.worldWidth - 38),
        vx: 0,
        facing,
        hp: stats.health,
        maxHp: stats.health,
        attackCooldown: 0.25,
        hitFlash: 0,
    });
}

function resolveEndState(state) {
    if (state.heart.hp <= 0) {
        state.heart.hp = 0;
        state.status = "defeat";
        state.events.push({ type: "defeat", x: state.heart.x });
    } else {
        if (state.ritualStarted && state.siegeReserveTimer === null && state.humans.length === 0) {
            state.status = "victory";
            state.events.push({ type: "victory", x: state.heart.x });
        } else {
            state.status = "playing";
        }
    }
}

function closestLiving(entities, originX, maximumDistance) {
    const living = entities.filter((entity) => entity.hp > 0);
    if (living.length === 0) {
        return null;
    } else {
        const nearest = living.reduce((best, entity) => {
            const bestDistance = Math.abs(best.x - originX);
            const entityDistance = Math.abs(entity.x - originX);
            return entityDistance < bestDistance ? entity : best;
        });
        return Math.abs(nearest.x - originX) <= maximumDistance ? nearest : null;
    }
}

function moveToward(entity, destination, speed, dt) {
    const difference = destination - entity.x;
    const direction = Math.sign(difference);
    entity.facing = direction === 0 ? entity.facing : direction;
    entity.vx = direction * speed;
    entity.x = clamp(entity.x + entity.vx * dt, 34, CONFIG.worldWidth - 34);
}

function numericId(id) {
    const match = /([0-9]+)$/.exec(id);
    return match === null ? 0 : Number(match[1]);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
