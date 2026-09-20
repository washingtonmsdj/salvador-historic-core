import {
  triangleInsidePolygon,
  triangleIntersectsPolygon,
} from "./geometry-2d";
import type {
  Point2,
  TerrainRenderMask,
} from "./types";

export type Triangle2 = readonly [Point2, Point2, Point2];

const MAX_REFINEMENT_DEPTH = 8;

function midpoint(a: Point2, b: Point2): Point2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function longestEdge(triangle: Triangle2) {
  const [a, b, c] = triangle;
  return Math.max(
    Math.hypot(b[0] - a[0], b[1] - a[1]),
    Math.hypot(c[0] - b[0], c[1] - b[1]),
    Math.hypot(a[0] - c[0], a[1] - c[1]),
  );
}

function subdivideTriangle(triangle: Triangle2): Triangle2[] {
  const [a, b, c] = triangle;
  const ab = midpoint(a, b);
  const bc = midpoint(b, c);
  const ca = midpoint(c, a);
  return [
    [a, ab, ca],
    [ab, b, bc],
    [ca, bc, c],
    [ab, bc, ca],
  ];
}

export function terrainMaskIntersectsBounds(
  mask: TerrainRenderMask,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) {
  if (mask.polygon.length < 3) return false;
  const padding = Math.max(0, mask.padding);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [x, z] of mask.polygon) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return !(
    maxX + padding < bounds.minX ||
    minX - padding > bounds.maxX ||
    maxZ + padding < bounds.minZ ||
    minZ - padding > bounds.maxZ
  );
}

export function refineTriangleOutsideMasks(
  triangle: Triangle2,
  masks: TerrainRenderMask[],
  depth = 0,
): Triangle2[] {
  const intersectingMasks = masks.filter((mask) =>
    triangleIntersectsPolygon(triangle, mask.polygon, mask.padding),
  );
  if (intersectingMasks.length === 0) return [triangle];

  if (
    intersectingMasks.some((mask) =>
      triangleInsidePolygon(triangle, mask.polygon),
    )
  ) {
    return [];
  }

  const targetEdge = Math.max(
    0.01,
    Math.min(...intersectingMasks.map((mask) => mask.maxBoundaryEdge)),
  );
  if (depth >= MAX_REFINEMENT_DEPTH || longestEdge(triangle) <= targetEdge) {
    return [];
  }

  return subdivideTriangle(triangle).flatMap((child) =>
    refineTriangleOutsideMasks(child, intersectingMasks, depth + 1),
  );
}
