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

export function deriveRuntimeBuildingBlockouts(
  footprints: DerivedBuildingFootprint[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const buildings: MeasuredObject[] = [];
  const skipped = {
    excluded: 0,
    noHeight: 0,
    invalidFootprint: 0,
    excessiveRelief: 0,
  };

  for (const item of footprints) {
    if (isExcluded(item)) {
      skipped.excluded += 1;
      continue;
    }

    if (
      !Number.isFinite(item.height) ||
      (item.height ?? 0) <= 0
    ) {
      skipped.noHeight += 1;
      continue;
    }

    if (!Array.isArray(item.footprint) || item.footprint.length < 3) {
      skipped.invalidFootprint += 1;
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
    const height = item.height as number;

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

  return {
    buildings,
    skipped,
    policy,
  };
}
