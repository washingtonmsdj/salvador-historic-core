import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const data = JSON.parse(
  await readFile(resolve(process.cwd(), "src/data/site-data.json"), "utf8"),
);

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

if (!layout?.elevatorExclusion?.polygon?.length) {
  fail("layoutConstraints.elevatorExclusion polygon is required");
} else {
  const exclusion = layout.elevatorExclusion;

  for (const road of data.roads ?? []) {
    for (let index = 0; index < road.points.length - 1; index++) {
      const start = road.points[index];
      const end = road.points[index + 1];
      if (!start || !end) continue;

      const distance = segmentToPolygonDistance(
        start,
        end,
        exclusion.polygon,
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

  if (angleDelta(thome.rotation[1], equivalentRotation) > 0.03) {
    fail("Palácio Thomé de Souza is not parallel to verified plaza frontage");
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
