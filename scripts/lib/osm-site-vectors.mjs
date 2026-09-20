function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeFeatureName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function samePoint(a, b, tolerance = 0.001) {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance
  );
}

function sanitizePoints(points) {
  const clean = [];

  for (const point of points ?? []) {
    if (
      !Array.isArray(point) ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    ) {
      continue;
    }

    const value = [Number(point[0]), Number(point[1])];
    const previous = clean.at(-1);
    if (!previous || !samePoint(previous, value)) {
      clean.push(value);
    }
  }

  if (
    clean.length >= 2 &&
    samePoint(clean[0], clean.at(-1))
  ) {
    clean.pop();
  }

  return clean;
}

export function parseOsmMeasurement(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }

  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);

  if (!normalized) return null;

  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function clipSegmentToBounds(a, b, bounds) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;

  const tests = [
    [-dx, a[0] - bounds.minX],
    [dx, bounds.maxX - a[0]],
    [-dz, a[1] - bounds.minZ],
    [dz, bounds.maxZ - a[1]],
  ];

  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }

    const r = q / p;

    if (p < 0) {
      if (r > t1) return null;
      t0 = Math.max(t0, r);
    } else {
      if (r < t0) return null;
      t1 = Math.min(t1, r);
    }
  }

  return [
    [a[0] + dx * t0, a[1] + dz * t0],
    [a[0] + dx * t1, a[1] + dz * t1],
  ];
}

export function clipPolylineToBounds(points, bounds) {
  const clean = sanitizePoints(points);
  const segments = [];
  let current = [];

  for (let index = 0; index < clean.length - 1; index++) {
    const a = clean[index];
    const b = clean[index + 1];
    const clipped = clipSegmentToBounds(a, b, bounds);

    if (!clipped) {
      if (current.length >= 2) segments.push(current);
      current = [];
      continue;
    }

    const [start, end] = clipped;

    if (current.length === 0) {
      current = [start, end];
      continue;
    }

    const last = current.at(-1);
    if (last && samePoint(last, start)) {
      if (!samePoint(last, end)) current.push(end);
    } else {
      if (current.length >= 2) segments.push(current);
      current = [start, end];
    }
  }

  if (current.length >= 2) segments.push(current);
  return segments;
}

function clipPolygonEdge(points, inside, intersect) {
  if (points.length === 0) return [];

  const output = [];
  let previous = points.at(-1);
  let previousInside = inside(previous);

  for (const current of points) {
    const currentInside = inside(current);

    if (currentInside) {
      if (!previousInside) {
        output.push(intersect(previous, current));
      }
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }

    previous = current;
    previousInside = currentInside;
  }

  return output;
}

export function clipPolygonToBounds(points, bounds) {
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
        a[1] + (b[1] - a[1]) * clamp(t, 0, 1),
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
        a[1] + (b[1] - a[1]) * clamp(t, 0, 1),
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
        a[0] + (b[0] - a[0]) * clamp(t, 0, 1),
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
        a[0] + (b[0] - a[0]) * clamp(t, 0, 1),
        bounds.maxZ,
      ];
    },
  );

  return sanitizePoints(polygon);
}

function roadWidth(tags, config) {
  const explicit = parseOsmMeasurement(tags.width);
  if (explicit) {
    return {
      width: explicit,
      estimated: false,
      source: "OSM width tag",
    };
  }

  const fallback =
    config.roadWidths?.[tags.highway] ??
    config.defaultRoadWidth;

  return {
    width: Number(fallback),
    estimated: true,
    source: `deterministic width for highway=${tags.highway ?? "unknown"}`,
  };
}

function buildingHeight(tags, config) {
  const explicit = parseOsmMeasurement(tags.height);
  if (explicit) {
    return {
      height: explicit,
      estimated: false,
      source: "OSM height tag",
    };
  }

  const levels = parseOsmMeasurement(tags["building:levels"]);
  if (levels) {
    return {
      height: Number(
        (levels * config.buildingLevelHeight).toFixed(2),
      ),
      estimated: true,
      source: `OSM building:levels × ${config.buildingLevelHeight} m`,
    };
  }

  return {
    height: null,
    estimated: true,
    source: "height unavailable",
  };
}

