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
import {
  deriveRoadJunctions,
  type RoadJunction,
} from "./road-junctions";
import {
  smoothRoadCenterHeight,
} from "./road-grading";
import {
  sampleRoadCrossSection,
} from "./road-cross-section";
import {
  deriveRoadSurfaceProfile,
} from "./road-surface-profile";
import {
  deriveRoadJunctionSurface,
} from "./road-junction-surface";
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
const MAX_GRADE_SMOOTHING_RAISE =
  roadSurfacePolicy.maxGradeSmoothingRaise;
const MAX_SUPPORTED_FILL_HEIGHT =
  roadSurfacePolicy.maxSupportedFillHeight;
const MAX_LONGITUDINAL_SLOPE =
  roadSurfacePolicy.maxLongitudinalSlope;
const ROAD_PROFILE_ITERATIONS =
  roadSurfacePolicy.longitudinalProfileIterations;
const ROAD_PROFILE_FALLBACK_OSM_IDS =
  roadSurfacePolicy.longitudinalProfileFallbackOsmIds;
const SUPPORT_WALL_THRESHOLD =
  roadSurfacePolicy.supportWallThreshold;
const SUPPORT_WALL_TEXTURE_REPEAT_METERS =
  roadSurfacePolicy.supportWallTextureRepeatMeters;
const SUPPORT_WALL_SINK =
  roadSurfacePolicy.supportWallSink;
const JUNCTION_SNAP_DISTANCE =
  roadSurfacePolicy.junctionSnapDistance;
const JUNCTION_OVERLAP =
  roadSurfacePolicy.junctionOverlap;
const JUNCTION_SURFACE_OFFSET =
  roadSurfacePolicy.junctionSurfaceOffset;
const JUNCTION_MAX_SEGMENTS =
  roadSurfacePolicy.junctionMaxSegments;
const JUNCTION_MAX_SLOPE =
  roadSurfacePolicy.junctionMaxSlope;
const JUNCTION_MAX_CUT =
  roadSurfacePolicy.junctionMaxCut;
const JUNCTION_MAX_FILL =
  roadSurfacePolicy.junctionMaxFill;
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
    return smoothRoadCenterHeight(
      previous,
      height,
      next,
      MAX_GRADE_SMOOTHING_RAISE,
    );
  });
}

