import { CATEGORY_COLORS } from "./constants";
import type { Community } from "./domain";

export interface CommunityFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { slug: string; name: string; lga: string; critical: 0 | 1; score: number; color: string; population?: number | null; healthDistanceKm?: number | null; healthFacility?: string | null };
  }>;
}

export function communitiesToGeoJson(communities: Community[]): CommunityFeatureCollection {
  return {
    type: "FeatureCollection",
    features: communities.flatMap((community) => {
      if (!community.hasLocation || community.longitude === null || community.latitude === null) return [];
      if (!Number.isFinite(community.longitude) || !Number.isFinite(community.latitude)) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [community.longitude, community.latitude] as [number, number] },
        properties: { slug: community.slug, name: community.name, lga: community.lga, critical: community.critical ? 1 as const : 0 as const, score: community.needScore, color: CATEGORY_COLORS[community.needCategory], population: community.population },
      }];
    }),
  };
}
