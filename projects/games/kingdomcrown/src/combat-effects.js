const STRIKE_DURATION = 0.36;
const ARROW_DURATION = 0.24;
const BEAM_DURATION = 0.22;

export function createCombatEffects() {
    const strikes = new Map();
    let traces = [];
    return {
        add(event, time) {
            if (event.actorId !== undefined) {
                const archer = event.type === "arrow";
                const direction = Math.sign(event.x - event.fromX);
                strikes.set(event.actorId, { time, motion: direction * (archer ? -4 : 12) });
                if (archer) {
                    traces.push({ ...event, time, duration: ARROW_DURATION });
                } else {
                    return;
                }
            } else if (event.type === "spire-shot") {
                traces.push({ ...event, time, duration: BEAM_DURATION });
            } else {
                return;
            }
        },
        lunge(actor, time) {
            const strike = strikes.get(actor.id);
            if (strike === undefined) {
                return 0;
            } else {
                const progress = Math.min(1, (time - strike.time) / STRIKE_DURATION);
                return strike.motion * Math.sin(Math.PI * Math.sqrt(progress));
            }
        },
        draw(context, ground, time, visible) {
            for (const [actor, strike] of strikes) {
                if (time - strike.time >= STRIKE_DURATION) {
                    strikes.delete(actor);
                } else {
                    continue;
                }
            }
            traces = traces.filter((trace) => time - trace.time < trace.duration);
            for (const trace of traces) {
                if (visible(trace.x) || visible(trace.fromX)) {
                    drawTrace(context, ground, trace, (time - trace.time) / trace.duration);
                } else {
                    continue;
                }
            }
        },
        clear() {
            strikes.clear();
            traces = [];
        },
    };
}

function drawTrace(context, ground, trace, progress) {
    context.save();
    if (trace.type === "arrow") {
        const tail = Math.max(0, progress - 0.27);
        const distance = trace.x - trace.fromX;
        const arrowHeight = (fraction) => ground - 52 + fraction * 19 - Math.sin(fraction * Math.PI) * 21;
        context.strokeStyle = "#e3c898";
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(trace.fromX + distance * tail, arrowHeight(tail));
        context.lineTo(trace.fromX + distance * progress, arrowHeight(progress));
        context.stroke();
    } else {
        const origin = ground - 78 - (trace.level - 1) * 12;
        context.globalAlpha = (1 - progress) * 0.85;
        context.strokeStyle = "#93ffda";
        context.shadowColor = "#8cffd9";
        context.shadowBlur = 10;
        context.lineWidth = 2.6 - progress;
        context.beginPath();
        context.moveTo(trace.fromX, origin);
        context.quadraticCurveTo((trace.fromX + trace.x) / 2, origin - 13, trace.x, ground - 40);
        context.stroke();
    }
    context.restore();
}
