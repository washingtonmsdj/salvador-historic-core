import manifestData from "../../geospatial/manifest.json";
import {
  deriveContourHeightfield,
  type ContourLine,
  type DerivedContourTerrain,
} from "./contour-heightfield";
import type { Point2 } from "./types";

interface ProjectedOrigin {
  easting: number;
  northing: number;
}

interface LocalBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface ArcGisAttributes {
  OBJECTID?: number;
  ELEVATION?: number;
}

interface ArcGisGeometry {
  paths?: number[][][];
}

interface ArcGisFeature {
  attributes?: ArcGisAttributes;
  geometry?: ArcGisGeometry;
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
  error?: {
    code?: number;
    message?: string;
  };
}

interface LiveTerrainPreviewConfig {
  gridSpacing: number;
  contourSampleSpacing: number;
  maxIterations: number;
  tolerance: number;
  cacheTtlMinutes: number;
  verticalDatum: string;
}

interface ConderSourceConfig {
  service: string;
  elevationField: string;
}

export interface LiveConderTerrain {
  source:
    | "conder-server"
    | "conder-live"
    | "session-cache";
  endpoint: string;
  terrain: DerivedContourTerrain;
  contourCount: number;
}

const previewConfig =
  manifestData.liveTerrainPreview as
    LiveTerrainPreviewConfig;
const conderConfig =
  manifestData.sources.conderContours as
    ConderSourceConfig;

function samePoint(
  a: Point2,
  b: Point2,
  tolerance = 0.001,
) {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance
  );
}

function clipSegment(
  a: Point2,
  b: Point2,
  bounds: LocalBounds,
): [Point2, Point2] | null {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;

  const tests = [
    [-dx, a[0] - bounds.minX],
    [dx, bounds.maxX - a[0]],
    [-dz, a[1] - bounds.minZ],
    [dz, bounds.maxZ - a[1]],
  ] as const;

  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }

    const ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return null;
      t0 = Math.max(t0, ratio);
    } else {
      if (ratio < t0) return null;
      t1 = Math.min(t1, ratio);
    }
  }

  return [
    [a[0] + dx * t0, a[1] + dz * t0],
    [a[0] + dx * t1, a[1] + dz * t1],
  ];
}

function clipPolyline(
  points: Point2[],
  bounds: LocalBounds,
) {
  const parts: Point2[][] = [];
  let current: Point2[] = [];

  for (
    let index = 0;
    index < points.length - 1;
    index++
  ) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) continue;

    const clipped = clipSegment(
      a,
      b,
      bounds,
    );

    if (!clipped) {
      if (current.length >= 2) {
        parts.push(current);
      }
      current = [];
      continue;
    }

    const [start, end] = clipped;
    const previous = current.at(-1);

    if (!previous) {
      current = [start, end];
    } else if (
      samePoint(previous, start)
    ) {
      if (!samePoint(previous, end)) {
        current.push(end);
      }
    } else {
      if (current.length >= 2) {
        parts.push(current);
      }
      current = [start, end];
    }
  }

  if (current.length >= 2) {
    parts.push(current);
  }

  return parts;
}

function queryUrl(
  origin: ProjectedOrigin,
  bounds: LocalBounds,
) {
  const projectedBounds = [
    origin.easting + bounds.minX,
    origin.northing + bounds.minZ,
    origin.easting + bounds.maxX,
    origin.northing + bounds.maxZ,
  ].join(",");

  const params = new URLSearchParams({
    where: "1=1",
    geometry: projectedBounds,
    geometryType:
      "esriGeometryEnvelope",
    inSR: "32724",
    spatialRel:
      "esriSpatialRelIntersects",
    outFields:
      "OBJECTID,ELEVATION",
    returnGeometry: "true",
    returnZ: "false",
    outSR: "32724",
    geometryPrecision: "3",
    f: "json",
  });

  return `${conderConfig.service}/query?${params.toString()}`;
}

function cacheKey(
  origin: ProjectedOrigin,
  bounds: LocalBounds,
) {
  return [
    "salvador-conder-live-v1",
    origin.easting.toFixed(2),
    origin.northing.toFixed(2),
    bounds.minX,
    bounds.maxX,
    bounds.minZ,
    bounds.maxZ,
    previewConfig.gridSpacing,
  ].join(":");
}

function readCache(
  origin: ProjectedOrigin,
  bounds: LocalBounds,
): LiveConderTerrain | null {
  try {
    const key = cacheKey(
      origin,
      bounds,
    );
    const raw =
      sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt: number;
      result: LiveConderTerrain;
    };
    const ttl =
      previewConfig.cacheTtlMinutes *
      60 *
      1000;

    if (
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt > ttl
    ) {
      sessionStorage.removeItem(key);
      return null;
    }

    return {
      ...parsed.result,
      source: "session-cache",
    };
  } catch {
    return null;
  }
}

