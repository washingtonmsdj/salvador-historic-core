import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { Point2 } from "./types";

export function createMissionMarker(scene: Scene, surfaceAt: (x: number, z: number) => number) {
  const ring = MeshBuilder.CreateTorus(
    "mission-marker-ring",
    {
      diameter: 4.2,
      thickness: 0.22,
      tessellation: 28,
    },
    scene,
  );
  const beacon = MeshBuilder.CreateCylinder(
    "mission-marker-beacon",
    {
      height: 7,
      diameterTop: 0.08,
      diameterBottom: 0.34,
      tessellation: 16,
    },
    scene,
  );

  const markerMaterial = new StandardMaterial("mission-marker-material", scene);
  markerMaterial.diffuseColor = Color3.FromHexString("#d8a84e");
  markerMaterial.emissiveColor = Color3.FromHexString("#d8a84e");
  markerMaterial.specularColor = Color3.Black();
  markerMaterial.alpha = 0.88;
  ring.material = markerMaterial;
  beacon.material = markerMaterial;
  ring.isPickable = false;
  beacon.isPickable = false;

  const setTarget = (target: Point2 | null) => {
    if (!target) {
      ring.setEnabled(false);
      beacon.setEnabled(false);
      return;
    }

    const y = surfaceAt(target[0], target[1]);
    ring.position.set(target[0], y + 0.2, target[1]);
    beacon.position.set(target[0], y + 3.5, target[1]);
    ring.setEnabled(true);
    beacon.setEnabled(true);
  };

  setTarget(null);

  return {
    setTarget,
    dispose: () => {
      ring.dispose();
      beacon.dispose();
      markerMaterial.dispose();
    },
  };
}
