import {
  gradeRoadCrossSection,
  smoothRoadCenterHeight,
} from "../src/game/road-grading";

const raised =
  smoothRoadCenterHeight(
    10,
    9,
    10,
    0.12,
  );

if (
  raised < 9 ||
  raised > 9.12
) {
  throw new Error(
    `Center smoothing escaped raise-only bounds: ${raised}`,
  );
}

const bump =
  smoothRoadCenterHeight(
    9,
    10,
    9,
    0.12,
  );

if (bump !== 10) {
  throw new Error(
    "Road smoothing must never cut a terrain bump.",
  );
}

const regularized =
  gradeRoadCrossSection({
    leftTerrain: 10.7,
    rightTerrain: 10,
    longitudinalLift: 0,
    crossSpan: 7,
    maxCrossSlope: 0.06,
    maxCorrectionRelief: 0.75,
    surfaceGap: 0.045,
  });

if (
  regularized.leftY <
    10.7 + 0.045 -
      0.000001 ||
  regularized.rightY <
    10 + 0.045 -
      0.000001
) {
  throw new Error(
    "Cross-slope regularization cut below official terrain.",
  );
}

if (
  Math.abs(
    regularized.resultingDelta,
  ) >
  7 * 0.06 + 0.000001
) {
  throw new Error(
    "Regularized cross slope exceeds configured maximum.",
  );
}

const steep =
  gradeRoadCrossSection({
    leftTerrain: 11,
    rightTerrain: 10,
    longitudinalLift: 0,
    crossSpan: 7,
    maxCrossSlope: 0.06,
    maxCorrectionRelief: 0.75,
    surfaceGap: 0.045,
  });

if (steep.regularized) {
  throw new Error(
    "Unsupported steep relief must not be artificially regularized.",
  );
}

if (
  Math.abs(
    steep.leftY -
      (11 + 0.045),
  ) > 0.000001 ||
  Math.abs(
    steep.rightY -
      (10 + 0.045),
  ) > 0.000001
) {
  throw new Error(
    "Unsupported steep relief must follow both terrain edges.",
  );
}

console.log(
  "Terrain-safe road grading test passed.",
);
