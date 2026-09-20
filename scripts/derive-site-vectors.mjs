import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadGeospatialContext,
  pathExists,
  root,
} from "./lib/geospatial-context.mjs";
import { deriveOsmSiteVectors } from "./lib/osm-site-vectors.mjs";

const { manifest, bounds } = await loadGeospatialContext();
const inputPath = resolve(
  root,
  manifest.sources.osm.normalizedOutput,
);
const outputPath = resolve(
  root,
  manifest.pipeline.derivedVectors,
);

if (!(await pathExists(inputPath))) {
  throw new Error(
    [
      "Normalized OSM site data was not found.",
      "Run npm run geospatial:import:osm first.",
    ].join(" "),
  );
}

const payload = JSON.parse(
  await readFile(inputPath, "utf8"),
);
const features = Array.isArray(payload.features)
  ? payload.features
  : [];

const output = deriveOsmSiteVectors({
  features,
  bounds,
  config: manifest.vectorDerivation,
  source:
    payload.metadata?.source ??
    "OpenStreetMap normalized site layer",
  crs: manifest.localCoordinateSystem.horizontalCrs,
  units: manifest.units,
  coverage: payload.metadata?.coverage ?? "partial",
  criticalRoadNames:
    manifest.vectorDerivation.criticalRoadNames ?? [],
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Derived ${output.metadata.roadCount} roads,`,
    `${output.metadata.spaceCount} spaces and`,
    `${output.metadata.buildingFootprintCount} building footprints.`,
  ].join(" "),
);
