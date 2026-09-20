import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { createExtrudedFootprint } from "./footprint-mesh";
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
    const mesh =
      item.footprint && item.footprint.length >= 3
        ? createExtrudedFootprint(
            scene,
            item.id,
            item.footprint,
            item.position[1] - item.height / 2,
            item.position[1] + item.height / 2,
          )
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
