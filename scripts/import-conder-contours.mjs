import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadGeospatialContext,
  projectedToLocal,
  root,
} from "./lib/geospatial-context.mjs";

const { manifest, bounds, projected } = await loadGeospatialContext();
const source = manifest.sources.conderContours;
const serviceUrl = `${source.service}/query`;
const rawOutputPath = resolve(root, source.rawOutput);
const normalizedOutputPath = resolve(root, source.normalizedOutput);

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
  outFields: `OBJECTID,${source.elevationField}`,
  returnGeometry: "true",
  returnZ: "true",
  outSR: "32724",
  f: "json",
});

const response = await fetch(`${serviceUrl}?${params.toString()}`);
if (!response.ok) {
  throw new Error(
    `CONDER request failed: ${response.status} ${response.statusText}`,
  );
}

const payload = await response.json();

if (payload.error) {
  throw new Error(`CONDER ArcGIS error: ${JSON.stringify(payload.error)}`);
}

if (payload.exceededTransferLimit === true) {
  throw new Error(
    "CONDER response exceeded transfer limit; refusing to persist partial contours.",
  );
}

if (!Array.isArray(payload.features)) {
  throw new Error(
    "CONDER response has no features array.",
  );
}

if (payload.features.length === 0) {
  throw new Error(
    "CONDER response contains no contour features.",
  );
}

await mkdir(dirname(rawOutputPath), { recursive: true });
await writeFile(
  rawOutputPath,
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
);

const contours = [];

for (const feature of payload.features) {
  const elevation = feature.attributes?.[source.elevationField];
  const objectId = feature.attributes?.OBJECTID;
  if (!Number.isFinite(elevation)) continue;

  for (const [pathIndex, path] of (feature.geometry?.paths ?? []).entries()) {
    const points = path
      .filter((point) => Array.isArray(point) && point.length >= 2)
      .map((point) =>
        projectedToLocal(projected, Number(point[0]), Number(point[1])),
      );

    if (points.length < 2) continue;

    contours.push({
      id: `conder-1992-${objectId}-${pathIndex}`,
      elevation,
      points,
    });
  }
}

contours.sort(
  (a, b) => a.elevation - b.elevation || a.id.localeCompare(b.id),
);

if (contours.length < 2) {
  throw new Error(
    `CONDER returned only ${contours.length} usable contour paths; refusing to promote terrain input.`,
  );
}

const output = {
  metadata: {
    source:
      "CONDER Cartografia Sistemática 1992 — REL_Curva_Nivel_L, MapServer layer 14",
    sourceUrl: source.service,
    sourceCrs: "EPSG:32724",
    normalizedCrs: manifest.localCoordinateSystem.horizontalCrs,
    localOrigin: {
      easting: projected.easting,
      northing: projected.northing,
    },
    boundsMeters: bounds,
    generatedAt: new Date().toISOString(),
    featureCount: contours.length,
  },
  contours,
};

await mkdir(dirname(normalizedOutputPath), { recursive: true });
await writeFile(
  normalizedOutputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Imported ${contours.length} CONDER contour paths.`,
    `Raw: ${source.rawOutput}.`,
    `Normalized: ${source.normalizedOutput}.`,
  ].join(" "),
);
