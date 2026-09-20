export function inspectOverpassPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      valid: false,
      elementCount: 0,
      remark: "",
      reason: "response is not an object",
    };
  }

  const remark =
    typeof payload.remark === "string"
      ? payload.remark.trim()
      : "";
  const elements = Array.isArray(payload.elements)
    ? payload.elements
    : null;

  if (!elements) {
    return {
      valid: false,
      elementCount: 0,
      remark,
      reason: "response has no elements array",
    };
  }

  if (remark) {
    return {
      valid: false,
      elementCount: elements.length,
      remark,
      reason: "response contains an Overpass remark",
    };
  }

  if (elements.length === 0) {
    return {
      valid: false,
      elementCount: 0,
      remark: "",
      reason: "response contains no elements",
    };
  }

  return {
    valid: true,
    elementCount: elements.length,
    remark: "",
    reason: null,
  };
}

export function assertUsableOverpassPayload(
  payload,
  source = "Overpass",
) {
  const inspection = inspectOverpassPayload(payload);

  if (!inspection.valid) {
    const detail = inspection.remark
      ? ` · ${inspection.remark}`
      : "";
    throw new Error(
      `${source}: ${inspection.reason}${detail}`,
    );
  }

  return payload;
}
