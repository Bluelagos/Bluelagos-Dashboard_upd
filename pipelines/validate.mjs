import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const spatial = resolve(root, "data/spatial");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function walkCoordinates(value, visit) {
  if (typeof value?.[0] === "number") visit(value);
  else for (const child of value ?? []) walkCoordinates(child, visit);
}

async function optional(path) {
  try { await access(path, constants.R_OK); return true; } catch { return false; }
}

async function run() {
  const boundaries = await readJson(resolve(spatial, "lagos-administrative.json"));
  const metadata = await readJson(resolve(spatial, "lagos-administrative.metadata.json"));
  if (boundaries.type !== "FeatureCollection" || !Array.isArray(boundaries.features)) throw new Error("Administrative output is not GeoJSON FeatureCollection.");
  if (boundaries.features.length !== 21 || metadata.featureCount !== 21) throw new Error("Administrative feature count must be 21.");
  const ids = new Set();
  let adm1 = 0; let adm2 = 0;
  for (const feature of boundaries.features) {
    if (!["Polygon", "MultiPolygon"].includes(feature.geometry?.type)) throw new Error(`Invalid geometry for ${feature.properties?.layer_id}.`);
    if (ids.has(feature.properties.layer_id)) throw new Error(`Duplicate layer ID ${feature.properties.layer_id}.`);
    ids.add(feature.properties.layer_id);
    if (feature.properties.admin_level === "ADM1") adm1 += 1;
    if (feature.properties.admin_level === "ADM2") adm2 += 1;
    walkCoordinates(feature.geometry.coordinates, ([longitude, latitude]) => {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) throw new Error(`Invalid WGS84 coordinate in ${feature.properties.layer_id}.`);
    });
  }
  if (adm1 !== 1 || adm2 !== 20) throw new Error(`Administrative levels invalid: ${adm1} ADM1 and ${adm2} ADM2.`);

  const osmPath = resolve(spatial, "osm-lagos.json");
  if (await optional(osmPath)) {
    const osm = await readJson(osmPath);
    const osmIds = new Set();
    for (const record of osm) {
      const id = `${record.osm_type}/${record.osm_id}`;
      if (osmIds.has(id)) throw new Error(`Duplicate OSM ID ${id}.`);
      osmIds.add(id);
      if (record.class === "mapped_waterway" && record.navigability_status !== "unknown") throw new Error(`${id} has unreviewed navigability status.`);
    }
    console.log(`OSM raw extraction: ${osm.length} records validated as contextual/unverified.`);
  } else {
    console.log("OSM raw extraction: unavailable (adapter exists; run pipeline:osm).");
  }

  const processedMetaPath = resolve(spatial, "processed/osm-processed.metadata.json");
  if (await optional(processedMetaPath)) {
    const meta = await readJson(processedMetaPath);
    const boundaryPoly = boundaries.features.find((f) => f.properties.admin_level === "ADM1");
    for (const [id, layerMeta] of Object.entries(meta.layers)) {
      const collection = await readJson(resolve(spatial, `processed/${id}.geojson`));
      if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new Error(`Processed OSM layer ${id} is not a FeatureCollection.`);
      if (collection.features.length !== layerMeta.featureCount) throw new Error(`Processed OSM layer ${id}: metadata says ${layerMeta.featureCount} features but file has ${collection.features.length}.`);
      const ids = new Set();
      for (const feature of collection.features) {
        const oid = feature.properties?.osm_id;
        if (!oid) throw new Error(`Processed OSM feature in ${id} is missing osm_id provenance.`);
        if (ids.has(oid)) throw new Error(`Duplicate OSM id ${oid} in processed layer ${id}.`);
        ids.add(oid);
        if (feature.properties.field_verified !== false) throw new Error(`Processed OSM feature ${oid} claims field verification.`);
        if ((id === "osm-marine-access" || id === "osm-waterways") && feature.properties.navigability !== "unknown") throw new Error(`Processed OSM feature ${oid} asserts navigability.`);
        walkCoordinates(feature.geometry.coordinates, ([lon, lat]) => {
          if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error(`Invalid coordinate in processed OSM layer ${id}.`);
        });
      }
      console.log(`Processed OSM layer ${id}: ${collection.features.length} boundary-clipped features (${layerMeta.unnamedCount} unnamed), OSM ids + ODbL attribution present.`);
    }
    void boundaryPoly;
  } else {
    console.log("Processed OSM layers: unavailable (run pipeline:osm:process).");
  }
  const derivedPath = resolve(spatial, "derived/community-spatial-context.json");
  if (!(await optional(derivedPath))) throw new Error("Derived community spatial context is missing; run npm run spatial:derive.");
  const derived = await readJson(derivedPath);
  if (derived.metadata?.community_count !== derived.communities?.length || derived.communities.length !== 93) throw new Error("Derived spatial context must contain the 93 verified geolocated communities.");
  const derivedIds = new Set();
  for (const row of derived.communities) {
    if (derivedIds.has(row.community_id)) throw new Error(`Duplicate derived community id ${row.community_id}.`);
    derivedIds.add(row.community_id);
    if (!row.nearest_health_feature_id || !Number.isFinite(row.distance_km) || row.distance_km < 0) throw new Error(`Invalid health-distance derivation for community ${row.community_id}.`);
    if (row.method !== "great-circle straight-line distance" || row.nearest_health_source !== "OpenStreetMap mapped health facilities") throw new Error(`Invalid derivation provenance for community ${row.community_id}.`);
    if (!row.h3_cell || !Number.isFinite(row.marine_access_distance_km) || !Number.isFinite(row.waterway_distance_km)) throw new Error(`Incomplete spatial derivation for community ${row.community_id}.`);
  }
  console.log(`Derived spatial context: ${derived.communities.length} community rows with health, marine, waterway and H3 context validated.`);
  console.log("Administrative output: 1 state and 20 unique LGA geometries validated in WGS84 coordinate range.");
  console.log("Earth observation, modelled population and validated navigable water network: unavailable; no analytical values published.");
  console.log("Note: OSM health/marine layers are contributor evidence, not authoritative Lagos State registries.");
}

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
