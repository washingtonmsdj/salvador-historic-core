import earcut from "earcut";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import manifestData from "../../geospatial/manifest.json";
import { material } from "./materials";
import { roadMaterialFor } from "./road-materials";
import { terrainHeight } from "./terrain";
import type { LinearFeature, Point2, SceneLevels, TerrainConfig } from "./types";

const roadSurfacePolicy =
  manifestData.roadSurfacePolicy;

const SURFACE_GAP =
  roadSurfacePolicy.surfaceGap;
const ROAD_SAMPLE_SPACING =
  roadSurfacePolicy.sampleSpacing;
const TEXTURE_REPEAT_METERS =
  roadSurfacePolicy.textureRepeatMeters;
const MAX_MITER_SCALE =
  roadSurfacePolicy.maxMiterScale;
const MAX_CROSS_SLOPE =
  roadSurfacePolicy.maxCrossSlope;
const MAX_GRADE_SMOOTHING_DEVIATION =
  roadSurfacePolicy.maxGradeSmoothingDeviation;
const MAX_CROSS_SLOPE_CORRECTION_RELIEF =
  roadSurfacePolicy.maxCrossSlopeCorrectionRelief;

function elevationAt(
  x: number,
  z: number,
  terrain: TerrainConfig,
  levels: SceneLevels,
  mode: LinearFeature["elevationMode"] = "terrain",
) {
  if (mode === "upper") {
    return levels.upperCity.elevation + SURFACE_GAP;
  }
  if (mode === "lower") {
    return levels.lowerCity.elevation + SURFACE_GAP;
  }
  return terrainHeight(terrain, levels, x, z) + SURFACE_GAP;
}

function samplePolyline(
  points: Point2[],
  spacing: number,
) {
  if (points.length < 2) return [...points];

  const sampled: Point2[] = [];

  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) continue;

    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(
      1,
      Math.ceil(distance / spacing),
    );

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      sampled.push([a[0] + dx * t, a[1] + dz * t]);
    }
  }

  const last = points[points.length - 1];
  if (last) sampled.push(last);
  return sampled;
}

function direction(
  a: Point2,
  b: Point2,
) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);

  if (length <= 0.000001) {
    return [0, 1] as Point2;
  }

  return [dx / length, dz / length] as Point2;
}

function roadOffset(
  centers: Point2[],
  index: number,
  halfWidth: number,
) {
  const center = centers[index];
  if (!center) {
    return [halfWidth, 0] as Point2;
  }

  const previous =
    centers[Math.max(0, index - 1)] ??
    center;
  const next =
    centers[
      Math.min(
        centers.length - 1,
        index + 1,
      )
    ] ?? center;

  if (index === 0) {
    const nextDirection = direction(
      center,
      next,
    );
    return [
      -nextDirection[1] * halfWidth,
      nextDirection[0] * halfWidth,
    ] as Point2;
  }

  if (index === centers.length - 1) {
    const previousDirection = direction(
      previous,
      center,
    );
    return [
      -previousDirection[1] * halfWidth,
      previousDirection[0] * halfWidth,
    ] as Point2;
  }

  const incoming = direction(
    previous,
    center,
  );
  const outgoing = direction(
    center,
    next,
  );
  const incomingNormal: Point2 = [
    -incoming[1],
    incoming[0],
  ];
  const outgoingNormal: Point2 = [
    -outgoing[1],
    outgoing[0],
  ];
  const miterX =
    incomingNormal[0] +
    outgoingNormal[0];
  const miterZ =
    incomingNormal[1] +
    outgoingNormal[1];
  const miterLength =
    Math.hypot(miterX, miterZ);

  if (miterLength <= 0.001) {
    return [
      outgoingNormal[0] * halfWidth,
      outgoingNormal[1] * halfWidth,
    ] as Point2;
  }

  const normalizedMiter: Point2 = [
    miterX / miterLength,
    miterZ / miterLength,
  ];
  const denominator =
    normalizedMiter[0] *
      outgoingNormal[0] +
    normalizedMiter[1] *
      outgoingNormal[1];

  if (Math.abs(denominator) < 0.2) {
    return [
      outgoingNormal[0] * halfWidth,
      outgoingNormal[1] * halfWidth,
    ] as Point2;
  }

  const requested =
    halfWidth / denominator;
  const maximum =
    halfWidth * MAX_MITER_SCALE;
  const scale = Math.max(
    -maximum,
    Math.min(maximum, requested),
  );

  return [
    normalizedMiter[0] * scale,
    normalizedMiter[1] * scale,
  ] as Point2;
}

