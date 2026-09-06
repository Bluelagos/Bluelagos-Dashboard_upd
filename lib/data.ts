import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { connection } from "next/server";
import register from "@/data/report-register.json";
import { mapRecord } from "./analytics";
import { normalizeLga } from "./geography";
import { parseSourceRecord } from "./validation";
import type {
  CommunityDataset,
  DataQualityIssue,
  SourceRecord,
} from "./domain";

export const DATASET_UPDATED = "Live query at request time";
export const DATA_PAGE_SIZE = 500;
const MAX_PAGES = 10_000;
const columns =
  "id,community_name,final_name,community_head,lga,senatorial_district,pulled_senatorial_district,longitude,latitude,estimated_population,household_estimated_population,estimated_registered_voters,estimated_number_of_women,estimated_number_of_youth,primary_visit_route,primary_occupation,priority_needed_amenities,survey_image_url,nearest_hospital_name,dist_to_hospital_km,cholera_outbreak_risk,healthcare_stranding_status,multi_dimensional_poverty_index,erosion_displacement_threat,trapped_pregnant_women,digital_exclusion_status,post_harvest_loss_risk,energy_poverty_status,flood_health_hazard_score,raw_sanitation_deficit,disaster_preparedness_void,landing_jetty_condition,nearest_neighbor_km,density_5km,dist_to_cbd_km,nearest_neighbor_name,communities_within_3km";

export interface PageResult<T> {
  data: T[] | null;
  count: number | null;
  error: { message: string } | null;
}
export type PageFetcher<T> = (
  from: number,
  to: number,
) => Promise<PageResult<T>>;

export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  pageSize = DATA_PAGE_SIZE,
): Promise<{ records: T[]; count: number | null }> {
  if (!Number.isInteger(pageSize) || pageSize < 1)
    throw new Error("Page size must be a positive integer.");
  const records: T[] = [];
  let serverCount: number | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * pageSize;
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error)
      throw new Error(
        `Live community data page ${page + 1} could not be loaded: ${result.error.message}`,
      );
    if (!Array.isArray(result.data))
      throw new Error(
        `Live community data page ${page + 1} returned a malformed response.`,
      );
    if (page === 0) serverCount = result.count;
    records.push(...result.data);
    if (result.data.length < pageSize) return { records, count: serverCount };
  }
  throw new Error(
    `Live community data exceeded the safe pagination limit of ${MAX_PAGES * pageSize} records.`,
  );
}

function addDatasetIssues(
  records: ReturnType<typeof mapRecord>[],
  issues: DataQualityIssue[],
) {
  const ids = new Map<number, number>();
  const names = new Map<string, number>();
  const coordinates = new Map<string, number>();
  for (const record of records) {
    ids.set(record.id, (ids.get(record.id) ?? 0) + 1);
    const nameKey = `${record.name.trim().toLowerCase()}|${record.lga}`;
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1);
    if (record.hasLocation) {
      const coordinateKey = `${record.latitude},${record.longitude}`;
      coordinates.set(coordinateKey, (coordinates.get(coordinateKey) ?? 0) + 1);
    }
  }
  for (const record of records) {
    if ((ids.get(record.id) ?? 0) > 1)
      issues.push({
        code: "duplicate_id",
        recordId: record.id,
        message: `Duplicate community identifier ${record.id}`,
      });
    if (
      (names.get(`${record.name.trim().toLowerCase()}|${record.lga}`) ?? 0) > 1
    )
      issues.push({
        code: "duplicate_name_lga",
        recordId: record.id,
        message: `Duplicate community name within ${record.lga}`,
      });
    if (
      record.hasLocation &&
      (coordinates.get(`${record.latitude},${record.longitude}`) ?? 0) > 1
    )
      issues.push({
        code: "duplicate_coordinates",
        recordId: record.id,
        message: "Coordinates are shared by multiple communities",
      });
  }
}

/**
 * Shared record pipeline for both the live path and the presentation-snapshot
 * fallback: identity validation, Zod parse, cluster join, null-preserving
 * mapping, dataset-level duplicate checks and count integrity. Identical
 * guarantees regardless of source.
 */
