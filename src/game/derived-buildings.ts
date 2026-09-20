import buildingPolicyData from "../../geospatial/manifest.json";
import { terrainHeight } from "./terrain";
import type {
  DerivedBuildingFootprint,
  MeasuredObject,
  Point2,
  SceneLevels,
  TerrainConfig,
} from "./types";

interface BuildingPolicy {
  maxAutoFoundationRelief: number;
  excludedOsmIds: number[];
  excludedNames: string[];
  removeFallbackTypesWhenActive: string[];
}

const policy =
  buildingPolicyData.buildingBlockoutPolicy as BuildingPolicy;

function polygonCentroid(points: Point2[]): Point2 {
  if (points.length === 0) return [0, 0];

  let signedArea = 0;
  let xSum = 0;
  let zSum = 0;

  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!a || !b) continue;

    const cross = a[0] * b[1] - b[0] * a[1];
    signedArea += cross;
    xSum += (a[0] + b[0]) * cross;
    zSum += (a[1] + b[1]) * cross;
  }

  signedArea *= 0.5;

  if (Math.abs(signedArea) < 0.000001) {
    const x =
      points.reduce((sum, point) => sum + point[0], 0) /
      points.length;
    const z =
      points.reduce((sum, point) => sum + point[1], 0) /
      points.length;
    return [x, z];
  }

  return [
    xSum / (6 * signedArea),
    zSum / (6 * signedArea),
  ];
}

function boundsOf(points: Point2[]) {
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);

  return {
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

function isExcluded(item: DerivedBuildingFootprint) {
  return (
    policy.excludedOsmIds.includes(item.osmId) ||
    policy.excludedNames.includes(item.name)
  );
}

function measuredObjectFootprint(item: MeasuredObject): Point2[] {
  if (item.footprint && item.footprint.length >= 3) {
    return item.footprint;
  }

  const halfWidth = item.width / 2;
  const halfDepth = item.depth / 2;
  const angle = item.rotation[1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = item.position[0];
  const centerZ = item.position[2];

  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([localX, localZ]) => [
    centerX + localX * cos + localZ * sin,
    centerZ - localX * sin + localZ * cos,
  ]);
}

function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  const [x, z] = point;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index];
    const before = polygon[previous];
    if (!current || !before) continue;

    const intersects =
      current[1] > z !== before[1] > z &&
      x <
        ((before[0] - current[0]) *
          (z - current[1])) /
          (before[1] - current[1] || Number.EPSILON) +
          current[0];

    if (intersects) inside = !inside;
  }

  return inside;
}

function orientation(a: Point2, b: Point2, c: Point2) {
  return (
    (b[0] - a[0]) * (c[1] - a[1]) -
    (b[1] - a[1]) * (c[0] - a[0])
  );
}

function onSegment(
  a: Point2,
  b: Point2,
  point: Point2,
) {
  const epsilon = 0.000001;

  return (
    point[0] >= Math.min(a[0], b[0]) - epsilon &&
    point[0] <= Math.max(a[0], b[0]) + epsilon &&
    point[1] >= Math.min(a[1], b[1]) - epsilon &&
    point[1] <= Math.max(a[1], b[1]) + epsilon
  );
}

function segmentsIntersect(
  a: Point2,
  b: Point2,
  c: Point2,
  d: Point2,
) {
  const epsilon = 0.000001;
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (
    ((abC > epsilon && abD < -epsilon) ||
      (abC < -epsilon && abD > epsilon)) &&
    ((cdA > epsilon && cdB < -epsilon) ||
      (cdA < -epsilon && cdB > epsilon))
  ) {
    return true;
  }

  if (Math.abs(abC) <= epsilon && onSegment(a, b, c)) {
    return true;
  }
  if (Math.abs(abD) <= epsilon && onSegment(a, b, d)) {
    return true;
  }
  if (Math.abs(cdA) <= epsilon && onSegment(c, d, a)) {
    return true;
  }
  if (Math.abs(cdB) <= epsilon && onSegment(c, d, b)) {
    return true;
  }

  return false;
}

