export function smoothRoadCenterHeight(
  previous: number,
  current: number,
  next: number,
  maxRaise: number,
) {
  const smoothed =
    (previous +
      current * 2 +
      next) /
    4;

  return Math.max(
    current,
    Math.min(
      current + maxRaise,
      smoothed,
    ),
  );
}

export function gradeRoadCrossSection({
  leftTerrain,
  rightTerrain,
  longitudinalLift,
  crossSpan,
  maxCrossSlope,
  maxCorrectionRelief,
  surfaceGap,
}: {
  leftTerrain: number;
  rightTerrain: number;
  longitudinalLift: number;
  crossSpan: number;
  maxCrossSlope: number;
  maxCorrectionRelief: number;
  surfaceGap: number;
}) {
  const lift = Math.max(
    0,
    longitudinalLift,
  );
  let left =
    leftTerrain + lift;
  let right =
    rightTerrain + lift;
  const naturalDelta =
    leftTerrain -
    rightTerrain;
  const maximumDelta =
    Math.max(
      0,
      crossSpan,
    ) *
    Math.max(
      0,
      maxCrossSlope,
    );
  const regularize =
    Math.abs(
      naturalDelta,
    ) <=
    maxCorrectionRelief;

  if (
    regularize &&
    naturalDelta >
      maximumDelta
  ) {
    right = Math.max(
      right,
      left - maximumDelta,
    );
  } else if (
    regularize &&
    naturalDelta <
      -maximumDelta
  ) {
    left = Math.max(
      left,
      right - maximumDelta,
    );
  }

  return {
    leftY:
      left + surfaceGap,
    rightY:
      right + surfaceGap,
    regularized:
      regularize &&
      Math.abs(
        naturalDelta,
      ) > maximumDelta,
    naturalDelta,
    resultingDelta:
      left - right,
  };
}
