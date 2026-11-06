export const islands = [
    { name: "Lantern Farm", x: 25, y: 67, soil: 3 },
    { name: "Cinder Shoal", x: 52, y: 30, soil: 2 },
    { name: "Redoubt", x: 79, y: 63, soil: 3 },
];
const prices = { plant: 1, colony: 8, depot: 7, turret: 5, fleet: 4 };
const cropSeconds = 12;

export function newGame() {
    return {
        credits: 6, fleet: 0, raidIn: 38, rivalHull: 12, message: "Plant a crop on Lantern Farm.",
        farms: islands.map(({ soil }, index) => ({
            owner: index === 0, plots: Array(soil).fill(null), turret: 0, depot: false,
        })),
    };
}

function spend(game, amount) {
    if (game.credits < amount) return false;
    game.credits -= amount;
    return true;
}

export function seedPrice(game) {
    return game.credits === 0 && game.farms.every(farm => farm.plots.every(plot => plot === null)) ? 0 : prices.plant;
}

export function act(game, index, command, plot) {
    const farm = game.farms[index];
    if (!farm) return "Select an asteroid.";
    if (command === "colony") {
        if (index !== 1 || farm.owner) return "This asteroid cannot be settled.";
        if (!spend(game, prices.colony)) return "Settlement needs 8 credits.";
        farm.owner = true;
        return "Cinder Shoal is yours. Its plots are ready.";
    }
    if (command === "attack") {
        if (index !== 2 || farm.owner) return "Select the rival asteroid to attack.";
        if (game.fleet === 0) return "Build patrol ships on an owned island first.";
        game.rivalHull = Math.max(0, game.rivalHull - game.fleet * 3);
        game.fleet = Math.max(0, game.fleet - 1);
        if (game.rivalHull === 0) {
            farm.owner = true;
            return "Redoubt captured. The rival raids have ended.";
        }
        return `Raid hit Redoubt. ${game.rivalHull} hull remains. One ship was lost.`;
    }
    if (!farm.owner) return "Settle or capture this asteroid first.";
    if (command === "plant") {
        if (farm.plots[plot] !== null) return "Choose an empty plot.";
        if (!spend(game, seedPrice(game))) return "Seeds cost 1 credit.";
        farm.plots[plot] = cropSeconds;
        return "Crop planted.";
    }
    if (command === "harvest") {
        if (farm.plots[plot] !== 0) return "That crop is still growing.";
        farm.plots[plot] = null;
        game.credits += 4;
        return "Harvest sold for 4 credits.";
    }
    if (command === "depot") {
        if (farm.depot) return "This farm already has a depot.";
        if (!spend(game, prices.depot)) return "A depot costs 7 credits.";
        farm.depot = true;
        return "Depot built. It will harvest and replant crops you start.";
    }
    if (command === "turret") {
        if (farm.turret >= 3) return "This farm has all three turret slots filled.";
        if (!spend(game, prices.turret)) return "A turret costs 5 credits.";
        farm.turret++;
        return "Turret online.";
    }
    if (command === "fleet") {
        if (!spend(game, prices.fleet)) return "A patrol ship costs 4 credits.";
        game.fleet++;
        return "Patrol ship ready. Select Redoubt to launch a raid.";
    }
    return "Unknown command.";
}

function advanceCrops(game) {
    for (const farm of game.farms) {
        farm.plots.forEach((remaining, index) => {
            if (remaining === null) return;
            farm.plots[index] = Math.max(0, remaining - 1);
            if (farm.depot && farm.plots[index] === 0) {
                game.credits += 3;
                farm.plots[index] = cropSeconds;
            }
        });
    }
}

export function advance(game, seconds, offline = false) {
    const duration = Math.max(0, Math.min(Math.floor(seconds), offline ? 300 : 60));
    for (let i = 0; i < duration; i++) {
        advanceCrops(game);
        if (offline || game.rivalHull === 0) continue;
        game.raidIn--;
        if (game.raidIn !== 0) continue;
        game.raidIn = 38;
        const defense = game.farms.reduce((total, farm) => total + farm.turret, 0);
        if (defense >= 2) {
            game.message = "Your turrets repelled a rival raid.";
        } else {
            const loss = Math.min(game.credits, 3 - defense);
            game.credits -= loss;
            game.message = `Rival raiders stole ${loss} credits.`;
        }
    }
}
