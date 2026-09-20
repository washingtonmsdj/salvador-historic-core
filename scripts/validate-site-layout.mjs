import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const data = JSON.parse(
  await readFile(resolve(process.cwd(), "src/data/site-data.json"), "utf8"),
);
const derivedVectors = JSON.parse(
  await readFile(
    resolve(
      process.cwd(),
      "geospatial/derived/site-vectors.json",
    ),
    "utf8",
  ),
);
const derivedFootprints =
  Array.isArray(
    derivedVectors.buildingFootprints,
  )
    ? derivedVectors.buildingFootprints
    : [];
const derivedFootprintsByOsmId =
  new Map(
    derivedFootprints.map(
      (item) => [
        item.osmId,
        item.footprint,
      ],
    ),
  );

function resolveOsmFootprint(item) {
  if (
    Array.isArray(item?.footprint) &&
    item.footprint.length >= 3
  ) {
    return item.footprint;
  }

  if (
    Number.isInteger(
      item?.footprintOsmId,
    )
  ) {
    return (
      derivedFootprintsByOsmId.get(
        item.footprintOsmId,
      ) ?? null
    );
  }

  return null;
}

function resolveConstraintPolygon(item) {
  if (
    Array.isArray(item?.polygon) &&
    item.polygon.length >= 3
  ) {
    return item.polygon;
  }

  if (
    Number.isInteger(
      item?.footprintOsmId,
    )
  ) {
    return (
      derivedFootprintsByOsmId.get(
        item.footprintOsmId,
      ) ?? null
    );
  }

  return null;
}

const errors = [];
const layout = data.layoutConstraints;
const plaza = data.spaces.find((item) => item.id === "praca-tome-souza");

function fail(message) {
  errors.push(message);
}

function pointInPolygon([x, z], polygon) {
  let inside = false;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) continue;

    const [xi, zi] = currentPoint;
    const [xj, zj] = previousPoint;
    const intersects =
      zi > z !== zj > z &&
      x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointToSegmentDistance(point, start, end) {
  const [px, pz] = point;
  const [ax, az] = start;
  const [bx, bz] = end;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;

  if (lengthSquared <= 1e-9) return Math.hypot(px - ax, pz - az);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((px - ax) * dx + (pz - az) * dz) / lengthSquared,
    ),
  );
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function segmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) =>
    (q[0] - p[0]) * (r[1] - p[1]) -
    (q[1] - p[1]) * (r[0] - p[0]);

  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  return abC * abD <= 0 && cdA * cdB <= 0;
}

function segmentToPolygonDistance(start, end, polygon) {
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (!a || !b) continue;

    if (segmentsIntersect(start, end, a, b)) return 0;

    minimum = Math.min(
      minimum,
      pointToSegmentDistance(start, a, b),
      pointToSegmentDistance(end, a, b),
      pointToSegmentDistance(a, start, end),
      pointToSegmentDistance(b, start, end),
    );
  }

  return minimum;
}

function distanceToInfiniteAxis(point, a, b) {
  const [px, pz] = point;
  const [ax, az] = a;
  const [bx, bz] = b;
  const dx = bx - ax;
  const dz = bz - az;
  return (
    Math.abs(dx * (az - pz) - (ax - px) * dz) /
    Math.max(1e-9, Math.hypot(dx, dz))
  );
}

function angleDelta(a, b) {
  const period = Math.PI;
  const raw = Math.abs(a - b) % period;
  return Math.min(raw, period - raw);
}

const elevatorExclusion =
  layout?.elevatorExclusion;
const elevatorExclusionPolygon =
  resolveConstraintPolygon(
    elevatorExclusion,
  );

if (!elevatorExclusionPolygon) {
  fail(
    "layoutConstraints.elevatorExclusion must resolve a canonical footprint",
  );
} else {
  const exclusion = elevatorExclusion;

  for (const road of data.roads ?? []) {
    for (let index = 0; index < road.points.length - 1; index++) {
      const start = road.points[index];
      const end = road.points[index + 1];
      if (!start || !end) continue;

      const distance = segmentToPolygonDistance(
        start,
        end,
        elevatorExclusionPolygon,
      );

      if (distance < exclusion.minimumRoadClearance) {
        fail(
          `${road.id} violates Elevador road clearance: ${distance.toFixed(2)} m`,
        );
      }
    }
  }
}

