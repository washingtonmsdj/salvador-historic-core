export type Vec3Tuple = [number, number, number];
export type Point2 = [number, number];

export interface MeasuredObject {
  id: string;
  name: string;
  type: string;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  width: number;
  depth: number;
  height: number;
  source: string;
  estimated: boolean;
}

export interface LinearFeature {
  id: string;
  name: string;
  type: string;
  width: number;
  source: string;
  estimated: boolean;
  points: Point2[];
  elevationMode?: "upper" | "lower" | "terrain";
  elevation?: number;
}

export interface SceneApi {
  setCamera: (mode: "aerial" | "street") => void;
  setDebug: (enabled: boolean) => void;
  dispose: () => void;
}
