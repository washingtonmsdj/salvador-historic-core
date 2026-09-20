import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const data = JSON.parse(
  await readFile(resolve(root, "src/data/site-data.json"), "utf8"),
);

const errors = [];
const terrain = data.terrain;
const bounds = terrain?.bounds;
const origin = data.metadata?.origin;

function fail(message) {
  errors.push(message);
}

if (!bounds) {
  fail("terrain.bounds is required");
} else {
  if (bounds.minX !== -bounds.maxX) {
    fail("terrain X bounds must stay symmetric around Elevador local X=0");
  }
  if (bounds.minZ !== -bounds.maxZ) {
    fail("terrain Z bounds must stay symmetric around Elevador local Z=0");
  }
}

if (!origin || origin.local?.[0] !== 0 || origin.local?.[2] !== 0) {
  fail("Elevador Lacerda local origin must remain at X=0, Z=0");
}

if (!Number.isFinite(terrain?.presentation?.baseY)) {
  fail("terrain.presentation.baseY must be finite");
} else if (terrain.presentation.baseY >= data.levels.lowerCity.elevation) {
  fail("terrain base must be below the lower-city datum");
}

if (
  !Number.isFinite(terrain?.presentation?.contourInterval) ||
  terrain.presentation.contourInterval <= 0
) {
  fail("terrain.presentation.contourInterval must be greater than zero");
}

if (
  !Number.isFinite(terrain?.presentation?.cliffOverlayOffset) ||
  terrain.presentation.cliffOverlayOffset < 0
) {
  fail("terrain.presentation.cliffOverlayOffset must be zero or greater");
}

const profiles = terrain?.profiles ?? [];
if (bounds && profiles.length > 0) {
  const first = profiles[0];
  const last = profiles[profiles.length - 1];
  if (!first || first.z > bounds.minZ) {
    fail("terrain profiles must cover the south edge of the perimeter");
  }
  if (!last || last.z < bounds.maxZ) {
    fail("terrain profiles must cover the north edge of the perimeter");
  }
}

function checkPoint(id, x, z) {
  if (!bounds) return;
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
    fail(`${id} lies outside terrain perimeter at [${x}, ${z}]`);
  }
}

for (const item of [
  ...(data.buildings ?? []),
  ...(data.elevator ?? []),
  ...(data.landmarks ?? []),
]) {
  if (item.footprint?.length) {
    for (const [x, z] of item.footprint) {
      checkPoint(item.id, x, z);
    }
  } else if (item.position?.length >= 3) {
    checkPoint(item.id, item.position[0], item.position[2]);
  }
}

for (const collection of [data.roads ?? [], data.spaces ?? []]) {
  for (const feature of collection) {
    for (const [x, z] of feature.points ?? []) {
      checkPoint(feature.id, x, z);
    }
  }
}

if (errors.length > 0) {
  console.error("Terrain data validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Terrain data valid: centered perimeter ${bounds.minX}..${bounds.maxX} x ${bounds.minZ}..${bounds.maxZ} m`,
  );
}
