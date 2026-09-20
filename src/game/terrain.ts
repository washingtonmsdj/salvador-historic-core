import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import type { TerrainConfig } from "./types";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function terrainHeight(config: TerrainConfig, x: number, _z: number) {
  const { lowX, highX, lowerY, upperY } = config.cliffTransition;
  const span = Math.max(0.001, highX - lowX);
  const slope = clamp01((x - lowX) / span);
  const smooth = slope * slope * (3 - 2 * slope);
  return lowerY + (upperY - lowerY) * smooth;
}

export function createTerrain(scene: Scene, config: TerrainConfig) {
  const meshes: Mesh[] = [];
  const { tileSize, bounds } = config;
  const steps = 8;
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
          positions.push(x, terrainHeight(config, x, z), z);
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

      VertexData.ComputeNormals(positions, indices, normals);
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
