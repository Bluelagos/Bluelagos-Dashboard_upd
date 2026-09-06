import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { latLngToCell } from "h3-js";
import { point, pointToLineDistance } from "@turf/turf";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const earthRadiusKm = 6371.0088;
const radians = (value) => (value * Math.PI) / 180;
const distanceKm = (a, b) => {
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};
const rounded = (value) => Number(value.toFixed(3));

const [snapshot, health, marine, waterways, osmMetadata] = await Promise.all([
  readJson("data/presentation-snapshot.json"),
  readJson("data/spatial/processed/osm-health-facilities.geojson"),
  readJson("data/spatial/processed/osm-marine-access.geojson"),
  readJson("data/spatial/processed/osm-waterways.geojson"),
  readJson("data/spatial/processed/osm-processed.metadata.json"),
]);

const nearestPoint = (coordinate, features) => {
  let nearest = null;
  let distance = Infinity;
  for (const feature of features) {
    const value = distanceKm(coordinate, feature.geometry.coordinates);
    if (value < distance || (value === distance && feature.properties.osm_id < nearest?.properties.osm_id)) {
      nearest = feature;
      distance = value;
    }
  }
  return { feature: nearest, distance };
};

const calculatedAt = snapshot.createdAt ?? osmMetadata.processedAt;
const rows = snapshot.records
  .filter((row) => Number.isFinite(Number(row.longitude)) && Number.isFinite(Number(row.latitude)) && Number(row.longitude) !== 0 && Number(row.latitude) !== 0)
  .sort((a, b) => Number(a.id) - Number(b.id))
  .map((row) => {
    const coordinate = [Number(row.longitude), Number(row.latitude)];
    const nearestHealth = nearestPoint(coordinate, health.features);
    const nearestMarine = nearestPoint(coordinate, marine.features);
    let waterwayDistance = Infinity;
    let waterwayId = null;
    for (const feature of waterways.features) {
      const value = pointToLineDistance(point(coordinate), feature, { units: "kilometers" });
      if (value < waterwayDistance || (value === waterwayDistance && feature.properties.osm_id < waterwayId)) {
        waterwayDistance = value;
        waterwayId = feature.properties.osm_id;
      }
    }
    return {
      community_id: Number(row.id),
      nearest_health_feature_id: nearestHealth.feature?.properties.osm_id ?? null,
      nearest_health_name: nearestHealth.feature?.properties.named ? nearestHealth.feature.properties.name : null,
      nearest_health_type: nearestHealth.feature?.properties.facility_type ?? null,
      nearest_health_source: "OpenStreetMap mapped health facilities",
      distance_km: rounded(nearestHealth.distance),
      calculated_at: calculatedAt,
      method: "great-circle straight-line distance",
      nearest_marine_feature_id: nearestMarine.feature?.properties.osm_id ?? null,
      nearest_marine_name: nearestMarine.feature?.properties.named ? nearestMarine.feature.properties.name : null,
      marine_access_distance_km: rounded(nearestMarine.distance),
      marine_access_within_5km: marine.features.filter((feature) => distanceKm(coordinate, feature.geometry.coordinates) <= 5).length,
      nearest_waterway_feature_id: waterwayId,
      waterway_distance_km: rounded(waterwayDistance),
      h3_cell: latLngToCell(coordinate[1], coordinate[0], 7),
    };
  });

const output = {
  metadata: {
    title: "Blue Lagos derived community spatial context",
    community_count: rows.length,
    generated_from_snapshot: snapshot.createdAt ?? null,
    osm_processed_at: osmMetadata.processedAt,
    method: "great-circle straight-line distance",
    health_source: "OpenStreetMap mapped health facilities",
    h3_resolution: 7,
    caveat: "Analytical planning context only. Distances are straight-line, not routes or travel time.",
  },
  communities: rows,
};
const outputPath = resolve(root, "data/spatial/derived/community-spatial-context.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Derived spatial context: ${rows.length} geolocated communities written to ${outputPath}.`);
