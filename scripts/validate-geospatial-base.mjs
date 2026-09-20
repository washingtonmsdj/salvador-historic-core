import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadGeospatialContext,
  pathExists,
  root,
} from "./lib/geospatial-context.mjs";
import {
  latLonToUtm24S,
  utm24SToLatLon,
} from "./lib/utm-wgs84.mjs";

const {
  manifest,
  siteData,
  origin,
  bounds,
} = await loadGeospatialContext();
const runtimePath = resolve(root, manifest.pipeline.runtimeManifest);
const terrainPath = resolve(root, manifest.pipeline.derivedTerrain);
const vectorsPath = resolve(root, manifest.pipeline.derivedVectors);
const runtime = JSON.parse(await readFile(runtimePath, "utf8"));
const derivedTerrain = (await pathExists(terrainPath))
  ? JSON.parse(await readFile(terrainPath, "utf8"))
  : null;
const derivedVectors = (await pathExists(vectorsPath))
  ? JSON.parse(await readFile(vectorsPath, "utf8"))
  : null;
const errors = [];

function fail(message) {
  errors.push(message);
}

const terrainStructureMaskPolicy =
  manifest.terrainStructureMaskPolicy;

if (!terrainStructureMaskPolicy) {
  fail(
    "geospatial manifest must define terrainStructureMaskPolicy",
  );
} else if (
  !Number.isFinite(
    terrainStructureMaskPolicy.padding,
  ) ||
  terrainStructureMaskPolicy.padding < 0 ||
  terrainStructureMaskPolicy.padding > 1
) {
  fail(
    "terrain structure-mask padding must be between 0 and 1 metre",
  );
}

const terrainRenderMaskPolicy =
  manifest.terrainRenderMaskPolicy;

if (!terrainRenderMaskPolicy) {
  fail(
    "geospatial manifest must define terrainRenderMaskPolicy",
  );
} else if (
  !Number.isFinite(
    terrainRenderMaskPolicy.maxBoundaryEdge,
  ) ||
  terrainRenderMaskPolicy.maxBoundaryEdge < 0.02 ||
  terrainRenderMaskPolicy.maxBoundaryEdge > 0.25
) {
  fail(
    "terrain render-mask maxBoundaryEdge must be between 0.02 and 0.25 metres",
  );
}

const publicSpaceSurfacePolicy =
  manifest.publicSpaceSurfacePolicy;

if (!publicSpaceSurfacePolicy) {
  fail(
    "geospatial manifest must define publicSpaceSurfacePolicy",
  );
} else {
  if (
    !Number.isFinite(
      publicSpaceSurfacePolicy.maxTriangleEdge,
    ) ||
    publicSpaceSurfacePolicy.maxTriangleEdge <= 0 ||
    publicSpaceSurfacePolicy.maxTriangleEdge > 10
  ) {
    fail(
      "public-space maxTriangleEdge must be > 0 and <= 10 metres",
    );
  }

  if (
    !Number.isInteger(
      publicSpaceSurfacePolicy.maxSubdivisions,
    ) ||
    publicSpaceSurfacePolicy.maxSubdivisions < 1 ||
    publicSpaceSurfacePolicy.maxSubdivisions > 64
  ) {
    fail(
      "public-space maxSubdivisions must be an integer between 1 and 64",
    );
  }

  if (
    !Number.isFinite(
      publicSpaceSurfacePolicy.surfaceGap,
    ) ||
    publicSpaceSurfacePolicy.surfaceGap < 0.01 ||
    publicSpaceSurfacePolicy.surfaceGap > 0.15
  ) {
    fail(
      "public-space surfaceGap must be between 0.01 and 0.15 metres",
    );
  }

  if (
    !Number.isFinite(
      publicSpaceSurfacePolicy.textureRepeatMeters,
    ) ||
    publicSpaceSurfacePolicy.textureRepeatMeters < 1 ||
    publicSpaceSurfacePolicy.textureRepeatMeters > 20
  ) {
    fail(
      "public-space textureRepeatMeters must be between 1 and 20 metres",
    );
  }

  if (
    publicSpaceSurfacePolicy.requireExplicitSurfaceForParks !== true
  ) {
    fail(
      "public-space parks must require an explicit hard surface before receiving a paving overlay",
    );
  }
}

