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
import { assertUsableOverpassPayload } from "./lib/overpass-integrity.mjs";
import { parseOsmApiXml } from "./lib/osm-api-xml.mjs";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const OSM_API_ENDPOINT =
  "https://api.openstreetmap.org/api/0.6/map";

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

const cornerCoordinates = [
  localToGeographic(
    bounds.minX,
    bounds.minZ,
  ),
  localToGeographic(
    bounds.maxX,
    bounds.minZ,
  ),
  localToGeographic(
    bounds.maxX,
    bounds.maxZ,
  ),
  localToGeographic(
    bounds.minX,
    bounds.maxZ,
  ),
];

const latitudes = cornerCoordinates.map(
  ([latitude]) => latitude,
);
const longitudes = cornerCoordinates.map(
  ([, longitude]) => longitude,
);
const south = Math.min(...latitudes);
const west = Math.min(...longitudes);
const north = Math.max(...latitudes);
const east = Math.max(...longitudes);

const bbox = [south, west, north, east]
  .map((value) => value.toFixed(7))
  .join(",");

const osmApiBbox = [
  west,
  south,
  east,
  north,
]
  .map((value) => value.toFixed(7))
  .join(",");

const terrainFeatureSelectors =
  Object.keys(
    manifest.vectorDerivation
      ?.terrainFeatures?.lines ?? {},
  )
    .concat(
      Object.keys(
        manifest.vectorDerivation
          ?.terrainFeatures?.areas ?? {},
      ),
    )
    .map((selector) => {
      const separator =
        selector.indexOf("=");
      const key =
        selector.slice(
          0,
          separator,
        );
      const value =
        selector.slice(
          separator + 1,
        );

      return (
        '  nwr["' +
        key +
        '"="' +
        value +
        '"](' +
        bbox +
        ');'
      );
    });

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
  way["leisure"="park"](${bbox});
  way["place"="square"](${bbox});
${terrainFeatureSelectors.join("\n")}
);
out body geom;
`.trim();

async function queryOverpass() {
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type":
            "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent":
            "salvador-historic-core/1.0 (+https://github.com/washingtonmsdj/salvador-historic-core)",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(50_000),
      });

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}`,
        );
      }

      const payload = await response.json();
      assertUsableOverpassPayload(
        payload,
        endpoint,
      );

      return {
        endpoint,
        payload,
        provider: "overpass",
      };
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

async function queryOsmApi() {
  const endpoint =
    OSM_API_ENDPOINT +
    "?bbox=" +
    encodeURIComponent(osmApiBbox);
  const response = await fetch(
    endpoint,
    {
      headers: {
        accept:
          "application/xml,text/xml",
        "user-agent":
          "salvador-historic-core/1.0 (+https://github.com/washingtonmsdj/salvador-historic-core)",
      },
      signal:
        AbortSignal.timeout(
          45_000,
        ),
    },
  );

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}`,
    );
  }

  const payload =
    parseOsmApiXml(
      await response.text(),
    );

  if (
    !Array.isArray(
      payload.elements,
    ) ||
    payload.elements.length === 0
  ) {
    throw new Error(
      "OSM API bbox returned no usable ways.",
    );
  }

  return {
    endpoint,
    payload,
    provider:
      "openstreetmap-api",
  };
}

async function queryOsmSource() {
  try {
    return await queryOverpass();
  } catch (overpassError) {
    try {
      return await queryOsmApi();
    } catch (osmApiError) {
      throw new Error(
        [
          overpassError instanceof Error
            ? overpassError.message
            : String(overpassError),
          OSM_API_ENDPOINT +
            ": " +
            (osmApiError instanceof Error
              ? osmApiError.message
              : String(osmApiError)),
        ].join("\n"),
      );
    }
  }
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

const {
  endpoint,
  payload,
  provider,
} = await queryOsmSource();

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

const criticalRoadNames =
  manifest.vectorDerivation?.criticalRoadNames ?? [];
const importedRoadNames = new Set(
  features
    .filter((feature) => feature.tags?.highway)
    .map((feature) =>
      String(feature.tags?.name ?? "")
        .trim()
        .toLocaleLowerCase("pt-BR"),
    )
    .filter(Boolean),
);
const missingCriticalRoads =
  criticalRoadNames.filter(
    (name) =>
      !importedRoadNames.has(
        name
          .trim()
          .toLocaleLowerCase("pt-BR"),
      ),
  );
const criticalRoadCoverage = {
  found:
    criticalRoadNames.length -
    missingCriticalRoads.length,
  total: criticalRoadNames.length,
  missing: missingCriticalRoads,
  complete:
    missingCriticalRoads.length === 0,
};
const coverage =
  criticalRoadCoverage.complete
    ? "complete"
    : "partial";

const output = {
  metadata: {
    source:
      provider === "openstreetmap-api"
        ? "OpenStreetMap official bbox API"
        : "OpenStreetMap via Overpass API",
    provider,
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
    coverage,
    criticalRoadCoverage,
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
    `Coverage: ${coverage} (${criticalRoadCoverage.found}/${criticalRoadCoverage.total} critical roads).`,
    `Raw: ${manifest.sources.osm.rawOutput}.`,
    `Normalized: ${
      manifest.sources.osm.normalizedOutput
    }.`,
  ].join(" "),
);
