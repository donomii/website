export const EXPANSION_CONFIG = Object.freeze({
    worldWidth: 6200,
    interactionRange: 112,
    recruitCost: 3,
    campRefreshTime: 22,
    acolyteHealth: 45,
    acolyteSpeed: 78,
    corpseDecayTime: 7,
    campPositions: Object.freeze([420, 2350, 3850, 5820]),
    structures: Object.freeze([
        Object.freeze({ id: "spire-1", type: "spire", x: 720 }),
        Object.freeze({ id: "charnel-1", type: "charnel", x: 1160 }),
        Object.freeze({ id: "pasture-1", type: "pasture", x: 1480 }),
        Object.freeze({ id: "barricade-1", type: "barricade", x: 1860 }),
        Object.freeze({ id: "spire-2", type: "spire", x: 2640 }),
        Object.freeze({ id: "spire-3", type: "spire", x: 3560 }),
        Object.freeze({ id: "barricade-2", type: "barricade", x: 4340 }),
        Object.freeze({ id: "pasture-2", type: "pasture", x: 4720 }),
        Object.freeze({ id: "charnel-2", type: "charnel", x: 5040 }),
        Object.freeze({ id: "spire-4", type: "spire", x: 5480 }),
    ]),
    types: Object.freeze({
        pasture: Object.freeze({
            name: "Nightmare Pasture",
            role: "Reaper",
            detail: "A Reaper grows collectible Dread at this Pasture.",
            costs: Object.freeze([10, 18, 28]),
            health: Object.freeze([0, 100, 165, 245]),
            intervals: Object.freeze([0, 12, 8, 5.5]),
            yields: Object.freeze([0, 2, 3, 4]),
        }),
        spire: Object.freeze({
            name: "Watcher Spire",
            role: "Seer",
            detail: "A Seer fires an eldritch gaze at humans in range.",
            costs: Object.freeze([8, 15, 24]),
            health: Object.freeze([0, 80, 130, 195]),
            ranges: Object.freeze([0, 320, 420, 540]),
            damage: Object.freeze([0, 20, 30, 44]),
            cooldowns: Object.freeze([0, 1.6, 1.15, 0.85]),
        }),
        barricade: Object.freeze({
            name: "Rib Barricade",
            role: "Stitcher",
            detail: "A Stitcher repairs this barricade while it blocks humans.",
            costs: Object.freeze([7, 13, 20]),
            health: Object.freeze([0, 180, 290, 430]),
            repairs: Object.freeze([0, 1, 2.4, 4.5]),
        }),
        charnel: Object.freeze({
            name: "Charnel Yard",
            role: "Bonepicker",
            detail: "A Bonepicker turns nearby human remains into extra Dread.",
            costs: Object.freeze([9, 16, 25]),
            health: Object.freeze([0, 105, 170, 255]),
            ranges: Object.freeze([0, 520, 720, 920]),
            bonuses: Object.freeze([0, 1, 2, 3]),
        }),
    }),
});

export function createExpansionState() {
    return {
        camps: EXPANSION_CONFIG.campPositions.map((x, index) => ({
            id: `camp-${index + 1}`,
            x,
            available: true,
            refreshTimer: 0,
        })),
        structures: EXPANSION_CONFIG.structures.map((blueprint) => ({
            id: blueprint.id,
            type: blueprint.type,
            x: blueprint.x,
            level: 0,
            hp: 0,
            maxHp: 0,
            workerId: null,
            productionTimer: 0,
            attackCooldown: 0,
            hitFlash: 0,
        })),
        acolytes: [],
        corpses: [],
    };
}

export function getExpansionInteraction(state) {
    if (state.player.reformTimer > 0) {
        return null;
    } else {
        const campInteractions = state.camps.map((camp) => describeCampInteraction(state, camp));
        const structureInteractions = state.structures.map((structure) => describeStructureInteraction(state, structure));
        const candidates = [...campInteractions, ...structureInteractions]
            .filter((interaction) => interaction.distance <= EXPANSION_CONFIG.interactionRange)
            .sort((left, right) => left.distance - right.distance);
        return candidates[0] ?? null;
    }
}

