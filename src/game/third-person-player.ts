import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import {
  PLAYER_EYE_HEIGHT,
  walkableSurfaceHeight,
} from "./player";
import type {
  Point2,
  SceneLevels,
  TerrainConfig,
} from "./types";

export const THIRD_PERSON_PLAYER_HEIGHT = 1.8;
const PLAYER_HEIGHT =
  THIRD_PERSON_PLAYER_HEIGHT;
const PLAYER_RADIUS = 0.36;
const PLAYER_HALF_HEIGHT =
  PLAYER_HEIGHT / 2;
const SURFACE_CLEARANCE = 0.025;
const WALK_SPEED = 4.2;
const RUN_SPEED = 6.5;
const MAX_FRAME_SECONDS = 0.05;

export interface ThirdPersonInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export function thirdPersonMovementDirection(
  cameraForward: readonly [
    number,
    number,
  ],
  input: ThirdPersonInputState,
): [number, number] {
  let forwardX =
    cameraForward[0];
  let forwardZ =
    cameraForward[1];
  const forwardLength =
    Math.hypot(
      forwardX,
      forwardZ,
    );

  if (forwardLength <= 0.000001) {
    forwardX = 0;
    forwardZ = 1;
  } else {
    forwardX /= forwardLength;
    forwardZ /= forwardLength;
  }

  const rightX = forwardZ;
  const rightZ = -forwardX;
  let x = 0;
  let z = 0;

  if (input.forward) {
    x += forwardX;
    z += forwardZ;
  }
  if (input.backward) {
    x -= forwardX;
    z -= forwardZ;
  }
  if (input.left) {
    x -= rightX;
    z -= rightZ;
  }
  if (input.right) {
    x += rightX;
    z += rightZ;
  }

  const length =
    Math.hypot(x, z);
  if (length <= 0.000001) {
    return [0, 0];
  }

  return [
    x / length,
    z / length,
  ];
}

function keyInput(
  keys: ReadonlySet<string>,
): ThirdPersonInputState {
  return {
    forward:
      keys.has("KeyW") ||
      keys.has("ArrowUp"),
    backward:
      keys.has("KeyS") ||
      keys.has("ArrowDown"),
    left:
      keys.has("KeyA") ||
      keys.has("ArrowLeft"),
    right:
      keys.has("KeyD") ||
      keys.has("ArrowRight"),
  };
}

export function createThirdPersonPlayer({
  scene,
  camera,
  spawn,
  terrain,
  levels,
}: {
  scene: Scene;
  camera: ArcRotateCamera;
  spawn: Point2;
  terrain: TerrainConfig;
  levels: SceneLevels;
}) {
  const player =
    MeshBuilder.CreateCapsule(
      "player-third-person",
      {
        height: PLAYER_HEIGHT,
        radius: PLAYER_RADIUS,
        tessellation: 16,
        subdivisions: 4,
      },
      scene,
    );

  player.material =
    material(
      scene,
      "player",
    );
  player.isPickable = false;
  player.receiveShadows = true;
  player.checkCollisions = true;
  player.ellipsoid =
    new Vector3(
      PLAYER_RADIUS,
      PLAYER_HALF_HEIGHT,
      PLAYER_RADIUS,
    );
  player.ellipsoidOffset =
    Vector3.Zero();
  player.metadata = {
    category:
      "third-person-player",
    realHeightMeters:
      PLAYER_HEIGHT,
  };

  const keys =
    new Set<string>();
  let active = false;

  const surfaceAt = (
    x: number,
    z: number,
  ) =>
    walkableSurfaceHeight(
      scene,
      terrain,
      levels,
      x,
      z,
    );

  const syncToTerrain = () => {
    const surface =
      surfaceAt(
        player.position.x,
        player.position.z,
      );
    player.position.y =
      surface +
      PLAYER_HALF_HEIGHT +
      SURFACE_CLEARANCE;
  };

  const setHorizontalPosition = (
    x: number,
    z: number,
  ) => {
    player.position.x = x;
    player.position.z = z;
    syncToTerrain();
  };

  setHorizontalPosition(
    spawn[0],
    spawn[1],
  );

  camera.lockedTarget =
    player;
  player.setEnabled(false);

  const onKeyDown = (
    event: KeyboardEvent,
  ) => {
    if (!active) {
      return;
    }

    if (
      event.code.startsWith(
        "Arrow",
      )
    ) {
      event.preventDefault();
    }
    keys.add(event.code);
  };

  const onKeyUp = (
    event: KeyboardEvent,
  ) => {
    keys.delete(event.code);
  };

  window.addEventListener(
    "keydown",
    onKeyDown,
  );
  window.addEventListener(
    "keyup",
    onKeyUp,
  );

  const observer =
    scene.onBeforeRenderObservable.add(
      () => {
        if (!active) {
          return;
        }

        const forward =
          camera
            .getForwardRay(1)
            .direction;
        const [moveX, moveZ] =
          thirdPersonMovementDirection(
            [
              forward.x,
              forward.z,
            ],
            keyInput(keys),
          );

        if (
          Math.abs(moveX) >
            0.000001 ||
          Math.abs(moveZ) >
            0.000001
        ) {
          const seconds =
            Math.min(
              MAX_FRAME_SECONDS,
              scene
                .getEngine()
                .getDeltaTime() /
                1000,
            );
          const speed =
            keys.has(
              "ShiftLeft",
            ) ||
            keys.has(
              "ShiftRight",
            )
              ? RUN_SPEED
              : WALK_SPEED;

          player.moveWithCollisions(
            new Vector3(
              moveX *
                speed *
                seconds,
              0,
              moveZ *
                speed *
                seconds,
            ),
          );
          syncToTerrain();
          player.rotation.y =
            Math.atan2(
              moveX,
              moveZ,
            );
        }
      },
    );

  return {
    mesh: player,
    setActive: (
      next: boolean,
    ) => {
      active = next;
      player.setEnabled(
        next,
      );
      if (!next) {
        keys.clear();
      } else {
        syncToTerrain();
      }
    },
    syncToTerrain,
    syncFromStreetCamera: (
      street: UniversalCamera,
    ) => {
      setHorizontalPosition(
        street.position.x,
        street.position.z,
      );
    },
    syncStreetCamera: (
      street: UniversalCamera,
    ) => {
      const surface =
        surfaceAt(
          player.position.x,
          player.position.z,
        );
      street.position.set(
        player.position.x,
        surface +
          PLAYER_EYE_HEIGHT +
          SURFACE_CLEARANCE,
        player.position.z,
      );

      const forward =
        new Vector3(
          Math.sin(
            player.rotation.y,
          ),
          0,
          Math.cos(
            player.rotation.y,
          ),
        );
      street.setTarget(
        street.position.add(
          forward,
        ),
      );
    },
    dispose: () => {
      window.removeEventListener(
        "keydown",
        onKeyDown,
      );
      window.removeEventListener(
        "keyup",
        onKeyUp,
      );
      scene.onBeforeRenderObservable.remove(
        observer,
      );
      player.dispose();
    },
  };
}
