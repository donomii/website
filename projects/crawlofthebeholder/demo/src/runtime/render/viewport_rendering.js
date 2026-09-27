(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installViewportRendering = function (context) {
    with (context) {
      function imageEntry(src, allowClassicFallback = true) {
        const cacheKey = allowClassicFallback ? src : `${src}\u0000linocut-only`;
        const directEntry = imageCache.get(src);
        const existing = imageCache.get(cacheKey) || (!allowClassicFallback && directEntry?.ready && (!directEntry.loadedSrc || directEntry.loadedSrc === src) ? directEntry : null);
        if (existing) return existing;

        const fallbackSrc = allowClassicFallback && typeof classicEnvironmentAsset === "function" ? classicEnvironmentAsset(src) : src;
        const entry = {
          image: null,
          ready: false,
          failed: false,
          loadedSrc: null,
          fallbackSrc: fallbackSrc === src ? null : fallbackSrc
        };
        imageCache.set(cacheKey, entry);

        const load = (candidate, canFallback) => {
          const image = new Image();
          entry.image = image;
          image.onload = () => {
            entry.loadedSrc = candidate;
            entry.ready = true;
            renderViewport();
          };
          image.onerror = () => {
            if (canFallback && entry.fallbackSrc) {
              load(entry.fallbackSrc, false);
              return;
            }
            entry.failed = true;
            renderViewport();
          };
          image.src = candidate;
        };
        load(src, true);
        return entry;
      }

      function isLinocutTexture(texture, entry = null) {
        const linocutPath = typeof normalTile === "function" && normalTile(texture) !== null;
        return linocutPath && (!entry?.loadedSrc || entry.loadedSrc === texture);
      }

      function setTextureSmoothing(context, texture, entry = null) {
        const linocut = isLinocutTexture(texture, entry);
        context.imageSmoothingEnabled = linocut;
        if (linocut) context.imageSmoothingQuality = "high";
      }

      // Non-transparent bounding box of a tile, as fractions of the image (0..1).
      // DCSS monster tiles pad the creature with empty space, so the artwork's
      // bottom edge — not the tile's — is where the feet are. Cached per source.
      const tileContentCache = new Map();
      function tileContentBox(src) {
        const cached = tileContentCache.get(src);
        if (cached) return cached;
        const full = { left: 0, top: 0, right: 1, bottom: 1 };
        const entry = imageEntry(src);
        if (!entry.ready) return full; // recomputed once the image loads
        let box = full;
        try {
          const img = entry.image;
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return full;
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, w, h).data;
          let minX = w, minY = h, maxX = -1, maxY = -1;
          for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
              if (data[(y * w + x) * 4 + 3] > 16) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX >= minX && maxY >= minY) box = { left: minX / w, top: minY / h, right: (maxX + 1) / w, bottom: (maxY + 1) / h };
        } catch (error) {
          box = full;
        }
        tileContentCache.set(src, box);
        return box;
      }

      function cellHash(x, y, salt = 0) {
        let value = Math.imul(x + 32768, 374761393) ^ Math.imul(y + 32768, 668265263) ^ Math.imul(state.floorIndex + 1, -2048144777) ^ salt;
        value = Math.imul(value ^ (value >>> 13), 1274126177);
        return (value ^ (value >>> 16)) >>> 0;
      }

      function assetValues(prefix) {
        const assets = currentAssets();
        return Object.keys(assets)
          .filter((key) => key.startsWith(prefix))
          .sort()
          .map((key) => environmentAsset(assets[key]))
          .filter(Boolean);
      }

      function themedAsset(baseKey, altPrefix, cell, salt = 0) {
        const assets = currentAssets();
        const base = environmentAsset(assets[baseKey]);
        const choices = [base, ...assetValues(altPrefix)].filter(Boolean);
        if (choices.length === 0) return null;
        return choices[cellHash(cell.x, cell.y, salt) % choices.length] || base;
      }

      function wallSurfaceTexture(cell) {
        const assets = currentAssets();
        const wall = environmentAsset(assets.wall);
        const sideWall = environmentAsset(assets.sideWall);
        const choices = [wall, ...assetValues("wallAlt"), sideWall, ...assetValues("sideWallAlt")].filter(Boolean);
        if (choices.length === 0) return null;
        return choices[cellHash(cell.x, cell.y, 31) % choices.length] || wall || sideWall;
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
        // Pure geometric shrink toward the vanishing point — no fixed floor.
        // Clamping the frame size froze deep frames at one size, collapsing the
        // floor strips between them to zero and lifting far monsters off them.
        const width = (last.right - last.left) * shrink;
        const height = (last.bottom - last.top) * shrink;
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

      const VIEWPORT_REFERENCE_ASPECT = 4 / 3;
      let viewportProjection = null;

      function calculateViewportProjection(width, height) {
        const projectionWidth = Math.min(width, height * VIEWPORT_REFERENCE_ASPECT);
        const projectionHeight = projectionWidth / VIEWPORT_REFERENCE_ASPECT;
        return {
          width,
          height,
          aspectRatio: width / height,
          xOffset: (width - projectionWidth) / 2,
          yOffset: (height - projectionHeight) / 2,
          xScale: projectionWidth / 100,
          yScale: projectionHeight / 100
        };
      }

      function updateViewportProjection(width, height) {
        viewportProjection = calculateViewportProjection(width, height);
        return viewportProjection;
      }

      function viewportProjectionFor(width, height) {
        if (!viewportProjection || viewportProjection.width !== width || viewportProjection.height !== height) return updateViewportProjection(width, height);
        return viewportProjection;
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
        const projection = updateViewportProjection(width, height);
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
        return { context: viewportContext, width, height, aspectRatio: projection.aspectRatio };
      }

      function pctPoint(point, width, height) {
        const projection = viewportProjectionFor(width, height);
        return { x: projection.xOffset + point[0] * projection.xScale, y: projection.yOffset + point[1] * projection.yScale };
      }

      function pctQuad(points, width, height) {
        return points.map((point) => pctPoint(point, width, height));
      }

      function pctRect(bounds, width, height) {
        const projection = viewportProjectionFor(width, height);
        return {
          x: projection.xOffset + bounds[0] * projection.xScale,
          y: projection.yOffset + bounds[1] * projection.yScale,
          width: bounds[2] * projection.xScale,
          height: bounds[3] * projection.yScale
        };
      }

      function drawQuadPath(context, points) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
        context.closePath();
      }

      function appendQuadPath(context, points) {
        context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
        context.closePath();
      }

      function withFrontDetailClip(context, points, occluders, drawDetails) {
        if (occluders.length === 0) {
          drawDetails();
          return;
        }
        context.save();
        context.beginPath();
        appendQuadPath(context, points);
        for (const occluder of occluders) appendQuadPath(context, occluder);
        context.clip("evenodd");
        drawDetails();
        context.restore();
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
        setTextureSmoothing(context, texture, entry);
        drawQuadPath(context, points);
        context.clip();

        const linocut = isLinocutTexture(texture, entry);
        const rowCount = Math.max(1, maxY - minY + 1);
        const sourceRowHeight = entry.image.height / rowCount;

        for (let y = minY; y <= maxY; y += 1) {
          const xs = scanlineIntersections(points, y + 0.5);
          if (xs.length < 2) continue;

          const leftX = Math.floor(xs[0]);
          const rightX = Math.ceil(xs[xs.length - 1]);
          const sourceY = ((y - minY) / rowCount) * entry.image.height;
          const classicY = Math.floor(((y - minY) / Math.max(1, maxY - minY)) * entry.image.height) % entry.image.height;
          const textureY = linocut ? sourceY : classicY;
          const textureHeight = linocut ? sourceRowHeight : 1;

          for (let x = leftX; x < rightX; x += tileSize) {
            const drawnWidth = Math.min(tileSize, rightX - x);
            context.drawImage(entry.image, 0, textureY, entry.image.width, textureHeight, x, y, drawnWidth, 1);
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
        const entry = imageEntry(texture, options.allowClassicFallback !== false);
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
        setTextureSmoothing(context, texture, entry);
        const linocut = isLinocutTexture(texture, entry);
        const rowCount = Math.max(1, maxY - minY + 1);
        const sourceRowHeight = entry.image.height / rowCount;
        if (options.composite) context.globalCompositeOperation = options.composite;
        if (options.alpha !== undefined) context.globalAlpha = options.alpha;
        if (options.shadeTexture) context.filter = `brightness(${Math.max(0, Math.min(1, light))})`;

        for (let y = minY; y <= maxY; y += 1) {
          const xs = scanlineIntersections(points, y + 0.5);
          if (xs.length < 2) continue;

          const leftX = Math.floor(xs[0]);
          const rightX = Math.ceil(xs[xs.length - 1]);
          const mappedY = ((y - minY) / rowCount) * entry.image.height;
          const classicY = Math.max(0, Math.min(entry.image.height - 1, Math.floor(((y - minY) / Math.max(1, maxY - minY)) * entry.image.height)));
          const sourceY = linocut ? mappedY : classicY;
          const sourceHeight = linocut ? sourceRowHeight : 1;
          context.drawImage(entry.image, 0, sourceY, entry.image.width, sourceHeight, leftX, y, Math.max(1, rightX - leftX), 1);
        }

        context.restore();
        if (!options.noShade && !options.shadeTexture) shadeQuad(context, points, light);
        return bounds;
      }

      function drawVerticalMappedQuad(context, texture, points, depth, light, fallback, options = {}) {
        const entry = imageEntry(texture, options.allowClassicFallback !== false);
        const minX = Math.floor(Math.min(...points.map((point) => point.x)));
        const maxX = Math.ceil(Math.max(...points.map((point) => point.x)));
        const bounds = boundsForPoints(points);

        if (!entry.ready) {
          if (options.shadow === false) return bounds;
          fillQuad(context, points, fallback, light);
          return bounds;
        }

        context.save();
        setTextureSmoothing(context, texture, entry);
        drawQuadPath(context, points);
        context.clip();
        if (options.composite) context.globalCompositeOperation = options.composite;
        if (options.alpha !== undefined) context.globalAlpha = options.alpha;
        if (options.shadeTexture) context.filter = `brightness(${Math.max(0, Math.min(1, light))})`;

        const linocut = isLinocutTexture(texture, entry);
        const columnCount = Math.max(1, maxX - minX + 1);
        const sourceColumnWidth = entry.image.width / columnCount;

        for (let x = minX; x <= maxX; x += 1) {
          const ys = verticalIntersections(points, x + 0.5);
          if (ys.length < 2) continue;

          const topY = ys[0];
          const bottomY = ys[ys.length - 1];
          const sourceX = ((x - minX) / columnCount) * entry.image.width;
          const classicX = Math.floor(((x - minX) / Math.max(1, maxX - minX)) * entry.image.width) % entry.image.width;
          const textureX = linocut ? sourceX : classicX;
          const textureWidth = linocut ? sourceColumnWidth : 1;
          context.drawImage(entry.image, textureX, 0, textureWidth, entry.image.height, x, topY, 1, bottomY - topY);
        }

        context.restore();
        if (!options.noShade && !options.shadeTexture) shadeQuad(context, points, light);
        return bounds;
      }

      function drawTiledRect(context, texture, rect, tileSize, light, fallback) {
        const entry = imageEntry(texture);

        context.save();
        setTextureSmoothing(context, texture, entry);
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
        setTextureSmoothing(context, texture, entry);
        context.fillStyle = "#281d13";
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        if (entry.ready) context.drawImage(entry.image, rect.x, rect.y, rect.width, rect.height);
        context.restore();
        context.fillStyle = `rgba(0, 0, 0, ${Math.max(0, 1 - light)})`;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      }

      function drawSprite(context, source, bounds, width, height, options = {}) {
        const entry = imageEntry(source, options.allowClassicFallback !== false);
        if (!entry.ready) return null;
        const rect = pctRect(bounds, width, height);
        context.save();
        context.shadowColor = "rgba(0, 0, 0, 0.65)";
        context.shadowBlur = 18;
        context.shadowOffsetY = 12;
        setTextureSmoothing(context, source, entry);
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

      // Status art drawn OVER an afflicted monster's sprite, so the state is
      // visible at a glance: a net over a netted (rooted) monster, flames
      // when it burns from within, a green wash when poisoned, a fear sigil
      // when fleeing. Shared vocabulary with the VR dolls.
      const NET_TILE = "vendor/crawl/crawl-ref/source/rltiles/dngn/traps/net.png";

      function monsterStatusOverlays(monster) {
        const assets = currentAssets();
        return [
          (monster.rootedTurns || 0) > 0 && { kind: "net", texture: environmentAsset(NET_TILE), alpha: 0.88 },
          (monster.immolationTurns || 0) > 0 && { kind: "fire", texture: assets.effectFlame, alpha: 0.72, lower: true, composite: "lighter" },
          (monster.poisonedTurns || 0) > 0 && { kind: "poison", texture: assets.poisonCloud, alpha: 0.42, composite: "screen" },
          (monster.fearTurns || 0) > 0 && { kind: "fear", texture: assets.effectFear, alpha: 0.9, badge: true }
        ].filter(Boolean);
      }

      function drawMonsterStatusOverlays(context, monster, rect) {
        for (const overlay of monsterStatusOverlays(monster)) {
          const entry = imageEntry(overlay.texture);
          if (!entry.ready) continue;
          context.save();
          setTextureSmoothing(context, overlay.texture, entry);
          context.globalAlpha = overlay.alpha;
          if (overlay.composite) context.globalCompositeOperation = overlay.composite;
          if (overlay.badge) {
            const size = Math.max(14, rect.width * 0.3);
            context.drawImage(entry.image, rect.x - size * 0.25, rect.y - size * 0.4, size, size);
          } else if (overlay.lower) {
            context.drawImage(entry.image, rect.x, rect.y + rect.height * 0.45, rect.width, rect.height * 0.55);
          } else {
            context.drawImage(entry.image, rect.x, rect.y, rect.width, rect.height);
          }
          context.restore();
        }
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

      function drawLabel(context, text, rect, scale = 1) {
        context.save();
        context.font = `${12 * scale}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        const label = text.length > 18 ? `${text.slice(0, 17)}...` : text;
        const metrics = context.measureText(label);
        const width = metrics.width + 12 * scale;
        const height = 18 * scale;
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height + 13 * scale;
        context.fillStyle = "rgba(10, 9, 8, 0.78)";
        context.fillRect(x - width / 2, y - height / 2, width, height);
        context.fillStyle = "#f1d07a";
        context.fillText(label, x, y);
        context.restore();
      }

      function drawFloorLabel(context, text, rect, depth) {
        const nearFrame = frameAt(nearEdgeDepth(depth));
        const referenceFrame = frameAt(0);
        const scale = (nearFrame.right - nearFrame.left) / (referenceFrame.right - referenceFrame.left);
        if (scale >= 0.42) drawLabel(context, text, rect, Math.min(1, scale));
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

      // Whole-view overlays for statuses that afflict the PARTY: under a net
      // the entire view is netted over; burning edges the view in flame,
      // poison washes it green, engulfed drowns it blue. The same list drives
      // the VR visor overlay.
      function partyStatusOverlays() {
        const assets = currentAssets();
        return [
          state.snaredTurns > 0 && { kind: "net", texture: environmentAsset(NET_TILE), alpha: 0.5, tile: 96 },
          state.burningTurns > 0 && { kind: "fire", texture: assets.effectFlame, color: [241, 107, 43], alpha: 0.22 },
          state.poisonedTurns > 0 && { kind: "poison", texture: assets.poisonCloud, color: [101, 168, 79], alpha: 0.2 },
          state.engulfedTurns > 0 && { kind: "engulfed", texture: assets.fog, color: [74, 162, 190], alpha: 0.26 },
          state.barbedTurns > 0 && { kind: "barbed", color: [198, 95, 58], alpha: 0.14 }
        ].filter(Boolean);
      }

      function drawPartyStatusOverlays(context, width, height) {
        for (const overlay of partyStatusOverlays()) {
          context.save();
          if (overlay.kind === "net") {
            // A real net mesh over the whole view, not a smear: tile the art.
            const entry = imageEntry(overlay.texture);
            if (entry.ready) {
              context.globalAlpha = overlay.alpha;
              setTextureSmoothing(context, overlay.texture, entry);
              for (let y = 0; y < height; y += overlay.tile) {
                for (let x = 0; x < width; x += overlay.tile) {
                  context.drawImage(entry.image, x, y, overlay.tile, overlay.tile);
                }
              }
            }
          } else {
            // Coloured vignette pressing in from the edges…
            const [r, g, b] = overlay.color;
            const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.28, width / 2, height / 2, Math.max(width, height) * 0.62);
            vignette.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
            vignette.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${overlay.alpha * 2.4})`);
            context.fillStyle = vignette;
            context.fillRect(0, 0, width, height);
            // …plus the element's art licking up from the bottom edge.
            const entry = overlay.texture && imageEntry(overlay.texture);
            if (entry && entry.ready) {
              context.globalAlpha = overlay.alpha * 1.6;
              context.globalCompositeOperation = overlay.kind === "fire" ? "lighter" : "screen";
              context.imageSmoothingEnabled = false;
              const strip = Math.max(48, height * 0.16);
              for (let x = 0; x < width; x += strip) {
                context.drawImage(entry.image, x, height - strip, strip, strip);
              }
            }
          }
          context.restore();
        }
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

      // A monster fills one 32×32 tile. Draw it as a square sized to its own
      // cell and planted on that cell's floor seam, so the tile's own padding
      // sets the apparent creature size (a rat reads small, an ogre fills the
      // tile) and the sprite shrinks and its feet rise with the floor as the
      // cell recedes — true perspective, no floating, no forced humanoid box.
      function actorTileBounds(monster, depth, offset) {
        // Stand the monster on the NEAR edge of its own tile (one band forward),
        // not the far edge — drawing it at frameAt(depth) puts it a square too far
        // back, into the next tile.
        const frame = frameAt(nearEdgeDepth(depth));
        const cellWidth = frame.right - frame.left;
        const cellHeight = frame.bottom - frame.top;
        // Strictly proportional to the cell — NO fixed minimums. A fixed
        // viewport-percent inset or sprite size outgrows the shrinking floor
        // strip at distance and shoves far monsters above their own tile.
        const size = cellWidth * 0.92;
        const center = (frame.left + frame.right) / 2 + cellWidth * offset;
        const floorSeam = frame.bottom - cellHeight * 0.04;
        // Plant the artwork's bottom (not the padded tile's) on the floor seam by
        // pushing the tile down past the seam by however much empty space sits
        // below the creature in its tile. Airborne creatures hover above it.
        const content = tileContentBox(monster.tile);
        const belowContent = (1 - content.bottom) * size;
        const tileBottom = (monster.traits?.airborne ? floorSeam - cellHeight * 0.22 : floorSeam) + belowContent;
        return [center - size / 2, tileBottom - size, size, size];
      }

      function standingBounds(depth, offset, widthScale = 0.42, heightScale = 0.58, contentBottom = 1) {
        const frame = frameAt(depth);
        const cellWidth = frame.right - frame.left;
        const cellHeight = frame.bottom - frame.top;
        const spriteWidth = cellWidth * widthScale;
        const spriteHeight = cellHeight * heightScale;
        const center = (frame.left + frame.right) / 2 + cellWidth * offset;
        const floorSeam = frame.bottom - cellHeight * 0.06;
        const tileBottom = floorSeam + (1 - contentBottom) * spriteHeight;
        return [center - spriteWidth / 2, tileBottom - spriteHeight, spriteWidth, spriteHeight];
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
        drawVerticalMappedQuad(context, wallSurfaceTexture(entry.cell), points, depth, Math.max(0.2, data.light - 0.1), "#25211d");
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
        // Side walls are NOT drawn here — they go through the distance-sorted
        // wall pass in renderViewport so every wall obeys far-to-near order.
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
        if (terrain === "lava") return { texture: environmentAsset(assets.floorScorch || assets.effectFlame), fallback: "#cf4a1e", alpha: 0.3, composite: "lighter", salt: 197, rarity: 1 };
        if (terrain === "deep-water") return { texture: environmentAsset(assets.fog), fallback: "#b8d3d2", alpha: 0.18, composite: "screen", salt: 199, rarity: 1 };
        if (terrain === "water") return { texture: environmentAsset(assets.fog), fallback: "#b8d3d2", alpha: 0.14, composite: "screen", salt: 211, rarity: 2 };

        const floor = currentFloor();
        if (floor.id.startsWith("Swamp:")) return { texture: environmentAsset(assets.floorPoison || assets.poisonCloud || assets.fog), fallback: "#8fb36c", alpha: 0.13, composite: "screen", salt: 223, rarity: 3 };
        if (floor.id.startsWith("Shoals:")) return { texture: environmentAsset(assets.fog), fallback: "#b8d3d2", alpha: 0.12, composite: "screen", salt: 227, rarity: 3 };
        if (floor.id.startsWith("Slime:")) return { texture: environmentAsset(assets.floorPoison || assets.poisonCloud || assets.fog), fallback: "#88bc55", alpha: 0.16, composite: "screen", salt: 229, rarity: 2 };
        if (floor.name.includes("Lava")) return { texture: environmentAsset(assets.floorScorch || assets.effectFlame), fallback: "#cf4a1e", alpha: 0.18, composite: "lighter", salt: 233, rarity: 3 };
        return null;
      }

      function drawFloorVeil(context, width, height, depth, offset, cell) {
        if (Math.abs(offset) > 2) return;
        const veil = floorVeilForCell(cell);
        if (!veil) return;
        if (cellHash(cell.x, cell.y, veil.salt) % veil.rarity !== 0) return;
        const data = geometryAt(depth);
        const quad = pctQuad(floorDecalPoints(depth, { left: 0.08, top: 0.08, right: 0.92, bottom: 0.98 }, offset), width, height);
        drawImageMappedQuad(context, veil.texture, quad, Math.min(1, data.light + 0.18), veil.fallback, { alpha: veil.alpha, composite: veil.composite, noShade: true, shadow: false, allowClassicFallback: false });
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
        drawImageMappedQuad(context, texture, points, Math.min(1, data.light + 0.08), "#5f5a43", { shadow: false, allowClassicFallback: false });
      }

      function floorMarkTexture(mark) {
        const assets = currentAssets();
        if (mark.kind === "scorch") return environmentAsset(assets.floorScorch || assets.effectFlame);
        if (mark.kind === "poison") return environmentAsset(assets.floorPoison || assets.poisonCloud);
        if (mark.kind === "ice") return environmentAsset(assets.floorIce || assets.fog);
        return environmentAsset(assets.floorBlood || assets.floorAccent1 || assets.floorAccent0);
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
          drawImageMappedQuad(context, floorMarkTexture(mark), points, Math.min(1, data.light + 0.1), floorMarkFallback(mark), { alpha, shadow: false, allowClassicFallback: false });
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
        const light = Math.min(1, data.light + (options.lightBoost || 0.05));
        const drawOptions = {
          alpha: options.alpha,
          composite: options.composite,
          noShade: options.noShade,
          shadeTexture: !options.noShade,
          shadow: false,
          allowClassicFallback: false
        };
        const followsVerticalPerspective = surfacePoints[0][1] !== surfacePoints[1][1] || surfacePoints[2][1] !== surfacePoints[3][1];
        if (followsVerticalPerspective) {
          drawVerticalMappedQuad(context, texture, points, depth, light, options.fallback, drawOptions);
        } else {
          drawImageMappedQuad(context, texture, points, light, options.fallback, drawOptions);
        }
      }

      // A wall block's accent decal belongs to the BLOCK, not the viewing
      // angle: the front face and the side panels must roll the same salt and
      // rarity, or the decal you walked past vanishes when you turn to face
      // it. Footprints stay per-surface (the quads have different shapes).
      const WALL_ACCENT_SPEC = { prefix: "wallAccent", salt: 59, rarity: 7, maxOffset: 2 };

      function drawWallAccent(context, width, height, depth, offset, cell) {
        drawSurfaceDecal(context, width, height, depth, offset, cell, frontFacePoints(depth, offset), {
          ...WALL_ACCENT_SPEC,
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
        // Same WALL_ACCENT_SPEC as the front face — same salt/rarity means the
        // same blocks carry the same accent texture from every direction.
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          ...WALL_ACCENT_SPEC,
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
        const openDoor = doorCellAt(cell.x, cell.y) && !closedDoorAt(cell.x, cell.y);
        if (openDoor) {
          const faceDepth = nearEdgeDepth(depth);
          const points = pctQuad(frontFacePoints(faceDepth, offset), width, height);
          drawVerticalMappedQuad(context, environmentAsset(assets.openDoor), points, faceDepth, geometryAt(faceDepth).light, "#281d13");
          if (offset === 0) drawFloorLabel(context, "open door", boundsForPoints(points), depth);
        }

        const stairs = stairsAt(cell.x, cell.y);
        if (stairs) {
          const stairQuad = pctQuad(floorDecalPoints(depth, { left: 0.24, top: 0.18, right: 0.76, bottom: 0.94 }, offset), width, height);
          const texture = environmentAsset(stairs.direction === "down" ? assets.stairsDown : assets.stairsUp);
          const rect = drawImageMappedQuad(context, texture, stairQuad, data.light, "#7f6742");
          if (rect && offset === 0) drawFloorLabel(context, stairs.direction === "down" ? "downstairs" : "upstairs", rect, depth);
        }

        const trap = trapAt(cell.x, cell.y);
        if (trap) {
          const trapQuad = pctQuad(floorDecalPoints(depth, { left: 0.3, top: 0.24, right: 0.7, bottom: 0.88 }, offset), width, height);
          const rect = drawImageMappedQuad(context, environmentAsset(trap.tile), trapQuad, data.light, "#7d4b35", { allowClassicFallback: false });
          if (rect && offset === 0) drawFloorLabel(context, trap.shortName, rect, depth);
        }

        const floorItem = itemAt(cell.x, cell.y);
        if (floorItem) {
          const itemQuad = pctQuad(floorDecalPoints(depth, { left: 0.37, top: 0.44, right: 0.63, bottom: 0.84 }, offset), width, height);
          const fallback = floorItem.kind === "quest" ? "#735fc8" : floorItem.kind === "gold" ? "#c9a33f" : "#6e8058";
          const rect = drawImageMappedQuad(context, floorItem.tile, itemQuad, data.light, fallback);
          if (rect && offset === 0) drawFloorLabel(context, floorItem.shortName, rect, depth);
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
          drawImageMappedQuad(
            context,
            environmentAsset(decor.tile),
            decorQuad,
            Math.min(1, data.light + 0.05),
            "#80663b",
            { shadow: false, alpha: spent ? 0.5 : undefined }
          );
          if (spent) drawSpentFloorDecor(context, decorQuad);
          return;
        }

        const tall = decor.name.includes("column") || decor.name.includes("idol");
        const texture = environmentAsset(decor.tile);
        const bounds = standingBounds(nearEdgeDepth(depth), offset, tall ? 0.38 : 0.44, tall ? 0.7 : 0.56, tileContentBox(texture).bottom);
        const rect = drawSprite(
          context,
          texture,
          bounds,
          width,
          height,
          spent ? { alpha: 0.52, filter: "grayscale(0.9) brightness(0.7)" } : {}
        );
        if (spent && rect) drawSpentDecorBadge(context, rect);
        if (rect && offset === 0) drawFloorLabel(context, decor.shortName, rect, depth);
      }

      const VIEWPORT_TARGET_MAX_DEPTH = 6;
      const VIEWPORT_FLOOR_TARGETS = {
        item: { left: 0.37, top: 0.44, right: 0.63, bottom: 0.84 },
        trap: { left: 0.3, top: 0.24, right: 0.7, bottom: 0.88 },
        stairs: { left: 0.24, top: 0.18, right: 0.76, bottom: 0.94 },
        floorDecor: { left: 0.17, top: 0.16, right: 0.83, bottom: 0.98 }
      };
      const VIEWPORT_DOOR_TARGET = { left: 0.2, top: 0.16, right: 0.8, bottom: 0.88 };

      function viewportTargetView(x, y) {
        const view = viewCoordinates(x, y);
        if (view.depth < 1 || view.depth > VIEWPORT_TARGET_MAX_DEPTH) return null;
        if (Math.abs(view.offset) > Math.max(2, Math.ceil(view.depth * 0.7))) return null;
        return view;
      }

      function viewportFloorTargetRect(width, height, view, footprint) {
        return boundsForPoints(pctQuad(floorDecalPoints(view.depth, footprint, view.offset), width, height));
      }

      function viewportDoorTargetRect(width, height, view) {
        const faceDepth = nearEdgeDepth(view.depth);
        return boundsForPoints(pctQuad(quadDecalPoints(frontFacePoints(faceDepth, view.offset), VIEWPORT_DOOR_TARGET), width, height));
      }

      function viewportDecorTargetRect(width, height, view, decor) {
        if (decor.kind === "floor") return viewportFloorTargetRect(width, height, view, VIEWPORT_FLOOR_TARGETS.floorDecor);
        const tall = decor.name.includes("column") || decor.name.includes("idol");
        return pctRect(standingBounds(nearEdgeDepth(view.depth), view.offset, tall ? 0.38 : 0.44, tall ? 0.7 : 0.56), width, height);
      }

      function viewportTargetId(kind, entry) {
        return `${kind}:${entry.id || keyOf(entry.x, entry.y)}:${entry.x},${entry.y}`;
      }

      function viewportItemKind(item) {
        if (item.kind === "quest") return "prize";
        if (item.kind === "gold") return "gold";
        return "item";
      }

      function viewportItemLabel(item, enabled) {
        if (!enabled) return item.shortName || item.name;
        if (item.kind === "gold") return "Pick up gold";
        return `Pick up ${item.shortName || item.name}`;
      }

      function viewportDoorLabel(x, y, enabled) {
        if (!enabled) return closedDoorAt(x, y) ? "closed door" : "open door";
        return closedDoorAt(x, y) ? "Open door" : "Close door";
      }

      function viewportInteractionSpec() {
        const item = itemAt(state.x, state.y);
        if (item) return { kind: viewportItemKind(item), entry: item, action: "pickup" };
        const stairs = stairsAt(state.x, state.y);
        if (stairs) return { kind: "stairs", entry: { ...stairs, id: `stairs-${stairs.direction}-${state.x}-${state.y}`, x: state.x, y: state.y, direction: stairs.direction }, action: "interact" };
        const trap = typeof trapTarget === "function" ? trapTarget() : null;
        if (trap) return { kind: "trap", entry: trap, action: "disarm" };
        const fixture = typeof fixtureTarget === "function" ? fixtureTarget() : null;
        if (fixture) return { kind: "decor", entry: fixture.decor, action: "interact" };
        const door = typeof doorTarget === "function" ? doorTarget() : null;
        if (door) return { kind: "door", entry: { id: `door-${door.x}-${door.y}`, x: door.x, y: door.y }, action: "interact" };
        return null;
      }

      function viewportInteractionRect(width, height, kind, entry, view) {
        if (kind === "item" || kind === "gold" || kind === "prize") return viewportFloorTargetRect(width, height, view, VIEWPORT_FLOOR_TARGETS.item);
        if (kind === "trap") return viewportFloorTargetRect(width, height, view, VIEWPORT_FLOOR_TARGETS.trap);
        if (kind === "stairs") return viewportFloorTargetRect(width, height, view, VIEWPORT_FLOOR_TARGETS.stairs);
        if (kind === "decor") return viewportDecorTargetRect(width, height, view, entry);
        return viewportDoorTargetRect(width, height, view);
      }

      function viewportInteractionLabel(kind, entry, enabled) {
        if (kind === "item" || kind === "gold" || kind === "prize") return viewportItemLabel(entry, enabled);
        if (kind === "trap") return enabled ? `Disarm ${entry.shortName || entry.name}` : entry.shortName || entry.name;
        if (kind === "stairs") return enabled ? "Use stairs" : entry.direction === "down" ? "downstairs" : "upstairs";
        if (kind === "decor") return enabled ? `Use ${entry.shortName || entry.name}` : entry.shortName || entry.name;
        return viewportDoorLabel(entry.x, entry.y, enabled);
      }

      function viewportTargetIntersects(rect, width, height) {
        return rect.x + rect.width > 0 && rect.x < width && rect.y + rect.height > 0 && rect.y < height;
      }

      function viewportRectSamplePoints(rect) {
        return [
          { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5 },
          { x: rect.x, y: rect.y },
          { x: rect.x + rect.width, y: rect.y },
          { x: rect.x + rect.width, y: rect.y + rect.height },
          { x: rect.x, y: rect.y + rect.height }
        ];
      }

      function viewportPointInQuad(point, quad) {
        let inside = false;
        for (let current = 0, previous = quad.length - 1; current < quad.length; previous = current, current += 1) {
          const a = quad[current];
          const b = quad[previous];
          const crosses = (a.y > point.y) !== (b.y > point.y);
          if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
      }

      function viewportRectHitsQuad(rect, quad) {
        return viewportRectSamplePoints(rect).some((point) => viewportPointInQuad(point, quad));
      }

      function viewportFrontWallBlocksTarget(width, height, rect, targetView, x, y, entry) {
        if (entry.x === x && entry.y === y) return false;
        if (!solidAt(x, y)) return false;
        const view = viewCoordinates(x, y);
        if (view.depth < 1 || view.depth >= targetView.depth) return false;
        if (Math.abs(view.offset) > Math.max(2, Math.ceil(view.depth * 0.7))) return false;
        const quad = pctQuad(frontFacePoints(nearEdgeDepth(view.depth), view.offset), width, height);
        return viewportRectHitsQuad(rect, quad);
      }

      function viewportSideWallBlocksTarget(width, height, rect, targetView, cell, side, entry) {
        if (side.cell.x === entry.x && side.cell.y === entry.y) return false;
        const view = viewCoordinates(cell.x, cell.y);
        if (view.depth < 1 || view.depth >= targetView.depth) return false;
        const quad = pctQuad(sideFacePoints(view.depth, side.boundary), width, height);
        return viewportRectHitsQuad(rect, quad);
      }

      function viewportTargetOccluded(width, height, rect, view, entry) {
        const floor = currentFloor();
        for (let y = -1; y <= floor.map.height; y += 1) {
          for (let x = -1; x <= floor.map.width; x += 1) {
            if (boundaryWallCell(x, y) && viewportFrontWallBlocksTarget(width, height, rect, view, x, y, entry)) return true;
          }
        }
        for (const row of mapCellsInViewRows()) {
          if (row.depth >= view.depth) continue;
          const open = row.cells.filter((cell) => !solidAt(cell.x, cell.y));
          for (const cell of open) {
            for (const side of sideWallEntries(cell, cell.offset)) {
              if (viewportSideWallBlocksTarget(width, height, rect, view, cell, side, entry)) return true;
            }
          }
        }
        return false;
      }

      function viewportInteractionTarget(width, height, kind, entry, enabled, action = null) {
        const view = viewportTargetView(entry.x, entry.y);
        if (!view) return null;
        const rect = viewportInteractionRect(width, height, kind, entry, view);
        if (!viewportTargetIntersects(rect, width, height)) return null;
        if (viewportTargetOccluded(width, height, rect, view, entry)) return null;
        return {
          id: viewportTargetId(kind, entry),
          kind,
          label: viewportInteractionLabel(kind, entry, enabled),
          action: enabled ? action : null,
          enabled,
          rect,
          cell: { x: entry.x, y: entry.y },
          depth: view.depth,
          offset: view.offset
        };
      }

      function viewportInteractionTargets(width, height) {
        const floorState = currentFloorState();
        const floor = currentFloor();
        const targets = [];
        const active = viewportInteractionSpec();
        const activeId = active ? viewportTargetId(active.kind, active.entry) : null;
        const seenIds = new Set();
        const pushTarget = (kind, entry) => {
          const id = viewportTargetId(kind, entry);
          if (seenIds.has(id)) return;
          const enabled = id === activeId;
          const target = viewportInteractionTarget(width, height, kind, entry, enabled, enabled ? active.action : null);
          if (!target) return;
          seenIds.add(id);
          targets.push(target);
        };

        if (active) pushTarget(active.kind, active.entry);
        for (const item of floorState.floorItems) {
          if (floorState.discovered.has(keyOf(item.x, item.y))) pushTarget(viewportItemKind(item), item);
        }
        for (const trap of floorState.traps) {
          if (trap.armed && floorState.discovered.has(keyOf(trap.x, trap.y))) pushTarget("trap", trap);
        }
        for (const stair of Object.values(floor.stairs).filter(Boolean)) {
          if (floorState.discovered.has(keyOf(stair.x, stair.y))) {
            const direction = stairsAt(stair.x, stair.y)?.direction || "up";
            pushTarget("stairs", { ...stair, direction, id: `stairs-${direction}-${stair.x}-${stair.y}` });
          }
        }
        for (const decor of floor.decor || []) {
          if (floorState.discovered.has(keyOf(decor.x, decor.y))) pushTarget("decor", decor);
        }
        for (let y = 0; y < floor.map.height; y += 1) {
          for (let x = 0; x < floor.map.width; x += 1) {
            if (floorState.discovered.has(keyOf(x, y)) && doorCellAt(x, y)) pushTarget("door", { id: `door-${x}-${y}`, x, y });
          }
        }

        return targets.sort((a, b) => Number(a.enabled) - Number(b.enabled) || b.depth - a.depth || Math.abs(b.offset) - Math.abs(a.offset));
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
        const rect = drawSprite(context, monster.tile, actorTileBounds(monster, depth, offset), width, height);
        if (!rect) return;
        drawMonsterStatusOverlays(context, monster, rect);
        drawRangedCue(context, monster, rect);
        drawMonsterStatusCue(context, monster, rect);
        drawHealthBar(context, monster, rect);
      }

      function drawFrontSurface(context, width, height, depth, offset, cell) {
        drawFrontSurfaceBase(context, width, height, depth, offset, cell);
        drawFrontSurfaceDetails(context, width, height, depth, offset, cell);
      }

      function drawFrontSurfaceBase(context, width, height, depth, offset, cell) {
        const kind = mapKind(cell.x, cell.y);
        if (kind === "floor") return;
        const faceDepth = nearEdgeDepth(depth);
        const data = geometryAt(faceDepth);
        const assets = currentAssets();
        const points = pctQuad(frontFacePoints(faceDepth, offset), width, height);
        if (kind === "door") {
          drawVerticalMappedQuad(context, environmentAsset(assets.door), points, faceDepth, data.light, "#281d13");
          strokeQuad(context, points, "rgba(238, 193, 101, 0.12)");
          return;
        }
        drawVerticalMappedQuad(context, wallSurfaceTexture(cell), points, faceDepth, data.light, "#2e2a24");
      }

      function drawFrontSurfaceDetails(context, width, height, depth, offset, cell, occluders = []) {
        const kind = mapKind(cell.x, cell.y);
        if (kind !== "wall") return;
        const faceDepth = nearEdgeDepth(depth);
        const data = geometryAt(faceDepth);
        const points = pctQuad(frontFacePoints(faceDepth, offset), width, height);
        const surface = frontFacePoints(faceDepth, offset);
        withFrontDetailClip(context, points, occluders, () => {
          drawWallRelief(context, width, height, faceDepth, cell, surface);
          drawWallPatch(context, width, height, faceDepth, offset, cell, surface);
          drawWallStain(context, width, height, faceDepth, offset, cell, surface);
          drawWallAccent(context, width, height, faceDepth, offset, cell);
          drawWallGlow(context, width, height, faceDepth, offset, cell, surface);
          strokeQuad(context, points, `rgba(238, 193, 101, ${Math.max(0.05, data.light * 0.09)})`);
        });
      }

      function drawCellContents(context, width, height, depth, offset, cell) {
        drawDecor(context, width, height, depth, offset, cell);
        drawFloorFeature(context, width, height, depth, offset, cell);
        drawActor(context, width, height, depth, offset, cell);
        drawCloud(context, width, height, depth, offset, cell);
        drawEffect(context, width, height, depth, offset, cell);
      }

      function drawViewCell(context, width, height, depth, cell) {
        if (solidAt(cell.x, cell.y)) {
          drawFrontSurface(context, width, height, depth, cell.offset, cell);
          return;
        }
        drawCellShell(context, width, height, depth, cell.offset, cell);
        for (const entry of sideWallEntries(cell, cell.offset)) drawSideWall(context, width, height, depth, cell.offset, entry, geometryAt(depth));
        drawCellContents(context, width, height, depth, cell.offset, cell);
      }

      // THE WALL ORDER. Axis-aligned, band by band from the farthest row to the
      // nearest, in each band: off-axis wall textures, side walls, facing wall
      // textures, then every front wall's surface details and cell contents.
      // A solid cell's face closes off the band one step nearer, so each row's
      // solids are held as `pending` and drawn during the next (nearer) row:
      // off-axis wall bodies go under the side walls (you see those blocks'
      // flanks), while all front-wall decals and relief draw after the side
      // walls so a block keeps the same visible markings when viewed head-on.
      // Returns the layer list in draw order; renderViewport draws it verbatim
      // and the render-order regression tests assert on this same list.
      function sceneWallLayers(context, width, height) {
        const layers = [];
        const pushFrontBases = (fronts, facing) => {
          for (const front of fronts) {
            if ((front.cell.offset === 0) !== facing) continue;
            layers.push({ kind: "front-base", depth: front.depth, offset: front.cell.offset, draw: () => drawFrontSurfaceBase(context, width, height, front.depth, front.cell.offset, front.cell) });
          }
        };
        const pushFrontDetails = (fronts, occluders = []) => {
          for (const front of fronts) {
            layers.push({ kind: "front-detail", depth: front.depth, offset: front.cell.offset, draw: () => drawFrontSurfaceDetails(context, width, height, front.depth, front.cell.offset, front.cell, occluders) });
          }
        };
        let pending = []; // solids one row deeper — their faces close off THIS row
        for (const row of mapCellsInViewRows()) { // far → near
          const depth = row.depth;
          const open = row.cells.filter((cell) => !solidAt(cell.x, cell.y));
          for (const cell of open) drawCellShell(context, width, height, depth, cell.offset, cell);
          pushFrontBases(pending, false); // far wall: the off-axis faces, under the side walls
          const sideOccluders = [];
          for (const cell of open) {
            for (const entry of sideWallEntries(cell, cell.offset)) {
              sideOccluders.push(pctQuad(sideFacePoints(depth, entry.boundary), width, height));
              layers.push({ kind: "side", depth, offset: cell.offset, draw: () => drawSideWall(context, width, height, depth, cell.offset, entry, geometryAt(depth)) });
            }
          }
          pushFrontBases(pending, true); // the wall the party faces — after its side walls
          pushFrontDetails(pending, sideOccluders);
          for (const cell of open) layers.push({ kind: "contents", depth, offset: cell.offset, draw: () => drawCellContents(context, width, height, depth, cell.offset, cell) });
          pending = row.cells.filter((cell) => solidAt(cell.x, cell.y)).map((cell) => ({ depth, cell }));
        }
        pushFrontBases(pending, false); // nearest band: blocks beside the party
        pushFrontBases(pending, true);
        pushFrontDetails(pending);
        return layers;
      }

      function renderViewport() {
        const { context, width, height } = ensureViewportCanvas();
        viewportCanvas.style.imageRendering = state.tileset === "linocut" ? "auto" : "pixelated";
        context.clearRect(0, 0, width, height);
        context.imageSmoothingEnabled = false;
        context.fillStyle = "#070606";
        context.fillRect(0, 0, width, height);

        for (const layer of sceneWallLayers(context, width, height)) layer.draw();
        drawEffectTrails(context, width, height);

        drawViewportHaze(context, width, height);
        drawBranchAtmosphere(context, width, height);
        drawEffectWash(context, width, height);
        drawPartyStatusOverlays(context, width, height);
        if (state.victory || state.defeated) drawLabel(context, state.victory ? "escaped" : "defeated", { x: width * 0.4, y: height * 0.42, width: width * 0.2, height: 30 });
        if (typeof renderViewportInteractions === "function") renderViewportInteractions(width, height);
      }

      Object.assign(context, {
        imageEntry,
        tileContentBox,
        cellHash,
        assetValues,
        themedAsset,
        wallSurfaceTexture,
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
        calculateViewportProjection,
        updateViewportProjection,
        viewportProjectionFor,
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
        monsterStatusOverlays,
        drawMonsterStatusOverlays,
        partyStatusOverlays,
        drawPartyStatusOverlays,
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
        actorTileBounds,
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
        viewportTargetView,
        viewportFloorTargetRect,
        viewportDoorTargetRect,
        viewportDecorTargetRect,
        viewportTargetIntersects,
        viewportInteractionSpec,
        viewportInteractionTarget,
        viewportInteractionTargets,
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
        drawFrontSurfaceBase,
        drawFrontSurfaceDetails,
        drawViewCell,
        drawCellContents,
        sceneWallLayers,
        renderViewport,
      });
    }
  };
}());
