import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const EARTH_RADIUS_METERS = 6_378_137;
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const root = process.cwd();
const siteDataPath = resolve(root, "src/data/site-data.json");
const outputPath = resolve(root, "src/data/osm-site.reference.json");
const siteData = JSON.parse(await readFile(siteDataPath, "utf8"));

const origin = siteData.metadata?.origin;
const bounds = siteData.terrain?.bounds;

if (!origin || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) {
  throw new Error("site-data.json must define a geographic origin.");
}
if (!bounds) {
  throw new Error("site-data.json must define terrain bounds.");
}

const toRadians = Math.PI / 180;
const toDegrees = 180 / Math.PI;

function localToGeographic(x, z) {
  const latitude =
    origin.latitude + (z / EARTH_RADIUS_METERS) * toDegrees;
  const longitude =
    origin.longitude +
    (x / (EARTH_RADIUS_METERS * Math.cos(origin.latitude * toRadians))) *
      toDegrees;

  return [latitude, longitude];
}

function geographicToLocal(latitude, longitude) {
  const x =
    (longitude - origin.longitude) *
    toRadians *
    EARTH_RADIUS_METERS *
    Math.cos(origin.latitude * toRadians);
  const z =
    (latitude - origin.latitude) *
    toRadians *
    EARTH_RADIUS_METERS;

  return [
    Number(x.toFixed(3)),
    Number(z.toFixed(3)),
  ];
}

const [south, west] = localToGeographic(bounds.minX, bounds.minZ);
const [north, east] = localToGeographic(bounds.maxX, bounds.maxZ);
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
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload.elements)) {
        throw new Error("response did not contain an elements array");
      }

      return { endpoint, payload };
    } catch (error) {
      errors.push(
        `${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
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
      point: geographicToLocal(element.lat, element.lon),
    };
  }

  if (Array.isArray(element.geometry) && element.geometry.length > 0) {
    const points = element.geometry
      .filter(
        (point) =>
          Number.isFinite(point?.lat) &&
          Number.isFinite(point?.lon),
      )
      .map((point) => geographicToLocal(point.lat, point.lon));

    if (points.length > 0) {
      const closed =
        points.length >= 4 &&
        points[0]?.[0] === points.at(-1)?.[0] &&
        points[0]?.[1] === points.at(-1)?.[1];

      return {
        ...feature,
        geometryType: closed ? "polygon" : "polyline",
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
const features = payload.elements
  .map(normalizeElement)
  .sort((a, b) => a.id.localeCompare(b.id));

const namedTargets = features.filter((feature) =>
  [
    "Ladeira da Montanha",
    "Palácio Thomé de Souza",
    "Palácio Tomé de Sousa",
    "Prefeitura Municipal de Salvador",
    "Câmara Municipal de Salvador",
  ].includes(feature.tags?.name),
);

const output = {
  metadata: {
    source: "OpenStreetMap via Overpass API",
    endpoint,
    generatedAt: new Date().toISOString(),
    localOrigin: {
      latitude: origin.latitude,
      longitude: origin.longitude,
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

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Imported ${features.length} OSM features.`,
    `Named targets found: ${namedTargets.length}.`,
    `Output: ${outputPath.replace(`${root}/`, "")}`,
  ].join(" "),
);
