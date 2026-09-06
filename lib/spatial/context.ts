/**
 * Derived spatial context for surveyed communities.
 *
 * Joins the live community register to the reviewed OpenStreetMap layers using
 * local Turf calculations. Everything added here is a DERIVED spatial metric:
 *   - great-circle ("straight-line") distances, never travel distance/time
 *   - it never overwrites a survey-reported value; survey and OSM-derived
 *     figures are kept in separate fields and compared, not merged
 *   - communities without coordinates get nulls, not zeros
 */
import { cache } from "react";
import type { Community } from "../domain";
import { getCommunities } from "../data";
import {
  getOsmProcessedMetadata,
  type OsmProcessedMetadata,
} from "./osm";
import {
  distanceBand,
  type DistanceBand,
} from "./proximity";
import { aggregateCommunitiesToH3, H3_RESOLUTION, type H3Cell } from "./h3";
import { getPersistedSpatialContext } from "./derived";

const CONTEXT_TTL_MS = 5 * 60 * 1000;

/**
 * Process-level memо of the derived context. React's `cache` only dedupes
 * within a single request; the demo hits many routes that each recompute
 * ~10^5 great-circle distances over the OSM layers. The derived values depend
 * only on community coordinates, so we key the memo on a cheap signature of
 * the geolocated points and expire it after a few minutes so genuine live
 * changes are still picked up.
 */
let memo: { signature: string; at: number; value: SpatialContext } | null = null;
function signatureOf(communities: Community[]): string {
  let acc = communities.length * 2654435761;
  for (const c of communities) {
    if (!c.hasLocation || c.longitude === null || c.latitude === null) continue;
    acc = (acc ^ (c.id * 40503 + Math.round(c.longitude * 1e5) * 31 + Math.round(c.latitude * 1e5))) >>> 0;
  }
  return `${communities.length}:${acc}`;
}

export interface CommunitySpatial {
  id: number;
  slug: string;
  name: string;
  lga: string;
  district: string;
  hasLocation: boolean;
  /* --- OSM-derived straight-line proximity (DERIVED) --- */
  nearestOsmHealthKm: number | null;
  nearestOsmHealthName: string | null;
  nearestOsmHealthType: string | null;
  healthDistanceBand: DistanceBand;
  nearestOsmMarineKm: number | null;
  nearestOsmMarineName: string | null;
  nearestOsmMarineKind: string | null;
  osmMarineWithin5Km: number;
  nearestOsmWaterwayKm: number | null;
  /* --- survey vs OSM comparison (not a correction) --- */
  surveyHospitalDistanceKm: number | null;
  surveyVsOsmHealthDeltaKm: number | null;
  /* --- compound access flag (transparent, factor-listed) --- */
  accessConstraintFactors: string[];
  accessConstraintCount: number;
}

export interface SpatialContext {
  byId: Map<number, CommunitySpatial>;
  rows: CommunitySpatial[];
  h3: {
    resolution: number;
    cells: H3Cell[];
  };
  comparison: {
    bothKnown: number;
    withinOneKm: number;
    surveyFartherBy2Km: number;
    osmFartherBy2Km: number;
    surveyOnly: number;
    osmOnly: number;
    neither: number;
  };
  osmMetadata: OsmProcessedMetadata;
  generatedAt: string;
}

function accessConstraints(
  c: Community,
  nearestHealthKm: number | null,
  nearestMarineKm: number | null,
  marineWithin5: number,
): string[] {
  const factors: string[] = [];
  if (c.strandingStatus === "HIGHLY_STRANDED") factors.push("Highly stranded emergency access (survey)");
  if (c.hasLocation && c.nearestCommunityKm !== null && c.nearestCommunityKm > 5)
    factors.push("Geographically isolated (>5 km to nearest surveyed community)");
  if (nearestHealthKm !== null && nearestHealthKm >= 10)
    factors.push("≥10 km straight-line to nearest OSM-mapped health facility");
  if (c.hasLocation && marineWithin5 === 0 && nearestMarineKm !== null && nearestMarineKm >= 5)
    factors.push("No OSM-mapped marine access point within 5 km");
  if (c.route && /water|boat|canoe|ferry|creek|river/i.test(c.route) && c.jettyCondition && /poor|bad|none|no /i.test(c.jettyCondition))
    factors.push("Water-dependent route with poor/absent landing (survey)");
  return factors;
}

