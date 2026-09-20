import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { createExtrudedFootprint } from "./footprint-mesh";
import { material } from "./materials";
import type { MeasuredObject } from "./types";

export const ELEVATOR_GLB_PATH = "/models/elevador_lacerda.glb";

export function createElevatorBlockout(scene: Scene, parts: MeasuredObject[]) {
  const elevatorMaterial = material(scene, "elevator");
  const accentMaterial = material(scene, "elevatorAccent");

  return parts.map((part) => {
    const mesh =
      part.footprint && part.footprint.length >= 3
        ? createExtrudedFootprint(
            scene,
            part.id,
            part.footprint,
            part.position[1] - part.height / 2,
            part.position[1] + part.height / 2,
          )
        : MeshBuilder.CreateBox(
            part.id,
            {
              width: part.width,
              depth: part.depth,
              height: part.height,
            },
            scene,
          );

    if (!part.footprint) {
      mesh.position.set(...part.position);
      mesh.rotation.set(...part.rotation);
    }

    mesh.material =
      part.type === "elevator-tower" ? accentMaterial : elevatorMaterial;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    mesh.metadata = part;
    return mesh;
  });
}

export async function replaceElevatorWithGlb(scene: Scene) {
  return SceneLoader.ImportMeshAsync(
    "",
    "/models/",
    "elevador_lacerda.glb",
    scene,
  );
}

export function createConnectionPoints(scene: Scene, points: MeasuredObject[]) {
  const pointMaterial = material(scene, "elevatorAccent");

  return points.map((point) => {
    const mesh =
      point.id === "elevatorPath"
        ? MeshBuilder.CreateCylinder(
            point.id,
            { height: point.height, diameter: 1.5 },
            scene,
          )
        : MeshBuilder.CreateSphere(point.id, { diameter: 2.8 }, scene);

    mesh.position = Vector3.FromArray(point.position);
    mesh.material = pointMaterial;
    mesh.isVisible = false;
    mesh.metadata = point;
    return mesh;
  });
}