export function performExpansionInteraction(state, interaction) {
    switch (interaction.action) {
        case "recruit-acolyte":
            recruitAcolyte(state, interaction);
            break;
        case "build-structure":
        case "upgrade-structure":
            buyStructureLevel(state, interaction);
            break;
        default:
            throw new Error(`Unknown expansion action '${interaction.action}' while processing a player interaction.`);
    }
}

export function updateExpansion(state, dt, random = Math.random) {
    updateCamps(state, dt);
    validateAssignments(state);
    assignAvailableAcolytes(state);
    updateAcolytes(state, dt);
    updateFixedStructures(state, dt, random);
    updateCorpses(state, dt, random);
}

export function addHumanCorpse(state, x, value, phase = 0) {
    state.corpses.push({
        id: nextId(state, "corpse"),
        x: clamp(x, 40, EXPANSION_CONFIG.worldWidth - 40),
        value,
        decayTimer: EXPANSION_CONFIG.corpseDecayTime,
        phase: phase * Math.PI * 2,
    });
}

export function resolveExpansionCasualties(state) {
    const livingAcolytes = [];
    for (const acolyte of state.acolytes) {
        if (acolyte.hp <= 0) {
            vacateWorkerJob(state, acolyte);
            state.events.push({ type: "acolyte-fall", x: acolyte.x });
            setNotice(state, "A Marked Acolyte has been reclaimed by death.", 3.2);
        } else {
            livingAcolytes.push(acolyte);
        }
    }
    state.acolytes = livingAcolytes;
    for (const structure of state.structures) {
        if (structure.level > 0 && structure.hp <= 0) {
            collapseFixedStructure(state, structure);
        } else {
            structure.hp = Math.max(0, structure.hp);
        }
    }
    validateAssignments(state);
    assignAvailableAcolytes(state);
}

export function workforceCounts(state) {
    const living = state.acolytes.filter((acolyte) => acolyte.hp > 0);
    const staffed = living.filter((acolyte) => acolyte.assignmentId !== null).length;
    return { free: living.length - staffed, staffed };
}

export function structureWorkerReady(state, structure) {
    const worker = state.acolytes.find((acolyte) => acolyte.id === structure.workerId && acolyte.hp > 0);
    return worker !== undefined && Math.abs(worker.x - structure.x) <= 34;
}

function describeCampInteraction(state, camp) {
    const distance = Math.abs(camp.x - state.player.x);
    if (camp.available) {
        return {
            kind: "camp",
            targetId: camp.id,
            action: "recruit-acolyte",
            label: "MARK THE OUTCAST",
            detail: "Spend Dread to recruit an Acolyte who will take an available structure job.",
            cost: EXPANSION_CONFIG.recruitCost,
            affordable: state.dread >= EXPANSION_CONFIG.recruitCost,
            distance,
        };
    } else {
        return {
            kind: "camp",
            targetId: camp.id,
            action: "blocked",
            label: `OUTCASTS RETURN IN ${Math.ceil(camp.refreshTimer)}S`,
            detail: "This roadside fire is empty. Another outcast will arrive after its timer expires.",
            cost: 0,
            affordable: false,
            distance,
        };
    }
}

function describeStructureInteraction(state, structure) {
    const definition = structureDefinition(structure.type);
    const distance = Math.abs(structure.x - state.player.x);
    const staffing = structure.workerId === null ? " Its worker job is vacant." : " An Acolyte holds its worker job.";
    if (structure.level === 0) {
        return makeStructureInteraction(state, structure, "build-structure", `RAISE ${definition.name.toUpperCase()}`, definition.costs[0], definition.detail + staffing, distance);
    } else {
        if (structure.level < 3) {
            const cost = definition.costs[structure.level];
            return makeStructureInteraction(state, structure, "upgrade-structure", `GROW ${definition.name.toUpperCase()} TO ${structure.level + 1}`, cost, definition.detail + staffing, distance);
        } else {
            return {
                kind: "structure",
                targetId: structure.id,
                action: "maxed",
                label: `${definition.name.toUpperCase()} FULLY GROWN`,
                detail: `This ${definition.name} is at its maximum level.${staffing}`,
                cost: 0,
                affordable: true,
                distance,
            };
        }
    }
}

