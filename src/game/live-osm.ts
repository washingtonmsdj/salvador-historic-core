import manifestData from "../../geospatial/manifest.json";
import { geographicToLocalMeters } from "./geo";
import type {
  DerivedBuildingFootprint,
  LinearFeature,
  Point2,
} from "./types";

interface GeographicBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface ProjectedOrigin {
  easting: number;
  northing: number;
}

interface OverpassGeometryPoint {
  lat?: number;
  lon?: number;
}

interface OverpassElement {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeometryPoint[];
}

interface OverpassPayload {
  elements?: OverpassElement[];
}

interface VectorDerivationConfig {
  defaultRoadWidth: number;
  roadWidths: Record<string, number>;
  buildingLevelHeight: number;
}

export interface LiveOsmVectors {
  source:
    | "overpass-live"
    | "osm-api-live"
    | "session-cache";
  endpoint: string;
  generatedAt: string;
  roads: LinearFeature[];
  spaces: LinearFeature[];
  buildingFootprints: DerivedBuildingFootprint[];
}

const vectorConfig =
  manifestData.vectorDerivation as VectorDerivationConfig;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OSM_API_ENDPOINT =
  "https://api.openstreetmap.org/api/0.6/map";

const CACHE_TTL_MS = 15 * 60 * 1000;

function samePoint(
  a: Point2,
  b: Point2,
  tolerance = 0.05,
) {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance
  );
}

function sanitizePoints(points: Point2[]) {
  const clean: Point2[] = [];

  for (const point of points) {
    if (
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    ) {
      continue;
    }

    const previous = clean.at(-1);
    if (!previous || !samePoint(previous, point)) {
      clean.push(point);
    }
  }

  if (
    clean.length >= 2 &&
    clean[0] &&
    clean.at(-1) &&
    samePoint(clean[0], clean.at(-1)!)
  ) {
    clean.pop();
  }

  return clean;
}

function parseMeasurement(value?: string) {
  if (!value) return null;

  const match = value
    .trim()
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function roadWidth(tags: Record<string, string>) {
  const explicit = parseMeasurement(tags["width"]);
  if (explicit) {
    return {
      width: explicit,
      estimated: false,
      source: "OSM width tag",
    };
  }

  const width =
    vectorConfig.roadWidths[tags["highway"] ?? ""] ??
    vectorConfig.defaultRoadWidth;

  return {
    width,
    estimated: true,
    source:
      `deterministic width for highway=${tags["highway"] ?? "unknown"}`,
  };
}

function buildingHeight(
  tags: Record<string, string>,
) {
  const explicit = parseMeasurement(tags["height"]);
  if (explicit) {
    return {
      height: explicit,
      estimated: false,
      source: "OSM height tag",
    };
  }

  const levels = parseMeasurement(
    tags["building:levels"],
  );
  if (levels) {
    return {
      height: Number(
        (
          levels *
          vectorConfig.buildingLevelHeight
        ).toFixed(2),
      ),
      estimated: true,
      source:
        `OSM building:levels × ${vectorConfig.buildingLevelHeight} m`,
    };
  }

  return {
    height: null,
    estimated: true,
    source: "height unavailable",
  };
}

function isSpace(tags: Record<string, string>) {
  return (
    tags["place"] === "square" ||
    tags["leisure"] === "square" ||
    tags["leisure"] === "park" ||
    (tags["highway"] === "pedestrian" &&
      tags["area"] === "yes")
  );
}

function isClosedGeometry(
  geometry: OverpassGeometryPoint[] | undefined,
) {
  const first = geometry?.[0];
  const last = geometry?.at(-1);

  if (
    !first ||
    !last ||
    typeof first.lat !== "number" ||
    typeof first.lon !== "number" ||
    typeof last.lat !== "number" ||
    typeof last.lon !== "number"
  ) {
    return false;
  }

  return (
    Math.abs(first.lat - last.lat) < 1e-8 &&
    Math.abs(first.lon - last.lon) < 1e-8
  );
}

function geometryToLocal(
  geometry: OverpassGeometryPoint[] | undefined,
  origin: ProjectedOrigin,
) {
  const points: Point2[] = [];

  for (const point of geometry ?? []) {
    if (
      typeof point.lat !== "number" ||
      typeof point.lon !== "number"
    ) {
      continue;
    }

    points.push(
      geographicToLocalMeters(
        point.lat,
        point.lon,
        origin.easting,
        origin.northing,
      ),
    );
  }

  return sanitizePoints(points);
}

function insideBounds(
  point: Point2,
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  },
) {
  return (
    point[0] >= bounds.minX &&
    point[0] <= bounds.maxX &&
    point[1] >= bounds.minZ &&
    point[1] <= bounds.maxZ
  );
}

