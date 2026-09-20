import type { LinearFeature } from "./types";

export type RoadSurfaceKind =
  | "asphalt"
  | "paving"
  | "stone"
  | "pedestrian";

export function classifyRoadSurface(
  feature: LinearFeature,
): RoadSurfaceKind {
  const surface =
    feature.tags?.["surface"]
      ?.trim()
      .toLocaleLowerCase("en-US");
  const highway =
    feature.tags?.["highway"]
      ?.trim()
      .toLocaleLowerCase("en-US");

  if (
    surface === "paving_stones" ||
    surface === "paving stones" ||
    surface === "sett"
  ) {
    return "paving";
  }

  if (
    surface === "cobblestone" ||
    surface === "unhewn_cobblestone" ||
    surface === "stone"
  ) {
    return "stone";
  }

  if (
    highway === "pedestrian" ||
    highway === "footway" ||
    highway === "path" ||
    highway === "steps"
  ) {
    return "pedestrian";
  }

  return "asphalt";
}


export function classifyPublicSpaceSurface(
  feature: LinearFeature,
): RoadSurfaceKind {
  const surface =
    feature.tags?.["surface"]
      ?.trim()
      .toLocaleLowerCase("en-US");

  if (surface === "asphalt") {
    return "asphalt";
  }

  if (
    surface === "cobblestone" ||
    surface ===
      "unhewn_cobblestone" ||
    surface === "stone"
  ) {
    return "stone";
  }

  return "paving";
}
