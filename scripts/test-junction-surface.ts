import {
  fitBoundedSurfacePlane,
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

const centerHeight =
  surfacePlaneHeight(
    plane,
    0,
    0,
  );

if (
  !Number.isFinite(
    centerHeight,
  )
) {
  throw new Error(
    "Fitted junction plane must produce finite heights.",
  );
}

for (const observation of observations) {
  const fitted =
    surfacePlaneHeight(
      plane,
      observation.x,
      observation.z,
    );
  if (!Number.isFinite(fitted)) {
    throw new Error(
      "Junction plane produced a non-finite edge height.",
    );
  }
}

console.log(
  "Junction surface plane test passed.",
);
