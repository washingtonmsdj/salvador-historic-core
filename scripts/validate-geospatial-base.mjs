import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadGeospatialContext, root } from "./lib/geospatial-context.mjs";

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