function clipSegment(
  a: Point2,
  b: Point2,
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  },
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
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  },
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

    const clipped = clipSegment(a, b, bounds);
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
    } else if (samePoint(previous, start)) {
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

function clipPolygonEdge(
  points: Point2[],
  inside: (point: Point2) => boolean,
  intersect: (
    a: Point2,
    b: Point2,
  ) => Point2,
) {
  if (points.length === 0) return [];

  const output: Point2[] = [];
  let previous = points.at(-1);
  if (!previous) return output;
  let previousInside = inside(previous);

  for (const current of points) {
    const currentInside = inside(current);

    if (currentInside) {
      if (!previousInside) {
        output.push(
          intersect(previous, current),
        );
      }
      output.push(current);
    } else if (previousInside) {
      output.push(
        intersect(previous, current),
      );
    }

    previous = current;
    previousInside = currentInside;
  }

  return output;
}

function clipPolygon(
  points: Point2[],
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  },
) {
  let polygon = sanitizePoints(points);
  if (polygon.length < 3) return [];

  polygon = clipPolygonEdge(
    polygon,
    ([x]) => x >= bounds.minX,
    (a, b) => {
      const t =
        (bounds.minX - a[0]) /
        (b[0] - a[0] || Number.EPSILON);
      return [
        bounds.minX,
        a[1] + (b[1] - a[1]) * t,
      ];
    },
  );

  polygon = clipPolygonEdge(
    polygon,
    ([x]) => x <= bounds.maxX,
    (a, b) => {
      const t =
        (bounds.maxX - a[0]) /
        (b[0] - a[0] || Number.EPSILON);
      return [
        bounds.maxX,
        a[1] + (b[1] - a[1]) * t,
      ];
    },
  );

  polygon = clipPolygonEdge(
    polygon,
    ([, z]) => z >= bounds.minZ,
    (a, b) => {
      const t =
        (bounds.minZ - a[1]) /
        (b[1] - a[1] || Number.EPSILON);
      return [
        a[0] + (b[0] - a[0]) * t,
        bounds.minZ,
      ];
    },
  );

  polygon = clipPolygonEdge(
    polygon,
    ([, z]) => z <= bounds.maxZ,
    (a, b) => {
      const t =
        (bounds.maxZ - a[1]) /
        (b[1] - a[1] || Number.EPSILON);
      return [
        a[0] + (b[0] - a[0]) * t,
        bounds.maxZ,
      ];
    },
  );

  return sanitizePoints(polygon);
}

function queryFor(bounds: GeographicBounds) {
  const bbox = [
    bounds.south,
    bounds.west,
    bounds.north,
    bounds.east,
  ]
    .map((value) => value.toFixed(7))
    .join(",");

  return `
[out:json][timeout:25];
(
  way["highway"](${bbox});
  way["building"](${bbox});
  way["place"="square"](${bbox});
  way["leisure"="square"](${bbox});
  way["leisure"="park"](${bbox});
  way["highway"="pedestrian"]["area"="yes"](${bbox});
);
out body geom;
`.trim();
}

function cacheKey(bounds: GeographicBounds) {
  return [
    "salvador-osm-live-v1",
    bounds.south.toFixed(6),
    bounds.west.toFixed(6),
    bounds.north.toFixed(6),
    bounds.east.toFixed(6),
  ].join(":");
}