export const getSpatialContext = cache(async (): Promise<SpatialContext> => {
  const [communities, persisted, osmMetadata] = await Promise.all([
    getCommunities(),
    getPersistedSpatialContext(),
    getOsmProcessedMetadata(),
  ]);

  const signature = signatureOf(communities);
  if (memo && memo.signature === signature && Date.now() - memo.at < CONTEXT_TTL_MS) {
    return memo.value;
  }

  const persistedById = new Map(persisted.communities.map((row) => [row.community_id, row]));
  const rows: CommunitySpatial[] = communities.map((c) => {
    if (!c.hasLocation || c.longitude === null || c.latitude === null) {
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        lga: c.lga,
        district: c.district,
        hasLocation: false,
        nearestOsmHealthKm: null,
        nearestOsmHealthName: null,
        nearestOsmHealthType: null,
        healthDistanceBand: "No mapped facility",
        nearestOsmMarineKm: null,
        nearestOsmMarineName: null,
        nearestOsmMarineKind: null,
        osmMarineWithin5Km: 0,
        nearestOsmWaterwayKm: null,
        surveyHospitalDistanceKm: c.hospitalDistanceKm,
        surveyVsOsmHealthDeltaKm: null,
        accessConstraintFactors: [],
        accessConstraintCount: 0,
      };
    }
    const derived = persistedById.get(c.id);
    const nearestHealthKm = derived?.distance_km ?? null;
    const nearestMarineKm = derived?.marine_access_distance_km ?? null;
    const nearestWaterwayKm = derived?.waterway_distance_km ?? null;
    const marineWithin5 = derived?.marine_access_within_5km ?? 0;
    const factors = accessConstraints(c, nearestHealthKm, nearestMarineKm, marineWithin5);

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      lga: c.lga,
      district: c.district,
      hasLocation: true,
      nearestOsmHealthKm: nearestHealthKm,
      nearestOsmHealthName: derived?.nearest_health_name ?? null,
      nearestOsmHealthType: derived?.nearest_health_type ?? null,
      healthDistanceBand: distanceBand(nearestHealthKm),
      nearestOsmMarineKm: nearestMarineKm,
      nearestOsmMarineName: derived?.nearest_marine_name ?? null,
      nearestOsmMarineKind: null,
      osmMarineWithin5Km: marineWithin5,
      nearestOsmWaterwayKm: nearestWaterwayKm,
      surveyHospitalDistanceKm: c.hospitalDistanceKm,
      surveyVsOsmHealthDeltaKm:
        c.hospitalDistanceKm !== null && nearestHealthKm !== null
          ? Number((c.hospitalDistanceKm - nearestHealthKm).toFixed(3))
          : null,
      accessConstraintFactors: factors,
      accessConstraintCount: factors.length,
    };
  });

  const comparison = {
    bothKnown: 0,
    withinOneKm: 0,
    surveyFartherBy2Km: 0,
    osmFartherBy2Km: 0,
    surveyOnly: 0,
    osmOnly: 0,
    neither: 0,
  };
  for (const r of rows) {
    const s = r.surveyHospitalDistanceKm;
    const o = r.nearestOsmHealthKm;
    if (s !== null && o !== null) {
      comparison.bothKnown += 1;
      const delta = s - o;
      if (Math.abs(delta) <= 1) comparison.withinOneKm += 1;
      else if (delta > 2) comparison.surveyFartherBy2Km += 1;
      else if (delta < -2) comparison.osmFartherBy2Km += 1;
    } else if (s !== null) comparison.surveyOnly += 1;
    else if (o !== null) comparison.osmOnly += 1;
    else comparison.neither += 1;
  }

  const value: SpatialContext = {
    byId: new Map(rows.map((r) => [r.id, r])),
    rows,
    h3: {
      resolution: H3_RESOLUTION,
      cells: aggregateCommunitiesToH3(communities, H3_RESOLUTION),
    },
    comparison,
    osmMetadata,
    generatedAt: new Date().toISOString(),
  };
  memo = { signature, at: Date.now(), value };
  return value;
});
