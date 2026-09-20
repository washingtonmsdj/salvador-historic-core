import type {
  DerivedTerrainGrid,
  Point2,
} from "./types";

export interface ContourLine {
  id: string;
  elevation: number;
  points: Point2[];
}

export interface ContourHeightfieldConfig {
  method: string;
  gridSpacing: number;
  contourSampleSpacing: number;
  maxIterations: number;
  tolerance: number;
  verticalDatum:
    | "minimum-derived-elevation"
    | string;
}

export interface DerivedContourTerrain
  extends DerivedTerrainGrid {
  generatedAt: string;
  method: string;
  statistics: {
    contourCount: number;
    sourcePointCount: number;
    fixedCellCount: number;
    iterations: number;
    finalMaxDelta: number;
    sourceElevationMin: number;
    sourceElevationMax: number;
    localHeightMin: number;
    localHeightMax: number;
  };
}

export function deriveContourHeightfield({
  contours,
  bounds,
  config,
  source,
}: {
  contours: ContourLine[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  config: ContourHeightfieldConfig;
  source: string;
}): DerivedContourTerrain {
  const spacing = Number(
    config.gridSpacing,
  );
  const sampleSpacing = Number(
    config.contourSampleSpacing,
  );
  const columns =
    Math.round(
      (bounds.maxX - bounds.minX) /
        spacing,
    ) + 1;
  const rows =
    Math.round(
      (bounds.maxZ - bounds.minZ) /
        spacing,
    ) + 1;
  const cellCount = columns * rows;

  if (
    !Number.isFinite(spacing) ||
    spacing <= 0 ||
    !Number.isFinite(sampleSpacing) ||
    sampleSpacing <= 0 ||
    columns < 2 ||
    rows < 2
  ) {
    throw new Error(
      "Invalid live terrain grid configuration.",
    );
  }

  if (contours.length === 0) {
    throw new Error(
      "CONDER contour set is empty.",
    );
  }

  const heights =
    new Float64Array(cellCount);
  const fixed =
    new Uint8Array(cellCount);
  const fixedSum =
    new Float64Array(cellCount);
  const fixedWeight =
    new Float64Array(cellCount);

  const indexOf = (
    column: number,
    row: number,
  ) => row * columns + column;

  const addConstraint = (
    x: number,
    z: number,
    elevation: number,
  ) => {
    const column = Math.round(
      (x - bounds.minX) / spacing,
    );
    const row = Math.round(
      (z - bounds.minZ) / spacing,
    );

    if (
      column < 0 ||
      column >= columns ||
      row < 0 ||
      row >= rows
    ) {
      return;
    }

    const index = indexOf(column, row);
    fixedSum[index] =
      (fixedSum[index] ?? 0) + elevation;
    fixedWeight[index] =
      (fixedWeight[index] ?? 0) + 1;
  };

  const sampleSegment = (
    a: Point2,
    b: Point2,
    elevation: number,
  ) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(
      1,
      Math.ceil(
        distance / sampleSpacing,
      ),
    );

    for (
      let step = 0;
      step <= steps;
      step++
    ) {
      const t = step / steps;
      addConstraint(
        a[0] + dx * t,
        a[1] + dz * t,
        elevation,
      );
    }
  };

  let sourcePointCount = 0;
  let sourceElevationMin =
    Number.POSITIVE_INFINITY;
  let sourceElevationMax =
    Number.NEGATIVE_INFINITY;

  for (const contour of contours) {
    if (
      !Number.isFinite(
        contour.elevation,
      ) ||
      contour.points.length < 2
    ) {
      continue;
    }

    sourceElevationMin = Math.min(
      sourceElevationMin,
      contour.elevation,
    );
    sourceElevationMax = Math.max(
      sourceElevationMax,
      contour.elevation,
    );

    for (
      let index = 0;
      index < contour.points.length - 1;
      index++
    ) {
      const a = contour.points[index];
      const b =
        contour.points[index + 1];
      if (!a || !b) continue;

      sourcePointCount += 1;
      sampleSegment(
        a,
        b,
        contour.elevation,
      );
    }
  }

  if (
    !Number.isFinite(
      sourceElevationMin,
    ) ||
    !Number.isFinite(
      sourceElevationMax,
    )
  ) {
    throw new Error(
      "No finite CONDER contour elevations were found.",
    );
  }

  const queue =
    new Int32Array(cellCount);
  const assigned =
    new Uint8Array(cellCount);
  let queueHead = 0;
  let queueTail = 0;
  let fixedCellCount = 0;

  for (
    let index = 0;
    index < cellCount;
    index++
  ) {
    const weight =
      fixedWeight[index] ?? 0;
    if (weight <= 0) continue;

    const elevation =
      (fixedSum[index] ?? 0) /
      weight;
    heights[index] = elevation;
    fixed[index] = 1;
    assigned[index] = 1;
    fixedCellCount += 1;
    queue[queueTail++] = index;
  }

  if (fixedCellCount < 4) {
    throw new Error(
      `Only ${fixedCellCount} constrained terrain cells were generated.`,
    );
  }

  const neighborOffsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const;

  while (queueHead < queueTail) {
    const current =
      queue[queueHead++];
    if (current === undefined) {
      continue;
    }

    const row = Math.floor(
      current / columns,
    );
    const column =
      current - row * columns;

    for (const [
      dx,
      dz,
    ] of neighborOffsets) {
      const nextColumn =
        column + dx;
      const nextRow = row + dz;

      if (
        nextColumn < 0 ||
        nextColumn >= columns ||
        nextRow < 0 ||
        nextRow >= rows
      ) {
        continue;
      }

      const nextIndex = indexOf(
        nextColumn,
        nextRow,
      );
      if (assigned[nextIndex]) {
        continue;
      }

      assigned[nextIndex] = 1;
      heights[nextIndex] =
        heights[current] ?? 0;
      queue[queueTail++] =
        nextIndex;
    }
  }

  const maxIterations = Math.max(
    1,
    Math.floor(
      config.maxIterations,
    ),
  );
  const tolerance = Math.max(
    0.000001,
    Number(config.tolerance),
  );
  const omega = 1.55;
  let iterations = 0;
  let finalMaxDelta =
    Number.POSITIVE_INFINITY;

  for (
    iterations = 1;
    iterations <= maxIterations;
    iterations++
  ) {
    let maxDelta = 0;

    for (
      let row = 0;
      row < rows;
      row++
    ) {
      for (
        let column = 0;
        column < columns;
        column++
      ) {
        const index = indexOf(
          column,
          row,
        );
        if (fixed[index]) {
          continue;
        }

        let sum = 0;
        let count = 0;

        if (column > 0) {
          sum +=
            heights[
              indexOf(
                column - 1,
                row,
              )
            ] ?? 0;
          count += 1;
        }
        if (column + 1 < columns) {
          sum +=
            heights[
              indexOf(
                column + 1,
                row,
              )
            ] ?? 0;
          count += 1;
        }
        if (row > 0) {
          sum +=
            heights[
              indexOf(
                column,
                row - 1,
              )
            ] ?? 0;
          count += 1;
        }
        if (row + 1 < rows) {
          sum +=
            heights[
              indexOf(
                column,
                row + 1,
              )
            ] ?? 0;
          count += 1;
        }

        if (count === 0) {
          continue;
        }

        const average = sum / count;
        const previous =
          heights[index] ?? 0;
        const next =
          previous +
          omega *
            (average - previous);
        heights[index] = next;
        maxDelta = Math.max(
          maxDelta,
          Math.abs(
            next - previous,
          ),
        );
      }
    }

    finalMaxDelta = maxDelta;
    if (maxDelta <= tolerance) {
      break;
    }
  }

  let solvedMin =
    Number.POSITIVE_INFINITY;
  let solvedMax =
    Number.NEGATIVE_INFINITY;

  for (const elevation of heights) {
    solvedMin = Math.min(
      solvedMin,
      elevation,
    );
    solvedMax = Math.max(
      solvedMax,
      elevation,
    );
  }

  const verticalDatumAbsolute =
    config.verticalDatum ===
    "minimum-derived-elevation"
      ? solvedMin
      : 0;

  const localHeights = Array.from(
    heights,
    (elevation) =>
      Number(
        (
          elevation -
          verticalDatumAbsolute
        ).toFixed(3),
      ),
  );

  return {
    available: true,
    source,
    crs: "EPSG:32724",
    units: "meters",
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
        verticalDatumAbsolute.toFixed(
          3,
        ),
      ),
    },
    heights: localHeights,
    generatedAt:
      new Date().toISOString(),
    method:
      "contour-constrained-harmonic-grid-live-preview",
    statistics: {
      contourCount: contours.length,
      sourcePointCount,
      fixedCellCount,
      iterations: Math.min(
        iterations,
        maxIterations,
      ),
      finalMaxDelta: Number(
        finalMaxDelta.toFixed(6),
      ),
      sourceElevationMin,
      sourceElevationMax,
      localHeightMin: Number(
        (
          solvedMin -
          verticalDatumAbsolute
        ).toFixed(3),
      ),
      localHeightMax: Number(
        (
          solvedMax -
          verticalDatumAbsolute
        ).toFixed(3),
      ),
    },
  };
}
