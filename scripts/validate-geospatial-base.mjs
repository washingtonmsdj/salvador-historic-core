import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadGeospatialContext, root } from "./lib/geospatial-context.mjs";
import {
  latLonToUtm24S,
  utm24SToLatLon,
} from "./lib/utm-wgs84.mjs";

const { manifest, origin, bounds } = await loadGeospatialContext();
const runtimePath = resolve(root, manifest.pipeline.runtimeManifest);
const runtime = JSON.parse(await readFile(runtimePath, "utf8"));
const errors = [];

function fail(message) {
  errors.push(message);
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

if (
  runtime.vectors.active === "geospatial-derived" &&
  runtime.derived?.vectors?.available !== true
) {
  fail("vectors cannot be marked geospatial-derived without a derived vector product");
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
