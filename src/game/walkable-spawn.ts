import earcut from "earcut";
import type {
  LinearFeature,
  Point2,
} from "./types";

function normalizeName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function triangleArea(
  a: Point2,
  b: Point2,
  c: Point2,
) {
  return Math.abs(
    (a[0] * (b[1] - c[1]) +
      b[0] * (c[1] - a[1]) +
      c[0] * (a[1] - b[1])) /
      2,
  );
}

export function polygonInteriorSpawn(
  points: Point2[],
): Point2 | null {
  if (points.length < 3) {
    return null;
  }

  const flat = points.flatMap(
    ([x, z]) => [x, z],
  );
  const indices = earcut(flat);

  let best:
    | {
        area: number;
        point: Point2;
      }
    | null = null;

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

    const area =
      triangleArea(a, b, c);
    if (
      !best ||
      area > best.area
    ) {
      best = {
        area,
        point: [
          (a[0] + b[0] + c[0]) /
            3,
          (a[1] + b[1] + c[1]) /
            3,
        ],
      };
    }
  }

  return best?.point ?? null;
}

function roadMidpoint(
  roads: LinearFeature[],
): Point2 | null {
  let best:
    | {
        length: number;
        point: Point2;
      }
    | null = null;

  for (const road of roads) {
    for (
      let index = 0;
      index < road.points.length - 1;
      index++
    ) {
      const a = road.points[index];
      const b =
        road.points[index + 1];
      if (!a || !b) {
        continue;
      }

      const length = Math.hypot(
        b[0] - a[0],
        b[1] - a[1],
      );
      if (
        !best ||
        length > best.length
      ) {
        best = {
          length,
          point: [
            (a[0] + b[0]) / 2,
            (a[1] + b[1]) / 2,
          ],
        };
      }
    }
  }

  return best?.point ?? null;
}

export function chooseWalkableSpawn(
  spaces: LinearFeature[],
  roads: LinearFeature[],
  preferredSpaceName:
    | string
    | null = null,
): Point2 {
  const preferred =
    preferredSpaceName
      ? spaces.find(
          (space) =>
            normalizeName(
              space.name,
            ) ===
            normalizeName(
              preferredSpaceName,
            ),
        )
      : undefined;

  const orderedSpaces = preferred
    ? [
        preferred,
        ...spaces.filter(
          (space) =>
            space.id !==
            preferred.id,
        ),
      ]
    : spaces;

  for (const space of orderedSpaces) {
    const point =
      polygonInteriorSpawn(
        space.points,
      );
    if (point) {
      return point;
    }
  }

  return (
    roadMidpoint(roads) ??
    ([0, 0] as Point2)
  );
}