const roadSurfacePolicy =
  manifest.roadSurfacePolicy;

if (!roadSurfacePolicy) {
  fail(
    "geospatial manifest must define roadSurfacePolicy",
  );
} else {
  if (
    !Number.isFinite(
      roadSurfacePolicy.sampleSpacing,
    ) ||
    roadSurfacePolicy.sampleSpacing <= 0 ||
    roadSurfacePolicy.sampleSpacing > 5
  ) {
    fail(
      "road sampleSpacing must be > 0 and <= 5 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.surfaceGap,
    ) ||
    roadSurfacePolicy.surfaceGap < 0.01 ||
    roadSurfacePolicy.surfaceGap > 0.15
  ) {
    fail(
      "road surfaceGap must be between 0.01 and 0.15 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.maxCrossSlope,
    ) ||
    roadSurfacePolicy.maxCrossSlope <= 0 ||
    roadSurfacePolicy.maxCrossSlope > 0.12
  ) {
    fail(
      "road maxCrossSlope must be > 0 and <= 12%",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.maxGradeSmoothingRaise,
    ) ||
    roadSurfacePolicy.maxGradeSmoothingRaise < 0 ||
    roadSurfacePolicy.maxGradeSmoothingRaise > 0.25
  ) {
    fail(
      "road maxGradeSmoothingRaise must be between 0 and 0.25 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.maxSupportedFillHeight,
    ) ||
    roadSurfacePolicy.maxSupportedFillHeight <= 0 ||
    roadSurfacePolicy.maxSupportedFillHeight > 20
  ) {
    fail(
      "road maxSupportedFillHeight must be > 0 and <= 20 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.maxLongitudinalSlope,
    ) ||
    roadSurfacePolicy.maxLongitudinalSlope <= 0 ||
    roadSurfacePolicy.maxLongitudinalSlope > 0.2
  ) {
    fail(
      "road maxLongitudinalSlope must be > 0 and <= 20%",
    );
  }

  if (
    !Number.isInteger(
      roadSurfacePolicy.longitudinalProfileIterations,
    ) ||
    roadSurfacePolicy.longitudinalProfileIterations < 2 ||
    roadSurfacePolicy.longitudinalProfileIterations > 16
  ) {
    fail(
      "road longitudinalProfileIterations must be an integer between 2 and 16",
    );
  }

  if (
    !Array.isArray(
      roadSurfacePolicy.longitudinalProfileFallbackOsmIds,
    ) ||
    roadSurfacePolicy.longitudinalProfileFallbackOsmIds.some(
      (id) => !Number.isInteger(id) || id <= 0,
    ) ||
    new Set(
      roadSurfacePolicy.longitudinalProfileFallbackOsmIds,
    ).size !==
      roadSurfacePolicy.longitudinalProfileFallbackOsmIds.length
  ) {
    fail(
      "road longitudinalProfileFallbackOsmIds must contain unique positive OSM ids",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.supportWallThreshold,
    ) ||
    roadSurfacePolicy.supportWallThreshold < 0.05 ||
    roadSurfacePolicy.supportWallThreshold > 1
  ) {
    fail(
      "road supportWallThreshold must be between 0.05 and 1 metre",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.supportWallTextureRepeatMeters,
    ) ||
    roadSurfacePolicy.supportWallTextureRepeatMeters < 1 ||
    roadSurfacePolicy.supportWallTextureRepeatMeters > 10
  ) {
    fail(
      "road supportWallTextureRepeatMeters must be between 1 and 10 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.supportWallSink,
    ) ||
    roadSurfacePolicy.supportWallSink < 0 ||
    roadSurfacePolicy.supportWallSink > 0.2
  ) {
    fail(
      "road supportWallSink must be between 0 and 0.2 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.maxMiterScale,
    ) ||
    roadSurfacePolicy.maxMiterScale < 1 ||
    roadSurfacePolicy.maxMiterScale > 4
  ) {
    fail(
      "road maxMiterScale must be between 1 and 4",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.textureRepeatMeters,
    ) ||
    roadSurfacePolicy.textureRepeatMeters < 1 ||
    roadSurfacePolicy.textureRepeatMeters > 20
  ) {
    fail(
      "road textureRepeatMeters must be between 1 and 20 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionSnapDistance,
    ) ||
    roadSurfacePolicy.junctionSnapDistance <= 0 ||
    roadSurfacePolicy.junctionSnapDistance > 1
  ) {
    fail(
      "road junctionSnapDistance must be > 0 and <= 1 metre",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionOverlap,
    ) ||
    roadSurfacePolicy.junctionOverlap < 0 ||
    roadSurfacePolicy.junctionOverlap > 1
  ) {
    fail(
      "road junctionOverlap must be between 0 and 1 metre",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionSurfaceOffset,
    ) ||
    roadSurfacePolicy.junctionSurfaceOffset < 0 ||
    roadSurfacePolicy.junctionSurfaceOffset > 0.03
  ) {
    fail(
      "road junctionSurfaceOffset must be between 0 and 0.03 metres",
    );
  }

  if (
    !Number.isInteger(
      roadSurfacePolicy.junctionMaxSegments,
    ) ||
    roadSurfacePolicy.junctionMaxSegments < 8 ||
    roadSurfacePolicy.junctionMaxSegments > 64
  ) {
    fail(
      "road junctionMaxSegments must be an integer between 8 and 64",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionMaxSlope,
    ) ||
    roadSurfacePolicy.junctionMaxSlope <= 0 ||
    roadSurfacePolicy.junctionMaxSlope > 0.2
  ) {
    fail(
      "road junctionMaxSlope must be > 0 and <= 20%",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionMaxCut,
    ) ||
    roadSurfacePolicy.junctionMaxCut < 0 ||
    roadSurfacePolicy.junctionMaxCut > 2
  ) {
    fail(
      "road junctionMaxCut must be between 0 and 2 metres",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionMaxFill,
    ) ||
    roadSurfacePolicy.junctionMaxFill < 0 ||
    roadSurfacePolicy.junctionMaxFill >
      roadSurfacePolicy.maxSupportedFillHeight
  ) {
    fail(
      "road junctionMaxFill must be between 0 and maxSupportedFillHeight",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionTerrainMaskInset,
    ) ||
    roadSurfacePolicy.junctionTerrainMaskInset < 0 ||
    roadSurfacePolicy.junctionTerrainMaskInset > 0.5
  ) {
    fail(
      "road junctionTerrainMaskInset must be between 0 and 0.5 metres",
    );
  }

  if (
    terrainRenderMaskPolicy &&
    Number.isFinite(
      terrainRenderMaskPolicy.maxBoundaryEdge,
    ) &&
    roadSurfacePolicy.junctionTerrainMaskInset <
      terrainRenderMaskPolicy.maxBoundaryEdge
  ) {
    fail(
      "road junctionTerrainMaskInset must be >= terrain render-mask maxBoundaryEdge so adaptive clipping cannot open a gap beyond the junction deck",
    );
  }

  if (
    !Number.isFinite(
      roadSurfacePolicy.junctionMaxRoadEdgeDelta,
    ) ||
    roadSurfacePolicy.junctionMaxRoadEdgeDelta < 0 ||
    roadSurfacePolicy.junctionMaxRoadEdgeDelta > 0.3
  ) {
    fail(
      "road junctionMaxRoadEdgeDelta must be between 0 and 0.3 metres",
    );
  }
}

