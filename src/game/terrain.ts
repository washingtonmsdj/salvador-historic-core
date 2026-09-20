import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";

export const terrainHeight = (x: number, z: number) => {
  const slope = Math.max(0, Math.min(1, (x + 18) / 44));
  const smooth = slope * slope * (3 - 2 * slope);
  const ravineVariation = Math.sin(z * 0.018) * 1.4 * (1 - Math.abs(slope - 0.5) * 2);
  return smooth * 72 + ravineVariation;
};

export function createTerrain(scene: Scene) {
  const meshes: Mesh[] = [];
  const tileSize = 80;
  const minX = -120, maxX = 200, minZ = -360, maxZ = 280;
  const steps = 8;
  const terrainMaterial = material(scene, "terrain");

  for (let tx = minX; tx < maxX; tx += tileSize) {
    for (let tz = minZ; tz < maxZ; tz += tileSize) {
      const mesh = new Mesh(`terrain-tile-${tx}-${tz}`, scene);
      const positions: number[] = [];
      const indices: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      for (let iz = 0; iz <= steps; iz++) {
        for (let ix = 0; ix <= steps; ix++) {
          const x = tx + (ix / steps) * tileSize;
          const z = tz + (iz / steps) * tileSize;
          positions.push(x, terrainHeight(x, z), z);
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
      vertexData.positions = positions; vertexData.indices = indices; vertexData.normals = normals; vertexData.uvs = uvs;
      vertexData.applyToMesh(mesh);
      mesh.material = terrainMaterial;
      mesh.receiveShadows = true;
      mesh.checkCollisions = true;
      mesh.metadata = { category: "terrain", estimated: true };
      meshes.push(mesh);
    }
  }
  return meshes;
}
