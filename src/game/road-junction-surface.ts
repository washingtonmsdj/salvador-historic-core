import type {
  RoadJunction,
} from "./road-junctions";
import {
  sampleRoadCrossSection,
} from "./road-cross-section";
import {
  deriveRoadSurfaceProfile,
} from "./road-surface-profile";
import {
  fitBoundedSurfacePlane,
  surfacePlaneHeight,
  type PlaneObservation,
  type SurfacePlane,
} from "./surface-plane";
import { terrainHeight } from "./terrain";
import type {
  SceneLevels,
  TerrainConfig,
} from "./types";

export interface RoadJunctionSurfacePolicy {
  roadSampleSpacing: number;
  maxMiterScale: number;
  maxCrossSlope: number;
  maxSupportedFillHeight: number;
  surfaceGap: number;
  maxLongitudinalSlope: number;
  maxProfileIterations: number;
  junctionSurfaceOffset: number;
  junctionMaxSegments: number;
  junctionMaxSlope: number;
  junctionMaxCut: number;
  junctionMaxFill: number;
}

export interface RoadJunctionPerimeterPoint {
  x: number;
  z: number;
  topY: number;
  terrainY: number;
  verticalOffset: number;
}

export interface RoadJunctionSurface {
  valid: boolean;
  plane: SurfacePlane;
  segments: number;
  roadObservations: PlaneObservation[];
  perimeter: RoadJunctionPerimeterPoint[];
  centerY: number;
  maxCut: number;
  maxFill: number;
  maxRoadEdgeDelta: number;
}

function distance(
  a: readonly [number, number],
  b: readonly [number, number],
) {
  return Math.hypot(
    b[0] - a[0],
    b[1] - a[1],
  );
}

function endpointObservations(
  junction: RoadJunction,
  terrain: TerrainConfig,
  levels: SceneLevels,
  policy: RoadJunctionSurfacePolicy,
) {
  return junction.connectedFeatures.flatMap(
    (feature): PlaneObservation[] => {
      if (
        feature.points.length < 2
      ) {
        return [];
      }

      const first =
        feature.points[0];
      const last =
        feature.points[
          feature.points.length - 1
        ];
      if (!first || !last) {
        return [];
      }

      const endpointIndex =
        distance(
          first,
          junction.center,
        ) <=
        distance(
          last,
          junction.center,
        )
          ? 0
          : feature.points.length -
            1;
      const profile =
        deriveRoadSurfaceProfile({
          feature,
          terrain,
          levels,
          policy: {
            sampleSpacing:
              policy.roadSampleSpacing,
            maxMiterScale:
              policy.maxMiterScale,
            maxCrossSlope:
              policy.maxCrossSlope,
            maxSupportedFillHeight:
              policy.maxSupportedFillHeight,
            surfaceGap:
              policy.surfaceGap,
            maxLongitudinalSlope:
              policy.maxLongitudinalSlope,
            maxProfileIterations:
              policy.maxProfileIterations,
          },
        });
      const profileIndex =
        endpointIndex === 0
          ? 0
          : profile.samples.length - 1;
      const section =
        (profile.valid
          ? profile.samples[
              profileIndex
            ]
          : null) ??
        sampleRoadCrossSection({
          feature,
          centers:
            feature.points,
          index: endpointIndex,
          terrain,
          levels,
          longitudinalLift: 0,
          policy: {
            maxMiterScale:
              policy.maxMiterScale,
            maxCrossSlope:
              policy.maxCrossSlope,
            maxSupportedFillHeight:
              policy.maxSupportedFillHeight,
            surfaceGap:
              policy.surfaceGap,
          },
        });

      if (!section) {
        return [];
      }

      return [
        {
          x: section.left.x,
          z: section.left.z,
          y:
            section.left
              .surfaceY,
        },
        {
          x: section.right.x,
          z: section.right.z,
          y:
            section.right
              .surfaceY,
        },
      ];
    },
  );
}

export function deriveRoadJunctionSurface(
  junction: RoadJunction,
  terrain: TerrainConfig,
  levels: SceneLevels,
  policy: RoadJunctionSurfacePolicy,
): RoadJunctionSurface | null {
  const observations =
    endpointObservations(
      junction,
      terrain,
      levels,
      policy,
    );
  const plane =
    fitBoundedSurfacePlane(
      observations,
      policy.junctionMaxSlope,
    );

  if (!plane) {
    return null;
  }

  const segments = Math.max(
    12,
    Math.min(
      policy.junctionMaxSegments,
      Math.ceil(
        (Math.PI *
          2 *
          junction.radius) /
          policy.roadSampleSpacing,
      ),
    ),
  );
  const [centerX, centerZ] =
    junction.center;
  const perimeter:
    RoadJunctionPerimeterPoint[] =
    [];
  let maxCut = 0;
  let maxFill = 0;

  const sampleTerrainDelta = (
    x: number,
    z: number,
  ) => {
    const terrainY =
      terrainHeight(
        terrain,
        levels,
        x,
        z,
      );
    const topY =
      surfacePlaneHeight(
        plane,
        x,
        z,
      );
    const referenceTerrainY =
      terrainY +
      policy.surfaceGap +
      policy.junctionSurfaceOffset;
    const verticalOffset =
      topY -
      referenceTerrainY;

    maxFill = Math.max(
      maxFill,
      verticalOffset,
    );
    maxCut = Math.max(
      maxCut,
      -verticalOffset,
    );

    return {
      terrainY,
      topY,
      verticalOffset,
    };
  };

  const center =
    sampleTerrainDelta(
      centerX,
      centerZ,
    );

  for (
    let segment = 0;
    segment < segments;
    segment++
  ) {
    const angle =
      (segment / segments) *
      Math.PI *
      2;
    const x =
      centerX +
      Math.cos(angle) *
        junction.radius;
    const z =
      centerZ +
      Math.sin(angle) *
        junction.radius;
    const sample =
      sampleTerrainDelta(
        x,
        z,
      );

    perimeter.push({
      x,
      z,
      topY: sample.topY,
      terrainY:
        sample.terrainY,
      verticalOffset:
        sample.verticalOffset,
    });
  }

  const maxRoadEdgeDelta =
    observations.reduce(
      (maximum, observation) =>
        Math.max(
          maximum,
          Math.abs(
            surfacePlaneHeight(
              plane,
              observation.x,
              observation.z,
            ) -
              observation.y,
          ),
        ),
      0,
    );

  return {
    valid:
      maxCut <=
        policy.junctionMaxCut +
          0.000001 &&
      maxFill <=
        policy.junctionMaxFill +
          0.000001,
    plane,
    segments,
    roadObservations:
      observations,
    perimeter,
    centerY:
      center.topY,
    maxCut,
    maxFill,
    maxRoadEdgeDelta,
  };
}
