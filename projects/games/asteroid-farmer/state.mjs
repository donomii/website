import { advance, islands, newGame } from "./game.mjs";

export const saveKey = "asteroid-farmer-v1";

export function validSave(save) {
    const state = save?.game;
    return Number.isFinite(save?.time) && save.time >= 0 && Boolean(state) &&
        Number.isSafeInteger(state.credits) && state.credits >= 0 &&
        Number.isSafeInteger(state.fleet) && state.fleet >= 0 &&
        Number.isInteger(state.rivalHull) && state.rivalHull >= 0 && state.rivalHull <= 12 &&
        Number.isInteger(state.raidIn) && state.raidIn >= 1 && state.raidIn <= 38 &&
        typeof state.message === "string" && Array.isArray(state.farms) && state.farms.length === islands.length &&
        state.farms.every((farm, i) => farm && typeof farm.owner === "boolean" &&
            typeof farm.depot === "boolean" && Number.isInteger(farm.turret) && farm.turret >= 0 && farm.turret <= 3 &&
            Array.isArray(farm.plots) && farm.plots.length === islands[i].soil &&
            farm.plots.every(crop => crop === null || (Number.isInteger(crop) && crop >= 0 && crop <= 12)));
}

export function loadGame(storage, now) {
    try {
        const raw = storage.getItem(saveKey);
        if (raw === null) {
            return { game: newGame(), saveEnabled: true };
        } else {
            const save = JSON.parse(raw);
            if (!validSave(save)) throw new Error("Invalid outpost save");
            advance(save.game, (now - save.time) / 1000, true);
            return { game: save.game, saveEnabled: true };
        }
    } catch (error) {
        const game = newGame();
        game.message = "Saved outpost could not be opened. This session will play without saving.";
        return { game, saveEnabled: false, warning: error.message };
    }
}

export function saveGame(storage, game, time) {
    const save = { game, time };
    if (!validSave(save)) {
        throw new Error("Cannot save outpost: credits, ships, raid countdown or farm data is invalid.");
    } else {
        storage.setItem(saveKey, JSON.stringify(save));
    }
}
