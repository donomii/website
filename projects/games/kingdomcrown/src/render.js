import { CONFIG, activeSiteCount, getInteraction } from "./core.js";
import { EXPANSION_CONFIG, structureWorkerReady } from "./expansion.js";
import { drawHorrorActor, drawHumanActor, drawMountedPlayer, drawReformingHerald } from "./render-actors.js";
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
        this.width = 1;
        this.height = 1;
        this.ratio = 1;
        this.cameraX = CONFIG.playerStartX;
        this.visualTime = 0;
        this.particles = [];
        this.rings = [];
        this.shake = 0;
        this.flash = 0;
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

    consumeEvents(events) {
        for (const event of events) {
            this.consumeEvent(event);
        }
    }

    consumeEvent(event) {
        switch (event.type) {
            case "collect":
                this.burst(event.x, -58, COLORS.dread, 9, 65);
                break;
            case "tendril":
                this.rings.push({ x: event.x, radius: 12, maximum: CONFIG.playerAttackRadius, life: 0.42, maxLife: 0.42, color: COLORS.violet });
                this.burst(event.x, -22, COLORS.violet, 18, 125);
                this.shake = Math.max(this.shake, 4);
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
                this.flash = Math.max(this.flash, event.type === "wave" ? 0.42 : 0.22);
                this.shake = Math.max(this.shake, event.type === "wave" ? 8 : 3);
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

    render(state, elapsed) {
        const dt = Math.min(0.05, Math.max(0, elapsed));
        this.visualTime += dt;
        this.updateCamera(state, dt);
        this.updateEffects(dt);
        const context = this.context;
        context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
        const shakeX = (Math.random() - 0.5) * this.shake;
        const shakeY = (Math.random() - 0.5) * this.shake * 0.45;
        context.save();
        context.translate(shakeX, shakeY);
        this.drawSky(state);
        this.drawFarKingdom(state);
        context.save();
        context.translate(this.width / 2 - this.cameraX, 0);
        this.drawGround(state);
        this.drawWorldStructures(state);
        this.drawCorpses(state);
        this.drawWisps(state);
        this.drawEntities(state);
        this.drawEffects();
        context.restore();
        this.drawOverview(state);
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

    groundY() {
        return Math.min(this.height - 118, Math.max(315, this.height * 0.73));
    }

    visible(x, margin = 140) {
        return Math.abs(x - this.cameraX) <= this.width / 2 + margin;
    }

    drawSky(state) {
        const context = this.context;
        const warningLight = clamp((6 - state.waveTimer) / 6, 0, 1);
        const gradient = context.createLinearGradient(0, 0, 0, this.groundY() + 80);
        gradient.addColorStop(0, mix("#060510", "#38202a", warningLight * 0.62));
        gradient.addColorStop(0.56, mix("#152737", "#a75843", warningLight * 0.48));
        gradient.addColorStop(1, mix("#385050", "#d28d62", warningLight * 0.3));
        context.fillStyle = gradient;
        context.fillRect(-20, -20, this.width + 40, this.height + 40);
        this.drawStars(warningLight);
        this.drawMoon(warningLight);
        this.drawClouds(state);
    }

    drawStars(warningLight) {
        const context = this.context;
        context.save();
        context.globalAlpha = 0.82 * (1 - warningLight * 0.72);
        for (let index = 0; index < 84; index += 1) {
            const x = hash(index * 17.1) * this.width;
            const y = 18 + hash(index * 31.7) * this.groundY() * 0.66;
            const pulse = 0.45 + Math.sin(this.visualTime * 1.7 + index) * 0.28;
            context.fillStyle = index % 8 === 0 ? COLORS.dread : `rgba(226, 231, 219, ${pulse})`;
            context.fillRect(x, y, index % 11 === 0 ? 2 : 1, index % 11 === 0 ? 2 : 1);
        }
        context.restore();
    }

    drawMoon(warningLight) {
        const context = this.context;
        const x = this.width * 0.76 - this.cameraX * 0.015;
        const y = 92;
        const glow = context.createRadialGradient(x, y, 4, x, y, 85);
        glow.addColorStop(0, `rgba(184, 245, 222, ${0.32 * (1 - warningLight)})`);
        glow.addColorStop(1, "rgba(100, 208, 187, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, 85, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = mix("#c9e6d7", "#f0b178", warningLight * 0.65);
        context.beginPath();
        context.arc(x, y, 26, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = mix("#15202e", "#51303a", warningLight * 0.5);
        context.beginPath();
        context.arc(x + 10, y - 7, 24, 0, Math.PI * 2);
        context.fill();
    }

    drawClouds(state) {
        const context = this.context;
        context.save();
        context.globalAlpha = 0.18;
        context.fillStyle = "#b7c6bd";
        for (let index = 0; index < 7; index += 1) {
            const travel = (state.time * (4 + index * 0.3) + index * 280 - this.cameraX * 0.04) % (this.width + 420);
            const x = travel - 210;
            const y = 95 + (index % 4) * 42;
            context.beginPath();
            context.ellipse(x, y, 100 + index * 5, 14 + index % 3 * 5, 0, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }

    drawFarKingdom(state) {
        const context = this.context;
        const ground = this.groundY();
        context.save();
        context.translate(-this.cameraX * 0.08, 0);
        context.fillStyle = "rgba(10, 22, 27, 0.46)";
        context.beginPath();
        context.moveTo(-this.width, ground);
        for (let x = -this.width; x <= this.width * 2; x += 80) {
            const y = ground - 92 - Math.sin(x * 0.006) * 38 - Math.sin(x * 0.017) * 18;
            context.lineTo(x, y);
        }
        context.lineTo(this.width * 2, ground);
        context.closePath();
        context.fill();
        context.restore();
        this.drawDistantVillage(state);
    }

    drawDistantVillage(state) {
        const context = this.context;
        const ground = this.groundY();
        context.save();
        context.translate(this.width / 2 - this.cameraX * 0.22, 0);
        for (let index = 0; index < 24; index += 1) {
            const x = index * 270 - 1000;
            const height = 25 + hash(index * 9.3) * 34;
            context.fillStyle = "rgba(9, 16, 19, 0.7)";
            context.fillRect(x, ground - height - 42, 62, height + 42);
            context.beginPath();
            context.moveTo(x - 8, ground - height - 42);
            context.lineTo(x + 31, ground - height - 70);
            context.lineTo(x + 70, ground - height - 42);
            context.fill();
            context.fillStyle = "rgba(229, 164, 83, 0.3)";
            context.fillRect(x + 17, ground - 29, 8, 11);
        }
        context.restore();
    }

    drawGround(state) {
        const context = this.context;
        const ground = this.groundY();
        const gradient = context.createLinearGradient(0, ground - 20, 0, this.height + 30);
        gradient.addColorStop(0, "#1b3532");
        gradient.addColorStop(0.12, "#102624");
        gradient.addColorStop(1, "#080d10");
        context.fillStyle = gradient;
        context.fillRect(-100, ground, CONFIG.worldWidth + 200, this.height - ground + 80);
        context.strokeStyle = "rgba(93, 133, 105, 0.45)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, ground);
        for (let x = 0; x <= CONFIG.worldWidth; x += 34) {
            context.lineTo(x, ground + Math.sin(x * 0.021) * 3);
        }
        context.stroke();
        this.drawGrass();
        this.drawGroves(state);
    }

    drawGrass() {
        const context = this.context;
        const ground = this.groundY();
        const start = Math.max(0, Math.floor((this.cameraX - this.width / 2 - 60) / 24) * 24);
        const end = Math.min(CONFIG.worldWidth, this.cameraX + this.width / 2 + 60);
        context.strokeStyle = "rgba(80, 125, 91, 0.48)";
        context.lineWidth = 1;
        context.beginPath();
        for (let x = start; x < end; x += 24) {
            const height = 5 + hash(x * 0.7) * 12;
            context.moveTo(x, ground + 2);
            context.quadraticCurveTo(x - 3, ground - height * 0.5, x + hash(x) * 7 - 3, ground - height);
        }
        context.stroke();
    }

    drawGroves(state) {
        const context = this.context;
        const ground = this.groundY();
        const groves = CONFIG.grovePositions.filter((x) => this.visible(x, 220));
        for (const groveX of groves) {
            context.save();
            context.translate(groveX, ground);
            for (let index = -2; index <= 2; index += 1) {
                const x = index * 30 + hash(groveX + index) * 14;
                const height = 72 + hash(groveX * (index + 4)) * 75;
                context.strokeStyle = "#0b1718";
                context.lineWidth = 7;
                context.beginPath();
                context.moveTo(x, 0);
                context.quadraticCurveTo(x - 8, -height * 0.5, x + 2, -height);
                context.stroke();
                context.fillStyle = "rgba(10, 25, 25, 0.9)";
                context.beginPath();
                context.arc(x + 1, -height + 9, 25 + index % 2 * 5, 0, Math.PI * 2);
                context.arc(x - 15, -height + 26, 22, 0, Math.PI * 2);
                context.arc(x + 18, -height + 29, 24, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
        }
    }

    drawWorldStructures(state) {
        this.drawKeep(40, 1, state.wave);
        this.drawKeep(CONFIG.worldWidth - 40, -1, state.wave);
        const selectedId = getInteraction(state)?.targetId ?? null;
        for (const camp of state.camps.filter((candidate) => this.visible(candidate.x, 120))) {
            drawOutcastFire(this.context, camp, this.groundY(), this.visualTime, selectedId === camp.id);
        }
        for (const structure of state.structures.filter((candidate) => this.visible(candidate.x, 170))) {
            drawFixedStructure(this.context, structure, this.groundY(), this.visualTime, selectedId === structure.id, structureWorkerReady(state, structure));
        }
        for (const site of state.sites.filter((candidate) => this.visible(candidate.x, 180))) {
            this.drawSite(site, state);
        }
        this.drawHeart(state);
    }

    drawKeep(x, facing, wave) {
        const context = this.context;
        const ground = this.groundY();
        context.save();
        context.translate(x, ground);
        context.scale(facing, 1);
        context.fillStyle = "#11191b";
        context.fillRect(-65, -158, 105, 158);
        context.fillRect(-79, -182, 34, 182);
        context.fillRect(20, -195, 38, 195);
        for (let index = 0; index < 5; index += 1) {
            context.fillRect(-79 + index * 34, -205 + index % 2 * 18, 18, 31);
        }
        context.fillStyle = "rgba(239, 160, 70, 0.75)";
        for (let index = 0; index < Math.min(5, wave + 1); index += 1) {
            context.fillRect(-49 + (index % 3) * 32, -137 + Math.floor(index / 3) * 42, 8, 17);
        }
        context.fillStyle = "#853f35";
        context.beginPath();
        context.moveTo(55, -183);
        context.lineTo(108, -165);
        context.lineTo(55, -148);
        context.closePath();
        context.fill();
        context.restore();
    }

    drawHeart(state) {
        const heart = state.heart;
        const context = this.context;
        const ground = this.groundY();
        const pulse = 1 + Math.sin(this.visualTime * 2.6) * 0.045;
        context.save();
        context.translate(heart.x, ground);
        context.scale(pulse, pulse);
        const glow = context.createRadialGradient(0, -54, 6, 0, -54, 105);
        glow.addColorStop(0, "rgba(105, 255, 220, 0.24)");
        glow.addColorStop(1, "rgba(78, 179, 156, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(0, -54, 105, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#0a1114";
        context.lineWidth = 12;
        for (let arm = -2; arm <= 2; arm += 1) {
            context.beginPath();
            context.moveTo(arm * 9, -18);
            context.bezierCurveTo(arm * 31, 4, arm * 50, -8, arm * 62, 4);
            context.stroke();
        }
        context.fillStyle = "#10171d";
        context.beginPath();
        context.ellipse(0, -55, 38, 51, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = COLORS.dread;
        context.lineWidth = 2;
        context.beginPath();
        context.ellipse(0, -57, 14, 23, 0, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = "rgba(125, 246, 220, 0.75)";
        context.beginPath();
        context.ellipse(0, -58, 5, 12, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        this.drawHealthBar(heart.x, ground - 124, heart.hp, heart.maxHp, 86, "#69d7be");
    }

    drawSite(site, state) {
        const context = this.context;
        const ground = this.groundY();
        const selected = getInteraction(state)?.targetId === site.id;
        context.save();
        context.translate(site.x, ground);
        context.strokeStyle = selected ? COLORS.dread : "rgba(91, 127, 113, 0.65)";
        context.lineWidth = selected ? 3 : 2;
        context.beginPath();
        context.ellipse(0, 0, 56, 13, 0, 0, Math.PI * 2);
        context.stroke();
        this.drawRune(context, site.level);
        if (site.level === 0) {
            this.drawDormantSite(context);
        } else {
            this.drawActiveSite(context, site);
        }
        context.restore();
        if (site.level > 0) {
            this.drawHealthBar(site.x, ground - 99 - site.level * 4, site.hp, site.maxHp, 64, "#6dd6b9");
        } else {
            this.drawSiteNumber(site, ground);
        }
    }

    drawRune(context, level) {
        context.strokeStyle = level > 0 ? "rgba(125, 246, 220, 0.56)" : "rgba(96, 120, 109, 0.45)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(-36, -2);
        context.lineTo(-17, -10);
        context.lineTo(0, 1);
        context.lineTo(19, -10);
        context.lineTo(39, -1);
        context.moveTo(-23, 5);
        context.lineTo(0, -8);
        context.lineTo(24, 5);
        context.stroke();
    }

    drawDormantSite(context) {
        context.fillStyle = "#101a19";
        context.fillRect(-6, -36, 12, 31);
        context.beginPath();
        context.moveTo(-12, -34);
        context.lineTo(0, -57);
        context.lineTo(12, -34);
        context.closePath();
        context.fill();
        context.fillStyle = "rgba(116, 152, 133, 0.45)";
        context.fillRect(-2, -46, 4, 10);
    }

    drawActiveSite(context, site) {
        const pulse = Math.sin(this.visualTime * 2.3 + site.x) * 3;
        context.strokeStyle = "#0b1317";
        context.lineWidth = 8;
        for (let arm = 0; arm < 3 + site.level; arm += 1) {
            const side = arm % 2 === 0 ? -1 : 1;
            context.beginPath();
            context.moveTo(side * 11, -14);
            context.quadraticCurveTo(side * (28 + arm * 4), -31 - arm * 3, side * (39 + arm * 5), -6);
            context.stroke();
        }
        context.fillStyle = "#111820";
        context.beginPath();
        context.ellipse(0, -38, 31 + site.level * 5 + pulse, 37 + site.level * 8, 0, 0, Math.PI * 2);
        context.fill();
        for (let eye = 0; eye < site.level; eye += 1) {
            const x = (eye - (site.level - 1) / 2) * 16;
            context.fillStyle = COLORS.dread;
            context.beginPath();
            context.ellipse(x, -42 - eye % 2 * 9, 4, 8, 0, 0, Math.PI * 2);
            context.fill();
        }
        context.strokeStyle = "rgba(112, 225, 199, 0.45)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(0, -38, 19 + site.level * 7, Math.PI * 0.12, Math.PI * 0.88);
        context.stroke();
    }

    drawSiteNumber(site, ground) {
        const context = this.context;
        context.save();
        context.font = "10px ui-monospace, monospace";
        context.textAlign = "center";
        context.fillStyle = "rgba(159, 181, 166, 0.68)";
        context.fillText(site.id.replace("site-", "SIGIL "), site.x, ground - 68);
        context.restore();
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
                    this.drawAcolyte(item.entity, state);
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
        drawHorrorActor(context, horror, ground, this.visualTime);
        this.drawHealthBar(horror.x, ground - (horror.type === "brute" ? 78 : 49), horror.hp, horror.maxHp, horror.type === "brute" ? 50 : 36, "#6ed3b8");
    }

    drawHuman(human) {
        const context = this.context;
        const ground = this.groundY();
        drawHumanActor(context, human, ground, this.visualTime);
        this.drawHealthBar(human.x, ground - 74, human.hp, human.maxHp, 32, human.type === "torchbearer" ? "#d56b55" : "#d0b878");
    }

    drawAcolyte(acolyte, state) {
        const structure = state.structures.find((candidate) => candidate.id === acolyte.assignmentId);
        const role = structure === undefined ? null : EXPANSION_CONFIG.types[structure.type].role;
        drawAcolyteActor(this.context, acolyte, this.groundY(), this.visualTime, role);
    }

    drawCorpses(state) {
        for (const corpse of state.corpses.filter((candidate) => this.visible(candidate.x, 80))) {
            drawCorpse(this.context, corpse, this.groundY(), this.visualTime);
        }
    }

    drawPlayer(player) {
        drawMountedPlayer(this.context, player, this.groundY(), this.visualTime);
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

    drawOverview(state) {
        const context = this.context;
        const width = Math.min(420, this.width - 110);
        const x = (this.width - width) / 2;
        const y = this.height - 34;
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
        gradient.addColorStop(1, "rgba(0, 2, 4, 0.72)");
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

function hash(value) {
    const sine = Math.sin(value * 12.9898) * 43758.5453;
    return sine - Math.floor(sine);
}

function easeOut(value) {
    return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function mix(left, right, amount) {
    const leftValues = hexValues(left);
    const rightValues = hexValues(right);
    const ratio = clamp(amount, 0, 1);
    const values = leftValues.map((value, index) => Math.round(value + (rightValues[index] - value) * ratio));
    return `rgb(${values[0]}, ${values[1]}, ${values[2]})`;
}

function hexValues(color) {
    return [
        Number.parseInt(color.slice(1, 3), 16),
        Number.parseInt(color.slice(3, 5), 16),
        Number.parseInt(color.slice(5, 7), 16),
    ];
}
