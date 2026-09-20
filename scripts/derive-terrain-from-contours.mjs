import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadGeospatialContext,
  pathExists,
  root,
} from "./lib/geospatial-context.mjs";

const { manifest, bounds } = await loadGeospatialContext();
const config = manifest.terrainDerivation;
const inputPath = resolve(
  root,
  manifest.sources.conderContours.normalizedOutput,
);
const outputPath = resolve(root, manifest.pipeline.derivedTerrain);

if (!(await pathExists(inputPath))) {
  throw new Error(
    [
      "Normalized CONDER contours were not found.",
      "Run npm run geospatial:import:conder first.",
    ].join(" "),
  );
}

const payload = JSON.parse(await readFile(inputPath, "utf8"));
const contours = Array.isArray(payload.contours)
  ? payload.contours
  : [];

if (contours.length === 0) {
  throw new Error("Normalized CONDER contour set is empty.");
}

const spacing = Number(config.gridSpacing);
const sampleSpacing = Number(config.contourSampleSpacing);
const columns =
  Math.round((bounds.maxX - bounds.minX) / spacing) + 1;
const rows =
  Math.round((bounds.maxZ - bounds.minZ) / spacing) + 1;
const cellCount = columns * rows;

if (
  !Number.isFinite(spacing) ||
  spacing <= 0 ||
  columns < 2 ||
  rows < 2
) {
  throw new Error("Invalid terrain derivation grid configuration.");
}

const heights = new Float64Array(cellCount);
const fixed = new Uint8Array(cellCount);
const fixedSum = new Float64Array(cellCount);
const fixedWeight = new Float64Array(cellCount);

const indexOf = (column, row) => row * columns + column;

function addConstraint(x, z, elevation) {
  const column = Math.round((x - bounds.minX) / spacing);
  const row = Math.round((z - bounds.minZ) / spacing);

  if (
    column < 0 ||
    column >= columns ||
    row < 0 ||
    row >= rows
  ) {
    return;
  }

  const index = indexOf(column, row);
  fixedSum[index] += elevation;
  fixedWeight[index] += 1;
}

function sampleContourSegment(a, b, elevation) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(
    1,
    Math.ceil(distance / sampleSpacing),
  );

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    addConstraint(
      a[0] + dx * t,
      a[1] + dz * t,
      elevation,
    );
  }
}

let sourcePointCount = 0;
let absoluteMin = Number.POSITIVE_INFINITY;
let absoluteMax = Number.NEGATIVE_INFINITY;

for (const contour of contours) {
  const elevation = Number(contour.elevation);
  const points = Array.isArray(contour.points)
    ? contour.points
    : [];

  if (!Number.isFinite(elevation) || points.length < 2) {
    continue;
  }

  absoluteMin = Math.min(absoluteMin, elevation);
  absoluteMax = Math.max(absoluteMax, elevation);

  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];

    if (
      !Array.isArray(a) ||
      !Array.isArray(b) ||
      !Number.isFinite(a[0]) ||
      !Number.isFinite(a[1]) ||
      !Number.isFinite(b[0]) ||
      !Number.isFinite(b[1])
    ) {
      continue;
    }

    sourcePointCount += 1;
    sampleContourSegment(a, b, elevation);
  }
}

if (!Number.isFinite(absoluteMin) || !Number.isFinite(absoluteMax)) {
  throw new Error("No finite CONDER contour elevations were found.");
}

const queue = new Int32Array(cellCount);
let queueHead = 0;
let queueTail = 0;
let fixedCellCount = 0;
let fixedElevationSum = 0;

for (let index = 0; index < cellCount; index++) {
  if (fixedWeight[index] <= 0) continue;

  const elevation =
    fixedSum[index] / fixedWeight[index];
  heights[index] = elevation;
  fixed[index] = 1;
  fixedCellCount += 1;
  fixedElevationSum += elevation;
  queue[queueTail++] = index;
}

if (fixedCellCount < 4) {
  throw new Error(
    `Only ${fixedCellCount} constrained grid cells were generated.`,
  );
}

const assigned = new Uint8Array(cellCount);
for (let index = 0; index < cellCount; index++) {
  if (fixed[index]) assigned[index] = 1;
}

const neighborOffsets = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

