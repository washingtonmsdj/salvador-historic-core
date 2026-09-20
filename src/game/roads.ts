import earcut from "earcut";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import manifestData from "../../geospatial/manifest.json";
import {
  roadMaterialFor,
  surfaceMaterialForKind,
} from "./road-materials";
import {
  classifyPublicSpaceSurface,
} from "./road-surface";
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
const publicSpaceSurfacePolicy =
  manifestData.publicSpaceSurfacePolicy;
const SPACE_MAX_TRIANGLE_EDGE =
  publicSpaceSurfacePolicy.maxTriangleEdge;
const SPACE_MAX_SUBDIVISIONS =
  publicSpaceSurfacePolicy.maxSubdivisions;
const SPACE_SURFACE_GAP =
  publicSpaceSurfacePolicy.surfaceGap;
const SPACE_TEXTURE_REPEAT_METERS =
  publicSpaceSurfacePolicy.textureRepeatMeters;

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
    if (
      index === 0 ||
      index === raw.length - 1
    ) {
      return height;
    }

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
    walkableSurface: true,
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

function triangleEdgeLength(
  a: Point2,
  b: Point2,
) {
  return Math.hypot(
    b[0] - a[0],
    b[1] - a[1],
  );
}

function triangleSubdivisionCount(
  points: Point2[],
  indices: number[],
) {
  let longest = 0;

  for (
    let index = 0;
    index < indices.length;
    index += 3
  ) {
    const ia = indices[index];
    const ib = indices[index + 1];
    const ic = indices[index + 2];
    if (
      ia === undefined ||
      ib === undefined ||
      ic === undefined
    ) {
      continue;
    }

    const a = points[ia];
    const b = points[ib];
    const c = points[ic];
    if (!a || !b || !c) {
      continue;
    }

    longest = Math.max(
      longest,
      triangleEdgeLength(a, b),
      triangleEdgeLength(b, c),
      triangleEdgeLength(c, a),
    );
  }

  return Math.max(
    1,
    Math.min(
      SPACE_MAX_SUBDIVISIONS,
      Math.ceil(
        longest /
          SPACE_MAX_TRIANGLE_EDGE,
      ),
    ),
  );
}

function appendSubdividedTriangle(
  a: Point2,
  b: Point2,
  c: Point2,
  subdivisions: number,
  elevation: (
    x: number,
    z: number,
  ) => number,
  positions: number[],
  indices: number[],
  uvs: number[],
) {
  const rows: number[][] = [];

  for (
    let i = 0;
    i <= subdivisions;
    i++
  ) {
    const row: number[] = [];

    for (
      let j = 0;
      j <= subdivisions - i;
      j++
    ) {
      const towardB =
        i / subdivisions;
      const towardC =
        j / subdivisions;
      const towardA =
        1 - towardB - towardC;
      const x =
        a[0] * towardA +
        b[0] * towardB +
        c[0] * towardC;
      const z =
        a[1] * towardA +
        b[1] * towardB +
        c[1] * towardC;
      const vertex =
        positions.length / 3;

      positions.push(
        x,
        elevation(x, z),
        z,
      );
      uvs.push(
        x /
          SPACE_TEXTURE_REPEAT_METERS,
        z /
          SPACE_TEXTURE_REPEAT_METERS,
      );
      row.push(vertex);
    }

    rows.push(row);
  }

  for (
    let i = 0;
    i < subdivisions;
    i++
  ) {
    const current = rows[i];
    const next = rows[i + 1];
    if (!current || !next) {
      continue;
    }

    for (
      let j = 0;
      j < subdivisions - i;
      j++
    ) {
      const aIndex = current[j];
      const bIndex = next[j];
      const cIndex = current[j + 1];
      if (
        aIndex === undefined ||
        bIndex === undefined ||
        cIndex === undefined
      ) {
        continue;
      }

      indices.push(
        aIndex,
        bIndex,
        cIndex,
      );

      if (
        j <
        subdivisions - i - 1
      ) {
        const dIndex =
          next[j + 1];
        if (dIndex !== undefined) {
          indices.push(
            bIndex,
            dIndex,
            cIndex,
          );
        }
      }
    }
  }
}

function createPolygonSpace(
  scene: Scene,
  space: LinearFeature,
  squareMaterial: ReturnType<
    typeof surfaceMaterialForKind
  >,
  terrain?: TerrainConfig,
  levels?: SceneLevels,
) {
  const points = space.points;
  if (points.length < 3) return null;

  const flat = points.flatMap(
    ([x, z]) => [x, z],
  );
  const sourceIndices =
    orientTrianglesUp(
      points,
      earcut(flat),
    );
  if (sourceIndices.length < 3) {
    return null;
  }

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const subdivisions =
    triangleSubdivisionCount(
      points,
      sourceIndices,
    );
  const surfaceElevation = (
    x: number,
    z: number,
  ) => {
    if (
      space.elevationMode ===
        "terrain" &&
      terrain &&
      levels
    ) {
      return (
        terrainHeight(
          terrain,
          levels,
          x,
          z,
        ) + SPACE_SURFACE_GAP
      );
    }

    return (
      (space.elevation ?? 0) +
      SPACE_SURFACE_GAP
    );
  };

  for (
    let index = 0;
    index < sourceIndices.length;
    index += 3
  ) {
    const ia = sourceIndices[index];
    const ib =
      sourceIndices[index + 1];
    const ic =
      sourceIndices[index + 2];
    if (
      ia === undefined ||
      ib === undefined ||
      ic === undefined
    ) {
      continue;
    }

    const a = points[ia];
    const b = points[ib];
    const c = points[ic];
    if (!a || !b || !c) {
      continue;
    }

    appendSubdividedTriangle(
      a,
      b,
      c,
      subdivisions,
      surfaceElevation,
      positions,
      indices,
      uvs,
    );
  }

  if (
    positions.length === 0 ||
    indices.length < 3
  ) {
    return null;
  }

  VertexData.ComputeNormals(
    positions,
    indices,
    normals,
  );

  const mesh = new Mesh(
    space.id,
    scene,
  );
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = squareMaterial;
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = {
    ...space,
    walkableSurface: true,
    publicSpaceSurfacePolicy: {
      maxTriangleEdge:
        SPACE_MAX_TRIANGLE_EDGE,
      subdivisions,
    },
  };
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
  return spaces.flatMap((space) => {
    const squareMaterial =
      surfaceMaterialForKind(
        scene,
        classifyPublicSpaceSurface(
          space,
        ),
      );
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