const liveTerrainPreview =
  manifest.liveTerrainPreview;

if (!liveTerrainPreview) {
  fail(
    "geospatial manifest must define liveTerrainPreview",
  );
} else {
  if (
    !Number.isFinite(
      liveTerrainPreview.gridSpacing,
    ) ||
    liveTerrainPreview.gridSpacing < 2.5 ||
    liveTerrainPreview.gridSpacing > 8
  ) {
    fail(
      "live terrain gridSpacing must be between 2.5 and 8 metres",
    );
  }

  if (
    !Number.isFinite(
      liveTerrainPreview.contourSampleSpacing,
    ) ||
    liveTerrainPreview.contourSampleSpacing <= 0 ||
    liveTerrainPreview.contourSampleSpacing >
      liveTerrainPreview.gridSpacing
  ) {
    fail(
      "live terrain contourSampleSpacing must be > 0 and <= gridSpacing",
    );
  }
}

const buildingPolicy = manifest.buildingBlockoutPolicy;

if (!buildingPolicy) {
  fail("geospatial manifest must define buildingBlockoutPolicy");
} else {
  if (
    !Number.isFinite(buildingPolicy.maxAutoFoundationRelief) ||
    buildingPolicy.maxAutoFoundationRelief <= 0 ||
    buildingPolicy.maxAutoFoundationRelief > 2
  ) {
    fail("building maxAutoFoundationRelief must be > 0 and <= 2 metres");
  }

  if (
    !Array.isArray(buildingPolicy.excludedOsmIds) ||
    new Set(buildingPolicy.excludedOsmIds).size !==
      buildingPolicy.excludedOsmIds.length
  ) {
    fail("building excludedOsmIds must be a unique array");
  }

  if (
    !Array.isArray(buildingPolicy.removeFallbackTypesWhenActive) ||
    buildingPolicy.removeFallbackTypesWhenActive.length === 0
  ) {
    fail("building fallback removal types must not be empty");
  }
}

