import {
  classifyPublicSpaceSurface,
  classifyRoadSurface,
} from "../src/game/road-surface";
import type { LinearFeature } from "../src/game/types";

function feature(
  tags: Record<string, string>,
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
    tags,
  };
}

const cases: Array<
  [Record<string, string>, ReturnType<typeof classifyRoadSurface>]
> = [
  [{ highway: "secondary", surface: "asphalt" }, "asphalt"],
  [{ highway: "residential", surface: "paving_stones" }, "paving"],
  [{ highway: "residential", surface: "sett" }, "paving"],
  [{ highway: "residential", surface: "cobblestone" }, "stone"],
  [{ highway: "pedestrian" }, "pedestrian"],
  [{ highway: "footway", surface: "asphalt" }, "pedestrian"],
  [{ highway: "service" }, "asphalt"],
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
  [{ surface: "cobblestone" }, "stone"],
  [{ surface: "paving_stones" }, "paving"],
  [{}, "paving"],
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
