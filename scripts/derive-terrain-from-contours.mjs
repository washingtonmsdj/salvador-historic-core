import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { deriveContourHeightfield } from "./lib/contour-heightfield.mjs";
import {
  loadGeospatialContext,
  pathExists,
  root,
} from "./lib/geospatial-context.mjs";

const { manifest, bounds } = await loadGeospatialContext();
const inputPath = resolve(
  root,
  manifest.sources.conderContours.normalizedOutput,
);
const outputPath = resolve(
  root,
  manifest.pipeline.derivedTerrain,
);

if (!(await pathExists(inputPath))) {
  throw new Error(
    [
      "Normalized CONDER contours were not found.",
      "Run npm run geospatial:import:conder first.",
    ].join(" "),
  );
}

const payload = JSON.parse(
  await readFile(inputPath, "utf8"),
);
const contours = Array.isArray(payload.contours)
  ? payload.contours
  : [];

const output = deriveContourHeightfield({
  contours,
  bounds,
  config: manifest.terrainDerivation,
  source:
    payload.metadata?.source ??
    "CONDER normalized contour layer",
  sourceCrs:
    payload.metadata?.sourceCrs ??
    manifest.localCoordinateSystem.horizontalCrs,
  crs: manifest.localCoordinateSystem.horizontalCrs,
  units: manifest.units,
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Derived terrain grid: ${output.grid.columns} x ${output.grid.rows}`,
    `(${output.grid.vertexCount} vertices).`,
    `Fixed contour cells: ${output.statistics.fixedCellCount}.`,
    `Iterations: ${output.statistics.iterations}.`,
    `Max local height: ${output.statistics.localHeightMax} m.`,
  ].join(" "),
);
