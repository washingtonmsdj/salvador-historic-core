import type {
  LinearFeature,
  Point2,
} from "./types";

export interface RoadJunction {
  id: string;
  center: Point2;
  radius: number;
  feature: LinearFeature;
  connectedFeatureIds: string[];
}

interface RoadEndpoint {
  point: Point2;
  feature: LinearFeature;
  compatibilityKey: string;
}

function endpointCompatibilityKey(
  feature: LinearFeature,
) {
  const layer =
    feature.tags?.["layer"] ?? "0";
  const bridge =
    feature.tags?.["bridge"] ?? "no";
  const tunnel =
    feature.tags?.["tunnel"] ?? "no";

  return [
    feature.elevationMode ?? "terrain",
    layer,
    bridge,
    tunnel,
  ].join("|");
}

function distance(
  a: Point2,
  b: Point2,
) {
  return Math.hypot(
    b[0] - a[0],
    b[1] - a[1],
  );
}

export function deriveRoadJunctions(
  roads: LinearFeature[],
  {
    snapDistance,
    overlap,
  }: {
    snapDistance: number;
    overlap: number;
  },
): RoadJunction[] {
  const endpoints: RoadEndpoint[] = [];

  for (const feature of roads) {
    if (
      feature.points.length < 2 ||
      !Number.isFinite(feature.width) ||
      feature.width <= 0
    ) {
      continue;
    }

    const first = feature.points[0];
    const last =
      feature.points[
        feature.points.length - 1
      ];
    if (!first || !last) {
      continue;
    }

    const compatibilityKey =
      endpointCompatibilityKey(feature);

    endpoints.push(
      {
        point: first,
        feature,
        compatibilityKey,
      },
      {
        point: last,
        feature,
        compatibilityKey,
      },
    );
  }

  const visited = new Set<number>();
  const junctions: RoadJunction[] = [];

  for (
    let index = 0;
    index < endpoints.length;
    index++
  ) {
    if (visited.has(index)) {
      continue;
    }

    const seed = endpoints[index];
    if (!seed) {
      continue;
    }

    const queue = [index];
    const cluster: RoadEndpoint[] = [];
    visited.add(index);

    while (queue.length > 0) {
      const currentIndex =
        queue.shift();
      if (currentIndex === undefined) {
        continue;
      }

      const current =
        endpoints[currentIndex];
      if (!current) {
        continue;
      }

      cluster.push(current);

      for (
        let candidateIndex = 0;
        candidateIndex <
        endpoints.length;
        candidateIndex++
      ) {
        if (
          visited.has(
            candidateIndex,
          )
        ) {
          continue;
        }

        const candidate =
          endpoints[candidateIndex];
        if (
          !candidate ||
          candidate.compatibilityKey !==
            seed.compatibilityKey
        ) {
          continue;
        }

        if (
          distance(
            current.point,
            candidate.point,
          ) <= snapDistance
        ) {
          visited.add(
            candidateIndex,
          );
          queue.push(
            candidateIndex,
          );
        }
      }
    }

    const features = new Map<
      string,
      LinearFeature
    >();
    for (const endpoint of cluster) {
      features.set(
        endpoint.feature.id,
        endpoint.feature,
      );
    }

    if (features.size < 2) {
      continue;
    }

    const center: Point2 = [
      cluster.reduce(
        (sum, endpoint) =>
          sum +
          endpoint.point[0],
        0,
      ) / cluster.length,
      cluster.reduce(
        (sum, endpoint) =>
          sum +
          endpoint.point[1],
        0,
      ) / cluster.length,
    ];

    const connected =
      [...features.values()].sort(
        (a, b) =>
          b.width - a.width,
      );
    const feature = connected[0];
    if (!feature) {
      continue;
    }

    const radius =
      Math.max(
        0.6,
        feature.width / 2 +
          overlap,
      );

    junctions.push({
      id:
        "road-junction-" +
        junctions.length,
      center,
      radius,
      feature,
      connectedFeatureIds:
        connected.map(
          (road) => road.id,
        ),
    });
  }

  return junctions;
}
