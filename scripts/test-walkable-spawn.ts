import {
  chooseWalkableSpawn,
  polygonInteriorSpawn,
} from "../src/game/walkable-spawn";
import type { LinearFeature } from "../src/game/types";

function feature(
  id: string,
  name: string,
  points: [number, number][],
): LinearFeature {
  return {
    id,
    name,
    type: "test",
    width: 5,
    source: "test",
    estimated: false,
    points,
    elevationMode: "terrain",
    tags: {},
  };
}

const concave = feature(
  "square",
  "Praça Tomé de Souza",
  [
    [0, 0],
    [8, 0],
    [8, 8],
    [5, 8],
    [5, 3],
    [3, 3],
    [3, 8],
    [0, 8],
  ],
);

const point =
  polygonInteriorSpawn(
    concave.points,
  );

if (!point) {
  throw new Error(
    "Expected polygon interior spawn.",
  );
}

if (
  point[0] < 0 ||
  point[0] > 8 ||
  point[1] < 0 ||
  point[1] > 8
) {
  throw new Error(
    `Spawn escaped polygon bounds: ${point}`,
  );
}

const alternate = feature(
  "alternate",
  "Outra Praça",
  [
    [100, 100],
    [110, 100],
    [110, 110],
    [100, 110],
  ],
);

const preferred =
  chooseWalkableSpawn(
    [alternate, concave],
    [],
    "Praça Tomé de Souza",
  );

if (
  preferred[0] > 20 ||
  preferred[1] > 20
) {
  throw new Error(
    "Preferred named public space was not selected.",
  );
}

const roadOnly =
  chooseWalkableSpawn(
    [],
    [
      feature(
        "road",
        "Rua",
        [
          [0, 0],
          [20, 0],
        ],
      ),
    ],
  );

if (
  roadOnly[0] !== 10 ||
  roadOnly[1] !== 0
) {
  throw new Error(
    `Expected road midpoint fallback, got ${roadOnly}`,
  );
}

console.log(
  "Walkable spawn derivation test passed.",
);
