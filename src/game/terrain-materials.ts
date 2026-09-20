import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
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
};

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

function createTerrainTextures(
  scene: Scene,
  name: string,
  style: TerrainTextureStyle,
) {
  const size = 128;
  const diffuse =
    new DynamicTexture(
      name + "-diffuse",
      {
        width: size,
        height: size,
      },
      scene,
      false,
    );
  const bump =
    new DynamicTexture(
      name + "-normal",
      {
        width: size,
        height: size,
      },
      scene,
      false,
    );
  const diffuseContext =
    diffuse.getContext();
  const bumpContext =
    bump.getContext();
  const diffuseImage =
    diffuseContext.getImageData(
      0,
      0,
      size,
      size,
    );
  const bumpImage =
    bumpContext.getImageData(
      0,
      0,
      size,
      size,
    );
  const heights =
    new Float32Array(
      size * size,
    );

  for (
    let y = 0;
    y < size;
    y++
  ) {
    for (
      let x = 0;
      x < size;
      x++
    ) {
      const coarse =
        deterministicNoise(
          Math.floor(x / 10),
          Math.floor(y / 10),
          style.seed,
        );
      const medium =
        deterministicNoise(
          x / 3,
          y / 3,
          style.seed + 11,
        );
      const fine =
        deterministicNoise(
          x,
          y,
          style.seed + 37,
        );
      const band =
        style.striated
          ? Math.sin(
              y * 0.28 +
                coarse * 3.1,
            ) *
            0.2
          : 0;
      const composite =
        coarse * 0.5 +
        medium * 0.32 +
        fine * 0.18 -
        0.5 +
        band;
      const delta =
        composite *
        style.variation;
      const offset =
        (y * size + x) * 4;

      diffuseImage.data[
        offset
      ] = clampChannel(
        style.base[0] +
          delta,
      );
      diffuseImage.data[
        offset + 1
      ] = clampChannel(
        style.base[1] +
          delta,
      );
      diffuseImage.data[
        offset + 2
      ] = clampChannel(
        style.base[2] +
          delta,
      );
      diffuseImage.data[
        offset + 3
      ] = 255;

      heights[y * size + x] =
        composite;
    }
  }

  diffuseContext.putImageData(
    diffuseImage,
    0,
    0,
  );

  const heightAt = (
    x: number,
    y: number,
  ) =>
    heights[
      Math.max(
        0,
        Math.min(
          size - 1,
          y,
        ),
      ) *
        size +
        Math.max(
          0,
          Math.min(
            size - 1,
            x,
          ),
        )
    ] ?? 0;

  for (
    let y = 0;
    y < size;
    y++
  ) {
    for (
      let x = 0;
      x < size;
      x++
    ) {
      const dx =
        (heightAt(
          x + 1,
          y,
        ) -
          heightAt(
            x - 1,
            y,
          )) *
        style.bumpStrength;
      const dy =
        (heightAt(
          x,
          y + 1,
        ) -
          heightAt(
            x,
            y - 1,
          )) *
        style.bumpStrength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const length = Math.max(
        0.000001,
        Math.hypot(
          nx,
          ny,
          nz,
        ),
      );
      const offset =
        (y * size + x) * 4;

      bumpImage.data[
        offset
      ] = clampChannel(
        (nx / length) *
          127.5 +
          127.5,
      );
      bumpImage.data[
        offset + 1
      ] = clampChannel(
        (ny / length) *
          127.5 +
          127.5,
      );
      bumpImage.data[
        offset + 2
      ] = clampChannel(
        (nz / length) *
          127.5 +
          127.5,
      );
      bumpImage.data[
        offset + 3
      ] = 255;
    }
  }

  bumpContext.putImageData(
    bumpImage,
    0,
    0,
  );

  for (const texture of [
    diffuse,
    bump,
  ]) {
    texture.update(false);
    texture.wrapU =
      Texture.WRAP_ADDRESSMODE;
    texture.wrapV =
      Texture.WRAP_ADDRESSMODE;
  }

  bump.level =
    style.bumpLevel;

  return {
    diffuse,
    bump,
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
    StandardMaterial
  ) {
    return existing;
  }

  const material =
    new StandardMaterial(
      name,
      scene,
    );
  const textures =
    createTerrainTextures(
      scene,
      name,
      style,
    );

  material.diffuseTexture =
    textures.diffuse;
  material.bumpTexture =
    textures.bump;
  material.diffuseColor =
    Color3.White();
  material.specularColor =
    new Color3(
      0.018,
      0.018,
      0.018,
    );
  material.specularPower =
    style.striated
      ? 48
      : 32;
  material.emissiveColor =
    Color3.FromInts(
      style.base[0],
      style.base[1],
      style.base[2],
    ).scale(
      style.striated
        ? 0.035
        : 0.05,
    );
  material.alpha = alpha;
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
          112,
          119,
          91,
        ],
        variation: 26,
        seed: 17,
        striated: false,
        bumpStrength: 0.42,
        bumpLevel: 0.18,
      },
    );

  const cliff =
    createTerrainMaterial(
      scene,
      "terrain-cliff-accent",
      {
        base: [
          116,
          91,
          68,
        ],
        variation: 38,
        seed: 29,
        striated: true,
        bumpStrength: 0.78,
        bumpLevel: 0.36,
      },
      0.92,
    );

  const wall =
    createTerrainMaterial(
      scene,
      "terrain-perimeter-wall",
      {
        base: [
          86,
          76,
          63,
        ],
        variation: 30,
        seed: 61,
        striated: true,
        bumpStrength: 0.64,
        bumpLevel: 0.3,
      },
      0.68,
    );

  const existingBase =
    scene.getMaterialByName(
      "terrain-base",
    );
  const base =
    existingBase instanceof
    StandardMaterial
      ? existingBase
      : new StandardMaterial(
          "terrain-base",
          scene,
        );
  base.diffuseColor =
    new Color3(
      0.26,
      0.24,
      0.21,
    );
  base.emissiveColor =
    new Color3(
      0.018,
      0.016,
      0.014,
    );
  base.specularColor =
    Color3.Black();

  surface.backFaceCulling =
    false;
  cliff.backFaceCulling =
    false;
  wall.backFaceCulling =
    false;

  return {
    surface,
    cliff,
    wall,
    base,
  };
}
