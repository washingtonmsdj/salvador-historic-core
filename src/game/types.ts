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
  footprintOsmId?: number;
  foundationBottomY?: number;
  source: string;
  estimated: boolean;
}

export interface DerivedBuildingFootprint {
  id: string;
  name: string;
  buildingType: string;
  footprint: Point2[];
  source: string;
  osmId: number;
  osmType: string;
  tags: Record<string, string>;
  height: number | null;
  heightEstimated: boolean;
  heightSource: string;
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
  widthSource?: string;
  osmId?: number;
  osmType?: string;
  tags?: Record<string, string>;
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

export interface TerrainPlateau {
  id: string;
  polygon: Point2[];
  elevation: number;
  feather: number;
  source: string;
  estimated: boolean;
}

export interface TerrainRenderMask {
  id: string;
  polygon: Point2[];
  padding: number;
  maxBoundaryEdge: number;
  source: string;
}

export interface DerivedTerrainGrid {
  available: boolean;
  source: string | null;
  crs: string;
  units: string;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  grid: null | {
    spacing: number;
    columns: number;
    rows: number;
    vertexCount: number;
  };
  verticalDatum: null | {
    mode: string;
    absoluteElevation: number;
  };
  heights: number[];
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
  plateaus?: TerrainPlateau[];
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
    textureResolution: number;
    detailTextureResolution: number;
    detailTextureTiling: number;
    macroVariationScale: number;
    macroVariationStrength: number;
    microVariationScale: number;
    microVariationStrength: number;
    elevationTintStrength: number;
    concavityTintStrength: number;
    weatheringElevationMax: number;
    weatheringConcavityRadius: number;
    weatheringStrength: number;
    weatheringMinNormalY: number;
    weatheringOverlayOffset: number;
    rockNormalYMax: number;
    rockBlendNormalYBand: number;
    cliffProjectionSharpness: number;
    toneMappingExposure: number;
    toneMappingContrast: number;
    atmosphereFogStart: number;
    atmosphereFogEnd: number;
    atmosphereFogColor: [number, number, number];
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
