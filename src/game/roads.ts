import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import { terrainHeight } from "./terrain";
import type { LinearFeature } from "./types";

function elevationAt(mode: LinearFeature["elevationMode"], x: number, z: number) {
  if (mode === "upper") return 72.45;
  if (mode === "lower") return 0.55;
  return terrainHeight(x, z) + 0.35;
}

function createSegment(scene: Scene, feature: LinearFeature, a: [number, number], b: [number, number], index: number) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const x = (a[0] + b[0]) / 2;
  const z = (a[1] + b[1]) / 2;
  const mesh = MeshBuilder.CreateBox(`${feature.id}-${index}`, { width: feature.width, depth: length, height: 0.45 }, scene);
  mesh.position = new Vector3(x, elevationAt(feature.elevationMode, x, z), z);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.material = material(scene, "road");
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = feature;
  return mesh;
}

export function createRoads(scene: Scene, roads: LinearFeature[]) {
  return roads.flatMap((road) => road.points.slice(0, -1).map((point, index) => createSegment(scene, road, point, road.points[index + 1], index)));
}

export function createSpaces(scene: Scene, spaces: LinearFeature[]) {
  return spaces.map((space) => {
    const xs = space.points.map(([x]) => x);
    const zs = space.points.map(([, z]) => z);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    const mesh = MeshBuilder.CreateBox(space.id, { width, depth, height: 0.35 }, scene);
    mesh.position.set((Math.min(...xs) + Math.max(...xs)) / 2, (space.elevation ?? 0) + 0.18, (Math.min(...zs) + Math.max(...zs)) / 2);
    mesh.material = material(scene, "square");
    mesh.receiveShadows = true;
    mesh.checkCollisions = true;
    mesh.metadata = space;
    return mesh;
  });
}
