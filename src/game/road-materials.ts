import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { LinearFeature } from "./types";
import {
  classifyRoadSurface,
  type RoadSurfaceKind,
} from "./road-surface";

type SurfacePattern =
  | "aggregate"
  | "pavers"
  | "cobble"
  | "slab";

type SurfaceStyle = {
  base: readonly [number, number, number];
  variation: number;
  aggregate: number;
  jointSpacing: number | null;
  jointAlpha: number;
  pattern: SurfacePattern;
  bumpStrength: number;
  bumpLevel: number;
};

const styles: Record<
  RoadSurfaceKind,
  SurfaceStyle
> = {
  asphalt: {
    base: [76, 78, 77],
    variation: 22,
    aggregate: 0.14,
    jointSpacing: null,
    jointAlpha: 0,
    pattern: "aggregate",
    bumpStrength: 0.34,
    bumpLevel: 0.16,
  },
  paved: {
    base: [103, 104, 101],
    variation: 18,
    aggregate: 0.08,
    jointSpacing: null,
    jointAlpha: 0,
    pattern: "aggregate",
    bumpStrength: 0.22,
    bumpLevel: 0.12,
  },
  paving: {
    base: [132, 122, 107],
    variation: 30,
    aggregate: 0.1,
    jointSpacing: 18,
    jointAlpha: 0.28,
    pattern: "pavers",
    bumpStrength: 0.72,
    bumpLevel: 0.34,
  },
  stone: {
    base: [118, 111, 100],
    variation: 34,
    aggregate: 0.08,
    jointSpacing: 14,
    jointAlpha: 0.3,
    pattern: "cobble",
    bumpStrength: 0.86,
    bumpLevel: 0.4,
  },
  pedestrian: {
    base: [151, 142, 126],
    variation: 24,
    aggregate: 0.06,
    jointSpacing: 24,
    jointAlpha: 0.18,
    pattern: "slab",
    bumpStrength: 0.48,
    bumpLevel: 0.24,
  },
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

function positiveModulo(
  value: number,
  modulus: number,
) {
  return (
    ((value % modulus) +
      modulus) %
    modulus
  );
}

function jointMask(
  x: number,
  y: number,
  style: SurfaceStyle,
  seed: number,
) {
  const spacing =
    style.jointSpacing;
  if (!spacing) {
    return 0;
  }

  const row =
    Math.floor(y / spacing);
  const rowNoise =
    deterministicNoise(
      row,
      0,
      seed + 31,
    );
  const wobble =
    style.pattern === "cobble"
      ? (rowNoise - 0.5) * 4
      : 0;
  const stagger =
    style.pattern === "pavers" ||
    style.pattern === "cobble"
      ? row % 2 === 0
        ? 0
        : spacing / 2
      : 0;

  const horizontalCoord =
    positiveModulo(
      y + wobble,
      spacing,
    );
  const verticalCoord =
    positiveModulo(
      x + stagger,
      spacing,
    );
  const horizontalJoint =
    horizontalCoord < 1.2 ||
    horizontalCoord >
      spacing - 1.2;
  const verticalJoint =
    verticalCoord < 1.2 ||
    verticalCoord >
      spacing - 1.2;

  if (
    style.pattern === "slab"
  ) {
    return horizontalJoint ||
      verticalJoint
      ? 1
      : 0;
  }

  if (
    style.pattern === "pavers"
  ) {
    return horizontalJoint ||
      verticalJoint
      ? 1
      : 0;
  }

  if (
    style.pattern === "cobble"
  ) {
    const cell =
      Math.floor(
        (x + stagger) /
          spacing,
      );
    const cellNoise =
      deterministicNoise(
        cell,
        row,
        seed + 57,
      );
    const irregularJoint =
      verticalJoint &&
      cellNoise > 0.12;

    return horizontalJoint ||
      irregularJoint
      ? 1
      : 0;
  }

  return 0;
}

function createRoadTextures(
  scene: Scene,
  name: string,
  style: SurfaceStyle,
  seed: number,
) {
  const size = 256;
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
          Math.floor(x / 12),
          Math.floor(y / 12),
          seed,
        );
      const fine =
        deterministicNoise(
          x,
          y,
          seed + 19,
        );
      const grain =
        deterministicNoise(
          x * 0.37,
          y * 0.37,
          seed + 83,
        );
      const aggregate =
        fine >
        1 - style.aggregate
          ? -style.variation *
            0.45
          : 0;
      const joint =
        jointMask(
          x,
          y,
          style,
          seed,
        );
      const materialVariation =
        (coarse * 0.52 +
          fine * 0.3 +
          grain * 0.18 -
          0.5) *
          style.variation;
      const jointDarkening =
        joint *
        style.jointAlpha *
        150;
      const offset =
        (y * size + x) * 4;

      diffuseImage.data[
        offset
      ] = clampChannel(
        style.base[0] +
          materialVariation +
          aggregate -
          jointDarkening,
      );
      diffuseImage.data[
        offset + 1
      ] = clampChannel(
        style.base[1] +
          materialVariation +
          aggregate -
          jointDarkening,
      );
      diffuseImage.data[
        offset + 2
      ] = clampChannel(
        style.base[2] +
          materialVariation +
          aggregate -
          jointDarkening,
      );
      diffuseImage.data[
        offset + 3
      ] = 255;

      heights[y * size + x] =
        (coarse - 0.5) *
          0.18 +
        (fine - 0.5) *
          0.1 +
        (grain - 0.5) *
          0.06 -
        joint * 0.7;
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
        (heightAt(x + 1, y) -
          heightAt(x - 1, y)) *
        style.bumpStrength;
      const dy =
        (heightAt(x, y + 1) -
          heightAt(x, y - 1)) *
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

export function surfaceMaterialForKind(
  scene: Scene,
  kind: RoadSurfaceKind,
) {
  const name =
    "road-surface-" + kind;
  const existing =
    scene.getMaterialByName(name);
  if (
    existing instanceof
    StandardMaterial
  ) {
    return existing;
  }

  const style = styles[kind];
  const material =
    new StandardMaterial(
      name,
      scene,
    );
  const textures =
    createRoadTextures(
      scene,
      name,
      style,
      kind === "asphalt"
        ? 43
        : kind === "paved"
          ? 59
          : kind === "paving"
            ? 71
            : kind === "stone"
              ? 97
              : 121,
    );

  material.diffuseTexture =
    textures.diffuse;
  material.bumpTexture =
    textures.bump;
  material.diffuseColor =
    Color3.White();
  material.emissiveColor =
    Color3.FromInts(
      style.base[0],
      style.base[1],
      style.base[2],
    ).scale(0.028);
  material.specularColor =
    kind === "asphalt"
      ? new Color3(
          0.05,
          0.05,
          0.05,
        )
      : new Color3(
          0.02,
          0.02,
          0.02,
        );
  material.specularPower =
    kind === "asphalt"
      ? 32
      : 64;
  material.backFaceCulling =
    false;
  return material;
}

export function roadMaterialFor(
  scene: Scene,
  feature: LinearFeature,
) {
  return surfaceMaterialForKind(
    scene,
    classifyRoadSurface(feature),
  );
}
