import { parseOsmApiXml } from "./lib/osm-api-xml.mjs";

const xml = `<?xml version="1.0"?>
<osm version="0.6" generator="test">
  <node id="1" lat="-12.97" lon="-38.51"/>
  <node id="2" lat="-12.971" lon="-38.511"/>
  <node id="3" lat="-12.972" lon="-38.512"/>
  <way id="10">
    <nd ref="1"/>
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="residential"/>
    <tag k="name" v="Rua A &amp; B"/>
  </way>
</osm>`;

const parsed = parseOsmApiXml(xml);
if (parsed.elements.length !== 1) {
  throw new Error("Expected one parsed way.");
}
const way = parsed.elements[0];
if (
  way.id !== 10 ||
  way.tags.name !== "Rua A & B" ||
  way.geometry.length !== 3
) {
  throw new Error("OSM XML parsing lost identity, tags or geometry.");
}

let incompleteRejected = false;
try {
  parseOsmApiXml(`<osm version="0.6"><way id="5"><nd ref="999"/></way></osm>`);
} catch {
  incompleteRejected = true;
}
if (!incompleteRejected) {
  throw new Error("Missing node references must be rejected.");
}

console.log("OSM API XML parser test passed.");