function createRoadRibbon(
  scene: Scene,
  feature: LinearFeature,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const surfaceProfile =
    deriveRoadSurfaceProfile({
      feature,
      terrain,
      levels,
      policy: {
        sampleSpacing:
          ROAD_SAMPLE_SPACING,
        maxMiterScale:
          MAX_MITER_SCALE,
        maxCrossSlope:
          MAX_CROSS_SLOPE,
        maxSupportedFillHeight:
          MAX_SUPPORTED_FILL_HEIGHT,
        surfaceGap:
          SURFACE_GAP,
        maxLongitudinalSlope:
          MAX_LONGITUDINAL_SLOPE,
        maxProfileIterations:
          ROAD_PROFILE_ITERATIONS,
        fallbackOsmIds:
          ROAD_PROFILE_FALLBACK_OSM_IDS,
      },
    });
  const centers =
    surfaceProfile.centers;
  if (centers.length < 2) return null;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const leftEdges: Array<{
    x: number;
    z: number;
    roadY: number;
    terrainY: number;
    support: number;
    distance: number;
  }> = [];
  const rightEdges: Array<{
    x: number;
    z: number;
    roadY: number;
    terrainY: number;
    support: number;
    distance: number;
  }> = [];
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

    const rawCenterY =
      terrainHeight(
        terrain,
        levels,
        center[0],
        center[1],
      );
    const centerY =
      centerHeights[index] ??
      rawCenterY;
    const longitudinalLift =
      Math.max(
        0,
        centerY - rawCenterY,
      );
    const crossSection =
      (surfaceProfile.valid
        ? surfaceProfile.samples[index]
        : null) ??
      sampleRoadCrossSection({
        feature,
        centers,
        index,
        terrain,
        levels,
        longitudinalLift,
        policy: {
          maxMiterScale:
            MAX_MITER_SCALE,
          maxCrossSlope:
            MAX_CROSS_SLOPE,
          maxSupportedFillHeight:
            MAX_SUPPORTED_FILL_HEIGHT,
          surfaceGap:
            SURFACE_GAP,
        },
      });

    if (!crossSection) {
      continue;
    }

    const leftX =
      crossSection.left.x;
    const leftZ =
      crossSection.left.z;
    const rightX =
      crossSection.right.x;
    const rightZ =
      crossSection.right.z;
    const leftTerrain =
      crossSection.left.terrainY;
    const rightTerrain =
      crossSection.right.terrainY;
    const leftY =
      crossSection.left.surfaceY;
    const rightY =
      crossSection.right.surfaceY;

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

    leftEdges.push({
      x: leftX,
      z: leftZ,
      roadY: leftY,
      terrainY:
        leftTerrain - SUPPORT_WALL_SINK,
      support:
        crossSection.left.supportHeight,
      distance: travelled,
    });
    rightEdges.push({
      x: rightX,
      z: rightZ,
      roadY: rightY,
      terrainY:
        rightTerrain - SUPPORT_WALL_SINK,
      support:
        crossSection.right.supportHeight,
      distance: travelled,
    });

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
      maxGradeSmoothingRaise:
        MAX_GRADE_SMOOTHING_RAISE,
      maxSupportedFillHeight:
        MAX_SUPPORTED_FILL_HEIGHT,
      maxLongitudinalSlope:
        MAX_LONGITUDINAL_SLOPE,
      profileRegularized:
        surfaceProfile.regularized,
      profileFallback:
        !surfaceProfile.valid,
      profileMaxSupportHeight:
        surfaceProfile.maxSupportHeight,
      supportWallThreshold:
        SUPPORT_WALL_THRESHOLD,
    },
  };

  const createSupportMesh = (
    side: "left" | "right",
    edges: typeof leftEdges,
  ) => {
    const supportPositions: number[] = [];
    const supportIndices: number[] = [];
    const supportNormals: number[] = [];
    const supportUvs: number[] = [];

    for (
      let index = 0;
      index < edges.length - 1;
      index++
    ) {
      const a = edges[index];
      const b = edges[index + 1];
      if (!a || !b) continue;

      if (
        a.support < SUPPORT_WALL_THRESHOLD &&
        b.support < SUPPORT_WALL_THRESHOLD
      ) {
        continue;
      }

      const base =
        supportPositions.length / 3;
      supportPositions.push(
        a.x,
        a.roadY,
        a.z,
        a.x,
        a.terrainY,
        a.z,
        b.x,
        b.roadY,
        b.z,
        b.x,
        b.terrainY,
        b.z,
      );

      if (side === "left") {
        supportIndices.push(
          base,
          base + 1,
          base + 2,
          base + 2,
          base + 1,
          base + 3,
        );
      } else {
        supportIndices.push(
          base,
          base + 2,
          base + 1,
          base + 2,
          base + 3,
          base + 1,
        );
      }

      const u0 =
        a.distance /
        SUPPORT_WALL_TEXTURE_REPEAT_METERS;
      const u1 =
        b.distance /
        SUPPORT_WALL_TEXTURE_REPEAT_METERS;
      supportUvs.push(
        u0,
        0,
        u0,
        Math.max(
          1,
          a.support /
            SUPPORT_WALL_TEXTURE_REPEAT_METERS,
        ),
        u1,
        0,
        u1,
        Math.max(
          1,
          b.support /
            SUPPORT_WALL_TEXTURE_REPEAT_METERS,
        ),
      );
    }

    if (
      supportPositions.length === 0 ||
      supportIndices.length === 0
    ) {
      return null;
    }

    VertexData.ComputeNormals(
      supportPositions,
      supportIndices,
      supportNormals,
    );

    const supportMesh = new Mesh(
      `${feature.id}-support-${side}`,
      scene,
    );
    const supportData =
      new VertexData();
    supportData.positions =
      supportPositions;
    supportData.indices =
      supportIndices;
    supportData.normals =
      supportNormals;
    supportData.uvs =
      supportUvs;
    supportData.applyToMesh(
      supportMesh,
    );

    supportMesh.material =
      surfaceMaterialForKind(
        scene,
        "stone",
      );
    supportMesh.receiveShadows =
      true;
    supportMesh.checkCollisions =
      true;
    supportMesh.metadata = {
      category:
        "road-retaining-support",
      roadId: feature.id,
      side,
      walkableSurface: false,
    };

    return supportMesh;
  };

  const supports = [
    createSupportMesh(
      "left",
      leftEdges,
    ),
    createSupportMesh(
      "right",
      rightEdges,
    ),
  ].filter(
    (
      support,
    ): support is Mesh =>
      support !== null,
  );

  return [
    mesh,
    ...supports,
  ];
}

