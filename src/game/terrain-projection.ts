export function blendedCliffUv({
  x,
  y,
  z,
  nx,
  nz,
  textureScale,
  sharpness,
}: {
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
  textureScale: number;
  sharpness: number;
}): [number, number] {
  const scale =
    Math.max(
      0.001,
      textureScale,
    );
  const exponent =
    Math.max(
      1,
      sharpness,
    );
  const xWeight =
    Math.pow(
      Math.abs(nx),
      exponent,
    );
  const zWeight =
    Math.pow(
      Math.abs(nz),
      exponent,
    );
  const weightSum =
    xWeight +
    zWeight;

  if (
    weightSum <=
    0.000001
  ) {
    return [
      x / scale,
      y / scale,
    ];
  }

  const u =
    (
      z * xWeight +
      x * zWeight
    ) /
    weightSum /
    scale;

  return [
    u,
    y / scale,
  ];
}
