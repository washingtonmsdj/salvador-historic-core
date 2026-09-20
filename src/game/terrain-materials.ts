import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { TerrainConfig } from "./types";

type Rgb = readonly [
  number,
  number,
  number,
];

type TerrainTextureStyle = {
  base: Rgb;
  variation: number;
  seed: number;
  striated: boolean;
  bumpStrength: number;
  bumpLevel: number;
  roughness: number;
  roughnessVariation: number;
  aoStrength: number;
  detailDiffuse: number;
  detailBump: number;
  detailRoughness: number;
};

type TerrainTextureSet = {
  albedo: DynamicTexture;
  normal: DynamicTexture;
  orm: DynamicTexture;
  detail: DynamicTexture;
};

const PRIMARY_SIZE = 512;
const DETAIL_SIZE = 256;
const DETAIL_TILING = 6;

function clamp01(
  value: number,
) {
  return Math.max(
    0,
    Math.min(1, value),
  );
}

function clampChannel(
  value: number,
) {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(value),
    ),
  );
}

function deterministicNoise(
  x: number,
  y: number,
  seed: number,
) {
  const value =
    Math.sin(
      x * 12.9898 +
        y * 78.233 +
        seed * 37.719,
    ) * 43758.5453;
  return value - Math.floor(value);
}

function octaveNoise(
  x: number,
  y: number,
  seed: number,
) {
  const macro =
    deterministicNoise(
      x / 48,
      y / 48,
      seed,
    );
  const coarse =
    deterministicNoise(
      x / 18,
      y / 18,
      seed + 13,
    );
  const medium =
    deterministicNoise(
      x / 7,
      y / 7,
      seed + 29,
    );
  const fine =
    deterministicNoise(
      x / 2.2,
      y / 2.2,
      seed + 47,
    );

  return (
    macro * 0.34 +
    coarse * 0.31 +
    medium * 0.23 +
    fine * 0.12
  );
}

function textureHeight(
  x: number,
  y: number,
  style: TerrainTextureStyle,
) {
  const base =
    octaveNoise(
      x,
      y,
      style.seed,
    ) -
    0.5;
  const directional =
    style.striated
      ? Math.sin(
          y * 0.16 +
            x * 0.025 +
            octaveNoise(
              x * 0.55,
              y * 0.22,
              style.seed + 71,
            ) *
              4.2,
        ) *
        0.22
      : 0;
  const micro =
    (
      deterministicNoise(
        x * 1.8,
        y * 1.8,
        style.seed + 101,
      ) -
      0.5
    ) *
    0.16;

  return (
    base +
    directional +
    micro
  );
}

function createDynamicTexture(
  scene: Scene,
  name: string,
  size: number,
) {
  const texture =
    new DynamicTexture(
      name,
      {
        width: size,
        height: size,
      },
      scene,
      false,
    );

  texture.wrapU =
    Texture.WRAP_ADDRESSMODE;
  texture.wrapV =
    Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;

  return texture;
}

