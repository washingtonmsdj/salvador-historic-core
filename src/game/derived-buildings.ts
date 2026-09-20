import buildingPolicyData from "../../geospatial/manifest.json";
import { terrainHeight } from "./terrain";
import {
  pointInPolygon,
  polygonsOverlap,
} from "./geometry-2d";
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

  const localCorners: Point2[] = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ];

  return localCorners.map(
    ([localX, localZ]): Point2 => [
      centerX + localX * cos + localZ * sin,
      centerZ - localX * sin + localZ * cos,
    ],
  );
}

export function sampleTerrainFootprint(
  footprint: Point2[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  if (footprint.length < 3) {
    throw new Error(
      "Terrain footprint sampling requires at least 3 points.",
    );
  }

  const centroid =
    polygonCentroid(footprint);
  const xs =
    footprint.map(([x]) => x);
  const zs =
    footprint.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const renderSpacing =
    terrain.tileSize /
    Math.max(
      1,
      terrain.subdivisionsPerTile,
    );
  const spacing = Math.max(
    1,
    Math.min(
      5,
      renderSpacing,
    ),
  );
  const samplePoints: Point2[] = [
    centroid,
    ...footprint,
  ];

  for (
    let x =
      minX + spacing / 2;
    x < maxX;
    x += spacing
  ) {
    for (
      let z =
        minZ + spacing / 2;
      z < maxZ;
      z += spacing
    ) {
      const point: Point2 = [
        x,
        z,
      ];
      if (
        pointInPolygon(
          point,
          footprint,
        )
      ) {
        samplePoints.push(point);
      }
    }
  }

  const values =
    samplePoints.map(
      ([x, z]) =>
        terrainHeight(
          terrain,
          levels,
          x,
          z,
        ),
    );
  const minGround =
    Math.min(...values);
  const maxGround =
    Math.max(...values);
  const meanGround =
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length;

  return {
    centroid,
    minGround,
    maxGround,
    meanGround,
    relief:
      maxGround - minGround,
    sampleCount:
      values.length,
  };
}

export function alignEstimatedBuildingsToTerrain(
  buildings: MeasuredObject[],
  terrain: TerrainConfig,
  levels: SceneLevels,
): MeasuredObject[] {
  return buildings.map(
    (building) => {
      if (
        !building.estimated ||
        building.height <= 0
      ) {
        return building;
      }

      const footprint =
        measuredObjectFootprint(
          building,
        );
      if (
        footprint.length < 3
      ) {
        return building;
      }

      const stats =
        sampleTerrainFootprint(
          footprint,
          terrain,
          levels,
        );
      const currentBase =
        building.position[1] -
        building.height / 2;
      const delta =
        stats.minGround -
        currentBase;

      if (
        Math.abs(delta) <
        0.025
      ) {
        return building;
      }

      return {
        ...building,
        position: [
          building.position[0],
          stats.minGround +
            building.height / 2,
          building.position[2],
        ] as MeasuredObject["position"],
        source: [
          building.source,
          "vertical placement aligned to active geospatial terrain",
          "foundation relief " +
            stats.relief.toFixed(2) +
            " m",
        ].join("; "),
      };
    },
  );
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

    const stats =
      sampleTerrainFootprint(
        item.footprint,
        terrain,
        levels,
      );
    const centroid =
      stats.centroid;
    const relief =
      stats.relief;

    if (
      relief >
      policy.maxAutoFoundationRelief
    ) {
      skipped.excessiveRelief += 1;
      continue;
    }

    const ground =
      stats.meanGround;
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

  const verifiedFootprints = footprints
    .filter(
      (item) =>
        !isExcluded(item) &&
        Array.isArray(item.footprint) &&
        item.footprint.length >= 3,
    )
    .filter(
      (item) =>
        !reservedFootprints.some(
          (reserved) =>
            reserved.length >= 3 &&
            polygonsOverlap(
              item.footprint,
              reserved,
            ),
        ),
    )
    .map((item) => item.footprint);

  const replacedFallbackIds = fallbackBuildings
    .filter((fallback) =>
      policy.removeFallbackTypesWhenActive.includes(
        fallback.type,
      ),
    )
    .filter((fallback) => {
      const footprint =
        measuredObjectFootprint(fallback);
      return verifiedFootprints.some(
        (verified) =>
          polygonsOverlap(
            footprint,
            verified,
          ),
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
