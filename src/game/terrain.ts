import type { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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

function pointInPolygon(point: Point2, polygon: Point2[]) {
  let inside = false;
  const [x, z] = point;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) continue;

    const [xi, zi] = currentPoint;
    const [xj, zj] = previousPoint;
    const intersects =
      zi > z !== zj > z &&
      x < ((xj - xi) * (z - zi)) / (zj - zi || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function distanceToSegment(point: Point2, start: Point2, end: Point2) {
  const [px, pz] = point;
  const [ax, az] = start;
  const [bx, bz] = end;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;

  if (lengthSquared <= 0.000001) {
    return Math.hypot(px - ax, pz - az);
  }

  const t = clamp(((px - ax) * dx + (pz - az) * dz) / lengthSquared, 0, 1);
  const closestX = ax + dx * t;
  const closestZ = az + dz * t;
  return Math.hypot(px - closestX, pz - closestZ);
}

function distanceToPolygon(point: Point2, polygon: Point2[]) {
  let distance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (!start || !end) continue;
    distance = Math.min(distance, distanceToSegment(point, start, end));
  }

  return distance;
}

function applyTerrainCutouts(
  config: TerrainConfig,
  x: number,
  z: number,
  baseHeight: number,
) {
  let height = baseHeight;

  for (const cutout of config.cutouts ?? []) {
    if (cutout.polygon.length < 3) continue;

    const point: Point2 = [x, z];
    if (pointInPolygon(point, cutout.polygon)) {
      height = Math.min(height, cutout.elevation);
      continue;
    }

    const distance = distanceToPolygon(point, cutout.polygon);
    if (cutout.feather <= 0 || distance >= cutout.feather) continue;

    const blend = smoothstep(distance / cutout.feather);
    const featheredHeight =
      cutout.elevation + (height - cutout.elevation) * blend;
    height = Math.min(height, featheredHeight);
  }

  return height;
}

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

  let height: number;

  if (x <= profile.toeX) {
    height = lowerY;
  } else if (x >= profile.shoulderX) {
    height = upperY;
  } else {
    const ledgeY = lowerY + (upperY - lowerY) * 0.18;

    if (x <= profile.cliffX) {
      const toeSpan = Math.max(0.001, profile.cliffX - profile.toeX);
      const t = smoothstep((x - profile.toeX) / toeSpan);
      height = lowerY + (ledgeY - lowerY) * t;
    } else {
      const cliffSpan = Math.max(0.001, profile.shoulderX - profile.cliffX);
      const t = smoothstep((x - profile.cliffX) / cliffSpan);
      height = ledgeY + (upperY - ledgeY) * t;
    }
  }

  return applyTerrainCutouts(config, x, z, height);
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

function createSurfaceMesh(
  scene: Scene,
  name: string,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  material: Material,
  metadata: Record<string, unknown>,
  checkCollisions: boolean,
) {
  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;
  vertexData.applyToMesh(mesh);

  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.checkCollisions = checkCollisions;
  mesh.metadata = metadata;
  return mesh;
}

function isCliffQuad(
  config: TerrainConfig,
  normals: number[],
  indices: readonly [number, number, number, number],
) {
  let averageNormalY = 0;

  for (const vertexIndex of indices) {
    averageNormalY += normals[vertexIndex * 3 + 1] ?? 1;
  }

  averageNormalY /= indices.length;
  return averageNormalY <= config.presentation.rockNormalYMax;
}

function offsetPositions(
  positions: number[],
  normals: number[],
  distance: number,
) {
  const offset: number[] = [];

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index] ?? 0;
    const y = positions[index + 1] ?? 0;
    const z = positions[index + 2] ?? 0;
    const nx = normals[index] ?? 0;
    const ny = normals[index + 1] ?? 1;
    const nz = normals[index + 2] ?? 0;
    offset.push(
      x + nx * distance,
      y + ny * distance,
      z + nz * distance,
    );
  }

  return offset;
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

  return createSurfaceMesh(
    scene,
    name,
    positions,
    normals,
    uvs,
    indices,
    material,
    {
      category: "terrain-perimeter",
      estimated: config.estimated,
      source: config.source,
    },
    true,
  );
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

function solveContourX(
  config: TerrainConfig,
  levels: SceneLevels,
  z: number,
  targetY: number,
) {
  const { minX, maxX } = config.bounds;
  const minHeight = terrainHeight(config, levels, minX, z);
  const maxHeight = terrainHeight(config, levels, maxX, z);

  if (targetY < minHeight || targetY > maxHeight) {
    return null;
  }

  let left = minX;
  let right = maxX;

  for (let iteration = 0; iteration < 22; iteration++) {
    const middle = (left + right) / 2;
    if (terrainHeight(config, levels, middle, z) < targetY) {
      left = middle;
    } else {
      right = middle;
    }
  }

  return (left + right) / 2;
}

