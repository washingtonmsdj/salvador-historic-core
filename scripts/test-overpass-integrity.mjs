import {
  assertUsableOverpassPayload,
  inspectOverpassPayload,
} from "./lib/overpass-integrity.mjs";

const failures = [];

const valid = inspectOverpassPayload({
  elements: [{ type: "way", id: 1 }],
});
if (!valid.valid || valid.elementCount !== 1) {
  failures.push("valid Overpass payload was rejected");
}

const missing = inspectOverpassPayload({});
if (missing.valid || missing.reason !== "response has no elements array") {
  failures.push("payload without elements was not rejected");
}

const empty = inspectOverpassPayload({ elements: [] });
if (empty.valid || empty.reason !== "response contains no elements") {
  failures.push("empty Overpass payload was not rejected");
}

const remarked = inspectOverpassPayload({
  elements: [{ type: "way", id: 1 }],
  remark: "runtime error: Query timed out",
});
if (
  remarked.valid ||
  remarked.reason !== "response contains an Overpass remark"
) {
  failures.push("remarked Overpass payload was not rejected");
}

try {
  assertUsableOverpassPayload(
    {
      elements: [{ type: "way", id: 1 }],
      remark: "runtime error",
    },
    "test provider",
  );
  failures.push("assertUsableOverpassPayload did not throw");
} catch (error) {
  const message =
    error instanceof Error ? error.message : String(error);
  if (!message.includes("runtime error")) {
    failures.push("Overpass rejection lost the provider remark");
  }
}

if (failures.length > 0) {
  console.error("Overpass integrity test failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Overpass integrity test passed.");
}
