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

const { manifest, origin, bounds } = await loadGeospatialContext();
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
  const grid = derivedTerrain.grid;
  const terrainBounds = derivedTerrain.bounds;

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

if (
  runtime.vectors.active === "geospatial-derived" &&
  runtime.derived?.vectors?.available !== true
) {
  fail("vectors cannot be marked geospatial-derived without a derived vector product");
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
  }

  for (const space of spaces) {
    if (!Array.isArray(space.points) || space.points.length < 3) {
      fail(`${space.id} has invalid space geometry`);
      continue;
    }

    if (!space.points.every(inBounds)) {
      fail(`${space.id} contains a space point outside project bounds`);
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
  runtime.vectors.active !== "geospatial-derived"
) {
  fail(
    "derived vectors are available but runtime manifest has not activated them",
  );
}

if (
  runtime.vectors.active === "geospatial-derived" &&
  derivedVectors?.available !== true
) {
  fail("runtime vectors are geospatial-derived but site-vectors.json is unavailable");
}

if (
  runtime.vectors.active === "geospatial-derived" &&
  runtime.vectors.fallbackActive !== false
) {
  fail("geospatial-derived vectors cannot remain marked as fallback");
}

if (
  runtime.vectors.active === "geospatial-derived" &&
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
