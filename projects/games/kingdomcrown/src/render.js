import { CONFIG, activeSiteCount, assaultSides, canSelectInteraction, getInteractions } from "./core.js";
import { createCombatEffects } from "./combat-effects.js";
import { structureWorkerReady } from "./expansion.js";
import { drawFootShadow, drawLandmark, drawLocalLight, drawSelectionHalo, trail } from "./foreground-art.js";
import { HORROR_HEIGHT, HUMAN_HEIGHT, drawHorrorActor, drawHumanActor, drawMountedPlayer, drawReformingHerald } from "./render-actors.js";
import { drawAcolyteActor, drawCorpse, drawFixedStructure, drawOutcastFire } from "./render-expansion.js";

const COLORS = Object.freeze({
    dread: "#7df6dc",
    violet: "#8e6bdc",
    blood: "#c8605a",
    gold: "#e6bd6b",
});

export function createRenderer(canvas) {
    return new WorldRenderer(canvas);
}

class WorldRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d", { alpha: false });
        this.landscape = new Image();
        this.landscape.src = new URL("../lake-of-the-crown.webp", import.meta.url).href;
        this.width = 1;
        this.height = 1;
        this.ratio = 1;
        this.cameraX = CONFIG.playerStartX;
        this.visualTime = 0;
        this.particles = [];
        this.rings = [];
        this.shake = 0;
        this.flash = 0;
        this.skyMood = 0;
        this.combat = createCombatEffects();
        this.resize();
    }

    resize() {
        const bounds = this.canvas.getBoundingClientRect();
        this.width = Math.max(320, bounds.width);
        this.height = Math.max(420, bounds.height);
        this.ratio = Math.min(2, window.devicePixelRatio || 1);
        this.canvas.width = Math.round(this.width * this.ratio);
        this.canvas.height = Math.round(this.height * this.ratio);
        this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    }

    reset() {
        this.cameraX = CONFIG.playerStartX;
        this.particles.length = 0;
        this.rings.length = 0;
        this.shake = 0;
        this.flash = 0;
        this.skyMood = 0;
        this.combat.clear();
    }

    consumeEvents(events) {
        for (const event of events) {
            this.consumeEvent(event);
        }
    }

    consumeEvent(event) {
        this.combat.add(event, this.visualTime);
        switch (event.type) {
            case "collect":
                this.burst(event.x, -58, COLORS.dread, 9, 65);
                break;
            case "awaken":
            case "spawn-horror":
            case "reform":
            case "mark-acolyte":
            case "outcast-arrives":
                this.burst(event.x, -18, COLORS.dread, event.type === "awaken" ? 26 : 12, 105);
                break;
            case "structure-rise":
                this.burst(event.x, -20, COLORS.dread, 24, 115);
                this.shake = Math.max(this.shake, 4);
                break;
            case "pasture-yield":
            case "charnel-harvest":
            case "corpse-dissolve":
                this.burst(event.x, -22, COLORS.dread, 10, 68);
                break;
            case "spire-shot":
                this.burst(event.x, -38, COLORS.dread, 7, 85);
                break;
            case "human-fall":
                this.burst(event.x, -30, COLORS.blood, 10, 70);
                break;
            case "horror-fall":
                this.burst(event.x, -22, COLORS.violet, 12, 82);
                break;
            case "horror-strike":
            case "human-strike":
            case "torch-strike":
            case "player-hit":
                this.burst(event.x, -35, event.type === "horror-strike" ? COLORS.dread : COLORS.blood, 6, 56);
                this.shake = Math.max(this.shake, event.type === "player-hit" ? 7 : 3);
                break;
            case "arrow":
                this.burst(event.x, -42, COLORS.gold, 4, 36);
                break;
            case "site-collapse":
            case "structure-collapse":
            case "acolyte-fall":
            case "dissolve":
                this.burst(event.x, -25, COLORS.violet, 30, 135);
                this.shake = 11;
                break;
            case "wave-warning":
            case "wave":
            case "siege-reserve":
                this.flash = Math.max(this.flash, event.type === "wave" ? 0.42 : 0.22);
                this.shake = Math.max(this.shake, event.type === "wave" ? 8 : 3);
                break;
            case "victory":
                this.burst(event.x, -90, COLORS.gold, 26, 83);
                break;
            case "finale":
            case "defeat":
                this.flash = 1;
                this.shake = 14;
                this.burst(event.x, -95, event.type === "finale" ? COLORS.dread : COLORS.blood, 70, 220);
                break;
            case "veil-deflect":
                this.rings.push({ x: event.x, radius: 8, maximum: 48, life: 0.24, maxLife: 0.24, color: COLORS.dread });
                break;
            default:
                this.flash = this.flash;
                break;
        }
    }

    burst(x, yOffset, color, count, force) {
        for (let index = 0; index < count; index += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = force * (0.25 + Math.random() * 0.75);
            const life = 0.45 + Math.random() * 0.65;
            this.particles.push({
                x,
                yOffset,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 28,
                life,
                maxLife: life,
                size: 1.5 + Math.random() * 3.5,
                color,
            });
        }
    }

    render(state, elapsed, destination = null) {
        const dt = Math.min(0.05, Math.max(0, elapsed));
        this.visualTime += dt;
        const mood = state.status === "victory" ? 1 : state.ritualStarted ? -1 : 0;
        this.skyMood += (mood - this.skyMood) * Math.min(1, dt * 0.8);
        this.updateCamera(state, dt);
        this.updateEffects(dt);
        const context = this.context;
        context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        const shakeX = (Math.random() - 0.5) * this.shake;
        const shakeY = (Math.random() - 0.5) * this.shake * 0.45;
        context.save();
        context.translate(shakeX, shakeY);
        this.drawLandscape(state);
        context.save();
        context.translate(this.width / 2 - this.cameraX, 0);
        this.drawGround();
        this.drawDestination(destination);
        this.drawWorldStructures(state);
        this.drawCorpses(state);
        this.drawWisps(state);
        this.drawEntities(state);
        this.combat.draw(context, this.groundY(), this.visualTime, (x) => this.visible(x));
        this.drawEffects();
        context.restore();
        switch (state.status) {
            case "title":
                break;
            default:
                this.drawOverview(state);
        }
        this.drawVignette(state);
        context.restore();
    }

    updateCamera(state, dt) {
        const halfView = Math.min(CONFIG.worldWidth / 2, this.width * 0.5);
        const target = clamp(state.player.x + state.player.vx * 0.28, halfView, CONFIG.worldWidth - halfView);
        const response = state.player.reformTimer > 0 ? 2.2 : 4.2;
        this.cameraX += (target - this.cameraX) * Math.min(1, dt * response);
    }

    updateEffects(dt) {
        const ground = this.groundY();
        for (const particle of this.particles) {
            particle.x += particle.vx * dt;
            particle.yOffset += particle.vy * dt;
            particle.vy += 95 * dt;
            particle.life -= dt;
            particle.screenY = ground + particle.yOffset;
        }
        this.particles = this.particles.filter((particle) => particle.life > 0);
        for (const ring of this.rings) {
            ring.life -= dt;
            const progress = 1 - ring.life / ring.maxLife;
            ring.radius = ring.maximum * easeOut(progress);
        }
        this.rings = this.rings.filter((ring) => ring.life > 0);
        this.shake = Math.max(0, this.shake - dt * 22);
        this.flash = Math.max(0, this.flash - dt * 1.4);
    }

    worldPoint(clientX, clientY) {
        const bounds = this.canvas.getBoundingClientRect();
        const screenX = (clientX - bounds.left) * this.width / bounds.width;
        const screenY = (clientY - bounds.top) * this.height / bounds.height;
        const map = this.overviewPosition();
        const onMap = Math.abs(screenY - map.y) <= 12 && screenX >= map.x && screenX <= map.x + map.width;
        return {
            x: onMap ? (screenX - map.x) / map.width * CONFIG.worldWidth : this.cameraX + screenX - this.width / 2,
            aboveTrail: this.groundY() - screenY,
            onMap,
        };
    }

    drawDestination(x) {
        if (x === null || !this.visible(x)) {
            return;
        } else {
            const context = this.context;
            const ground = this.groundY();
            context.strokeStyle = "rgba(237, 201, 134, 0.82)";
            context.lineWidth = 1;
            context.beginPath();
            context.ellipse(x, ground + 2, 12, 4, 0, 0, Math.PI * 2);
            context.stroke();
        }
    }

    groundY() {
        return Math.min(this.height - 126, this.height * 0.8);
    }

    visible(x, margin = 140) {
        return Math.abs(x - this.cameraX) <= this.width / 2 + margin;
    }

    drawLandscape(state) {
        const context = this.context;
        const ground = this.groundY();
        const image = this.landscape;
        const fallback = context.createLinearGradient(0, 0, 0, ground);
        fallback.addColorStop(0, "#182537");
        fallback.addColorStop(1, "#526867");
        context.fillStyle = fallback;
        context.fillRect(-10, -10, this.width + 20, this.height + 20);
        if (image.naturalWidth > 0) {
            const scale = Math.max((ground + 65) / image.height, (this.width + 110) / image.width);
            const width = image.width * scale;
            const height = image.height * scale;
            const pan = clamp(this.cameraX / CONFIG.worldWidth, 0, 1);
            const x = -8 - (width - this.width - 16) * pan;
            context.drawImage(image, x, ground + 24 - height, width, height);
        } else {
            context.fillStyle = "#ddd9b4";
            context.beginPath();
            context.arc(this.width * 0.61, ground * 0.26, 30, 0, Math.PI * 2);
            context.fill();
        }

        const siege = Math.max(0, -this.skyMood);
        const warning = state.ritualStarted ? siege * 0.48 : clamp((5 - state.waveTimer) / 5, 0, 1) * 0.24;
        const sides = state.ritualStarted ? [-1, 1] : assaultSides(state.wave + 1);
        for (const side of sides) {
            const edge = side < 0 ? 0 : this.width;
            const light = context.createLinearGradient(edge, 0, edge - side * this.width * 0.65, 0);
            light.addColorStop(0, `rgba(219, 97, 52, ${warning})`);
            light.addColorStop(1, "rgba(219, 97, 52, 0)");
            context.fillStyle = light;
            context.fillRect(-10, 0, this.width + 20, ground);
        }
        this.drawMist(ground);
        const dawn = Math.max(0, this.skyMood);
        const light = context.createLinearGradient(0, 0, 0, ground);
        light.addColorStop(0, `rgba(17, 22, 47, ${siege * 0.46})`);
        light.addColorStop(0.67, `rgba(245, 164, 87, ${dawn * 0.29})`);
        light.addColorStop(1, `rgba(251, 213, 154, ${dawn * 0.17})`);
        context.fillStyle = light;
        context.fillRect(0, 0, this.width, ground);
    }

    drawMist(ground) {
        const context = this.context;
        const width = this.width + 360;
        for (let index = 0; index < 4; index += 1) {
            const drift = this.visualTime * (9 + index * 4) - this.cameraX * 0.14;
            const x = ((drift + index * width / 4) % width + width) % width - 180;
            const y = ground - 26 - index * 31;
            context.save();
            context.translate(x, y);
            context.scale(1, 0.12);
            const fog = context.createRadialGradient(0, 0, 0, 0, 0, 220);
            fog.addColorStop(0, "rgba(169, 196, 196, 0.2)");
            fog.addColorStop(1, "rgba(169, 196, 196, 0)");
            context.fillStyle = fog;
            context.fillRect(-220, -220, 440, 440);
            context.restore();
        }
    }

    drawGround() {
        const context = this.context;
        const ground = this.groundY();
        const left = this.cameraX - this.width / 2 - 28;
        const right = this.cameraX + this.width / 2 + 28;
        context.fillStyle = "#0b141b";
        context.fillRect(left, ground + 8, right - left, this.height - ground + 20);

        if (trail.naturalWidth === 0) {
            return;
        } else {
            const tileWidth = CONFIG.worldWidth / 2;
            const tileOrigin = -tileWidth / 2;
            const sourceTop = 350;
            const footLine = 447;
            const belowFeet = trail.naturalHeight - footLine;
            const verticalScale = Math.max(0.66, (this.height - ground + 24) / belowFeet);
            const top = ground - (footLine - sourceTop) * verticalScale;
            const paintedHeight = (trail.naturalHeight - sourceTop) * verticalScale;
            for (let tile = Math.floor((left - tileOrigin) / tileWidth); tileOrigin + tile * tileWidth < right; tile += 1) {
                const mirrored = tile % 2 !== 0;
                context.save();
                context.translate(tileOrigin + (tile + Number(mirrored)) * tileWidth, top);
                context.scale(mirrored ? -1 : 1, 1);
                context.drawImage(trail, 0, sourceTop, trail.naturalWidth, trail.naturalHeight - sourceTop,
                    0, 0, tileWidth, paintedHeight);
                context.restore();
            }
        }
    }

    drawWorldStructures(state) {
        this.drawKeep(48, 1);
        this.drawKeep(CONFIG.worldWidth - 48, -1);
        const nearby = state.status === "playing"
            ? new Set(getInteractions(state).filter(canSelectInteraction).map((action) => action.targetId))
            : new Set();
        for (const camp of state.camps.filter((candidate) => this.visible(candidate.x, 120))) {
            drawOutcastFire(this.context, camp, this.groundY(), this.visualTime, nearby.has(camp.id));
        }
        for (const structure of state.structures.filter((candidate) => this.visible(candidate.x, 170))) {
            drawFixedStructure(this.context, structure, this.groundY(), this.visualTime, nearby.has(structure.id), structureWorkerReady(state, structure));
        }
        for (const site of state.sites.filter((candidate) => this.visible(candidate.x, 180))) {
            this.drawSite(site, nearby.has(site.id));
        }
        this.drawHeart(state);
    }

    drawKeep(x, facing) {
        if (!this.visible(x, 220)) {
            return;
        } else {
            const context = this.context;
            context.save();
            context.translate(x, this.groundY());
            context.scale(facing, 1);
            drawLandmark(context, "keep", 199);
            context.restore();
        }
    }

    drawHeart(state) {
        const heart = state.heart;
        if (!this.visible(heart.x, 185)) {
            return;
        } else {
            const context = this.context;
            const ground = this.groundY();
            const height = 191;
            const shrineX = heart.x - 74;
            const pulse = Math.sin(this.visualTime * 2.6) * 0.045;
            drawFootShadow(context, shrineX, ground, 115);
            drawLocalLight(context, shrineX, ground - height * 0.52, 134, "88, 220, 202", 0.16 + pulse);
            context.save();
            context.translate(shrineX, ground);
            drawLandmark(context, "heart", height);
            context.restore();
            this.drawHealthBar(shrineX, ground - height - 4, heart.hp, heart.maxHp, 86, "#69d7be");
        }
    }

    drawSite(site, selected) {
        const context = this.context;
        const ground = this.groundY();
        const active = site.level > 0;
        const height = active ? 84 + site.level * 14 : 66;
        if (selected) {
            drawSelectionHalo(context, site.x, ground, 51 + site.level * 6);
        } else {
            drawFootShadow(context, site.x, ground, 39 + site.level * 7);
        }

        if (active) {
            const pulse = Math.sin(this.visualTime * 2.3 + site.x) * 0.06;
            drawLocalLight(context, site.x, ground - height * 0.35, 78, "84, 225, 202", 0.2 + pulse);
        } else {
            drawLocalLight(context, site.x, ground - height * 0.6, 25, "84, 186, 173", 0.1);
        }
        context.save();
        context.translate(site.x, ground);
        drawLandmark(context, active ? "brood" : "dormant", height);
        context.restore();

        if (active) {
            this.drawHealthBar(site.x, ground - height - 5, site.hp, site.maxHp, 64, "#6dd6b9");
        } else {
            return;
        }
    }

    drawWisps(state) {
        const context = this.context;
        const ground = this.groundY();
        for (const wisp of state.wisps.filter((candidate) => this.visible(candidate.x, 80))) {
            const y = ground - 44 + Math.sin(this.visualTime * 2.4 + wisp.phase) * 10;
            const gradient = context.createRadialGradient(wisp.x, y, 1, wisp.x, y, 26);
            gradient.addColorStop(0, "rgba(191, 255, 235, 0.95)");
            gradient.addColorStop(0.22, "rgba(90, 235, 211, 0.65)");
            gradient.addColorStop(1, "rgba(96, 101, 214, 0)");
            context.fillStyle = gradient;
            context.beginPath();
            context.arc(wisp.x, y, 26, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = "#c7fff0";
            context.beginPath();
            context.ellipse(wisp.x, y, 3.5, 7, Math.sin(this.visualTime + wisp.phase) * 0.4, 0, Math.PI * 2);
            context.fill();
        }
    }

    drawEntities(state) {
        const visibleHorrors = state.horrors.filter((entity) => this.visible(entity.x));
        const visibleHumans = state.humans.filter((entity) => this.visible(entity.x));
        const visibleAcolytes = state.acolytes.filter((entity) => this.visible(entity.x));
        const ordered = [
            ...visibleHorrors.map((entity) => ({ family: "horror", entity })),
            ...visibleHumans.map((entity) => ({ family: "human", entity })),
            ...visibleAcolytes.map((entity) => ({ family: "acolyte", entity })),
        ].sort((left, right) => left.entity.x - right.entity.x);
        for (const item of ordered) {
            switch (item.family) {
                case "horror":
                    this.drawHorror(item.entity);
                    break;
                case "human":
                    this.drawHuman(item.entity);
                    break;
                case "acolyte":
                    drawAcolyteActor(this.context, item.entity, this.groundY(), this.visualTime);
                    break;
                default:
                    throw new Error(`Unknown actor family '${item.family}' while drawing game entities.`);
            }
        }
        if (state.player.reformTimer === 0) {
            this.drawPlayer(state.player);
        } else {
            this.drawReformingPlayer(state);
        }
    }

    drawHorror(horror) {
        const context = this.context;
        const ground = this.groundY();
        drawHorrorActor(context, horror, ground, this.visualTime, this.combat.lunge(horror, this.visualTime));
        this.drawHealthBar(horror.x, ground - HORROR_HEIGHT[horror.type] - 5, horror.hp, horror.maxHp, horror.type === "brute" ? 50 : 36, "#6ed3b8");
    }

    drawHuman(human) {
        const context = this.context;
        const ground = this.groundY();
        drawHumanActor(context, human, ground, this.visualTime, this.combat.lunge(human, this.visualTime));
        this.drawHealthBar(human.x, ground - HUMAN_HEIGHT[human.type] - 5, human.hp, human.maxHp, 32, human.type === "torchbearer" ? "#d56b55" : "#d0b878");
    }

    drawCorpses(state) {
        for (const corpse of state.corpses.filter((candidate) => this.visible(candidate.x, 80))) {
            drawCorpse(this.context, corpse, this.groundY(), this.visualTime);
        }
    }

    drawPlayer(player) {
        drawMountedPlayer(this.context, player, this.groundY(), this.visualTime);
        const ground = this.groundY();
        this.drawHealthBar(player.x, ground + 11, player.veil, player.maxVeil, 42, "#b093ec");
        this.drawHealthBar(player.x, ground + 17, player.stamina, player.maxStamina, 42, player.exhausted ? COLORS.violet : COLORS.gold);
    }

    drawReformingPlayer(state) {
        drawReformingHerald(this.context, state, this.groundY(), this.visualTime);
    }

    drawHealthBar(x, y, hp, maxHp, width, color) {
        const context = this.context;
        if (hp >= maxHp || maxHp <= 0) {
            return;
        } else {
            const ratio = clamp(hp / maxHp, 0, 1);
            context.fillStyle = "rgba(3, 8, 10, 0.72)";
            context.fillRect(x - width / 2 - 1, y - 1, width + 2, 5);
            context.fillStyle = color;
            context.fillRect(x - width / 2, y, width * ratio, 3);
        }
    }

    drawEffects() {
        const context = this.context;
        for (const ring of this.rings) {
            context.save();
            context.globalAlpha = ring.life / ring.maxLife;
            context.strokeStyle = ring.color;
            context.lineWidth = 3;
            context.beginPath();
            context.ellipse(ring.x, this.groundY() - 24, ring.radius, ring.radius * 0.35, 0, 0, Math.PI * 2);
            context.stroke();
            context.restore();
        }
        for (const particle of this.particles) {
            context.save();
            context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
            context.fillStyle = particle.color;
            context.beginPath();
            context.arc(particle.x, particle.screenY, particle.size, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
    }

    overviewPosition() {
        const width = Math.min(420, this.width - 110);
        return { x: (this.width - width) / 2, y: this.height - 34, width };
    }

    drawOverview(state) {
        const context = this.context;
        const { x, y, width } = this.overviewPosition();
        context.save();
        context.fillStyle = "rgba(2, 8, 10, 0.62)";
        context.fillRect(x - 12, y - 12, width + 24, 24);
        context.strokeStyle = "rgba(125, 246, 220, 0.22)";
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + width, y);
        context.stroke();
        for (const site of state.sites) {
            const markerX = x + site.x / CONFIG.worldWidth * width;
            context.fillStyle = site.level > 0 ? COLORS.dread : "#596a62";
            context.beginPath();
            context.arc(markerX, y, 3 + site.level, 0, Math.PI * 2);
            context.fill();
        }
        for (const structure of state.structures) {
            const markerX = x + structure.x / CONFIG.worldWidth * width;
            context.fillStyle = structure.level > 0 ? structureWorkerReady(state, structure) ? COLORS.dread : COLORS.gold : "#34443f";
            context.fillRect(markerX - 1.5, y - 1.5, 3 + structure.level, 3 + structure.level);
        }
        for (const camp of state.camps) {
            const markerX = x + camp.x / CONFIG.worldWidth * width;
            context.fillStyle = camp.available ? "#e58b45" : "#55483b";
            context.fillRect(markerX - 1, y + 5, 2, 3);
        }
        context.fillStyle = "#ff9a68";
        for (const human of state.humans) {
            const markerX = x + human.x / CONFIG.worldWidth * width;
            context.fillRect(markerX - 1.5, y + 5, 3, 4);
        }
        context.fillStyle = "#d3a55f";
        context.fillRect(x + state.heart.x / CONFIG.worldWidth * width - 2, y - 5, 4, 10);
        context.fillStyle = "#f2eee0";
        context.beginPath();
        context.moveTo(x + state.player.x / CONFIG.worldWidth * width, y - 9);
        context.lineTo(x + state.player.x / CONFIG.worldWidth * width - 5, y - 16);
        context.lineTo(x + state.player.x / CONFIG.worldWidth * width + 5, y - 16);
        context.closePath();
        context.fill();
        context.restore();
    }

    drawVignette(state) {
        const context = this.context;
        const gradient = context.createRadialGradient(this.width / 2, this.height * 0.52, Math.min(this.width, this.height) * 0.22, this.width / 2, this.height * 0.52, Math.max(this.width, this.height) * 0.72);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(1, "rgba(0, 2, 4, 0.39)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, this.width, this.height);
        const danger = 1 - state.heart.hp / state.heart.maxHp;
        const dangerAlpha = danger > 0.35 ? danger * 0.16 + Math.sin(this.visualTime * 4) * 0.025 : 0;
        context.fillStyle = `rgba(117, 23, 29, ${dangerAlpha})`;
        context.fillRect(0, 0, this.width, this.height);
        this.flash = Math.max(0, this.flash);
        context.fillStyle = `rgba(216, 231, 210, ${this.flash * 0.2})`;
        context.fillRect(0, 0, this.width, this.height);
        const awake = activeSiteCount(state);
        context.fillStyle = `rgba(75, 234, 200, ${awake * 0.007})`;
        context.fillRect(0, 0, this.width, this.height);
    }
}

function easeOut(value) {
    return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
