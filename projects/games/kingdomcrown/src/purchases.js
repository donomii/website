export const COIN_FLIGHT_TIME = 0.32;
const COIN_INTERVAL = 0.14;

export function advancePurchase(state, input, readAction, complete) {
    const pending = state.purchase;
    if (pending === null) {
        if (input.interactPressed || input.interactHeld) {
            sendCoin(state, readAction(input.interactTargetId), input.interactPressed);
        } else {
            return;
        }
    } else {
        const action = readAction(pending.targetId);
        const changed = input.interactPressed && input.interactTargetId !== null && input.interactTargetId !== pending.targetId;
        if (changed || action?.action !== pending.action || action.cost !== pending.cost) {
            returnCoins(state);
            if (changed) {
                sendCoin(state, readAction(input.interactTargetId), true);
            } else {
                state.events.push({ type: "purchase-cancelled", targetId: pending.targetId });
            }
        } else if (pending.coins.length === action.cost && state.time >= pending.coins.at(-1) + COIN_FLIGHT_TIME) {
            state.purchase = null;
            complete(action);
            state.events.push({ type: "purchase-complete", targetId: action.targetId, x: action.x });
        } else if (input.interactPressed || input.interactHeld) {
            sendCoin(state, readAction(input.interactTargetId), input.interactPressed);
        } else {
            return;
        }
    }
}

function sendCoin(state, action, tapped) {
    if (action === null || (action.action === "blocked" || action.action === "maxed")) {
        return;
    } else {
        const payment = state.purchase ?? { targetId: action.targetId, action: action.action, cost: action.cost, coins: [] };
        const lastSent = payment.coins.at(-1) ?? -Infinity;
        if (payment.targetId !== action.targetId || payment.coins.length >= payment.cost
            || (!tapped && state.time < lastSent + COIN_INTERVAL)) {
            return;
        } else if (state.dread < 1) {
            if (tapped) {
                state.notice = { text: "Your purse is empty", ttl: 2.2 };
            } else {
                return;
            }
        } else {
            state.purchase = payment;
            state.dread -= 1;
            payment.coins.push(state.time);
            state.events.push({ type: "coin-spent", x: action.x });
        }
    }
}

export function returnCoins(state) {
    if (state.purchase === null) {
        return;
    } else {
        state.dread += state.purchase.coins.length;
        state.purchase = null;
    }
}
