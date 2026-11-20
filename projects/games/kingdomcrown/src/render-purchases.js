import { COIN_FLIGHT_TIME } from "./purchases.js";

export function drawPurchaseCoins(context, payment, time, anchor, purse, ground) {
    const perRow = 9;
    const rows = Math.ceil(payment.cost / perRow);
    const gap = 14;
    for (let index = 0; index < payment.cost; index += 1) {
        const row = Math.floor(index / perRow);
        const column = index % perRow;
        const rowCount = Math.min(perRow, payment.cost - row * perRow);
        const x = anchor.x + (column - (rowCount - 1) / 2) * gap;
        const y = ground - anchor.height - 19 - (rows - row - 1) * gap;
        const sentAt = payment.coins[index];
        const progress = sentAt === undefined ? 0 : Math.min(1, (time - sentAt) / COIN_FLIGHT_TIME);
        drawSlot(context, x, y);
        if (progress === 1) {
            drawCoin(context, x, y, 1);
        } else if (sentAt !== undefined) {
            const travel = progress * (2 - progress);
            const arc = Math.sin(progress * Math.PI) * 36;
            const fromY = ground - purse.aboveTrail;
            drawCoin(context, purse.x + (x - purse.x) * travel, fromY + (y - fromY) * travel - arc,
                0.46 + 0.54 * Math.abs(Math.cos(progress * Math.PI * 3)));
        } else {
            continue;
        }
    }
}

function drawSlot(context, x, y) {
    context.beginPath();
    context.arc(x, y, 5.5, 0, Math.PI * 2);
    context.fillStyle = "rgba(15, 19, 23, 0.72)";
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(240, 206, 144, 0.72)";
    context.stroke();
}

function drawCoin(context, x, y, width) {
    context.beginPath();
    context.ellipse(x, y, 5.7 * width, 5.7, 0, 0, Math.PI * 2);
    context.fillStyle = "#e4ad58";
    context.fill();
    context.lineWidth = 1.25;
    context.strokeStyle = "#fff0bc";
    context.stroke();
    context.fillStyle = "#92622e";
    context.fillRect(x - width, y - 2.6, width * 2, 5.2);
}
