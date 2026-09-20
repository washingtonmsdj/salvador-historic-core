import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import type { MeasuredObject } from "./types";

export function createBuildings(scene: Scene, buildings: MeasuredObject[]) {
  const mats = {
    civic: material(scene, "civic"),
    context: material(scene, "building"),
    "rua-chile": material(scene, "building"),
    market: material(scene, "market"),
  };
  return buildings.map((item) => {
    const mesh = MeshBuilder.CreateBox(item.id, {
      width: item.width,
      depth: item.depth,
      height: item.height,
    }, scene);
    mesh.position.set(item.position[0], item.position[1] - item.height / 2, item.position[2]);
    mesh.rotation.set(...item.rotation);
    mesh.material = mats[item.type as keyof typeof mats] ?? mats.context;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    mesh.metadata = item;
    return mesh;
  });
}
