export function mixPose(a, b, t) {
    const lerp = (from, to) => from + (to - from) * t;
    return {
        hip: lerp(a.hip, b.hip), foot: lerp(a.foot, b.foot), bend: lerp(a.bend, b.bend),
        hands: a.hands.map((hand, index) => hand.map((axis, j) => lerp(axis, b.hands[index][j]))),
    };
}

export function poseAt(samples, time) {
    const next = samples.findIndex(sample => sample.time > time);
    if (next < 0) return samples[samples.length - 1].pose;
    if (next === 0) return samples[0].pose;
    const a = samples[next - 1];
    const b = samples[next];
    return mixPose(a.pose, b.pose, (time - a.time) / (b.time - a.time));
}

function difference(a, b) {
    let error = (a.hip - b.hip) ** 2 + (a.foot - b.foot) ** 2;
    for (let hand = 0; hand < 2; hand++) {
        for (let axis = 0; axis < 3; axis++) error += (a.hands[hand][axis] - b.hands[hand][axis]) ** 2;
    }
    return error;
}

export function learnLoop(samples) {
    if (samples.length < 2) return null;
    const start = samples[0].time;
    const length = samples[samples.length - 1].time - start;
    if (length < 250) return null;
    const interval = 50;
    const uniform = [];
    for (let time = 0; time <= length; time += interval) uniform.push(poseAt(samples, start + time));
    let period = length;
    let repeated = false;
    // Require two full cycles, appreciable movement, and a close match across
    // their entire length. Prefer the shortest acceptable repeated phrase.
    for (let lag = 12; lag * 2 <= uniform.length; lag++) {
        let mismatch = 0;
        let firstVariation = 0;
        let secondVariation = 0;
        for (let i = 0; i < lag; i++) {
            mismatch += difference(uniform[i], uniform[i + lag]);
            firstVariation += difference(uniform[i], uniform[0]);
            secondVariation += difference(uniform[i + lag], uniform[lag]);
        }
        const variation = Math.min(firstVariation, secondVariation);
        if (variation / lag > 0.015 && mismatch < variation * 0.12) {
            period = lag * interval;
            repeated = true;
            break;
        }
    }
    const first = poseAt(samples, start);
    const last = poseAt(samples, start + period);
    const bridge = Math.min(180, period * 0.2);
    return {
        period, repeated,
        pose(elapsed) {
            const phase = elapsed % (period + bridge);
            if (phase < period) return poseAt(samples, start + phase);
            const t = (phase - period) / bridge;
            return mixPose(last, first, t * t * (3 - 2 * t));
        },
    };
}
