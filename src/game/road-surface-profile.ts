import {
  sampleRoadCrossSection,
  type RoadCrossSectionPolicy,
  type RoadCrossSectionSample,
} from "./road-cross-section";
import { samplePolyline } from "./road-path";
import type {
  LinearFeature,
  SceneLevels,
  TerrainConfig,
} from "./types";

export interface RoadSurfaceProfilePolicy
  extends RoadCrossSectionPolicy {
  sampleSpacing: number;
  maxLongitudinalSlope: number;
  maxProfileIterations: number;
  fallbackOsmIds: readonly number[];
}

export interface RoadSurfaceProfile {
  valid: boolean;
  configuredFallback: boolean;
  converged: boolean;
  regularized: boolean;
  centers: [number, number][];
  samples: RoadCrossSectionSample[];
  maxSupportHeight: number;
  maxCrossSlope: number;
  maxLongitudinalSlope: number;
}

const EPSILON = 0.000001;

function edgeDistance(
  a: RoadCrossSectionSample,
  b: RoadCrossSectionSample,
  side: "left" | "right",
) {
  const from = a[side];
  const to = b[side];
  return Math.max(
    0.001,
    Math.hypot(
      to.x - from.x,
      to.z - from.z,
    ),
  );
}

function raiseTo(
  sample: RoadCrossSectionSample,
  side: "left" | "right",
  minimum: number,
) {
  const edge = sample[side];
  if (edge.surfaceY >= minimum - EPSILON) {
    return false;
  }

  edge.surfaceY = minimum;
  return true;
}

function enforceCrossSlope(
  samples: RoadCrossSectionSample[],
  maxCrossSlope: number,
) {
  let changed = false;

  for (const sample of samples) {
    const maximumDelta =
      sample.crossSpan *
      maxCrossSlope;
    const delta =
      sample.left.surfaceY -
      sample.right.surfaceY;

    if (delta > maximumDelta) {
      changed =
        raiseTo(
          sample,
          "right",
          sample.left.surfaceY -
            maximumDelta,
        ) || changed;
    } else if (delta < -maximumDelta) {
      changed =
        raiseTo(
          sample,
          "left",
          sample.right.surfaceY -
            maximumDelta,
        ) || changed;
    }
  }

  return changed;
}

function enforceLongitudinalSlope(
  samples: RoadCrossSectionSample[],
  side: "left" | "right",
  maxLongitudinalSlope: number,
) {
  let changed = false;

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (!previous || !current) continue;

    const maximumDrop =
      maxLongitudinalSlope *
      edgeDistance(previous, current, side);
    changed =
      raiseTo(
        current,
        side,
        previous[side].surfaceY -
          maximumDrop,
      ) || changed;
  }

  for (let index = samples.length - 2; index >= 0; index--) {
    const current = samples[index];
    const next = samples[index + 1];
    if (!current || !next) continue;

    const maximumDrop =
      maxLongitudinalSlope *
      edgeDistance(current, next, side);
    changed =
      raiseTo(
        current,
        side,
        next[side].surfaceY -
          maximumDrop,
      ) || changed;
  }

  return changed;
}

function finalizeSamples(
  samples: RoadCrossSectionSample[],
  policy: RoadSurfaceProfilePolicy,
) {
  let maxSupportHeight = 0;
  let maxCrossSlope = 0;
  let maxLongitudinalSlope = 0;

  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    if (!sample) continue;

    sample.left.supportHeight = Math.max(
      0,
      sample.left.surfaceY -
        (sample.left.terrainY +
          policy.surfaceGap),
    );
    sample.right.supportHeight = Math.max(
      0,
      sample.right.surfaceY -
        (sample.right.terrainY +
          policy.surfaceGap),
    );
    sample.resultingDelta =
      sample.left.surfaceY -
      sample.right.surfaceY;
    sample.regularized =
      sample.left.supportHeight > EPSILON ||
      sample.right.supportHeight > EPSILON;

    maxSupportHeight = Math.max(
      maxSupportHeight,
      sample.left.supportHeight,
      sample.right.supportHeight,
    );
    maxCrossSlope = Math.max(
      maxCrossSlope,
      Math.abs(sample.resultingDelta) /
        Math.max(0.001, sample.crossSpan),
    );

    if (index > 0) {
      const previous = samples[index - 1];
      if (!previous) continue;

      for (const side of ["left", "right"] as const) {
        maxLongitudinalSlope = Math.max(
          maxLongitudinalSlope,
          Math.abs(
            sample[side].surfaceY -
              previous[side].surfaceY,
          ) /
            edgeDistance(previous, sample, side),
        );
      }
    }
  }

  return {
    maxSupportHeight,
    maxCrossSlope,
    maxLongitudinalSlope,
  };
}

