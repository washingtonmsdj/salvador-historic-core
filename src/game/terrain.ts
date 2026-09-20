import type { Material } from "@babylonjs/core/Materials/material";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { createTerrainMaterials } from "./terrain-materials";
import type { Point2, SceneLevels, TerrainConfig, TerrainProfile } from "./types";

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

function createZoneMesh(
  scene: Scene,
  name: string,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  material: Material,
  metadata: Record<string, unknown>,
) {
  if (indices.length === 0) return null;

  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;
  vertexData.applyToMesh(mesh);

  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = metadata;
  return mesh;
}

function classifyQuad(
  config: TerrainConfig,
  positions: number[],
  normals: number[],
  indices: readonly [number, number, number, number],
) {
  let averageY = 0;
  let averageNormalY = 0;

  for (const vertexIndex of indices) {
    averageY += positions[vertexIndex * 3 + 1] ?? 0;
    averageNormalY += normals[vertexIndex * 3 + 1] ?? 1;
  }

  averageY /= indices.length;
  averageNormalY /= indices.length;

  if (averageNormalY <= config.presentation.rockNormalYMax) {
    return "cliff" as const;
  }
  if (averageY >= config.presentation.upperElevationMin) {
    return "upper" as const;
  }
  return "lower" as const;
}

function sampleEdge(a: Point2, b: Point2, spacing: number) {
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const segments = Math.max(1, Math.ceil(distance / spacing));
  const points: Point2[] = [];

  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    points.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
    ]);
  }

  return points;
}

function createPerimeterWall(
  scene: Scene,
  name: string,
  points: Point2[],
  config: TerrainConfig,
  levels: SceneLevels,
  material: Material,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  let travelled = 0;
  const baseY = config.presentation.baseY;

  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (!point) continue;

    if (index > 0) {
      const previous = points[index - 1];
      if (previous) {
        travelled += Math.hypot(
          point[0] - previous[0],
          point[1] - previous[1],
        );
      }
    }

    const topY = terrainHeight(config, levels, point[0], point[1]);
    const verticalSpan = Math.max(1, topY - baseY);

    positions.push(
      point[0],
      topY,
      point[1],
      point[0],
      baseY,
      point[1],
    );
    uvs.push(travelled / 10, 0, travelled / 10, verticalSpan / 10);
  }

  for (let index = 0; index < points.length - 1; index++) {
    const topA = index * 2;
    const bottomA = topA + 1;
    const topB = topA + 2;
    const bottomB = topA + 3;
    indices.push(topA, bottomA, topB, topB, bottomA, bottomB);
  }

  VertexData.ComputeNormals(positions, indices, normals);

  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = {
    category: "terrain-perimeter",
    estimated: config.estimated,
    source: config.source,
  };
  return mesh;
}

function createTerrainStructure(
  scene: Scene,
  config: TerrainConfig,
  levels: SceneLevels,
  materials: ReturnType<typeof createTerrainMaterials>,
) {
  const { bounds, presentation } = config;
  const corners = {
    southWest: [bounds.minX, bounds.minZ] as Point2,
    southEast: [bounds.maxX, bounds.minZ] as Point2,
    northEast: [bounds.maxX, bounds.maxZ] as Point2,
    northWest: [bounds.minX, bounds.maxZ] as Point2,
  };

  const walls = [
    createPerimeterWall(
      scene,
      "terrain-perimeter-south",
      sampleEdge(
        corners.southWest,
        corners.southEast,
        presentation.perimeterSampleSpacing,
      ),
      config,
      levels,
      materials.wall,
    ),
    createPerimeterWall(
      scene,
      "terrain-perimeter-east",
      sampleEdge(
        corners.southEast,
        corners.northEast,
        presentation.perimeterSampleSpacing,
      ),
      config,
      levels,
      materials.wall,
    ),
    createPerimeterWall(
      scene,
      "terrain-perimeter-north",
      sampleEdge(
        corners.northEast,
        corners.northWest,
        presentation.perimeterSampleSpacing,
      ),
      config,
      levels,
      materials.wall,
    ),
    createPerimeterWall(
      scene,
      "terrain-perimeter-west",
      sampleEdge(
        corners.northWest,
        corners.southWest,
        presentation.perimeterSampleSpacing,
      ),
      config,
      levels,
      materials.wall,
    ),
  ];

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const base = MeshBuilder.CreateBox(
    "terrain-base",
    {
      width,
      depth,
      height: 1.6,
    },
    scene,
  );
  base.position.set(
    (bounds.minX + bounds.maxX) / 2,
    presentation.baseY - 0.8,
    (bounds.minZ + bounds.maxZ) / 2,
  );
  base.material = materials.base;
  base.receiveShadows = true;
  base.checkCollisions = true;
  base.metadata = {
    category: "terrain-base",
    estimated: config.estimated,
    source: config.source,
  };

  return [...walls, base];
}

export function createTerrain(
  scene: Scene,
  config: TerrainConfig,
  levels: SceneLevels,
) {
  const meshes: Mesh[] = [];
  const { tileSize, bounds, subdivisionsPerTile } = config;
  const steps = Math.max(4, subdivisionsPerTile);
  const materials = createTerrainMaterials(scene, config);

  for (let tx = bounds.minX; tx < bounds.maxX; tx += tileSize) {
    for (let tz = bounds.minZ; tz < bounds.maxZ; tz += tileSize) {
      const tileWidth = Math.min(tileSize, bounds.maxX - tx);
      const tileDepth = Math.min(tileSize, bounds.maxZ - tz);
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const groupedIndices = {
        lower: [] as number[],
        cliff: [] as number[],
        upper: [] as number[],
      };

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
          const zone = classifyQuad(config, positions, normals, [a, b, c, d]);
          groupedIndices[zone].push(a, c, b, b, c, d);
        }
      }

      const metadata = {
        category: "terrain",
        source: config.source,
        estimated: config.estimated,
      };

      const lower = createZoneMesh(
        scene,
        `terrain-lower-${tx}-${tz}`,
        positions,
        normals,
        uvs,
        groupedIndices.lower,
        materials.lower,
        metadata,
      );
      const cliff = createZoneMesh(
        scene,
        `terrain-cliff-${tx}-${tz}`,
        positions,
        normals,
        uvs,
        groupedIndices.cliff,
        materials.cliff,
        metadata,
      );
      const upper = createZoneMesh(
        scene,
        `terrain-upper-${tx}-${tz}`,
        positions,
        normals,
        uvs,
        groupedIndices.upper,
        materials.upper,
        metadata,
      );

      if (lower) meshes.push(lower);
      if (cliff) meshes.push(cliff);
      if (upper) meshes.push(upper);
    }
  }

  meshes.push(...createTerrainStructure(scene, config, levels, materials));
  return meshes;
}