if (!plaza?.points?.length) {
  fail("verified Praça Tomé de Souza polygon is required");
} else {
  for (const building of data.buildings ?? []) {
    if (pointInPolygon([building.position[0], building.position[2]], plaza.points)) {
      fail(`${building.id} center lies inside Praça Tomé de Souza`);
    }
  }
}

const ruaAxis = layout?.ruaChileAxis;
if (!ruaAxis?.points || ruaAxis.points.length < 2) {
  fail("layoutConstraints.ruaChileAxis is required");
} else {
  const [axisStart, axisEnd] = ruaAxis.points;

  for (const building of data.buildings.filter(
    (item) => item.type === "rua-chile",
  )) {
    const center = [building.position[0], building.position[2]];
    const distance = distanceToInfiniteAxis(center, axisStart, axisEnd);

    if (distance > 1.25) {
      fail(
        `${building.id} is ${distance.toFixed(2)} m away from Rua Chile axis`,
      );
    }

    if (angleDelta(building.rotation[1], ruaAxis.rotationY) > 0.02) {
      fail(`${building.id} rotation is not aligned to Rua Chile axis`);
    }
  }
}

const marketClearance = layout?.lowerRoadMarketClearance;
if (marketClearance) {
  const road = data.roads.find((item) => item.id === marketClearance.roadId);
  const building = data.buildings.find(
    (item) => item.id === marketClearance.buildingId,
  );

  if (!road) {
    fail(`Missing constrained road ${marketClearance.roadId}`);
  } else {
    const buildingFootprint =
      resolveOsmFootprint(
        building,
      );

    if (!buildingFootprint) {
      fail(
        `Missing verified footprint for ${marketClearance.buildingId}`,
      );
      continue;
    }

    for (let index = 0; index < road.points.length - 1; index++) {
      const start = road.points[index];
      const end = road.points[index + 1];
      if (!start || !end) continue;

      const distance = segmentToPolygonDistance(
        start,
        end,
        buildingFootprint,
      );

      if (distance < marketClearance.minimumCenterlineClearance) {
        fail(
          `${road.id} is only ${distance.toFixed(2)} m from ${building.id}`,
        );
      }
    }
  }
}

const lowerTower = data.elevator.find(
  (item) => item.id === "lacerda-lower-tower",
);
const elevatorCutout = data.terrain.cutouts?.find(
  (item) => item.id === "elevador-lacerda-footprint-clearance",
);
const lowerTowerFootprint =
  resolveOsmFootprint(
    lowerTower,
  );

if (!lowerTowerFootprint || !elevatorCutout?.polygon?.length) {
  fail(
    "Elevador canonical footprint and procedural fallback cutout are required",
  );
} else if (
  elevatorCutout.fallbackSnapshotOfOsmId !==
    lowerTower?.footprintOsmId ||
  JSON.stringify(
    lowerTowerFootprint,
  ) !==
    JSON.stringify(
      elevatorCutout.polygon,
    )
) {
  fail(
    "Elevador procedural cutout snapshot must match its canonical OSM footprint",
  );
} else {
  const terrainSampleSpacing =
    data.terrain.tileSize / data.terrain.subdivisionsPerTile;

  if (elevatorCutout.clearance < terrainSampleSpacing) {
    fail(
      [
        "Elevador terrain clearance must cover at least one sample cell",
        `(${terrainSampleSpacing.toFixed(2)} m)`,
      ].join(" "),
    );
  }

  if (elevatorCutout.elevation >= data.levels.lowerCity.elevation) {
    fail("Elevador terrain cutout must sit below the lower-city datum");
  }
}

function orientedBoxCorners(building) {
  if (building.footprint?.length >= 3) {
    return building.footprint;
  }

  const halfWidth = building.width / 2;
  const halfDepth = building.depth / 2;
  const angle = building.rotation[1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = building.position[0];
  const centerZ = building.position[2];

  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([localX, localZ]) => [
    centerX + localX * cos + localZ * sin,
    centerZ - localX * sin + localZ * cos,
  ]);
}

