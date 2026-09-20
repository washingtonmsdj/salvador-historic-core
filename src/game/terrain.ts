import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import type { SceneLevels, TerrainConfig, TerrainProfile } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function interpolateProfile(
  profiles: TerrainProfile[],
  z: number,
): Required<TerrainProfile> {
  if (profiles.length === 0) {
    throw new Error("Terrain requires at least one north-south profile.");
  }

  const first = profiles[0];
  const last = profiles[profiles.length - 1];
  if (!first || !last) {
    throw new Error("Terrain profile configuration is invalid.");
  }

  const normalize = (profile: TerrainProfile): Required<TerrainProfile> => ({
    ...profile,
    lowerOffset: profile.lowerOffset ?? 0,
    upperOffset: profile.upperOffset ?? 0,
  });

  if (z <= first.z) return normalize(first);
  if (z >= last.z) return normalize(last);

  for (let index = 0; index < profiles.length - 1; index++) {
    const a = profiles[index];
    const b = profiles[index + 1];
    if (!a || !b || z < a.z || z > b.z) continue;

    const span = Math.max(0.001, b.z - a.z);
    const t = (z - a.z) / span;
    const mix = (from: number, to: number) => from + (to - from) * t;

    return {
      z,
      toeX: mix(a.toeX, b.toeX),
      cliffX: mix(a.cliffX, b.cliffX),
      shoulderX: mix(a.shoulderX, b.shoulderX),
      lowerOffset: mix(a.lowerOffset ?? 0, b.lowerOffset ?? 0),
      upperOffset: mix(a.upperOffset ?? 0, b.upperOffset ?? 0),
    };
  }

  return normalize(last);
}

export function terrainHeight(
  config: TerrainConfig,
  levels: SceneLevels,
  x: number,
  z: number,
) {
  const profile = interpolateProfile(config.profiles, z);
  const lowerGrade = clamp(
    (x - config.bounds.minX) * config.lowerGrade.risePerMeterX,
    0,
    config.lowerGrade.maxRise,
  );
  const upperVariation = clamp(
    (x - profile.shoulderX) * config.upperGrade.risePerMeterX +
      z * config.upperGrade.risePerMeterZ,
    -config.upperGrade.maxVariation,
    config.upperGrade.maxVariation,
  );

  const lowerY =
    levels.lowerCity.elevation + profile.lowerOffset + lowerGrade;
  const upperY =
    levels.upperCity.elevation + profile.upperOffset + upperVariation;

  if (x <= profile.toeX) return lowerY;
  if (x >= profile.shoulderX) return upperY;

  const ledgeY = lowerY + (upperY - lowerY) * 0.16;

  if (x <= profile.cliffX) {
    const toeSpan = Math.max(0.001, profile.cliffX - profile.toeX);
    const t = smoothstep((x - profile.toeX) / toeSpan);
    return lowerY + (ledgeY - lowerY) * t;
  }

  const cliffSpan = Math.max(0.001, profile.shoulderX - profile.cliffX);
  const t = smoothstep((x - profile.cliffX) / cliffSpan);
  return ledgeY + (upperY - ledgeY) * t;
}

function terrainNormal(
  config: TerrainConfig,
  levels: SceneLevels,
  x: number,
  z: number,
) {
  const sample = 1;
  const left = terrainHeight(config, levels, x - sample, z);
  const right = terrainHeight(config, levels, x + sample, z);
  const south = terrainHeight(config, levels, x, z - sample);
  const north = terrainHeight(config, levels, x, z + sample);
  const nx = left - right;
  const ny = sample * 2;
  const nz = south - north;
  const length = Math.max(0.001, Math.hypot(nx, ny, nz));
  return [nx / length, ny / length, nz / length] as const;
}

export function createTerrain(
  scene: Scene,
  config: TerrainConfig,
  levels: SceneLevels,
) {
  const meshes: Mesh[] = [];
  const { tileSize, bounds, subdivisionsPerTile } = config;
  const steps = Math.max(4, subdivisionsPerTile);
  const terrainMaterial = material(scene, "terrain");

  for (let tx = bounds.minX; tx < bounds.maxX; tx += tileSize) {
    for (let tz = bounds.minZ; tz < bounds.maxZ; tz += tileSize) {
      const tileWidth = Math.min(tileSize, bounds.maxX - tx);
      const tileDepth = Math.min(tileSize, bounds.maxZ - tz);
      const mesh = new Mesh(`terrain-tile-${tx}-${tz}`, scene);
      const positions: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];

      for (let iz = 0; iz <= steps; iz++) {
        for (let ix = 0; ix <= steps; ix++) {
          const x = tx + (ix / steps) * tileWidth;
          const z = tz + (iz / steps) * tileDepth;
          positions.push(x, terrainHeight(config, levels, x, z), z);
          normals.push(...terrainNormal(config, levels, x, z));
          uvs.push(ix / steps, iz / steps);
        }
      }

      for (let iz = 0; iz < steps; iz++) {
        for (let ix = 0; ix < steps; ix++) {
          const a = iz * (steps + 1) + ix;
          const b = a + 1;
          const c = a + steps + 1;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }

      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.indices = indices;
      vertexData.normals = normals;
      vertexData.uvs = uvs;
      vertexData.applyToMesh(mesh);

      mesh.material = terrainMaterial;
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      mesh.metadata = {
        category: "terrain",
        source: config.source,
        estimated: config.estimated,
      };
      meshes.push(mesh);
    }
  }

  return meshes;
}