function smoothCenterHeights(
  centers: Point2[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const raw = centers.map(([x, z]) =>
    terrainHeight(
      terrain,
      levels,
      x,
      z,
    ),
  );

  return raw.map((height, index) => {
    const previous =
      raw[Math.max(0, index - 1)] ??
      height;
    const next =
      raw[
        Math.min(
          raw.length - 1,
          index + 1,
        )
      ] ?? height;
    const smoothed =
      (previous + height * 2 + next) /
      4;
    const minimum =
      height -
      MAX_GRADE_SMOOTHING_DEVIATION;
    const maximum =
      height +
      MAX_GRADE_SMOOTHING_DEVIATION;

    return Math.max(
      minimum,
      Math.min(maximum, smoothed),
    );
  });
}

function createRoadRibbon(
  scene: Scene,
  feature: LinearFeature,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const centers = samplePolyline(
    feature.points,
    ROAD_SAMPLE_SPACING,
  );
  if (centers.length < 2) return null;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const centerHeights =
    smoothCenterHeights(
      centers,
      terrain,
      levels,
    );
  let travelled = 0;

  for (
    let index = 0;
    index < centers.length;
    index++
  ) {
    const center = centers[index];
    if (!center) continue;

    const halfWidth =
      Math.max(0.5, feature.width / 2);
    const offset = roadOffset(
      centers,
      index,
      halfWidth,
    );
    const leftX =
      center[0] + offset[0];
    const leftZ =
      center[1] + offset[1];
    const rightX =
      center[0] - offset[0];
    const rightZ =
      center[1] - offset[1];
    const centerY =
      centerHeights[index] ??
      terrainHeight(
        terrain,
        levels,
        center[0],
        center[1],
      );
    const leftTerrain =
      elevationAt(
        leftX,
        leftZ,
        terrain,
        levels,
        feature.elevationMode,
      ) - SURFACE_GAP;
    const rightTerrain =
      elevationAt(
        rightX,
        rightZ,
        terrain,
        levels,
        feature.elevationMode,
      ) - SURFACE_GAP;
    const averageTerrain =
      (leftTerrain + rightTerrain) / 2;
    const naturalCrossDelta =
      leftTerrain - rightTerrain;
    const canRegularizeCrossSlope =
      Math.abs(naturalCrossDelta) <=
      MAX_CROSS_SLOPE_CORRECTION_RELIEF;
    const average =
      canRegularizeCrossSlope
        ? Math.max(
            centerY -
              MAX_GRADE_SMOOTHING_DEVIATION,
            Math.min(
              centerY +
                MAX_GRADE_SMOOTHING_DEVIATION,
              averageTerrain,
            ),
          )
        : averageTerrain;
    const crossSpan = Math.max(
      0.001,
      Math.hypot(
        leftX - rightX,
        leftZ - rightZ,
      ),
    );
    const maximumCrossDelta =
      crossSpan * MAX_CROSS_SLOPE;
    const crossDelta =
      canRegularizeCrossSlope
        ? Math.max(
            -maximumCrossDelta,
            Math.min(
              maximumCrossDelta,
              naturalCrossDelta,
            ),
          )
        : naturalCrossDelta;
    const leftY =
      average +
      crossDelta / 2 +
      SURFACE_GAP;
    const rightY =
      average -
      crossDelta / 2 +
      SURFACE_GAP;

    if (index > 0) {
      const before =
        centers[index - 1];
      if (before) {
        travelled += Math.hypot(
          center[0] - before[0],
          center[1] - before[1],
        );
      }
    }

    positions.push(
      leftX,
      leftY,
      leftZ,
      rightX,
      rightY,
      rightZ,
    );
    const repeatAcross =
      Math.max(
        1,
        feature.width /
          TEXTURE_REPEAT_METERS,
      );
    const repeatAlong =
      travelled /
      TEXTURE_REPEAT_METERS;
    uvs.push(
      0,
      repeatAlong,
      repeatAcross,
      repeatAlong,
    );
  }

  for (
    let index = 0;
    index < centers.length - 1;
    index++
  ) {
    const left = index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;
    indices.push(
      left,
      nextLeft,
      right,
      right,
      nextLeft,
      nextRight,
    );
  }

  VertexData.ComputeNormals(
    positions,
    indices,
    normals,
  );

  const mesh = new Mesh(
    feature.id,
    scene,
  );
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = roadMaterialFor(
    scene,
    feature,
  );
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = {
    ...feature,
    roadSurfacePolicy: {
      sampleSpacing:
        ROAD_SAMPLE_SPACING,
      maxCrossSlope:
        MAX_CROSS_SLOPE,
      maxGradeSmoothingDeviation:
        MAX_GRADE_SMOOTHING_DEVIATION,
      maxCrossSlopeCorrectionRelief:
        MAX_CROSS_SLOPE_CORRECTION_RELIEF,
    },
  };
  return mesh;
}

function orientTrianglesUp(points: Point2[], indices: number[]) {
  if (indices.length < 3) return indices;

  const ia = indices[0];
  const ib = indices[1];
  const ic = indices[2];
  if (ia === undefined || ib === undefined || ic === undefined) return indices;

  const a = points[ia];
  const b = points[ib];
  const c = points[ic];
  if (!a || !b || !c) return indices;

  const abX = b[0] - a[0];
  const abZ = b[1] - a[1];
  const acX = c[0] - a[0];
  const acZ = c[1] - a[1];
  const normalY = abZ * acX - abX * acZ;

  if (normalY >= 0) return indices;

  const upward: number[] = [];
  for (let index = 0; index < indices.length; index += 3) {
    const first = indices[index];
    const second = indices[index + 1];
    const third = indices[index + 2];
    if (first === undefined || second === undefined || third === undefined) continue;
    upward.push(first, third, second);
  }
  return upward;
}

function createPolygonSpace(
  scene: Scene,
  space: LinearFeature,
  squareMaterial: ReturnType<typeof material>,
  terrain?: TerrainConfig,
  levels?: SceneLevels,
) {
  const points = space.points;
  if (points.length < 3) return null;

  const flat = points.flatMap(([x, z]) => [x, z]);
  const indices = orientTrianglesUp(points, earcut(flat));
  if (indices.length < 3) return null;

  const positions = points.flatMap(([x, z]) => {
    const elevation =
      space.elevationMode === "terrain" && terrain && levels
        ? elevationAt(x, z, terrain, levels)
        : (space.elevation ?? 0) + SURFACE_GAP;
    return [x, elevation, z];
  });
  const normals = new Array<number>(positions.length).fill(0);
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const width = Math.max(0.001, maxX - minX);
  const depth = Math.max(0.001, maxZ - minZ);
  const uvs = points.flatMap(([x, z]) => [(x - minX) / width, (z - minZ) / depth]);

  VertexData.ComputeNormals(positions, indices, normals);

  const mesh = new Mesh(space.id, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = squareMaterial;
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = space;
  return mesh;
}

export function createRoads(
  scene: Scene,
  roads: LinearFeature[],
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  return roads.flatMap((road) => {
    const mesh = createRoadRibbon(
      scene,
      road,
      terrain,
      levels,
    );
    return mesh ? [mesh] : [];
  });
}

export function createSpaces(
  scene: Scene,
  spaces: LinearFeature[],
  terrain?: TerrainConfig,
  levels?: SceneLevels,
) {
  const squareMaterial = material(scene, "square");
  squareMaterial.backFaceCulling = false;

  return spaces.flatMap((space) => {
    const mesh = createPolygonSpace(
      scene,
      space,
      squareMaterial,
      terrain,
      levels,
    );
    return mesh ? [mesh] : [];
  });
}
