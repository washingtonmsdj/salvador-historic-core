import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { material } from "./materials";
import { terrainHeight } from "./terrain";
import type {
  LinearFeature,
  SceneLevels,
  TerrainConfig,
} from "./types";

const ROAD_THICKNESS = 0.32;
const SPACE_THICKNESS = 0.35;
const SURFACE_GAP = 0.03;

function elevationAt(
  mode: LinearFeature["elevationMode"],
  x: number,
  z: number,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const surface =
    mode === "upper"
      ? levels.upperCity.elevation
      : mode === "lower"
        ? levels.lowerCity.elevation
        : terrainHeight(terrain, x, z);

  return surface + ROAD_THICKNESS / 2 + SURFACE_GAP;
}

function createSegment(
  scene: Scene,
  feature: LinearFeature,
  a: [number, number],
  b: [number, number],
  index: number,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const x = (a[0] + b[0]) / 2;
  const z = (a[1] + b[1]) / 2;
  const mesh = MeshBuilder.CreateBox(
    `${feature.id}-${index}`,
    {
      width: feature.width,
      depth: length,
      height: ROAD_THICKNESS,
    },
    scene,
  );

  mesh.position = new Vector3(
    x,
    elevationAt(feature.elevationMode, x, z, terrain, levels),
    z,
  );
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.material = material(scene, "road");
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = feature;
  return mesh;
}

export function createRoads(
  scene: Scene,
  roads: LinearFeature[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  return roads.flatMap((road) =>
    road.points
      .slice(0, -1)
      .map((point, index) =>
        createSegment(
          scene,
          road,
          point,
          road.points[index + 1],
          index,
          terrain,
          levels,
        ),
      ),
  );
}

export function createSpaces(scene: Scene, spaces: LinearFeature[]) {
  return spaces.map((space) => {
    const xs = space.points.map(([x]) => x);
    const zs = space.points.map(([, z]) => z);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    const mesh = MeshBuilder.CreateBox(
      space.id,
      { width, depth, height: SPACE_THICKNESS },
      scene,
    );

    mesh.position.set(
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (space.elevation ?? 0) + SPACE_THICKNESS / 2 + SURFACE_GAP,
      (Math.min(...zs) + Math.max(...zs)) / 2,
    );
    mesh.material = material(scene, "square");
    mesh.receiveShadows = true;
    mesh.checkCollisions = true;
    mesh.metadata = space;
    return mesh;
  });
}
