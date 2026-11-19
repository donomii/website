(function () {
  window.CotBRuntime = window.CotBRuntime || {};
  window.CotBRuntime.installViewportRendering = function (context) {
    with (context) {
      let viewportRenderQueued = false;
      function scheduleViewportRender() {
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          if (viewportRenderQueued) return;
          viewportRenderQueued = true;
          window.requestAnimationFrame(() => {
            viewportRenderQueued = false;
            renderViewport();
          });
          return;
        }
        renderViewport();
      }

      function imageEntry(src, allowClassicFallback = true) {
        if (typeof src === "string" && src.startsWith("furniture://") && typeof ensureFurnitureSprite === "function") {
          return ensureFurnitureSprite(src.slice(12));
        }
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
            scheduleViewportRender();
          };
          image.onerror = () => {
            if (canFallback && entry.fallbackSrc) {
              load(entry.fallbackSrc, false);
              return;
            }
            entry.failed = true;
            scheduleViewportRender();
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
        const maxScale = state.tileset === "linocut" ? 2 : 1.5;
        const scale = Math.min(window.devicePixelRatio || 1, maxScale);
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
        if (depth > 4) return;
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

      function boundsForPoints(points) {
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
        for (let i = 0; i < points.length; i += 1) {
          const p = points[i];
          if (p.x < left) left = p.x;
          if (p.x > right) right = p.x;
          if (p.y < top) top = p.y;
          if (p.y > bottom) bottom = p.y;
        }
        return { x: left, y: top, width: right - left, height: bottom - top };
      }

      function isAxisAlignedRect(points) {
        return points.length === 4
          && Math.abs(points[0].y - points[1].y) < 0.05
          && Math.abs(points[3].y - points[2].y) < 0.05
          && Math.abs(points[0].x - points[3].x) < 0.05
          && Math.abs(points[1].x - points[2].x) < 0.05;
      }

      function isHorizontalTrapezoid(points) {
        return points.length === 4
          && Math.abs(points[0].y - points[1].y) < 0.05
          && Math.abs(points[3].y - points[2].y) < 0.05;
      }

      function isVerticalTrapezoid(points) {
        return points.length === 4
          && Math.abs(points[0].x - points[3].x) < 0.05
          && Math.abs(points[1].x - points[2].x) < 0.05;
      }

      function quadOutsideViewport(bounds) {
        if (!viewportProjection) return false;
        return bounds.x + bounds.width <= -2
          || bounds.x >= viewportProjection.width + 2
          || bounds.y + bounds.height <= -2
          || bounds.y >= viewportProjection.height + 2;
      }

      function drawHorizontalTrapezoidStrips(context, img, points, maxStrips) {
        let y0 = points[0].y;
        let xT0 = Math.min(points[0].x, points[1].x);
        let xT1 = Math.max(points[0].x, points[1].x);
        let y1 = points[3].y;
        let xB0 = Math.min(points[3].x, points[2].x);
        let xB1 = Math.max(points[3].x, points[2].x);
        if (y1 < y0) {
          const ty = y0; y0 = y1; y1 = ty;
          const t0 = xT0; xT0 = xB0; xB0 = t0;
          const t1 = xT1; xT1 = xB1; xB1 = t1;
        }
        const spanY = y1 - y0;
        if (spanY < 0.5) return;
        const vpH = viewportProjection ? viewportProjection.height : y1;
        const drawMinY = Math.max(0, y0);
        const drawMaxY = Math.min(vpH, y1);
        const visibleH = drawMaxY - drawMinY;
        if (visibleH < 0.5) return;

        const imgW = img.width || img.naturalWidth || 32;
        const imgH = img.height || img.naturalHeight || 32;
        const strips = Math.min(maxStrips, Math.max(2, Math.ceil(visibleH / 8)));
        const step = visibleH / strips;
        const dxL = xB0 - xT0;
        const dxR = xB1 - xT1;

        for (let i = 0; i < strips; i += 1) {
          const sy0 = drawMinY + i * step;
          const sy1 = i === strips - 1 ? drawMaxY : sy0 + step;
          const t0 = Math.max(0, Math.min(1, (sy0 - y0) / spanY));
          const t1 = Math.max(0, Math.min(1, (sy1 - y0) / spanY));
          const lx0 = xT0 + dxL * t0;
          const lx1 = xT0 + dxL * t1;
          const rx0 = xT1 + dxR * t0;
          const rx1 = xT1 + dxR * t1;
          const leftX = (lx0 < lx1 ? lx0 : lx1) - 1;
          const rightX = (rx0 > rx1 ? rx0 : rx1) + 1;
          const w = rightX - leftX;
          if (w < 0.5) continue;
          const v0 = t0 * imgH;
          const vH = Math.max(0.5, Math.min(imgH - v0, (t1 - t0) * imgH));
          context.drawImage(img, 0, v0, imgW, vH, leftX, sy0, w, (sy1 - sy0) + 0.75);
        }
      }

      function drawVerticalTrapezoidStrips(context, img, points, maxStrips) {
        let x0 = points[0].x;
        let top0 = Math.min(points[0].y, points[3].y);
        let bot0 = Math.max(points[0].y, points[3].y);
        let x1 = points[1].x;
        let top1 = Math.min(points[1].y, points[2].y);
        let bot1 = Math.max(points[1].y, points[2].y);
        if (x1 < x0) {
          const tx = x0; x0 = x1; x1 = tx;
          const tt = top0; top0 = top1; top1 = tt;
          const tb = bot0; bot0 = bot1; bot1 = tb;
        }
        const spanX = x1 - x0;
        if (spanX < 0.5) return;
        const vpW = viewportProjection ? viewportProjection.width : x1;
        const drawMinX = Math.max(0, x0);
        const drawMaxX = Math.min(vpW, x1);
        const visibleW = drawMaxX - drawMinX;
        if (visibleW < 0.5) return;

        const imgW = img.width || img.naturalWidth || 32;
        const imgH = img.height || img.naturalHeight || 32;
        const strips = Math.min(maxStrips, Math.max(2, Math.ceil(visibleW / 8)));
        const step = visibleW / strips;
        const dTop = top1 - top0;
        const dBot = bot1 - bot0;

        for (let i = 0; i < strips; i += 1) {
          const sx0 = drawMinX + i * step;
          const sx1 = i === strips - 1 ? drawMaxX : sx0 + step;
          const t0 = Math.max(0, Math.min(1, (sx0 - x0) / spanX));
          const t1 = Math.max(0, Math.min(1, (sx1 - x0) / spanX));
          const yt0 = top0 + dTop * t0;
          const yt1 = top0 + dTop * t1;
          const yb0 = bot0 + dBot * t0;
          const yb1 = bot0 + dBot * t1;
          const yTop = (yt0 < yt1 ? yt0 : yt1) - 1;
          const yBot = (yb0 > yb1 ? yb0 : yb1) + 1;
          const h = yBot - yTop;
          if (h < 0.5) continue;
          const u0 = t0 * imgW;
          const uW = Math.max(0.5, Math.min(imgW - u0, (t1 - t0) * imgW));
          context.drawImage(img, u0, 0, uW, imgH, sx0, yTop, (sx1 - sx0) + 0.75, h);
        }
      }

      function drawHorizontalMappedQuad(context, texture, points, depth, light, fallback) {
        const bounds = boundsForPoints(points);
        if (quadOutsideViewport(bounds)) return;
        const entry = imageEntry(texture);

        if (!entry.ready) {
          fillQuad(context, points, fallback, light);
          return;
        }

        context.save();
        setTextureSmoothing(context, texture, entry);
        drawQuadPath(context, points);
        context.clip();

        if (isHorizontalTrapezoid(points)) {
          const maxStrips = depth <= 1 ? 12 : depth <= 2 ? 9 : depth <= 4 ? 6 : 3;
          drawHorizontalTrapezoidStrips(context, entry.image, points, maxStrips);
        } else {
          context.drawImage(entry.image, bounds.x, bounds.y, Math.max(1, bounds.width), Math.max(1, bounds.height));
        }

        context.restore();
        shadeQuad(context, points, light);
      }

      function drawImageMappedQuad(context, texture, points, light, fallback, options = {}) {
        const bounds = boundsForPoints(points);
        if (quadOutsideViewport(bounds)) return bounds;
        const entry = imageEntry(texture, options.allowClassicFallback !== false);

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

        if (bounds.width < 0.5 || bounds.height < 0.5) return bounds;

        context.save();
        setTextureSmoothing(context, texture, entry);
        if (options.composite) context.globalCompositeOperation = options.composite;
        if (options.alpha !== undefined) context.globalAlpha = options.alpha;
        if (options.shadeTexture) context.filter = `brightness(${Math.max(0, Math.min(1, light))})`;

        if (isAxisAlignedRect(points)) {
          context.drawImage(entry.image, bounds.x, bounds.y, bounds.width, bounds.height);
        } else if (isHorizontalTrapezoid(points)) {
          drawQuadPath(context, points);
          context.clip();
          drawHorizontalTrapezoidStrips(context, entry.image, points, 8);
        } else {
          drawQuadPath(context, points);
          context.clip();
          context.drawImage(entry.image, bounds.x, bounds.y, bounds.width, bounds.height);
        }

        context.restore();
        if (!options.noShade && !options.shadeTexture) shadeQuad(context, points, light);
        return bounds;
      }

      function drawVerticalMappedQuad(context, texture, points, depth, light, fallback, options = {}) {
        const bounds = boundsForPoints(points);
        if (quadOutsideViewport(bounds)) return bounds;
        const entry = imageEntry(texture, options.allowClassicFallback !== false);

        if (!entry.ready) {
          if (options.shadow === false) return bounds;
          fillQuad(context, points, fallback, light);
          return bounds;
        }

        if (bounds.width < 0.5 || bounds.height < 0.5) return bounds;

        context.save();
        setTextureSmoothing(context, texture, entry);
        if (options.composite) context.globalCompositeOperation = options.composite;
        if (options.alpha !== undefined) context.globalAlpha = options.alpha;
        if (options.shadeTexture) context.filter = `brightness(${Math.max(0, Math.min(1, light))})`;

        if (isAxisAlignedRect(points)) {
          context.drawImage(entry.image, bounds.x, bounds.y, bounds.width, bounds.height);
        } else if (isVerticalTrapezoid(points)) {
          drawQuadPath(context, points);
          context.clip();
          const maxStrips = depth <= 1 ? 20 : depth <= 2 ? 12 : depth <= 4 ? 8 : 4;
          drawVerticalTrapezoidStrips(context, entry.image, points, maxStrips);
        } else {
          drawQuadPath(context, points);
          context.clip();
          context.drawImage(entry.image, bounds.x, bounds.y, bounds.width, bounds.height);
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
        if (quadOutsideViewport(rect)) return null;
        context.save();
        if (!options.filter && (options.alpha === undefined || options.alpha > 0.65)) {
          context.fillStyle = "rgba(0, 0, 0, 0.36)";
          context.beginPath();
          context.ellipse(
            rect.x + rect.width * 0.5,
            rect.y + rect.height * 0.94,
            Math.max(2, rect.width * 0.34),
            Math.max(1.5, rect.height * 0.08),
            0,
            0,
            Math.PI * 2
          );
          context.fill();
        }
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
        const noir = typeof isNoirLighting === "function" && isNoirLighting();
        if (noir) {
          const pulse = ((state.turnCount || 0) % 2) * 0.03;
          const noirGrad = context.createRadialGradient(width * 0.5, height * 0.54, width * 0.06, width * 0.5, height * 0.54, width * 0.52);
          noirGrad.addColorStop(0, `rgba(255, 168, 72, ${0.18 + pulse})`);
          noirGrad.addColorStop(0.42, "rgba(18, 10, 6, 0.34)");
          noirGrad.addColorStop(1, "rgba(3, 2, 3, 0.94)");
          context.fillStyle = noirGrad;
          context.fillRect(0, 0, width, height);
          return;
        }
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

      const MAX_VIEW_DEPTH = 10;

      function viewHorizontalBounds(width, height) {
        const proj = width && height ? viewportProjectionFor(width, height) : viewportProjection;
        if (!proj || !proj.xScale) return { minPctX: -25, maxPctX: 125 };
        return {
          minPctX: Math.min(0, -proj.xOffset / proj.xScale),
          maxPctX: Math.max(100, (proj.width - proj.xOffset) / proj.xScale)
        };
      }

      function cellInHorizontalFrustum(depth, offset, bounds, marginCells = 0) {
        if (depth === 1 && Math.abs(offset) <= 1) return true;
        const nearFrame = frameAt(Math.max(0, depth - 1));
        const farFrame = frameAt(depth);
        const nearW = nearFrame.right - nearFrame.left;
        const farW = farFrame.right - farFrame.left;
        const pad = nearW * marginCells;
        const xMin = Math.min(50 + (offset - 0.5) * nearW, 50 + (offset - 0.5) * farW);
        const xMax = Math.max(50 + (offset + 0.5) * nearW, 50 + (offset + 0.5) * farW);
        return xMax >= bounds.minPctX - pad && xMin <= bounds.maxPctX + pad;
      }

      function mapCellsInViewRows(width = null, height = null, maxDepth = MAX_VIEW_DEPTH) {
        const rows = new Map();
        const floor = currentFloor();
        const bounds = viewHorizontalBounds(width, height);
        const addCell = (x, y, depth, offset) => {
          if (!rows.has(depth)) rows.set(depth, []);
          rows.get(depth).push({ x, y, offset });
        };

        // Flood-fill open cells visible within the forward frustum starting at the
        // party's cell, then include any solid wall cell 8-adjacent to a visible
        // open cell. This skips rooms sealed behind solid walls as well as
        // off-screen and beyond-horizon cells.
        if (!solidAt(state.x, state.y)) {
          const seenOpen = new Set();
          const emitted = new Set();
          const queue = [{ x: state.x, y: state.y, depth: 1, offset: 0 }];
          seenOpen.add(keyOf(state.x, state.y));
          let head = 0;

          while (head < queue.length) {
            const cur = queue[head++];
            const curKey = keyOf(cur.x, cur.y);
            if (!emitted.has(curKey) && cellInHorizontalFrustum(cur.depth, cur.offset, bounds, 0)) {
              emitted.add(curKey);
              addCell(cur.x, cur.y, cur.depth, cur.offset);
            }

            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                const nx = cur.x + dx;
                const ny = cur.y + dy;
                if (!boundaryWallCell(nx, ny)) continue;
                const view = viewCoordinates(nx, ny);
                if (view.depth < 1) continue;
                const nKey = keyOf(nx, ny);
                if (solidAt(nx, ny)) {
                  if (view.depth <= maxDepth + 1 && !emitted.has(nKey) && cellInHorizontalFrustum(view.depth, view.offset, bounds, 0)) {
                    emitted.add(nKey);
                    addCell(nx, ny, view.depth, view.offset);
                  }
                } else if (view.depth <= maxDepth && (dx === 0 || dy === 0) && !seenOpen.has(nKey)) {
                  if (cellInHorizontalFrustum(view.depth, view.offset, bounds, 1)) {
                    seenOpen.add(nKey);
                    queue.push({ x: nx, y: ny, depth: view.depth, offset: view.offset });
                  }
                }
              }
            }
          }
        } else {
          for (let y = -1; y <= floor.map.height; y += 1) {
            for (let x = -1; x <= floor.map.width; x += 1) {
              if (!boundaryWallCell(x, y)) continue;
              const view = viewCoordinates(x, y);
              if (view.depth < 1 || view.depth > maxDepth) continue;
              if (!cellInHorizontalFrustum(view.depth, view.offset, bounds, 0)) continue;
              addCell(x, y, view.depth, view.offset);
            }
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

      function wireframeEnabled() {
        return typeof isWireframeStyle === "function" && isWireframeStyle();
      }

      function drawSideWall(context, width, height, depth, offset, entry, data) {
        const points = pctQuad(sideFacePoints(depth, entry.boundary), width, height);
        const surface = sideFacePoints(depth, entry.boundary);
        if (wireframeEnabled()) {
          const glow = Math.max(0.24, Math.min(1, data.light + 0.12));
          context.save();
          drawQuadPath(context, points);
          context.fillStyle = "#030a05";
          context.fill();
          context.lineWidth = Math.max(1.2, 2.2 - depth * 0.18);
          context.strokeStyle = `rgba(68, 255, 132, ${glow})`;
          context.stroke();
          const midTopX = lerp(points[0].x, points[1].x, 0.5);
          const midTopY = lerp(points[0].y, points[1].y, 0.5);
          const midBotX = lerp(points[3].x, points[2].x, 0.5);
          const midBotY = lerp(points[3].y, points[2].y, 0.5);
          context.beginPath();
          context.moveTo(midTopX, midTopY);
          context.lineTo(midBotX, midBotY);
          context.lineWidth = 1;
          context.strokeStyle = `rgba(68, 255, 132, ${glow * 0.42})`;
          context.stroke();
          context.restore();
          return;
        }
        drawVerticalMappedQuad(context, wallSurfaceTexture(entry.cell), points, depth, Math.max(0.2, data.light - 0.1), "#25211d");
        drawWallRelief(context, width, height, depth, entry.cell, surface, true);
        drawRoomWallTrim(context, width, height, depth, offset, entry.cell, surface, data, true);
        drawWallPatch(context, width, height, depth, offset, entry.cell, surface);
        drawWallStain(context, width, height, depth, offset, entry.cell, surface);
        drawSideWallAccent(context, width, height, depth, offset, entry.cell, surface);
        drawWallGlow(context, width, height, depth, offset, entry.cell, surface);
        strokeQuad(context, points, `rgba(11, 10, 9, ${Math.max(0.2, 0.56 - data.light * 0.25)})`);
      }

      function drawRoomFloorTheme(context, width, height, depth, offset, cell, floorQuad, data) {
        if (typeof cellThemeAt !== "function") return;
        if (terrainAt(cell.x, cell.y) !== "floor") return;
        const zone = cellThemeAt(cell.x, cell.y);
        if (!zone) return;
        const floorSurf = floorSegmentPoints(depth, offset);
        const alphaScale = Math.max(0.25, Math.min(1, data.light));

        if (zone.kind === "corridor") {
          // Corridors get shadowed side strips and a worn pale center runner so
          // narrow passages immediately feel distinct from furnished chambers.
          context.save();
          const leftStrip = pctQuad(quadDecalPoints(floorSurf, { left: 0, top: 0, right: 0.16, bottom: 1 }), width, height);
          const rightStrip = pctQuad(quadDecalPoints(floorSurf, { left: 0.84, top: 0, right: 1, bottom: 1 }), width, height);
          context.fillStyle = `rgba(0, 0, 0, ${0.32 * alphaScale})`;
          drawQuadPath(context, leftStrip);
          context.fill();
          drawQuadPath(context, rightStrip);
          context.fill();
          const runner = pctQuad(quadDecalPoints(floorSurf, { left: 0.24, top: 0.04, right: 0.76, bottom: 0.96 }), width, height);
          context.fillStyle = `rgba(168, 152, 124, ${0.09 * alphaScale})`;
          drawQuadPath(context, runner);
          context.fill();
          context.restore();
          return;
        }

        const theme = zone.theme;
        if (!theme) return;
        context.save();
        if (theme.floorTint) {
          drawQuadPath(context, floorQuad);
          context.fillStyle = theme.floorTint;
          context.fill();
        }
        if (theme.floorPattern === "rug") {
          const rugQuad = pctQuad(quadDecalPoints(floorSurf, { left: 0.14, top: 0.12, right: 0.86, bottom: 0.88 }), width, height);
          drawQuadPath(context, rugQuad);
          context.fillStyle = theme.rugColor;
          context.fill();
          context.lineWidth = Math.max(1, 2.2 - depth * 0.22);
          context.strokeStyle = theme.rugBorder;
          context.stroke();
        } else if (theme.floorPattern === "checker") {
          const isLight = (cell.x + cell.y) % 2 === 0;
          drawQuadPath(context, floorQuad);
          context.fillStyle = isLight ? theme.checkerLight : theme.checkerDark;
          context.fill();
        } else if (theme.floorPattern === "runes") {
          const runeQuad = pctQuad(quadDecalPoints(floorSurf, { left: 0.2, top: 0.2, right: 0.8, bottom: 0.8 }), width, height);
          drawQuadPath(context, runeQuad);
          context.lineWidth = Math.max(0.8, 1.8 - depth * 0.2);
          context.strokeStyle = theme.runeColor;
          context.stroke();
        } else if (theme.floorPattern === "moss") {
          const patchQuad = pctQuad(quadDecalPoints(floorSurf, { left: 0.1, top: 0.14, right: 0.9, bottom: 0.92 }), width, height);
          drawQuadPath(context, patchQuad);
          context.fillStyle = theme.mossColor;
          context.fill();
        } else if (theme.borderColor) {
          const inlayQuad = pctQuad(quadDecalPoints(floorSurf, { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 }), width, height);
          drawQuadPath(context, inlayQuad);
          context.lineWidth = Math.max(0.8, 1.8 - depth * 0.2);
          context.strokeStyle = theme.borderColor;
          context.stroke();
        }
        context.restore();
      }

      function drawRoomCeilingTheme(context, width, height, depth, offset, cell, ceilingQuad, data) {
        if (typeof cellThemeAt !== "function") return;
        const zone = cellThemeAt(cell.x, cell.y);
        if (!zone) return;
        const ceilSurf = ceilingSegmentPoints(depth, offset);
        context.save();
        if (zone.kind === "corridor") {
          drawQuadPath(context, ceilingQuad);
          context.fillStyle = "rgba(6, 5, 8, 0.34)";
          context.fill();
          if (depth <= 5) {
            const rib = pctQuad(quadDecalPoints(ceilSurf, { left: 0, top: 0.44, right: 1, bottom: 0.56 }), width, height);
            drawQuadPath(context, rib);
            context.fillStyle = `rgba(0, 0, 0, ${0.38 * data.light})`;
            context.fill();
          }
          context.restore();
          return;
        }
        const theme = zone.theme;
        if (!theme) { context.restore(); return; }
        if (theme.ceilingTint) {
          drawQuadPath(context, ceilingQuad);
          context.fillStyle = theme.ceilingTint;
          context.fill();
        }
        if (theme.ceilingBeams && depth <= 5) {
          const beam = pctQuad(quadDecalPoints(ceilSurf, { left: 0, top: 0.4, right: 1, bottom: 0.6 }), width, height);
          drawQuadPath(context, beam);
          context.fillStyle = theme.beamColor;
          context.fill();
        }
        context.restore();
      }

      function drawRoomWallTrim(context, width, height, depth, offset, cell, surfacePoints, data, side = false) {
        if (depth > 6 || typeof wallThemeAt !== "function") return;
        const wz = wallThemeAt(cell.x, cell.y);
        if (!wz) return;

        if (wz.kind === "corridor") {
          if (wz.torch && depth <= 4 && Math.abs(offset) <= 2) {
            const torchPts = pctQuad(quadDecalPoints(surfacePoints, { left: 0.36, top: 0.24, right: 0.64, bottom: 0.66 }), width, height);
            const bounds = boundsForPoints(torchPts);
            if (!quadOutsideViewport(bounds)) {
              const cx = bounds.x + bounds.width * 0.5;
              const cy = bounds.y + bounds.height * 0.28;
              context.save();
              context.globalCompositeOperation = "lighter";
              context.fillStyle = `rgba(255, 162, 54, ${Math.min(0.24, data.light * 0.24)})`;
              context.beginPath();
              context.ellipse(cx, cy, Math.max(6, bounds.width * 1.15), Math.max(6, bounds.height * 0.72), 0, 0, Math.PI * 2);
              context.fill();
              context.restore();
              const sconceKey = typeof furnitureTileKey === "function" ? furnitureTileKey("torch_sconce") : "furniture://torch_sconce";
              drawImageMappedQuad(context, sconceKey, torchPts, Math.min(1, data.light + 0.25), "#d88a32", { noShade: true, shadow: false });
            }
          }
          return;
        }

        const theme = wz.theme;
        if (!theme) return;
        const lightAlpha = Math.max(0.22, Math.min(1, data.light));
        context.save();
        if (theme.wallTint) {
          const full = pctQuad(surfacePoints, width, height);
          drawQuadPath(context, full);
          context.fillStyle = theme.wallTint;
          context.fill();
        }
        // Lower wainscoting / dado trim distinguishes themed rooms from plain stone corridors.
        const dado = pctQuad(quadDecalPoints(surfacePoints, { left: 0, top: 0.74, right: 1, bottom: 1 }), width, height);
        drawQuadPath(context, dado);
        context.fillStyle = theme.trimColor;
        context.globalAlpha = 0.52 * lightAlpha;
        context.fill();

        // Upper cornice frieze line
        const cornice = pctQuad(quadDecalPoints(surfacePoints, { left: 0, top: 0, right: 1, bottom: 0.09 }), width, height);
        drawQuadPath(context, cornice);
        context.fillStyle = theme.trimAccent || theme.trimColor;
        context.globalAlpha = 0.42 * lightAlpha;
        context.fill();

        // Theme-specific architectural wall accents (banners, ivy, bookcase bays, arcane conduits)
        if (depth <= 4) {
          const style = theme.wallTrimStyle;
          if (style === "banners" && (cellHash(cell.x, cell.y, 311) % 3 === 0)) {
            const banner = pctQuad(quadDecalPoints(surfacePoints, { left: 0.32, top: 0.12, right: 0.68, bottom: 0.72 }), width, height);
            drawQuadPath(context, banner);
            context.globalAlpha = 0.78 * lightAlpha;
            context.fillStyle = theme.trimColor;
            context.fill();
            context.lineWidth = Math.max(1, 2 - depth * 0.25);
            context.strokeStyle = theme.trimAccent;
            context.stroke();
          } else if (style === "ivy") {
            const vine = pctQuad(quadDecalPoints(surfacePoints, { left: 0.08, top: 0.06, right: 0.34, bottom: 0.84 }), width, height);
            drawQuadPath(context, vine);
            context.globalAlpha = 0.48 * lightAlpha;
            context.fillStyle = theme.trimColor;
            context.fill();
          } else if (style === "arcane") {
            const conduit = pctQuad(quadDecalPoints(surfacePoints, { left: 0.04, top: 0.46, right: 0.96, bottom: 0.52 }), width, height);
            drawQuadPath(context, conduit);
            context.globalAlpha = 0.55 * lightAlpha;
            context.fillStyle = theme.trimAccent;
            context.fill();
          } else if (style === "bookshelves" && (cellHash(cell.x, cell.y, 317) % 2 === 0)) {
            const bay = pctQuad(quadDecalPoints(surfacePoints, { left: 0.14, top: 0.16, right: 0.86, bottom: 0.72 }), width, height);
            drawQuadPath(context, bay);
            context.globalAlpha = 0.45 * lightAlpha;
            context.fillStyle = "rgba(44, 24, 12, 0.9)";
            context.fill();
            context.strokeStyle = theme.trimAccent;
            context.lineWidth = 1;
            context.stroke();
          }
        }
        context.restore();
      }

      function drawFurniture(context, width, height, depth, offset, cell) {
        if (typeof furnitureAt !== "function") return;
        const piece = furnitureAt(cell.x, cell.y);
        if (!piece) return;
        const bounds = standingBounds(nearEdgeDepth(depth), offset, piece.widthScale || 0.48, piece.heightScale || 0.58, 0.94);
        const rect = drawSprite(context, piece.tile, bounds, width, height);
        if (rect && offset === 0 && depth <= 2) {
          drawFloorLabel(context, piece.shortName || piece.name, rect, depth);
        }
      }

      function drawCellShell(context, width, height, depth, offset, cell) {
        if (solidAt(cell.x, cell.y)) return;
        const data = geometryAt(depth);
        const floorQuad = pctQuad(floorSegmentPoints(depth, offset), width, height);
        const ceilingQuad = pctQuad(ceilingSegmentPoints(depth, offset), width, height);
        if (wireframeEnabled()) {
          const glow = Math.max(0.2, Math.min(0.95, data.light + 0.08));
          const terrain = terrainAt(cell.x, cell.y);
          const floorStroke = terrain === "lava"
            ? `rgba(255, 118, 56, ${glow})`
            : terrain === "water" || terrain === "deep-water"
              ? `rgba(64, 212, 255, ${glow})`
              : `rgba(56, 255, 122, ${glow * 0.72})`;
          context.save();
          drawQuadPath(context, ceilingQuad);
          context.fillStyle = "#020604";
          context.fill();
          context.strokeStyle = `rgba(38, 176, 86, ${glow * 0.36})`;
          context.lineWidth = 1;
          context.stroke();
          drawQuadPath(context, floorQuad);
          context.fillStyle = "#020805";
          context.fill();
          context.strokeStyle = floorStroke;
          context.lineWidth = 1.25;
          context.stroke();
          context.restore();
          drawFloorMarks(context, width, height, depth, offset, cell);
          return;
        }
        drawHorizontalMappedQuad(context, themedAsset("ceiling", "ceilingAlt", cell, 5), ceilingQuad, depth, Math.max(0.2, data.light - 0.24), "#171513");
        drawRoomCeilingTheme(context, width, height, depth, offset, cell, ceilingQuad, data);
        drawHorizontalMappedQuad(context, floorTexture(cell), floorQuad, depth, Math.max(0.2, data.light - 0.05), floorFallback(cell));
        drawRoomFloorTheme(context, width, height, depth, offset, cell, floorQuad, data);
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
        const texture = accentAsset("floorAccent", cell, 41, 24);
        if (!texture) return;
        const data = geometryAt(depth);
        const large = cellHash(cell.x, cell.y, 43) % 2 === 0;
        const footprint = large ? { left: 0.14, top: 0.16, right: 0.86, bottom: 0.94 } : { left: 0.24, top: 0.3, right: 0.76, bottom: 0.9 };
        const points = pctQuad(floorDecalPoints(depth, footprint, offset), width, height);
        drawImageMappedQuad(context, texture, points, Math.min(1, data.light + 0.08), "#5f5a43", { alpha: 0.78, shadow: false, allowClassicFallback: false });
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
      // Keep decals genuinely sparse so hanging swords, skulls, and blood
      // stains read as occasional landmarks rather than wallpapering every hall.
      const WALL_ACCENT_SPEC = { prefix: "wallAccent", salt: 59, rarity: 41, maxOffset: 2 };
      const WALL_STAIN_SPEC = { prefix: "wallStain", salt: 83, rarity: 37, maxOffset: 2 };
      const WALL_PATCH_SPEC = { prefix: "wallPatch", salt: 109, rarity: 23, maxOffset: 2 };
      const WALL_GLOW_SPEC = { prefix: "wallGlow", salt: 173, rarity: 29, maxOffset: 2 };

      function wallHasAccent(cell) {
        return Boolean(accentAsset(WALL_ACCENT_SPEC.prefix, cell, WALL_ACCENT_SPEC.salt, WALL_ACCENT_SPEC.rarity));
      }

      function wallHasStain(cell) {
        return !wallHasAccent(cell) && Boolean(accentAsset(WALL_STAIN_SPEC.prefix, cell, WALL_STAIN_SPEC.salt, WALL_STAIN_SPEC.rarity));
      }

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
          ...WALL_GLOW_SPEC,
          fallback: "#d8b05b",
          alpha: 0.34,
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
        if (wallHasAccent(cell)) return;
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          ...WALL_STAIN_SPEC,
          alpha: 0.72,
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
        if (wallHasAccent(cell) || wallHasStain(cell)) return;
        drawSurfaceDecal(context, width, height, depth, offset, cell, surfacePoints, {
          ...WALL_PATCH_SPEC,
          alpha: 0.65,
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
          if (rect && offset === 0) drawFloorLabel(context, stairs.label || (stairs.direction === "down" ? "downstairs" : "upstairs"), rect, depth);
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

        if (typeof isGameMode === "function" && isGameMode("foresight") && typeof foresightThreatCells === "function") {
          const { attacks, steps } = foresightThreatCells();
          const fk = keyOf(cell.x, cell.y);
          const attackList = attacks.get(fk);
          const stepList = steps.get(fk);
          if (attackList && attackList.length) {
            const threatQuad = pctQuad(floorDecalPoints(depth, { left: 0.14, top: 0.14, right: 0.86, bottom: 0.86 }, offset), width, height);
            context.save();
            drawQuadPath(context, threatQuad);
            context.fillStyle = attackList.some((a) => a.isImpact) ? "rgba(255, 62, 48, 0.32)" : "rgba(245, 159, 59, 0.22)";
            context.fill();
            context.lineWidth = 2;
            context.strokeStyle = "rgba(255, 92, 68, 0.9)";
            context.stroke();
            context.restore();
          } else if (stepList && stepList.length) {
            const stepQuad = pctQuad(floorDecalPoints(depth, { left: 0.24, top: 0.24, right: 0.76, bottom: 0.76 }, offset), width, height);
            context.save();
            drawQuadPath(context, stepQuad);
            context.strokeStyle = "rgba(77, 208, 225, 0.72)";
            context.lineWidth = 1.6;
            context.stroke();
            context.restore();
          }
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
        if (kind === "stairs") return entry.label ? `${enabled ? "Use " : ""}${entry.label}` : enabled ? "Use stairs" : entry.direction === "down" ? "downstairs" : "upstairs";
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

      function buildViewportTargetOccluders(width, height) {
        const fronts = [];
        const sides = [];
        const rows = mapCellsInViewRows(width, height, VIEWPORT_TARGET_MAX_DEPTH);
        for (const row of rows) {
          for (const cell of row.cells) {
            if (solidAt(cell.x, cell.y)) {
              if (Math.abs(cell.offset) <= Math.max(2, Math.ceil(row.depth * 0.7))) {
                fronts.push({
                  x: cell.x,
                  y: cell.y,
                  depth: row.depth,
                  quad: pctQuad(frontFacePoints(nearEdgeDepth(row.depth), cell.offset), width, height)
                });
              }
            } else {
              for (const side of sideWallEntries(cell, cell.offset)) {
                sides.push({
                  x: side.cell.x,
                  y: side.cell.y,
                  depth: row.depth,
                  quad: pctQuad(sideFacePoints(row.depth, side.boundary), width, height)
                });
              }
            }
          }
        }
        return { fronts, sides };
      }

      function viewportTargetOccluded(width, height, rect, view, entry, occluders = null) {
        const resolved = occluders || buildViewportTargetOccluders(width, height);
        for (let i = 0; i < resolved.fronts.length; i += 1) {
          const wall = resolved.fronts[i];
          if (wall.depth >= view.depth) continue;
          if (wall.x === entry.x && wall.y === entry.y) continue;
          if (viewportRectHitsQuad(rect, wall.quad)) return true;
        }
        for (let i = 0; i < resolved.sides.length; i += 1) {
          const wall = resolved.sides[i];
          if (wall.depth >= view.depth) continue;
          if (wall.x === entry.x && wall.y === entry.y) continue;
          if (viewportRectHitsQuad(rect, wall.quad)) return true;
        }
        return false;
      }

      function viewportInteractionTarget(width, height, kind, entry, enabled, action = null, occluders = null) {
        const view = viewportTargetView(entry.x, entry.y);
        if (!view) return null;
        const rect = viewportInteractionRect(width, height, kind, entry, view);
        if (!viewportTargetIntersects(rect, width, height)) return null;
        if (viewportTargetOccluded(width, height, rect, view, entry, occluders)) return null;
        return {
          id: viewportTargetId(kind, entry),
          kind,
          label: viewportInteractionLabel(kind, entry, enabled),
          ...(entry.detail ? { detail: entry.detail } : {}),
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
        const occluders = buildViewportTargetOccluders(width, height);
        const pushTarget = (kind, entry) => {
          const id = viewportTargetId(kind, entry);
          if (seenIds.has(id)) return;
          const enabled = id === activeId;
          const target = viewportInteractionTarget(width, height, kind, entry, enabled, enabled ? active.action : null, occluders);
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
        for (const row of mapCellsInViewRows(width, height, VIEWPORT_TARGET_MAX_DEPTH)) {
          for (const cell of row.cells) {
            if (floorState.discovered.has(keyOf(cell.x, cell.y)) && doorCellAt(cell.x, cell.y)) {
              pushTarget("door", { id: `door-${cell.x}-${cell.y}`, x: cell.x, y: cell.y });
            }
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
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) context.lineTo(point.x, point.y);
        context.globalAlpha = 0.35;
        context.strokeStyle = color;
        context.lineWidth = Math.max(8, width * 0.012);
        context.stroke();
        context.globalAlpha = 1;
        context.lineWidth = Math.max(3, width * 0.004);
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
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        context.save();
        context.globalCompositeOperation = "lighter";
        context.fillStyle = color;
        context.globalAlpha = 0.24;
        context.beginPath();
        context.ellipse(cx, cy, Math.max(6, rect.width * 0.55), Math.max(6, rect.height * 0.55), 0, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.58;
        context.beginPath();
        context.ellipse(cx, cy, Math.max(3, rect.width * 0.3), Math.max(3, rect.height * 0.3), 0, 0, Math.PI * 2);
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
        if (typeof isGameMode === "function" && isGameMode("foresight") && monster.foresight && monster.foresight.label && monster.foresight.label !== "IDLE") {
          context.save();
          const label = monster.foresight.label;
          const badgeY = Math.max(12, rect.y - 12);
          context.font = "bold 11px system-ui, sans-serif";
          const tw = context.measureText(label).width + 10;
          const bx = rect.x + rect.width / 2 - tw / 2;
          context.fillStyle = monster.foresight.kind === "canceled"
            ? "rgba(88, 96, 112, 0.88)"
            : monster.foresight.kind === "step"
              ? "rgba(18, 86, 102, 0.88)"
              : "rgba(154, 30, 24, 0.9)";
          context.fillRect(bx, badgeY - 9, tw, 15);
          context.fillStyle = "#fff4dc";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(label, rect.x + rect.width / 2, badgeY - 1);
          context.restore();
        }
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
        if (wireframeEnabled()) {
          const glow = Math.max(0.26, Math.min(1, data.light + 0.16));
          context.save();
          drawQuadPath(context, points);
          context.fillStyle = kind === "door" ? "#0b0702" : "#030a05";
          context.fill();
          context.lineWidth = Math.max(1.3, 2.3 - faceDepth * 0.18);
          context.strokeStyle = kind === "door" ? `rgba(255, 184, 77, ${glow})` : `rgba(76, 255, 136, ${glow})`;
          context.stroke();
          if (kind === "door") {
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            context.lineTo(points[2].x, points[2].y);
            context.moveTo(points[1].x, points[1].y);
            context.lineTo(points[3].x, points[3].y);
            context.lineWidth = 1.1;
            context.stroke();
          }
          context.restore();
          return;
        }
        if (kind === "door") {
          drawVerticalMappedQuad(context, environmentAsset(assets.door), points, faceDepth, data.light, "#281d13");
          strokeQuad(context, points, "rgba(238, 193, 101, 0.12)");
          return;
        }
        drawVerticalMappedQuad(context, wallSurfaceTexture(cell), points, faceDepth, data.light, "#2e2a24");
      }

      function drawFrontSurfaceDetails(context, width, height, depth, offset, cell, occluders = []) {
        if (wireframeEnabled()) return;
        const kind = mapKind(cell.x, cell.y);
        if (kind !== "wall") return;
        const faceDepth = nearEdgeDepth(depth);
        const data = geometryAt(faceDepth);
        const points = pctQuad(frontFacePoints(faceDepth, offset), width, height);
        const surface = frontFacePoints(faceDepth, offset);
        withFrontDetailClip(context, points, occluders, () => {
          drawWallRelief(context, width, height, faceDepth, cell, surface);
          drawRoomWallTrim(context, width, height, faceDepth, offset, cell, surface, data, false);
          drawWallPatch(context, width, height, faceDepth, offset, cell, surface);
          drawWallStain(context, width, height, faceDepth, offset, cell, surface);
          drawWallAccent(context, width, height, faceDepth, offset, cell);
          drawWallGlow(context, width, height, faceDepth, offset, cell, surface);
          strokeQuad(context, points, `rgba(238, 193, 101, ${Math.max(0.05, data.light * 0.09)})`);
        });
      }

      function drawCellContents(context, width, height, depth, offset, cell) {
        drawDecor(context, width, height, depth, offset, cell);
        drawFurniture(context, width, height, depth, offset, cell);
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
      let atmosphereCache = { key: null, canvas: null };

      function drawRoomAtmosphere(context, width, height) {
        if (typeof cellThemeAt !== "function") return;
        const zone = cellThemeAt(state.x, state.y);
        if (!zone || zone.kind !== "room" || !zone.theme?.ambientColor) return;
        const [r, g, b] = zone.theme.ambientColor;
        const alpha = zone.theme.ambientAlpha || 0.08;
        context.save();
        context.globalCompositeOperation = "screen";
        const glow = context.createRadialGradient(width * 0.5, height * 0.56, width * 0.05, width * 0.5, height * 0.56, width * 0.58);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
        context.restore();
      }

      function drawCachedAtmosphere(context, width, height) {
        if (typeof document === "undefined" || typeof document.createElement !== "function" || context !== viewportContext) {
          drawViewportHaze(context, width, height);
          drawBranchAtmosphere(context, width, height);
          drawRoomAtmosphere(context, width, height);
          return;
        }
        const noir = typeof isNoirLighting === "function" && isNoirLighting();
        const floor = currentFloor();
        const zone = typeof cellThemeAt === "function" ? cellThemeAt(state.x, state.y) : null;
        const roomTag = zone?.kind === "room" && zone.theme ? zone.theme.id : "corr";
        const key = `${width}x${height}:${noir ? `n${(state.turnCount || 0) % 2}` : "s"}:${floor.id}:${floor.name}:${roomTag}`;
        if (atmosphereCache.key !== key || !atmosphereCache.canvas) {
          const canvas = atmosphereCache.canvas || document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            drawViewportHaze(context, width, height);
            drawBranchAtmosphere(context, width, height);
            drawRoomAtmosphere(context, width, height);
            return;
          }
          ctx.clearRect(0, 0, width, height);
          drawViewportHaze(ctx, width, height);
          drawBranchAtmosphere(ctx, width, height);
          drawRoomAtmosphere(ctx, width, height);
          atmosphereCache = { key, canvas };
        }
        context.drawImage(atmosphereCache.canvas, 0, 0, width, height);
      }

      function sceneWallLayers(context, width, height) {
        viewportProjectionFor(width, height);
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
        for (const row of mapCellsInViewRows(width, height)) { // far → near
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
        context.fillStyle = wireframeEnabled() ? "#020804" : "#070606";
        context.fillRect(0, 0, width, height);

        for (const layer of sceneWallLayers(context, width, height)) layer.draw();
        drawEffectTrails(context, width, height);

        if (wireframeEnabled()) {
          context.save();
          context.fillStyle = "rgba(4, 18, 8, 0.16)";
          for (let sy = 0; sy < height; sy += 4) context.fillRect(0, sy, width, 1);
          context.strokeStyle = "rgba(72, 255, 132, 0.35)";
          context.lineWidth = 2;
          context.strokeRect(2, 2, width - 4, height - 4);
          context.fillStyle = "#48ff84";
          context.font = "11px ui-monospace, monospace";
          context.fillText(`CRT WIREFRAME · ${dirs[state.dir]?.name?.toUpperCase() || ""}${typeof isAutomapDisabled === "function" && isAutomapDisabled() ? " · NO AUTOMAP" : ""}`, 12, 18);
          context.restore();
        } else {
          drawCachedAtmosphere(context, width, height);
        }
        drawEffectWash(context, width, height);
        drawPartyStatusOverlays(context, width, height);
        if (typeof isGameMode === "function" && isGameMode("tempo") && typeof tempoStatus === "function") {
          const beat = tempoStatus();
          const barW = Math.min(width * 0.56, 360);
          const barH = 14;
          const bx = (width - barW) * 0.5;
          const by = height - 26;
          context.save();
          context.fillStyle = beat.onBeat ? "rgba(255, 79, 216, 0.24)" : "rgba(18, 14, 28, 0.78)";
          context.fillRect(bx, by, barW, barH);
          context.strokeStyle = beat.onBeat ? "#ff6ee6" : "#8b6bd6";
          context.lineWidth = beat.onBeat ? 2 : 1.2;
          context.strokeRect(bx, by, barW, barH);
          const half = barW * 0.5;
          const offset = (1 - beat.phase) * (half - 10);
          context.fillStyle = beat.onBeat ? "#ffe875" : "#d38cff";
          context.fillRect(bx + half - offset - 3, by + 2, 6, barH - 4);
          context.fillRect(bx + half + offset - 3, by + 2, 6, barH - 4);
          context.fillStyle = beat.onBeat ? "#ffffff" : "#bfa8e8";
          context.fillRect(bx + half - 2, by - 2, 4, barH + 4);
          context.font = "bold 11px system-ui, sans-serif";
          context.textAlign = "center";
          context.fillStyle = beat.onBeat ? "#ff9ef0" : "#d8c7f7";
          context.fillText(`NECRO-BEAT ${beat.bpm} BPM · GROOVE x${beat.groove} · STREAK ${beat.streak}`, width * 0.5, by - 8);
          context.restore();
        }
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
        WALL_ACCENT_SPEC,
        WALL_STAIN_SPEC,
        WALL_PATCH_SPEC,
        WALL_GLOW_SPEC,
        drawWallAccent,
        drawWallGlow,
        drawWallStain,
        drawWallPatch,
        drawSideWallAccent,
        drawFloorFeature,
        drawDecor,
        drawFurniture,
        drawRoomFloorTheme,
        drawRoomCeilingTheme,
        drawRoomWallTrim,
        drawRoomAtmosphere,
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
