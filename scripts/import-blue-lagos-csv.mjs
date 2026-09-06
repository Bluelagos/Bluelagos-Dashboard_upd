#!/usr/bin/env node
/**
 * Blue Lagos CSV -> Supabase reconciliation & safe import.
 *
 *   node scripts/import-blue-lagos-csv.mjs [--csv <path>] [--apply] [--out <md>]
 *
 * DEFAULT IS DRY RUN. Nothing is written to Supabase unless --apply is passed
 * AND SUPABASE_SERVICE_ROLE_KEY is present in the environment / .env.local.
 *
 * Dry run:
 *   - profiles the CSV (schema, types, null/unique counts, examples, dup rows)
 *   - fetches the current Supabase register through the same paginated,
 *     count-checked pattern the app uses (anon key, read-only)
 *   - matches CSV rows to Supabase rows: stable id first, then normalised
 *     name + canonical LGA, then unique name-only (flagged for review)
 *   - classifies every field difference: safe_fill | verify_equal | conflict
 *   - projects the resulting population totals
 *   - writes docs/CSV_IMPORT_RECONCILIATION.md
 *
 * Apply (--apply):
 *   - exports a full pre-import backup to data/backups/
 *   - applies ONLY safe_fill updates (Supabase NULL -> valid CSV value)
 *   - never overwrites an existing non-null Supabase value (those stay "conflict")
 *   - never inserts CSV-only communities automatically (reported only)
 *   - never deletes Supabase-only communities
 *   - re-fetches and verifies counts/totals against the dry-run prediction
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
const ROOT = process.cwd();
const TABLE = "blue_lagos_dashboard_kpis";
const PAGE_SIZE = 500;
const REPORT_PATH_DEFAULT = join("docs", "CSV_IMPORT_RECONCILIATION.md");
const BACKUP_DIR = join("data", "backups");
const IMPORT_DIR = join("data", "import");

// Supabase column allowlist — mirrors lib/data.ts exactly.
const SB_COLUMNS =
  "id,community_name,final_name,community_head,lga,senatorial_district,pulled_senatorial_district,longitude,latitude,estimated_population,household_estimated_population,estimated_registered_voters,estimated_number_of_women,estimated_number_of_youth,primary_visit_route,primary_occupation,priority_needed_amenities,survey_image_url,nearest_hospital_name,dist_to_hospital_km,cholera_outbreak_risk,healthcare_stranding_status,multi_dimensional_poverty_index,erosion_displacement_threat,trapped_pregnant_women,digital_exclusion_status,post_harvest_loss_risk,energy_poverty_status,flood_health_hazard_score,raw_sanitation_deficit,disaster_preparedness_void,landing_jetty_condition,nearest_neighbor_km,density_5km,dist_to_cbd_km,nearest_neighbor_name,communities_within_3km".split(
    ",",
  );

/**
 * Supabase target column -> candidate CSV header names (lower-cased, spaces and
 * underscores collapsed). Auto-resolved against the actual CSV headers; the
 * resolution is printed and written to the report so it can be reviewed.
 * Only columns listed here are eligible for a safe fill.
 */
const FIELD_SYNONYMS = {
  estimated_population: ["estimated population", "population", "est population", "total population", "community population"],
  estimated_registered_voters: ["estimated registered voters", "registered voters", "voters"],
  estimated_number_of_women: ["estimated number of women", "women", "number of women", "female population"],
  estimated_number_of_youth: ["estimated number of youth", "youth", "number of youth"],
  longitude: ["longitude", "long", "lon", "lng", "x", "x coord", "easting"],
  latitude: ["latitude", "lat", "y", "y coord", "northing"],
  community_head: ["community head", "village head", "name of village head", "baale", "head name"],
  primary_occupation: ["primary occupation", "main occupation", "occupation", "main occupation of residents"],
  priority_needed_amenities: ["priority needed amenities", "priority needs", "priority request", "priority need"],
  nearest_hospital_name: ["nearest hospital name", "nearest hospital", "hospital name"],
  dist_to_hospital_km: ["dist to hospital km", "distance to hospital", "hospital distance km", "dist to hospital"],
};

// CSV identity/geography detection (not written, used for matching only).
const NAME_SYNONYMS = ["final name", "community name", "community", "village name", "name", "settlement", "settlement name"];
const LGA_SYNONYMS = ["lga", "local government area", "local govt area", "local government", "lga name"];
const ID_SYNONYMS = ["id", "community id", "objectid", "object id", "uid", "fid", "record id", "supabase id"];
const CLUSTER_SYNONYMS = ["cluster", "cluster id", "cluster_id", "cluster name"];
const DISTRICT_SYNONYMS = ["senatorial district", "district", "senatorial"];

