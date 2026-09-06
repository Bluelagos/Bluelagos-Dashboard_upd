/**
 * Process-level memo for the shared-service-area analysis.
 *
 * The analysis is pure but expensive: it clusters every geolocated community,
 * generates and scores candidate points inside each cluster, and screens each
 * candidate against the state polygon and the mapped waterways. Measured on the
 * production build it dominated the Priorities and community-dossier requests.
 *
 * The result depends only on the community coordinates, the derived metrics and
 * the chosen options, so it is safe to reuse within a server process. The key
 * includes a signature of the community points, so genuinely changed live data
 * produces a fresh result rather than a stale one, and entries expire after a
 * few minutes as a second safeguard. This mirrors the memo already used for the
 * derived spatial context.
 */
import type { Community } from "../domain";
import {
  analyzeSharedServiceAreas,
  type CandidateConstraints,
  type ClusterMode,
  type DerivedCommunityMetric,
  type InterventionType,
  type SharedServiceAnalysis,
} from "./service-areas";

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 24;

export interface ServiceAreaOptions {
  intervention: InterventionType;
  clusterMode?: ClusterMode;
  clusterDistanceKm?: number;
  serviceRadiusKm?: number;
  facilityCount?: number;
}

const cache = new Map<string, { at: number; value: SharedServiceAnalysis }>();

/** Cheap, order-independent signature of the geolocated community points. */
function signatureOf(communities: Community[]): string {
  let accumulator = communities.length * 2654435761;
  for (const community of communities) {
    if (!community.hasLocation || community.longitude === null || community.latitude === null)
      continue;
    accumulator =
      (accumulator ^
        (community.id * 40503 +
          Math.round(community.longitude * 1e5) * 31 +
          Math.round(community.latitude * 1e5))) >>>
      0;
  }
  return `${communities.length}:${accumulator}`;
}

export function analyzeSharedServiceAreasCached(
  communities: Community[],
  metrics: DerivedCommunityMetric[],
  constraints: CandidateConstraints,
  options: ServiceAreaOptions,
): SharedServiceAnalysis {
  const key = [
    signatureOf(communities),
    metrics.length,
    options.intervention,
    options.clusterMode ?? "priority",
    options.clusterDistanceKm ?? 5,
    options.serviceRadiusKm ?? 5,
    options.facilityCount ?? 1,
  ].join("|");

  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  const value = analyzeSharedServiceAreas(communities, metrics, constraints, options);
  cache.set(key, { at: now, value });

  // Drop expired entries, then the oldest, so a long-running process with many
  // option combinations cannot grow without bound.
  for (const [entryKey, entry] of cache) {
    if (now - entry.at >= TTL_MS) cache.delete(entryKey);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (!oldest) break;
    cache.delete(oldest[0]);
  }
  return value;
}

/** Exposed for tests. */
export function clearServiceAreaCache() {
  cache.clear();
}
