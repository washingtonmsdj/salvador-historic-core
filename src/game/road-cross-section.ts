import {
  gradeRoadCrossSection,
} from "./road-grading";
import { roadOffset } from "./road-path";
import { terrainHeight } from "./terrain";
import type {
  LinearFeature,
  Point2,
  SceneLevels,
  TerrainConfig,
} from "./types";

export interface RoadCrossSectionPolicy {
  maxMiterScale: number;
  maxCrossSlope: number;
  maxSupportedFillHeight: number;
  surfaceGap: number;
}

export interface RoadEdgeSample {
  x: number;
  z: number;
  terrainY: number;
  surfaceY: number;
  supportHeight: number;
}

export interface RoadCrossSectionSample {
  center: Point2;
  crossSpan: number;
  left: RoadEdgeSample;
  right: RoadEdgeSample;
  regularized: boolean;
  requiredFill: number;
  resultingDelta: number;
}

function baseElevationAt(
  feature: LinearFeature,
  terrain: TerrainConfig,
  levels: SceneLevels,
  x: number,
  z: number,
) {
  if (
    feature.elevationMode ===
    "upper"
  ) {
    return levels.upperCity
      .elevation;
  }

  if (
    feature.elevationMode ===
    "lower"
  ) {
    return levels.lowerCity
      .elevation;
  }

  return terrainHeight(
    terrain,
    levels,
    x,
    z,
  );
}

export function sampleRoadCrossSection({
  feature,
  centers,
  index,
  terrain,
  levels,
  policy,
  longitudinalLift = 0,
}: {
  feature: LinearFeature;
  centers: Point2[];
  index: number;
  terrain: TerrainConfig;
  levels: SceneLevels;
  policy: RoadCrossSectionPolicy;
  longitudinalLift?: number;
}): RoadCrossSectionSample | null {
  const center =
    centers[index];
  if (!center) {
    return null;
  }

  const halfWidth = Math.max(
    0.5,
    feature.width / 2,
  );
  const offset = roadOffset(
    centers,
    index,
    halfWidth,
    policy.maxMiterScale,
  );
  const leftX =
    center[0] + offset[0];
  const leftZ =
    center[1] + offset[1];
  const rightX =
    center[0] - offset[0];
  const rightZ =
    center[1] - offset[1];
  const leftTerrain =
    baseElevationAt(
      feature,
      terrain,
      levels,
      leftX,
      leftZ,
    );
  const rightTerrain =
    baseElevationAt(
      feature,
      terrain,
      levels,
      rightX,
      rightZ,
    );
  const crossSpan = Math.max(
    0.001,
    Math.hypot(
      leftX - rightX,
      leftZ - rightZ,
    ),
  );
  const graded =
    gradeRoadCrossSection({
      leftTerrain,
      rightTerrain,
      longitudinalLift,
      crossSpan,
      maxCrossSlope:
        policy.maxCrossSlope,
      maxSupportedFillHeight:
        policy.maxSupportedFillHeight,
      surfaceGap:
        policy.surfaceGap,
    });

  return {
    center,
    crossSpan,
    left: {
      x: leftX,
      z: leftZ,
      terrainY: leftTerrain,
      surfaceY:
        graded.leftY,
      supportHeight:
        graded.leftSupportHeight,
    },
    right: {
      x: rightX,
      z: rightZ,
      terrainY: rightTerrain,
      surfaceY:
        graded.rightY,
      supportHeight:
        graded.rightSupportHeight,
    },
    regularized:
      graded.regularized,
    requiredFill:
      graded.requiredFill,
    resultingDelta:
      graded.resultingDelta,
  };
}