function makeStructureInteraction(state, structure, action, label, cost, detail, distance) {
    return {
        kind: "structure",
        targetId: structure.id,
        action,
        label,
        detail,
        cost,
        affordable: state.dread >= cost,
        distance,
    };
}

function recruitAcolyte(state, interaction) {
    const camp = state.camps.find((candidate) => candidate.id === interaction.targetId);
    if (camp === undefined) {
        throw new Error(`Outcast fire '${interaction.targetId}' was expected while recruiting an Acolyte, but it does not exist.`);
    } else {
        if (camp.available && state.dread >= interaction.cost) {
            state.dread -= interaction.cost;
            camp.available = false;
            camp.refreshTimer = EXPANSION_CONFIG.campRefreshTime;
            const index = state.acolytes.length;
            const acolyte = {
                id: nextId(state, "acolyte"),
                x: camp.x,
                vx: 0,
                facing: camp.x < state.heart.x ? 1 : -1,
                hp: EXPANSION_CONFIG.acolyteHealth,
                maxHp: EXPANSION_CONFIG.acolyteHealth,
                assignmentId: null,
                idleOffset: ((index % 7) - 3) * 24,
                hitFlash: 0,
            };
            state.acolytes.push(acolyte);
            assignAvailableAcolytes(state);
            state.events.push({ type: "mark-acolyte", x: camp.x });
            const destination = acolyte.assignmentId === null ? "walks toward the Heart" : "has answered a vacant job";
            setNotice(state, `An outcast bears the Mark and ${destination}.`, 3.4);
        } else {
            explainFailedRecruitment(state, camp, interaction.cost);
        }
    }
}

function explainFailedRecruitment(state, camp, cost) {
    if (!camp.available) {
        setNotice(state, `Another outcast arrives in ${Math.ceil(camp.refreshTimer)} seconds.`, 2.8);
    } else {
        setNotice(state, `The Mark needs ${cost - state.dread} more Dread.`, 2.8);
    }
}

function buyStructureLevel(state, interaction) {
    const structure = state.structures.find((candidate) => candidate.id === interaction.targetId);
    if (structure === undefined) {
        throw new Error(`Fixed structure '${interaction.targetId}' was expected while buying a level, but it does not exist.`);
    } else {
        if (state.dread >= interaction.cost) {
            raiseStructure(state, structure, interaction.cost);
        } else {
            setNotice(state, `This growth needs ${interaction.cost - state.dread} more Dread.`, 2.8);
        }
    }
}

function raiseStructure(state, structure, cost) {
    const definition = structureDefinition(structure.type);
    state.dread -= cost;
    structure.level += 1;
    structure.maxHp = definition.health[structure.level];
    structure.hp = structure.maxHp;
    structure.productionTimer = 1.2;
    structure.attackCooldown = 0.35;
    assignAvailableAcolytes(state);
    state.events.push({ type: "structure-rise", x: structure.x, structure: structure.type, level: structure.level });
    const staffing = structure.workerId === null ? " Its job remains vacant." : ` A ${definition.role} is on the way.`;
    setNotice(state, `${definition.name} reaches level ${structure.level}.${staffing}`, 3.4);
}

function updateCamps(state, dt) {
    for (const camp of state.camps) {
        if (camp.available) {
            camp.refreshTimer = 0;
        } else {
            camp.refreshTimer = Math.max(0, camp.refreshTimer - dt);
            if (camp.refreshTimer === 0) {
                camp.available = true;
                state.events.push({ type: "outcast-arrives", x: camp.x });
            } else {
                camp.available = false;
            }
        }
    }
}

function validateAssignments(state) {
    const livingIds = new Set(state.acolytes.filter((acolyte) => acolyte.hp > 0).map((acolyte) => acolyte.id));
    for (const structure of state.structures) {
        if (structure.workerId !== null && !livingIds.has(structure.workerId)) {
            structure.workerId = null;
        } else {
            structure.workerId = structure.workerId;
        }
    }
    for (const acolyte of state.acolytes) {
        if (acolyte.assignmentId === null) {
            acolyte.assignmentId = null;
        } else {
            const structure = state.structures.find((candidate) => candidate.id === acolyte.assignmentId);
            const valid = structure !== undefined && structure.level > 0 && structure.workerId === acolyte.id;
            acolyte.assignmentId = valid ? acolyte.assignmentId : null;
        }
    }
}

