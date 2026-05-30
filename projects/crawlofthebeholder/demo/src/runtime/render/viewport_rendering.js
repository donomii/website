(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installViewportRendering = function (context) {
    with (context) {
      function imageEntry(src) {
        const existing = imageCache.get(src);
        if (existing) return existing;

        const image = new Image();
        const entry = { image, ready: false, failed: false };
        image.onload = () => {
          entry.ready = true;
          renderViewport();
        };
        image.onerror = () => {
          entry.failed = true;
          renderViewport();
        };
        image.src = src;
        imageCache.set(src, entry);
        return entry;
      }

      function cellHash(x, y, salt = 0) {
        let value = Math.imul(x + 32768, 374761393) ^ Math.imul(y + 32768, 668265263) ^ Math.imul(state.floorIndex + 1, -2048144777) ^ salt;
        value = Math.imul(value ^ (value >>> 13), 1274126177);
        return (value ^ (value >>> 16)) >>> 0;
      }

      function assetValues(prefix) {
        const assets = currentAssets();
        return Object.keys(assets).filter((key) => key.startsWith(prefix)).sort().map((key) => assets[key]).filter(Boolean);
      }

      function themedAsset(baseKey, altPrefix, cell, salt = 0) {
        const assets = currentAssets();
        const choices = [assets[baseKey], ...assetValues(altPrefix)].filter(Boolean);
        if (choices.length === 0) return null;
        return choices[cellHash(cell.x, cell.y, salt) % choices.length] || assets[baseKey];
      }

      function floorTexture(cell) {
        const terrain = terrainAt(cell.x, cell.y);
        const normalFloor = themedAsset("floor", "floorAlt", cell, 11);
        if (terrain === "deep-water") {
          return themedAsset("deepWater", "deepWaterAlt", cell, 29) || themedAsset("water", "waterAlt", cell, 29) || normalFloor;
        }
        if (terrain === "water") return themedAsset("water", "waterAlt", cell, 29) || normalFloor;
        if (terrain === "lava") return themedAsset("lava", "lavaAlt", cell, 29) || normalFloor;
        return normalFloor;
      }

      function floorFallback(cell) {
        const terrain = terrainAt(cell.x, cell.y);
        if (terrain === "deep-water") return "#0b1d2c";
        if (terrain === "water") return "#173a3f";
        if (terrain === "lava") return "#612610";
        return "#211c17";
      }

      function accentAsset(prefix, cell, salt, rarity) {
        const choices = assetValues(prefix);
        if (choices.length === 0) return null;
        const hash = cellHash(cell.x, cell.y, salt);
        if (hash % rarity !== 0) return null;
        return choices[Math.floor(hash / rarity) % choices.length];
      }

      function floorPoints(depth) {
        const outer = viewFrames[depth - 1];
        const inner = viewFrames[depth];
        return [[inner.left, inner.bottom], [inner.right, inner.bottom], [outer.right, outer.bottom], [outer.left, outer.bottom]];
      }

      function lerp(a, b, amount) {
        return a + (b - a) * amount;
      }

      function lerpPoint(a, b, amount) {
        return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount)];
      }

      function projectedPoint(depth, lateral, verticalEdge) {
        const frame = frameAt(depth);
        const center = (frame.left + frame.right) / 2;
        const width = frame.right - frame.left;
        return [center + lateral * width, verticalEdge === "top" ? frame.top : frame.bottom];
      }

      function frameAt(depth) {
        if (viewFrames[depth]) return viewFrames[depth];
        const last = viewFrames[viewFrames.length - 1];
        const shrink = Math.pow(0.62, depth - viewFrames.length + 1);
        const width = Math.max(1.6, (last.right - last.left) * shrink);
        const height = Math.max(2.2, (last.bottom - last.top) * shrink);
        return { left: 50 - width / 2, top: 50 - height / 2, right: 50 + width / 2, bottom: 50 + height / 2 };
      }

      function geometryAt(depth) {
        if (geometry[depth]) return geometry[depth];
        const frame = frameAt(depth);
        const width = frame.right - frame.left;
        const height = frame.bottom - frame.top;
        return {
          sprite: [50 - width * 0.25, 50 - height * 0.5, width * 0.5, height * 0.75],
          tile: Math.max(12, Math.round(geometry[4].tile * Math.pow(0.74, depth - 4))),
          light: Math.max(0.16, geometry[4].light * Math.pow(0.82, depth - 4))
        };
      }

      function floorSegmentPoints(depth, offset = 0) {
        return [
          projectedPoint(depth, offset - 0.5, "bottom"),
          projectedPoint(depth, offset + 0.5, "bottom"),
          projectedPoint(depth - 1, offset + 0.5, "bottom"),
          projectedPoint(depth - 1, offset - 0.5, "bottom")
        ];
      }

      function ceilingSegmentPoints(depth, offset = 0) {
        return [
          projectedPoint(depth - 1, offset - 0.5, "top"),
          projectedPoint(depth - 1, offset + 0.5, "top"),
          projectedPoint(depth, offset + 0.5, "top"),
          projectedPoint(depth, offset - 0.5, "top")
        ];
      }

      function frontFacePoints(depth, offset = 0) {
        return [
          projectedPoint(depth, offset - 0.5, "top"),
          projectedPoint(depth, offset + 0.5, "top"),
          projectedPoint(depth, offset + 0.5, "bottom"),
          projectedPoint(depth, offset - 0.5, "bottom")
        ];
      }

      function sideFacePoints(depth, boundary) {
        return [
          projectedPoint(depth - 1, boundary, "top"),
          projectedPoint(depth, boundary, "top"),
          projectedPoint(depth, boundary, "bottom"),
          projectedPoint(depth - 1, boundary, "bottom")
        ];
      }

      function nearEdgeDepth(depth) {
        return depth - 1;
      }

      function floorDecalPoints(depth, footprint, offset = 0) {
        return quadDecalPoints(floorSegmentPoints(depth, offset), footprint);
      }

      function pointInsideQuad(points, u, v) {
        const top = lerpPoint(points[0], points[1], u);
        const bottom = lerpPoint(points[3], points[2], u);
        return lerpPoint(top, bottom, v);
      }

      function quadDecalPoints(points, footprint) {
        return [
          pointInsideQuad(points, footprint.left, footprint.top),
          pointInsideQuad(points, footprint.right, footprint.top),
          pointInsideQuad(points, footprint.right, footprint.bottom),
          pointInsideQuad(points, footprint.left, footprint.bottom)
        ];
      }

      function wallDecalPoints(depth, footprint, offset = 0) {
        return quadDecalPoints(frontFacePoints(depth, offset), footprint);
      }

      function ceilingPoints(depth) {
        const outer = viewFrames[depth - 1];
        const inner = viewFrames[depth];
        return [[outer.left, outer.top], [outer.right, outer.top], [inner.right, inner.top], [inner.left, inner.top]];
      }

      function leftWallPoints(depth) {
        const outer = viewFrames[depth - 1];
        const inner = viewFrames[depth];
        return [[outer.left, outer.top], [inner.left, inner.top], [inner.left, inner.bottom], [outer.left, outer.bottom]];
      }

      function rightWallPoints(depth) {
        const outer = viewFrames[depth - 1];
        const inner = viewFrames[depth];
        return [[inner.right, inner.top], [outer.right, outer.top], [outer.right, outer.bottom], [inner.right, inner.bottom]];
      }

      function ensureViewportCanvas() {
        if (!viewportCanvas) {
          viewportCanvas = document.createElement("canvas");
          viewportCanvas.className = "viewport-canvas";
          viewportContext = viewportCanvas.getContext("2d");
          els.viewport.replaceChildren(viewportCanvas);
        }

        const bounds = els.viewport.getBoundingClientRect();
        const width = Math.max(1, Math.floor(bounds.width));
        const height = Math.max(1, Math.floor(bounds.height));
        const scale = window.devicePixelRatio || 1;
        const canvasWidth = Math.floor(width * scale);
        const canvasHeight = Math.floor(height * scale);

        if (viewportCanvas.width !== canvasWidth || viewportCanvas.height !== canvasHeight) {
          viewportCanvas.width = canvasWidth;
          viewportCanvas.height = canvasHeight;
          viewportCanvas.style.width = `${width}px`;
          viewportCanvas.style.height = `${height}px`;
        }

        viewportContext.setTransform(scale, 0, 0, scale, 0, 0);
        return { context: viewportContext, width, height };
      }

      function pctPoint(point, width, height) {
        return { x: (point[0] / 100) * width, y: (point[1] / 100) * height };
      }

      function pctQuad(points, width, height) {
        return points.map((point) => pctPoint(point, width, height));
      }

      function pctRect(bounds, width, height) {
        return {
          x: (bounds[0] / 100) * width,
          y: (bounds[1] / 100) * height,
          width: (bounds[2] / 100) * width,
          height: (bounds[3] / 100) * height
        };
      }

      function drawQuadPath(context, points) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
        context.closePath();
      }

      function shadeQuad(context, points, light) {
        drawQuadPath(context, points);
        context.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - light)})`;
        context.fill();
      }

      function fillQuad(context, points, color, light) {
        drawQuadPath(context, points);
        context.fillStyle = color;
        context.fill();
        shadeQuad(context, points, light);
      }

      function strokeQuad(context, points, color, width = 1) {
        context.save();
        drawQuadPath(context, points);
        context.lineWidth = width;
        context.strokeStyle = color;
        context.stroke();
        context.restore();
      }

      function drawSurfaceLine(context, surfacePoints, width, height, from, to, color, lineWidth = 1) {
        const start = pctPoint(pointInsideQuad(surfacePoints, from.u, from.v), width, height);
        const end = pctPoint(pointInsideQuad(surfacePoints, to.u, to.v), width, height);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.lineWidth = lineWidth;
        context.strokeStyle = color;
        context.stroke();
      }

      function drawWallRelief(context, width, height, depth, cell, surfacePoints, side = false) {
        const data = geometryAt(depth);
        const shadow = `rgba(0, 0, 0, ${Math.max(0.12, 0.44 - data.light * 0.18)})`;
        const shine = `rgba(240, 215, 154, ${Math.max(0.03, data.light * 0.07)})`;
        const crack = `rgba(0, 0, 0, ${Math.max(0.16, 0.52 - data.light * 0.22)})`;
        const lineWidth = Math.max(0.45, width * 0.0009);
        const baseHash = cellHash(cell.x, cell.y, side ? 151 : 137);

        context.save();
        for (const v of [0.24, 0.5, 0.76]) {
          drawSurfaceLine(context, surfacePoints, width, height, { u: 0.08, v }, { u: 0.92, v }, shadow, lineWidth);
          drawSurfaceLine(context, surfacePoints, width, height, { u: 0.08, v: Math.min(0.96, v + 0.012) }, { u: 0.92, v: Math.min(0.96, v + 0.012) }, shine, lineWidth);
        }

        const split = 0.32 + ((baseHash % 37) / 100);
        drawSurfaceLine(context, surfacePoints, width, height, { u: split, v: 0.08 }, { u: split + 0.04, v: 0.92 }, crack, lineWidth);
        if ((baseHash >>> 5) % 3 === 0) {
          const elbow = 0.48 + ((baseHash >>> 9) % 16) / 100;
          drawSurfaceLine(context, surfacePoints, width, height, { u: elbow, v: 0.2 }, { u: elbow - 0.08, v: 0.56 }, crack, lineWidth * 0.9);
        }
        context.restore();
      }

      function scanlineIntersections(points, y) {
        const xs = [];
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          if (a.y === b.y) continue;
          const minY = Math.min(a.y, b.y);
          const maxY = Math.max(a.y, b.y);
          if (y < minY || y >= maxY) continue;
          const t = (y - a.y) / (b.y - a.y);
          xs.push(a.x + (b.x - a.x) * t);
        }
        xs.sort((a, b) => a - b);
        return xs;
      }

      function verticalIntersections(points, x) {
        const ys = [];
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          if (a.x === b.x) continue;
          const minX = Math.min(a.x, b.x);
          const maxX = Math.max(a.x, b.x);
          if (x < minX || x >= maxX) continue;
          const t = (x - a.x) / (b.x - a.x);
          ys.push(a.y + (b.y - a.y) * t);
        }
        ys.sort((a, b) => a - b);
        return ys;
      }

      function drawHorizontalMappedQuad(context, texture, points, depth, light, fallback) {
        const entry = imageEntry(texture);
        const minY = Math.floor(Math.min(...points.map((point) => point.y)));
        const maxY = Math.ceil(Math.max(...points.map((point) => point.y)));
        const tileSize = geometryAt(depth).tile;

        if (!entry.ready) {
          fillQuad(context, points, fallback, light);
          return;
        }

        context.save();
        drawQuadPath(context, points);
        context.clip();

        for (let y = minY; y <= maxY; y += 1) {
          const xs = scanlineIntersections(points, y + 0.5);
          if (xs.length < 2) continue;

          const leftX = Math.floor(xs[0]);
          const rightX = Math.ceil(xs[xs.length - 1]);
          const textureY = Math.floor(((y - minY) / Math.max(1, maxY - minY)) * entry.image.height) % entry.image.height;

          for (let x = leftX; x < rightX; x += tileSize) {
            const drawnWidth = Math.min(tileSize, rightX - x);
            context.drawImage(entry.image, 0, textureY, entry.image.width, 1, x, y, drawnWidth, 1);
          }
        }

        context.restore();
        shadeQuad(context, points, light);
      }

      function boundsForPoints(points) {
        const left = Math.min(...points.map((point) => point.x));
        const right = Math.max(...points.map((point) => point.x));
        const top = Math.min(...points.map((point) => point.y));
        const bottom = Math.max(...points.map((point) => point.y));
        return { x: left, y: top, width: right - left, height: bottom - top };
      }

      function drawImageMappedQuad(context, texture, points, light, fallback, options = {}) {
        const entry = imageEntry(texture);
        const minY = Math.floor(Math.min(...points.map((point) => point.y)));
        const maxY = Math.ceil(Math.max(...points.map((point) => point.y)));
        const bounds = boundsForPoints(points);

        if (options.shadow !== false) {
          context.save();
          drawQuadPath(context, points.map((point) => ({ x: point.x, y: point.y + 3 })));
          context.fillStyle = "rgba(0, 0, 0, 0.42)";
          context.fill();
          context.restore();
        }

        if (!entry.ready) {
          if (options.shadow === false) return bounds;
          fillQuad(context, points, fallback, light);
          return bounds;
        }

        context.save();
        drawQuadPath(context, points);
        context.clip();
        context.imageSmoothingEnabled = false;
        if (options.composite) context.globalCompositeOperation = options.composite;
        if (options.alpha !== undefined) context.globalAlpha = options.alpha;

        for (let y = minY; y <= maxY; y += 1) {
          const xs = scanlineIntersections(points, y + 0.5);
          if (xs.length < 2) continue;

          const leftX = Math.floor(xs[0]);
          const rightX = Math.ceil(xs[xs.length - 1]);
          const sourceY = Math.max(0, Math.min(entry.image.height - 1, Math.floor(((y - minY) / Math.max(1, maxY - minY)) * entry.image.height)));
          context.drawImage(entry.image, 0, sourceY, entry.image.width, 1, leftX, y, Math.max(1, rightX - leftX), 1);
        }

        context.restore();
        if (!options.noShade) shadeQuad(context, points, light);
        return bounds;
      }

      function drawVerticalMappedQuad(context, texture, points, depth, light, fallback) {
        const entry = imageEntry(texture);
        const minX = Math.floor(Math.min(...points.map((point) => point.x)));
        const maxX = Math.ceil(Math.max(...points.map((point) => point.x)));

        if (!entry.ready) {
          fillQuad(context, points, fallback, light);
          return;
        }

        context.save();
        drawQuadPath(context, points);
        context.clip();

        for (let x = minX; x <= maxX; x += 1) {
          const ys = verticalIntersections(points, x + 0.5);
          if (ys.length < 2) continue;

          const topY = ys[0];
          const bottomY = ys[ys.length - 1];
          const textureX = Math.floor(((x - minX) / Math.max(1, maxX - minX)) * entry.image.width) % entry.image.width;
          context.drawImage(entry.image, textureX, 0, 1, entry.image.height, x, topY, 1, bottomY - topY);
        }

        context.restore();
        shadeQuad(context, points, light);
      }

      function drawTiledRect(context, texture, rect, tileSize, light, fallback) {
        const entry = imageEntry(texture);

        context.save();
        context.beginPath();
        context.rect(rect.x, rect.y, rect.width, rect.height);
        context.clip();

        if (entry.ready) {
          for (let y = rect.y; y < rect.y + rect.height; y += tileSize) {
            for (let x = rect.x; x < rect.x + rect.width; x += tileSize) {
              context.drawImage(entry.image, x, y, tileSize, tileSize);
            }
          }
        } else {
          context.fillStyle = fallback;
          context.fillRect(rect.x, rect.y, rect.width, rect.height);
        }

        context.restore();
        context.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - light)})`;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }

      function drawDoorRect(context, texture, rect, light) {
        const entry = imageEntry(texture);
        context.save();
        context.fillStyle = "#281d13";
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        if (entry.ready) context.drawImage(entry.image, rect.x, rect.y, rect.width, rect.height);
        context.restore();
        context.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - light)})`;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }

      function drawSprite(context, source, bounds, width, height, options = {}) {
        const entry = imageEntry(source);
        if (!entry.ready) return null;
        const rect = pctRect(bounds, width, height);
        context.save();
        context.shadowColor = "rgba(0, 0, 0, 0.65)";
        context.shadowBlur = 18;
        context.shadowOffsetY = 12;
        context.imageSmoothingEnabled = false;
        if (options.alpha !== undefined) context.globalAlpha = options.alpha;
        if (options.filter) context.filter = options.filter;
        context.drawImage(entry.image, rect.x, rect.y, rect.width, rect.height);
        context.restore();
        return rect;
      }

      function drawHealthBar(context, monster, rect) {
        const width = Math.max(18, rect.width * 0.72);
        const x = rect.x + (rect.width - width) / 2;
        const y = Math.max(8, rect.y - 8);
        context.fillStyle = "rgba(0, 0, 0, 0.66)";
        context.fillRect(x, y, width, 5);
        context.fillStyle = "#d86452";
        context.fillRect(x + 1, y + 1, (width - 2) * (monster.hp / monster.maxHp), 3);
      }

      function drawRangedCue(context, monster, rect) {
        if (!monster.ranged || state.silenceTurns > 0) return;
        const x = rect.x + rect.width / 2;
        const y = Math.max(12, rect.y - 18);
        context.save();
        context.translate(x, y);
        context.rotate(Math.PI / 4);
        context.fillStyle = "rgba(122, 194, 210, 0.88)";
        context.fillRect(-4, -4, 8, 8);
        context.restore();
      }

      function drawMonsterStatusCue(context, monster, rect) {
        if (!monster.immolationTurns || monster.immolationTurns <= 0) return;
        const x = rect.x + rect.width * 0.82;
        const y = Math.max(12, rect.y + rect.height * 0.14);
        context.save();
        context.beginPath();
        context.arc(x, y, 7, 0, Math.PI * 2);
        context.fillStyle = "rgba(241, 107, 43, 0.86)";
        context.fill();
        context.fillStyle = "rgba(255, 221, 113, 0.9)";
        context.fillRect(x - 2, y - 5, 4, 10);
        context.restore();
      }

      function drawLabel(context, text, rect) {
        context.save();
        context.font = "12px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const label = text.length > 18 ? `${text.slice(0, 17)}...` : text;
        const metrics = context.measureText(label);
        const width = metrics.width + 12;
        const height = 18;
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height + 13;
        context.fillStyle = "rgba(10, 9, 8, 0.78)";
        context.fillRect(x - width / 2, y - height / 2, width, height);
        context.fillStyle = "#f1d07a";
        context.fillText(label, x, y);
        context.restore();
      }

      function drawViewportHaze(context, width, height) {
        const radial = context.createRadialGradient(width * 0.5, height * 0.55, width * 0.08, width * 0.5, height * 0.55, width * 0.72);
        radial.addColorStop(0, "rgba(0, 0, 0, 0)");
        radial.addColorStop(0.56, "rgba(0, 0, 0, 0.18)");
        radial.addColorStop(1, "rgba(0, 0, 0, 0.76)");
        context.fillStyle = radial;
        context.fillRect(0, 0, width, height);

        const side = context.createLinearGradient(0, 0, width, 0);
        side.addColorStop(0, "rgba(0, 0, 0, 0.48)");
        side.addColorStop(0.23, "rgba(0, 0, 0, 0)");
        side.addColorStop(0.77, "rgba(0, 0, 0, 0)");
        side.addColorStop(1, "rgba(0, 0, 0, 0.48)");
        context.fillStyle = side;
        context.fillRect(0, 0, width, height);

        const torch = context.createRadialGradient(width * 0.5, height * 0.86, width * 0.04, width * 0.5, height * 0.86, width * 0.58);
        torch.addColorStop(0, "rgba(214, 150, 66, 0.16)");
        torch.addColorStop(0.48, "rgba(83, 111, 86, 0.03)");
        torch.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = torch;
        context.fillRect(0, 0, width, height);
      }

      function rgba(color, alpha) {
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
      }

      function branchAtmosphereProfile() {
        const floor = currentFloor();
        if (floor.id.startsWith("Swamp:")) return { color: [66, 130, 82], edgeAlpha: 0.22, veilAlpha: 0.1, glowAlpha: 0.08, glowY: 0.64 };
        if (floor.id.startsWith("Shoals:")) return { color: [68, 151, 172], edgeAlpha: 0.16, veilAlpha: 0.08, glowAlpha: 0.09, glowY: 0.72 };
        if (floor.id.startsWith("Slime:")) return { color: [128, 196, 74], edgeAlpha: 0.2, veilAlpha: 0.09, glowAlpha: 0.1, glowY: 0.58 };
        if (floor.id.startsWith("Lair:")) return { color: floor.name.includes("Lava") ? [224, 82, 32] : [84, 134, 70], edgeAlpha: 0.15, veilAlpha: 0.07, glowAlpha: 0.08, glowY: 0.68 };
        if (floor.id.startsWith("Orc:")) return { color: [181, 103, 53], edgeAlpha: 0.14, veilAlpha: 0.06, glowAlpha: 0.06, glowY: 0.58 };
        if (floor.name.includes("Funnel")) return { color: [218, 79, 42], edgeAlpha: 0.14, veilAlpha: 0.07, glowAlpha: 0.08, glowY: 0.66 };
        return null;
      }

      function drawBranchAtmosphere(context, width, height) {
        const profile = branchAtmosphereProfile();
        if (!profile) return;

        context.save();
        context.globalCompositeOperation = "screen";

        const side = context.createLinearGradient(0, 0, width, 0);
        side.addColorStop(0, rgba(profile.color, profile.edgeAlpha));
        side.addColorStop(0.34, rgba(profile.color, 0));
        side.addColorStop(0.66, rgba(profile.color, 0));
        side.addColorStop(1, rgba(profile.color, profile.edgeAlpha));
        context.fillStyle = side;
        context.fillRect(0, 0, width, height);

        const veil = context.createLinearGradient(0, 0, 0, height);
        veil.addColorStop(0, rgba(profile.color, profile.veilAlpha));
        veil.addColorStop(0.42, rgba(profile.color, 0));
        veil.addColorStop(1, rgba(profile.color, profile.veilAlpha * 0.7));
        context.fillStyle = veil;
        context.fillRect(0, 0, width, height);

        const glowY = height * profile.glowY;
        const glow = context.createRadialGradient(width * 0.5, glowY, width * 0.04, width * 0.5, glowY, width * 0.62);
        glow.addColorStop(0, rgba(profile.color, profile.glowAlpha));
        glow.addColorStop(0.52, rgba(profile.color, profile.glowAlpha * 0.35));
        glow.addColorStop(1, rgba(profile.color, 0));
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);

        context.restore();
      }

      function viewCell(depth, offset) {
        const forward = dirAt(0);
        const right = dirAt(1);
        return {
          x: state.x + forward.x * depth + right.x * offset,
          y: state.y + forward.y * depth + right.y * offset
        };
      }

      function viewCoordinates(x, y) {
        const forward = dirAt(0);
        const right = dirAt(1);
        const dx = x - state.x;
        const dy = y - state.y;
        return {
          depth: dx * forward.x + dy * forward.y + 1,
          offset: dx * right.x + dy * right.y
        };
      }

      function mapViewClass(x, y) {
        const view = viewCoordinates(x, y);
        if (view.depth < 1 || view.depth > 6) return "";
        if (Math.abs(view.offset) > Math.max(1, Math.ceil(view.depth * 0.55))) return "";
        return view.offset === 0 ? "view-axis" : "view";
      }

      function mapCellsInViewRows() {
        const rows = new Map();
        const floor = currentFloor();
        for (let y = -1; y <= floor.map.height; y += 1) {
          for (let x = -1; x <= floor.map.width; x += 1) {
            if (!boundaryWallCell(x, y)) continue;
            const view = viewCoordinates(x, y);
            if (view.depth < 1) continue;
            if (!rows.has(view.depth)) rows.set(view.depth, []);
            rows.get(view.depth).push({ x, y, offset: view.offset });
          }
        }
        return [...rows.entries()]
          .map(([depth, cells]) => ({ depth, cells: cells.sort((a, b) => a.offset - b.offset) }))
          .sort((a, b) => b.depth - a.depth);
      }

      function shiftedBounds(bounds, depth, offset) {
        const frame = frameAt(depth);
        const width = frame.right - frame.left;
        return [bounds[0] + width * offset, bounds[1], bounds[2], bounds[3]];
      }

      function actorBounds(monster, bounds, depth, offset) {
        const shifted = shiftedBounds(bounds, depth, offset);
        if (monster.traits?.airborne) return shifted;

        const frame = frameAt(depth);
        const floorLine = frame.bottom - Math.max(1.8, (frame.bottom - frame.top) * 0.035);
        const spriteBottom = shifted[1] + shifted[3];
        return [shifted[0], shifted[1] + Math.max(0, floorLine - spriteBottom), shifted[2], shifted[3]];
      }

      function standingBounds(depth, offset, widthScale = 0.42, heightScale = 0.58) {
        const frame = frameAt(depth);
        const cellWidth = frame.right - frame.left;
        const cellHeight = frame.bottom - frame.top;
        const spriteWidth = Math.max(4, cellWidth * widthScale);
        const spriteHeight = Math.max(5, cellHeight * heightScale);
        const center = (frame.left + frame.right) / 2 + cellWidth * offset;
        const bottom = frame.bottom - Math.max(1.2, cellHeight * 0.06);
        return [center - spriteWidth / 2, bottom - spriteHeight, spriteWidth, spriteHeight];
      }

      function sideWallSortValue(cell) {
        const right = dirAt(1);
        return right.x !== 0 ? cell.x : cell.y;
      }

      function sideWallEntries(cell, offset) {
        const left = dirAt(-1);
        const right = dirAt(1);
        return [
          { cell: { x: cell.x + left.x, y: cell.y + left.y }, boundary: offset - 0.5, salt: 17 },
          { cell: { x: cell.x + right.x, y: cell.y + right.y }, boundary: offset + 0.5, salt: 23 }
        ]
          .filter((entry) => solidAt(entry.cell.x, entry.cell.y))
          .sort((a, b) => sideWallSortValue(a.cell) - sideWallSortValue(b.cell));
      }

      function drawSideWall(context, width, height, depth, offset, entry, data) {
        const points = pctQuad(sideFacePoints(depth, entry.boundary), width, height);
        const surface = sideFacePoints(depth, entry.boundary);
        drawVerticalMappedQuad(context, themedAsset("sideWall", "sideWallAlt", entry.cell, entry.salt), points, depth, Math.max(0.2, data.light - 0.1), "#25211d");
        drawWallRelief(context, width, height, depth, entry.cell, surface, true);
        drawWallPatch(context, width, height, depth, offset, entry.cell, surface);
        drawWallStain(context, width, height, depth, offset, entry.cell, surface);
        drawSideWallAccent(context, width, height, depth, offset, entry.cell, surface);
        drawWallGlow(context, width, height, depth, offset, entry.cell, surface);
        strokeQuad(context, points, `rgba(11, 10, 9, ${Math.max(0.2, 0.56 - data.light * 0.25)})`);
      }

      function drawCellShell(context, width, height, depth, offset, cell) {
        if (solidAt(cell.x, cell.y)) return;
        const data = geometryAt(depth);
        const floorQuad = pctQuad(floorSegmentPoints(depth, offset), width, height);
        const ceilingQuad = pctQuad(ceilingSegmentPoints(depth, offset), width, height);
        drawHorizontalMappedQuad(context, themedAsset("ceiling", "ceilingAlt", cell, 5), ceilingQuad, depth, Math.max(0.2, data.light - 0.24), "#171513");
        drawHorizontalMappedQuad(context, floorTexture(cell), floorQuad, depth, Math.max(0.2, data.light - 0.05), floorFallback(cell));
        drawTerrainOverlay(context, width, height, depth, offset, cell);
        drawFloorVeil(context, width, height, depth, offset, cell);
        drawFloorAccent(context, width, height, depth, offset, cell);
        drawFloorMarks(context, width, height, depth, offset, cell);
        drawPartyAura(context, width, height, depth, offset, cell);
        strokeQuad(context, floorQuad, `rgba(240, 205, 132, ${Math.max(0.05, data.light * 0.11)})`);
        strokeQuad(context, ceilingQuad, `rgba(105, 91, 71, ${Math.max(0.04, data.light * 0.08)})`);

        for (const entry of sideWallEntries(cell, offset)) drawSideWall(context, width, height, depth, offset, entry, data);
      }

      function drawTerrainOverlay(context, width, height, depth, offset, cell) {
        const terrain = terrainAt(cell.x, cell.y);
        if (terrain === "floor") return;
        const data = geometryAt(depth);
        const quad = pctQuad(floorSegmentPoints(depth, offset), width, height);
        const flicker = (cellHash(cell.x, cell.y, 131) % 7) / 100;
        const color = {
          water: `rgba(58, 143, 158, ${Math.max(0.08, data.light * 0.16 + flicker)})`,
          "deep-water": `rgba(20, 72, 128, ${Math.max(0.1, data.light * 0.22 + flicker)})`,
          lava: `rgba(238, 82, 24, ${Math.max(0.13, data.light * 0.2 + flicker)})`
        }[terrain];
        context.save();
        drawQuadPath(context, quad);
        context.fillStyle = color;
        context.globalCompositeOperation = terrain === "lava" ? "lighter" : "screen";
        context.fill();
        context.restore();
      }

      function floorVeilForCell(cell) {
        const terrain = terrainAt(cell.x, cell.y);
        const assets = currentAssets();
        if (terrain === "lava") return { texture: assets.effectFlame, fallback: "#cf4a1e", alpha: 0.3, composite: "lighter", salt: 197, rarity: 1 };
        if (terrain === "deep-water") return { texture: assets.fog, fallback: "#b8d3d2", alpha: 0.18, composite: "screen", salt: 199, rarity: 1 };
        if (terrain === "water") return { texture: assets.fog, fallback: "#b8d3d2", alpha: 0.14, composite: "screen", salt: 211, rarity: 2 };

        const floor = currentFloor();
        if (floor.id.startsWith("Swamp:")) return { texture: assets.poisonCloud || assets.fog, fallback: "#8fb36c", alpha: 0.13, composite: "screen", salt: 223, rarity: 3 };
        if (floor.id.startsWith("Shoals:")) return { texture: assets.fog, fallback: "#b8d3d2", alpha: 0.12, composite: "screen", salt: 227, rarity: 3 };
        if (floor.id.startsWith("Slime:")) return { texture: assets.poisonCloud || assets.fog, fallback: "#88bc55", alpha: 0.16, composite: "screen", salt: 229, rarity: 2 };
        if (floor.name.includes("Lava")) return { texture: assets.effectFlame, fallback: "#cf4a1e", alpha: 0.18, composite: "lighter", salt: 233, rarity: 3 };
        return null;
      }

      function drawFloorVeil(context, width, height, depth, offset, cell) {
        if (Math.abs(offset) > 2) return;
        const veil = floorVeilForCell(cell);
        if (!veil) return;
        if (cellHash(cell.x, cell.y, veil.salt) % veil.rarity !== 0) return;
        const data = geometryAt(depth);
        const quad = pctQuad(floorDecalPoints(depth, { left: 0.08, top: 0.08, right: 0.92, bottom: 0.98 }, offset), width, height);
        drawImageMappedQuad(context, veil.texture, quad, Math.min(1, data.light + 0.18), veil.fallback, { alpha: veil.alpha, composite: veil.composite, noShade: true, shadow: false });
      }

      function drawFloorAccent(context, width, height, depth, offset, cell) {
        if (Math.abs(offset) > 2) return;
        if (terrainAt(cell.x, cell.y) !== "floor") return;
        const texture = accentAsset("floorAccent", cell, 41, 6);
        if (!texture) return;
        const data = geometryAt(depth);
        const large = cellHash(cell.x, cell.y, 43) % 2 === 0;
        const footprint = large ? { left: 0.1, top: 0.12, right: 0.9, bottom: 0.98 } : { left: 0.22, top: 0.28, right: 0.78, bottom: 0.92 };
        const points = pctQuad(floorDecalPoints(depth, footprint, offset), width, height);
        drawImageMappedQuad(context, texture, points, Math.min(1, data.light + 0.08), "#5f5a43", { shadow: false });
      }

      function floorMarkTexture(mark) {
        const assets = currentAssets();
        if (mark.kind === "scorch") return assets.floorScorch || assets.effectFlame;
        if (mark.kind === "poison") return assets.floorPoison || assets.poisonCloud;
        if (mark.kind === "ice") return assets.floorIce || assets.fog;
        return assets.floorBlood || assets.floorAccent1 || assets.floorAccent0;
      }

      function floorMarkFallback(mark) {
        if (mark.kind === "scorch") return "#6d3322";
        if (mark.kind === "poison") return "#5f8d3d";
        if (mark.kind === "ice") return "#8cc9d8";
        return "#67251d";
      }

      function drawFloorMarks(context, width, height, depth, offset, cell) {
        if (Math.abs(offset) > 2) return;
        if (terrainAt(cell.x, cell.y) !== "floor") return;
        const marks = floorMarksAt(cell.x, cell.y).slice(-2);
        if (marks.length === 0) return;
        const data = geometryAt(depth);
        for (let index = 0; index < marks.length; index += 1) {
          const mark = marks[index];
          const spread = Math.min(0.18, mark.intensity * 0.035);
          const footprint = index === 0
            ? { left: 0.18 - spread, top: 0.28 - spread, right: 0.82 + spread, bottom: 0.9 + spread }
            : { left: 0.34 - spread, top: 0.18, right: 0.72 + spread, bottom: 0.74 + spread };
          const points = pctQuad(floorDecalPoints(depth, footprint, offset), width, height);
          const alpha = Math.min(0.92, 0.46 + mark.intensity * 0.12);
          drawImageMappedQuad(context, floorMarkTexture(mark), points, Math.min(1, data.light + 0.1), floorMarkFallback(mark), { alpha, shadow: false });
        }
      }

      function partyAuras() {
        const assets = currentAssets();
        return [
          state.hasteTurns > 0 && { kind: "haste", texture: assets.effectHalo, color: "rgba(118, 198, 255, 0.18)", fallback: "#4b9fd1" },
          state.mightTurns > 0 && { kind: "might", texture: assets.effectHalo, color: "rgba(255, 106, 68, 0.18)", fallback: "#c95038" },
          state.rageTurns > 0 && { kind: "rage", texture: assets.effectHalo, color: "rgba(255, 54, 44, 0.2)", fallback: "#d7352c" },
          state.resistanceTurns > 0 && { kind: "resistance", texture: assets.effectHalo, color: "rgba(249, 221, 129, 0.18)", fallback: "#d7b954" },
          state.silenceTurns > 0 && { kind: "silence", texture: assets.effectHalo, color: "rgba(196, 190, 220, 0.16)", fallback: "#b2accd" },
          state.barbedTurns > 0 && { kind: "barbed", texture: assets.effectHalo, color: "rgba(224, 95, 58, 0.18)", fallback: "#c65f3a" },
          state.engulfedTurns > 0 && { kind: "engulfed", texture: assets.fog, color: "rgba(72, 162, 190, 0.18)", fallback: "#4aa2be" },
          state.slowedTurns > 0 && { kind: "slow", texture: assets.effectHalo, color: "rgba(144, 99, 180, 0.16)", fallback: "#9063b4" },
          state.poisonedTurns > 0 && { kind: "poison", texture: assets.effectHalo, color: "rgba(108, 179, 74, 0.18)", fallback: "#65a84f" },
          state.vitrifiedTurns > 0 && { kind: "vitrified", texture: assets.effectHalo, color: "rgba(170, 220, 232, 0.18)", fallback: "#9fd6df" }
        ].filter(Boolean);
      }

      function drawPartyAura(context, width, height, depth, offset, cell) {
        if (cell.x !== state.x || cell.y !== state.y) return;
        const auras = partyAuras();
        if (auras.length === 0) return;
        const data = geometryAt(depth);
        for (let index = 0; index < auras.length; index += 1) {
          const aura = auras[index];
          const spread = auras.length === 1 ? { left: 0.2, top: 0.16, right: 0.8, bottom: 0.94 } : { left: 0.14 + index * 0.18, top: 0.36, right: 0.36 + index * 0.18, bottom: 0.9 };
          const quad = pctQuad(floorDecalPoints(depth, spread, offset), width, height);
          context.save();
          context.globalCompositeOperation = "lighter";
          drawQuadPath(context, quad);
          context.fillStyle = aura.color;
          context.fill();
          context.restore();
          drawImageMappedQuad(context, aura.texture, quad, Math.min(1, data.light + 0.18), aura.fallback, { shadow: false });
        }
      }

      function drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, options) {
        if (Math.abs(offset) > options.maxOffset) return;
        const texture = accentAsset(options.prefix, cell, options.salt, options.rarity);
        if (!texture) return;
        const data = geometryAt(depth);
        const variant = cellHash(cell.x, cell.y, options.salt + 2) % 3;
        const footprint = options.footprints[variant] || options.footprints[0];
        const points = pctQuad(quadDecalPoints(surfacePoints, footprint), width, height);
        drawImageMappedQuad(context, texture, points, Math.min(1, data.light + (options.lightBoost || 0.05)), options.fallback, { alpha: options.alpha, composite: options.composite, noShade: options.noShade, shadow: false });
      }

      function drawWallAccent(context, width, height, depth, offset, cell) {
        drawSurfaceDecal(context, width, height, depth, offset, cell, frontFacePoints(depth, offset), {
          prefix: "wallAccent",
          salt: 59,
          rarity: 7,
          maxOffset: 1,
          fallback: "#9b8152",
          footprints: [
            { left: 0.24, top: 0.24, right: 0.76, bottom: 0.78 },
            { left: 0.28, top: 0.12, right: 0.72, bottom: 0.58 },
            { left: 0.18, top: 0.34, right: 0.64, bottom: 0.82 }
          ]
        });
      }

      function drawWallGlow(context, width, height, depth, offset, cell, surfacePoints) {
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          prefix: "wallGlow",
          salt: 173,
          rarity: 13,
          maxOffset: 2,
          fallback: "#d8b05b",
          alpha: 0.38,
          composite: "lighter",
          lightBoost: 0.2,
          noShade: true,
          footprints: [
            { left: 0.28, top: 0.08, right: 0.72, bottom: 0.5 },
            { left: 0.16, top: 0.18, right: 0.58, bottom: 0.68 },
            { left: 0.42, top: 0.16, right: 0.86, bottom: 0.7 }
          ]
        });
      }

      function drawWallStain(context, width, height, depth, offset, cell, surfacePoints) {
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          prefix: "wallStain",
          salt: 83,
          rarity: 4,
          maxOffset: 2,
          fallback: "#442117",
          lightBoost: 0.02,
          footprints: [
            { left: 0.1, top: 0.18, right: 0.58, bottom: 0.76 },
            { left: 0.34, top: 0.12, right: 0.92, bottom: 0.7 },
            { left: 0.22, top: 0.38, right: 0.82, bottom: 0.94 }
          ]
        });
      }

      function drawWallPatch(context, width, height, depth, offset, cell, surfacePoints) {
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          prefix: "wallPatch",
          salt: 109,
          rarity: 5,
          maxOffset: 2,
          fallback: "#4b4a34",
          lightBoost: 0.03,
          footprints: [
            { left: 0.04, top: 0.08, right: 0.52, bottom: 0.88 },
            { left: 0.42, top: 0.06, right: 0.98, bottom: 0.78 },
            { left: 0.16, top: 0.3, right: 0.86, bottom: 0.98 }
          ]
        });
      }

      function drawSideWallAccent(context, width, height, depth, offset, cell, surfacePoints) {
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          prefix: "wallAccent",
          salt: 97,
          rarity: 11,
          maxOffset: 2,
          fallback: "#8d744a",
          footprints: [
            { left: 0.2, top: 0.18, right: 0.72, bottom: 0.7 },
            { left: 0.34, top: 0.1, right: 0.84, bottom: 0.54 },
            { left: 0.12, top: 0.36, right: 0.64, bottom: 0.86 }
          ]
        });
      }

      function drawFloorFeature(context, width, height, depth, offset, cell) {
        const data = geometryAt(depth);
        const assets = currentAssets();
        const stairs = stairsAt(cell.x, cell.y);
        if (stairs) {
          const stairQuad = pctQuad(floorDecalPoints(depth, { left: 0.24, top: 0.18, right: 0.76, bottom: 0.94 }, offset), width, height);
          const rect = drawImageMappedQuad(context, stairs.direction === "down" ? assets.stairsDown : assets.stairsUp, stairQuad, data.light, "#7f6742");
          if (rect && offset === 0) drawLabel(context, stairs.direction === "down" ? "downstairs" : "upstairs", rect);
        }

        const trap = trapAt(cell.x, cell.y);
        if (trap) {
          const trapQuad = pctQuad(floorDecalPoints(depth, { left: 0.3, top: 0.24, right: 0.7, bottom: 0.88 }, offset), width, height);
          const rect = drawImageMappedQuad(context, trap.tile, trapQuad, data.light, "#7d4b35");
          if (rect && offset === 0) drawLabel(context, trap.shortName, rect);
        }

        const floorItem = itemAt(cell.x, cell.y);
        if (floorItem) {
          const itemQuad = pctQuad(floorDecalPoints(depth, { left: 0.37, top: 0.44, right: 0.63, bottom: 0.84 }, offset), width, height);
          const fallback = floorItem.kind === "quest" ? "#735fc8" : floorItem.kind === "gold" ? "#c9a33f" : "#6e8058";
          const rect = drawImageMappedQuad(context, floorItem.tile, itemQuad, data.light, fallback);
          if (rect && offset === 0) drawLabel(context, floorItem.shortName, rect);
        }
      }

      function drawSpentFloorDecor(context, points) {
        context.save();
        drawQuadPath(context, points);
        context.fillStyle = "rgba(24, 22, 18, 0.46)";
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = "rgba(206, 181, 112, 0.36)";
        context.stroke();
        context.restore();
      }

      function drawSpentDecorBadge(context, rect) {
        const x = rect.x + rect.width * 0.5;
        const y = rect.y + rect.height * 0.78;
        const radius = Math.max(5, Math.min(rect.width, rect.height) * 0.11);
        context.save();
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(18, 16, 13, 0.68)";
        context.fill();
        context.strokeStyle = "rgba(216, 188, 102, 0.72)";
        context.lineWidth = Math.max(1, radius * 0.16);
        context.beginPath();
        context.moveTo(x - radius * 0.48, y + radius * 0.48);
        context.lineTo(x + radius * 0.48, y - radius * 0.48);
        context.stroke();
        context.restore();
      }

      function drawDecor(context, width, height, depth, offset, cell) {
        const decor = decorAt(cell.x, cell.y);
        if (!decor) return;
        const data = geometryAt(nearEdgeDepth(depth));
        const spent = decorUsed(decor);
        if (decor.kind === "floor") {
          const decorQuad = pctQuad(floorDecalPoints(depth, { left: 0.17, top: 0.16, right: 0.83, bottom: 0.98 }, offset), width, height);
          drawImageMappedQuad(context, decor.tile, decorQuad, Math.min(1, data.light + 0.05), "#80663b", { shadow: false, alpha: spent ? 0.5 : undefined });
          if (spent) drawSpentFloorDecor(context, decorQuad);
          return;
        }

        const tall = decor.name.includes("column") || decor.name.includes("idol");
        const bounds = standingBounds(nearEdgeDepth(depth), offset, tall ? 0.38 : 0.44, tall ? 0.7 : 0.56);
        const rect = drawSprite(context, decor.tile, bounds, width, height, spent ? { alpha: 0.52, filter: "grayscale(0.9) brightness(0.7)" } : {});
        if (spent && rect) drawSpentDecorBadge(context, rect);
        if (rect && offset === 0) drawLabel(context, decor.shortName, rect);
      }

      function effectTexture(kind) {
        const assets = currentAssets();
        return {
          magic: assets.effectMagicDart,
          flame: assets.effectFlame,
          ice: assets.effectIce,
          impact: assets.effectImpact,
          smite: assets.effectSmite,
          silence: assets.effectSilence,
          blink: assets.effectBlink,
          fear: assets.effectFear,
          immolation: assets.effectImmolation,
          poison: assets.effectPoison,
          halo: assets.effectHalo,
          orb: assets.effectOrb
        }[kind] || assets.effectImpact;
      }

      function effectColor(kind) {
        return {
          magic: "rgba(122, 194, 210, 0.82)",
          flame: "rgba(255, 122, 45, 0.88)",
          ice: "rgba(155, 219, 255, 0.84)",
          impact: "rgba(255, 218, 120, 0.76)",
          smite: "rgba(241, 229, 155, 0.86)",
          silence: "rgba(180, 176, 205, 0.76)",
          blink: "rgba(117, 189, 222, 0.8)",
          fear: "rgba(144, 99, 180, 0.78)",
          immolation: "rgba(255, 91, 46, 0.86)",
          poison: "rgba(117, 185, 80, 0.76)",
          halo: "rgba(249, 221, 129, 0.78)",
          orb: "rgba(210, 168, 255, 0.88)"
        }[kind] || "rgba(255, 218, 120, 0.72)";
      }

      function effectBounds(kind, depth, offset) {
        if (kind === "smite") return standingBounds(depth, offset, 0.24, 0.78);
        if (kind === "silence") return standingBounds(depth, offset, 0.5, 0.48);
        if (kind === "blink") return standingBounds(depth, offset, 0.46, 0.46);
        if (kind === "fear" || kind === "immolation") return standingBounds(depth, offset, 0.42, 0.48);
        if (kind === "orb") return standingBounds(depth, offset, 0.26, 0.28);
        if (kind === "impact") return standingBounds(depth, offset, 0.14, 0.16);
        return standingBounds(depth, offset, 0.16, 0.18);
      }

      function effectPoint(cell, kind, width, height) {
        const view = viewCoordinates(cell.x, cell.y);
        if (view.depth < 1 || Math.abs(view.offset) > Math.max(2, Math.ceil(view.depth * 0.7))) return null;
        const rect = pctRect(effectBounds(kind, nearEdgeDepth(view.depth), view.offset), width, height);
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height * 0.6, depth: view.depth };
      }

      function drawEffectTrail(context, width, height, effect) {
        if (effect.cells.length < 2) return;
        const points = effect.cells.map((cell) => effectPoint(cell, effect.kind, width, height)).filter(Boolean).sort((a, b) => b.depth - a.depth);
        if (points.length < 2) return;
        const color = effectColor(effect.kind);
        context.save();
        context.globalCompositeOperation = "lighter";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.shadowColor = color;
        context.shadowBlur = 16;
        context.strokeStyle = color;
        context.lineWidth = Math.max(3, width * 0.004);
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) context.lineTo(point.x, point.y);
        context.stroke();
        context.lineWidth = Math.max(1, width * 0.0016);
        context.strokeStyle = "rgba(255, 245, 208, 0.82)";
        context.stroke();
        context.restore();
      }

      function drawEffectTrails(context, width, height) {
        for (const effect of state.effects) drawEffectTrail(context, width, height, effect);
      }

      function drawEffectWash(context, width, height) {
        if (state.effects.length === 0) return;
        const effect = state.effects[state.effects.length - 1];
        const points = effect.cells.map((cell) => effectPoint(cell, effect.kind, width, height)).filter(Boolean);
        const center = points[points.length - 1] || { x: width * 0.5, y: height * 0.55 };
        const glow = context.createRadialGradient(center.x, center.y, width * 0.04, center.x, center.y, width * 0.48);
        glow.addColorStop(0, effectColor(effect.kind));
        glow.addColorStop(0.34, "rgba(255, 255, 255, 0.05)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.save();
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = 0.22;
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
        context.restore();
      }

      function drawEffectSprite(context, source, bounds, width, height, color) {
        const entry = imageEntry(source);
        const rect = pctRect(bounds, width, height);
        context.save();
        context.globalCompositeOperation = "lighter";
        context.shadowColor = color;
        context.shadowBlur = 22;
        context.fillStyle = color;
        context.globalAlpha = 0.58;
        context.beginPath();
        context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.max(3, rect.width * 0.3), Math.max(3, rect.height * 0.3), 0, 0, Math.PI * 2);
        context.fill();
        if (entry.ready) {
          context.globalAlpha = 0.95;
          context.imageSmoothingEnabled = false;
          context.drawImage(entry.image, rect.x, rect.y, rect.width, rect.height);
        }
        context.restore();
      }

      function drawEffect(context, width, height, depth, offset, cell) {
        const effects = state.effects.filter((effect) => effect.cells.some((effectCell) => effectCell.x === cell.x && effectCell.y === cell.y));
        if (effects.length === 0) return;
        for (const effect of effects) {
          drawEffectSprite(context, effectTexture(effect.kind), effectBounds(effect.kind, nearEdgeDepth(depth), offset), width, height, effectColor(effect.kind));
        }
      }

      function drawCloud(context, width, height, depth, offset, cell) {
        const cloud = cloudAt(cell.x, cell.y);
        if (!cloud) return;
        const data = geometryAt(depth);
        const assets = currentAssets();
        const texture = cloud.kind === "poison" ? assets.poisonCloud : cloud.kind === "petrify" ? assets.petrifyCloud : cloud.kind === "flame" ? assets.effectFlame : assets.fog;
        const fallback = cloud.kind === "poison" ? "#83a95f" : cloud.kind === "petrify" ? "#c8c1a8" : cloud.kind === "flame" ? "#e87832" : "#c1b8a8";
        const cloudQuad = pctQuad(floorDecalPoints(depth, { left: 0.12, top: 0.1, right: 0.88, bottom: 0.96 }, offset), width, height);
        drawImageMappedQuad(context, texture, cloudQuad, Math.max(0.35, data.light), fallback);
      }

      function drawActor(context, width, height, depth, offset, cell) {
        const monster = monsterAt(cell.x, cell.y);
        if (!monster) return;
        const spriteDepth = nearEdgeDepth(depth);
        const data = geometryAt(spriteDepth);
        const rect = drawSprite(context, monster.tile, actorBounds(monster, data.sprite, spriteDepth, offset), width, height);
        if (!rect) return;
        drawRangedCue(context, monster, rect);
        drawMonsterStatusCue(context, monster, rect);
        drawHealthBar(context, monster, rect);
      }

      function drawFrontSurface(context, width, height, depth, offset, cell) {
        const kind = mapKind(cell.x, cell.y);
        if (kind === "floor") return;
        const faceDepth = nearEdgeDepth(depth);
        const data = geometryAt(faceDepth);
        const assets = currentAssets();
        const points = pctQuad(frontFacePoints(faceDepth, offset), width, height);
        if (kind === "door") {
          drawVerticalMappedQuad(context, assets.door, points, faceDepth, data.light, "#281d13");
          strokeQuad(context, points, "rgba(238, 193, 101, 0.12)");
          return;
        }
        drawVerticalMappedQuad(context, themedAsset("wall", "wallAlt", cell, 31), points, faceDepth, data.light, "#2e2a24");
        const surface = frontFacePoints(faceDepth, offset);
        drawWallRelief(context, width, height, faceDepth, cell, surface);
        drawWallPatch(context, width, height, faceDepth, offset, cell, surface);
        drawWallStain(context, width, height, faceDepth, offset, cell, surface);
        drawWallAccent(context, width, height, faceDepth, offset, cell);
        drawWallGlow(context, width, height, faceDepth, offset, cell, surface);
        strokeQuad(context, points, `rgba(238, 193, 101, ${Math.max(0.05, data.light * 0.09)})`);
      }

      function drawViewCell(context, width, height, depth, cell) {
        if (solidAt(cell.x, cell.y)) {
          drawFrontSurface(context, width, height, depth, cell.offset, cell);
          return;
        }
        drawCellShell(context, width, height, depth, cell.offset, cell);
        drawDecor(context, width, height, depth, cell.offset, cell);
        drawFloorFeature(context, width, height, depth, cell.offset, cell);
        drawActor(context, width, height, depth, cell.offset, cell);
        drawCloud(context, width, height, depth, cell.offset, cell);
        drawEffect(context, width, height, depth, cell.offset, cell);
      }

      function renderViewport() {
        const { context, width, height } = ensureViewportCanvas();
        context.clearRect(0, 0, width, height);
        context.imageSmoothingEnabled = false;
        context.fillStyle = "#070606";
        context.fillRect(0, 0, width, height);

        const rows = mapCellsInViewRows();
        for (const row of rows) {
          for (const cell of row.cells) drawViewCell(context, width, height, row.depth, cell);
        }
        drawEffectTrails(context, width, height);

        drawViewportHaze(context, width, height);
        drawBranchAtmosphere(context, width, height);
        drawEffectWash(context, width, height);
        if (state.victory || state.defeated) drawLabel(context, state.victory ? "escaped" : "defeated", { x: width * 0.4, y: height * 0.42, width: width * 0.2, height: 30 });
      }

      Object.assign(context, {
        imageEntry,
        cellHash,
        assetValues,
        themedAsset,
        floorTexture,
        floorFallback,
        accentAsset,
        floorPoints,
        lerp,
        lerpPoint,
        projectedPoint,
        frameAt,
        geometryAt,
        floorSegmentPoints,
        ceilingSegmentPoints,
        frontFacePoints,
        sideFacePoints,
        nearEdgeDepth,
        floorDecalPoints,
        pointInsideQuad,
        quadDecalPoints,
        wallDecalPoints,
        ceilingPoints,
        leftWallPoints,
        rightWallPoints,
        ensureViewportCanvas,
        pctPoint,
        pctQuad,
        pctRect,
        drawQuadPath,
        shadeQuad,
        fillQuad,
        strokeQuad,
        drawSurfaceLine,
        drawWallRelief,
        scanlineIntersections,
        verticalIntersections,
        drawHorizontalMappedQuad,
        boundsForPoints,
        drawImageMappedQuad,
        drawVerticalMappedQuad,
        drawTiledRect,
        drawDoorRect,
        drawSprite,
        drawHealthBar,
        drawRangedCue,
        drawMonsterStatusCue,
        drawLabel,
        drawViewportHaze,
        rgba,
        branchAtmosphereProfile,
        drawBranchAtmosphere,
        viewCell,
        viewCoordinates,
        mapViewClass,
        mapCellsInViewRows,
        shiftedBounds,
        actorBounds,
        standingBounds,
        sideWallSortValue,
        sideWallEntries,
        drawSideWall,
        drawCellShell,
        drawTerrainOverlay,
        floorVeilForCell,
        drawFloorVeil,
        drawFloorAccent,
        floorMarkTexture,
        floorMarkFallback,
        drawFloorMarks,
        partyAuras,
        drawPartyAura,
        drawSurfaceDecal,
        drawWallAccent,
        drawWallGlow,
        drawWallStain,
        drawWallPatch,
        drawSideWallAccent,
        drawFloorFeature,
        drawDecor,
        effectTexture,
        effectColor,
        effectBounds,
        effectPoint,
        drawEffectTrail,
        drawEffectTrails,
        drawEffectWash,
        drawEffectSprite,
        drawEffect,
        drawCloud,
        drawActor,
        drawFrontSurface,
        drawViewCell,
        renderViewport,
      });
    }
  };
}());
