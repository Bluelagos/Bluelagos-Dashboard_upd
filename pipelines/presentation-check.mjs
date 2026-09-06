/**
 * Pre-presentation readiness check.
 *
 *   npm run presentation:check
 *
 * A fast, read-only status board to run before leaving for the meeting. It does
 * NOT start the app. Exit code is non-zero if any P0 item is missing.
 */
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = "\x1b[0m";
const G = "\x1b[32m";
const Y = "\x1b[33m";
const RED = "\x1b[31m";

let hardFailures = 0;
const line = (label, state, detail) => {
  const colour = state === "OK" ? G : state === "WARN" ? Y : RED;
  if (state === "FAIL") hardFailures += 1;
  console.log(`  ${colour}${state.padEnd(4)}${R}  ${label}${detail ? ` — ${detail}` : ""}`);
};
const exists = async (p) => {
  try {
    await access(resolve(root, p), constants.R_OK);
    return true;
  } catch {
    return false;
  }
};
const readJson = async (p) => JSON.parse(await readFile(resolve(root, p), "utf8"));

async function loadEnv() {
  try {
    const text = await readFile(resolve(root, ".env.local"), "utf8");
    for (const l of text.split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* shell env */
  }
}

async function run() {
  await loadEnv();
  const pkg = await readJson("package.json");
  console.log(`\nBlue Lagos presentation check — ${pkg.name} v${pkg.version} — ${new Date().toISOString()}\n`);

  // --- Live data ---
  console.log("Data");
  let liveOk = false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { count, error } = await client.from("blue_lagos_dashboard_kpis").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      liveOk = true;
      line("Live Supabase register", "OK", `${count} rows reachable`);
    } catch (e) {
      line("Live Supabase register", "WARN", `unreachable now (${e.message}); snapshot fallback required`);
    }
  } else {
    line("Live Supabase register", "WARN", "no public config in .env.local");
  }

  if (await exists("data/presentation-snapshot.json")) {
    const snap = await readJson("data/presentation-snapshot.json");
    const ageH = (Date.now() - new Date(snap.createdAt).getTime()) / 3.6e6;
    line(
      "Verified presentation snapshot",
      ageH > 48 ? "WARN" : "OK",
      `${snap.validation.rowCount} rows, count integrity ${snap.validation.countIntegrity}, created ${snap.createdAt} (${ageH.toFixed(1)}h ago)`,
    );
  } else {
    line("Verified presentation snapshot", liveOk ? "WARN" : "FAIL", "run: npm run snapshot:presentation");
  }
  line(
    "Snapshot fallback wiring",
    process.env.NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK === "1" ? "OK" : "WARN",
    process.env.NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK === "1"
      ? "app will fall back to snapshot and badge it"
      : "set NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK=1 to enable offline fallback",
  );

  // --- Spatial assets ---
  console.log("\nSpatial layers");
  if (await exists("data/spatial/lagos-administrative.json")) {
    const fc = await readJson("data/spatial/lagos-administrative.json");
    const adm1 = fc.features.filter((f) => f.properties.admin_level === "ADM1").length;
    const adm2 = fc.features.filter((f) => f.properties.admin_level === "ADM2").length;
    line("Administrative boundaries", adm1 === 1 && adm2 === 20 ? "OK" : "FAIL", `${adm1} state + ${adm2} LGA polygons`);
  } else {
    line("Administrative boundaries", "FAIL", "run: npm run pipeline:administrative");
  }
  if (await exists("data/spatial/processed/osm-processed.metadata.json")) {
    const meta = await readJson("data/spatial/processed/osm-processed.metadata.json");
    for (const [id, l] of Object.entries(meta.layers)) {
      line(`OSM layer ${id}`, l.featureCount > 0 ? "OK" : "WARN", `${l.featureCount} features, retrieved ${meta.retrievedAt.slice(0, 10)}`);
    }
  } else {
    line("Processed OSM layers", "FAIL", "run: npm run pipeline:osm && npm run pipeline:osm:process");
  }
  if (await exists("data/spatial/derived/community-spatial-context.json")) {
    const derived = await readJson("data/spatial/derived/community-spatial-context.json");
    line("Derived community spatial context", derived.communities?.length === 93 ? "OK" : "FAIL", `${derived.communities?.length ?? 0} geolocated community rows; health, marine, waterway and H3 metrics`);
  } else {
    line("Derived community spatial context", "FAIL", "run: npm run spatial:derive");
  }

  // --- Known unavailable ---
  console.log("\nKnown unavailable (documented, not blocking)");
  line("Earth observation products", "WARN", "Earth Engine not authenticated — field flood evidence only");
  line("Modelled gridded population (WorldPop)", "WARN", "not integrated — survey-known population only");
  line("Validated navigable water network / routing", "WARN", "straight-line catchments only");
  line("Mapped open-water polygons", "WARN", "not integrated — candidate screen uses state land geometry plus a 50 m OSM-waterway margin");

  // --- Routes ---
  console.log("\nKey routes present");
  for (const [label, file] of [
    ["Overview", "app/page.tsx"],
    ["Explorer", "app/explorer/page.tsx"],
    ["Community dossier", "app/communities/[slug]/page.tsx"],
    ["Priorities", "app/priorities/page.tsx"],
    ["Accessibility", "app/accessibility/page.tsx"],
    ["Scenario lab", "app/scenarios/page.tsx"],
    ["Briefing", "app/briefing/page.tsx"],
    ["Data quality", "app/data-quality/page.tsx"],
    ["Data catalogue", "app/data/page.tsx"],
  ]) {
    line(label, (await exists(file)) ? "OK" : "FAIL", file);
  }

  console.log(`\n${hardFailures === 0 ? `${G}Presentation check passed${R}` : `${RED}${hardFailures} P0 item(s) need attention${R}`}\n`);
  if (hardFailures > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
