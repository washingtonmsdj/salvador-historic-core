import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadGeospatialContext,
  projectedToLocal,
  root,
} from "./lib/geospatial-context.mjs";
import {
  latLonToUtm24S,
  utm24SToLatLon,
} from "./lib/utm-wgs84.mjs";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const { manifest, origin, bounds, projected } =
  await loadGeospatialContext();

const rawOutputPath = resolve(
  root,
  manifest.sources.osm.rawOutput,
);
const normalizedOutputPath = resolve(
  root,
  manifest.sources.osm.normalizedOutput,
);

function localToGeographic(x, z) {
  const easting = projected.easting + x;
  const northing = projected.northing + z;
  return utm24SToLatLon(easting, northing);
}

function geographicToLocal(latitude, longitude) {
  const [easting, northing] = latLonToUtm24S(
    latitude,
    longitude,
  );
  return projectedToLocal(projected, easting, northing);
}

const [south, west] = localToGeographic(
  bounds.minX,
  bounds.minZ,
);
const [north, east] = localToGeographic(
  bounds.maxX,
  bounds.maxZ,
);
const bbox = [south, west, north, east]
  .map((value) => value.toFixed(7))
  .join(",");

const query = `
[out:json][timeout:45];
(
  nwr["name"="Ladeira da Montanha"](${bbox});
  nwr["name"="Palácio Thomé de Souza"](${bbox});
  nwr["name"="Palácio Tomé de Sousa"](${bbox});
  nwr["name"="Prefeitura Municipal de Salvador"](${bbox});
  nwr["name"="Câmara Municipal de Salvador"](${bbox});
  way["highway"](${bbox});
  way["building"](${bbox});
  way["leisure"="square"](${bbox});
  way["place"="square"](${bbox});
);
out geom center tags;
`.trim();

async function queryOverpass() {
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
      });

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}`,
        );
      }

      const payload = await response.json();
      if (!Array.isArray(payload.elements)) {
        throw new Error(
          "response did not contain an elements array",
        );
      }

      return { endpoint, payload };
    } catch (error) {
      errors.push(
        `${endpoint}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  throw new Error(
    `All Overpass endpoints failed:\n${errors.join("\n")}`,
  );
}

function normalizeElement(element) {
  const feature = {
    id: `${element.type}/${element.id}`,
    osmType: element.type,
    osmId: element.id,
    tags: element.tags ?? {},
  };

  if (
    element.type === "node" &&
    Number.isFinite(element.lat) &&
    Number.isFinite(element.lon)
  ) {
    return {
      ...feature,
      geometryType: "point",
      point: geographicToLocal(
        element.lat,
        element.lon,
      ),
    };
  }

  if (
    Array.isArray(element.geometry) &&
    element.geometry.length > 0
  ) {
    const points = element.geometry
      .filter(
        (point) =>
          Number.isFinite(point?.lat) &&
          Number.isFinite(point?.lon),
      )
      .map((point) =>
        geographicToLocal(point.lat, point.lon),
      );

    if (points.length > 0) {
      const first = points[0];
      const last = points.at(-1);
      const closed =
        points.length >= 4 &&
        first &&
        last &&
        Math.hypot(
          first[0] - last[0],
          first[1] - last[1],
        ) < 0.05;

      return {
        ...feature,
        geometryType: closed
          ? "polygon"
          : "polyline",
        points,
      };
    }
  }

  if (
    Number.isFinite(element.center?.lat) &&
    Number.isFinite(element.center?.lon)
  ) {
    return {
      ...feature,
      geometryType: "center",
      point: geographicToLocal(
        element.center.lat,
        element.center.lon,
      ),
    };
  }

  return {
    ...feature,
    geometryType: "unknown",
  };
}

const { endpoint, payload } = await queryOverpass();

await mkdir(dirname(rawOutputPath), {
  recursive: true,
});
await writeFile(
  rawOutputPath,
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
);

const features = payload.elements
  .map(normalizeElement)
  .sort((a, b) => a.id.localeCompare(b.id));

const targetNames = new Set([
  "Ladeira da Montanha",
  "Palácio Thomé de Souza",
  "Palácio Tomé de Sousa",
  "Prefeitura Municipal de Salvador",
  "Câmara Municipal de Salvador",
]);

const namedTargets = features.filter((feature) =>
  targetNames.has(feature.tags?.name),
);

const output = {
  metadata: {
    source: "OpenStreetMap via Overpass API",
    sourceCrs: "EPSG:4326",
    normalizedCrs:
      manifest.localCoordinateSystem.horizontalCrs,
    transform:
      "deterministic WGS84 -> UTM zone 24S -> local metres",
    endpoint,
    generatedAt: new Date().toISOString(),
    localOrigin: {
      latitude: origin.latitude,
      longitude: origin.longitude,
      easting: projected.easting,
      northing: projected.northing,
    },
    boundsMeters: bounds,
    queryBboxWgs84: {
      south,
      west,
      north,
      east,
    },
    featureCount: features.length,
    namedTargetCount: namedTargets.length,
  },
  namedTargets,
  features,
};

await mkdir(dirname(normalizedOutputPath), {
  recursive: true,
});
await writeFile(
  normalizedOutputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Imported ${features.length} OSM features.`,
    `Named targets found: ${namedTargets.length}.`,
    `Raw: ${manifest.sources.osm.rawOutput}.`,
    `Normalized: ${
      manifest.sources.osm.normalizedOutput
    }.`,
  ].join(" "),
);
