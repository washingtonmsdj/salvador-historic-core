import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import type { MeasuredObject } from "./types";

export function createBarriers(scene: Scene, barriers: MeasuredObject[]) {
  const wallMaterial = material(scene, "wall");

  return barriers.map((item) => {
    const mesh = MeshBuilder.CreateBox(
      item.id,
      {
        width: item.width,
        depth: item.depth,
        height: item.height,
      },
      scene,
    );

    mesh.position.set(...item.position);
    mesh.rotation.set(...item.rotation);
    mesh.material = wallMaterial;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    mesh.metadata = item;
    return mesh;
  });
}
