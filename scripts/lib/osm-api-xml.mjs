function decodeXmlEntity(
  value,
) {
  return value.replace(
    /&(#x[0-9a-fA-F]+|#\d+|amp|quot|apos|lt|gt);/g,
    (match, entity) => {
      if (
        typeof entity !== "string"
      ) {
        return match;
      }

      if (
        entity.startsWith("#x")
      ) {
        const codePoint =
          Number.parseInt(
            entity.slice(2),
            16,
          );
        return Number.isFinite(
          codePoint,
        )
          ? String.fromCodePoint(
              codePoint,
            )
          : match;
      }

      if (
        entity.startsWith("#")
      ) {
        const codePoint =
          Number.parseInt(
            entity.slice(1),
            10,
          );
        return Number.isFinite(
          codePoint,
        )
          ? String.fromCodePoint(
              codePoint,
            )
          : match;
      }

      return (
        {
          amp: "&",
          quot: '"',
          apos: "'",
          lt: "<",
          gt: ">",
        }[entity] ?? match
      );
    },
  );
}

function attributesOf(source) {
  const attributes = {};
  const pattern =
    /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(["'])(.*?)\2/g;

  for (const match of source.matchAll(pattern)) {
    const key = match[1];
    const value = match[3];

    if (
      typeof key === "string" &&
      typeof value === "string"
    ) {
      attributes[key] =
        decodeXmlEntity(value);
    }
  }

  return attributes;
}

function assertOsmDocument(xml) {
  if (
    typeof xml !== "string" ||
    !/<osm(?:\s|>)/i.test(xml)
  ) {
    throw new Error(
      "OSM API response is not an <osm> XML document.",
    );
  }

  if (
    /<remark(?:\s|>)/i.test(xml)
  ) {
    throw new Error(
      "OSM API response contains a remark/error element.",
    );
  }
}

export function parseOsmApiXml(
  xml,
) {
  assertOsmDocument(xml);

  const nodes = new Map();

  for (const match of xml.matchAll(
    /<node\b([^>]*?)(?:\/>|>[\s\S]*?<\/node>)/gi,
  )) {
    const attrs =
      attributesOf(
        match[1] ?? "",
      );
    const id =
      attrs.id;
    const latitude =
      Number(attrs.lat);
    const longitude =
      Number(attrs.lon);

    if (
      !id ||
      !Number.isFinite(
        latitude,
      ) ||
      !Number.isFinite(
        longitude,
      )
    ) {
      continue;
    }

    nodes.set(id, {
      lat: latitude,
      lon: longitude,
    });
  }

  const elements = [];

  for (const match of xml.matchAll(
    /<way\b([^>]*)>([\s\S]*?)<\/way>/gi,
  )) {
    const attrs =
      attributesOf(
        match[1] ?? "",
      );
    const body =
      match[2] ?? "";
    const id = Number(
      attrs.id,
    );

    if (
      !Number.isFinite(id)
    ) {
      continue;
    }

    const tags = {};
    for (const tagMatch of body.matchAll(
      /<tag\b([^>]*?)\/?>/gi,
    )) {
      const tagAttrs =
        attributesOf(
          tagMatch[1] ?? "",
        );
      const key =
        tagAttrs.k;
      const value =
        tagAttrs.v;

      if (
        typeof key === "string" &&
        typeof value === "string"
      ) {
        tags[key] = value;
      }
    }

    const geometry = [];
    let missingNodeCount = 0;

    for (const ndMatch of body.matchAll(
      /<nd\b([^>]*?)\/?>/gi,
    )) {
      const ndAttrs =
        attributesOf(
          ndMatch[1] ?? "",
        );
      const ref =
        ndAttrs.ref;
      const point =
        ref
          ? nodes.get(ref)
          : undefined;

      if (point) {
        geometry.push(point);
      } else {
        missingNodeCount += 1;
      }
    }

    if (
      missingNodeCount > 0
    ) {
      throw new Error(
        "OSM API way/" +
          id +
          " references " +
          missingNodeCount +
          " missing node(s); refusing incomplete geometry.",
      );
    }

    elements.push({
      type: "way",
      id,
      tags,
      geometry,
    });
  }

  if (
    elements.length === 0
  ) {
    throw new Error(
      "OSM API XML contains no usable ways.",
    );
  }

  return {
    version: "0.6",
    generator:
      "OpenStreetMap API bbox",
    elements,
  };
}
