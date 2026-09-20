import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { utm24SToLatLon } from "./lib/utm-wgs84.mjs";
import {
  loadGeospatialContext,
  pathExists,
  root,
} from "./lib/geospatial-context.mjs";

const { manifest, origin, bounds } = await loadGeospatialContext();

const [southLatitude, westLongitude] = utm24SToLatLon(
  origin.projected.easting + bounds.minX,
  origin.projected.northing + bounds.minZ,
);
const [northLatitude, eastLongitude] = utm24SToLatLon(
  origin.projected.easting + bounds.maxX,
  origin.projected.northing + bounds.maxZ,
);

const normalizedOsmPath = resolve(
  root,
  manifest.sources.osm.normalizedOutput,
);
const normalizedContoursPath = resolve(
  root,
  manifest.sources.conderContours.normalizedOutput,
);
const derivedTerrainPath = resolve(root, manifest.pipeline.derivedTerrain);
const derivedVectorsPath = resolve(root, manifest.pipeline.derivedVectors);
const outputPath = resolve(root, manifest.pipeline.runtimeManifest);

async function summarize(path, kind) {
  if (!(await pathExists(path))) {
    return { kind, available: false, featureCount: 0 };
  }

  const payload = JSON.parse(await readFile(path, "utf8"));
  const explicitlyUnavailable = payload.available === false;
  const featureCount =
    payload.metadata?.featureCount ??
    payload.grid?.vertexCount ??
    payload.features?.length ??
    payload.contours?.length ??
    0;

  return {
    kind,
    available: !explicitlyUnavailable && featureCount > 0,
    featureCount,
    coverage: payload.metadata?.coverage ?? "complete",
    generatedAt:
      payload.generatedAt ?? payload.metadata?.generatedAt ?? null,
    source: payload.source ?? payload.metadata?.source ?? null,
  };
}

const [osm, contours, terrainDerived, vectorsDerived] = await Promise.all([
  summarize(normalizedOsmPath, "osm"),
  summarize(normalizedContoursPath, "conder-contours"),
  summarize(derivedTerrainPath, "terrain-derived"),
  summarize(derivedVectorsPath, "vectors-derived"),
]);

const runtime = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  crs: manifest.localCoordinateSystem.horizontalCrs,
  units: manifest.units,
  origin: {
    latitude: origin.latitude,
    longitude: origin.longitude,
    easting: origin.projected.easting,
    northing: origin.projected.northing,
  },
  perimeter: bounds,
  geographicBounds: {
    south: southLatitude,
    west: westLongitude,
    north: northLatitude,
    east: eastLongitude,
  },
  mapReference: manifest.rasterReference,
  sources: {
    osm,
    contours,
  },
  derived: {
    terrain: terrainDerived,
    vectors: vectorsDerived,
  },
  terrain: {
    preferred: manifest.runtime.preferredTerrainSource,
    active: terrainDerived.available
      ? "geospatial-derived"
      : "procedural-fallback",
    fallbackActive: !terrainDerived.available,
  },
  vectors: {
    preferred: manifest.runtime.preferredVectorSource,
    active: vectorsDerived.available
      ? vectorsDerived.coverage === "complete"
        ? "geospatial-derived"
        : "geospatial-hybrid"
      : "site-data-fallback",
    fallbackActive:
      !vectorsDerived.available ||
      vectorsDerived.coverage !== "complete",
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(runtime, null, 2)}\n`, "utf8");

console.log(
  [
    `Geospatial runtime manifest written to ${manifest.pipeline.runtimeManifest}.`,
    `Terrain: ${runtime.terrain.active}.`,
    `Vectors: ${runtime.vectors.active}.`,
  ].join(" "),
);
