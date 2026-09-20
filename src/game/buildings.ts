import earcut from "earcut";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import type { MeasuredObject, Point2 } from "./types";

function orientTopTriangles(points: Point2[], indices: number[]) {
  if (indices.length < 3) return indices;

  const first = points[indices[0] ?? -1];
  const second = points[indices[1] ?? -1];
  const third = points[indices[2] ?? -1];
  if (!first || !second || !third) return indices;

  const abX = second[0] - first[0];
  const abZ = second[1] - first[1];
  const acX = third[0] - first[0];
  const acZ = third[1] - first[1];
  const normalY = abZ * acX - abX * acZ;

  if (normalY >= 0) return indices;

  const flipped: number[] = [];
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index];
    const b = indices[index + 1];
    const c = indices[index + 2];
    if (a === undefined || b === undefined || c === undefined) continue;
    flipped.push(a, c, b);
  }
  return flipped;
}

function createFootprintBuilding(
  scene: Scene,
  item: MeasuredObject,
  footprint: Point2[],
) {
  const mesh = new Mesh(item.id, scene);
  const bottomY = item.position[1] - item.height / 2;
  const topY = item.position[1] + item.height / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const topIndices = orientTopTriangles(
    footprint,
    earcut(footprint.flatMap(([x, z]) => [x, z])),
  );

  for (const [x, z] of footprint) {
    positions.push(x, bottomY, z);
    uvs.push(0, 0);
  }
  for (const [x, z] of footprint) {
    positions.push(x, topY, z);
    uvs.push(0, 1);
  }

  const count = footprint.length;
  for (let index = 0; index < topIndices.length; index += 3) {
    const a = topIndices[index];
    const b = topIndices[index + 1];
    const c = topIndices[index + 2];
    if (a === undefined || b === undefined || c === undefined) continue;

    indices.push(count + a, count + b, count + c);
    indices.push(c, b, a);
  }

  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    const bottomA = index;
    const bottomB = next;
    const topA = count + index;
    const topB = count + next;
    indices.push(bottomA, topA, bottomB, bottomB, topA, topB);
  }

  VertexData.ComputeNormals(positions, indices, normals);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  return mesh;
}

export function createBuildings(scene: Scene, buildings: MeasuredObject[]) {
  const mats = {
    civic: material(scene, "civic"),
    context: material(scene, "building"),
    "rua-chile": material(scene, "building"),
    market: material(scene, "market"),
  };

  return buildings.map((item) => {
    const mesh =
      item.footprint && item.footprint.length >= 3
        ? createFootprintBuilding(scene, item, item.footprint)
        : MeshBuilder.CreateBox(
            item.id,
            {
              width: item.width,
              depth: item.depth,
              height: item.height,
            },
            scene,
          );

    if (!item.footprint) {
      mesh.position.set(...item.position);
      mesh.rotation.set(...item.rotation);
    }

    mesh.material = mats[item.type as keyof typeof mats] ?? mats.context;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    mesh.metadata = item;
    return mesh;
  });
}
