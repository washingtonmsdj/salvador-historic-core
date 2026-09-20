import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const site = JSON.parse(
  await readFile(
    resolve(
      root,
      "src/data/site-data.json",
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

const config = site.terrain;
const presentation =
  config.presentation;
const renderSpacing =
  config.tileSize /
  config.subdivisionsPerTile;
const sourceSpacing =
  terrain.grid?.spacing;
const errors = [];

function fail(message) {
  errors.push(message);
}

if (
  sourceSpacing !== 2.5
) {
  fail(
    `Persistent terrain source spacing must remain 2.5 m, got ${sourceSpacing}.`,
  );
}

if (
  renderSpacing >
  1.25 + 0.000001
) {
  fail(
    `Third-person terrain render spacing must be <= 1.25 m, got ${renderSpacing}.`,
  );
}

if (
  renderSpacing >=
  sourceSpacing
) {
  fail(
    "Render mesh must interpolate the persistent source more densely than the source grid.",
  );
}

if (
  presentation.textureResolution <
  512 ||
  presentation.detailTextureResolution <
  512
) {
  fail(
    "Terrain PBR textures must remain at least 512 px.",
  );
}

if (
  presentation.detailTextureTiling <
  16
) {
  fail(
    "Terrain detail tiling is too low for close third-person viewing.",
  );
}

if (
  presentation.macroVariationScale >
  96 ||
  presentation.macroVariationStrength <
  0.15
) {
  fail(
    "Terrain macro variation must remain visible at gameplay distance.",
  );
}

if (
  presentation.rockBlendNormalYBand <
  0.1
) {
  fail(
    "Cliff material blend band is too narrow and will create hard terrain seams.",
  );
}

if (errors.length > 0) {
  console.error(
    "Terrain presentation test failed:",
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
          "Terrain presentation contract passed.",
        sourceSpacingMeters:
          sourceSpacing,
        renderSpacingMeters:
          renderSpacing,
        textureResolution:
          presentation.textureResolution,
        detailTextureResolution:
          presentation.detailTextureResolution,
        detailTextureTiling:
          presentation.detailTextureTiling,
      },
      null,
      2,
    ),
  );
}
