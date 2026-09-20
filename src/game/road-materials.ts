import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { LinearFeature } from "./types";

export type RoadSurfaceKind =
  | "asphalt"
  | "paving"
  | "stone"
  | "pedestrian";

type SurfaceStyle = {
  base: readonly [number, number, number];
  variation: number;
  aggregate: number;
  jointSpacing: number | null;
  jointAlpha: number;
};

const styles: Record<RoadSurfaceKind, SurfaceStyle> = {
  asphalt: {
    base: [76, 78, 77],
    variation: 22,
    aggregate: 0.14,
    jointSpacing: null,
    jointAlpha: 0,
  },
  paving: {
    base: [132, 122, 107],
    variation: 30,
    aggregate: 0.1,
    jointSpacing: 16,
    jointAlpha: 0.2,
  },
  stone: {
    base: [118, 111, 100],
    variation: 34,
    aggregate: 0.08,
    jointSpacing: 12,
    jointAlpha: 0.24,
  },
  pedestrian: {
    base: [151, 142, 126],
    variation: 24,
    aggregate: 0.06,
    jointSpacing: 20,
    jointAlpha: 0.16,
  },
};

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function deterministicNoise(x: number, y: number, seed: number) {
  const value =
    Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) *
    43758.5453;
  return value - Math.floor(value);
}

function createRoadTexture(
  scene: Scene,
  name: string,
  style: SurfaceStyle,
  seed: number,
) {
  const size = 256;
  const texture = new DynamicTexture(
    name,
    { width: size, height: size },
    scene,
    false,
  );
  const context = texture.getContext();
  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coarse = deterministicNoise(
        Math.floor(x / 12),
        Math.floor(y / 12),
        seed,
      );
      const fine = deterministicNoise(x, y, seed + 19);
      const aggregate =
        fine > 1 - style.aggregate
          ? -style.variation * 0.45
          : 0;
      const delta =
        (coarse * 0.62 + fine * 0.38 - 0.5) *
          style.variation +
        aggregate;
      const offset = (y * size + x) * 4;

      image.data[offset] = clampChannel(
        style.base[0] + delta,
      );
      image.data[offset + 1] = clampChannel(
        style.base[1] + delta,
      );
      image.data[offset + 2] = clampChannel(
        style.base[2] + delta,
      );
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  if (style.jointSpacing) {
    context.strokeStyle =
      `rgba(53, 49, 44, ${style.jointAlpha})`;
    context.lineWidth = 1;

    for (
      let y = style.jointSpacing;
      y < size;
      y += style.jointSpacing
    ) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(size, y + 0.5);
      context.stroke();
    }

    for (
      let x = style.jointSpacing;
      x < size;
      x += style.jointSpacing
    ) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, size);
      context.stroke();
    }
  }

  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

function getOrCreateRoadMaterial(
  scene: Scene,
  kind: RoadSurfaceKind,
) {
  const name = `road-surface-${kind}`;
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) {
    return existing;
  }

  const style = styles[kind];
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = createRoadTexture(
    scene,
    `${name}-diffuse`,
    style,
    kind === "asphalt"
      ? 43
      : kind === "paving"
        ? 71
        : kind === "stone"
          ? 97
          : 121,
  );
  material.diffuseColor = Color3.White();
  material.emissiveColor =
    Color3.FromInts(
      style.base[0],
      style.base[1],
      style.base[2],
    ).scale(0.035);
  material.specularColor =
    kind === "asphalt"
      ? new Color3(0.055, 0.055, 0.055)
      : new Color3(0.025, 0.025, 0.025);
  material.backFaceCulling = false;
  return material;
}

export function classifyRoadSurface(
  feature: LinearFeature,
): RoadSurfaceKind {
  const surface = feature.tags?.surface
    ?.trim()
    .toLocaleLowerCase("en-US");
  const highway = feature.tags?.highway
    ?.trim()
    .toLocaleLowerCase("en-US");

  if (
    surface === "paving_stones" ||
    surface === "paving stones" ||
    surface === "sett"
  ) {
    return "paving";
  }

  if (
    surface === "cobblestone" ||
    surface === "unhewn_cobblestone" ||
    surface === "stone"
  ) {
    return "stone";
  }

  if (
    highway === "pedestrian" ||
    highway === "footway" ||
    highway === "path" ||
    highway === "steps"
  ) {
    return "pedestrian";
  }

  return "asphalt";
}

export function roadMaterialFor(
  scene: Scene,
  feature: LinearFeature,
) {
  return getOrCreateRoadMaterial(
    scene,
    classifyRoadSurface(feature),
  );
}
