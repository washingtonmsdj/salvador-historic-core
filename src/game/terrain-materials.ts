import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { TerrainConfig } from "./types";

type Rgb = readonly [number, number, number];

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function deterministicNoise(x: number, y: number, seed: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function createSurfaceTexture(
  scene: Scene,
  name: string,
  base: Rgb,
  variation: number,
  scale: number,
  seed: number,
  striated = false,
) {
  const size = 128;
  const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const context = texture.getContext();
  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const coarse = deterministicNoise(Math.floor(x / 6), Math.floor(y / 6), seed);
      const fine = deterministicNoise(x, y, seed + 11);
      const band = striated ? Math.sin(y * 0.36 + coarse * 2.2) * 0.28 : 0;
      const delta = (coarse * 0.58 + fine * 0.42 - 0.5 + band) * variation;

      image.data[index] = clampChannel(base[0] + delta);
      image.data[index + 1] = clampChannel(base[1] + delta);
      image.data[index + 2] = clampChannel(base[2] + delta);
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = scale;
  texture.vScale = scale;
  return texture;
}

function createTerrainMaterial(
  scene: Scene,
  name: string,
  base: Rgb,
  variation: number,
  scale: number,
  seed: number,
  striated = false,
) {
  const diffuse = createSurfaceTexture(
    scene,
    `${name}-diffuse`,
    base,
    variation,
    scale,
    seed,
    striated,
  );
  const bump = createSurfaceTexture(
    scene,
    `${name}-bump`,
    [128, 128, 128],
    striated ? 86 : 46,
    scale * 1.35,
    seed + 101,
    striated,
  );

  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = diffuse;
  material.bumpTexture = bump;
  bump.level = striated ? 0.42 : 0.22;
  material.diffuseColor = Color3.White();
  material.specularColor = new Color3(0.035, 0.035, 0.035);
  material.emissiveColor = new Color3(0.022, 0.026, 0.021);
  return material;
}

export function createTerrainMaterials(scene: Scene, config: TerrainConfig) {
  const { textureScale } = config.presentation;

  const lower = createTerrainMaterial(
    scene,
    "terrain-lower",
    [116, 112, 98],
    40,
    textureScale,
    17,
  );
  const cliff = createTerrainMaterial(
    scene,
    "terrain-cliff",
    [101, 91, 75],
    52,
    textureScale * 1.15,
    29,
    true,
  );
  const upper = createTerrainMaterial(
    scene,
    "terrain-upper",
    [103, 117, 91],
    44,
    textureScale,
    43,
  );
  const wall = createTerrainMaterial(
    scene,
    "terrain-perimeter-wall",
    [82, 74, 63],
    45,
    textureScale * 0.8,
    61,
    true,
  );
  const base = new StandardMaterial("terrain-base", scene);
  base.diffuseColor = new Color3(0.18, 0.17, 0.15);
  base.specularColor = Color3.Black();

  wall.backFaceCulling = false;

  return {
    lower,
    cliff,
    upper,
    wall,
    base,
  };
}
