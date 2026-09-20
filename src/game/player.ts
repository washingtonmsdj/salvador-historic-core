import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { terrainHeight } from "./terrain";
import type {
  SceneLevels,
  TerrainConfig,
} from "./types";

export const PLAYER_EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.42;
const PLAYER_HALF_HEIGHT =
  PLAYER_EYE_HEIGHT / 2;
const RECOVERY_DEPTH = 1.5;

export function playerGroundHeight(
  terrain: TerrainConfig,
  levels: SceneLevels,
  x: number,
  z: number,
) {
  return terrainHeight(
    terrain,
    levels,
    x,
    z,
  );
}

export function syncPlayerToTerrain(
  camera: UniversalCamera,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const ground = playerGroundHeight(
    terrain,
    levels,
    camera.position.x,
    camera.position.z,
  );

  camera.position.y =
    ground + PLAYER_EYE_HEIGHT;
}

export function configurePlayer(
  scene: Scene,
  camera: UniversalCamera,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(
    0,
    -0.28,
    0,
  );

  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new Vector3(
    PLAYER_RADIUS,
    PLAYER_HALF_HEIGHT,
    PLAYER_RADIUS,
  );
  camera.ellipsoidOffset =
    new Vector3(
      0,
      -PLAYER_HALF_HEIGHT,
      0,
    );

  syncPlayerToTerrain(
    camera,
    terrain,
    levels,
  );

  const observer =
    scene.onBeforeRenderObservable.add(
      () => {
        if (
          !Number.isFinite(
            camera.position.x,
          ) ||
          !Number.isFinite(
            camera.position.y,
          ) ||
          !Number.isFinite(
            camera.position.z,
          )
        ) {
          return;
        }

        const ground =
          playerGroundHeight(
            terrain,
            levels,
            camera.position.x,
            camera.position.z,
          );

        if (
          camera.position.y <
          ground - RECOVERY_DEPTH
        ) {
          camera.position.y =
            ground +
            PLAYER_EYE_HEIGHT;
        }
      },
    );

  return {
    syncToTerrain: () =>
      syncPlayerToTerrain(
        camera,
        terrain,
        levels,
      ),
    dispose: () => {
      scene.onBeforeRenderObservable.remove(
        observer,
      );
    },
  };
}
