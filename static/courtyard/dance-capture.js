const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const restingHands = () => [[-0.53, 1.29, 0.12], [0.53, 1.29, 0.12]];

export function createDanceCapture() {
    let origin;
    let forwardX = 0;
    let forwardZ = -1;
    let hands = restingHands();
    return (viewer, trackedHands) => {
        if (!viewer) return null;
        const position = viewer.position;
        if (!origin) {
            origin = position;
            // Calibrate on the floor plane. Looking straight up or down leaves
            // no usable horizontal heading, so use the reference-space axes.
            const [x, z] = [-viewer.matrix[8], -viewer.matrix[10]];
            const length = Math.hypot(x, z);
            if (length > 0.001) {
                forwardX = x / length;
                forwardZ = z / length;
            }
        }
        const right = (x, z) => x * -forwardZ + z * forwardX;
        const forward = (x, z) => x * forwardX + z * forwardZ;
        const x = position.x - origin.x;
        const z = position.z - origin.z;
        const rise = clamp(position.y - origin.y, -0.45, 0.55);
        hands = trackedHands.map((hand, index) => {
            if (!hand) return hands[index];
            const dx = hand.x - position.x;
            const dz = hand.z - position.z;
            return [clamp(right(dx, dz), -1, 1), clamp(1.68 + hand.y - origin.y, 0.4, 2.75),
                clamp(forward(dx, dz), -0.3, 0.65)];
        });
        return {
            hip: 0.91 + rise,
            foot: Math.max(0, rise - 0.12),
            bend: 0.15 + Math.max(0, -rise),
            shift: [clamp(right(x, z), -0.65, 0.65), clamp(forward(x, z), -0.65, 0.65)],
            hands,
        };
    };
}
