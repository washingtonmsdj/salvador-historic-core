import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadGeospatialContext,
  pathExists,
  root,
} from "./lib/geospatial-context.mjs";

const { manifest, origin, bounds } = await loadGeospatialContext();

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
  const featureCount =
    payload.metadata?.featureCount ??
    payload.features?.length ??
    payload.contours?.length ??
    0;

  return {
    kind,
    available: true,
    featureCount,
    generatedAt: payload.metadata?.generatedAt ?? null,
    source: payload.metadata?.source ?? null,
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
      ? "geospatial-derived"
      : "site-data-fallback",
    fallbackActive: !vectorsDerived.available,
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
