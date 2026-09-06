import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(root, "data/spatial");
// Overpass load-balances poorly; the main endpoint frequently returns 504. Try a
// list of public mirrors in order and use the first that answers. Override with
// OVERPASS_API_URL to pin a single endpoint.
const endpoints = process.env.OVERPASS_API_URL
  ? [process.env.OVERPASS_API_URL]
  : [
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.openstreetmap.ru/api/interpreter",
    ];
const query = `[out:json][timeout:180];area["name"="Lagos"]["boundary"="administrative"]["admin_level"="4"]->.lagos;(nwr(area.lagos)[amenity~"^(hospital|clinic|doctors|school|marketplace|ferry_terminal)$"];nwr(area.lagos)[public_transport="station"][ferry="yes"];nwr(area.lagos)[man_made="pier"];way(area.lagos)[waterway];relation(area.lagos)[route="ferry"];);out tags center geom;`;

async function fetchElements() {
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Blue-Lagos-spatial-pipeline/1.0" },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) {
        lastError = new Error(`Overpass request to ${endpoint} failed (${response.status}).`);
        continue;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.elements)) {
        lastError = new Error(`Overpass response from ${endpoint} has no elements array.`);
        continue;
      }
      return { elements: payload.elements, endpoint };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw new Error(`All Overpass endpoints failed. Existing processed outputs were not replaced. Last error: ${lastError?.message}`);
}

function classify(element) {
  const tags = element.tags ?? {};
  if (["hospital", "clinic", "doctors"].includes(tags.amenity)) return "health_facility";
  if (tags.amenity === "ferry_terminal" || tags.ferry === "yes") return "ferry_terminal";
  if (tags.man_made === "pier") return "landing_candidate";
  if (tags.waterway) return "mapped_waterway";
  if (tags.route === "ferry") return "ferry_route";
  if (tags.amenity === "school") return "school";
  if (tags.amenity === "marketplace") return "market";
  return "other";
}

async function run() {
  const { elements, endpoint } = await fetchElements();
  const retrievedAt = new Date().toISOString();
  const records = elements.map((element) => ({ osm_type: element.type, osm_id: element.id, class: classify(element), tags: element.tags ?? {}, center: element.type === "node" ? { lat: element.lat, lon: element.lon } : element.center ?? null, geometry: element.geometry ?? null, source: "OpenStreetMap contributors", retrieved_at: retrievedAt, navigability_status: element.tags?.waterway ? "unknown" : undefined, verified: false }));
  if (new Set(records.map((record) => `${record.osm_type}/${record.osm_id}`)).size !== records.length) throw new Error("Duplicate OSM identifiers detected.");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputDirectory, "osm-lagos.json"), `${JSON.stringify(records)}\n`),
    writeFile(resolve(outputDirectory, "osm-lagos.metadata.json"), `${JSON.stringify({ id: "osm-lagos-context", title: "OSM Lagos contextual features", provider: "OpenStreetMap contributors", source: endpoint, retrievedAt, license: "Open Data Commons Open Database License (ODbL) 1.0", featureCount: records.length, processing: "Repeatable Overpass extraction with source IDs and unmodified tags. Features are classified without merging with Blue Lagos field records.", limitations: "OSM completeness and positional accuracy vary. Landing candidates and waterways are unverified and must not be treated as official or navigable.", confidence: "Contextual only until matched against authoritative or field evidence" }, null, 2)}\n`),
  ]);
  console.log(`Validated ${records.length} OSM records. Navigability remains unknown unless separately verified.`);
}

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
