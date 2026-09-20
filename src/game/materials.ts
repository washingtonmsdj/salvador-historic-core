import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";

const COLORS = {
  terrain: "#667468",
  road: "#686d6b",
  square: "#d5cbb7",
  building: "#c6aa7b",
  civic: "#b89462",
  market: "#a77a50",
  elevator: "#d8d1bd",
  elevatorAccent: "#c54f3d",
  wall: "#73706b",
  estimated: "#d89a3d",
};

export function material(scene: Scene, name: keyof typeof COLORS, alpha = 1) {
  const mat = new StandardMaterial(`mat-${name}-${alpha}`, scene);
  const baseColor = Color3.FromHexString(COLORS[name]);
  mat.diffuseColor = baseColor;
  mat.emissiveColor = baseColor.scale(name === "terrain" ? 0.16 : 0.045);
  mat.specularColor = new Color3(0.08, 0.08, 0.08);
  mat.alpha = alpha;
  return mat;
}
