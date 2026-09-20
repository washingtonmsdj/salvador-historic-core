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
  const texture = new DynamicTexture(
    name,
    { width: size, height: size },
    scene,
    false,
  );
  const context = texture.getContext();
  const cell = 4;

  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const coarse = deterministicNoise(
        Math.floor(x / 12),
        Math.floor(y / 12),
        seed,
      );
      const fine = deterministicNoise(x / cell, y / cell, seed + 11);
      const band = striated
        ? Math.sin(y * 0.24 + coarse * 2.2) * 0.22
        : 0;
      const delta =
        (coarse * 0.58 + fine * 0.42 - 0.5 + band) * variation;
      const red = clampChannel(base[0] + delta);
      const green = clampChannel(base[1] + delta);
      const blue = clampChannel(base[2] + delta);

      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(x, y, cell, cell);
    }
  }

  if (striated) {
    context.fillStyle = "rgba(54, 46, 37, 0.14)";
    for (let y = 8; y < size; y += 13) {
      context.fillRect(0, y, size, 1);
    }
  }

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
  alpha = 1,
) {
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = createSurfaceTexture(
    scene,
    `${name}-diffuse`,
    base,
    variation,
    scale,
    seed,
    striated,
  );
  material.diffuseColor = Color3.White();
  material.specularColor = new Color3(0.025, 0.025, 0.025);
  material.emissiveColor = Color3.FromInts(base[0], base[1], base[2]).scale(
    striated ? 0.045 : 0.075,
  );
  material.alpha = alpha;
  return material;
}

export function createTerrainMaterials(scene: Scene, config: TerrainConfig) {
  const { textureScale } = config.presentation;

  const surface = createTerrainMaterial(
    scene,
    "terrain-surface",
    [126, 136, 105],
    30,
    textureScale * 0.85,
    17,
  );

  const cliff = createTerrainMaterial(
    scene,
    "terrain-cliff-accent",
    [124, 104, 79],
    42,
    textureScale,
    29,
    true,
    0.88,
  );

  const wall = createTerrainMaterial(
    scene,
    "terrain-perimeter-wall",
    [92, 81, 65],
    34,
    textureScale * 0.72,
    61,
    true,
    0.76,
  );

  const base = new StandardMaterial("terrain-base", scene);
  base.diffuseColor = new Color3(0.26, 0.24, 0.21);
  base.emissiveColor = new Color3(0.018, 0.016, 0.014);
  base.specularColor = Color3.Black();

  surface.backFaceCulling = false;
  cliff.backFaceCulling = false;
  wall.backFaceCulling = false;

  return {
    surface,
    cliff,
    wall,
    base,
  };
}