if (runtime.crs !== "EPSG:32724") {
  fail(`runtime CRS must be EPSG:32724, got ${runtime.crs}`);
}

const mapReference = runtime.mapReference;
if (!mapReference) {
  fail("runtime mapReference configuration is required");
} else {
  if (
    typeof mapReference.tileTemplate !== "string" ||
    !mapReference.tileTemplate.startsWith("https://")
  ) {
    fail("mapReference.tileTemplate must use HTTPS");
  }

  if (
    !Number.isInteger(mapReference.zoom) ||
    mapReference.zoom < 0 ||
    mapReference.zoom > 22
  ) {
    fail("mapReference.zoom must be an integer between 0 and 22");
  }

  if (
    !Number.isInteger(mapReference.maxTiles) ||
    mapReference.maxTiles < 1 ||
    mapReference.maxTiles > 32
  ) {
    fail("mapReference.maxTiles must be between 1 and 32");
  }
}

const [projectedEasting, projectedNorthing] = latLonToUtm24S(
  origin.latitude,
  origin.longitude,
);
const projectionError = Math.hypot(
  projectedEasting - origin.projected.easting,
  projectedNorthing - origin.projected.northing,
);

if (projectionError > 0.02) {
  fail(
    `WGS84 -> UTM 24S origin transform error is ${projectionError.toFixed(4)} m`,
  );
}

const [roundTripLatitude, roundTripLongitude] = utm24SToLatLon(
  origin.projected.easting,
  origin.projected.northing,
);
const roundTripError = Math.hypot(
  roundTripLatitude - origin.latitude,
  roundTripLongitude - origin.longitude,
);

if (roundTripError > 0.0000002) {
  fail(
    `UTM 24S -> WGS84 origin round-trip error is ${roundTripError.toExponential(3)} degrees`,
  );
}

if (
  runtime.origin.easting !== origin.projected.easting ||
  runtime.origin.northing !== origin.projected.northing
) {
  fail("runtime projected origin differs from site-data origin");
}