export function deriveRoadSurfaceProfile({
  feature,
  terrain,
  levels,
  policy,
}: {
  feature: LinearFeature;
  terrain: TerrainConfig;
  levels: SceneLevels;
  policy: RoadSurfaceProfilePolicy;
}): RoadSurfaceProfile {
  const centers = samplePolyline(
    feature.points,
    policy.sampleSpacing,
  );
  const samples = centers.flatMap(
    (_center, index) => {
      const section = sampleRoadCrossSection({
        feature,
        centers,
        index,
        terrain,
        levels,
        longitudinalLift: 0,
        policy,
      });
      return section ? [section] : [];
    },
  );

  if (
    centers.length < 2 ||
    samples.length !== centers.length
  ) {
    return {
      valid: false,
      configuredFallback: false,
      converged: false,
      regularized: false,
      centers,
      samples,
      maxSupportHeight: Number.POSITIVE_INFINITY,
      maxCrossSlope: Number.POSITIVE_INFINITY,
      maxLongitudinalSlope: Number.POSITIVE_INFINITY,
    };
  }

  const initial = samples.map((sample) => ({
    left: sample.left.surfaceY,
    right: sample.right.surfaceY,
  }));
  let converged = false;

  for (
    let iteration = 0;
    iteration < policy.maxProfileIterations;
    iteration++
  ) {
    let changed = enforceCrossSlope(
      samples,
      policy.maxCrossSlope,
    );
    changed =
      enforceLongitudinalSlope(
        samples,
        "left",
        policy.maxLongitudinalSlope,
      ) || changed;
    changed =
      enforceLongitudinalSlope(
        samples,
        "right",
        policy.maxLongitudinalSlope,
      ) || changed;

    if (!changed) {
      converged = true;
      break;
    }
  }

  enforceCrossSlope(
    samples,
    policy.maxCrossSlope,
  );
  enforceLongitudinalSlope(
    samples,
    "left",
    policy.maxLongitudinalSlope,
  );
  enforceLongitudinalSlope(
    samples,
    "right",
    policy.maxLongitudinalSlope,
  );
  enforceCrossSlope(
    samples,
    policy.maxCrossSlope,
  );

  const metrics = finalizeSamples(
    samples,
    policy,
  );
  const regularized = samples.some(
    (sample, index) => {
      const baseline = initial[index];
      return Boolean(
        baseline &&
          (sample.left.surfaceY >
            baseline.left + EPSILON ||
            sample.right.surfaceY >
              baseline.right + EPSILON),
      );
    },
  );
  const configuredFallback =
    typeof feature.osmId === "number" &&
    policy.fallbackOsmIds.includes(
      feature.osmId,
    );
  const valid =
    !configuredFallback &&
    metrics.maxSupportHeight <=
      policy.maxSupportedFillHeight + EPSILON &&
    metrics.maxCrossSlope <=
      policy.maxCrossSlope + EPSILON &&
    metrics.maxLongitudinalSlope <=
      policy.maxLongitudinalSlope + EPSILON;

  return {
    valid,
    configuredFallback,
    converged,
    regularized,
    centers,
    samples,
    ...metrics,
  };
}