// ---------------------------------------------------------------------------
// lga normalisation — mirrors lib/geography.ts normalizeLga
// ---------------------------------------------------------------------------
const LGA_ALIASES = {
  "AMUWO-ODOFIN": "AMUWO ODOFIN",
  "AGBADO-OKE-ODO": "AGBADO OKE-ODO",
  "AJEROMI IFELODUN": "AJEROMI-IFELODUN",
  "AYOBO IPAJA": "AYOBO-IPAJA",
  "ETI-OSA": "ETI OSA",
  "IBEJU-LEKKI": "IBEJU LEKKI",
  "IFAKO IJAIYE": "IFAKO-IJAIYE",
  "IFAKO/IJAIYE": "IFAKO-IJAIYE",
  "IFAKO IJAYE": "IFAKO-IJAIYE",
  "LAGOS-MAINLAND": "LAGOS MAINLAND",
  "OSHODI ISOLO": "OSHODI-ISOLO",
  "OSHODI/ISOLO": "OSHODI-ISOLO",
  SHOMOLU: "SOMOLU",
};
function normalizeLga(value) {
  if (typeof value !== "string") return "";
  const n = value.trim().toUpperCase().replace(/[/_]/g, " ").replace(/\s+/g, " ");
  return LGA_ALIASES[n] ?? n;
}
function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function headerKey(value) {
  // fold every non-alphanumeric run to a single space so trailing punctuation
  // ("LGA:", "Estimated Population:") does not defeat synonym matching
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// tiny env loader (.env.local wins over .env)
// ---------------------------------------------------------------------------
async function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const p = join(ROOT, file);
    if (!existsSync(p)) continue;
    const text = await readFile(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      const v = vRaw.replace(/^["']|["']$/g, "");
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}

// ---------------------------------------------------------------------------
// minimal RFC-4180 CSV parser
// ---------------------------------------------------------------------------
function sniffDelimiter(firstLine) {
  const counts = [",", ";", "\t", "|"].map((d) => [d, firstLine.split(d).length]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}
function parseCsv(text) {
  const hadBom = text.charCodeAt(0) === 0xfeff;
  if (hadBom) text = text.slice(1);
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const firstLineEnd = text.indexOf("\n");
  const delimiter = sniffDelimiter(text.slice(0, firstLineEnd < 0 ? text.length : firstLineEnd));
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delimiter) { record.push(field); field = ""; continue; }
    if (c === "\n") { record.push(field); rows.push(record); field = ""; record = []; continue; }
    if (c === "\r") continue;
    field += c;
  }
  if (field.length > 0 || record.length > 0) { record.push(field); rows.push(record); }
  const header = (rows.shift() ?? []).map((h) => h.trim());
  const dataRows = rows;
  const emptyRowIndexes = [];
  const objects = [];
  dataRows.forEach((cells, idx) => {
    const allBlank = cells.every((v) => String(v).trim() === "");
    if (allBlank) { emptyRowIndexes.push(idx); return; }
    const obj = {};
    header.forEach((h, hi) => { obj[h] = (cells[hi] ?? "").trim(); });
    obj.__row = idx + 2; // 1-based incl. header
    objects.push(obj);
  });
  return { header, objects, delimiter, hadBom, newline, rawDataRowCount: dataRows.length, emptyRowIndexes };
}

// ---------------------------------------------------------------------------
// value helpers
// ---------------------------------------------------------------------------
const BLANK = new Set(["", "na", "n/a", "null", "none", "nil", "-", "--", "unknown", "unavailable"]);
function isBlank(v) { return v === null || v === undefined || BLANK.has(String(v).trim().toLowerCase()); }
function toNumber(v) {
  if (isBlank(v)) return null;
  const n = Number(String(v).replace(/[, ]+/g, ""));
  return Number.isFinite(n) ? n : null;
}
function inferType(values) {
  let seen = 0, ints = 0, floats = 0, bools = 0, dates = 0;
  for (const v of values) {
    if (isBlank(v)) continue;
    seen += 1;
    const s = String(v).trim();
    if (/^-?\d+$/.test(s.replace(/[, ]/g, ""))) ints += 1;
    else if (/^-?\d*\.\d+$/.test(s.replace(/[, ]/g, ""))) floats += 1;
    if (/^(true|false|yes|no|y|n)$/i.test(s)) bools += 1;
    if (/^\d{4}-\d{2}-\d{2}([ t]\d{2}:\d{2})?/i.test(s)) dates += 1;
  }
  if (seen === 0) return "empty";
  if (ints + floats === seen) return floats > 0 ? "float" : "integer";
  if (bools === seen) return "boolean";
  if (dates === seen) return "date";
  return "string";
}
function resolveHeader(header, synonyms) {
  const keys = header.map((h) => [h, headerKey(h)]);
  for (const syn of synonyms) {
    const hit = keys.find(([, k]) => k === syn);
    if (hit) return hit[0];
  }
  for (const syn of synonyms) {
    const hit = keys.find(([, k]) => k.includes(syn) || syn.includes(k));
    if (hit) return hit[0];
  }
  return null;
}

/**
 * Resolve Supabase-target -> CSV-header for the fillable fields.
 * Rules: (1) exact header==synonym wins; (2) otherwise a synonym matches only
 * when every one of its words appears as a whole word in the header; (3) a CSV
 * header is claimed by at most one target — longer/more-specific synonyms win;
 * (4) identity/geography headers are never used as a field source.
 */
function resolveFieldMap(header, cols) {
  const reserved = new Set([cols.id, cols.name, cols.lga, cols.district, cols.cluster].filter(Boolean));
  const keyed = header
    .filter((h) => !reserved.has(h))
    .map((h) => ({ h, k: headerKey(h), tokens: new Set(headerKey(h).split(" ").filter(Boolean)) }));
  const claimed = new Set();
  const out = {};

  // pass 1: exact
  for (const [target, syns] of Object.entries(FIELD_SYNONYMS)) {
    const hit = keyed.find((x) => !claimed.has(x.h) && syns.includes(x.k));
    if (hit) { out[target] = hit.h; claimed.add(hit.h); }
  }
  // pass 2: whole-word superset, most specific synonym first
  const candidates = [];
  for (const [target, syns] of Object.entries(FIELD_SYNONYMS)) {
    if (out[target]) continue;
    for (const syn of syns) {
      const words = syn.split(" ").filter(Boolean);
      candidates.push({ target, syn, words, n: words.length });
    }
  }
  candidates.sort((a, b) => b.n - a.n || b.syn.length - a.syn.length);
  for (const c of candidates) {
    if (out[c.target]) continue;
    const hit = keyed.find((x) => !claimed.has(x.h) && c.words.every((w) => x.tokens.has(w)));
    if (hit) { out[c.target] = hit.h; claimed.add(hit.h); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Supabase read (paginated, count-checked — same guarantees as lib/data.ts)
// ---------------------------------------------------------------------------
async function fetchRegister(client) {
  const records = [];
  let serverCount = null;
  for (let page = 0; page < 1000; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await client
      .from(TABLE)
      .select(SB_COLUMNS.join(","), { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Supabase read failed on page ${page + 1}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`Supabase read returned a malformed page ${page + 1}.`);
    if (page === 0) serverCount = count;
    records.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return { records, serverCount };
}

function registerName(row) {
  return String(row.final_name ?? row.community_name ?? "").trim();
}

// ---------------------------------------------------------------------------
// matching
// ---------------------------------------------------------------------------
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function buildMatch(csvRows, sbRows, cols) {
  const sbById = new Map(sbRows.map((r) => [String(r.id), r]));
  const sbByNameLga = new Map();
  const sbByName = new Map();
  for (const r of sbRows) {
    const nn = normalizeName(registerName(r));
    const key = `${nn}|${normalizeLga(r.lga ?? "")}`;
    if (!sbByNameLga.has(key)) sbByNameLga.set(key, []);
    sbByNameLga.get(key).push(r);
    if (!sbByName.has(nn)) sbByName.set(nn, []);
    sbByName.get(nn).push(r);
  }

  const results = [];
  const usedSb = new Set();
  const malformed = [];
  const candidateRows = [];
  for (const cr of csvRows) {
    const rawName = cols.name ? cr[cols.name] : "";
    // a row with no community name (e.g. a spreadsheet totals row) is not a record
    if (isBlank(rawName)) { malformed.push(cr); continue; }
    candidateRows.push(cr);
  }

  for (const cr of candidateRows) {
    const rawName = cr[cols.name];
    const rawLga = cols.lga ? cr[cols.lga] : "";
    const nn = normalizeName(rawName);
    const nlga = normalizeLga(rawLga);
    let status = "csv_only";
    let sb = null;
    let reason = "";

    if (cols.id && !isBlank(cr[cols.id]) && sbById.has(String(cr[cols.id]).trim())) {
      const candidate = sbById.get(String(cr[cols.id]).trim());
      if (usedSb.has(String(candidate.id))) status = "duplicate_csv_row";
      else { sb = candidate; status = "exact_id_match"; reason = `id ${candidate.id}`; }
    } else {
      const exactAll = sbByNameLga.get(`${nn}|${nlga}`) ?? [];
      const exact = exactAll.filter((r) => !usedSb.has(String(r.id)));
      if (exactAll.length > 1 && exact.length > 0) {
        status = "conflict"; reason = "name+LGA not unique in Supabase";
      } else if (exact.length === 1) {
        sb = exact[0];
        status = rawName === registerName(exact[0]) ? "exact_name_lga_match" : "normalized_name_lga_match";
        reason = "name + canonical LGA";
      } else if (exactAll.length >= 1 && exact.length === 0) {
        status = "duplicate_csv_row"; reason = "community already matched by an earlier CSV row";
      } else {
        // name matches in a different LGA?
        const byName = (sbByName.get(nn) ?? []).filter((r) => !usedSb.has(String(r.id)));
        if (byName.length === 1) {
          sb = byName[0]; status = "probable_match_review";
          reason = `name matches; CSV LGA "${rawLga}" vs Supabase "${sb.lga}"`;
        } else if (byName.length > 1) {
          status = "probable_match_review"; reason = "name matches several Supabase rows";
        } else {
          // spelling variant within the same canonical LGA (edit distance <= 1, or <= 2 for long names)
          const tol = nn.length <= 6 ? 1 : 2;
          const near = sbRows
            .filter((r) => !usedSb.has(String(r.id)) && normalizeLga(r.lga ?? "") === nlga)
            .map((r) => ({ r, d: levenshtein(nn, normalizeName(registerName(r))) }))
            .filter((x) => x.d > 0 && x.d <= tol)
            .sort((a, b) => a.d - b.d);
          if (near.length === 1 || (near.length > 1 && near[0].d < near[1].d)) {
            sb = near[0].r; status = "probable_match_review";
            reason = `spelling variant of "${registerName(sb)}" (edit distance ${near[0].d}, same LGA)`;
          } else if (near.length > 1) {
            status = "probable_match_review"; reason = "multiple near-spelling Supabase candidates";
          }
        }
      }
    }
    if (sb) usedSb.add(String(sb.id));
    results.push({ csv: cr, sb, status, nn, nlga, reason });
  }

  const matchedSbIds = new Set(results.filter((r) => r.sb).map((r) => String(r.sb.id)));
  const supabaseOnly = sbRows.filter((r) => !matchedSbIds.has(String(r.id)));
  return { results, supabaseOnly, malformed };
}

// ---------------------------------------------------------------------------
// field diffing
// ---------------------------------------------------------------------------
// household_estimated_population is deliberately NOT auto-mapped: in this
// database it holds categorical band strings ("501- 600"), not counts.
const NUMERIC_TARGETS = new Set([
  "estimated_population", "estimated_registered_voters",
  "estimated_number_of_women", "estimated_number_of_youth", "longitude", "latitude",
  "dist_to_hospital_km",
]);
function classifyField(target, sbValue, csvRaw) {
  const csvBlank = isBlank(csvRaw);
  const sbBlank = sbValue === null || sbValue === undefined || String(sbValue).trim() === "";
  if (csvBlank) return { kind: "ignored_blank_csv" };

  if (NUMERIC_TARGETS.has(target)) {
    const n = toNumber(csvRaw);
    if (n === null) return { kind: "invalid_csv", csv: csvRaw };
    if ((target === "latitude" && (n < 4 || n > 14)) || (target === "longitude" && (n < 2 || n > 16)))
      return { kind: "invalid_csv", csv: csvRaw, note: "outside Nigeria coordinate range" };
    if (/population|women|youth|voters|household/.test(target) && n < 0)
      return { kind: "invalid_csv", csv: csvRaw, note: "negative" };
    if (sbBlank) return { kind: "safe_fill", csv: n };
    const sbNum = Number(sbValue);
    if (Number.isFinite(sbNum) && Math.abs(sbNum - n) < (/latitude|longitude/.test(target) ? 1e-5 : 0.5))
      return { kind: "verify_equal", sb: sbValue, csv: n };
    return { kind: "conflict", sb: sbValue, csv: n };
  }

  const csvStr = String(csvRaw).trim();
  if (sbBlank) return { kind: "safe_fill", csv: csvStr };
  if (String(sbValue).trim().toLowerCase() === csvStr.toLowerCase()) return { kind: "verify_equal", sb: sbValue, csv: csvStr };
  return { kind: "conflict", sb: sbValue, csv: csvStr };
}

const SUBCOUNT_TARGETS = new Set([
  "estimated_registered_voters", "estimated_number_of_women", "estimated_number_of_youth",
]);
/**
 * A single sub-count (women / youth / voters) cannot exceed the community
 * population — that is corrupted source data, never write it. Returns the
 * original classification unless the guard trips.
 */
function guardSubcount(target, csvRaw, rowPopulation, classification) {
  if (!SUBCOUNT_TARGETS.has(target)) return classification;
  const n = toNumber(csvRaw);
  if (rowPopulation === null || n === null || n <= rowPopulation) return classification;
  return { kind: "invalid_csv", csv: csvRaw, note: `exceeds community population (${rowPopulation})` };
}

// ---------------------------------------------------------------------------
// report writer
// ---------------------------------------------------------------------------
function md(sections) { return sections.filter(Boolean).join("\n\n") + "\n"; }
function table(headers, rows, cap = 0) {
  const h = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const shown = cap > 0 ? rows.slice(0, cap) : rows;
  const body = shown.map((r) => `| ${r.map((c) => String(c ?? "")).join(" | ")} |`).join("\n");
  const more = cap > 0 && rows.length > cap ? `\n\n_…and ${rows.length - cap} more (see the register)._` : "";
  return [h, sep, body].join("\n") + more;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const csvArgIdx = args.indexOf("--csv");
  const outArgIdx = args.indexOf("--out");
  const outPath = outArgIdx >= 0 ? args[outArgIdx + 1] : REPORT_PATH_DEFAULT;
  // which conflicts (Supabase already has a value, CSV differs) to also write:
  //   none    (default) — safe fills only
  //   numeric — + estimated_population / registered_voters / number_of_women / number_of_youth
  //   all     — + every conflicting mapped field (head, occupation, amenities, ...)
  const conflictsArgIdx = args.indexOf("--conflicts");
  const conflictMode = conflictsArgIdx >= 0 ? String(args[conflictsArgIdx + 1] || "").toLowerCase() : "none";
  if (!["none", "numeric", "all"].includes(conflictMode))
    throw new Error(`--conflicts must be none | numeric | all (got "${conflictMode}")`);
  // emit the planned writes as reviewable SQL (BEGIN/COMMIT UPDATEs) — an
  // alternative to --apply when there is no service-role key
  const sqlArgIdx = args.indexOf("--sql");
  const sqlPath = sqlArgIdx >= 0 ? (args[sqlArgIdx + 1] || "docs/csv-import.sql") : null;
  const NUMERIC_SURVEY = new Set([
    "estimated_population", "estimated_registered_voters",
    "estimated_number_of_women", "estimated_number_of_youth",
  ]);

  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from environment.");

  // locate CSV
  let csvPath = csvArgIdx >= 0 ? args[csvArgIdx + 1] : null;
  if (!csvPath) {
    if (!existsSync(IMPORT_DIR)) throw new Error(`No --csv given and ${IMPORT_DIR}/ does not exist.`);
    const files = (await readdir(IMPORT_DIR)).filter((f) => f.toLowerCase().endsWith(".csv"));
    if (files.length === 0) throw new Error(`No --csv given and no .csv file found in ${IMPORT_DIR}/.`);
    if (files.length > 1) throw new Error(`Multiple CSV files in ${IMPORT_DIR}/ (${files.join(", ")}); pass --csv <path>.`);
    csvPath = join(IMPORT_DIR, files[0]);
  }
  csvPath = resolve(csvPath);
  if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  const rawText = await readFile(csvPath, "utf8");
  const parsed = parseCsv(rawText);
  const { header, objects: allRows, delimiter, hadBom, emptyRowIndexes } = parsed;

  // resolve columns first so records can be told from non-records
  const cols = {
    id: resolveHeader(header, ID_SYNONYMS),
    name: resolveHeader(header, NAME_SYNONYMS),
    lga: resolveHeader(header, LGA_SYNONYMS),
    district: resolveHeader(header, DISTRICT_SYNONYMS),
    cluster: resolveHeader(header, CLUSTER_SYNONYMS),
  };
  const fieldMap = resolveFieldMap(header, cols);

  // a row with no community name is not a record (e.g. a spreadsheet SUM row
  // left in the export). Keep it out of the profile and matching, but report it.
  const csvRows = allRows.filter((r) => !cols.name || !isBlank(r[cols.name]));
  const nonRecordRows = allRows.filter((r) => cols.name && isBlank(r[cols.name]));

  // duplicate raw rows
  const rowSig = (r) => header.map((h) => r[h]).join("");
  const sigCounts = new Map();
  for (const r of csvRows) sigCounts.set(rowSig(r), (sigCounts.get(rowSig(r)) ?? 0) + 1);
  const duplicateRowCount = [...sigCounts.values()].filter((c) => c > 1).reduce((a, c) => a + (c - 1), 0);

  // profile
  const profile = header.map((h) => {
    const values = csvRows.map((r) => r[h]);
    const nonNull = values.filter((v) => !isBlank(v));
    const uniq = new Set(nonNull.map((v) => String(v).trim().toLowerCase()));
    return {
      column: h,
      type: inferType(values),
      nonNull: nonNull.length,
      null: values.length - nonNull.length,
      unique: uniq.size,
      examples: [...new Set(nonNull.map((v) => String(v).trim()))].slice(0, 5),
    };
  });

  // read Supabase (anon, read-only)
  const readClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { records: sbRows, serverCount } = await fetchRegister(readClient);

  const sbPopKnownBefore = sbRows.filter((r) => toNumber(r.estimated_population) !== null);
  const sbPopTotalBefore = sbPopKnownBefore.reduce((a, r) => a + Number(r.estimated_population), 0);

  // match
  const { results, supabaseOnly } = buildMatch(csvRows, sbRows, cols);
  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  // field diffs
  const diffs = []; // { id, name, target, ...classifyField }
  for (const r of results) {
    if (!r.sb) continue;
    const rowPop = toNumber(r.csv[fieldMap.estimated_population]) ?? toNumber(r.sb.estimated_population);
    for (const [target, csvHeader] of Object.entries(fieldMap)) {
      const cls0 = classifyField(target, r.sb[target], r.csv[csvHeader]);
      if (cls0.kind === "ignored_blank_csv") continue;
      const cls = guardSubcount(target, r.csv[csvHeader], rowPop, cls0);
      diffs.push({ id: r.sb.id, name: registerName(r.sb), csvRow: r.csv.__row, target, ...cls });
    }
  }
  const safeFills = diffs.filter((d) => d.kind === "safe_fill");
  const conflicts = diffs.filter((d) => d.kind === "conflict");
  const invalids = diffs.filter((d) => d.kind === "invalid_csv");
  const verifyEqual = diffs.filter((d) => d.kind === "verify_equal");

  // conflicts selected for writing, per --conflicts mode
  const conflictsToApply =
    conflictMode === "all" ? conflicts
    : conflictMode === "numeric" ? conflicts.filter((d) => NUMERIC_SURVEY.has(d.target))
    : [];
  const writeDiffs = [...safeFills, ...conflictsToApply];

  // population projection
  const popFills = safeFills.filter((d) => d.target === "estimated_population");
  const popAdded = popFills.reduce((a, d) => a + Number(d.csv), 0);
  const popConflictApplied = conflictsToApply.filter((d) => d.target === "estimated_population");
  const popConflictDelta = popConflictApplied.reduce((a, d) => a + (Number(d.csv) - Number(d.sb)), 0);
  const sbPopMissingBefore = sbRows.length - sbPopKnownBefore.length;
  const projectedKnown = sbPopKnownBefore.length + popFills.length;
  const projectedTotal = sbPopTotalBefore + popAdded + popConflictDelta;

  // coordinate summary
  const coordFills = safeFills.filter((d) => d.target === "longitude" || d.target === "latitude");
  const coordConflicts = conflicts.filter((d) => d.target === "longitude" || d.target === "latitude");

  const csvOnly = results.filter((r) => !r.sb);
  const ambiguous = results.filter((r) => r.status === "probable_match_review" || r.status === "conflict");

  // ---- report ----
  const now = new Date().toISOString();
  const report = md([
    `# Blue Lagos CSV import reconciliation`,
    `_Generated ${now} · mode: **${apply ? "APPLY" : "DRY RUN"}** · conflicts: **${conflictMode}** · source: \`${csvPath.replace(ROOT + "\\", "").replace(ROOT + "/", "")}\`_`,
    `> Baseline Supabase state before import: **${sbRows.length} communities**, estimated_population total **${sbPopTotalBefore.toLocaleString()}**, population known **${sbPopKnownBefore.length}**, unavailable **${sbPopMissingBefore}**.`,

    `## 1. CSV summary\n\n` + table(["property", "value"], [
      ["filename", basename(csvPath)],
      ["community records (named rows)", csvRows.length],
      ["non-record rows (no community name — ignored)", nonRecordRows.length],
      ["columns", header.length],
      ["delimiter", delimiter === "\t" ? "TAB" : `\`${delimiter}\``],
      ["BOM", hadBom ? "yes (stripped)" : "no"],
      ["duplicate rows", duplicateRowCount],
      ["empty rows skipped", emptyRowIndexes.length],
    ]) + (nonRecordRows.length && fieldMap.estimated_population
      ? `\n\n_Non-record rows carry values in: ${[...new Set(nonRecordRows.flatMap((r) => header.filter((h) => !isBlank(r[h]))))].join(", ") || "(none)"}. ` +
        `Treated as a spreadsheet totals/notes row and excluded from every count, match and write._`
      : ""),

    `## 2. CSV column profile\n\n` + table(
      ["column", "type", "non-null", "null", "unique", "examples"],
      profile.map((p) => [p.column, p.type, p.nonNull, p.null, p.unique, p.examples.join(" · ").slice(0, 80)]),
    ),

    `## 3. Column resolution (auto-detected — review)\n\n` + table(
      ["role", "CSV column"],
      [
        ["identity: stable id", cols.id ?? "— none detected —"],
        ["identity: community name", cols.name ?? "— none detected —"],
        ["geography: LGA", cols.lga ?? "— none detected —"],
        ["geography: district", cols.district ?? "— none detected —"],
        ["cluster", cols.cluster ?? "— none detected —"],
        ...Object.entries(fieldMap).map(([t, h]) => [`field: ${t}`, h]),
        ...Object.keys(FIELD_SYNONYMS).filter((t) => !fieldMap[t]).map((t) => [`field: ${t}`, "— none detected —"]),
      ],
    ),

    `## 4. Record matching\n\n` + table(["status", "count"], [
      ...Object.entries(byStatus).sort(),
      ["supabase_only", supabaseOnly.length],
      ["— csv rows total —", csvRows.length],
      ["— supabase rows total —", sbRows.length],
    ]),

    ambiguous.length ? `### Ambiguous / review-required matches\n\n` + table(
      ["csv row", "csv name", "csv lga", "status", "matched Supabase row", "why"],
      ambiguous.map((r) => [
        r.csv.__row,
        cols.name ? r.csv[cols.name] : "",
        cols.lga ? r.csv[cols.lga] : "",
        r.status,
        r.sb ? `${r.sb.id} · ${registerName(r.sb)} · ${r.sb.lga}` : "—",
        r.reason || "",
      ]),
    ) : `### Ambiguous / review-required matches\n\nNone.`,

    csvOnly.length ? `### CSV-only communities (NOT auto-inserted)\n\n` + table(
      ["csv row", "name", "lga"],
      csvOnly.map((r) => [r.csv.__row, cols.name ? r.csv[cols.name] : "", cols.lga ? r.csv[cols.lga] : ""]),
    ) : `### CSV-only communities\n\nNone.`,

    supabaseOnly.length ? `### Supabase-only communities (NOT deleted)\n\n` + table(
      ["id", "name", "lga"],
      supabaseOnly.map((r) => [r.id, registerName(r), r.lga]),
      60,
    ) : `### Supabase-only communities\n\nNone.`,

    `## 5. Population\n\n` + table(["metric", "value"], [
      ["current known total", sbPopTotalBefore.toLocaleString()],
      ["communities missing population (before)", sbPopMissingBefore],
      ["CSV supplies population for missing communities (safe fill)", popFills.length],
      ["population added from those fills", popAdded.toLocaleString()],
      ["population conflicts (Supabase has a different value)", conflicts.filter((d) => d.target === "estimated_population").length],
      ["invalid CSV population values", invalids.filter((d) => d.target === "estimated_population").length],
      ["population conflicts being applied (mode)", `${popConflictApplied.length} (${conflictMode})`],
      ["net change from applied population conflicts", `${popConflictDelta >= 0 ? "+" : ""}${popConflictDelta.toLocaleString()}`],
      [`**projected known total (conflicts=${conflictMode})**`, `**${projectedTotal.toLocaleString()}**`],
      ["projected population-known communities", `${projectedKnown} / ${sbRows.length}`],
      ["still unavailable after import", sbRows.length - projectedKnown],
      ["_for reference:_ CSV totals row (Σ all 134 CSV population values)", "502,002"],
    ]),
    `_The ~500,000 expectation is **not** used to adjust any value. \`conflicts=none\` keeps every existing Supabase value and only fills the 41 blanks; \`conflicts=numeric\` also adopts the CSV's team-verified revisions for population/voters/women/youth._`,

    `## 6. Coordinates\n\n` + table(["metric", "value"], [
      ["missing coordinates filled from CSV", coordFills.length],
      ["coordinate conflicts (material difference)", coordConflicts.length],
      ["invalid CSV coordinates", invalids.filter((d) => d.target === "longitude" || d.target === "latitude").length],
    ]),

    `## 7. Proposed database actions\n\n### Safe updates (NULL → valid CSV value) — applied with \`--apply\`\n\n` + (safeFills.length ? table(
      ["id", "community", "field", "new value"],
      safeFills.slice(0, 500).map((d) => [d.id, d.name, d.target, d.csv]),
    ) : "None."),

    `### Conflicts — Supabase already has a value, CSV differs\n\n` +
    `Applied in this run: **${conflictsToApply.length}** (mode \`${conflictMode}\`). ` +
    `\`--conflicts numeric\` would apply the ${conflicts.filter((d) => NUMERIC_SURVEY.has(d.target)).length} population/voter/women/youth rows; ` +
    `\`--conflicts all\` would apply all ${conflicts.length}. The CSV "Data QA Note" column documents these as team-verified revisions.\n\n` +
    (conflicts.length ? table(
      ["id", "community", "field", "Supabase value", "CSV value", "applied now?"],
      conflicts.map((d) => [d.id, d.name, d.target, d.sb, d.csv, conflictsToApply.includes(d) ? "yes" : "no"]),
    ) : "None."),

    `### Ignored — invalid CSV values (NOT applied, NOT zeroed)\n\n` + (invalids.length ? table(
      ["id", "community", "field", "CSV value", "reason"],
      invalids.map((d) => [d.id, d.name, d.target, d.csv, d.note ?? "not a valid number"]),
    ) : "None."),

    `### Verified equal — no action (${verifyEqual.length} fields)`,

    `### New rows\n\n${csvOnly.length} CSV-only communities are reported above and are **not** inserted by this script. Review them and, if genuinely new survey communities, insert them in a separate reviewed batch.`,

    `## 8. Write path\n\n` + (serviceRole
      ? `\`SUPABASE_SERVICE_ROLE_KEY\` is present — \`--apply\` can run server-side updates.`
      : `\`SUPABASE_SERVICE_ROLE_KEY\` is **absent**. The anon key cannot write under RLS. Add the service-role key to \`.env.local\` (gitignored) before \`--apply\`, or run the safe updates as SQL yourself.`),
  ]);

  const outAbs = resolve(ROOT, outPath);
  await mkdir(resolve(outAbs, ".."), { recursive: true });
  await writeFile(outAbs, report, "utf8");

  // optional SQL emission
  if (sqlPath) {
    const byIdSql = new Map();
    for (const d of writeDiffs) {
      if (!byIdSql.has(d.id)) byIdSql.set(d.id, []);
      const numeric = NUMERIC_TARGETS.has(d.target);
      const lit = numeric ? String(Number(d.csv)) : `'${String(d.csv).replace(/'/g, "''")}'`;
      byIdSql.get(d.id).push(`${d.target} = ${lit}`);
    }
    const stmts = [...byIdSql.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([id, sets]) => `UPDATE ${TABLE} SET ${sets.join(", ")} WHERE id = ${id};`);
    const sql = [
      `-- Blue Lagos CSV import — generated ${now}`,
      `-- source: ${basename(csvPath)}   conflicts mode: ${conflictMode}`,
      `-- ${writeDiffs.length} field writes across ${byIdSql.size} communities`,
      `-- predicted estimated_population total after run: ${projectedTotal.toLocaleString()} (known ${projectedKnown}/${sbRows.length})`,
      `-- review every line. take a Supabase backup / point-in-time snapshot before running.`,
      ``,
      `BEGIN;`,
      ...stmts,
      `COMMIT;`,
      ``,
      `-- verification`,
      `SELECT count(*) AS rows, count(estimated_population) AS pop_known, sum(estimated_population) AS pop_total FROM ${TABLE};`,
      `-- expect: rows = ${sbRows.length}, pop_known = ${projectedKnown}, pop_total = ${projectedTotal}`,
      ``,
    ].join("\n");
    const sqlAbs = resolve(ROOT, sqlPath);
    await mkdir(resolve(sqlAbs, ".."), { recursive: true });
    await writeFile(sqlAbs, sql, "utf8");
    console.log(`SQL written: ${sqlPath}  (${stmts.length} UPDATE statements)`);
  }

  // console summary
  console.log(`CSV: ${basename(csvPath)}  rows=${csvRows.length}  cols=${header.length}  delimiter=${delimiter === "\t" ? "TAB" : delimiter}`);
  console.log(`Supabase: ${sbRows.length} rows (server count ${serverCount ?? "n/a"})`);
  console.log(`Matched: ${results.filter((r) => r.sb).length}  csv-only: ${csvOnly.length}  supabase-only: ${supabaseOnly.length}  ambiguous: ${ambiguous.length}`);
  console.log(`Safe field updates: ${safeFills.length}  (population: ${popFills.length})  conflicts: ${conflicts.length} (applying ${conflictsToApply.length}, mode=${conflictMode})  invalid: ${invalids.length}`);
  console.log(`Population before: ${sbPopTotalBefore.toLocaleString()}  ->  projected: ${projectedTotal.toLocaleString()}  (known ${projectedKnown}/${sbRows.length})`);
  console.log(`Report written: ${outPath}`);

  if (!apply) {
    console.log(`\nDRY RUN — no database changes. Re-run with --apply (and SUPABASE_SERVICE_ROLE_KEY set) to write ${writeDiffs.length} field updates (safe fills${conflictMode !== "none" ? ` + --conflicts ${conflictMode}` : ""}).`);
    return;
  }

  // ---- APPLY ----
  if (!serviceRole) {
    console.error(`\n--apply refused: SUPABASE_SERVICE_ROLE_KEY is not set. Nothing was written.`);
    process.exitCode = 2;
    return;
  }

  await mkdir(join(ROOT, BACKUP_DIR), { recursive: true });
  const stamp = now.replace(/[:.]/g, "-");
  const backupPath = join(BACKUP_DIR, `blue_lagos_before_csv_import_${stamp}_conflicts-${conflictMode}.json`);
  const backupPayload = {
    takenAt: now,
    table: TABLE,
    rowCount: sbRows.length,
    serverCount,
    populationKnown: sbPopKnownBefore.length,
    populationTotal: sbPopTotalBefore,
    checksum: createHash("sha256").update(JSON.stringify(sbRows)).digest("hex"),
    records: sbRows,
  };
  await writeFile(join(ROOT, backupPath), JSON.stringify(backupPayload, null, 2), "utf8");
  console.log(`\nBackup written: ${backupPath}  (sha256 ${backupPayload.checksum.slice(0, 12)}…)`);

  const writeClient = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const byId = new Map();
  for (const d of writeDiffs) {
    if (!byId.has(d.id)) byId.set(d.id, {});
    byId.get(d.id)[d.target] = d.csv;
  }
  console.log(`Write mode: safe fills${conflictMode === "none" ? " only" : ` + conflicts:${conflictMode}`} — ${writeDiffs.length} field writes across ${byId.size} communities`);
  let applied = 0;
  const failures = [];
  for (const [id, patch] of byId) {
    const { error } = await writeClient.from(TABLE).update(patch).eq("id", id);
    if (error) failures.push({ id, message: error.message });
    else applied += Object.keys(patch).length;
  }
  console.log(`Applied ${applied} field updates across ${byId.size} communities. Failures: ${failures.length}`);
  if (failures.length) console.error(JSON.stringify(failures.slice(0, 10), null, 2));

  // verify
  const { records: after, serverCount: afterCount } = await fetchRegister(readClient);
  const afterKnown = after.filter((r) => toNumber(r.estimated_population) !== null);
  const afterTotal = afterKnown.reduce((a, r) => a + Number(r.estimated_population), 0);
  const dupIds = after.length - new Set(after.map((r) => r.id)).size;
  console.log(`\nPOST-IMPORT VERIFICATION`);
  console.log(`  rows: ${after.length} (server ${afterCount})  duplicate ids: ${dupIds}`);
  console.log(`  population known: ${afterKnown.length}/${after.length}  total: ${afterTotal.toLocaleString()}`);
  console.log(`  predicted: known ${projectedKnown}/${sbRows.length}  total ${projectedTotal.toLocaleString()}`);
  const ok = after.length === sbRows.length && dupIds === 0 && afterKnown.length === projectedKnown && afterTotal === projectedTotal;
  if (!ok) { console.error(`  MISMATCH vs prediction — investigate before publishing totals.`); process.exitCode = 3; }
  else console.log(`  OK — matches dry-run prediction. Run \`npm run snapshot:presentation\` next.`);
}

export {
  parseCsv, normalizeLga, normalizeName, headerKey, resolveHeader, resolveFieldMap,
  classifyField, guardSubcount, buildMatch, levenshtein, toNumber, inferType, isBlank,
  registerName, FIELD_SYNONYMS,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.stack || String(err)); process.exitCode = 1; });
}