for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
  if (runtime.perimeter[key] !== bounds[key]) {
    fail(`runtime perimeter.${key} differs from site-data`);
  }
}

const expectedCorners = {
  southWest: [bounds.minX, bounds.minZ],
  southEast: [bounds.maxX, bounds.minZ],
  northEast: [bounds.maxX, bounds.maxZ],
  northWest: [bounds.minX, bounds.maxZ],
};

for (const [name, [x, z]] of Object.entries(expectedCorners)) {
  const corner = runtime.geographicCorners?.[name];
  if (!corner) {
    fail(`runtime geographicCorners.${name} is missing`);
    continue;
  }

  const values = [
    corner.easting,
    corner.northing,
    corner.latitude,
    corner.longitude,
  ];
  if (!values.every(Number.isFinite)) {
    fail(`runtime geographicCorners.${name} contains non-finite coordinates`);
    continue;
  }

  if (
    corner.local?.[0] !== x ||
    corner.local?.[1] !== z
  ) {
    fail(`runtime geographicCorners.${name} local coordinates differ from perimeter`);
  }

  const expectedEasting =
    origin.projected.easting + x;
  const expectedNorthing =
    origin.projected.northing + z;
  if (
    Math.hypot(
      corner.easting - expectedEasting,
      corner.northing - expectedNorthing,
    ) > 0.001
  ) {
    fail(`runtime geographicCorners.${name} projected coordinates are inconsistent`);
  }

  const [expectedLatitude, expectedLongitude] =
    utm24SToLatLon(
      expectedEasting,
      expectedNorthing,
    );
  if (
    Math.hypot(
      corner.latitude - expectedLatitude,
      corner.longitude - expectedLongitude,
    ) > 0.0000002
  ) {
    fail(`runtime geographicCorners.${name} WGS84 transform is inconsistent`);
  }
}

if (
  runtime.terrain.active === "procedural-fallback" &&
  runtime.terrain.fallbackActive !== true
) {
  fail("procedural terrain must be explicitly marked as fallback");
}

if (
  runtime.vectors.active === "site-data-fallback" &&
  runtime.vectors.fallbackActive !== true
) {
  fail("site-data vectors must be explicitly marked as fallback");
}