function createRoadJunctionMesh(
  scene: Scene,
  junction: RoadJunction,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const surface =
    deriveRoadJunctionSurface(
      junction,
      terrain,
      levels,
      {
        roadSampleSpacing:
          ROAD_SAMPLE_SPACING,
        maxMiterScale:
          MAX_MITER_SCALE,
        maxCrossSlope:
          MAX_CROSS_SLOPE,
        maxSupportedFillHeight:
          MAX_SUPPORTED_FILL_HEIGHT,
        surfaceGap:
          SURFACE_GAP,
        maxLongitudinalSlope:
          MAX_LONGITUDINAL_SLOPE,
        maxProfileIterations:
          ROAD_PROFILE_ITERATIONS,
        profileFallbackOsmIds:
          ROAD_PROFILE_FALLBACK_OSM_IDS,
        junctionSurfaceOffset:
          JUNCTION_SURFACE_OFFSET,
        junctionMaxSegments:
          JUNCTION_MAX_SEGMENTS,
        junctionMaxSlope:
          JUNCTION_MAX_SLOPE,
        junctionMaxCut:
          JUNCTION_MAX_CUT,
        junctionMaxFill:
          JUNCTION_MAX_FILL,
      },
    );

  if (
    !surface ||
    !surface.valid
  ) {
    return [];
  }

  const positions: number[] = [
    junction.center[0],
    surface.centerY,
    junction.center[1],
  ];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [
    junction.center[0] /
      TEXTURE_REPEAT_METERS,
    junction.center[1] /
      TEXTURE_REPEAT_METERS,
  ];

  for (
    const point of
      surface.perimeter
  ) {
    positions.push(
      point.x,
      point.topY,
      point.z,
    );
    uvs.push(
      point.x /
        TEXTURE_REPEAT_METERS,
      point.z /
        TEXTURE_REPEAT_METERS,
    );
  }

  for (
    let segment = 0;
    segment < surface.segments;
    segment++
  ) {
    const current =
      segment + 1;
    const next =
      ((segment + 1) %
        surface.segments) +
      1;
    indices.push(
      0,
      next,
      current,
    );
  }

  VertexData.ComputeNormals(
    positions,
    indices,
    normals,
  );

  const mesh = new Mesh(
    junction.id,
    scene,
  );
  const vertexData =
    new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = roadMaterialFor(
    scene,
    junction.feature,
  );
  mesh.receiveShadows = true;
  mesh.checkCollisions = true;
  mesh.metadata = {
    category: "road-junction",
    walkableSurface: true,
    connectedFeatureIds:
      junction.connectedFeatureIds,
    center: junction.center,
    radius: junction.radius,
    planeSlope:
      surface.plane.slope,
    maxCut:
      surface.maxCut,
    maxFill:
      surface.maxFill,
    maxRoadEdgeDelta:
      surface.maxRoadEdgeDelta,
  };

  const supportPositions:
    number[] = [];
  const supportIndices:
    number[] = [];
  const supportNormals:
    number[] = [];
  const supportUvs:
    number[] = [];

  for (
    let segment = 0;
    segment <
    surface.perimeter.length;
    segment++
  ) {
    const a =
      surface.perimeter[
        segment
      ];
    const b =
      surface.perimeter[
        (segment + 1) %
          surface.perimeter
            .length
      ];
    if (!a || !b) {
      continue;
    }

    if (
      Math.abs(
        a.verticalOffset,
      ) <
        SUPPORT_WALL_THRESHOLD &&
      Math.abs(
        b.verticalOffset,
      ) <
        SUPPORT_WALL_THRESHOLD
    ) {
      continue;
    }

    const base =
      supportPositions.length / 3;
    supportPositions.push(
      a.x,
      a.topY,
      a.z,
      a.x,
      a.terrainY -
        SUPPORT_WALL_SINK,
      a.z,
      b.x,
      b.topY,
      b.z,
      b.x,
      b.terrainY -
        SUPPORT_WALL_SINK,
      b.z,
    );
    supportIndices.push(
      base,
      base + 2,
      base + 1,
      base + 2,
      base + 3,
      base + 1,
    );

    const u0 =
      segment /
      surface.perimeter.length;
    const u1 =
      (segment + 1) /
      surface.perimeter.length;
    supportUvs.push(
      u0,
      0,
      u0,
      Math.max(
        1,
        Math.abs(
          a.verticalOffset,
        ) /
          SUPPORT_WALL_TEXTURE_REPEAT_METERS,
      ),
      u1,
      0,
      u1,
      Math.max(
        1,
        Math.abs(
          b.verticalOffset,
        ) /
          SUPPORT_WALL_TEXTURE_REPEAT_METERS,
      ),
    );
  }

  if (
    supportPositions.length === 0
  ) {
    return [mesh];
  }

  VertexData.ComputeNormals(
    supportPositions,
    supportIndices,
    supportNormals,
  );
  const supportMesh = new Mesh(
    junction.id + "-support",
    scene,
  );
  const supportData =
    new VertexData();
  supportData.positions =
    supportPositions;
  supportData.indices =
    supportIndices;
  supportData.normals =
    supportNormals;
  supportData.uvs =
    supportUvs;
  supportData.applyToMesh(
    supportMesh,
  );
  supportMesh.material =
    surfaceMaterialForKind(
      scene,
      "stone",
    );
  supportMesh.receiveShadows = true;
  supportMesh.checkCollisions = true;
  supportMesh.metadata = {
    category:
      "road-junction-support",
    walkableSurface: false,
    junctionId:
      junction.id,
  };

  return [
    mesh,
    supportMesh,
  ];
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
  const ribbons = roads.flatMap(
    (road) => {
      const meshes =
        createRoadRibbon(
          scene,
          road,
          terrain,
          levels,
        );
      return meshes ?? [];
    },
  );

  const junctions =
    deriveRoadJunctions(
      roads,
      {
        snapDistance:
          JUNCTION_SNAP_DISTANCE,
        overlap:
          JUNCTION_OVERLAP,
      },
    ).flatMap((junction) =>
      createRoadJunctionMesh(
        scene,
        junction,
        terrain,
        levels,
      ),
    );

  return [
    ...ribbons,
    ...junctions,
  ];
}

export function createSpaces(
  scene: Scene,
  spaces: LinearFeature[],
  terrain?: TerrainConfig,
  levels?: SceneLevels,
) {
  return spaces.flatMap((space) => {
    const surfaceKind =
      classifyPublicSpaceSurface(
        space,
      );

    if (!surfaceKind) {
      return [];
    }

    const squareMaterial =
      surfaceMaterialForKind(
        scene,
        surfaceKind,
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
