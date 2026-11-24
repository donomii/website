const terrain = [
  ["#936b47", "#412a2e"], ["#467b67", "#203d40"], ["#a28a60", "#584638"],
  ["#688b8c", "#364750"], ["#855878", "#463448"], ["#8e7b5b", "#574b34"],
  ["#82719b", "#4d3f5c"], ["#a06152", "#462f3a"], ["#8093a5", "#415569"],
  ["#6c8e5b", "#335648"], ["#967d67", "#453c48"], ["#679896", "#3d536a"],
];

function randomFrom(seed) {
  let value = seed;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function outline(ctx, vertices, scale, offset) {
  ctx.beginPath();
  vertices.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * scale, y * scale + offset);
    else ctx.lineTo(x * scale, y * scale + offset);
  });
  ctx.closePath();
}

function island(ctx, port, index) {
  const random = randomFrom(43863 + index * 7051);
  const [light, dark] = terrain[index % terrain.length];
  const points = Array.from({ length: 22 }, (_, step) => {
    const angle = step * Math.PI * 2 / 22;
    const d = 0.78 + random() * 0.40;
    return [Math.cos(angle) * d * 97, Math.sin(angle) * d * 44];
  });
  ctx.save();
  ctx.translate(port.x, port.y + 15);
  for (const scale of [1.47, 1.29, 1.13]) {
    outline(ctx, points, scale, 2);
    ctx.strokeStyle = `rgba(137, 196, 181, ${(1.65 - scale) * .33})`;
    ctx.stroke();
  }
  outline(ctx, points, 1.02, 6);
  ctx.fillStyle = "#081719";
  ctx.fill();
  const ground = ctx.createLinearGradient(-20, -40, 20, 49);
  ground.addColorStop(0, light);
  ground.addColorStop(1, dark);
  outline(ctx, points, 1, 0);
  ctx.fillStyle = ground;
  ctx.fill();
  ctx.strokeStyle = "#e5b77b80";
  ctx.stroke();
  ctx.clip();
  for (let i = 0; i < 34; i += 1) {
    const x = (random() - .5) * 174;
    const y = (random() - .5) * 69;
    const height = 4 + random() * 19;
    ctx.beginPath();
    ctx.moveTo(x - height * .65, y + height * .56);
    ctx.lineTo(x, y - height);
    ctx.lineTo(x + height * .62, y + height * .56);
    ctx.strokeStyle = i % 3 ? "#fff2c62b" : "#080f1752";
    ctx.stroke();
  }
  ctx.restore();
}

function course(ctx, from, to, position) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y + 11);
  ctx.quadraticCurveTo((from.x + to.x) / 2 + position, (from.y + to.y) / 2 - position, to.x, to.y + 11);
  ctx.stroke();
}

export function paintChart(ctx, world, ports) {
  const { width, height } = world;
  const sea = ctx.createRadialGradient(width * .52, height * .42, 45, width * .48, height * .48, width * .60);
  sea.addColorStop(0, "#2a4e50");
  sea.addColorStop(.62, "#19383f");
  sea.addColorStop(1, "#10252d");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, width, height);
  const random = randomFrom(619);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#8eb2a316";
  ctx.beginPath();
  for (let x = 30; x < width; x += 48) {
    ctx.moveTo(x, 20);
    ctx.lineTo(x, height - 20);
  }
  for (let y = 26; y < height; y += 48) {
    ctx.moveTo(21, y);
    ctx.lineTo(width - 21, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "#d1b37862";
  ctx.strokeRect(13, 12, width - 26, height - 24);
  ctx.strokeStyle = "#d1b37832";
  ctx.strokeRect(19, 18, width - 38, height - 36);

  for (let i = 0; i < 800; i += 1) {
    const x = 22 + random() * (width - 44);
    const y = 22 + random() * (height - 44);
    ctx.fillStyle = i % 3 ? "#9cc0ac38" : "#08181b63";
    ctx.fillRect(x, y, 1 + random() * 4, 1);
  }

  ctx.strokeStyle = "#e5bc74a0";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([2, 6]);
  ports.forEach((port, i) => {
    if (i % 4 !== 3 && ports[i + 1]) course(ctx, port, ports[i + 1], i % 2 ? 24 : -27);
    if (ports[i + 4]) course(ctx, port, ports[i + 4], i % 2 ? -24 : 24);
  });
  ctx.setLineDash([]);
  ports.forEach((port, i) => island(ctx, port, i));

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.strokeStyle = "#e7c3815c";
  ctx.fillStyle = "#e7c3816c";
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -29);
    ctx.lineTo(-5, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(5, -4);
    ctx.closePath();
    ctx.stroke();
    if (i % 2 === 0) ctx.fill();
  }
  ctx.restore();
}

export function paintAirship(ctx, x, y, facing, scale, now) {
  ctx.save();
  ctx.translate(x, y - 35 * scale);
  ctx.scale(facing * scale, scale);
  ctx.shadowColor = "#0009";
  ctx.shadowBlur = 12 * scale;
  ctx.shadowOffsetY = 8 * scale;
  ctx.translate(0, Math.sin(now / 400) * 2.2);
  ctx.fillStyle = "#59432d";
  ctx.strokeStyle = "#ffe4a9";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-30, -3);
  ctx.lineTo(-46, -12);
  ctx.lineTo(-43, 4);
  ctx.lineTo(-30, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const brass = ctx.createLinearGradient(0, -14, 0, 15);
  brass.addColorStop(0, "#fff6d0");
  brass.addColorStop(.42, "#edbd6d");
  brass.addColorStop(1, "#946043");
  ctx.fillStyle = brass;
  ctx.beginPath();
  ctx.moveTo(-38, 0);
  ctx.bezierCurveTo(-38, -17, 18, -23, 39, -3);
  ctx.bezierCurveTo(46, 10, 10, 20, -18, 13);
  ctx.quadraticCurveTo(-36, 10, -38, 0);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "#795437a8";
  for (const bend of [-8, 0, 8]) {
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.quadraticCurveTo(1, bend * 2, 38, -2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-12, 12);
  ctx.lineTo(-9, 21);
  ctx.lineTo(14, 21);
  ctx.lineTo(22, 12);
  ctx.strokeStyle = "#fce0a0";
  ctx.stroke();
  ctx.fillStyle = "#624b30";
  ctx.beginPath();
  ctx.moveTo(-12, 19);
  ctx.lineTo(19, 19);
  ctx.lineTo(12, 26);
  ctx.lineTo(-7, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
