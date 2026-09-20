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
  footprint?: Point2[];
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

export interface TerrainProfile {
  z: number;
  toeX: number;
  cliffX: number;
  shoulderX: number;
  lowerOffset?: number;
  upperOffset?: number;
}

export interface TerrainCutout {
  id: string;
  polygon: Point2[];
  elevation: number;
  clearance: number;
  feather: number;
  source: string;
  estimated: boolean;
}

export interface TerrainConfig {
  tileSize: number;
  subdivisionsPerTile: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  profiles: TerrainProfile[];
  cutouts?: TerrainCutout[];
  lowerGrade: {
    risePerMeterX: number;
    maxRise: number;
  };
  upperGrade: {
    risePerMeterX: number;
    risePerMeterZ: number;
    maxVariation: number;
  };
  presentation: {
    baseY: number;
    perimeterSampleSpacing: number;
    textureScale: number;
    rockNormalYMax: number;
    contourInterval: number;
    cliffOverlayOffset: number;
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
