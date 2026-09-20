export interface PlaneObservation {
  x: number;
  z: number;
  y: number;
}

export interface SurfacePlane {
  gx: number;
  gz: number;
  intercept: number;
  slope: number;
}

export function fitBoundedSurfacePlane(
  observations: PlaneObservation[],
  maxSlope: number,
): SurfacePlane | null {
  if (observations.length < 3) {
    return null;
  }

  const meanX =
    observations.reduce(
      (sum, point) =>
        sum + point.x,
      0,
    ) / observations.length;
  const meanZ =
    observations.reduce(
      (sum, point) =>
        sum + point.z,
      0,
    ) / observations.length;
  const meanY =
    observations.reduce(
      (sum, point) =>
        sum + point.y,
      0,
    ) / observations.length;

  let xx = 0;
  let xz = 0;
  let zz = 0;
  let xy = 0;
  let zy = 0;

  for (const point of observations) {
    const dx =
      point.x - meanX;
    const dz =
      point.z - meanZ;
    const dy =
      point.y - meanY;

    xx += dx * dx;
    xz += dx * dz;
    zz += dz * dz;
    xy += dx * dy;
    zy += dz * dy;
  }

  const determinant =
    xx * zz - xz * xz;

  let gx = 0;
  let gz = 0;

  if (
    Math.abs(determinant) >
    0.0000001
  ) {
    gx =
      (xy * zz -
        zy * xz) /
      determinant;
    gz =
      (zy * xx -
        xy * xz) /
      determinant;
  }

  const rawSlope =
    Math.hypot(gx, gz);
  const allowedSlope =
    Math.max(0, maxSlope);

  if (
    rawSlope > allowedSlope &&
    rawSlope > 0
  ) {
    const scale =
      allowedSlope /
      rawSlope;
    gx *= scale;
    gz *= scale;
  }

  const intercept =
    meanY -
    gx * meanX -
    gz * meanZ;

  return {
    gx,
    gz,
    intercept,
    slope:
      Math.hypot(gx, gz),
  };
}

export function surfacePlaneHeight(
  plane: SurfacePlane,
  x: number,
  z: number,
) {
  return (
    plane.intercept +
    plane.gx * x +
    plane.gz * z
  );
}

export function liftPlaneAboveSamples(
  plane: SurfacePlane,
  samples: PlaneObservation[],
  maximumLift: number,
) {
  let lift = 0;

  for (const sample of samples) {
    lift = Math.max(
      lift,
      sample.y -
        surfacePlaneHeight(
          plane,
          sample.x,
          sample.z,
        ),
    );
  }

  const boundedLift = Math.max(
    0,
    Math.min(
      maximumLift,
      lift,
    ),
  );

  return {
    plane: {
      ...plane,
      intercept:
        plane.intercept +
        boundedLift,
    },
    requiredLift:
      Math.max(0, lift),
    appliedLift:
      boundedLift,
    fullySupported:
      lift <=
      maximumLift +
        0.000001,
  };
}
