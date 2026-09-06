import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";

export interface PersistedCommunitySpatial {
  community_id: number;
  nearest_health_feature_id: string | null;
  nearest_health_name: string | null;
  nearest_health_type: string | null;
  nearest_health_source: "OpenStreetMap mapped health facilities";
  distance_km: number;
  calculated_at: string;
  method: "great-circle straight-line distance";
  nearest_marine_feature_id: string | null;
  nearest_marine_name: string | null;
  marine_access_distance_km: number;
  marine_access_within_5km: number;
  nearest_waterway_feature_id: string | null;
  waterway_distance_km: number;
  h3_cell: string;
}

export interface PersistedSpatialContext {
  metadata: {
    title: string;
    community_count: number;
    generated_from_snapshot: string;
    osm_processed_at: string;
    method: string;
    health_source: string;
    h3_resolution: number;
    caveat: string;
  };
  communities: PersistedCommunitySpatial[];
}

let memo: Promise<PersistedSpatialContext> | null = null;

export const getPersistedSpatialContext = cache(async () => {
  memo ??= readFile(join(process.cwd(), "data", "spatial", "derived", "community-spatial-context.json"), "utf8").then((text) => JSON.parse(text) as PersistedSpatialContext);
  return memo;
});