if (
  runtime.terrain.active === "geospatial-derived" &&
  runtime.derived?.terrain?.available !== true
) {
  fail("terrain cannot be marked geospatial-derived without a derived terrain product");
}
if (derivedTerrain?.available === true) {
  const terrainQualityPolicy =
    manifest.terrainQualityPolicy;

  if (!terrainQualityPolicy) {
    fail(
      "geospatial manifest must define terrainQualityPolicy when derived terrain is available",
    );
  } else {
    const statistics =
      derivedTerrain.statistics ?? {};

    if (
      !Number.isFinite(
        derivedTerrain.grid?.spacing,
      ) ||
      derivedTerrain.grid.spacing >
        terrainQualityPolicy.maxPersistentGridSpacing
    ) {
      fail(
        `derived terrain grid spacing must be <= ${terrainQualityPolicy.maxPersistentGridSpacing} m`,
      );
    }

    if (
      !Number.isFinite(
        statistics.contourCount,
      ) ||
      statistics.contourCount <
        terrainQualityPolicy.minContourCount
    ) {
      fail(
        `derived terrain must contain at least ${terrainQualityPolicy.minContourCount} contour paths`,
      );
    }

    if (
      !Number.isFinite(
        statistics.fixedCellCoverage,
      ) ||
      statistics.fixedCellCoverage <
        terrainQualityPolicy.minFixedCellCoverage
    ) {
      fail(
        `derived terrain fixed-cell coverage must be >= ${terrainQualityPolicy.minFixedCellCoverage}`,
      );
    }

    if (
      !Number.isFinite(
        statistics.finalMaxDelta,
      ) ||
      statistics.finalMaxDelta >
        terrainQualityPolicy.maxSolverDelta
    ) {
      fail(
        `derived terrain solver delta must be <= ${terrainQualityPolicy.maxSolverDelta} m`,
      );
    }

    if (
      !Number.isFinite(
        statistics.localHeightMax,
      ) ||
      !Number.isFinite(
        statistics.localHeightMin,
      ) ||
      statistics.localHeightMax -
          statistics.localHeightMin <
        terrainQualityPolicy.minLocalRelief
    ) {
      fail(
        `derived terrain local relief must be >= ${terrainQualityPolicy.minLocalRelief} m`,
      );
    }
  }

  const grid = derivedTerrain.grid;
  const terrainBounds = derivedTerrain.bounds;
  const renderSpacing =
    siteData.terrain.tileSize /
    siteData.terrain.subdivisionsPerTile;

  if (
    !Number.isFinite(renderSpacing) ||
    renderSpacing <= 0
  ) {
    fail(
      "terrain render spacing must be finite and positive",
    );
  } else if (
    grid &&
    renderSpacing > grid.spacing + 0.000001
  ) {
    fail(
      `terrain render spacing ${renderSpacing} m is coarser than derived grid spacing ${grid.spacing} m`,
    );
  }

  if (derivedTerrain.crs !== manifest.localCoordinateSystem.horizontalCrs) {
    fail("derived terrain CRS differs from geospatial manifest");
  }

  if (derivedTerrain.method !== manifest.terrainDerivation.method) {
    fail("derived terrain method differs from geospatial manifest");
  }

  if (!grid || grid.columns < 2 || grid.rows < 2 || grid.spacing <= 0) {
    fail("derived terrain grid metadata is invalid");
  } else {
    const expectedVertices = grid.columns * grid.rows;
    if (grid.vertexCount !== expectedVertices) {
      fail("derived terrain vertexCount does not match grid dimensions");
    }

    if (
      !Array.isArray(derivedTerrain.heights) ||
      derivedTerrain.heights.length !== expectedVertices
    ) {
      fail("derived terrain heights length does not match grid dimensions");
    } else {
      for (const height of derivedTerrain.heights) {
        if (!Number.isFinite(height)) {
          fail("derived terrain contains a non-finite height");
          break;
        }
      }
    }

    const expectedWidth = bounds.maxX - bounds.minX;
    const expectedDepth = bounds.maxZ - bounds.minZ;
    const gridWidth = (grid.columns - 1) * grid.spacing;
    const gridDepth = (grid.rows - 1) * grid.spacing;

    if (Math.abs(gridWidth - expectedWidth) > 0.01) {
      fail("derived terrain grid width differs from project perimeter");
    }

    if (Math.abs(gridDepth - expectedDepth) > 0.01) {
      fail("derived terrain grid depth differs from project perimeter");
    }
  }

  for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
    if (terrainBounds?.[key] !== bounds[key]) {
      fail(`derived terrain bounds.${key} differs from project perimeter`);
    }
  }

  if (
    derivedTerrain.verticalDatum?.mode ===
      "minimum-derived-elevation" &&
    Math.abs(derivedTerrain.statistics?.localHeightMin ?? 0) > 0.01
  ) {
    fail("derived terrain local minimum must be zero for the configured datum");
  }

  if ((derivedTerrain.statistics?.fixedCellCount ?? 0) < 4) {
    fail("derived terrain has too few fixed contour cells");
  }
}


if (
  runtime.terrain.active === "geospatial-derived" &&
  derivedTerrain?.available !== true
) {
  fail("runtime terrain is geospatial-derived but terrain.json is unavailable");
}
if (
  derivedTerrain?.available === true &&
  runtime.terrain.active !== "geospatial-derived"
) {
  fail(
    "derived terrain is available but runtime manifest has not activated it",
  );
}

if (
  runtime.terrain.active === "geospatial-derived" &&
  runtime.terrain.fallbackActive !== false
) {
  fail("geospatial-derived terrain cannot remain marked as fallback");
}