function finalizeDataset(
  rawRecords: unknown[],
  serverCount: number | null,
  mode: "live" | "snapshot",
  snapshotCreatedAt?: string,
): CommunityDataset {
  const label = mode === "snapshot" ? "Verified snapshot" : "Live register";
  if (!rawRecords.length)
    throw new Error(`${label} contained no records.`);

  const issues: DataQualityIssue[] = [];
  const sourceRecords: SourceRecord[] = [];
  for (const input of rawRecords) {
    const parsed = parseSourceRecord(input);
    issues.push(...parsed.issues);
    if (parsed.record) sourceRecords.push(parsed.record);
  }
  if (sourceRecords.length !== rawRecords.length)
    throw new Error(
      `${label} contains ${rawRecords.length - sourceRecords.length} record(s) without valid identity fields; authoritative totals are blocked.`,
    );
  const clusters = new Map(
    register.map((row) => [
      `${row.name.trim().toLowerCase()}|${normalizeLga(row.lga)}`,
      row.cluster,
    ]),
  );
  const records = sourceRecords.map((record) => {
    const name = String(record.final_name ?? record.community_name ?? "")
      .trim()
      .toLowerCase();
    const lga = typeof record.lga === "string" ? normalizeLga(record.lga) : "";
    const community = mapRecord(record, clusters.get(`${name}|${lga}`) ?? null);
    issues.push(...community.validationIssues);
    return community;
  });
  addDatasetIssues(records, issues);
  const countMatches = serverCount === null || serverCount === rawRecords.length;
  if (!countMatches)
    throw new Error(
      `${label} is incomplete: source reports ${serverCount} rows but ${rawRecords.length} were fetched.`,
    );
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw new Error(
      `${label} contains duplicate community identifiers; authoritative totals are blocked.`,
    );
  return {
    records,
    issues,
    status: {
      rowCount: records.length,
      serverCount,
      geolocatedCount: records.filter((record) => record.hasLocation).length,
      populationKnownCount: records.filter((record) => record.population !== null)
        .length,
      populationUnknownCount: records.filter(
        (record) => record.population === null,
      ).length,
      validationIssueCount: issues.length,
      fetchedAt: new Date().toISOString(),
      complete: countMatches && sourceRecords.length === rawRecords.length,
      mode,
      ...(snapshotCreatedAt ? { snapshotCreatedAt } : {}),
    },
  };
}

async function loadLiveDataset(): Promise<CommunityDataset> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Live community data is unavailable because Supabase public configuration is missing.",
    );
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fetched = await fetchAllPages<unknown>(async (from, to) => {
    const result = await client
      .from("blue_lagos_dashboard_kpis")
      .select(columns, { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to);
    return { data: result.data, count: result.count, error: result.error };
  });
  return finalizeDataset(fetched.records, fetched.count, "live");
}

/**
 * Verified presentation snapshot fallback. Only used when (a) the live query
 * failed, (b) NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK === "1", and (c) a snapshot
 * file produced by `npm run snapshot:presentation` exists. Returns null
 * otherwise so the caller re-throws the real live error — never a silent swap.
 */
async function loadSnapshotDataset(): Promise<CommunityDataset | null> {
  if (process.env.NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK !== "1") return null;
  let parsed: { createdAt?: string; validation?: { serverCount: number | null }; records?: unknown[] };
  try {
    parsed = JSON.parse(
      await readFile(join(process.cwd(), "data", "presentation-snapshot.json"), "utf8"),
    );
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.records) || !parsed.records.length) return null;
  return finalizeDataset(
    parsed.records,
    parsed.validation?.serverCount ?? parsed.records.length,
    "snapshot",
    parsed.createdAt,
  );
}

export const getCommunityDataset = cache(
  async (): Promise<CommunityDataset> => {
    await connection();
    try {
      return await loadLiveDataset();
    } catch (liveError) {
      const fallback = await loadSnapshotDataset();
      if (fallback) return fallback;
      throw liveError;
    }
  },
);

export const getCommunities = cache(
  async () => (await getCommunityDataset()).records,
);