function createPrimaryTextures(
  scene: Scene,
  name: string,
  style: TerrainTextureStyle,
) {
  const albedo =
    createDynamicTexture(
      scene,
      name + "-albedo",
      PRIMARY_SIZE,
    );
  const normal =
    createDynamicTexture(
      scene,
      name + "-normal",
      PRIMARY_SIZE,
    );
  const orm =
    createDynamicTexture(
      scene,
      name + "-orm",
      PRIMARY_SIZE,
    );

  const albedoContext =
    albedo.getContext();
  const normalContext =
    normal.getContext();
  const ormContext =
    orm.getContext();

  const albedoImage =
    albedoContext.getImageData(
      0,
      0,
      PRIMARY_SIZE,
      PRIMARY_SIZE,
    );
  const normalImage =
    normalContext.getImageData(
      0,
      0,
      PRIMARY_SIZE,
      PRIMARY_SIZE,
    );
  const ormImage =
    ormContext.getImageData(
      0,
      0,
      PRIMARY_SIZE,
      PRIMARY_SIZE,
    );

  const heights =
    new Float32Array(
      PRIMARY_SIZE *
        PRIMARY_SIZE,
    );

  for (
    let y = 0;
    y < PRIMARY_SIZE;
    y++
  ) {
    for (
      let x = 0;
      x < PRIMARY_SIZE;
      x++
    ) {
      const height =
        textureHeight(
          x,
          y,
          style,
        );
      const offset =
        (y * PRIMARY_SIZE + x) *
        4;
      const tintNoise =
        (
          deterministicNoise(
            x / 31,
            y / 31,
            style.seed + 191,
          ) -
          0.5
        ) *
        style.variation *
        0.55;
      const delta =
        height *
          style.variation +
        tintNoise;

      albedoImage.data[
        offset
      ] = clampChannel(
        style.base[0] +
          delta,
      );
      albedoImage.data[
        offset + 1
      ] = clampChannel(
        style.base[1] +
          delta * 0.94,
      );
      albedoImage.data[
        offset + 2
      ] = clampChannel(
        style.base[2] +
          delta * 0.82,
      );
      albedoImage.data[
        offset + 3
      ] = 255;

      const cavity =
        clamp01(
          0.5 -
            height * 0.7,
        );
      const roughness =
        clamp01(
          style.roughness +
            (
              deterministicNoise(
                x / 5,
                y / 5,
                style.seed + 211,
              ) -
              0.5
            ) *
              style.roughnessVariation +
            cavity * 0.055,
        );
      const ambientOcclusion =
        clamp01(
          1 -
            cavity *
              style.aoStrength,
        );

      ormImage.data[
        offset
      ] = clampChannel(
        ambientOcclusion *
          255,
      );
      ormImage.data[
        offset + 1
      ] = clampChannel(
        roughness * 255,
      );
      ormImage.data[
        offset + 2
      ] = 0;
      ormImage.data[
        offset + 3
      ] = 255;

      heights[
        y * PRIMARY_SIZE + x
      ] = height;
    }
  }

  const heightAt = (
    x: number,
    y: number,
  ) =>
    heights[
      Math.max(
        0,
        Math.min(
          PRIMARY_SIZE - 1,
          y,
        ),
      ) *
        PRIMARY_SIZE +
        Math.max(
          0,
          Math.min(
            PRIMARY_SIZE - 1,
            x,
          ),
        )
    ] ?? 0;

  for (
    let y = 0;
    y < PRIMARY_SIZE;
    y++
  ) {
    for (
      let x = 0;
      x < PRIMARY_SIZE;
      x++
    ) {
      const dx =
        (
          heightAt(
            x + 1,
            y,
          ) -
          heightAt(
            x - 1,
            y,
          )
        ) *
        style.bumpStrength;
      const dy =
        (
          heightAt(
            x,
            y + 1,
          ) -
          heightAt(
            x,
            y - 1,
          )
        ) *
        style.bumpStrength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const length =
        Math.max(
          0.000001,
          Math.hypot(
            nx,
            ny,
            nz,
          ),
        );
      const offset =
        (y * PRIMARY_SIZE + x) *
        4;

      normalImage.data[
        offset
      ] = clampChannel(
        nx /
          length *
          127.5 +
          127.5,
      );
      normalImage.data[
        offset + 1
      ] = clampChannel(
        ny /
          length *
          127.5 +
          127.5,
      );
      normalImage.data[
        offset + 2
      ] = clampChannel(
        nz /
          length *
          127.5 +
          127.5,
      );
      normalImage.data[
        offset + 3
      ] = 255;
    }
  }

  albedoContext.putImageData(
    albedoImage,
    0,
    0,
  );
  normalContext.putImageData(
    normalImage,
    0,
    0,
  );
  ormContext.putImageData(
    ormImage,
    0,
    0,
  );

  albedo.update(false);
  normal.update(false);
  orm.update(false);

  albedo.gammaSpace = true;
  normal.gammaSpace = false;
  orm.gammaSpace = false;
  normal.level =
    style.bumpLevel;

  return {
    albedo,
    normal,
    orm,
  };
}

function createDetailTexture(
  scene: Scene,
  name: string,
  style: TerrainTextureStyle,
) {
  const texture =
    createDynamicTexture(
      scene,
      name + "-detail",
      DETAIL_SIZE,
    );
  const context =
    texture.getContext();
  const image =
    context.getImageData(
      0,
      0,
      DETAIL_SIZE,
      DETAIL_SIZE,
    );
  const heights =
    new Float32Array(
      DETAIL_SIZE *
        DETAIL_SIZE,
    );

  for (
    let y = 0;
    y < DETAIL_SIZE;
    y++
  ) {
    for (
      let x = 0;
      x < DETAIL_SIZE;
      x++
    ) {
      const height =
        (
          deterministicNoise(
            x / 2,
            y / 2,
            style.seed + 301,
          ) -
          0.5
        ) *
          0.62 +
        (
          deterministicNoise(
            x,
            y,
            style.seed + 337,
          ) -
          0.5
        ) *
          0.38;

      heights[
        y * DETAIL_SIZE + x
      ] = height;
    }
  }

  const detailHeightAt = (
    x: number,
    y: number,
  ) =>
    heights[
      Math.max(
        0,
        Math.min(
          DETAIL_SIZE - 1,
          y,
        ),
      ) *
        DETAIL_SIZE +
        Math.max(
          0,
          Math.min(
            DETAIL_SIZE - 1,
            x,
          ),
        )
    ] ?? 0;

  for (
    let y = 0;
    y < DETAIL_SIZE;
    y++
  ) {
    for (
      let x = 0;
      x < DETAIL_SIZE;
      x++
    ) {
      const height =
        detailHeightAt(
          x,
          y,
        );
      const dx =
        (
          detailHeightAt(
            x + 1,
            y,
          ) -
          detailHeightAt(
            x - 1,
            y,
          )
        ) *
        0.72;
      const dy =
        (
          detailHeightAt(
            x,
            y + 1,
          ) -
          detailHeightAt(
            x,
            y - 1,
          )
        ) *
        0.72;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const length =
        Math.max(
          0.000001,
          Math.hypot(
            nx,
            ny,
            nz,
          ),
        );
      const offset =
        (y * DETAIL_SIZE + x) *
        4;
      const albedo =
        clamp01(
          0.5 +
            height * 0.16,
        );
      const roughness =
        clamp01(
          0.5 +
            height *
              style.roughnessVariation *
              0.45,
        );

      // Babylon detail maps use:
      // R = albedo modulation, G/A = normal Y/X, B = roughness.
      image.data[
        offset
      ] = clampChannel(
        albedo * 255,
      );
      image.data[
        offset + 1
      ] = clampChannel(
        ny /
          length *
          127.5 +
          127.5,
      );
      image.data[
        offset + 2
      ] = clampChannel(
        roughness * 255,
      );
      image.data[
        offset + 3
      ] = clampChannel(
        nx /
          length *
          127.5 +
          127.5,
      );
    }
  }

  context.putImageData(
    image,
    0,
    0,
  );
  texture.update(false);
  texture.gammaSpace = false;
  texture.uScale =
    DETAIL_TILING;
  texture.vScale =
    DETAIL_TILING;

  return texture;
}