while (queueHead < queueTail) {
  const index = queue[queueHead++];
  const row = Math.floor(index / columns);
  const column = index - row * columns;

  for (const [dx, dz] of neighborOffsets) {
    const nextColumn = column + dx;
    const nextRow = row + dz;

    if (
      nextColumn < 0 ||
      nextColumn >= columns ||
      nextRow < 0 ||
      nextRow >= rows
    ) {
      continue;
    }

    const nextIndex = indexOf(nextColumn, nextRow);
    if (assigned[nextIndex]) continue;

    assigned[nextIndex] = 1;
    heights[nextIndex] = heights[index];
    queue[queueTail++] = nextIndex;
  }
}

const maxIterations = Math.max(
  1,
  Math.floor(config.maxIterations),
);
const tolerance = Math.max(0.000001, Number(config.tolerance));
const omega = 1.55;
let iterations = 0;
let finalMaxDelta = Number.POSITIVE_INFINITY;

for (
  iterations = 1;
  iterations <= maxIterations;
  iterations++
) {
  let maxDelta = 0;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = indexOf(column, row);
      if (fixed[index]) continue;

      let sum = 0;
      let count = 0;

      if (column > 0) {
        sum += heights[indexOf(column - 1, row)];
        count += 1;
      }
      if (column + 1 < columns) {
        sum += heights[indexOf(column + 1, row)];
        count += 1;
      }
      if (row > 0) {
        sum += heights[indexOf(column, row - 1)];
        count += 1;
      }
      if (row + 1 < rows) {
        sum += heights[indexOf(column, row + 1)];
        count += 1;
      }

      if (count === 0) continue;

      const average = sum / count;
      const previous = heights[index];
      const next =
        previous + omega * (average - previous);
      heights[index] = next;
      maxDelta = Math.max(maxDelta, Math.abs(next - previous));
    }
  }

  finalMaxDelta = maxDelta;
  if (maxDelta <= tolerance) break;
}

let solvedMin = Number.POSITIVE_INFINITY;
let solvedMax = Number.NEGATIVE_INFINITY;

for (const elevation of heights) {
  solvedMin = Math.min(solvedMin, elevation);
  solvedMax = Math.max(solvedMax, elevation);
}

const verticalDatumAbsolute =
  config.verticalDatum === "minimum-derived-elevation"
    ? solvedMin
    : 0;

const localHeights = Array.from(heights, (elevation) =>
  Number((elevation - verticalDatumAbsolute).toFixed(3)),
);

const output = {
  schemaVersion: 1,
  available: true,
  generatedAt: new Date().toISOString(),
  source:
    payload.metadata?.source ??
    "CONDER normalized contour layer",
  sourceCrs:
    payload.metadata?.sourceCrs ??
    manifest.localCoordinateSystem.horizontalCrs,
  crs: manifest.localCoordinateSystem.horizontalCrs,
  units: manifest.units,
  method: config.method,
  bounds,
  grid: {
    spacing,
    columns,
    rows,
    vertexCount: cellCount,
  },
  verticalDatum: {
    mode: config.verticalDatum,
    absoluteElevation: Number(
      verticalDatumAbsolute.toFixed(3),
    ),
  },
  statistics: {
    contourCount: contours.length,
    sourcePointCount,
    fixedCellCount,
    fixedCellCoverage: Number(
      (fixedCellCount / cellCount).toFixed(6),
    ),
    sourceElevationMin: absoluteMin,
    sourceElevationMax: absoluteMax,
    solvedAbsoluteMin: Number(solvedMin.toFixed(3)),
    solvedAbsoluteMax: Number(solvedMax.toFixed(3)),
    localHeightMin: Number(
      (solvedMin - verticalDatumAbsolute).toFixed(3),
    ),
    localHeightMax: Number(
      (solvedMax - verticalDatumAbsolute).toFixed(3),
    ),
    initialFixedElevationMean: Number(
      (fixedElevationSum / fixedCellCount).toFixed(3),
    ),
    iterations: Math.min(iterations, maxIterations),
    finalMaxDelta: Number(finalMaxDelta.toFixed(6)),
  },
  interpolation: {
    contourSampleSpacing: sampleSpacing,
    maxIterations,
    tolerance,
    relaxationOmega: omega,
    description:
      "Contour cells are fixed to official elevations. Unknown cells are initialized by nearest constrained cell and solved with harmonic relaxation.",
  },
  heights: localHeights,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Derived terrain grid: ${columns} x ${rows}`,
    `(${cellCount} vertices).`,
    `Fixed contour cells: ${fixedCellCount}.`,
    `Iterations: ${output.statistics.iterations}.`,
    `Max local height: ${output.statistics.localHeightMax} m.`,
  ].join(" "),
);
