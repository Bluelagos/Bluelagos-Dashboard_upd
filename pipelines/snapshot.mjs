/**
 * Presentation snapshot generator.
 *
 *   npm run snapshot:presentation
 *
 * Fetches the full paginated Supabase community register exactly as the app
 * does, checks count integrity and identity fields, and writes a frozen copy to
 * data/presentation-snapshot.json. If the live database is unreachable during
 * the presentation, the app can fall back to this file and clearly label the
 * screen "VERIFIED SNAPSHOT" with this timestamp. Never silently.
 *
 * The snapshot contains only the same public view rows the anon key can already
 * read. No secrets, no service-role key.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_SIZE = 500;
const COLUMNS =
  "id,community_name,final_name,community_head,lga,senatorial_district,pulled_senatorial_district,longitude,latitude,estimated_population,household_estimated_population,estimated_registered_voters,estimated_number_of_women,estimated_number_of_youth,primary_visit_route,primary_occupation,priority_needed_amenities,survey_image_url,nearest_hospital_name,dist_to_hospital_km,cholera_outbreak_risk,healthcare_stranding_status,multi_dimensional_poverty_index,erosion_displacement_threat,trapped_pregnant_women,digital_exclusion_status,post_harvest_loss_risk,energy_poverty_status,flood_health_hazard_score,raw_sanitation_deficit,disaster_preparedness_void,landing_jetty_condition,nearest_neighbor_km,density_5km,dist_to_cbd_km,nearest_neighbor_name,communities_within_3km";

async function loadEnv() {
  try {
    const text = await readFile(resolve(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    /* env may come from the shell */
  }
}

async function run() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public configuration missing; cannot build a genuine snapshot.");

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const records = [];
  let serverCount = null;
  for (let page = 0; page < 10000; page += 1) {
    const from = page * PAGE_SIZE;
    const result = await client
      .from("blue_lagos_dashboard_kpis")
      .select(COLUMNS, { count: "exact" })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(`Snapshot page ${page + 1} failed: ${result.error.message}`);
    if (!Array.isArray(result.data)) throw new Error(`Snapshot page ${page + 1} malformed.`);
    if (page === 0) serverCount = result.count;
    records.push(...result.data);
    if (result.data.length < PAGE_SIZE) break;
  }

  if (!records.length) throw new Error("Live view returned no rows; snapshot aborted.");
  const missingIdentity = records.filter((r) => typeof r.id !== "number" || (!r.final_name && !r.community_name));
  if (missingIdentity.length) throw new Error(`${missingIdentity.length} row(s) lack identity fields; snapshot aborted to protect authoritative totals.`);
  if (serverCount !== null && serverCount !== records.length) {
    throw new Error(`Count integrity failure: database reports ${serverCount} rows, fetched ${records.length}.`);
  }
  const ids = new Set(records.map((r) => r.id));
  if (ids.size !== records.length) throw new Error("Duplicate community identifiers; snapshot aborted.");

  const geolocated = records.filter(
    (r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) && !(Number(r.latitude) === 0 && Number(r.longitude) === 0),
  ).length;
  const populationKnown = records.filter((r) => r.estimated_population !== null && r.estimated_population !== "" && Number.isFinite(Number(r.estimated_population))).length;

  const snapshot = {
    kind: "blue-lagos-presentation-snapshot",
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    source: "Supabase blue_lagos_dashboard_kpis (anon-readable view)",
    validation: {
      rowCount: records.length,
      serverCount,
      countIntegrity: serverCount === null ? "unverified" : "passed",
      geolocatedCount: geolocated,
      populationKnownCount: populationKnown,
      populationUnknownCount: records.length - populationKnown,
      duplicateIds: 0,
      identityComplete: true,
    },
    records,
  };

  await writeFile(resolve(root, "data/presentation-snapshot.json"), `${JSON.stringify(snapshot)}\n`);
  console.log(`Presentation snapshot written: ${records.length} rows, count integrity ${snapshot.validation.countIntegrity}, ${geolocated} geolocated, created ${snapshot.createdAt}.`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
