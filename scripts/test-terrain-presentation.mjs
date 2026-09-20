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
  1024 ||
  presentation.detailTextureResolution <
  512
) {
  fail(
    "Terrain PBR primary texture must remain at least 1024 px and detail texture at least 512 px.",
  );
}

if (
  presentation.detailTextureTiling <
  24
) {
  fail(
    "Terrain detail tiling is too low for close third-person viewing.",
  );
}

if (
  presentation.microVariationScale < 8 ||
  presentation.microVariationScale > 32 ||
  presentation.microVariationStrength < 0.04 ||
  presentation.microVariationStrength > 0.12
) {
  fail(
    "Terrain micro variation must stay in a close-range, subtle presentation band.",
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

if (
  presentation.cliffProjectionSharpness < 2 ||
  presentation.cliffProjectionSharpness > 8
) {
  fail(
    "Cliff projection sharpness must remain between 2 and 8 for stable continuous world projection.",
  );
}

if (
  presentation.toneMappingExposure < 0.85 ||
  presentation.toneMappingExposure > 1.3 ||
  presentation.toneMappingContrast < 1 ||
  presentation.toneMappingContrast > 1.3
) {
  fail(
    "Terrain tone-mapping controls are outside the conservative cinematic range.",
  );
}

if (
  presentation.atmosphereFogStart < 120 ||
  presentation.atmosphereFogStart > 320 ||
  presentation.atmosphereFogEnd < 500 ||
  presentation.atmosphereFogEnd > 900 ||
  presentation.atmosphereFogEnd -
      presentation.atmosphereFogStart <
    250 ||
  !Array.isArray(
    presentation.atmosphereFogColor,
  ) ||
  presentation.atmosphereFogColor.length !== 3 ||
  presentation.atmosphereFogColor.some(
    (channel) =>
      !Number.isFinite(channel) ||
      channel < 0 ||
      channel > 1,
  )
) {
  fail(
    "Terrain atmospheric perspective must remain subtle, distant and use a valid RGB fog color.",
  );
}

if (
  presentation.weatheringElevationMax <= 0 ||
  presentation.weatheringElevationMax > 30 ||
  presentation.weatheringConcavityRadius < 5 ||
  presentation.weatheringConcavityRadius > 20 ||
  presentation.weatheringStrength < 0.35 ||
  presentation.weatheringStrength > 0.8 ||
  presentation.weatheringMinNormalY < 0.6 ||
  presentation.weatheringMinNormalY > 0.9 ||
  presentation.weatheringOverlayOffset < 0.01 ||
  presentation.weatheringOverlayOffset > 0.06
) {
  fail(
    "Terrain weathering overlay settings are outside the conservative visual-only range.",
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
        macroVariationScale:
          presentation.macroVariationScale,
        microVariationScale:
          presentation.microVariationScale,
        weatheringElevationMax:
          presentation.weatheringElevationMax,
      },
      null,
      2,
    ),
  );
}