function assignAvailableAcolytes(state) {
    for (const structure of state.structures) {
        const needsWorker = structure.level > 0 && structure.workerId === null;
        if (needsWorker) {
            const candidates = state.acolytes
                .filter((acolyte) => acolyte.hp > 0 && acolyte.assignmentId === null)
                .sort((left, right) => Math.abs(left.x - structure.x) - Math.abs(right.x - structure.x));
            const worker = candidates[0] ?? null;
            if (worker === null) {
                structure.workerId = null;
            } else {
                structure.workerId = worker.id;
                worker.assignmentId = structure.id;
                state.events.push({ type: "job-filled", x: worker.x, structure: structure.type });
            }
        } else {
            structure.workerId = structure.workerId;
        }
    }
}

function updateAcolytes(state, dt) {
    for (const acolyte of state.acolytes) {
        acolyte.hitFlash = Math.max(0, acolyte.hitFlash - dt);
        if (acolyte.hp > 0) {
            const destination = acolyteDestination(state, acolyte);
            if (Math.abs(destination - acolyte.x) > 4) {
                moveToward(acolyte, destination, EXPANSION_CONFIG.acolyteSpeed, dt);
            } else {
                acolyte.vx = 0;
            }
        } else {
            acolyte.vx = 0;
        }
    }
}

function acolyteDestination(state, acolyte) {
    if (acolyte.assignmentId === null) {
        return state.heart.x + acolyte.idleOffset;
    } else {
        const structure = state.structures.find((candidate) => candidate.id === acolyte.assignmentId);
        return structure === undefined ? state.heart.x + acolyte.idleOffset : structure.x;
    }
}

function updateFixedStructures(state, dt, random) {
    for (const structure of state.structures) {
        structure.hitFlash = Math.max(0, structure.hitFlash - dt);
        const active = structure.level > 0 && structureWorkerReady(state, structure);
        if (active) {
            runStaffedStructure(state, structure, dt, random);
        } else {
            structure.attackCooldown = Math.max(0, structure.attackCooldown - dt);
        }
    }
}

function runStaffedStructure(state, structure, dt, random) {
    switch (structure.type) {
        case "pasture":
            updatePasture(state, structure, dt, random);
            break;
        case "spire":
            updateSpire(state, structure, dt);
            break;
        case "barricade":
            updateBarricade(structure, dt);
            break;
        case "charnel":
            updateCharnelYard(state, structure, dt, random);
            break;
        default:
            throw new Error(`Unknown fixed structure type '${structure.type}' while updating staffed behavior.`);
    }
}

function updatePasture(state, structure, dt, random) {
    const definition = structureDefinition(structure.type);
    structure.productionTimer -= dt;
    if (structure.productionTimer <= 0) {
        const value = definition.yields[structure.level];
        addWisp(state, structure.x, value, random());
        structure.productionTimer += definition.intervals[structure.level];
        state.events.push({ type: "pasture-yield", x: structure.x, value });
    } else {
        structure.productionTimer = Math.max(Number.EPSILON, structure.productionTimer);
    }
}

function updateSpire(state, structure, dt) {
    const definition = structureDefinition(structure.type);
    structure.attackCooldown = Math.max(0, structure.attackCooldown - dt);
    const target = closestLiving(state.humans, structure.x, definition.ranges[structure.level]);
    const ready = target !== null && structure.attackCooldown === 0;
    if (ready) {
        target.hp -= definition.damage[structure.level];
        target.hitFlash = 0.16;
        structure.attackCooldown = definition.cooldowns[structure.level];
        state.events.push({ type: "spire-shot", x: target.x, fromX: structure.x });
    } else {
        structure.attackCooldown = structure.attackCooldown;
    }
}

