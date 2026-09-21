import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import { createExtrudedFootprint } from "./footprint-mesh";
import { material } from "./materials";
import type { MeasuredObject, Point2 } from "./types";

function polygonArea(points: Point2[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    if (!next) return area;
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function addFacadeWindows(
  scene: Scene,
  buildings: MeasuredObject[],
  windowMaterial: ReturnType<typeof material>,
) {
  const windowMesh = MeshBuilder.CreateBox(
    "building-window-detail",
    {
      width: 1,
      height: 0.72,
      depth: 0.06,
    },
    scene,
  );
  windowMesh.material = windowMaterial;
  windowMesh.isPickable = false;
  windowMesh.checkCollisions = false;
  // The source is kept far below the playable area; only its thin instances render.
  windowMesh.position.y = -10000;

  for (const building of buildings) {
    if (!building.footprint || building.footprint.length < 3 || building.height < 5) {
      continue;
    }

    const footprint = building.footprint;
    const clockwise = polygonArea(footprint) < 0;
    const baseY = building.position[1] - building.height / 2;
    const floorCount = Math.min(6, Math.max(1, Math.floor((building.height - 0.8) / 2.8)));

    for (let index = 0; index < footprint.length; index += 1) {
      const start = footprint[index];
      const end = footprint[(index + 1) % footprint.length];
      if (!start || !end) continue;

      const dx = end[0] - start[0];
      const dz = end[1] - start[1];
      const length = Math.hypot(dx, dz);
      if (length < 4.5) continue;

      const count = Math.min(4, Math.max(1, Math.floor(length / 5)));
      const outwardX = clockwise ? -dz / length : dz / length;
      const outwardZ = clockwise ? dx / length : -dx / length;
      const angle = Math.atan2(dz, dx);
      const windowWidth = Math.min(1.25, (length / (count + 1)) * 0.42);

      for (let floor = 0; floor < floorCount; floor += 1) {
        const centerY = baseY + 1.55 + floor * 2.8;
        if (centerY + 0.4 > baseY + building.height - 0.15) continue;

        for (let windowIndex = 0; windowIndex < count; windowIndex += 1) {
          const progress = (windowIndex + 1) / (count + 1);
          const x = start[0] + dx * progress + outwardX * 0.045;
          const z = start[1] + dz * progress + outwardZ * 0.045;
          const transform = Matrix.Compose(
            new Vector3(windowWidth, 1, 1),
            Quaternion.FromEulerAngles(0, -angle, 0),
            new Vector3(x, centerY, z),
          );
          windowMesh.thinInstanceAdd(transform);
        }
      }
    }
  }

  return windowMesh;
}

export function createBuildings(scene: Scene, buildings: MeasuredObject[]) {
  const mats = {
    civic: material(scene, "civic"),
    context: material(scene, "building"),
    "rua-chile": material(scene, "building"),
    market: material(scene, "market"),
    foundation: material(scene, "wall"),
    roof: material(scene, "roof"),
    window: material(scene, "window"),
  };

  const meshes = buildings.flatMap((item) => {
    const mesh =
      item.footprint && item.footprint.length >= 3
        ? createExtrudedFootprint(
            scene,
            item.id,
            item.footprint,
            item.position[1] - item.height / 2,
            item.position[1] + item.height / 2,
          )
        : MeshBuilder.CreateBox(
            item.id,
            {
              width: item.width,
              depth: item.depth,
              height: item.height,
            },
            scene,
          );

    if (!item.footprint) {
      mesh.position.set(...item.position);
      mesh.rotation.set(...item.rotation);
    }

    mesh.material = mats[item.type as keyof typeof mats] ?? mats.context;
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;
    mesh.metadata = item;

    const itemMeshes = [mesh];
    const buildingBase =
      item.position[1] -
      item.height / 2;

    if (item.footprint && item.footprint.length >= 3 && item.height >= 5) {
      const roof = createExtrudedFootprint(
        scene,
        item.id + "-roof-cap",
        item.footprint,
        item.position[1] + item.height / 2 + 0.02,
        item.position[1] + item.height / 2 + 0.18,
      );
      roof.material = mats.roof;
      roof.isPickable = false;
      roof.checkCollisions = false;
      roof.receiveShadows = true;
      roof.metadata = {
        category: "building-roof-cap",
        buildingId: item.id,
      };
      itemMeshes.push(roof);
    }

    if (
      item.footprint &&
      item.footprint.length >= 3 &&
      typeof item.foundationBottomY === "number" &&
      Number.isFinite(item.foundationBottomY) &&
      item.foundationBottomY <
        buildingBase - 0.05
    ) {
      const foundation =
        createExtrudedFootprint(
          scene,
          item.id + "-foundation",
          item.footprint,
          item.foundationBottomY,
          buildingBase,
        );
      foundation.material =
        mats.foundation;
      foundation.checkCollisions =
        true;
      foundation.receiveShadows =
        true;
      foundation.metadata = {
        category:
          "building-foundation",
        buildingId:
          item.id,
        foundationBottomY:
          item.foundationBottomY,
        foundationTopY:
          buildingBase,
      };
      itemMeshes.unshift(
        foundation,
      );
    }

    return itemMeshes;
  });

  const windowMesh = addFacadeWindows(scene, buildings, mats.window);
  meshes.push(windowMesh);
  return meshes;
}
