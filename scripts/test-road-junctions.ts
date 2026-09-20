import { deriveRoadJunctions } from "../src/game/road-junctions";
import type { LinearFeature } from "../src/game/types";

function road(
  id: string,
  points: [number, number][],
  {
    width = 5,
    layer,
    bridge,
    tunnel,
  }: {
    width?: number;
    layer?: string;
    bridge?: string;
    tunnel?: string;
  } = {},
): LinearFeature {
  const tags: Record<string, string> = {
    highway: "residential",
  };

  if (layer) {
    tags.layer = layer;
  }
  if (bridge) {
    tags.bridge = bridge;
  }
  if (tunnel) {
    tags.tunnel = tunnel;
  }

  return {
    id,
    name: id,
    type: "osm-road",
    width,
    source: "test",
    estimated: false,
    points,
    elevationMode: "terrain",
    tags,
  };
}

const connected = deriveRoadJunctions(
  [
    road("a", [
      [0, 0],
      [10, 0],
    ]),
    road(
      "b",
      [
        [10.2, 0.1],
        [10.2, 10],
      ],
      { width: 7 },
    ),
  ],
  {
    snapDistance: 0.35,
    overlap: 0.35,
  },
);

if (connected.length !== 1) {
  throw new Error(
    `Expected 1 connected junction, got ${connected.length}`,
  );
}

const junction = connected[0];
if (!junction) {
  throw new Error(
    "Expected derived junction.",
  );
}

if (
  junction.connectedFeatureIds.length !==
  2
) {
  throw new Error(
    "Junction must preserve both connected feature ids.",
  );
}

if (
  Math.abs(
    junction.radius - 3.85,
  ) > 0.000001
) {
  throw new Error(
    `Expected widest-road radius 3.85, got ${junction.radius}`,
  );
}

const separatedLayer =
  deriveRoadJunctions(
    [
      road("ground", [
        [0, 0],
        [10, 0],
      ]),
      road(
        "bridge",
        [
          [10, 0],
          [10, 10],
        ],
        {
          layer: "1",
          bridge: "yes",
        },
      ),
    ],
    {
      snapDistance: 0.35,
      overlap: 0.35,
    },
  );

if (
  separatedLayer.length !== 0
) {
  throw new Error(
    "Different bridge/layer endpoints must not be joined.",
  );
}

const distant =
  deriveRoadJunctions(
    [
      road("left", [
        [0, 0],
        [10, 0],
      ]),
      road("right", [
        [10.6, 0],
        [20, 0],
      ]),
    ],
    {
      snapDistance: 0.35,
      overlap: 0.35,
    },
  );

if (distant.length !== 0) {
  throw new Error(
    "Endpoints outside snap distance must stay disconnected.",
  );
}

console.log(
  "Road junction derivation test passed.",
);
