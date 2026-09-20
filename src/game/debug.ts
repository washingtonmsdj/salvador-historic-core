import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { MeasuredObject } from "./types";

function label(
  scene: Scene,
  item: MeasuredObject,
) {
  const coordinateLabel =
    item.type === "coordinate-corner";
  const plane = MeshBuilder.CreatePlane(
    `label-${item.id}`,
    {
      width: coordinateLabel ? 66 : 30,
      height: coordinateLabel ? 6 : 5,
    },
    scene,
  );
  plane.position = new Vector3(
    item.position[0],
    item.position[1] +
      item.height / 2 +
      4,
    item.position[2],
  );
  plane.billboardMode =
    Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const texture = new DynamicTexture(
    `label-texture-${item.id}`,
    {
      width: 768,
      height: 128,
    },
    scene,
    false,
  );
  texture.hasAlpha = true;
  texture.drawText(
    `${item.name}${
      item.estimated
        ? " · ESTIMATED"
        : ""
    }`,
    24,
    78,
    coordinateLabel
      ? "bold 22px monospace"
      : "bold 29px monospace",
    item.estimated
      ? "#ffbd59"
      : "#f5f1e8",
    "transparent",
    true,
  );

  const material =
    new StandardMaterial(
      `label-mat-${item.id}`,
      scene,
    );
  material.diffuseTexture = texture;
  material.emissiveColor =
    Color3.White();
  material.opacityTexture = texture;
  material.backFaceCulling = false;
  plane.material = material;
  plane.isVisible = false;
  return plane;
}

function disposeLabel(mesh: Mesh) {
  mesh.material?.dispose(
    true,
    true,
  );
  mesh.dispose();
}

export function createDebug(
  scene: Scene,
  items: MeasuredObject[],
) {
  const axes = new AxesViewer(
    scene,
    28,
  );
  const grid = MeshBuilder.CreateGround(
    "debug-grid",
    {
      width: 420,
      height: 620,
      subdivisions: 42,
    },
    scene,
  );
  const gridMat =
    new StandardMaterial(
      "debug-grid-material",
      scene,
    );
  gridMat.wireframe = true;
  gridMat.emissiveColor =
    new Color3(
      0.35,
      0.52,
      0.55,
    );
  gridMat.alpha = 0.36;
  grid.material = gridMat;
  grid.position.y = 0.12;
  grid.isPickable = false;

  let enabled = false;
  let labels = items.map(
    (item) => label(scene, item),
  );

  axes.xAxis.isVisible =
    axes.yAxis.isVisible =
    axes.zAxis.isVisible =
      false;
  grid.isVisible = false;

  const setEnabled = (
    nextEnabled: boolean,
  ) => {
    enabled = nextEnabled;
    axes.xAxis.isVisible =
      axes.yAxis.isVisible =
      axes.zAxis.isVisible =
        enabled;
    grid.isVisible = enabled;
    labels.forEach((mesh) => {
      mesh.isVisible = enabled;
    });
  };

  const setItems = (
    nextItems: MeasuredObject[],
  ) => {
    labels.forEach(disposeLabel);
    labels = nextItems.map(
      (item) => label(scene, item),
    );
    labels.forEach((mesh) => {
      mesh.isVisible = enabled;
    });
  };

  return {
    setEnabled,
    setItems,
  };
}