function writeCache(
  origin: ProjectedOrigin,
  bounds: LocalBounds,
  result: LiveConderTerrain,
) {
  try {
    sessionStorage.setItem(
      cacheKey(origin, bounds),
      JSON.stringify({
        savedAt: Date.now(),
        result,
      }),
    );
  } catch {
    // Session cache is optional.
  }
}

function normalizeContours(
  payload: ArcGisResponse,
  origin: ProjectedOrigin,
  bounds: LocalBounds,
) {
  const contours: ContourLine[] = [];

  for (const feature of
    payload.features ?? []) {
    const elevation =
      feature.attributes?.ELEVATION;
    const objectId =
      feature.attributes?.OBJECTID;

    if (
      typeof elevation !== "number" ||
      !Number.isFinite(elevation)
    ) {
      continue;
    }

    for (const [
      pathIndex,
      path,
    ] of (
      feature.geometry?.paths ?? []
    ).entries()) {
      const local: Point2[] = [];

      for (const point of path) {
        const easting = point[0];
        const northing = point[1];

        if (
          typeof easting !== "number" ||
          typeof northing !== "number"
        ) {
          continue;
        }

        local.push([
          easting - origin.easting,
          northing - origin.northing,
        ]);
      }

      for (const [
        partIndex,
        part,
      ] of clipPolyline(
        local,
        bounds,
      ).entries()) {
        contours.push({
          id:
            `conder-live-${objectId ?? "unknown"}-${pathIndex}-${partIndex}`,
          elevation,
          points: part,
        });
      }
    }
  }

  return contours;
}

async function fetchConder(
  endpoint: string,
) {
  const controller =
    new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    15_000,
  );

  try {
    const response = await fetch(
      endpoint,
      {
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`,
      );
    }

    const payload =
      (await response.json()) as
        ArcGisResponse;

    if (payload.error) {
      throw new Error(
        `ArcGIS ${payload.error.code ?? "error"}: ${payload.error.message ?? "unknown error"}`,
      );
    }

    if (
      payload.exceededTransferLimit
    ) {
      throw new Error(
        "CONDER query exceeded transfer limit; refusing partial terrain.",
      );
    }

    if (
      !Array.isArray(payload.features)
    ) {
      throw new Error(
        "CONDER response has no features array.",
      );
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadLiveConderTerrain({
  origin,
  bounds,
}: {
  origin: ProjectedOrigin;
  bounds: LocalBounds;
}) {
  const cached = readCache(
    origin,
    bounds,
  );
  if (cached) {
    return cached;
  }

  const directEndpoint = queryUrl(
    origin,
    bounds,
  );
  const serverEndpoint =
    "/api/geospatial/conder";
  let endpoint = serverEndpoint;
  let source: LiveConderTerrain["source"] =
    "conder-server";
  let payload: ArcGisResponse;

  try {
    payload =
      await fetchConder(serverEndpoint);
  } catch (serverError) {
    endpoint = directEndpoint;
    source = "conder-live";

    try {
      payload =
        await fetchConder(directEndpoint);
    } catch (directError) {
      const serverMessage =
        serverError instanceof Error
          ? serverError.message
          : String(serverError);
      const directMessage =
        directError instanceof Error
          ? directError.message
          : String(directError);
      throw new Error(
        `CONDER unavailable. App server: ${serverMessage} | Direct: ${directMessage}`,
      );
    }
  }

  const contours = normalizeContours(
    payload,
    origin,
    bounds,
  );

  if (contours.length < 2) {
    throw new Error(
      `CONDER returned only ${contours.length} usable contour paths.`,
    );
  }

  const terrain =
    deriveContourHeightfield({
      contours,
      bounds,
      config: {
        method:
          "contour-constrained-harmonic-grid-live-preview",
        gridSpacing:
          previewConfig.gridSpacing,
        contourSampleSpacing:
          previewConfig.contourSampleSpacing,
        maxIterations:
          previewConfig.maxIterations,
        tolerance:
          previewConfig.tolerance,
        verticalDatum:
          previewConfig.verticalDatum,
      },
      source:
        "CONDER REL_Curva_Nivel_L live session preview",
    });

  const result: LiveConderTerrain = {
    source,
    endpoint,
    terrain,
    contourCount: contours.length,
  };

  writeCache(
    origin,
    bounds,
    result,
  );
  return result;
}
