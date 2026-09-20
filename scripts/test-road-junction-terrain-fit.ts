import manifest from "../geospatial/manifest.json";
import vectorsData from "../geospatial/derived/site-vectors.json";
import siteData from "../src/data/site-data.json";
import {
  deriveRoadJunctions,
} from "../src/game/road-junctions";
import {
  deriveRoadJunctionSurface,
} from "../src/game/road-junction-surface";
import type {
  LinearFeature,
  SceneLevels,
  TerrainConfig,
} from "../src/game/types";

const vectors =
  vectorsData as unknown as {
    roads: LinearFeature[];
  };
const data =
  siteData as unknown as {
    terrain: TerrainConfig;
    levels: SceneLevels;
  };
const policy =
  manifest.roadSurfacePolicy;

const junctions =
  deriveRoadJunctions(
    vectors.roads,
    {
      snapDistance:
        policy.junctionSnapDistance,
      overlap:
        policy.junctionOverlap,
    },
  );

if (junctions.length === 0) {
  throw new Error(
    "Expected derived road junctions.",
  );
}

const failures: string[] = [];
let maxCut = 0;
let maxFill = 0;
let maxSlope = 0;
let maxEdgeDelta = 0;
let supportedJunctions = 0;

for (const junction of junctions) {
  const surface =
    deriveRoadJunctionSurface(
      junction,
      data.terrain,
      data.levels,
      {
        roadSampleSpacing:
          policy.sampleSpacing,
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
          policy.longitudinalProfileIterations,
        profileFallbackOsmIds:
          policy.longitudinalProfileFallbackOsmIds,
        junctionSurfaceOffset:
          policy.junctionSurfaceOffset,
        junctionMaxSegments:
          policy.junctionMaxSegments,
        junctionMaxSlope:
          policy.junctionMaxSlope,
        junctionMaxCut:
          policy.junctionMaxCut,
        junctionMaxFill:
          policy.junctionMaxFill,
      },
    );

  if (!surface) {
    failures.push(
      `${junction.id}: unable to derive junction surface`,
    );
    continue;
  }

  if (!surface.valid) {
    failures.push(
      `${junction.id}: cut/fill exceeds policy (cut=${surface.maxCut.toFixed(
        3,
      )}, fill=${surface.maxFill.toFixed(
        3,
      )})`,
    );
  }

  if (
    surface.plane.slope >
    policy.junctionMaxSlope +
      0.000001
  ) {
    failures.push(
      `${junction.id}: slope exceeds policy`,
    );
  }

  if (
    surface.maxRoadEdgeDelta >
    policy.junctionMaxRoadEdgeDelta +
      0.000001
  ) {
    failures.push(
      `${junction.id}: edge delta ${surface.maxRoadEdgeDelta.toFixed(
        3,
      )} m exceeds ${policy.junctionMaxRoadEdgeDelta.toFixed(
        3,
      )} m`,
    );
  }

  if (
    surface.perimeter.some(
      (point) =>
        Math.abs(
          point.verticalOffset,
        ) >=
        policy.supportWallThreshold,
    )
  ) {
    supportedJunctions += 1;
  }

  maxCut = Math.max(
    maxCut,
    surface.maxCut,
  );
  maxFill = Math.max(
    maxFill,
    surface.maxFill,
  );
  maxSlope = Math.max(
    maxSlope,
    surface.plane.slope,
  );
  maxEdgeDelta = Math.max(
    maxEdgeDelta,
    surface.maxRoadEdgeDelta,
  );
}

if (supportedJunctions === 0) {
  failures.push(
    "Expected at least one real junction to require a retaining/cut perimeter wall.",
  );
}

if (failures.length > 0) {
  console.error(
    "Road junction terrain-fit test failed:",
  );
  for (const failure of failures) {
    console.error(
      "- " + failure,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    "Road junction terrain-fit test passed.",
  );
  console.log(
    JSON.stringify(
      {
        junctionCount:
          junctions.length,
        supportedJunctions,
        maxCut: Number(
          maxCut.toFixed(3),
        ),
        maxFill: Number(
          maxFill.toFixed(3),
        ),
        maxSlopePct: Number(
          (
            maxSlope * 100
          ).toFixed(3),
        ),
        maxRoadEdgeDelta:
          Number(
            maxEdgeDelta.toFixed(
              3,
            ),
          ),
      },
      null,
      2,
    ),
  );
}
