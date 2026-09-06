import { aggregateKnown } from "./analytics";
import type { Community } from "./domain";

const radians = (value: number) => value * Math.PI / 180;

export function distanceKm(a: Pick<Community, "hasLocation" | "latitude" | "longitude">, b: Pick<Community, "hasLocation" | "latitude" | "longitude">): number | null {
  if (!a.hasLocation || !b.hasLocation || a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function calculateScenario(communities: Community[], originSlug: string, radiusKm: number) {
  const mapped = communities.filter((community) => community.hasLocation);
  const origin = mapped.find((community) => community.slug === originSlug) ?? null;
  const selected = origin ? mapped.filter((community) => (distanceKm(origin, community) ?? Number.POSITIVE_INFINITY) <= Math.max(0, radiusKm)) : [];
  return { origin, mappedCount: mapped.length, selected, selectedCount: selected.length, population: aggregateKnown(selected, "population") };
}

export function calculateScenarioAt(communities: Community[], coordinate: [number, number] | null, radiusKm: number) {
  const mapped = communities.filter((community) => community.hasLocation && community.longitude !== null && community.latitude !== null);
  const selected = coordinate ? mapped.filter((community) => {
    const distance = distanceKm({ hasLocation: true, longitude: coordinate[0], latitude: coordinate[1] }, community);
    return distance !== null && distance <= Math.max(0, radiusKm);
  }) : [];
  return { coordinate, mappedCount: mapped.length, selected, selectedCount: selected.length, population: aggregateKnown(selected, "population") };
}

export function calculateHealthCoverageGain(communities: Community[], originSlug: string, radiusKm: number) {
  const scenario = calculateScenario(communities, originSlug, radiusKm);
  const baseline = communities.filter(
    (community) => community.hospitalDistanceKm !== null && community.hospitalDistanceKm <= Math.max(0, radiusKm),
  );
  const baselineIds = new Set(baseline.map((community) => community.id));
  const newlyServed = scenario.selected.filter((community) => !baselineIds.has(community.id));
  return {
    ...scenario,
    baseline,
    baselineCount: baseline.length,
    newlyServed,
    newlyServedCount: newlyServed.length,
    newlyServedPopulation: aggregateKnown(newlyServed, "population"),
    afterCount: new Set([...baselineIds, ...scenario.selected.map((community) => community.id)]).size,
  };
}

export function rankHealthCandidates(communities: Community[], radiusKm: number) {
  return communities.filter((community) => community.hasLocation).map((candidate) => {
    const result = calculateHealthCoverageGain(communities, candidate.slug, radiusKm);
    const knownPopulation = result.newlyServedPopulation.value ?? 0;
    const criticalCount = result.newlyServed.filter((community) => community.critical).length;
    return {
      candidate,
      newlyServedCount: result.newlyServedCount,
      knownPopulation,
      criticalCount,
      completeness: result.newlyServedPopulation.completeness,
      score: result.newlyServedCount * 0.4 + Math.log10(knownPopulation + 1) * 0.3 + criticalCount * 0.3,
    };
  }).sort((a, b) => b.score - a.score || a.candidate.id - b.candidate.id);
}
