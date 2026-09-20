import type { Point2 } from "./types";

export function samplePolyline(
  points: Point2[],
  spacing: number,
) {
  if (points.length < 2) {
    return [...points];
  }

  const sampled: Point2[] = [];

  for (
    let index = 0;
    index < points.length - 1;
    index++
  ) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) {
      continue;
    }

    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const distance = Math.hypot(
      dx,
      dz,
    );
    const steps = Math.max(
      1,
      Math.ceil(
        distance / spacing,
      ),
    );

    for (
      let step = 0;
      step < steps;
      step++
    ) {
      const t = step / steps;
      sampled.push([
        a[0] + dx * t,
        a[1] + dz * t,
      ]);
    }
  }

  const last =
    points[points.length - 1];
  if (last) {
    sampled.push(last);
  }

  return sampled;
}

function direction(
  a: Point2,
  b: Point2,
) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(
    dx,
    dz,
  );

  if (
    length <= 0.000001
  ) {
    return [0, 1] as Point2;
  }

  return [
    dx / length,
    dz / length,
  ] as Point2;
}

export function roadOffset(
  centers: Point2[],
  index: number,
  halfWidth: number,
  maxMiterScale: number,
) {
  const center =
    centers[index];
  if (!center) {
    return [
      halfWidth,
      0,
    ] as Point2;
  }

  const previous =
    centers[
      Math.max(
        0,
        index - 1,
      )
    ] ?? center;
  const next =
    centers[
      Math.min(
        centers.length - 1,
        index + 1,
      )
    ] ?? center;

  if (index === 0) {
    const nextDirection =
      direction(
        center,
        next,
      );
    return [
      -nextDirection[1] *
        halfWidth,
      nextDirection[0] *
        halfWidth,
    ] as Point2;
  }

  if (
    index ===
    centers.length - 1
  ) {
    const previousDirection =
      direction(
        previous,
        center,
      );
    return [
      -previousDirection[1] *
        halfWidth,
      previousDirection[0] *
        halfWidth,
    ] as Point2;
  }

  const incoming =
    direction(
      previous,
      center,
    );
  const outgoing =
    direction(
      center,
      next,
    );
  const incomingNormal:
    Point2 = [
      -incoming[1],
      incoming[0],
    ];
  const outgoingNormal:
    Point2 = [
      -outgoing[1],
      outgoing[0],
    ];
  const miterX =
    incomingNormal[0] +
    outgoingNormal[0];
  const miterZ =
    incomingNormal[1] +
    outgoingNormal[1];
  const miterLength =
    Math.hypot(
      miterX,
      miterZ,
    );

  if (
    miterLength <= 0.001
  ) {
    return [
      outgoingNormal[0] *
        halfWidth,
      outgoingNormal[1] *
        halfWidth,
    ] as Point2;
  }

  const normalizedMiter:
    Point2 = [
      miterX / miterLength,
      miterZ / miterLength,
    ];
  const denominator =
    normalizedMiter[0] *
      outgoingNormal[0] +
    normalizedMiter[1] *
      outgoingNormal[1];

  if (
    Math.abs(
      denominator,
    ) < 0.2
  ) {
    return [
      outgoingNormal[0] *
        halfWidth,
      outgoingNormal[1] *
        halfWidth,
    ] as Point2;
  }

  const requested =
    halfWidth / denominator;
  const maximum =
    halfWidth *
    maxMiterScale;
  const scale = Math.max(
    -maximum,
    Math.min(
      maximum,
      requested,
    ),
  );

  return [
    normalizedMiter[0] *
      scale,
    normalizedMiter[1] *
      scale,
  ] as Point2;
}


export function roadFootprintPolygon(
  points: Point2[],
  width: number,
  sampleSpacing: number,
  maxMiterScale: number,
  clearance = 0,
): Point2[] {
  const centers =
    samplePolyline(
      points,
      sampleSpacing,
    );

  if (centers.length < 2) {
    return [];
  }

  const halfWidth =
    Math.max(0.5, width / 2) +
    Math.max(0, clearance);
  const left: Point2[] = [];
  const right: Point2[] = [];

  for (
    let index = 0;
    index < centers.length;
    index++
  ) {
    const center =
      centers[index];
    if (!center) {
      continue;
    }

    const offset =
      roadOffset(
        centers,
        index,
        halfWidth,
        maxMiterScale,
      );

    left.push([
      center[0] + offset[0],
      center[1] + offset[1],
    ]);
    right.push([
      center[0] - offset[0],
      center[1] - offset[1],
    ]);
  }

  return [
    ...left,
    ...right.reverse(),
  ];
}
