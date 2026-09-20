import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import manifestData from "../../geospatial/manifest.json";
import {
  pointInPolygon,
} from "./geometry-2d";
import { material } from "./materials";
import { terrainHeight } from "./terrain";
import type {
  LinearFeature,
  Point2,
  SceneLevels,
  TerrainConfig,
} from "./types";

const policy =
  manifestData.elevatedCorridorPolicy;

export interface ElevatedCorridorDeck {
  deckY: number;
  anchor: Point2;
  segments: Array<{
    id: string;
    width: number;
    start: Point2;
    end: Point2;
  }>;
  joints: Array<{
    id: string;
    width: number;
    point: Point2;
  }>;
}

function pointInsideProtectedStructure(
  point: Point2,
  protectedFootprints: Point2[][],
) {
  return protectedFootprints.some(
    (footprint) =>
      footprint.length >= 3 &&
      pointInPolygon(
        point,
        footprint,
      ),
  );
}

export function deriveElevatedCorridorDeck(
  corridors: LinearFeature[],
  terrain: TerrainConfig,
  levels: SceneLevels,
  protectedFootprints: Point2[][] = [],
): ElevatedCorridorDeck | null {
  const valid =
    corridors.filter(
      (feature) =>
        feature.points.length >= 2 &&
        Number.isFinite(
          feature.width,
        ) &&
        feature.width > 0,
    );

  if (valid.length === 0) {
    return null;
  }

  const candidates =
    valid
      .flatMap(
        (feature) =>
          feature.points,
      )
      .filter(
        (point) =>
          !pointInsideProtectedStructure(
            point,
            protectedFootprints,
          ),
      );

  if (candidates.length === 0) {
    return null;
  }

  const anchor =
    candidates.reduce(
      (highest, point) =>
        terrainHeight(
          terrain,
          levels,
          point[0],
          point[1],
        ) >
        terrainHeight(
          terrain,
          levels,
          highest[0],
          highest[1],
        )
          ? point
          : highest,
    );
  const deckY =
    terrainHeight(
      terrain,
      levels,
      anchor[0],
      anchor[1],
    ) +
    policy.surfaceGap;

  const segments =
    valid.flatMap(
      (feature) =>
        feature.points.slice(
          0,
          -1,
        ).flatMap(
          (start, index) => {
            const end =
              feature.points[
                index + 1
              ];
            if (
              !end ||
              Math.hypot(
                end[0] -
                  start[0],
                end[1] -
                  start[1],
              ) <= 0.01
            ) {
              return [];
            }

            return [
              {
                id:
                  feature.id +
                  "-segment-" +
                  index,
                width:
                  feature.width,
                start,
                end,
              },
            ];
          },
        ),
    );

  const joints =
    valid.flatMap(
      (feature) =>
        feature.points.map(
          (point, index) => ({
            id:
              feature.id +
              "-joint-" +
              index,
            width:
              feature.width,
            point,
          }),
        ),
    );

  return {
    deckY,
    anchor,
    segments,
    joints,
  };
}

export function createElevatedCorridors(
  scene: Scene,
  corridors: LinearFeature[],
  terrain: TerrainConfig,
  levels: SceneLevels,
  protectedFootprints: Point2[][] = [],
): Mesh[] {
  const deck =
    deriveElevatedCorridorDeck(
      corridors,
      terrain,
      levels,
      protectedFootprints,
    );

  if (!deck) {
    return [];
  }

  const corridorMaterial =
    material(
      scene,
      "elevator",
    );
  const meshes: Mesh[] = [];

  for (
    const segment of
      deck.segments
  ) {
    const dx =
      segment.end[0] -
      segment.start[0];
    const dz =
      segment.end[1] -
      segment.start[1];
    const length =
      Math.hypot(
        dx,
        dz,
      );
    const mesh =
      MeshBuilder.CreateBox(
        segment.id,
        {
          width:
            segment.width,
          depth:
            length + 0.1,
          height:
            policy.deckThickness,
        },
        scene,
      );

    mesh.position.set(
      (
        segment.start[0] +
        segment.end[0]
      ) / 2,
      deck.deckY -
        policy.deckThickness /
          2,
      (
        segment.start[1] +
        segment.end[1]
      ) / 2,
    );
    mesh.rotation.y =
      Math.atan2(
        dx,
        dz,
      );
    mesh.material =
      corridorMaterial;
    mesh.receiveShadows =
      true;
    mesh.checkCollisions =
      true;
    mesh.metadata = {
      category:
        "elevated-osm-corridor",
      walkableSurface: true,
      deckY:
        deck.deckY,
      anchor:
        deck.anchor,
    };
    meshes.push(mesh);
  }

  for (
    const joint of
      deck.joints
  ) {
    const mesh =
      MeshBuilder.CreateCylinder(
        joint.id,
        {
          height:
            policy.deckThickness,
          diameter:
            joint.width,
          tessellation: 16,
        },
        scene,
      );
    mesh.position.set(
      joint.point[0],
      deck.deckY -
        policy.deckThickness /
          2,
      joint.point[1],
    );
    mesh.material =
      corridorMaterial;
    mesh.receiveShadows =
      true;
    mesh.checkCollisions =
      true;
    mesh.metadata = {
      category:
        "elevated-osm-corridor-joint",
      walkableSurface: true,
      deckY:
        deck.deckY,
      anchor:
        deck.anchor,
    };
    meshes.push(mesh);
  }

  return meshes;
}
