import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SERVICE_URL =
  "https://mapas.conder.ba.gov.br/arcgis/rest/services/CARTOGRAFIA_SISTEMATICA/CARTOGRAFIA_SISTEMATICA_1992_24/MapServer/14/query";

const root = process.cwd();
const siteDataPath = resolve(root, "src/data/site-data.json");
const outputPath = resolve(root, "src/data/terrain-contours.reference.json");
const siteData = JSON.parse(await readFile(siteDataPath, "utf8"));

const projected = siteData.metadata?.origin?.projected;
const bounds = siteData.terrain?.bounds;

if (!projected || projected.crs !== "EPSG:32724") {
  throw new Error("site-data.json must define metadata.origin.projected in EPSG:32724.");
}
if (!bounds) {
  throw new Error("site-data.json must define terrain.bounds.");
}

const envelope = [
  projected.easting + bounds.minX,
  projected.northing + bounds.minZ,
  projected.easting + bounds.maxX,
  projected.northing + bounds.maxZ,
].join(",");

const params = new URLSearchParams({
  where: "1=1",
  geometry: envelope,
  geometryType: "esriGeometryEnvelope",
  inSR: "32724",
  spatialRel: "esriSpatialRelIntersects",
  outFields: "OBJECTID,ELEVATION",
  returnGeometry: "true",
  returnZ: "true",
  outSR: "32724",
  f: "json",
});

const response = await fetch(`${SERVICE_URL}?${params.toString()}`);
if (!response.ok) {
  throw new Error(`CONDER request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
if (payload.error) {
  throw new Error(`CONDER ArcGIS error: ${JSON.stringify(payload.error)}`);
}

const contours = [];

for (const feature of payload.features ?? []) {
  const elevation = feature.attributes?.ELEVATION;
  const objectId = feature.attributes?.OBJECTID;
  if (!Number.isFinite(elevation)) continue;

  for (const [pathIndex, path] of (feature.geometry?.paths ?? []).entries()) {
    const points = path
      .filter((point) => Array.isArray(point) && point.length >= 2)
      .map((point) => [
        Number((point[0] - projected.easting).toFixed(3)),
        Number((point[1] - projected.northing).toFixed(3)),
      ]);

    if (points.length < 2) continue;
    contours.push({
      id: `conder-1992-${objectId}-${pathIndex}`,
      elevation,
      points,
    });
  }
}

contours.sort((a, b) => a.elevation - b.elevation || a.id.localeCompare(b.id));

const output = {
  metadata: {
    source:
      "CONDER Cartografia Sistemática 1992 — REL_Curva_Nivel_L, MapServer layer 14",
    sourceUrl: SERVICE_URL.replace(/\/query$/, ""),
    sourceCrs: "EPSG:32724",
    localOrigin: {
      easting: projected.easting,
      northing: projected.northing,
    },
    generatedAt: new Date().toISOString(),
    featureCount: contours.length,
  },
  contours,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  `Imported ${contours.length} contour paths into ${outputPath.replace(`${root}/`, "")}`,
);