function readCache(
  bounds: GeographicBounds,
): LiveOsmVectors | null {
  try {
    const raw = sessionStorage.getItem(
      cacheKey(bounds),
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      savedAt: number;
      result: LiveOsmVectors;
    };

    if (
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt >
        CACHE_TTL_MS
    ) {
      sessionStorage.removeItem(
        cacheKey(bounds),
      );
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
  bounds: GeographicBounds,
  result: LiveOsmVectors,
) {
  try {
    sessionStorage.setItem(
      cacheKey(bounds),
      JSON.stringify({
        savedAt: Date.now(),
        result,
      }),
    );
  } catch {
    // Cache failure must never block the scene.
  }
}

function osmApiUrl(
  bounds: GeographicBounds,
) {
  const params = new URLSearchParams({
    bbox: [
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ]
      .map((value) => value.toFixed(7))
      .join(","),
  });

  return `${OSM_API_ENDPOINT}?${params.toString()}`;
}

function parseOsmApiXml(
  xml: string,
): OverpassPayload {
  const document = new DOMParser().parseFromString(
    xml,
    "application/xml",
  );

  const parserError =
    document.querySelector("parsererror");
  if (parserError) {
    throw new Error(
      "OSM API returned invalid XML.",
    );
  }

  const nodes = new Map<
    string,
    OverpassGeometryPoint
  >();

  for (const node of Array.from(
    document.querySelectorAll("node"),
  )) {
    const id = node.getAttribute("id");
    const latitude = Number(
      node.getAttribute("lat"),
    );
    const longitude = Number(
      node.getAttribute("lon"),
    );

    if (
      !id ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    nodes.set(id, {
      lat: latitude,
      lon: longitude,
    });
  }

  const elements: OverpassElement[] = [];

  for (const way of Array.from(
    document.querySelectorAll("way"),
  )) {
    const id = Number(
      way.getAttribute("id"),
    );
    if (!Number.isFinite(id)) {
      continue;
    }

    const tags: Record<string, string> = {};
    for (const tag of Array.from(
      way.querySelectorAll(":scope > tag"),
    )) {
      const key = tag.getAttribute("k");
      const value = tag.getAttribute("v");
      if (key && value !== null) {
        tags[key] = value;
      }
    }

    const geometry = Array.from(
      way.querySelectorAll(":scope > nd"),
    ).flatMap((nodeRef) => {
      const ref = nodeRef.getAttribute("ref");
      const point = ref
        ? nodes.get(ref)
        : undefined;
      return point ? [point] : [];
    });

    elements.push({
      type: "way",
      id,
      tags,
      geometry,
    });
  }

  return { elements };
}

async function fetchOsmApi(
  bounds: GeographicBounds,
) {
  const endpoint = osmApiUrl(bounds);
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    12_000,
  );

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        accept: "application/xml,text/xml",
      },
    });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`,
      );
    }

    const payload = parseOsmApiXml(
      await response.text(),
    );

    if (
      !Array.isArray(payload.elements) ||
      payload.elements.length === 0
    ) {
      throw new Error(
        "OSM API returned no ways.",
      );
    }

    return {
      endpoint,
      payload,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchOverpass(
  endpoint: string,
  query: string,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    12_000,
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type":
          "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`,
      );
    }

    const payload =
      (await response.json()) as OverpassPayload;

    if (!Array.isArray(payload.elements)) {
      throw new Error(
        "Overpass response has no elements array",
      );
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function deriveVectors(
  payload: OverpassPayload,
  endpoint: string,
  sourceKind:
    | "overpass-live"
    | "osm-api-live",
  origin: ProjectedOrigin,
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  },
): LiveOsmVectors {
  const roads: LinearFeature[] = [];
  const spaces: LinearFeature[] = [];
  const buildingFootprints:
    DerivedBuildingFootprint[] = [];

  for (const element of payload.elements ?? []) {
    if (
      element.type !== "way" ||
      typeof element.id !== "number"
    ) {
      continue;
    }

    const tags = element.tags ?? {};
    const closed = isClosedGeometry(
      element.geometry,
    );
    const points = geometryToLocal(
      element.geometry,
      origin,
    );
    if (points.length < 2) continue;

    const osmId = element.id;
    const source =
      sourceKind === "osm-api-live"
        ? `OpenStreetMap API way/${osmId}`
        : `OpenStreetMap Overpass way/${osmId}`;

    if (
      tags["highway"] &&
      tags["area"] !== "yes" &&
      points.length >= 2
    ) {
      const width = roadWidth(tags);
      const firstPoint = points[0];
      const roadPoints =
        closed && firstPoint
          ? [...points, firstPoint]
          : points;
      const parts = clipPolyline(
        roadPoints,
        bounds,
      );

      parts.forEach((part, index) => {
        roads.push({
          id:
            parts.length === 1
              ? `live-way-${osmId}`
              : `live-way-${osmId}-part-${index + 1}`,
          name:
            tags["name"] ??
            `Via OSM ${osmId}`,
          type: `osm-${tags["highway"]}`,
          width: width.width,
          source,
          estimated: width.estimated,
          points: part,
          elevationMode:
            tags["name"] === "Rua Chile"
              ? "upper"
              : "terrain",
        });
      });
    }

    const polygon = clipPolygon(
      points,
      bounds,
    );

    if (
      closed &&
      polygon.length >= 3 &&
      isSpace(tags)
    ) {
      spaces.push({
        id: `live-space-${osmId}`,
        name:
          tags["name"] ??
          `Espaço OSM ${osmId}`,
        type:
          tags["leisure"] === "park"
            ? "osm-park"
            : "osm-space",
        width: 0,
        source,
        estimated: false,
        points: polygon,
        elevationMode:
          tags["name"] === "Praça Tomé de Souza"
            ? "upper"
            : "terrain",
      });
    }

    if (
      closed &&
      polygon.length >= 3 &&
      tags["building"]
    ) {
      const height = buildingHeight(tags);
      buildingFootprints.push({
        id: `live-building-${osmId}`,
        name:
          tags["name"] ??
          `Edifício OSM ${osmId}`,
        buildingType: tags["building"],
        footprint: polygon,
        source,
        osmId,
        osmType: "way",
        tags,
        height: height.height,
        heightEstimated: height.estimated,
        heightSource: height.source,
      });
    }
  }

  roads.sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  spaces.sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  buildingFootprints.sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  return {
    source: sourceKind,
    endpoint,
    generatedAt: new Date().toISOString(),
    roads,
    spaces,
    buildingFootprints,
  };
}

