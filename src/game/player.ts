import { Ray } from "@babylonjs/core/Culling/ray";
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
const SURFACE_SYNC_CLEARANCE = 0.03;
const SURFACE_RAY_HEIGHT = 120;
const SURFACE_RAY_LENGTH = 260;

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

function walkableSurfaceHeight(
  scene: Scene,
  terrain: TerrainConfig,
  levels: SceneLevels,
  x: number,
  z: number,
) {
  const fallback =
    playerGroundHeight(
      terrain,
      levels,
      x,
      z,
    );
  const originY =
    Math.max(
      SURFACE_RAY_HEIGHT,
      fallback +
        SURFACE_RAY_HEIGHT,
    );
  const ray = new Ray(
    new Vector3(
      x,
      originY,
      z,
    ),
    new Vector3(0, -1, 0),
    SURFACE_RAY_LENGTH,
  );
  const hit =
    scene.pickWithRay(
      ray,
      (mesh) =>
        mesh.checkCollisions &&
        mesh.metadata?.walkableSurface ===
          true,
      false,
    );

  if (
    hit?.hit &&
    hit.pickedPoint
  ) {
    return hit.pickedPoint.y;
  }

  return fallback;
}

export function syncPlayerToWalkableSurface(
  scene: Scene,
  camera: UniversalCamera,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const surface =
    walkableSurfaceHeight(
      scene,
      terrain,
      levels,
      camera.position.x,
      camera.position.z,
    );

  camera.position.y =
    surface +
    PLAYER_EYE_HEIGHT +
    SURFACE_SYNC_CLEARANCE;
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

  syncPlayerToWalkableSurface(
    scene,
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
          syncPlayerToWalkableSurface(
            scene,
            camera,
            terrain,
            levels,
          );
        }
      },
    );

  return {
    syncToTerrain: () =>
      syncPlayerToWalkableSurface(
        scene,
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
