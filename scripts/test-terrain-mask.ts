import {
  triangleIntersectsPolygon,
} from "../src/game/geometry-2d";
import type { Point2 } from "../src/game/types";

const square: Point2[] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
];

const inside = [
  [1, 1],
  [3, 1],
  [1, 3],
] as const;

if (
  !triangleIntersectsPolygon(
    inside,
    square,
  )
) {
  throw new Error(
    "Triangle inside footprint must be masked.",
  );
}

const crossing = [
  [-1, 2],
  [2, -1],
  [5, 2],
] as const;

if (
  !triangleIntersectsPolygon(
    crossing,
    square,
  )
) {
  throw new Error(
    "Crossing triangle must be masked even when no triangle vertex is inside.",
  );
}

const near = [
  [4.2, 1],
  [5, 1],
  [4.2, 2],
] as const;

if (
  triangleIntersectsPolygon(
    near,
    square,
    0,
  )
) {
  throw new Error(
    "Separated triangle must not intersect without padding.",
  );
}

if (
  !triangleIntersectsPolygon(
    near,
    square,
    0.35,
  )
) {
  throw new Error(
    "Padding must mask near-wall terrain triangles.",
  );
}

const far = [
  [5, 5],
  [6, 5],
  [5, 6],
] as const;

if (
  triangleIntersectsPolygon(
    far,
    square,
    0.35,
  )
) {
  throw new Error(
    "Terrain mask padding must not reach distant triangles.",
  );
}

console.log(
  "Terrain structure mask geometry test passed.",
);