if (
  runtime.terrain.active === "geospatial-derived" &&
  runtime.derived?.terrain?.featureCount !==
    derivedTerrain?.grid?.vertexCount
) {
  fail("runtime terrain summary does not match derived terrain vertex count");
}

const vectorRuntimeActive =
  runtime.vectors.active === "geospatial-derived" ||
  runtime.vectors.active === "geospatial-hybrid";

if (
  vectorRuntimeActive &&
  runtime.derived?.vectors?.available !== true
) {
  fail(
    "active geospatial vectors require an available derived vector product",
  );
}
if (derivedVectors?.available === true) {
  if (derivedVectors.crs !== manifest.localCoordinateSystem.horizontalCrs) {
    fail("derived vectors CRS differs from geospatial manifest");
  }

  for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
    if (derivedVectors.bounds?.[key] !== bounds[key]) {
      fail(`derived vectors bounds.${key} differs from project perimeter`);
    }
  }

  const roads = Array.isArray(derivedVectors.roads)
    ? derivedVectors.roads
    : [];
  const spaces = Array.isArray(derivedVectors.spaces)
    ? derivedVectors.spaces
    : [];
  const buildings = Array.isArray(
    derivedVectors.buildingFootprints,
  )
    ? derivedVectors.buildingFootprints
    : [];

  const criticalRoadNames =
    manifest.vectorDerivation?.criticalRoadNames ?? [];
  const normalizedRoadNames = new Set(
    roads.map((road) =>
      String(road.name ?? "")
        .trim()
        .toLocaleLowerCase("pt-BR"),
    ),
  );
  const missingCriticalRoads =
    criticalRoadNames.filter(
      (name) =>
        !normalizedRoadNames.has(
          name
            .trim()
            .toLocaleLowerCase("pt-BR"),
        ),
    );
  const expectedCriticalCoverage = {
    found:
      criticalRoadNames.length -
      missingCriticalRoads.length,
    total: criticalRoadNames.length,
    missing: missingCriticalRoads,
    complete:
      missingCriticalRoads.length === 0,
  };
  const declaredCriticalCoverage =
    derivedVectors.metadata?.criticalRoadCoverage;

  if (declaredCriticalCoverage) {
    if (
      declaredCriticalCoverage.found !==
        expectedCriticalCoverage.found ||
      declaredCriticalCoverage.total !==
        expectedCriticalCoverage.total ||
      declaredCriticalCoverage.complete !==
        expectedCriticalCoverage.complete ||
      JSON.stringify(
        declaredCriticalCoverage.missing ?? [],
      ) !==
        JSON.stringify(
          expectedCriticalCoverage.missing,
        )
    ) {
      fail(
        "derived vector criticalRoadCoverage does not match actual road names",
      );
    }
  }

  if (
    derivedVectors.metadata?.coverage ===
      "complete" &&
    !expectedCriticalCoverage.complete
  ) {
    fail(
      `complete vector coverage is missing critical roads: ${missingCriticalRoads.join(", ")}`,
    );
  }

  const expectedCount =
    roads.length + spaces.length + buildings.length;

  if (derivedVectors.metadata?.featureCount !== expectedCount) {
    fail("derived vector featureCount does not match its collections");
  }

  if (roads.length === 0 || spaces.length === 0) {
    fail(
      "derived vectors cannot be runtime-ready without both roads and spaces",
    );
  }

  if (derivedVectors.metadata?.runtimeReady !== true) {
    fail("derived vectors are available but metadata.runtimeReady is false");
  }

  const inBounds = ([x, z]) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x >= bounds.minX - 0.001 &&
    x <= bounds.maxX + 0.001 &&
    z >= bounds.minZ - 0.001 &&
    z <= bounds.maxZ + 0.001;

  for (const road of roads) {
    if (
      !Number.isFinite(road.width) ||
      road.width <= 0 ||
      !Array.isArray(road.points) ||
      road.points.length < 2
    ) {
      fail(`${road.id} has invalid road geometry or width`);
      continue;
    }

    if (!road.points.every(inBounds)) {
      fail(`${road.id} contains a road point outside project bounds`);
    }

    if (
      !Number.isFinite(road.osmId) ||
      typeof road.osmType !== "string" ||
      road.osmType.length === 0
    ) {
      fail(`${road.id} must preserve OSM identity`);
    }

    if (road.elevationMode !== "terrain") {
      fail(
        `${road.id} must follow the active terrain; fixed upper/lower road elevation is not allowed for derived OSM geometry`,
      );
    }
  }

  for (const space of spaces) {
    if (!Array.isArray(space.points) || space.points.length < 3) {
      fail(`${space.id} has invalid space geometry`);
      continue;
    }

    if (!space.points.every(inBounds)) {
      fail(`${space.id} contains a space point outside project bounds`);
    }

    if (
      !Number.isFinite(space.osmId) ||
      typeof space.osmType !== "string" ||
      space.osmType.length === 0
    ) {
      fail(`${space.id} must preserve OSM identity`);
    }

    if (space.elevationMode !== "terrain") {
      fail(
        `${space.id} must follow the active terrain; fixed upper/lower elevation is not allowed for derived OSM areas`,
      );
    }
  }

  for (const building of buildings) {
    if (
      !Array.isArray(building.footprint) ||
      building.footprint.length < 3
    ) {
      fail(`${building.id} has invalid building footprint`);
      continue;
    }

    if (!building.footprint.every(inBounds)) {
      fail(`${building.id} contains a footprint point outside project bounds`);
    }

    if (
      building.height !== null &&
      (!Number.isFinite(building.height) || building.height <= 0)
    ) {
      fail(`${building.id} has an invalid derived building height`);
    }

    if (typeof building.heightEstimated !== "boolean") {
      fail(`${building.id} must state whether its height is estimated`);
    }

    if (
      typeof building.heightSource !== "string" ||
      building.heightSource.length === 0
    ) {
      fail(`${building.id} must preserve height provenance`);
    }
  }
}

