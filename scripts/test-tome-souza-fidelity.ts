import siteData from "../src/data/site-data.json";
import vectorsData from "../geospatial/derived/site-vectors.json";
import {
  deriveElevatedCorridorDeck,
} from "../src/game/elevated-corridors";
import {
  distanceToPolygon,
  pointInPolygon,
} from "../src/game/geometry-2d";
import { terrainHeight } from "../src/game/terrain";
import type {
  DerivedBuildingFootprint,
  LinearFeature,
  MeasuredObject,
  Point2,
  SceneLevels,
  TerrainConfig,
} from "../src/game/types";

interface SiteData {
  buildings: MeasuredObject[];
  elevator: MeasuredObject[];
  terrain: TerrainConfig;
  levels: SceneLevels;
  layoutConstraints: {
    palacioThomeSite: {
      polygon: Point2[];
      width: number;
      depth: number;
      palaceStripWidth: number;
    };
  };
}

interface VectorsData {
  buildingFootprints:
    DerivedBuildingFootprint[];
  spaces: LinearFeature[];
  elevatedCorridors:
    LinearFeature[];
}

const data =
  siteData as unknown as SiteData;
const vectors =
  vectorsData as unknown as VectorsData;
const failures: string[] = [];

function insideOrBoundary(
  point: Point2,
  polygon: Point2[],
) {
  return (
    pointInPolygon(
      point,
      polygon,
    ) ||
    distanceToPolygon(
      point,
      polygon,
    ) <= 0.05
  );
}

const palace =
  data.buildings.find(
    (building) =>
      building.id ===
      "palacio-thome-souza",
  );

if (!palace) {
  failures.push(
    "Palácio Thomé de Souza curated object is missing.",
  );
} else {
  if (
    palace.footprintOsmId !==
    1317127245
  ) {
    failures.push(
      "Palácio Thomé de Souza must reference OSM way 1317127245.",
    );
  }

  if (palace.footprint) {
    failures.push(
      "Palácio Thomé de Souza must not duplicate its OSM footprint vertices.",
    );
  }
}

const palaceFootprint =
  vectors.buildingFootprints.find(
    (building) =>
      building.osmId ===
      1317127245,
  );

if (!palaceFootprint) {
  failures.push(
    "Canonical OSM footprint 1317127245 is missing.",
  );
} else {
  const site =
    data.layoutConstraints
      .palacioThomeSite
      .polygon;

  if (
    palaceFootprint.footprint.some(
      (point) =>
        !insideOrBoundary(
          point,
          site,
        ),
    )
  ) {
    failures.push(
      "Canonical Palácio footprint must remain inside the documented IPHAN TPTS site.",
    );
  }

  const sideLengths =
    palaceFootprint.footprint.map(
      (point, index) => {
        const next =
          palaceFootprint.footprint[
            (index + 1) %
              palaceFootprint
                .footprint.length
          ];
        if (!next) return 0;
        return Math.hypot(
          next[0] -
            point[0],
          next[1] -
            point[1],
        );
      },
    );
  const shortSide =
    Math.min(
      ...sideLengths,
    );
  const longSide =
    Math.max(
      ...sideLengths,
    );

  if (
    shortSide < 14 ||
    shortSide > 18
  ) {
    failures.push(
      `Palácio short side ${shortSide.toFixed(2)} m no longer matches the documented ~16 m strip.`,
    );
  }

  if (
    longSide < 40 ||
    longSide > 50
  ) {
    failures.push(
      `Palácio long side ${longSide.toFixed(2)} m no longer fits the documented TPTS longitudinal envelope.`,
    );
  }
}

const curatedTower =
  data.elevator.find(
    (part) =>
      part.id ===
      "lacerda-lower-tower",
  );

if (!curatedTower) {
  failures.push(
    "Curated Elevador Lacerda tower is missing.",
  );
} else {
  if (
    curatedTower.footprintOsmId !==
      59224731 ||
    curatedTower.footprint
  ) {
    failures.push(
      "Elevador Lacerda tower must reference OSM way 59224731 without duplicating footprint vertices.",
    );
  }
}

const tower =
  vectors.buildingFootprints.find(
    (building) =>
      building.osmId ===
      59224731,
  );
const plaza =
  vectors.spaces.find(
    (space) =>
      space.osmId ===
      1263035782,
  );
const bridge =
  vectors.elevatedCorridors.find(
    (corridor) =>
      corridor.osmId ===
      59409445,
  );
const landing =
  vectors.elevatedCorridors.find(
    (corridor) =>
      corridor.osmId ===
      1455480196,
  );

if (
  !tower ||
  !plaza ||
  !bridge ||
  !landing
) {
  failures.push(
    "Elevador tower, Praça Tomé de Souza and canonical upper corridor chain must all be present.",
  );
} else {
  const bridgeTowerPoint =
    bridge.points.find(
      (point) =>
        insideOrBoundary(
          point,
          tower.footprint,
        ),
    );
  const sharedPoint =
    bridge.points.find(
      (point) =>
        landing.points.some(
          (landingPoint) =>
            Math.hypot(
              landingPoint[0] -
                point[0],
              landingPoint[1] -
                point[1],
            ) <= 0.05,
        ),
    );
  const plazaPoint =
    landing.points.find(
      (point) =>
        insideOrBoundary(
          point,
          plaza.points,
        ),
    );

  if (!bridgeTowerPoint) {
    failures.push(
      "Upper bridge must connect to the Elevador Lacerda footprint.",
    );
  }
  if (!sharedPoint) {
    failures.push(
      "Upper bridge and landing corridor must share a mapped endpoint.",
    );
  }
  if (!plazaPoint) {
    failures.push(
      "Upper landing corridor must terminate inside Praça Tomé de Souza.",
    );
  }

  const deck =
    deriveElevatedCorridorDeck(
      vectors.elevatedCorridors,
      data.terrain,
      data.levels,
      [
        tower.footprint,
      ],
    );

  if (!deck) {
    failures.push(
      "Elevated corridor deck could not be derived.",
    );
  } else {
    if (
      !insideOrBoundary(
        deck.anchor,
        plaza.points,
      )
    ) {
      failures.push(
        "Elevated corridor deck must anchor to the upper-city plaza side, not the cliff terrain.",
      );
    }

    const anchorTerrain =
      terrainHeight(
        data.terrain,
        data.levels,
        deck.anchor[0],
        deck.anchor[1],
      );

    if (
      deck.deckY <=
      anchorTerrain
    ) {
      failures.push(
        "Elevated corridor deck must sit above its upper-city terrain anchor.",
      );
    }

    if (
      bridgeTowerPoint
    ) {
      const towerTerrain =
        terrainHeight(
          data.terrain,
          data.levels,
          bridgeTowerPoint[0],
          bridgeTowerPoint[1],
        );

      if (
        deck.deckY -
          towerTerrain <
        40
      ) {
        failures.push(
          "Elevated bridge must remain elevated across the escarpment instead of being draped onto terrain.",
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(
    "Tomé de Souza / Elevador fidelity test failed:",
  );
  for (const failure of failures) {
    console.error(
      "- " + failure,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    "Tomé de Souza / Elevador fidelity test passed.",
  );
}
