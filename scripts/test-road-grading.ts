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
    maxSupportedFillHeight: 12,
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
    maxSupportedFillHeight: 12,
    surfaceGap: 0.045,
  });

if (!steep.regularized) {
  throw new Error(
    "Steep road relief within supported fill height must receive a walkable bench.",
  );
}

if (
  Math.abs(
    steep.resultingDelta,
  ) >
  7 * 0.06 + 0.000001
) {
  throw new Error(
    "Steep supported road must still respect maximum cross slope.",
  );
}

if (
  steep.rightSupportHeight <= 0
) {
  throw new Error(
    "Lower road edge must report retaining support height.",
  );
}

const unsupported =
  gradeRoadCrossSection({
    leftTerrain: 25,
    rightTerrain: 10,
    longitudinalLift: 0,
    crossSpan: 7,
    maxCrossSlope: 0.06,
    maxSupportedFillHeight: 12,
    surfaceGap: 0.045,
  });

if (unsupported.regularized) {
  throw new Error(
    "Road relief requiring more than maximum supported fill must not invent an unbounded structure.",
  );
}

console.log(
  "Terrain-safe road grading test passed.",
);
