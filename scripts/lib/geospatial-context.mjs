import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const root = process.cwd();
export const manifestPath = resolve(root, "geospatial/manifest.json");
export const siteDataPath = resolve(root, "src/data/site-data.json");

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadGeospatialContext() {
  const [manifest, siteData] = await Promise.all([
    readJson(manifestPath),
    readJson(siteDataPath),
  ]);

  const origin = siteData.metadata?.origin;
  const bounds = siteData.terrain?.bounds;

  if (!origin?.projected || origin.projected.crs !== manifest.localCoordinateSystem.horizontalCrs) {
    throw new Error("site-data origin/projected CRS does not match geospatial manifest.");
  }

  if (!bounds) {
    throw new Error("site-data terrain bounds are required.");
  }

  const manifestBounds = manifest.perimeter;
  for (const key of ["minX", "maxX", "minZ", "maxZ"]) {
    if (bounds[key] !== manifestBounds[key]) {
      throw new Error(`site-data terrain.bounds.${key} must match geospatial manifest.`);
    }
  }

  return {
    manifest,
    siteData,
    origin,
    bounds,
    projected: origin.projected,
  };
}

export function localToProjected(projected, x, z) {
  return [projected.easting + x, projected.northing + z];
}

export function projectedToLocal(projected, easting, northing) {
  return [
    Number((easting - projected.easting).toFixed(3)),
    Number((northing - projected.northing).toFixed(3)),
  ];
}
