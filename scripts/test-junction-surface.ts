import {
  fitBoundedSurfacePlane,
  liftPlaneAboveSamples,
  surfacePlaneHeight,
} from "../src/game/surface-plane";

const observations = [
  { x: -2, z: 0, y: 9.6 },
  { x: 2, z: 0, y: 10.4 },
  { x: 0, z: -2, y: 10 },
  { x: 0, z: 2, y: 10 },
];

const plane =
  fitBoundedSurfacePlane(
    observations,
    0.14,
  );

if (!plane) {
  throw new Error(
    "Expected fitted junction plane.",
  );
}

if (
  plane.slope >
  0.14 + 0.000001
) {
  throw new Error(
    `Junction plane slope exceeded cap: ${plane.slope}`,
  );
}

const terrainSamples = [
  { x: 0, z: 0, y: 10.2 },
  { x: 2, z: 0, y: 10.5 },
  { x: -2, z: 0, y: 10 },
];

const lifted =
  liftPlaneAboveSamples(
    plane,
    terrainSamples,
    12,
  );

if (!lifted.fullySupported) {
  throw new Error(
    "Expected bounded lift to be supported.",
  );
}

for (const sample of terrainSamples) {
  if (
    surfacePlaneHeight(
      lifted.plane,
      sample.x,
      sample.z,
    ) <
    sample.y - 0.000001
  ) {
    throw new Error(
      "Lifted junction plane cut below terrain sample.",
    );
  }
}

const impossible =
  liftPlaneAboveSamples(
    {
      gx: 0,
      gz: 0,
      intercept: 0,
      slope: 0,
    },
    [
      {
        x: 0,
        z: 0,
        y: 13,
      },
    ],
    12,
  );

if (impossible.fullySupported) {
  throw new Error(
    "Junction lift above configured maximum must be rejected.",
  );
}

console.log(
  "Junction surface plane test passed.",
);
