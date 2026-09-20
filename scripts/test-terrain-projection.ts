import {
  blendedCliffUv,
} from "../src/game/terrain-projection";

const scale = 10;
const sharpness = 4;

const xFacing =
  blendedCliffUv({
    x: 4,
    y: 12,
    z: 8,
    nx: 1,
    nz: 0,
    textureScale: scale,
    sharpness,
  });

if (
  Math.abs(
    xFacing[0] - 0.8,
  ) >
    0.000001
) {
  throw new Error(
    "X-facing cliff must project vertical texture using world Z.",
  );
}

const zFacing =
  blendedCliffUv({
    x: 4,
    y: 12,
    z: 8,
    nx: 0,
    nz: 1,
    textureScale: scale,
    sharpness,
  });

if (
  Math.abs(
    zFacing[0] - 0.4,
  ) >
    0.000001
) {
  throw new Error(
    "Z-facing cliff must project vertical texture using world X.",
  );
}

const diagonal =
  blendedCliffUv({
    x: 4,
    y: 12,
    z: 8,
    nx: 1,
    nz: 1,
    textureScale: scale,
    sharpness,
  });

if (
  Math.abs(
    diagonal[0] - 0.6,
  ) >
    0.000001
) {
  throw new Error(
    "Diagonal cliff projection must blend both world axes.",
  );
}

const left =
  blendedCliffUv({
    x: 4,
    y: 12,
    z: 8,
    nx: 0.51,
    nz: 0.49,
    textureScale: scale,
    sharpness,
  });
const right =
  blendedCliffUv({
    x: 4,
    y: 12,
    z: 8,
    nx: 0.49,
    nz: 0.51,
    textureScale: scale,
    sharpness,
  });

if (
  Math.abs(
    left[0] -
      right[0],
  ) > 0.04
) {
  throw new Error(
    "Cliff projection must remain continuous when the dominant normal axis changes.",
  );
}

console.log(
  "Terrain cliff projection test passed.",
);
