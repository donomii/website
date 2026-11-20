"use strict";

(function attachBrushworkRunes(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrushworkRunes = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createBrushworkRunes() {
  const EPSILON = 0.000001;

  function validatePoint(point, label) {
    const valid = point !== null
      && typeof point === "object"
      && Number.isFinite(point.x)
      && Number.isFinite(point.y);

    if (valid) {
      return point;
    } else {
      throw new TypeError(`${label} must contain finite x and y numbers`);
    }
  }

  function validatePath(points, label) {
    if (Array.isArray(points)) {
      for (let index = 0; index < points.length; index += 1) {
        validatePoint(points[index], `${label}[${index}]`);
      }
      return points;
    } else {
      throw new TypeError(`${label} must be an array of points`);
    }
  }

  function distance(pointA, pointB) {
    validatePoint(pointA, "pointA");
    validatePoint(pointB, "pointB");
    return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
  }

  function distancePointToSegment(point, start, end) {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

    if (segmentLengthSquared <= EPSILON) {
      return distance(point, start);
    } else {
      const projection = ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY)
        / segmentLengthSquared;
      const amount = Math.max(0, Math.min(1, projection));
      const closest = {
        x: start.x + segmentX * amount,
        y: start.y + segmentY * amount,
      };
      return distance(point, closest);
    }
  }

  function distanceToPath(point, points) {
    validatePoint(point, "point");
    validatePath(points, "points");

    if (points.length === 0) {
      return Infinity;
    } else if (points.length === 1) {
      return distance(point, points[0]);
    } else {
      let shortest = Infinity;
      for (let index = 1; index < points.length; index += 1) {
        shortest = Math.min(
          shortest,
          distancePointToSegment(point, points[index - 1], points[index]),
        );
      }
      return shortest;
    }
  }

  function segmentIntersection(startA, endA, startB, endB) {
    const directionAX = endA.x - startA.x;
    const directionAY = endA.y - startA.y;
    const directionBX = endB.x - startB.x;
    const directionBY = endB.y - startB.y;
    const denominator = directionAX * directionBY - directionAY * directionBX;

    if (Math.abs(denominator) <= EPSILON) {
      return null;
    } else {
      const offsetX = startB.x - startA.x;
      const offsetY = startB.y - startA.y;
      const amountA = (offsetX * directionBY - offsetY * directionBX) / denominator;
      const amountB = (offsetX * directionAY - offsetY * directionAX) / denominator;
      const intersects = amountA >= -EPSILON
        && amountA <= 1 + EPSILON
        && amountB >= -EPSILON
        && amountB <= 1 + EPSILON;

      if (intersects) {
        return {
          x: startA.x + amountA * directionAX,
          y: startA.y + amountA * directionAY,
          amountA,
          amountB,
        };
      } else {
        return null;
      }
    }
  }

  function pathLength(points) {
    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      length += distance(points[index - 1], points[index]);
    }
    return length;
  }

  function pathBounds(points) {
    if (points.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
        center: { x: 0, y: 0 },
      };
    } else {
      let minX = points[0].x;
      let minY = points[0].y;
      let maxX = points[0].x;
      let maxY = points[0].y;

      for (let index = 1; index < points.length; index += 1) {
        minX = Math.min(minX, points[index].x);
        minY = Math.min(minY, points[index].y);
        maxX = Math.max(maxX, points[index].x);
        maxY = Math.max(maxY, points[index].y);
      }

      return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      };
    }
  }

  function polygonArea(points) {
    if (points.length < 3) {
      return 0;
    } else {
      let doubledArea = 0;
      for (let index = 0; index < points.length; index += 1) {
        const next = points[(index + 1) % points.length];
        doubledArea += points[index].x * next.y - next.x * points[index].y;
      }
      return Math.abs(doubledArea) / 2;
    }
  }

  function findSelfIntersection(points) {
    if (points.length < 4) {
      return null;
    } else {
      const lastSegment = points.length - 2;
      for (let firstIndex = 0; firstIndex <= lastSegment; firstIndex += 1) {
        for (let secondIndex = firstIndex + 2; secondIndex <= lastSegment; secondIndex += 1) {
          const closesPath = firstIndex === 0 && secondIndex === lastSegment;
          if (closesPath) {
            const endpointGap = distance(points[0], points[points.length - 1]);
            if (endpointGap > 8) {
              const closingIntersection = segmentIntersection(
                points[firstIndex],
                points[firstIndex + 1],
                points[secondIndex],
                points[secondIndex + 1],
              );
              if (closingIntersection !== null) {
                return closingIntersection;
              } else {
                continue;
              }
            } else {
              continue;
            }
          } else {
            const intersection = segmentIntersection(
              points[firstIndex],
              points[firstIndex + 1],
              points[secondIndex],
              points[secondIndex + 1],
            );
            if (intersection !== null) {
              return intersection;
            } else {
              continue;
            }
          }
        }
      }
      return null;
    }
  }

  function straightness(points, metrics) {
    if (points.length < 2 || metrics.endpointGap <= EPSILON) {
      return Infinity;
    } else {
      let maximumError = 0;
      const start = points[0];
      const end = points[points.length - 1];
      for (let index = 1; index < points.length - 1; index += 1) {
        maximumError = Math.max(
          maximumError,
          distancePointToSegment(points[index], start, end),
        );
      }
      const bendPenalty = Math.max(0, metrics.length / metrics.endpointGap - 1);
      return maximumError / metrics.endpointGap + bendPenalty * 0.5;
    }
  }

  function strokeMetrics(points) {
    validatePath(points, "points");
    const bounds = pathBounds(points);
    const length = pathLength(points);
    const endpointGap = points.length < 2 ? 0 : distance(points[0], points[points.length - 1]);
    const area = polygonArea(points);
    const boundsArea = bounds.width * bounds.height;
    const fillRatio = boundsArea <= EPSILON ? 0 : area / boundsArea;
    const selfIntersection = findSelfIntersection(points);
    const base = {
      length,
      endpointGap,
      area,
      fillRatio,
      bounds,
      center: bounds.center,
      width: bounds.width,
      height: bounds.height,
      selfIntersection,
    };

    return {
      ...base,
      straightness: straightness(points, base),
    };
  }

  function classifyStroke(points) {
    validatePath(points, "points");
    const metrics = strokeMetrics(points);

    if (points.length < 2 || metrics.length < 18) {
      return { kind: "discard", metrics };
    } else {
      const smallestSide = Math.min(metrics.width, metrics.height);
      const closingDistance = Math.max(32, Math.min(54, smallestSide * 0.42));
      const largeEnough = metrics.length >= 120 && metrics.width >= 42 && metrics.height >= 42;
      const closes = metrics.endpointGap <= closingDistance;
      const enclosesArea = metrics.fillRatio >= 0.22;
      const simple = metrics.selfIntersection === null;

      if (largeEnough && closes && enclosesArea && simple) {
        return {
          kind: "circle",
          metrics,
          center: metrics.center,
          radius: Math.max(24, smallestSide * 0.5),
        };
      } else {
        return { kind: "line", metrics };
      }
    }
  }

  function pathIntersections(firstPoints, secondPoints, firstLength, secondLength) {
    const found = [];
    let distanceAlongFirst = 0;

    for (let firstIndex = 1; firstIndex < firstPoints.length; firstIndex += 1) {
      const firstStart = firstPoints[firstIndex - 1];
      const firstEnd = firstPoints[firstIndex];
      const firstSegmentLength = distance(firstStart, firstEnd);
      let distanceAlongSecond = 0;

      for (let secondIndex = 1; secondIndex < secondPoints.length; secondIndex += 1) {
        const secondStart = secondPoints[secondIndex - 1];
        const secondEnd = secondPoints[secondIndex];
        const secondSegmentLength = distance(secondStart, secondEnd);
        const intersection = segmentIntersection(firstStart, firstEnd, secondStart, secondEnd);

        if (intersection !== null) {
          const firstRatio = (distanceAlongFirst + firstSegmentLength * intersection.amountA) / firstLength;
          const secondRatio = (distanceAlongSecond + secondSegmentLength * intersection.amountB) / secondLength;
          const firstAngle = Math.atan2(firstEnd.y - firstStart.y, firstEnd.x - firstStart.x);
          const secondAngle = Math.atan2(secondEnd.y - secondStart.y, secondEnd.x - secondStart.x);
          let angle = Math.abs(firstAngle - secondAngle) % Math.PI;
          angle = angle > Math.PI / 2 ? Math.PI - angle : angle;
          found.push({
            x: intersection.x,
            y: intersection.y,
            firstRatio,
            secondRatio,
            angleDegrees: angle * 180 / Math.PI,
          });
          distanceAlongSecond += secondSegmentLength;
        } else {
          distanceAlongSecond += secondSegmentLength;
        }
      }
      distanceAlongFirst += firstSegmentLength;
    }

    return found;
  }

  function findCrossRune(firstPoints, secondPoints) {
    validatePath(firstPoints, "firstPoints");
    validatePath(secondPoints, "secondPoints");
    const firstMetrics = strokeMetrics(firstPoints);
    const secondMetrics = strokeMetrics(secondPoints);
    const longEnough = firstMetrics.length >= 58 && secondMetrics.length >= 58;
    const straightEnough = firstMetrics.straightness <= 0.14 && secondMetrics.straightness <= 0.14;

    if (longEnough && straightEnough) {
      const intersections = pathIntersections(
        firstPoints,
        secondPoints,
        firstMetrics.length,
        secondMetrics.length,
      );
      const usable = intersections.find((intersection) => (
        intersection.firstRatio >= 0.14
        && intersection.firstRatio <= 0.86
        && intersection.secondRatio >= 0.14
        && intersection.secondRatio <= 0.86
        && intersection.angleDegrees >= 32
      ));

      if (usable === undefined) {
        return null;
      } else {
        return {
          kind: "cross",
          x: usable.x,
          y: usable.y,
          radius: 96,
          angleDegrees: usable.angleDegrees,
        };
      }
    } else {
      return null;
    }
  }

  return Object.freeze({
    classifyStroke,
    distance,
    distanceToPath,
    findCrossRune,
    strokeMetrics,
  });
});