export async function loadLiveOsmVectors({
  geographicBounds,
  localBounds,
  origin,
}: {
  geographicBounds: GeographicBounds;
  localBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  origin: ProjectedOrigin;
}) {
  const cached = readCache(geographicBounds);
  if (cached) return cached;

  const query = queryFor(geographicBounds);
  const errors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const payload = await fetchOverpass(
        endpoint,
        query,
      );
      const result = deriveVectors(
        payload,
        endpoint,
        "overpass-live",
        origin,
        localBounds,
      );

      if (
        result.roads.length === 0 &&
        result.spaces.length === 0 &&
        result.buildingFootprints.length === 0
      ) {
        throw new Error(
          "Overpass returned no usable site features",
        );
      }

      writeCache(geographicBounds, result);
      return result;
    } catch (error) {
      errors.push(
        `${endpoint}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  try {
    const { endpoint, payload } =
      await fetchOsmApi(
        geographicBounds,
      );
    const result = deriveVectors(
      payload,
      endpoint,
      "osm-api-live",
      origin,
      localBounds,
    );

    if (
      result.roads.length === 0 &&
      result.spaces.length === 0 &&
      result.buildingFootprints.length === 0
    ) {
      throw new Error(
        "OSM API returned no usable site features.",
      );
    }

    writeCache(
      geographicBounds,
      result,
    );
    return result;
  } catch (error) {
    errors.push(
      `${OSM_API_ENDPOINT}: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  throw new Error(
    `OSM live unavailable. ${errors.join(" | ")}`,
  );
}