function createTerrainTextures(
  scene: Scene,
  name: string,
  style: TerrainTextureStyle,
): TerrainTextureSet {
  const primary =
    createPrimaryTextures(
      scene,
      name,
      style,
    );

  return {
    ...primary,
    detail:
      createDetailTexture(
        scene,
        name,
        style,
      ),
  };
}

function createTerrainMaterial(
  scene: Scene,
  name: string,
  style: TerrainTextureStyle,
  alpha = 1,
) {
  const existing =
    scene.getMaterialByName(name);
  if (
    existing instanceof
    PBRMaterial
  ) {
    return existing;
  }

  const material =
    new PBRMaterial(
      name,
      scene,
    );
  const textures =
    createTerrainTextures(
      scene,
      name,
      style,
    );

  material.albedoTexture =
    textures.albedo;
  material.bumpTexture =
    textures.normal;
  material.metallicTexture =
    textures.orm;
  material.albedoColor =
    Color3.White();
  material.metallic = 0;
  material.roughness =
    style.roughness;
  material.useRoughnessFromMetallicTextureAlpha =
    false;
  material.useRoughnessFromMetallicTextureGreen =
    true;
  material.useMetallnessFromMetallicTextureBlue =
    true;
  material.useAmbientOcclusionFromMetallicTextureRed =
    true;
  material.forceIrradianceInFragment =
    true;
  material.usePhysicalLightFalloff =
    true;
  material.environmentIntensity =
    0.82;
  material.alpha = alpha;

  material.detailMap.texture =
    textures.detail;
  material.detailMap.isEnabled =
    true;
  material.detailMap.diffuseBlendLevel =
    style.detailDiffuse;
  material.detailMap.bumpLevel =
    style.detailBump;
  material.detailMap.roughnessBlendLevel =
    style.detailRoughness;

  material.backFaceCulling =
    false;

  return material;
}

export function createTerrainMaterials(
  scene: Scene,
  _config: TerrainConfig,
) {
  const surface =
    createTerrainMaterial(
      scene,
      "terrain-surface",
      {
        base: [
          105,
          111,
          82,
        ],
        variation: 34,
        seed: 17,
        striated: false,
        bumpStrength: 0.54,
        bumpLevel: 0.32,
        roughness: 0.88,
        roughnessVariation: 0.2,
        aoStrength: 0.24,
        detailDiffuse: 0.34,
        detailBump: 0.5,
        detailRoughness: 0.42,
      },
    );

  const cliff =
    createTerrainMaterial(
      scene,
      "terrain-cliff-accent",
      {
        base: [
          115,
          88,
          62,
        ],
        variation: 52,
        seed: 29,
        striated: true,
        bumpStrength: 1.15,
        bumpLevel: 0.68,
        roughness: 0.83,
        roughnessVariation: 0.26,
        aoStrength: 0.34,
        detailDiffuse: 0.42,
        detailBump: 0.76,
        detailRoughness: 0.54,
      },
      0.98,
    );

  const wall =
    createTerrainMaterial(
      scene,
      "terrain-perimeter-wall",
      {
        base: [
          82,
          72,
          59,
        ],
        variation: 38,
        seed: 61,
        striated: true,
        bumpStrength: 0.92,
        bumpLevel: 0.52,
        roughness: 0.9,
        roughnessVariation: 0.17,
        aoStrength: 0.3,
        detailDiffuse: 0.3,
        detailBump: 0.58,
        detailRoughness: 0.36,
      },
      0.96,
    );

  const existingBase =
    scene.getMaterialByName(
      "terrain-base",
    );
  const base =
    existingBase instanceof
    PBRMaterial
      ? existingBase
      : new PBRMaterial(
          "terrain-base",
          scene,
        );

  base.albedoColor =
    new Color3(
      0.2,
      0.18,
      0.15,
    );
  base.metallic = 0;
  base.roughness = 1;
  base.environmentIntensity =
    0.5;

  return {
    surface,
    cliff,
    wall,
    base,
  };
}
