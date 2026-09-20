import vectorsData from "../geospatial/derived/site-vectors.json";
import siteData from "../src/data/site-data.json";
import {
  alignEstimatedBuildingsToTerrain,
  deriveRuntimeBuildingBlockouts,
  hydrateCuratedBuildingFootprints,
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

const vectors =
  vectorsData as unknown as {
    buildingFootprints:
      DerivedBuildingFootprint[];
  };

const sourced =
  hydrateCuratedBuildingFootprints(
    data.buildings,
    vectors.buildingFootprints,
  );

let referencedCount = 0;

for (
  let index = 0;
  index < data.buildings.length;
  index++
) {
  const before =
    data.buildings[index];
  const hydrated =
    sourced[index];
  if (!before || !hydrated) {
    continue;
  }

  if (
    typeof before.footprintOsmId !==
    "number"
  ) {
    continue;
  }

  referencedCount += 1;

  if (before.footprint) {
    throw new Error(
      `Building ${before.id} duplicates a referenced OSM footprint in site-data.json.`,
    );
  }

  const source =
    vectors.buildingFootprints.find(
      (item) =>
        item.osmId ===
        before.footprintOsmId,
    );

  if (!source) {
    throw new Error(
      `Building ${before.id} references missing OSM footprint ${before.footprintOsmId}.`,
    );
  }

  if (
    JSON.stringify(
      hydrated.footprint,
    ) !==
    JSON.stringify(
      source.footprint,
    )
  ) {
    throw new Error(
      `Building ${before.id} did not hydrate the canonical OSM footprint exactly.`,
    );
  }
}

if (referencedCount < 2) {
  throw new Error(
    "Expected curated landmark OSM footprint references.",
  );
}

const aligned =
  alignEstimatedBuildingsToTerrain(
    sourced,
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
    sourced[index];
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


const measuredBlockouts =
  deriveRuntimeBuildingBlockouts(
    vectors.buildingFootprints,
    data.terrain,
    data.levels,
    [],
    [],
    [],
  );

if (
  measuredBlockouts.buildings.length <
  85
) {
  throw new Error(
    `Expected at least 85 measured OSM building blockouts, got ${measuredBlockouts.buildings.length}.`,
  );
}

if (
  measuredBlockouts.steppedFoundations <
  30
) {
  throw new Error(
    `Expected at least 30 terrain-adaptive building foundations, got ${measuredBlockouts.steppedFoundations}.`,
  );
}

const foundedBuildings =
  measuredBlockouts.buildings.filter(
    (building) =>
      typeof building.foundationBottomY ===
      "number",
  );

for (const building of foundedBuildings) {
  if (
    !building.footprint ||
    building.footprint.length < 3
  ) {
    throw new Error(
      `Founded building ${building.id} must retain its canonical footprint.`,
    );
  }

  const stats =
    sampleTerrainFootprint(
      building.footprint,
      data.terrain,
      data.levels,
    );
  const buildingBase =
    building.position[1] -
    building.height / 2;

  if (
    Math.abs(
      buildingBase -
        stats.maxGround,
    ) > 0.001
  ) {
    throw new Error(
      `Founded building ${building.id} must start at highest sampled terrain.`,
    );
  }

  if (
    Math.abs(
      (building.foundationBottomY ??
        Number.NaN) -
        stats.minGround,
    ) > 0.001
  ) {
    throw new Error(
      `Founded building ${building.id} foundation must reach lowest sampled terrain.`,
    );
  }
}