if (
  derivedVectors?.available === true &&
  !vectorRuntimeActive
) {
  fail(
    "derived vectors are available but runtime manifest has not activated them",
  );
}

if (
  vectorRuntimeActive &&
  derivedVectors?.available !== true
) {
  fail(
    "runtime geospatial vectors are active but site-vectors.json is unavailable",
  );
}

if (
  runtime.vectors.active === "geospatial-derived" &&
  runtime.vectors.fallbackActive !== false
) {
  fail("complete geospatial-derived vectors cannot remain marked as fallback");
}

if (
  runtime.vectors.active === "geospatial-hybrid" &&
  runtime.vectors.fallbackActive !== true
) {
  fail("geospatial-hybrid vectors must remain explicitly marked as fallback");
}

if (
  runtime.vectors.active === "geospatial-derived" &&
  derivedVectors?.metadata?.coverage !== "complete"
) {
  fail("complete geospatial-derived vectors require coverage=complete");
}

if (
  runtime.vectors.active === "geospatial-hybrid" &&
  derivedVectors?.metadata?.coverage === "complete"
) {
  fail("geospatial-hybrid must not be used for complete vector coverage");
}

if (
  vectorRuntimeActive &&
  runtime.derived?.vectors?.featureCount !==
    derivedVectors?.metadata?.featureCount
) {
  fail("runtime vector summary does not match derived vector feature count");
}


if (runtime.sources.contours.available && runtime.sources.contours.featureCount <= 0) {
  fail("CONDER contours marked available but contain no features");
}

if (runtime.sources.osm.available && runtime.sources.osm.featureCount <= 0) {
  fail("OSM data marked available but contain no features");
}

if (errors.length > 0) {
  console.error("Geospatial base validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Geospatial base valid. Terrain=${runtime.terrain.active}; vectors=${runtime.vectors.active}`,
  );
}
