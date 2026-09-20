import manifest from "../geospatial/manifest.json";
import vectorsData from "../geospatial/derived/site-vectors.json";
import siteData from "../src/data/site-data.json";
import {
  gradeRoadCrossSection,
} from "../src/game/road-grading";
import {
  roadOffset,
  samplePolyline,
} from "../src/game/road-path";
import { terrainHeight } from "../src/game/terrain";
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
const critical =
  manifest.vectorDerivation
    .criticalRoadNames;

const failures: string[] = [];
const report: Array<{
  name: string;
  samples: number;
  supports: number;
  maxSupport: number;
  maxCrossSlope: number;
}> = [];

const grouped = new Map<
  string,
  LinearFeature[]
>();

for (const road of vectors.roads) {
  const key =
    road.name ||
    road.id;
  const group =
    grouped.get(key) ?? [];
  group.push(road);
  grouped.set(key, group);
}

for (const name of critical) {
  if (
    !vectors.roads.some(
      (road) =>
        road.name === name,
    )
  ) {
    failures.push(
      `${name}: no derived OSM ways`,
    );
  }
}

for (const [name, roads] of grouped) {

  let samples = 0;
  let supports = 0;
  let maxSupport = 0;
  let maxCrossSlope = 0;

  for (const road of roads) {
    const centers =
      samplePolyline(
        road.points,
        policy.sampleSpacing,
      );

    for (
      let index = 0;
      index < centers.length;
      index++
    ) {
      const center =
        centers[index];
      if (!center) {
        continue;
      }

      const offset =
        roadOffset(
          centers,
          index,
          Math.max(
            0.5,
            road.width / 2,
          ),
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
        terrainHeight(
          data.terrain,
          data.levels,
          leftX,
          leftZ,
        );
      const rightTerrain =
        terrainHeight(
          data.terrain,
          data.levels,
          rightX,
          rightZ,
        );
      const crossSpan =
        Math.max(
          0.001,
          Math.hypot(
            leftX - rightX,
            leftZ - rightZ,
          ),
        );
      const section =
        gradeRoadCrossSection({
          leftTerrain,
          rightTerrain,
          longitudinalLift: 0,
          crossSpan,
          maxCrossSlope:
            policy.maxCrossSlope,
          maxSupportedFillHeight:
            policy.maxSupportedFillHeight,
          surfaceGap:
            policy.surfaceGap,
        });
      const crossSlope =
        Math.abs(
          section.resultingDelta,
        ) / crossSpan;
      const support =
        Math.max(
          section.leftSupportHeight,
          section.rightSupportHeight,
        );

      samples += 1;
      if (
        support >=
        policy.supportWallThreshold
      ) {
        supports += 1;
      }
      maxSupport = Math.max(
        maxSupport,
        support,
      );
      maxCrossSlope = Math.max(
        maxCrossSlope,
        crossSlope,
      );

      if (
        crossSlope >
        policy.maxCrossSlope +
          0.000001
      ) {
        failures.push(
          `${name}: cross slope ${(
            crossSlope * 100
          ).toFixed(
            2,
          )}% exceeds ${(
            policy.maxCrossSlope *
            100
          ).toFixed(
            2,
          )}% at ${center.join(
            ",",
          )}; required fill ${section.requiredFill.toFixed(
            2,
          )} m exceeds supported bench capacity`,
        );
      }

      if (
        section.leftY <
          leftTerrain +
            policy.surfaceGap -
            0.000001 ||
        section.rightY <
          rightTerrain +
            policy.surfaceGap -
            0.000001
      ) {
        failures.push(
          `${name}: road surface cut below official terrain at ${center.join(
            ",",
          )}`,
        );
      }
    }
  }

  report.push({
    name,
    samples,
    supports,
    maxSupport: Number(
      maxSupport.toFixed(3),
    ),
    maxCrossSlope: Number(
      (
        maxCrossSlope * 100
      ).toFixed(3),
    ),
  });
}

const mountain =
  report.find(
    (entry) =>
      entry.name ===
      "Ladeira da Montanha",
  );

if (
  !mountain ||
  mountain.supports === 0 ||
  mountain.maxSupport < 1
) {
  failures.push(
    "Ladeira da Montanha must exercise the retaining-bench path on official terrain.",
  );
}

if (failures.length > 0) {
  console.error(
    "Road terrain-fit test failed:",
  );
  for (const failure of failures) {
    console.error(
      "- " + failure,
    );
  }
  console.error(
    JSON.stringify(
      report,
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  console.log(
    "Road terrain-fit test passed for all derived roads.",
  );
  console.log(
    JSON.stringify(
      report,
      null,
      2,
    ),
  );
}
