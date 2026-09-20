import { deriveContourHeightfield } from "./lib/contour-heightfield.mjs";

const bounds = {
  minX: 0,
  maxX: 20,
  minZ: 0,
  maxZ: 20,
};

const config = {
  method: "contour-constrained-harmonic-grid",
  gridSpacing: 2.5,
  contourSampleSpacing: 1.25,
  maxIterations: 2500,
  tolerance: 0.0001,
  verticalDatum: "minimum-derived-elevation",
};

const contours = [
  {
    id: "south-0m",
    elevation: 0,
    points: [
      [0, 0],
      [20, 0],
    ],
  },
  {
    id: "north-20m",
    elevation: 20,
    points: [
      [0, 20],
      [20, 20],
    ],
  },
];

const terrain = deriveContourHeightfield({
  contours,
  bounds,
  config,
  source: "synthetic test contours",
});

const index = (column, row) =>
  row * terrain.grid.columns + column;
const south = terrain.heights[index(4, 0)];
const middle = terrain.heights[index(4, 4)];
const north = terrain.heights[index(4, 8)];

const failures = [];

if (Math.abs(south - 0) > 0.001) {
  failures.push(`south fixed contour moved to ${south} m`);
}

if (Math.abs(north - 20) > 0.001) {
  failures.push(`north fixed contour moved to ${north} m`);
}

if (Math.abs(middle - 10) > 0.15) {
  failures.push(
    `midpoint should be approximately 10 m, got ${middle} m`,
  );
}

for (const height of terrain.heights) {
  if (!Number.isFinite(height)) {
    failures.push("terrain contains a non-finite height");
    break;
  }

  if (height < -0.001 || height > 20.001) {
    failures.push(
      `terrain height ${height} m escaped the constrained range`,
    );
    break;
  }
}

if (terrain.grid.columns !== 9 || terrain.grid.rows !== 9) {
  failures.push(
    `expected 9 x 9 grid, got ${terrain.grid.columns} x ${terrain.grid.rows}`,
  );
}

if (failures.length > 0) {
  console.error("Contour heightfield test failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    [
      "Contour heightfield test passed.",
      `south=${south} m,`,
      `middle=${middle} m,`,
      `north=${north} m.`,
    ].join(" "),
  );
}
