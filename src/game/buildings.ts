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
    const mesh = MeshBuilder.CreateBox(
      item.id,
      {
        width: item.width,
        depth: item.depth,
        height: item.height,
      },
      scene,
    );

    // site-data uses object-center coordinates consistently. Keeping that
    // convention avoids silently sinking buildings by half their height.
    mesh.position.set(...item.position);
    mesh.rotation.set(...item.rotation);
    mesh.material = mats[item.type as keyof typeof mats] ?? mats.context;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    mesh.metadata = item;
    return mesh;
  });
}