function updateBarricade(structure, dt) {
    const definition = structureDefinition(structure.type);
    structure.hp = Math.min(structure.maxHp, structure.hp + definition.repairs[structure.level] * dt);
}

function updateCharnelYard(state, structure, dt, random) {
    const definition = structureDefinition(structure.type);
    structure.productionTimer = Math.max(0, structure.productionTimer - dt);
    const corpse = closestCorpse(state.corpses, structure.x, definition.ranges[structure.level]);
    const ready = corpse !== null && structure.productionTimer === 0;
    if (ready) {
        const value = corpse.value + definition.bonuses[structure.level];
        state.corpses = state.corpses.filter((candidate) => candidate.id !== corpse.id);
        addWisp(state, structure.x, value, random());
        structure.productionTimer = 1.2;
        state.events.push({ type: "charnel-harvest", x: structure.x, fromX: corpse.x, value });
    } else {
        structure.productionTimer = structure.productionTimer;
    }
}

function updateCorpses(state, dt, random) {
    const remaining = [];
    for (const corpse of state.corpses) {
        corpse.decayTimer -= dt;
        if (corpse.decayTimer <= 0) {
            addWisp(state, corpse.x, corpse.value, random());
            state.events.push({ type: "corpse-dissolve", x: corpse.x, value: corpse.value });
        } else {
            remaining.push(corpse);
        }
    }
    state.corpses = remaining;
}

function vacateWorkerJob(state, acolyte) {
    const structure = state.structures.find((candidate) => candidate.workerId === acolyte.id);
    if (structure === undefined) {
        acolyte.assignmentId = null;
    } else {
        structure.workerId = null;
        acolyte.assignmentId = null;
    }
}

function collapseFixedStructure(state, structure) {
    const definition = structureDefinition(structure.type);
    const worker = state.acolytes.find((acolyte) => acolyte.id === structure.workerId);
    if (worker === undefined) {
        structure.workerId = null;
    } else {
        worker.assignmentId = null;
        structure.workerId = null;
    }
    structure.level = 0;
    structure.hp = 0;
    structure.maxHp = 0;
    structure.productionTimer = 0;
    structure.attackCooldown = 0;
    state.events.push({ type: "structure-collapse", x: structure.x, structure: structure.type });
    setNotice(state, `The crusade has torn down a ${definition.name}.`, 3.4);
}

function closestLiving(entities, originX, maximumDistance) {
    const living = entities.filter((entity) => entity.hp > 0);
    if (living.length === 0) {
        return null;
    } else {
        const nearest = living.reduce((best, entity) => Math.abs(entity.x - originX) < Math.abs(best.x - originX) ? entity : best);
        return Math.abs(nearest.x - originX) <= maximumDistance ? nearest : null;
    }
}

function closestCorpse(corpses, originX, maximumDistance) {
    if (corpses.length === 0) {
        return null;
    } else {
        const nearest = corpses.reduce((best, corpse) => Math.abs(corpse.x - originX) < Math.abs(best.x - originX) ? corpse : best);
        return Math.abs(nearest.x - originX) <= maximumDistance ? nearest : null;
    }
}

function structureDefinition(type) {
    const definition = EXPANSION_CONFIG.types[type];
    if (definition === undefined) {
        throw new Error(`Fixed structure type '${type}' has no definition while reading expansion rules.`);
    } else {
        return definition;
    }
}

function addWisp(state, x, value, phase) {
    state.wisps.push({
        id: nextId(state, "wisp"),
        x: clamp(x, 70, EXPANSION_CONFIG.worldWidth - 70),
        value,
        phase: phase * Math.PI * 2,
    });
}

function nextId(state, prefix) {
    const id = `${prefix}-${state.nextId}`;
    state.nextId += 1;
    return id;
}

function moveToward(entity, destination, speed, dt) {
    const direction = Math.sign(destination - entity.x);
    entity.facing = direction === 0 ? entity.facing : direction;
    entity.vx = direction * speed;
    entity.x = clamp(entity.x + entity.vx * dt, 34, EXPANSION_CONFIG.worldWidth - 34);
}

function setNotice(state, text, ttl) {
    state.notice = { text, ttl };
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