function createTerrainOutline(
  scene: Scene,
  config: TerrainConfig,
  levels: SceneLevels,
) {
  const { bounds, presentation } = config;
  const south = sampleEdge(
    [bounds.minX, bounds.minZ],
    [bounds.maxX, bounds.minZ],
    presentation.perimeterSampleSpacing,
  );
  const east = sampleEdge(
    [bounds.maxX, bounds.minZ],
    [bounds.maxX, bounds.maxZ],
    presentation.perimeterSampleSpacing,
  ).slice(1);
  const north = sampleEdge(
    [bounds.maxX, bounds.maxZ],
    [bounds.minX, bounds.maxZ],
    presentation.perimeterSampleSpacing,
  ).slice(1);
  const west = sampleEdge(
    [bounds.minX, bounds.maxZ],
    [bounds.minX, bounds.minZ],
    presentation.perimeterSampleSpacing,
  ).slice(1);

  const perimeter = [...south, ...east, ...north, ...west];
  const points = perimeter.map(
    ([x, z]) => new Vector3(x, terrainHeight(config, levels, x, z) + 0.16, z),
  );

  if (points.length > 0) {
    points.push(points[0]!.clone());
  }

  const line = MeshBuilder.CreateLines(
    "terrain-perimeter-outline",
    { points, updatable: false },
    scene,
  );
  line.color = new Color3(0.86, 0.74, 0.48);
  line.alpha = 0.72;
  line.isPickable = false;
  line.checkCollisions = false;
  line.metadata = {
    category: "terrain-perimeter-outline",
    estimated: config.estimated,
  };
  return line;
}

function createTerrainContours(
  scene: Scene,
  config: TerrainConfig,
  levels: SceneLevels,
) {
  const lines: Mesh[] = [];
  const stepZ = 5;
  const interval = Math.max(1, config.presentation.contourInterval);
  const maxContour =
    Math.floor(levels.upperCity.elevation / interval) * interval;

  for (
    let contourY = interval;
    contourY < maxContour;
    contourY += interval
  ) {
    const points: Vector3[] = [];

    for (let z = config.bounds.minZ; z <= config.bounds.maxZ; z += stepZ) {
      const x = solveContourX(config, levels, z, contourY);
      if (x === null) continue;
      points.push(new Vector3(x, contourY + 0.12, z));
    }

    if (points.length < 2) continue;

    const line = MeshBuilder.CreateLines(
      `terrain-contour-${contourY}`,
      { points, updatable: false },
      scene,
    );
    line.color = new Color3(0.72, 0.61, 0.42);
    line.alpha = 0.62;
    line.isPickable = false;
    line.checkCollisions = false;
    line.metadata = {
      category: "terrain-contour",
      elevation: contourY,
      estimated: config.estimated,
    };
    lines.push(line);
  }

  return lines;
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
      const indices: number[] = [];
      const cliffIndices: number[] = [];

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
          const triangles = [a, c, b, b, c, d];
          indices.push(...triangles);

          if (isCliffQuad(config, normals, [a, b, c, d])) {
            cliffIndices.push(...triangles);
          }
        }
      }

      const metadata = {
        category: "terrain",
        source: config.source,
        estimated: config.estimated,
      };

      const surface = createSurfaceMesh(
        scene,
        `terrain-surface-${tx}-${tz}`,
        positions,
        normals,
        uvs,
        indices,
        materials.surface,
        metadata,
        true,
      );
      meshes.push(surface);

      if (cliffIndices.length > 0) {
        const cliff = createSurfaceMesh(
          scene,
          `terrain-cliff-accent-${tx}-${tz}`,
          offsetPositions(
            positions,
            normals,
            config.presentation.cliffOverlayOffset,
          ),
          normals,
          uvs,
          cliffIndices,
          materials.cliff,
          {
            ...metadata,
            category: "terrain-cliff-accent",
          },
          false,
        );
        cliff.isPickable = false;
        meshes.push(cliff);
      }
    }
  }

  meshes.push(...createTerrainStructure(scene, config, levels, materials));
  meshes.push(...createTerrainContours(scene, config, levels));
  meshes.push(createTerrainOutline(scene, config, levels));
  return meshes;
}
