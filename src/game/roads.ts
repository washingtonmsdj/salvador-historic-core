import earcut from "earcut";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import { terrainHeight } from "./terrain";
import type { LinearFeature, Point2, SceneLevels, TerrainConfig } from "./types";

const ROAD_THICKNESS = 0.32;
const SURFACE_GAP = 0.03;

function elevationAt(
  mode: LinearFeature["elevationMode"],
  x: number,
  z: number,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const surface =
    mode === "upper"
      ? levels.upperCity.elevation
      : mode === "lower"
        ? levels.lowerCity.elevation
        : terrainHeight(terrain, x, z);

  return surface + ROAD_THICKNESS / 2 + SURFACE_GAP;
}

function createSegment(
  scene: Scene,
  feature: LinearFeature,
  a: Point2,
  b: Point2,
  index: number,
  terrain: TerrainConfig,
  levels: SceneLevels,
  roadMaterial: ReturnType<typeof material>,
) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const x = (a[0] + b[0]) / 2;
  const z = (a[1] + b[1]) / 2;
  const mesh = MeshBuilder.CreateBox(
    `${feature.id}-${index}`,
    {
      width: feature.width,
      depth: length,
      height: ROAD_THICKNESS,
    },
    scene,
  );

  mesh.position = new Vector3(
    x,
    elevationAt(feature.elevationMode, x, z, terrain, levels),
    z,
  );
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.material = roadMaterial;
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = feature;
  return mesh;
}

function orientTrianglesUp(points: Point2[], indices: number[]) {
  if (indices.length < 3) return indices;

  const ia = indices[0];
  const ib = indices[1];
  const ic = indices[2];
  if (ia === undefined || ib === undefined || ic === undefined) return indices;

  const a = points[ia];
  const b = points[ib];
  const c = points[ic];
  if (!a || !b || !c) return indices;

  const abX = b[0] - a[0];
  const abZ = b[1] - a[1];
  const acX = c[0] - a[0];
  const acZ = c[1] - a[1];
  const normalY = abZ * acX - abX * acZ;

  if (normalY >= 0) return indices;

  const upward: number[] = [];
  for (let index = 0; index < indices.length; index += 3) {
    const first = indices[index];
    const second = indices[index + 1];
    const third = indices[index + 2];
    if (first === undefined || second === undefined || third === undefined) continue;
    upward.push(first, third, second);
  }
  return upward;
}

function createPolygonSpace(
  scene: Scene,
  space: LinearFeature,
  squareMaterial: ReturnType<typeof material>,
) {
  const points = space.points;
  if (points.length < 3) return null;

  const flat = points.flatMap(([x, z]) => [x, z]);
  const indices = orientTrianglesUp(points, earcut(flat));
  if (indices.length < 3) return null;

  const elevation = (space.elevation ?? 0) + SURFACE_GAP;
  const positions = points.flatMap(([x, z]) => [x, elevation, z]);
  const normals = new Array<number>(positions.length).fill(0);
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = Math.max(0.001, maxX - minX);
  const depth = Math.max(0.001, maxZ - minZ);
  const uvs = points.flatMap(([x, z]) => [(x - minX) / width, (z - minZ) / depth]);

  VertexData.ComputeNormals(positions, indices, normals);

  const mesh = new Mesh(space.id, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = squareMaterial;
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = space;
  return mesh;
}

export function createRoads(
  scene: Scene,
  roads: LinearFeature[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const roadMaterial = material(scene, "road");

  return roads.flatMap((road) =>
    road.points.slice(0, -1).flatMap((point, index) => {
      const nextPoint = road.points[index + 1];
      if (!nextPoint) return [];

      return [
        createSegment(
          scene,
          road,
          point,
          nextPoint,
          index,
          terrain,
          levels,
          roadMaterial,
        ),
      ];
    }),
  );
}

export function createSpaces(scene: Scene, spaces: LinearFeature[]) {
  const squareMaterial = material(scene, "square");

  return spaces.flatMap((space) => {
    const mesh = createPolygonSpace(scene, space, squareMaterial);
    return mesh ? [mesh] : [];
  });
}