function polygonsOverlap(a: Point2[], b: Point2[]) {
  if (a.some((point) => pointInPolygon(point, b))) {
    return true;
  }

  if (b.some((point) => pointInPolygon(point, a))) {
    return true;
  }

  for (let aIndex = 0; aIndex < a.length; aIndex++) {
    const aStart = a[aIndex];
    const aEnd = a[(aIndex + 1) % a.length];
    if (!aStart || !aEnd) continue;

    for (let bIndex = 0; bIndex < b.length; bIndex++) {
      const bStart = b[bIndex];
      const bEnd = b[(bIndex + 1) % b.length];
      if (
        bStart &&
        bEnd &&
        segmentsIntersect(aStart, aEnd, bStart, bEnd)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function deriveRuntimeBuildingBlockouts(
  footprints: DerivedBuildingFootprint[],
  terrain: TerrainConfig,
  levels: SceneLevels,
  reservedFootprints: Point2[][] = [],
  fallbackBuildings: MeasuredObject[] = [],
) {
  const buildings: MeasuredObject[] = [];
  const skipped = {
    excluded: 0,
    noHeight: 0,
    invalidFootprint: 0,
    excessiveRelief: 0,
    overlapsReserved: 0,
  };

  for (const item of footprints) {
    if (isExcluded(item)) {
      skipped.excluded += 1;
      continue;
    }

    if (
      typeof item.height !== "number" ||
      !Number.isFinite(item.height) ||
      item.height <= 0
    ) {
      skipped.noHeight += 1;
      continue;
    }

    if (!Array.isArray(item.footprint) || item.footprint.length < 3) {
      skipped.invalidFootprint += 1;
      continue;
    }

    if (
      reservedFootprints.some(
        (reserved) =>
          reserved.length >= 3 &&
          polygonsOverlap(item.footprint, reserved),
      )
    ) {
      skipped.overlapsReserved += 1;
      continue;
    }

    const centroid = polygonCentroid(item.footprint);
    const samples = [
      centroid,
      ...item.footprint,
    ].map(([x, z]) =>
      terrainHeight(terrain, levels, x, z),
    );
    const minGround = Math.min(...samples);
    const maxGround = Math.max(...samples);
    const relief = maxGround - minGround;

    if (relief > policy.maxAutoFoundationRelief) {
      skipped.excessiveRelief += 1;
      continue;
    }

    const ground =
      samples.reduce((sum, value) => sum + value, 0) /
      samples.length;
    const dimensions = boundsOf(item.footprint);
    const height = item.height;

    buildings.push({
      id: `osm-building-${item.osmType}-${item.osmId}`,
      name: item.name,
      type: "osm-derived",
      position: [
        centroid[0],
        ground + height / 2,
        centroid[1],
      ],
      rotation: [0, 0, 0],
      width: dimensions.width,
      depth: dimensions.depth,
      height,
      footprint: item.footprint,
      source: [
        item.source,
        item.heightSource,
        "foundation elevation sampled from active geospatial terrain",
      ].join("; "),
      estimated: true,
    });
  }

  const generatedFootprints = buildings.flatMap(
    (building) =>
      building.footprint && building.footprint.length >= 3
        ? [building.footprint]
        : [],
  );
  const replacedFallbackIds = fallbackBuildings
    .filter((fallback) =>
      policy.removeFallbackTypesWhenActive.includes(
        fallback.type,
      ),
    )
    .filter((fallback) => {
      const footprint = measuredObjectFootprint(fallback);
      return generatedFootprints.some((generated) =>
        polygonsOverlap(footprint, generated),
      );
    })
    .map((fallback) => fallback.id);

  return {
    buildings,
    skipped,
    policy,
    replacedFallbackIds,
  };
}
