import {
  clipPolygonToBounds,
  clipPolylineToBounds,
  deriveOsmSiteVectors,
  parseOsmMeasurement,
} from "./lib/osm-site-vectors.mjs";

const bounds = {
  minX: 0,
  maxX: 20,
  minZ: 0,
  maxZ: 20,
};

const config = {
  defaultRoadWidth: 5,
  laneWidthMeters: 3,
  useLaneCountForEstimatedWidth: true,
  roadWidths: {
    residential: 5.5,
    service: 4,
  },
  buildingLevelHeight: 3,
  indoorCorridorWidth: 3,
  preserveIndoorCorridors: true,
  terrainFeatures: {
    lines: {
      "barrier=retaining_wall":
        "retaining-wall",
      "natural=cliff":
        "cliff",
    },
    areas: {
      "natural=wood":
        "wood",
      "landuse=grass":
        "grass",
    },
  },
};

const failures = [];

const clippedLine = clipPolylineToBounds(
  [
    [-10, 10],
    [30, 10],
  ],
  bounds,
);

if (
  clippedLine.length !== 1 ||
  clippedLine[0]?.[0]?.[0] !== 0 ||
  clippedLine[0]?.[1]?.[0] !== 20
) {
  failures.push("polyline clipping did not preserve the in-bounds segment");
}

const clippedPolygon = clipPolygonToBounds(
  [
    [-5, -5],
    [25, -5],
    [25, 25],
    [-5, 25],
  ],
  bounds,
);

if (clippedPolygon.length !== 4) {
  failures.push(
    `expected clipped rectangle with 4 points, got ${clippedPolygon.length}`,
  );
}

if (parseOsmMeasurement("6.5 m") !== 6.5) {
  failures.push("OSM measurement parser failed for metre suffix");
}

const derived = deriveOsmSiteVectors({
  bounds,
  config,
  source: "synthetic OSM",
  coverage: "partial",
  criticalRoadNames: [
    "Rua Teste",
    "Rua Ausente",
  ],
  features: [
    {
      id: "way/1",
      osmType: "way",
      osmId: 1,
      geometryType: "polyline",
      points: [
        [-10, 10],
        [30, 10],
      ],
      tags: {
        highway: "residential",
        lanes: "2",
        name: "Rua Teste",
      },
    },
    {
      id: "way/2",
      osmType: "way",
      osmId: 2,
      geometryType: "polyline",
      points: [
        [0, 5],
        [20, 5],
      ],
      tags: {
        highway: "service",
        lanes: "3",
        width: "6.5",
      },
    },
    {
      id: "way/6",
      osmType: "way",
      osmId: 6,
      geometryType: "polyline",
      points: [
        [2, 10],
        [18, 10],
      ],
      tags: {
        highway: "corridor",
        indoor: "yes",
        layer: "1",
      },
    },
    {
      id: "way/3",
      osmType: "way",
      osmId: 3,
      geometryType: "polygon",
      points: [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
        [2, 2],
      ],
      tags: {
        place: "square",
        name: "Praça Teste",
      },
    },
    {
      id: "way/4",
      osmType: "way",
      osmId: 4,
      geometryType: "polygon",
      points: [
        [1, 12],
        [6, 12],
        [6, 18],
        [1, 18],
        [1, 12],
      ],
      tags: {
        leisure: "park",
        name: "Praça Parque",
      },
    },
    {
      id: "way/7",
      osmType: "way",
      osmId: 7,
      geometryType: "polyline",
      points: [
        [-5, 4],
        [25, 4],
      ],
      tags: {
        barrier:
          "retaining_wall",
      },
    },
    {
      id: "way/8",
      osmType: "way",
      osmId: 8,
      geometryType: "polygon",
      points: [
        [12, 1],
        [19, 1],
        [19, 7],
        [12, 7],
        [12, 1],
      ],
      tags: {
        natural: "wood",
      },
    },    {
      id: "way/5",
      osmType: "way",
      osmId: 5,
      geometryType: "polygon",
      points: [
        [10, 10],
        [15, 10],
        [15, 15],
        [10, 15],
        [10, 10],
      ],
      tags: {
        building: "yes",
        "building:levels": "3",
        name: "Edifício Teste",
      },
    },
  ],
});

