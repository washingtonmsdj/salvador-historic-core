import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Point2 } from "./types";

export function createCameras(
  scene: Scene,
  canvas: HTMLCanvasElement,
  streetSpawn: Point2,
) {
  const aerial = new ArcRotateCamera(
    "camera-aerea",
    -1.22,
    0.88,
    410,
    new Vector3(0, 26, 0),
    scene,
  );
  aerial.lowerRadiusLimit = 145;
  aerial.upperRadiusLimit = 650;
  aerial.wheelPrecision = 4;
  aerial.panningSensibility = 80;
  aerial.attachControl(canvas, true);

  const thirdPerson = new ArcRotateCamera(
    "camera-terceira-pessoa",
    -Math.PI / 2,
    1.02,
    6,
    new Vector3(
      streetSpawn[0],
      1.1,
      streetSpawn[1],
    ),
    scene,
  );
  thirdPerson.lowerRadiusLimit = 3.2;
  thirdPerson.upperRadiusLimit = 10;
  thirdPerson.lowerBetaLimit = 0.55;
  thirdPerson.upperBetaLimit = 1.35;
  thirdPerson.wheelPrecision = 22;
  thirdPerson.panningSensibility = 0;
  thirdPerson.inertia = 0.72;
  thirdPerson.minZ = 0.12;
  thirdPerson.checkCollisions = true;
  thirdPerson.collisionRadius =
    new Vector3(0.28, 0.28, 0.28);

  const street = new UniversalCamera(
    "camera-praca",
    new Vector3(
      streetSpawn[0],
      2,
      streetSpawn[1],
    ),
    scene,
  );
  street.setTarget(
    new Vector3(0, 2, 0),
  );
  street.speed = 1.1;
  street.angularSensibility = 2500;
  street.inertia = 0.72;
  street.minZ = 0.15;
  street.checkCollisions = true;
  street.applyGravity = true;
  street.ellipsoid = new Vector3(0.6, 1.75, 0.6);
  street.ellipsoidOffset = new Vector3(0, -0.85, 0);
  street.keysUp = [87, 38];
  street.keysDown = [83, 40];
  street.keysLeft = [65, 37];
  street.keysRight = [68, 39];

  const activate = (
    mode:
      | "aerial"
      | "street"
      | "thirdPerson",
  ) => {
    aerial.detachControl();
    street.detachControl();
    thirdPerson.detachControl();

    if (mode === "aerial") {
      scene.activeCamera = aerial;
      aerial.attachControl(
        canvas,
        true,
      );
    } else if (
      mode === "thirdPerson"
    ) {
      scene.activeCamera =
        thirdPerson;
      thirdPerson.attachControl(
        canvas,
        true,
      );
    } else {
      scene.activeCamera = street;
      street.attachControl(
        canvas,
        true,
      );
    }
  };

  activate("aerial");

  return {
    aerial,
    street,
    thirdPerson,
    activate,
  };
}
