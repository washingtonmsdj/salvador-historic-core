import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";

export function configurePlayer(scene: Scene, camera: UniversalCamera) {
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.28, 0);
  camera.checkCollisions = true;
  camera.applyGravity = true;
}
