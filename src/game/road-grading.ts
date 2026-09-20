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
  maxSupportedFillHeight,
  surfaceGap,
}: {
  leftTerrain: number;
  rightTerrain: number;
  longitudinalLift: number;
  crossSpan: number;
  maxCrossSlope: number;
  maxSupportedFillHeight: number;
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

  let requiredFill = 0;
  let supportSide:
    | "left"
    | "right"
    | null = null;

  if (
    naturalDelta >
      maximumDelta
  ) {
    const targetRight =
      left - maximumDelta;
    requiredFill =
      targetRight - right;

    if (
      requiredFill <=
      maxSupportedFillHeight
    ) {
      right = targetRight;
      supportSide = "right";
    }
  } else if (
    naturalDelta <
      -maximumDelta
  ) {
    const targetLeft =
      right - maximumDelta;
    requiredFill =
      targetLeft - left;

    if (
      requiredFill <=
      maxSupportedFillHeight
    ) {
      left = targetLeft;
      supportSide = "left";
    }
  }

  const leftSurface =
    left + surfaceGap;
  const rightSurface =
    right + surfaceGap;

  return {
    leftY: leftSurface,
    rightY: rightSurface,
    leftSupportHeight:
      Math.max(
        0,
        leftSurface -
          (leftTerrain +
            surfaceGap),
      ),
    rightSupportHeight:
      Math.max(
        0,
        rightSurface -
          (rightTerrain +
            surfaceGap),
      ),
    regularized:
      supportSide !== null,
    supportSide,
    requiredFill:
      Math.max(
        0,
        requiredFill,
      ),
    naturalDelta,
    resultingDelta:
      left - right,
    maximumDelta,
  };
}
