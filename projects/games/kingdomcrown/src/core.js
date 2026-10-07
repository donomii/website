import { addHumanCorpse, createExpansionState, getExpansionInteraction, performExpansionInteraction, resolveExpansionCasualties, updateExpansion } from "./expansion.js";
import { MOVEMENT_CONFIG, updateRidingPlayer } from "./movement.js";

export const CONFIG = Object.freeze({
    worldWidth: 6200,
    playerStartX: 3100,
    playerMaxVeil: 100,
    playerMaxStamina: 100,
    ...MOVEMENT_CONFIG,
    playerAttackRadius: 145,
    playerAttackDamage: 42,
    playerAttackCooldown: 1.15,
    heartMaxHealth: 320,
    interactionRange: 112,
    finalRitualCost: 30,
    sitePositions: Object.freeze([940, 2180, 4020, 5260]),
    grovePositions: Object.freeze([430, 720, 1420, 1840, 2700, 3500, 4480, 4880, 5600, 5900]),
    siteCosts: Object.freeze([8, 14, 22]),
    siteHealth: Object.freeze([0, 105, 165, 245]),
    siteSpawnIntervals: Object.freeze([0, 8.2, 6.2, 4.6]),
    firstWaveDelay: 28,
    wispLimit: 18,
});

const HUMAN_STATS = Object.freeze({
    soldier: Object.freeze({ health: 62, speed: 68, damage: 13, range: 34, cooldown: 1.05 }),
    archer: Object.freeze({ health: 44, speed: 54, damage: 10, range: 245, cooldown: 1.7 }),
    torchbearer: Object.freeze({ health: 78, speed: 48, damage: 22, range: 40, cooldown: 1.35 }),
});

const HORROR_STATS = Object.freeze({
    crawler: Object.freeze({ health: 54, speed: 82, damage: 15, range: 31, cooldown: 0.9 }),
    brute: Object.freeze({ health: 135, speed: 44, damage: 30, range: 45, cooldown: 1.45 }),
});