function isSquare(tags) {
  return (
    tags.place === "square" ||
    tags.leisure === "square" ||
    tags.leisure === "park" ||
    (tags.highway === "pedestrian" && tags.area === "yes")
  );
}

export function deriveOsmSiteVectors({
  features,
  bounds,
  config,
  source = "OpenStreetMap normalized site layer",
  crs = "EPSG:32724",
  units = "meters",
  coverage = "partial",
  criticalRoadNames = [],
}) {
  const roads = [];
  const spaces = [];
  const buildingFootprints = [];

  for (const feature of features ?? []) {
    const tags = feature.tags ?? {};
    const points = feature.points ?? [];

    if (
      feature.geometryType === "polyline" &&
      tags.highway &&
      points.length >= 2
    ) {
      const width = roadWidth(tags, config);
      const clippedParts = clipPolylineToBounds(
        points,
        bounds,
      );

      clippedParts.forEach((part, index) => {
        roads.push({
          id:
            clippedParts.length > 1
              ? `${feature.id}-part-${index + 1}`
              : feature.id,
          name:
            tags.name ??
            `Via OSM ${feature.osmType}/${feature.osmId}`,
          type: `osm-${tags.highway}`,
          width: width.width,
          widthSource: width.source,
          source: `OpenStreetMap ${feature.id}`,
          estimated: width.estimated,
          points: part,
          elevationMode: "terrain",
          osmId: feature.osmId,
          osmType: feature.osmType,
          tags,
        });
      });
    }

    if (
      feature.geometryType === "polygon" &&
      isSquare(tags) &&
      points.length >= 3
    ) {
      const polygon = clipPolygonToBounds(
        points,
        bounds,
      );

      if (polygon.length >= 3) {
        spaces.push({
          id: feature.id,
          name:
            tags.name ??
            `Espaço OSM ${feature.osmType}/${feature.osmId}`,
          type:
            tags.leisure === "park"
              ? "osm-park"
              : tags.place === "square" ||
                  tags.leisure === "square"
                ? "osm-square"
                : "osm-pedestrian-area",
          width: 0,
          source: `OpenStreetMap ${feature.id}`,
          estimated: false,
          points: polygon,
          elevationMode: "terrain",
          osmId: feature.osmId,
          osmType: feature.osmType,
          tags,
        });
      }
    }

    if (
      feature.geometryType === "polygon" &&
      tags.building &&
      points.length >= 3
    ) {
      const footprint = clipPolygonToBounds(
        points,
        bounds,
      );

      if (footprint.length >= 3) {
        const height = buildingHeight(tags, config);
        buildingFootprints.push({
          id: feature.id,
          name:
            tags.name ??
            `Edifício OSM ${feature.osmType}/${feature.osmId}`,
          buildingType: tags.building,
          footprint,
          source: `OpenStreetMap ${feature.id}`,
          osmId: feature.osmId,
          osmType: feature.osmType,
          tags,
          height: height.height,
          heightEstimated: height.estimated,
          heightSource: height.source,
        });
      }
    }
  }

  roads.sort((a, b) => a.id.localeCompare(b.id));
  spaces.sort((a, b) => a.id.localeCompare(b.id));
  buildingFootprints.sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const featureCount =
    roads.length +
    spaces.length +
    buildingFootprints.length;
  const runtimeReady =
    roads.length > 0 && spaces.length > 0;
  const roadNames = new Set(
    roads.map((road) =>
      normalizeFeatureName(road.name),
    ),
  );
  const missingCriticalRoads =
    criticalRoadNames.filter(
      (name) =>
        !roadNames.has(
          normalizeFeatureName(name),
        ),
    );
  const criticalRoadCoverage = {
    found:
      criticalRoadNames.length -
      missingCriticalRoads.length,
    total: criticalRoadNames.length,
    missing: missingCriticalRoads,
    complete:
      missingCriticalRoads.length === 0,
  };

  return {
    schemaVersion: 1,
    available: runtimeReady,
    generatedAt: new Date().toISOString(),
    source,
    crs,
    units,
    bounds,
    metadata: {
      featureCount,
      runtimeReady,
      coverage,
      criticalRoadCoverage,
      roadCount: roads.length,
      spaceCount: spaces.length,
      buildingFootprintCount:
        buildingFootprints.length,
    },
    roads,
    spaces,
    buildingFootprints,
  };
}
