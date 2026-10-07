// Shared gameplay constants and stage contracts.
export const CONTROLLER = Object.freeze({deadzone:0.45, lay:0, push:1, retry:3, start:9, left:14, right:15}); // Standard gamepad buttons; stick must cross deadzone, then return to centre for another lane change.
export const RULES = Object.freeze({
    cells: 64, lanes: 3, speed: 3.5, stamina: 95, drain: 1,
    toppleDelay: 0.085, trickDelay: 1.1, hitCost: 9, resetCost: 12,
    noticeDuration: 3,
    fallDuration: 0.22, fallenHoldDuration: 0.18, // Fall animation, then time resting flat before cleanup (seconds).
    heal: 26, laneNames: ["OUTSIDE", "MIDDLE", "INSIDE"]
});
export const STAGES = [
    {
        name: "PHAT TONY’S CASINO", place: "STAGE 1",
        mover: {cell: 10, from: 0, to: 1, period: 3, name: "ROLLING CHIP"},
        pace: 1, lesson: "LEARN · Lay over switches, dodge stacks, connect red rings.",
        description: "Set off a chain reaction across the casino. Lay trails over the four switches, then loop around and knock them down.",
        palette: ["#224e30", "#a62a50", "#bfa954"], theme: "casino",
        tricks: [
            {cell: 12, lane: 1, hint: 17, nextLane: 0, name: "DICE", action: "The dice tumble into the next trail!"},
            {cell: 28, lane: 0, hint: 33, nextLane: 2, name: "ROULETTE", action: "The roulette ball starts the next chain!"},
            {cell: 44, lane: 2, hint: 49, nextLane: 1, name: "HOUSE OF CARDS", action: "The house of cards comes down!"},
            {cell: 60, lane: 1, hint: null, nextLane: null, name: "JACKPOT", action: "Jackpot! No one can stop Mr. Domino!"}
        ],
        hazards: [{cell: 6, lane: 1}, {cell: 6, lane: 0}, {cell: 7, lane: 1}, {cell: 23, lane: 0}, {cell: 23, lane: 1}, {cell: 40, lane: 2}, {cell: 55, lane: 1}],
        resets: [{cell: 53, lane: 0}], health: [{cell: 6, lane: 2}]
    },
    {
        name: "SHOP ’TIL YOU DROP", place: "STAGE 2",
        mover: {cell: 26, from: 1, to: 2, period: 4, name: "SHOPPING CART"},
        pace: 1.08, lesson: "WEAVE · Faster running and tighter obstacle routes. Plan lane changes early.",
        description: "Follow the numbered switches and red continuation circles. Mind the spilled milk.",
        palette: ["#cedbbb", "#648b73", "#ddac50"], theme: "shop",
        tricks: [
            {cell: 12, lane: 1, hint: 18, nextLane: 0, name: "CAN DO", action: "The cans tumble into the scales."},
            {cell: 28, lane: 0, hint: 34, nextLane: 2, name: "WEIGH TO GO", action: "The scales fling an orange across the shop."},
            {cell: 44, lane: 2, hint: 50, nextLane: 1, name: "CART ATTACK", action: "The shopping cart rolls into the till."},
            {cell: 60, lane: 1, hint: null, nextLane: null, name: "CASH OUT", action: "Today's takings: absolute chaos."}
        ],
        hazards: [{cell: 5, lane: 1}, {cell: 6, lane: 1}, {cell: 22, lane: 0}, {cell: 22, lane: 1}, {cell: 36, lane: 2}, {cell: 39, lane: 2}, {cell: 41, lane: 0}, {cell: 55, lane: 1}],
        resets: [{cell: 30, lane: 1}], health: [{cell: 7, lane: 0}]
    },
    {
        name: "GRANDPA’S IN THE HOUSE", place: "STAGE 3",
        mover: {cell: 42, from: 0, to: 1, period: 2.5, name: "ROAMING CAT"},
        pace: 1.16, lesson: "MASTER · Fastest running, extra resets, and fewer safe lanes.",
        description: "Four tricks. Three lanes. One continuous catastrophe.",
        palette: ["#a49f72", "#4c6c46", "#965644"], theme: "home",
        tricks: [
            {cell: 12, lane: 2, hint: 18, nextLane: 0, name: "TEA TIME", action: "The cup tips. The cat wakes."},
            {cell: 28, lane: 0, hint: 34, nextLane: 1, name: "CAT", action: "The cat leaps onto the television."},
            {cell: 44, lane: 1, hint: 50, nextLane: 2, name: "TELEVISION", action: "The television startles Grandpa."},
            {cell: 60, lane: 2, hint: null, nextLane: null, name: "GRANDPA", action: "Grandpa wakes up with a start!"}
        ],
        hazards: [{cell: 7, lane: 0}, {cell: 8, lane: 2}, {cell: 19, lane: 0}, {cell: 20, lane: 1}, {cell: 24, lane: 0}, {cell: 24, lane: 2}, {cell: 38, lane: 0}, {cell: 39, lane: 1}, {cell: 42, lane: 1}, {cell: 55, lane: 1}, {cell: 56, lane: 2}],
        resets: [{cell: 31, lane: 2}, {cell: 47, lane: 0}], health: [{cell: 4, lane: 1}]
    }
];
