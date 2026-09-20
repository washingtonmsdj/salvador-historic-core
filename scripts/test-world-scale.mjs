import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const runtime = JSON.parse(
  await readFile(
    resolve(
      root,
      "src/data/geospatial-base.json",
    ),
    "utf8",
  ),
);
const terrain = JSON.parse(
  await readFile(
    resolve(
      root,
      "geospatial/derived/terrain.json",
    ),
    "utf8",
  ),
);
const vectors = JSON.parse(
  await readFile(
    resolve(
      root,
      "geospatial/derived/site-vectors.json",
    ),
    "utf8",
  ),
);

const errors = [];
const fail = (message) =>
  errors.push(message);
const near = (
  a,
  b,
  tolerance = 0.01,
) =>
  Math.abs(a - b) <=
  tolerance;

if (
  runtime.crs !==
  "EPSG:32724"
) {
  fail(
    "World CRS must remain EPSG:32724.",
  );
}

if (
  runtime.units !==
  "meters"
) {
  fail(
    "World units must remain metres.",
  );
}

const perimeter =
  runtime.perimeter;
const width =
  perimeter.maxX -
  perimeter.minX;
const depth =
  perimeter.maxZ -
  perimeter.minZ;

if (
  !near(width, 300) ||
  !near(depth, 600)
) {
  fail(
    `Expected a 300 m × 600 m local project perimeter, got ${width} × ${depth}.`,
  );
}

for (
  const [name, corner] of
    Object.entries(
      runtime.geographicCorners,
    )
) {
  const expectedX =
    corner.easting -
    runtime.origin.easting;
  const expectedZ =
    corner.northing -
    runtime.origin.northing;

  if (
    !near(
      corner.local[0],
      expectedX,
    ) ||
    !near(
      corner.local[1],
      expectedZ,
    )
  ) {
    fail(
      `${name} does not preserve the 1 local unit = 1 UTM metre contract.`,
    );
  }
}

if (
  !near(
    terrain.bounds.minX,
    perimeter.minX,
  ) ||
  !near(
    terrain.bounds.maxX,
    perimeter.maxX,
  ) ||
  !near(
    terrain.bounds.minZ,
    perimeter.minZ,
  ) ||
  !near(
    terrain.bounds.maxZ,
    perimeter.maxZ,
  )
) {
  fail(
    "Derived terrain bounds do not match the metric world perimeter.",
  );
}

if (
  terrain.grid?.spacing !==
  2.5
) {
  fail(
    `Persistent terrain spacing must remain 2.5 m, got ${terrain.grid?.spacing}.`,
  );
}

const inBounds = ([x, z]) =>
  x >=
    perimeter.minX -
      0.001 &&
  x <=
    perimeter.maxX +
      0.001 &&
  z >=
    perimeter.minZ -
      0.001 &&
  z <=
    perimeter.maxZ +
      0.001;

for (const road of vectors.roads ?? []) {
  if (
    !road.points.every(
      inBounds,
    )
  ) {
    fail(
      `${road.id} contains road geometry outside the metric perimeter.`,
    );
  }
}

for (
  const building of
    vectors.buildingFootprints ?? []
) {
  if (
    !building.footprint.every(
      inBounds,
    )
  ) {
    fail(
      `${building.id} contains a building footprint outside the metric perimeter.`,
    );
  }
}

if (errors.length > 0) {
  console.error(
    "World scale test failed:",
  );
  for (const error of errors) {
    console.error(
      "- " + error,
    );
  }
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        result:
          "World scale contract passed.",
        crs:
          runtime.crs,
        units:
          runtime.units,
        perimeterMeters: {
          width,
          depth,
        },
        terrainGridMeters:
          terrain.grid.spacing,
        roads:
          vectors.roads?.length ??
          0,
        buildings:
          vectors
            .buildingFootprints
            ?.length ?? 0,
      },
      null,
      2,
    ),
  );
}
