import siteData from "../src/data/site-data.json";
import {
  alignEstimatedBuildingsToTerrain,
  deriveRuntimeBuildingBlockouts,
  sampleTerrainFootprint,
} from "../src/game/derived-buildings";
import type {
  DerivedBuildingFootprint,
  LinearFeature,
  MeasuredObject,
  SceneLevels,
  TerrainConfig,
} from "../src/game/types";

const data =
  siteData as unknown as {
    buildings: MeasuredObject[];
    terrain: TerrainConfig;
    levels: SceneLevels;
  };

const aligned =
  alignEstimatedBuildingsToTerrain(
    data.buildings,
    data.terrain,
    data.levels,
  );

if (
  aligned.length !==
  data.buildings.length
) {
  throw new Error(
    "Building grounding must preserve building count.",
  );
}

let movedCount = 0;

for (
  let index = 0;
  index < aligned.length;
  index++
) {
  const before =
    data.buildings[index];
  const after = aligned[index];

  if (!before || !after) {
    continue;
  }

  if (
    after.position[0] !==
      before.position[0] ||
    after.position[2] !==
      before.position[2]
  ) {
    throw new Error(
      `Building ${before.id} changed horizontal position.`,
    );
  }

  if (
    !before.estimated ||
    !before.footprint ||
    before.footprint.length < 3
  ) {
    continue;
  }

  const stats =
    sampleTerrainFootprint(
      before.footprint,
      data.terrain,
      data.levels,
    );
  const groundedBase =
    after.position[1] -
    after.height / 2;

  if (
    Math.abs(
      groundedBase -
        stats.minGround,
    ) > 0.001
  ) {
    throw new Error(
      `Building ${before.id} base ${groundedBase} does not match sampled terrain minimum ${stats.minGround}.`,
    );
  }

  if (
    Math.abs(
      after.position[1] -
        before.position[1],
    ) > 0.5
  ) {
    movedCount += 1;
  }
}

if (movedCount < 1) {
  throw new Error(
    "Expected at least one estimated curated building to be materially re-grounded.",
  );
}

console.log(
  `Building grounding test passed. materially moved=${movedCount}`,
);


const syntheticRoad: LinearFeature = {
  id: "synthetic-road",
  name: "Synthetic road",
  type: "osm-residential",
  width: 6,
  source: "test",
  estimated: true,
  points: [
    [-10, 0],
    [10, 0],
  ],
  elevationMode: "terrain",
  osmId: 990001,
  osmType: "way",
  tags: {
    highway: "residential",
  },
};

const syntheticBuilding:
  DerivedBuildingFootprint = {
    id: "way/990002",
    name: "Synthetic road-conflict building",
    buildingType: "yes",
    footprint: [
      [-2, -1],
      [2, -1],
      [2, 1],
      [-2, 1],
    ],
    source: "test",
    osmId: 990002,
    osmType: "way",
    tags: {
      building: "yes",
    },
    height: 6,
    heightEstimated: true,
    heightSource: "test height",
  };

const roadConflict =
  deriveRuntimeBuildingBlockouts(
    [syntheticBuilding],
    data.terrain,
    data.levels,
    [],
    [],
    [syntheticRoad],
  );

if (
  roadConflict.buildings.length !== 0 ||
  roadConflict.skipped.overlapsRoadSurface !== 1
) {
  throw new Error(
    "A building footprint overlapping the rendered road surface must not be promoted to a collidable blockout.",
  );
}
