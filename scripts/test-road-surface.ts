import {
  classifyPublicSpaceSurface,
  classifyRoadSurface,
} from "../src/game/road-surface";
import type { LinearFeature } from "../src/game/types";

function feature(
  tags: Record<string, string>,
  osmId?: number,
): LinearFeature {
  return {
    id: "test",
    name: "Teste",
    type: "osm-test",
    width: 5,
    source: "test",
    estimated: false,
    points: [
      [0, 0],
      [10, 0],
    ],
    elevationMode: "terrain",
    osmId,
    tags,
  };
}

const cases: Array<
  [Record<string, string>, ReturnType<typeof classifyRoadSurface>]
> = [
  [{ highway: "secondary", surface: "asphalt" }, "asphalt"],
  [{ highway: "secondary", surface: "paved" }, "paved"],
  [{ highway: "residential", surface: "paving_stones" }, "paving"],
  [{ highway: "residential", surface: "sett" }, "paving"],
  [{ highway: "residential", surface: "cobblestone" }, "stone"],
  [{ highway: "pedestrian" }, "pedestrian"],
  [{ highway: "footway", surface: "asphalt" }, "asphalt"],
  [{ highway: "service" }, "paved"],
];

const failures: string[] = [];

for (const [tags, expected] of cases) {
  const actual = classifyRoadSurface(
    feature(tags),
  );
  if (actual !== expected) {
    failures.push(
      `${JSON.stringify(tags)} => ${actual}; expected ${expected}`,
    );
  }
}

const publicCases: Array<
  [Record<string, string>, ReturnType<typeof classifyPublicSpaceSurface>]
> = [
  [{ surface: "asphalt" }, "asphalt"],
  [{ surface: "paved" }, "paved"],
  [{ surface: "cobblestone" }, "stone"],
  [{ surface: "paving_stones" }, "paving"],
  [{ leisure: "park" }, null],
  [{ leisure: "park", surface: "grass" }, null],
  [{ place: "square" }, "pedestrian"],
  [{}, null],
];

for (const [tags, expected] of publicCases) {
  const actual =
    classifyPublicSpaceSurface(
      feature(tags),
    );
  if (actual !== expected) {
    failures.push(
      `public ${JSON.stringify(tags)} => ${actual}; expected ${expected}`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    "Road surface classification test failed:",
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    "Road surface classification test passed.",
  );
}


const tomeSouza =
  classifyPublicSpaceSurface(
    feature(
      {
        leisure: "park",
        name: "Praça Tomé de Souza",
      },
      1263035782,
    ),
    [
      {
        osmId: 1263035782,
        surface: "stone",
      },
    ],
  );

if (tomeSouza !== "stone") {
  failures.push(
    `Praça Tomé de Souza override => ${tomeSouza}; expected stone`,
  );
}

const explicitGrass =
  classifyPublicSpaceSurface(
    feature(
      {
        leisure: "park",
        surface: "grass",
      },
      1263035782,
    ),
    [
      {
        osmId: 1263035782,
        surface: "stone",
      },
    ],
  );

if (explicitGrass !== null) {
  failures.push(
    "Explicit soft OSM surface must take precedence over a curated hard-surface override.",
  );
}
