/**
 * OSM processing pipeline.
 *
 * Reads the raw Overpass extraction (data/spatial/osm-lagos.json, produced by
 * pipelines/osm/extract.mjs) and turns it into reviewed, presentation-ready
 * GeoJSON layers plus a validation report. Nothing here fabricates data: every
 * output feature carries its OSM identity, original source tags and an explicit
 * confidence classification. Features whose geometry falls outside the Lagos
 * State boundary polygon are dropped. Unnamed features are kept when they are
 * geometrically valid and are labelled "Unnamed (OSM <id>)" — no name invented.
 *
 * Output (data/spatial/processed/):
 *   osm-health-facilities.geojson   amenity=hospital|clinic|doctors, healthcare=*
 *   osm-marine-access.geojson       ferry terminals + piers / landing candidates
 *   osm-waterways.geojson           waterway=* line geometry (navigability unknown)
 *   osm-processed.metadata.json     per-layer provenance + validation report
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const spatialDir = resolve(root, "data/spatial");
const outDir = resolve(spatialDir, "processed");

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolygon(point, geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polys.some((poly) => pointInRing(point, poly[0]) && !poly.slice(1).some((hole) => pointInRing(point, hole)));
}

function coordsOf(record) {
  if (record.center && Number.isFinite(record.center.lon) && Number.isFinite(record.center.lat)) {
    return [record.center.lon, record.center.lat];
  }
  if (Array.isArray(record.geometry) && record.geometry.length) {
    const first = record.geometry[0];
    if (first && Number.isFinite(first.lon) && Number.isFinite(first.lat)) return [first.lon, first.lat];
  }
  return null;
}
function lineOf(record) {
  if (!Array.isArray(record.geometry)) return null;
  const line = record.geometry
    .filter((p) => p && Number.isFinite(p.lon) && Number.isFinite(p.lat))
    .map((p) => [p.lon, p.lat]);
  return line.length >= 2 ? line : null;
}

function healthType(tags) {
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "clinic" || tags.healthcare === "clinic") return "clinic";
  if (tags.amenity === "doctors" || tags.healthcare === "doctor") return "doctors";
  if (tags.healthcare) return `healthcare:${tags.healthcare}`;
  return "health_facility";
}
function marineKind(record) {
  const tags = record.tags ?? {};
  if (tags.amenity === "ferry_terminal" || tags.ferry === "yes") return "ferry_terminal";
  if (tags.man_made === "pier") return "pier";
  if (tags.harbour) return "harbour";
  return "landing_candidate";
}

function bboxOf(features) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = ([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const feature of features) {
    const g = feature.geometry;
    if (g.type === "Point") visit(g.coordinates);
    else if (g.type === "LineString") g.coordinates.forEach(visit);
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

async function run() {
  const raw = JSON.parse(await readFile(resolve(spatialDir, "osm-lagos.json"), "utf8"));
  const boundaries = JSON.parse(await readFile(resolve(spatialDir, "lagos-administrative.json"), "utf8"));
  const state = boundaries.features.find((f) => f.properties.admin_level === "ADM1");
  if (!state) throw new Error("Lagos State boundary polygon not found; run pipeline:administrative first.");

  const retrievedAt = raw[0]?.retrieved_at ?? new Date().toISOString();
  const report = {
    inputRecords: raw.length,
    duplicateOsmIds: 0,
    droppedNoGeometry: 0,
    droppedOutsideLagos: 0,
    unnamedKept: { health: 0, marine: 0, waterway: 0 },
  };

  const seen = new Set();
  const health = [];
  const marine = [];
  const waterways = [];

  for (const record of raw) {
    const key = `${record.osm_type}/${record.osm_id}`;
    if (seen.has(key)) {
      report.duplicateOsmIds += 1;
      continue;
    }
    seen.add(key);
    const tags = record.tags ?? {};
    const name = typeof tags.name === "string" && tags.name.trim() ? tags.name.trim() : null;
    const identity = {
      osm_id: key,
      name: name ?? `Unnamed (OSM ${key})`,
      named: name !== null,
      source: "OpenStreetMap contributors",
      source_tags: tags,
      retrieved_at: retrievedAt,
      confidence: "openstreetmap_mapped_unverified",
      field_verified: false,
    };

    if (record.class === "health_facility") {
      const c = coordsOf(record);
      if (!c) {
        report.droppedNoGeometry += 1;
        continue;
      }
      if (!pointInPolygon(c, state.geometry)) {
        report.droppedOutsideLagos += 1;
        continue;
      }
      if (!identity.named) report.unnamedKept.health += 1;
      health.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: c },
        properties: { ...identity, layer: "osm_health_facility", facility_type: healthType(tags), operator: tags.operator ?? null },
      });
    } else if (record.class === "ferry_terminal" || record.class === "landing_candidate") {
      const c = coordsOf(record);
      if (!c) {
        report.droppedNoGeometry += 1;
        continue;
      }
      if (!pointInPolygon(c, state.geometry)) {
        report.droppedOutsideLagos += 1;
        continue;
      }
      if (!identity.named) report.unnamedKept.marine += 1;
      marine.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: c },
        properties: {
          ...identity,
          layer: "osm_marine_access",
          access_kind: marineKind(record),
          official_status: "unknown",
          navigability: "unknown",
        },
      });
    } else if (record.class === "mapped_waterway") {
      const line = lineOf(record);
      if (!line) {
        report.droppedNoGeometry += 1;
        continue;
      }
      // keep the segment if any vertex is inside Lagos
      if (!line.some((pt) => pointInPolygon(pt, state.geometry))) {
        report.droppedOutsideLagos += 1;
        continue;
      }
      if (!identity.named) report.unnamedKept.waterway += 1;
      waterways.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: line },
        properties: {
          ...identity,
          layer: "osm_waterway",
          waterway_type: tags.waterway ?? "unknown",
          navigability: "unknown",
        },
      });
    }
  }

  const layers = {
    "osm-health-facilities": {
      title: "OpenStreetMap mapped health facilities",
      features: health,
      geometryType: "Point",
      limitations:
        "OpenStreetMap contributor coverage. Not an official Lagos State health facility registry. Presence, position and service level are unverified; some facilities may be missing, closed or duplicated.",
    },
    "osm-marine-access": {
      title: "OpenStreetMap mapped marine access points",
      features: marine,
      geometryType: "Point",
      limitations:
        "Ferry terminals, piers and landing candidates tagged in OpenStreetMap. Not an official jetty register. Official status and navigability are unknown.",
    },
    "osm-waterways": {
      title: "OpenStreetMap mapped waterways",
      features: waterways,
      geometryType: "LineString",
      limitations:
        "waterway=* linework from OpenStreetMap. Navigability is not assessed — these lines must not be treated as a navigable transport network.",
    },
  };

  await mkdir(outDir, { recursive: true });
  const metadata = {
    id: "osm-processed",
    provider: "OpenStreetMap contributors",
    retrievedAt,
    processedAt: new Date().toISOString(),
    license: "Open Data Commons Open Database License (ODbL) 1.0",
    attribution: "© OpenStreetMap contributors",
    crs: "urn:ogc:def:crs:OGC:1.3:CRS84",
    boundaryFilter: "Point-in-polygon against GRID3 2022 Lagos State boundary (geoBoundaries gbOpen).",
    report,
    layers: {},
  };

  for (const [id, layer] of Object.entries(layers)) {
    const collection = { type: "FeatureCollection", features: layer.features };
    await writeFile(resolve(outDir, `${id}.geojson`), `${JSON.stringify(collection)}\n`);
    metadata.layers[id] = {
      title: layer.title,
      geometryType: layer.geometryType,
      featureCount: layer.features.length,
      namedCount: layer.features.filter((f) => f.properties.named).length,
      unnamedCount: layer.features.filter((f) => !f.properties.named).length,
      bbox: bboxOf(layer.features),
      limitations: layer.limitations,
    };
  }

  await writeFile(resolve(outDir, "osm-processed.metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  console.log("OSM processing complete:");
  for (const [id, meta] of Object.entries(metadata.layers)) {
    console.log(`  ${id}: ${meta.featureCount} features (${meta.unnamedCount} unnamed)`);
  }
  console.log(
    `  dropped: ${report.droppedOutsideLagos} outside Lagos, ${report.droppedNoGeometry} without usable geometry, ${report.duplicateOsmIds} duplicate IDs`,
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
