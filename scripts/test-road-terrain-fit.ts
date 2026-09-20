import manifest from "../geospatial/manifest.json";
import vectorsData from "../geospatial/derived/site-vectors.json";
import siteData from "../src/data/site-data.json";
import {
  deriveRoadSurfaceProfile,
} from "../src/game/road-surface-profile";
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
const critical = new Set(
  manifest.vectorDerivation
    .criticalRoadNames,
);
const configuredFallbacks =
  new Set(
    policy.longitudinalProfileFallbackOsmIds,
  );
const observedFallbacks =
  new Set<number>();
const failures: string[] = [];
const report: Array<{
  name: string;
  id: string;
  valid: boolean;
  regularized: boolean;
  samples: number;
  maxSupport: number;
  maxCrossSlopePct: number;
  maxLongitudinalSlopePct: number;
}> = [];

for (const road of vectors.roads) {
  const profile =
    deriveRoadSurfaceProfile({
      feature: road,
      terrain: data.terrain,
      levels: data.levels,
      policy: {
        sampleSpacing:
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
      },
    });
  const osmId = road.osmId;

  report.push({
    name: road.name,
    id: road.id,
    valid: profile.valid,
    regularized:
      profile.regularized,
    samples:
      profile.samples.length,
    maxSupport: Number(
      profile.maxSupportHeight.toFixed(
        3,
      ),
    ),
    maxCrossSlopePct: Number(
      (
        profile.maxCrossSlope *
        100
      ).toFixed(3),
    ),
    maxLongitudinalSlopePct:
      Number(
        (
          profile.maxLongitudinalSlope *
          100
        ).toFixed(3),
      ),
  });

  if (!profile.valid) {
    if (critical.has(road.name)) {
      failures.push(
        \`\${road.name} (\${road.id}): critical road requires profile fallback\`,
      );
    }

    if (
      typeof osmId !== "number" ||
      !configuredFallbacks.has(osmId)
    ) {
      failures.push(
        \`\${road.name} (\${road.id}): unapproved longitudinal profile fallback\`,
      );
    } else {
      observedFallbacks.add(osmId);
    }
    continue;
  }

  if (
    typeof osmId === "number" &&
    configuredFallbacks.has(osmId)
  ) {
    failures.push(
      \`\${road.name} (\${road.id}): profile is now valid; remove stale fallback exception \${osmId}\`,
    );
  }

  if (
    profile.maxSupportHeight >
    policy.maxSupportedFillHeight +
      0.000001
  ) {
    failures.push(
      \`\${road.name} (\${road.id}): support \${profile.maxSupportHeight.toFixed(3)} m exceeds policy\`,
    );
  }
  if (
    profile.maxCrossSlope >
    policy.maxCrossSlope + 0.000001
  ) {
    failures.push(
      \`\${road.name} (\${road.id}): cross slope exceeds policy\`,
    );
  }
  if (
    profile.maxLongitudinalSlope >
    policy.maxLongitudinalSlope +
      0.000001
  ) {
    failures.push(
      \`\${road.name} (\${road.id}): longitudinal slope exceeds policy\`,
    );
  }
}

for (const osmId of configuredFallbacks) {
  if (!observedFallbacks.has(osmId)) {
    failures.push(
      \`Configured longitudinal fallback OSM \${osmId} was not observed as invalid\`,
    );
  }
}

for (const name of critical) {
  const matches = report.filter(
    (entry) => entry.name === name,
  );
  if (matches.length === 0) {
    failures.push(
      \`\${name}: no derived OSM ways\`,
    );
  }
  if (
    matches.some(
      (entry) => !entry.valid,
    )
  ) {
    failures.push(
      \`\${name}: every critical way must use the constrained walkable profile\`,
    );
  }
}

const mountain = report.filter(
  (entry) =>
    entry.name ===
    "Ladeira da Montanha",
);
if (
  mountain.length === 0 ||
  !mountain.some(
    (entry) =>
      entry.regularized &&
      entry.maxSupport >= 1,
  )
) {
  failures.push(
    "Ladeira da Montanha must exercise constrained longitudinal grading and retaining support.",
  );
}

if (failures.length > 0) {
  console.error(
    "Road terrain-fit test failed:",
  );
  for (const failure of failures) {
    console.error("- " + failure);
  }
  console.error(
    JSON.stringify(report, null, 2),
  );
  process.exitCode = 1;
} else {
  const validCount = report.filter(
    (entry) => entry.valid,
  ).length;
  console.log(
    "Road terrain-fit test passed for the rendered surface profile.",
  );
  console.log(
    JSON.stringify(
      {
        roadCount: report.length,
        constrainedProfiles:
          validCount,
        explicitFallbacks:
          report.length -
          validCount,
        maxSupport: Math.max(
          ...report
            .filter(
              (entry) =>
                entry.valid,
            )
            .map(
              (entry) =>
                entry.maxSupport,
            ),
        ),
        critical: report.filter(
          (entry) =>
            critical.has(
              entry.name,
            ),
        ),
      },
      null,
      2,
    ),
  );
}
