import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import type { Scene } from "@babylonjs/core/scene";
import { terrainHeight } from "./terrain";
import type {
  DerivedBuildingFootprint,
  SceneLevels,
  TerrainConfig,
} from "./types";

export function createBuildingFootprintGuides(
  scene: Scene,
  buildings: DerivedBuildingFootprint[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const guides: LinesMesh[] = [];

  for (const building of buildings) {
    if (building.footprint.length < 3) {
      continue;
    }

    const points = building.footprint.map(
      ([x, z]) =>
        new Vector3(
          x,
          terrainHeight(
            terrain,
            levels,
            x,
            z,
          ) + 0.16,
          z,
        ),
    );

    const first = points[0];
    if (first) {
      points.push(first.clone());
    }

    const guide = MeshBuilder.CreateLines(
      `osm-footprint-guide-${building.osmId}`,
      { points },
      scene,
    );
    guide.color = new Color3(
      0.92,
      0.73,
      0.36,
    );
    guide.alpha = 0.9;
    guide.isPickable = false;
    guide.checkCollisions = false;
    guide.metadata = {
      category: "osm-building-footprint-guide",
      source: building.source,
      osmId: building.osmId,
      name: building.name,
      height: building.height,
      heightEstimated:
        building.heightEstimated,
    };
    guides.push(guide);
  }

  return guides;
}
