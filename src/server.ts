import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import geospatialBase from "./data/geospatial-base.json";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};


type GeographicBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

const projectBounds =
  geospatialBase.geographicBounds as GeographicBounds;

const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const osmApiEndpoint =
  "https://api.openstreetmap.org/api/0.6/map";

function projectBbox(bounds: GeographicBounds) {
  return [
    bounds.south,
    bounds.west,
    bounds.north,
    bounds.east,
  ]
    .map((value) => value.toFixed(7))
    .join(",");
}

function projectBboxForOsmApi(
  bounds: GeographicBounds,
) {
  return [
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north,
  ]
    .map((value) => value.toFixed(7))
    .join(",");
}

function overpassQuery(
  bounds: GeographicBounds,
) {
  const bbox = projectBbox(bounds);
  return `
[out:json][timeout:25];
(
  way["highway"](${bbox});
  way["building"](${bbox});
  way["place"="square"](${bbox});
  way["leisure"="square"](${bbox});
  way["leisure"="park"](${bbox});
  way["highway"="pedestrian"]["area"="yes"](${bbox});
  nwr["name"="Ladeira da Montanha"](${bbox});
  nwr["name"="Rua Chile"](${bbox});
  nwr["name"="Rua da Conceição da Praia"](${bbox});
  nwr["name"="Avenida Lafayete Coutinho"](${bbox});
);
out body geom;
`.trim();
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 12_000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function serveProjectOsm() {
  const query = overpassQuery(
    projectBounds,
  );
  const errors: string[] = [];

  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/x-www-form-urlencoded;charset=UTF-8",
            accept: "application/json",
          },
          body: new URLSearchParams({
            data: query,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}`,
        );
      }

      const body = await response.text();
      const parsed = JSON.parse(body) as {
        elements?: unknown[];
      };

      if (!Array.isArray(parsed.elements)) {
        throw new Error(
          "Overpass response has no elements array.",
        );
      }

      return new Response(body, {
        status: 200,
        headers: {
          "content-type":
            "application/json; charset=utf-8",
          "cache-control":
            "public, max-age=120, s-maxage=300",
          "x-geodata-provider": "overpass",
          "x-geodata-bbox":
            projectBboxForOsmApi(
              projectBounds,
            ),
        },
      });
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

  try {
    const endpoint =
      `${osmApiEndpoint}?bbox=${encodeURIComponent(
        projectBboxForOsmApi(
          projectBounds,
        ),
      )}`;
    const response = await fetchWithTimeout(
      endpoint,
      {
        headers: {
          accept:
            "application/xml,text/xml",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`,
      );
    }

    return new Response(
      await response.text(),
      {
        status: 200,
        headers: {
          "content-type":
            "application/xml; charset=utf-8",
          "cache-control":
            "public, max-age=120, s-maxage=300",
          "x-geodata-provider":
            "openstreetmap-api",
          "x-geodata-bbox":
            projectBboxForOsmApi(
              projectBounds,
            ),
        },
      },
    );
  } catch (error) {
    errors.push(
      `${osmApiEndpoint}: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  return Response.json(
    {
      error:
        "OpenStreetMap project data unavailable.",
      detail: errors,
    },
    {
      status: 502,
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (
        request.method === "GET" &&
        url.pathname === "/api/geospatial/osm"
      ) {
        return await serveProjectOsm();
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
