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

export interface TerrainConfig {
  tileSize: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  cliffTransition: {
    lowX: number;
    highX: number;
    lowerY: number;
    upperY: number;
    source: string;
    estimated: boolean;
  };
  source: string;
  estimated: boolean;
}

export interface SceneLevels {
  lowerCity: {
    elevation: number;
    source: string;
    estimated: boolean;
  };
  upperCity: {
    elevation: number;
    source: string;
    estimated: boolean;
  };
}

export interface SceneApi {
  setCamera: (mode: "aerial" | "street") => void;
  setDebug: (enabled: boolean) => void;
  dispose: () => void;
}
