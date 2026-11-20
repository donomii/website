import { RIVER_NODE_COUNT } from "./types.js";

// Search a band of neighboring valley floors at each downstream station.
// Backtracking lets an upstream bend reach a lower pass several stations away.
export function buildRiverRoute(settings, heightAt) {
  const columns = 17;
  const radius = settings.islandRadius;
  const step = radius * 1.05 / (RIVER_NODE_COUNT - 1);
  const phase = (settings.seed * 2.399963) % (2 * Math.PI);
  const xPositions = new Float64Array(columns * RIVER_NODE_COUNT);
  const parents = new Uint8Array(xPositions.length);
  const costs = new Float64Array(xPositions.length);
  for (let i = 0; i < RIVER_NODE_COUNT; i += 1) {
    const t = i / (RIVER_NODE_COUNT - 1);
    const z = radius * 0.05 + i * step;
    const guide = radius * (0.23 * Math.sin(phase + 5.4 * t) + 0.10 * Math.sin(phase * 0.7 - 8.2 * t));
    for (let j = 0; j < columns; j += 1) {
      const cell = i * columns + j;
      const offset = (j - 8) / 8;
      const x = (guide + offset * radius * 0.20) * (0.22 + 0.78 * Math.min(1, t * 3));
      xPositions[cell] = x;
      const groundCost = heightAt(x, z, settings) + 0.22 * offset * offset;
      if (i === 0) {
        costs[cell] = groundCost;
      } else {
        let best = Infinity;
        for (let k = Math.max(0, j - 1); k <= Math.min(columns - 1, j + 1); k += 1) {
          const prev = (i - 1) * columns + k;
          const cost = costs[prev] + 0.75 * Math.abs(x - xPositions[prev]);
          if (cost < best) {
            parents[cell] = k;
            best = cost;
          } else {
            continue;
          }
        }
        costs[cell] = best + groundCost;
      }
    }
  }
  const outletCosts = costs.subarray(costs.length - columns);
  let column = outletCosts.indexOf(Math.min(...outletCosts));
  const path = new Float64Array(RIVER_NODE_COUNT);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const cell = i * columns + column;
    path[i] = xPositions[cell];
    column = parents[cell];
  }
  return gradeRiver(path, step, settings, heightAt);
}

function gradeRiver(path, step, settings, heightAt) {
  const nodes = new Float32Array(RIVER_NODE_COUNT * 2);
  const depth = 0.035 + 0.18 * (settings.riverFlow ?? 0);
  let ceiling = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    const x = (path[Math.max(0, i - 1)] + 2 * path[i] + path[Math.min(i + 1, path.length - 1)]) / 4;
    const z = settings.islandRadius * 0.05 + i * step;
    ceiling = Math.min(ceiling - step * 0.024, heightAt(x, z, settings) - depth);
    nodes[2 * i] = x;
    nodes[2 * i + 1] = ceiling;
  }
  return nodes;
}

export function sampleRiverNode(nodes, progress, component) {
  const position = progress * (RIVER_NODE_COUNT - 1);
  const i = Math.min(Math.floor(position), RIVER_NODE_COUNT - 2);
  const fraction = position - i;
  const offset = 2 * i + component;
  return nodes[offset] + (nodes[offset + 2] - nodes[offset]) * fraction;
}