const NO_INPUT = Object.freeze({
    left: false,
    right: false,
    gallop: false,
    attackPressed: false,
    interactPressed: false,
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
        wispTimer: 5,
        ritualComplete: false,
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
            attackCooldown: 0,
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
        notice: { text: "Gather Dread. Awaken the buried broods.", ttl: 6 },
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

export function getInteraction(state) {
    const player = state.player;
    if (player.reformTimer > 0) {
        return null;
    } else {
        const siteCandidates = state.sites
            .map((site) => ({ ...describeSiteInteraction(state, site), distance: Math.abs(site.x - player.x) }))
            .filter((candidate) => candidate.distance <= CONFIG.interactionRange);
        const heartDistance = Math.abs(state.heart.x - player.x);
        const heartCandidate = heartDistance <= CONFIG.interactionRange + 20 ? { ...describeHeartInteraction(state), distance: heartDistance } : null;
        const expansionCandidate = getExpansionInteraction(state);
        const candidates = [...siteCandidates, heartCandidate, expansionCandidate]
            .filter((candidate) => candidate !== null)
            .sort((left, right) => left.distance - right.distance);
        return candidates[0] ?? null;
    }
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
        updatePlayer(state, input, dt);
        collectWisps(state);
        processAttack(state, input);
        processInteraction(state, input);
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
    const positions = [520, 760, 1510, 2760, 3440, 4550, 5500, 5820];
    for (const x of positions) {
        addWisp(state, x + (random() - 0.5) * 45, 2, random());
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
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.reformTimer > 0) {
        updateReformingPlayer(state, dt);
    } else {
        const becameExhausted = updateRidingPlayer(player, input, dt, CONFIG.worldWidth);
        if (becameExhausted) {
            setNotice(state, `Your steed tires. Release Gallop and recover ${CONFIG.playerGallopRecovery} Steed to sprint again.`, 4);
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
        setNotice(state, "The Heart weaves your Veil anew.", 3.2);
    } else {
        player.x = state.heart.x;
    }
}

function collectWisps(state) {
    const remaining = [];
    for (const wisp of state.wisps) {
        const collected = state.player.reformTimer === 0 && Math.abs(wisp.x - state.player.x) < 54;
        if (collected) {
            state.dread += wisp.value;
            state.events.push({ type: "collect", x: wisp.x, value: wisp.value });
        } else {
            remaining.push(wisp);
        }
    }
    state.wisps = remaining;
}

function processAttack(state, input) {
    const player = state.player;
    const canAttack = input.attackPressed && player.reformTimer === 0 && player.attackCooldown === 0;
    if (canAttack) {
        player.attackCooldown = CONFIG.playerAttackCooldown;
        state.events.push({ type: "tendril", x: player.x, facing: player.facing });
        for (const human of state.humans) {
            const distance = Math.abs(human.x - player.x);
            const damage = distance <= CONFIG.playerAttackRadius ? CONFIG.playerAttackDamage : 0;
            human.hp -= damage;
            human.hitFlash = damage > 0 ? 0.16 : human.hitFlash;
        }
    } else {
        player.attackCooldown = Math.max(0, player.attackCooldown);
    }
}

function processInteraction(state, input) {
    if (!input.interactPressed) {
        return;
    } else {
        const interaction = getInteraction(state);
        if (interaction === null) {
            setNotice(state, "No buried thing answers here.", 2.2);
        } else {
            performInteraction(state, interaction);
        }
    }
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
            completeFinalRitual(state, interaction);
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
    if (state.dread >= interaction.cost) {
        const site = state.sites.find((candidate) => candidate.id === interaction.targetId);
        if (site === undefined) {
            throw new Error(`Ritual site '${interaction.targetId}' was expected while buying a site level, but it does not exist.`);
        } else {
            state.dread -= interaction.cost;
            site.level += 1;
            site.maxHp = CONFIG.siteHealth[site.level];
            site.hp = site.maxHp;
            site.spawnTimer = 1.1;
            state.events.push({ type: "awaken", x: site.x, level: site.level });
            setNotice(state, site.level === 1 ? "A Brood stirs beneath the soil." : `The Brood deepens to level ${site.level}.`, 3.2);
        }
    } else {
        const missing = interaction.cost - state.dread;
        setNotice(state, `The rite needs ${missing} more Dread.`, 2.8);
    }
}

function completeFinalRitual(state, interaction) {
    const allActive = activeSiteCount(state) === state.sites.length;
    if (allActive && state.dread >= interaction.cost) {
        state.dread -= interaction.cost;
        state.ritualComplete = true;
        state.events.push({ type: "finale", x: state.heart.x });
    } else {
        const detail = allActive ? `The Sleeper needs ${interaction.cost - state.dread} more Dread.` : "Every Brood must be awake at once.";
        setNotice(state, detail, 3.2);
    }
}

function describeSiteInteraction(state, site) {
    if (site.level === 0) {
        return makeInteraction(state, site, "awaken", "AWAKEN BROOD", CONFIG.siteCosts[0], "Plant an eldritch Brood that periodically summons crawlers.");
    } else {
        if (site.level < 3) {
            const cost = CONFIG.siteCosts[site.level];
            return makeInteraction(state, site, "upgrade", `DEEPEN TO LEVEL ${site.level + 1}`, cost, "Higher levels gain health and summon horrors more quickly.");
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
    if (dormant > 0) {
        return {
            kind: "heart",
            targetId: state.heart.id,
            action: "blocked",
            label: `${dormant} BROOD${dormant === 1 ? "" : "S"} STILL DORMANT`,
            detail: "Awaken every buried Brood, then return to the Heart.",
            cost: 0,
            affordable: false,
        };
    } else {
        return {
            kind: "heart",
            targetId: state.heart.id,
            action: "finale",
            label: "CALL THE SLEEPER BELOW",
            detail: "Spend Dread at the Heart to complete the final ritual.",
            cost: CONFIG.finalRitualCost,
            affordable: state.dread >= CONFIG.finalRitualCost,
        };
    }
}

function updateSites(state, dt) {
    for (const site of state.sites) {
        if (site.level > 0) {
            site.spawnTimer -= dt;
            if (site.spawnTimer <= 0) {
                spawnHorror(state, site);
                site.spawnCount += 1;
                site.spawnTimer += CONFIG.siteSpawnIntervals[site.level];
            } else {
                site.spawnTimer = Math.max(Number.EPSILON, site.spawnTimer);
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
            state.events.push({ type: "horror-strike", x: human.x, creature: horror.type });
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
    const barricade = closestLiving(state.structures.filter((structure) => structure.type === "barricade" && structure.level > 0), human.x, 150);
    const acolyte = closestLiving(state.acolytes, human.x, 220);
    const playerClose = state.player.reformTimer === 0 && Math.abs(state.player.x - human.x) <= 190;
    const nearbyTarget = horror !== null
        ? { kind: "horror", object: horror, x: horror.x }
        : barricade !== null
            ? { kind: "structure", object: barricade, x: barricade.x }
            : acolyte !== null
                ? { kind: "acolyte", object: acolyte, x: acolyte.x }
                : playerClose
                    ? { kind: "player", object: state.player, x: state.player.x }
                    : null;
    if (nearbyTarget !== null) {
        return nearbyTarget;
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
            state.events.push({ type: human.type === "archer" ? "arrow" : "human-strike", x: target.x, fromX: human.x });
            break;
        case "structure":
            target.object.hp -= stats.damage * structureBonus;
            target.object.hitFlash = 0.16;
            state.events.push({ type: human.type === "archer" ? "arrow" : "torch-strike", x: target.x, fromX: human.x });
            break;
        case "site":
        case "heart":
            target.object.hp -= stats.damage * structureBonus;
            state.events.push({ type: human.type === "archer" ? "arrow" : "torch-strike", x: target.x, fromX: human.x });
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
        state.events.push({ type: human.type === "archer" ? "arrow" : "player-hit", x: player.x, fromX: human.x });
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
        const lostDread = Math.min(state.dread, Math.max(2, Math.floor(state.dread * 0.25)));
        state.dread -= lostDread;
        for (let index = 0; index < lostDread; index += 1) {
            addWisp(state, player.x + (random() - 0.5) * 95, 1, random());
        }
        player.veil = 0;
        player.reformTimer = 3.4;
        state.events.push({ type: "dissolve", x: player.x, value: lostDread });
        setNotice(state, `Your Veil ruptures. ${lostDread} Dread spills free.`, 3.4);
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
    setNotice(state, "The crusade has silenced a Brood.", 3.4);
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
        state.wispTimer = 4.5 + random() * 3.5;
    } else {
        state.wispTimer = Math.max(Number.EPSILON, state.wispTimer);
    }
}

function updateAssaults(state, dt) {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
        spawnHumanWave(state);
        state.waveTimer = Math.max(24, 39 - state.wave * 1.4);
        state.waveWarning = false;
    } else {
        if (state.waveTimer <= 5 && !state.waveWarning) {
            state.waveWarning = true;
            state.events.push({ type: "wave-warning", x: state.heart.x });
            setNotice(state, "TORCHES AT BOTH HORIZONS", 4.5);
        } else {
            return;
        }
    }
}

function spawnHumanWave(state) {
    state.wave += 1;
    const countPerSide = Math.min(7, 2 + Math.floor(state.wave * 0.8));
    for (const side of [-1, 1]) {
        for (let index = 0; index < countPerSide; index += 1) {
            const type = humanTypeForWave(state.wave, index);
            const edge = side < 0 ? 75 : CONFIG.worldWidth - 75;
            const inwardSpacing = side < 0 ? index * 22 : index * -22;
            spawnHuman(state, type, edge + inwardSpacing, -side);
        }
    }
    state.events.push({ type: "wave", x: state.heart.x, wave: state.wave });
    setNotice(state, `HUMAN ASSAULT ${state.wave} — ${countPerSide * 2} CRUSADERS`, 4.2);
}

function humanTypeForWave(wave, index) {
    if (wave >= 3 && index % 5 === 4) {
        return "torchbearer";
    } else {
        if (wave >= 2 && index % 4 === 3) {
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
        if (state.ritualComplete) {
            state.status = "victory";
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