function polygonSideLength(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

const tptsPlateau = data.terrain.plateaus?.find(
  (item) => item.id === "tpts-upper-slab",
);

if (!tptsPlateau) {
  fail("TPTS terrain plateau is required");
} else if (
  JSON.stringify(tptsPlateau.polygon) !==
  JSON.stringify(layout?.palacioThomeSite?.polygon)
) {
  fail("TPTS terrain plateau must match the IPHAN site envelope");
} else {
  const plazaDatum = plaza?.elevation;
  if (
    Number.isFinite(plazaDatum) &&
    Math.abs(tptsPlateau.elevation - plazaDatum) > 0.05
  ) {
    fail("TPTS terrain plateau must use the same blockout datum as the plaza");
  }

  const sampleSpacing =
    data.terrain.tileSize / data.terrain.subdivisionsPerTile;
  if (tptsPlateau.feather > sampleSpacing + 0.001) {
    fail("TPTS plateau feather must not exceed one terrain sample cell");
  }
}

const thomeSite = layout?.palacioThomeSite;
const thomeBuilding = data.buildings.find(
  (item) => item.id === "palacio-thome-souza",
);

const thomeFootprint =
  resolveOsmFootprint(
    thomeBuilding,
  );

if (!thomeSite?.polygon?.length || !thomeFootprint) {
  fail(
    "Palácio Thomé site and canonical building footprint are required",
  );
} else {
  const site = thomeSite.polygon;
  const palace = thomeFootprint;

  for (const corner of palace) {
    const onBoundary = site.some((start, index) => {
      const end = site[(index + 1) % site.length];
      return end && pointToSegmentDistance(corner, start, end) < 0.03;
    });
    const insideSite = pointInPolygon(corner, site) || onBoundary;

    if (!insideSite) {
      fail("Palácio Thomé footprint extends outside the IPHAN TPTS envelope");
      break;
    }
  }

  const palaceFrontWidth = polygonSideLength(palace[0], palace[1]);
  const palaceDepth = polygonSideLength(palace[1], palace[2]);
  const siteFrontWidth = polygonSideLength(site[0], site[1]);
  const siteDepth = polygonSideLength(site[1], site[2]);

  const palaceShortSide =
    Math.min(
      palaceFrontWidth,
      palaceDepth,
    );
  const palaceLongSide =
    Math.max(
      palaceFrontWidth,
      palaceDepth,
    );

  if (
    palaceShortSide < 14 ||
    palaceShortSide > 18
  ) {
    fail(
      `Palácio Thomé short side is ${palaceShortSide.toFixed(2)} m; expected correlation with the documented ~${thomeSite.palaceStripWidth} m strip`,
    );
  }

  if (
    palaceLongSide < 40 ||
    palaceLongSide >
      thomeSite.depth + 0.15
  ) {
    fail(
      `Palácio Thomé long side is ${palaceLongSide.toFixed(2)} m; expected to remain inside the documented ~${thomeSite.depth} m longitudinal envelope`,
    );
  }

  if (Math.abs(siteFrontWidth - thomeSite.width) > 0.15) {
    fail(
      `TPTS width is ${siteFrontWidth.toFixed(2)} m; expected ~${thomeSite.width} m`,
    );
  }

  if (Math.abs(siteDepth - thomeSite.depth) > 0.15) {
    fail(
      `TPTS depth is ${siteDepth.toFixed(2)} m; expected ~${thomeSite.depth} m`,
    );
  }
}

const frontage = layout?.plazaNortheastFrontage?.edge;
const thome = data.buildings.find(
  (item) => item.id === "palacio-thome-souza",
);
if (frontage?.length === 2 && thome) {
  const [a, b] = frontage;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const expectedRotation = Math.atan2(-dz, dx);
  const equivalentRotation =
    expectedRotation < -Math.PI / 2
      ? expectedRotation + Math.PI
      : expectedRotation;

  if (!thome.footprint && angleDelta(thome.rotation[1], equivalentRotation) > 0.03) {
    fail("Palácio Thomé de Souza is not parallel to verified plaza frontage");
  }

  for (const corner of orientedBoxCorners(thome)) {
    const onPlazaBoundary = plaza.points.some((start, index) => {
      const end = plaza.points[(index + 1) % plaza.points.length];
      return end && pointToSegmentDistance(corner, start, end) < 0.03;
    });

    if (pointInPolygon(corner, plaza.points) && !onPlazaBoundary) {
      fail("Palácio Thomé de Souza blockout intrudes into Praça Tomé de Souza");
      break;
    }
  }
}

if (errors.length > 0) {
  console.error("Site layout validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    "Site layout valid: Elevador clearance, plaza frontage and Rua Chile alignment preserved.",
  );
}
