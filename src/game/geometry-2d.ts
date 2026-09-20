import type { Point2 } from "./types";

const EPSILON = 0.000001;

export function pointInPolygon(
  point: Point2,
  polygon: Point2[],
) {
  let inside = false;
  const [x, z] = point;

  for (
    let index = 0,
      previous =
        polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint =
      polygon[index];
    const previousPoint =
      polygon[previous];
    if (
      !currentPoint ||
      !previousPoint
    ) {
      continue;
    }

    const [xi, zi] =
      currentPoint;
    const [xj, zj] =
      previousPoint;
    const intersects =
      zi > z !== zj > z &&
      x <
        ((xj - xi) *
          (z - zi)) /
          (zj - zi ||
            Number.EPSILON) +
          xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function distanceToSegment(
  point: Point2,
  start: Point2,
  end: Point2,
) {
  const [px, pz] = point;
  const [ax, az] = start;
  const [bx, bz] = end;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared =
    dx * dx + dz * dz;

  if (
    lengthSquared <=
    EPSILON
  ) {
    return Math.hypot(
      px - ax,
      pz - az,
    );
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((px - ax) * dx +
        (pz - az) * dz) /
        lengthSquared,
    ),
  );
  const closestX = ax + dx * t;
  const closestZ = az + dz * t;
  return Math.hypot(
    px - closestX,
    pz - closestZ,
  );
}

export function distanceToPolygon(
  point: Point2,
  polygon: Point2[],
) {
  let distance =
    Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index < polygon.length;
    index++
  ) {
    const start =
      polygon[index];
    const end =
      polygon[
        (index + 1) %
          polygon.length
      ];
    if (!start || !end) {
      continue;
    }

    distance = Math.min(
      distance,
      distanceToSegment(
        point,
        start,
        end,
      ),
    );
  }

  return distance;
}

function orientation(
  a: Point2,
  b: Point2,
  c: Point2,
) {
  return (
    (b[0] - a[0]) *
      (c[1] - a[1]) -
    (b[1] - a[1]) *
      (c[0] - a[0])
  );
}

function pointOnSegment(
  point: Point2,
  start: Point2,
  end: Point2,
) {
  if (
    Math.abs(
      orientation(
        start,
        end,
        point,
      ),
    ) > EPSILON
  ) {
    return false;
  }

  return (
    point[0] >=
      Math.min(
        start[0],
        end[0],
      ) -
        EPSILON &&
    point[0] <=
      Math.max(
        start[0],
        end[0],
      ) +
        EPSILON &&
    point[1] >=
      Math.min(
        start[1],
        end[1],
      ) -
        EPSILON &&
    point[1] <=
      Math.max(
        start[1],
        end[1],
      ) +
        EPSILON
  );
}

function segmentsIntersect(
  a: Point2,
  b: Point2,
  c: Point2,
  d: Point2,
) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (
    ((o1 > EPSILON &&
      o2 < -EPSILON) ||
      (o1 < -EPSILON &&
        o2 > EPSILON)) &&
    ((o3 > EPSILON &&
      o4 < -EPSILON) ||
      (o3 < -EPSILON &&
        o4 > EPSILON))
  ) {
    return true;
  }

  return (
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d)
  );
}

function pointInTriangle(
  point: Point2,
  triangle: readonly [
    Point2,
    Point2,
    Point2,
  ],
) {
  const [a, b, c] =
    triangle;
  const d1 =
    orientation(
      point,
      a,
      b,
    );
  const d2 =
    orientation(
      point,
      b,
      c,
    );
  const d3 =
    orientation(
      point,
      c,
      a,
    );

  const hasNegative =
    d1 < -EPSILON ||
    d2 < -EPSILON ||
    d3 < -EPSILON;
  const hasPositive =
    d1 > EPSILON ||
    d2 > EPSILON ||
    d3 > EPSILON;

  return !(
    hasNegative &&
    hasPositive
  );
}

export function polygonsOverlap(
  a: Point2[],
  b: Point2[],
) {
  if (
    a.length < 3 ||
    b.length < 3
  ) {
    return false;
  }

  if (
    a.some((point) =>
      pointInPolygon(point, b),
    ) ||
    b.some((point) =>
      pointInPolygon(point, a),
    )
  ) {
    return true;
  }

  for (
    let aIndex = 0;
    aIndex < a.length;
    aIndex++
  ) {
    const aStart =
      a[aIndex];
    const aEnd =
      a[
        (aIndex + 1) %
          a.length
      ];
    if (!aStart || !aEnd) {
      continue;
    }

    for (
      let bIndex = 0;
      bIndex < b.length;
      bIndex++
    ) {
      const bStart =
        b[bIndex];
      const bEnd =
        b[
          (bIndex + 1) %
            b.length
        ];
      if (
        bStart &&
        bEnd &&
        segmentsIntersect(
          aStart,
          aEnd,
          bStart,
          bEnd,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function triangleIntersectsPolygon(
  triangle: readonly [
    Point2,
    Point2,
    Point2,
  ],
  polygon: Point2[],
  padding = 0,
) {
  if (polygon.length < 3) {
    return false;
  }

  if (
    triangle.some((point) =>
      pointInPolygon(
        point,
        polygon,
      ),
    )
  ) {
    return true;
  }

  if (
    polygon.some((point) =>
      pointInTriangle(
        point,
        triangle,
      ),
    )
  ) {
    return true;
  }

  const triangleEdges = [
    [triangle[0], triangle[1]],
    [triangle[1], triangle[2]],
    [triangle[2], triangle[0]],
  ] as const;

  for (
    let index = 0;
    index < polygon.length;
    index++
  ) {
    const start =
      polygon[index];
    const end =
      polygon[
        (index + 1) %
          polygon.length
      ];
    if (!start || !end) {
      continue;
    }

    for (const [
      edgeStart,
      edgeEnd,
    ] of triangleEdges) {
      if (
        segmentsIntersect(
          edgeStart,
          edgeEnd,
          start,
          end,
        )
      ) {
        return true;
      }
    }
  }

  if (padding <= 0) {
    return false;
  }

  if (
    triangle.some(
      (point) =>
        distanceToPolygon(
          point,
          polygon,
        ) <= padding,
    )
  ) {
    return true;
  }

  for (const point of polygon) {
    for (const [
      edgeStart,
      edgeEnd,
    ] of triangleEdges) {
      if (
        distanceToSegment(
          point,
          edgeStart,
          edgeEnd,
        ) <= padding
      ) {
        return true;
      }
    }
  }

  return false;
}
