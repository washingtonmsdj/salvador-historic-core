import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { Scene } from "@babylonjs/core/scene";
import { geographicToLocalMeters } from "./geo";
import { terrainHeight } from "./terrain";
import type { SceneLevels, TerrainConfig } from "./types";

interface GeographicBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface RasterReferenceConfig {
  tileTemplate: string;
  zoom: number;
  maxTiles: number;
  attribution: string;
  attributionUrl: string;
}

interface Origin {
  latitude: number;
  longitude: number;
}

const toRadians = Math.PI / 180;
const toDegrees = 180 / Math.PI;

function longitudeToTileX(longitude: number, zoom: number) {
  const scale = 2 ** zoom;
  return ((longitude + 180) / 360) * scale;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const scale = 2 ** zoom;
  const latitudeRadians = latitude * toRadians;
  return (
    ((1 -
      Math.log(
        Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians),
      ) /
        Math.PI) /
      2) *
    scale
  );
}

function tileXToLongitude(tileX: number, zoom: number) {
  return (tileX / 2 ** zoom) * 360 - 180;
}

function tileYToLatitude(tileY: number, zoom: number) {
  const mercator = Math.PI * (1 - (2 * tileY) / 2 ** zoom);
  return Math.atan(Math.sinh(mercator)) * toDegrees;
}

function tileUrl(
  template: string,
  zoom: number,
  tileX: number,
  tileY: number,
) {
  return template
    .replace("{z}", String(zoom))
    .replace("{x}", String(tileX))
    .replace("{y}", String(tileY));
}

function createTileMesh(
  scene: Scene,
  config: RasterReferenceConfig,
  origin: Origin,
  bounds: GeographicBounds,
  terrain: TerrainConfig,
  levels: SceneLevels,
  tileX: number,
  tileY: number,
) {
  const zoom = config.zoom;
  const tileWest = tileXToLongitude(tileX, zoom);
  const tileEast = tileXToLongitude(tileX + 1, zoom);
  const tileNorth = tileYToLatitude(tileY, zoom);
  const tileSouth = tileYToLatitude(tileY + 1, zoom);
  const west = Math.max(tileWest, bounds.west);
  const east = Math.min(tileEast, bounds.east);
  const north = Math.min(tileNorth, bounds.north);
  const south = Math.max(tileSouth, bounds.south);

  if (west >= east || south >= north) {
    return null;
  }

  const tileWestFraction = longitudeToTileX(west, zoom) - tileX;
  const tileEastFraction = longitudeToTileX(east, zoom) - tileX;
  const tileNorthFraction = latitudeToTileY(north, zoom) - tileY;
  const tileSouthFraction = latitudeToTileY(south, zoom) - tileY;
  const steps = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= steps; row++) {
    const rowT = row / steps;
    const latitude = north + (south - north) * rowT;
    const imageV =
      tileNorthFraction +
      (tileSouthFraction - tileNorthFraction) * rowT;

    for (let column = 0; column <= steps; column++) {
      const columnT = column / steps;
      const longitude = west + (east - west) * columnT;
      const imageU =
        tileWestFraction +
        (tileEastFraction - tileWestFraction) * columnT;
      const [x, z] = geographicToLocalMeters(
        latitude,
        longitude,
        origin.latitude,
        origin.longitude,
      );
      const y = terrainHeight(terrain, levels, x, z) + 0.03;

      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(imageU, 1 - imageV);
    }
  }

  for (let row = 0; row < steps; row++) {
    for (let column = 0; column < steps; column++) {
      const a = row * (steps + 1) + column;
      const b = a + 1;
      const c = a + steps + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const mesh = new Mesh(
    `osm-reference-${zoom}-${tileX}-${tileY}`,
    scene,
  );
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;
  vertexData.applyToMesh(mesh);

  const texture = new Texture(
    tileUrl(config.tileTemplate, zoom, tileX, tileY),
    scene,
    true,
    true,
  );
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  const material = new StandardMaterial(
    `osm-reference-material-${zoom}-${tileX}-${tileY}`,
    scene,
  );
  material.diffuseTexture = texture;
  material.emissiveColor = Color3.White().scale(0.72);
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.alpha = 0.82;
  material.backFaceCulling = false;

  mesh.material = material;
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  mesh.receiveShadows = false;
  mesh.metadata = {
    category: "osm-raster-reference",
    tileX,
    tileY,
    zoom,
    source: config.tileTemplate,
  };

  return mesh;
}

export function createOsmTerrainReference(
  scene: Scene,
  config: RasterReferenceConfig,
  origin: Origin,
  bounds: GeographicBounds,
  terrain: TerrainConfig,
  levels: SceneLevels,
) {
  const zoom = config.zoom;
  const westTile = Math.floor(longitudeToTileX(bounds.west, zoom));
  const eastTile = Math.floor(longitudeToTileX(bounds.east, zoom));
  const northTile = Math.floor(latitudeToTileY(bounds.north, zoom));
  const southTile = Math.floor(latitudeToTileY(bounds.south, zoom));
  const tileCount =
    (eastTile - westTile + 1) *
    (southTile - northTile + 1);

  if (tileCount > config.maxTiles) {
    throw new Error(
      `OSM reference would load ${tileCount} tiles, above configured limit ${config.maxTiles}.`,
    );
  }

  const meshes: Mesh[] = [];
  for (let tileY = northTile; tileY <= southTile; tileY++) {
    for (let tileX = westTile; tileX <= eastTile; tileX++) {
      const mesh = createTileMesh(
        scene,
        config,
        origin,
        bounds,
        terrain,
        levels,
        tileX,
        tileY,
      );
      if (mesh) meshes.push(mesh);
    }
  }

  return {
    meshes,
    setEnabled(enabled: boolean) {
      for (const mesh of meshes) {
        mesh.setEnabled(enabled);
      }
    },
    tileCount: meshes.length,
  };
}
