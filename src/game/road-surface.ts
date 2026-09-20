import type { LinearFeature } from "./types";

export type RoadSurfaceKind =
  | "asphalt"
  | "paved"
  | "paving"
  | "stone"
  | "pedestrian";

function normalizedSurface(
  feature: LinearFeature,
) {
  return feature.tags?.["surface"]
    ?.trim()
    .toLocaleLowerCase("en-US");
}

function explicitSurfaceKind(
  surface: string | undefined,
): RoadSurfaceKind | null {
  if (surface === "asphalt") {
    return "asphalt";
  }

  if (
    surface === "paved" ||
    surface === "concrete" ||
    surface === "concrete:plates"
  ) {
    return "paved";
  }

  if (
    surface === "paving_stones" ||
    surface === "paving stones" ||
    surface === "sett"
  ) {
    return "paving";
  }

  if (
    surface === "cobblestone" ||
    surface ===
      "unhewn_cobblestone" ||
    surface === "stone"
  ) {
    return "stone";
  }

  return null;
}

export function classifyRoadSurface(
  feature: LinearFeature,
): RoadSurfaceKind {
  const surface =
    normalizedSurface(feature);
  const explicit =
    explicitSurfaceKind(surface);

  if (explicit) {
    return explicit;
  }

  const highway =
    feature.tags?.["highway"]
      ?.trim()
      .toLocaleLowerCase("en-US");

  if (
    highway === "pedestrian" ||
    highway === "footway" ||
    highway === "path" ||
    highway === "steps" ||
    highway === "corridor"
  ) {
    return "pedestrian";
  }

  return "paved";
}

export interface PublicSpaceSurfaceOverride {
  osmId: number;
  surface: RoadSurfaceKind;
}

export function classifyPublicSpaceSurface(
  feature: LinearFeature,
  overrides: readonly PublicSpaceSurfaceOverride[] = [],
): RoadSurfaceKind | null {
  const surface =
    normalizedSurface(feature);
  const explicit =
    explicitSurfaceKind(surface);

  if (explicit) {
    return explicit;
  }

  if (
    surface === "grass" ||
    surface === "ground" ||
    surface === "dirt" ||
    surface === "earth" ||
    surface === "sand" ||
    surface === "gravel" ||
    surface === "fine_gravel" ||
    surface === "unpaved"
  ) {
    return null;
  }

  const override =
    typeof feature.osmId === "number"
      ? overrides.find(
          (item) =>
            item.osmId ===
            feature.osmId,
        )
      : undefined;

  if (override) {
    return override.surface;
  }

  const leisure =
    feature.tags?.["leisure"];
  if (leisure === "park") {
    return null;
  }

  if (
    feature.tags?.["place"] ===
      "square" ||
    leisure === "square" ||
    (feature.tags?.["highway"] ===
      "pedestrian" &&
      feature.tags?.["area"] ===
        "yes")
  ) {
    return "pedestrian";
  }

  return null;
}