if (derived.roads.length !== 2) {
  failures.push(`expected 2 terrain roads, got ${derived.roads.length}`);
}

if (
  derived.elevatedCorridors.length !== 1 ||
  derived.elevatedCorridors[0]?.id !==
    "way/6" ||
  derived.elevatedCorridors[0]?.width !== 3
) {
  failures.push(
    "indoor corridor must be preserved separately from terrain roads",
  );
}

if (
  derived.terrainLines.length !== 1 ||
  derived.terrainLines[0]?.kind !==
    "retaining-wall"
) {
  failures.push(
    "retaining wall must be preserved as a terrain line",
  );
}

if (
  derived.terrainAreas.length !== 1 ||
  derived.terrainAreas[0]?.kind !==
    "wood"
) {
  failures.push(
    "wood polygon must be preserved as a terrain area",
  );
}

if (
  derived.metadata?.terrainLineCount !== 1 ||
  derived.metadata?.terrainAreaCount !== 1
) {
  failures.push(
    "terrain feature metadata counts are incorrect",
  );
}
if (
  derived.roads.some(
    (road) =>
      road.tags?.indoor === "yes",
  )
) {
  failures.push(
    "indoor highway features must not become terrain roads",
  );
}

if (
  derived.metadata?.laneDerivedRoadCount !== 1
) {
  failures.push(
    "lane-derived road metadata count is incorrect",
  );
}

if (
  derived.metadata?.coverage !== "partial" ||
  derived.metadata?.criticalRoadCoverage?.found !== 1 ||
  derived.metadata?.criticalRoadCoverage?.total !== 2 ||
  derived.metadata?.criticalRoadCoverage?.complete !== false ||
  derived.metadata?.criticalRoadCoverage?.missing?.[0] !==
    "Rua Ausente"
) {
  failures.push(
    "critical road coverage metadata is incorrect",
  );
}

const residential = derived.roads.find(
  (road) => road.id === "way/1",
);
if (
  residential?.width !== 6 ||
  residential?.estimated !== true ||
  !residential?.widthSource?.includes("OSM lanes=2")
) {
  failures.push("OSM lane count was not preferred for estimated carriageway width");
}

if (
  residential?.osmId !== 1 ||
  residential?.osmType !== "way"
) {
  failures.push("derived road did not preserve OSM identity");
}

if (residential?.elevationMode !== "terrain") {
  failures.push(
    "OSM roads must follow the active terrain instead of a name-based elevation override",
  );
}

const explicit = derived.roads.find(
  (road) => road.id === "way/2",
);
if (
  explicit?.width !== 6.5 ||
  explicit?.estimated !== false ||
  explicit?.widthSource !== "OSM width tag"
) {
  failures.push("explicit OSM road width must override lane-derived estimates");
}

if (derived.spaces.length !== 2) {
  failures.push(`expected 2 spaces, got ${derived.spaces.length}`);
}

const park = derived.spaces.find(
  (space) => space.id === "way/4",
);
if (park?.type !== "osm-park") {
  failures.push(
    "leisure=park polygon must remain a persistent public space",
  );
}

const building = derived.buildingFootprints[0];
if (
  building?.height !== 9 ||
  building?.heightEstimated !== true
) {
  failures.push("building:levels height derivation is incorrect");
}

for (const collection of [
  derived.roads,
  derived.spaces,
]) {
  for (const feature of collection) {
    for (const [x, z] of feature.points) {
      if (
        x < bounds.minX ||
        x > bounds.maxX ||
        z < bounds.minZ ||
        z > bounds.maxZ
      ) {
        failures.push(`${feature.id} contains a point outside bounds`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("OSM vector derivation test failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    [
      "OSM vector derivation test passed.",
      `roads=${derived.roads.length},`,
      `corridors=${derived.elevatedCorridors.length},`,
      `terrainLines=${derived.terrainLines.length},`,
      `terrainAreas=${derived.terrainAreas.length},`,
      `spaces=${derived.spaces.length},`,
      `buildings=${derived.buildingFootprints.length}.`,
    ].join(" "),
  );
}
