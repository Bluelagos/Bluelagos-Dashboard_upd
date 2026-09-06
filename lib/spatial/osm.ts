/**
 * Server-side loader for the reviewed OpenStreetMap layers produced by
 * pipelines/osm/process.mjs. These files are committed to data/spatial/processed
 * so the application never calls Overpass at request time.
 *
 * Every feature keeps its OSM id and original source tags. Labels in the UI must
 * say "OpenStreetMap mapped ..." — this is contributor evidence, not an official
 * Lagos State registry.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";

const PROCESSED_DIR = join(process.cwd(), "data", "spatial", "processed");

export interface OsmFeatureProps {
  osm_id: string;
  name: string;
  named: boolean;
  source: string;
  source_tags: Record<string, string>;
  retrieved_at: string;
  confidence: string;
  field_verified: boolean;
  layer: string;
}
export interface OsmHealthProps extends OsmFeatureProps {
  facility_type: string;
  operator: string | null;
}
export interface OsmMarineProps extends OsmFeatureProps {
  access_kind: "ferry_terminal" | "pier" | "harbour" | "landing_candidate";
  official_status: "unknown";
  navigability: "unknown";
}
export interface OsmWaterwayProps extends OsmFeatureProps {
  waterway_type: string;
  navigability: "unknown";
}

export interface OsmLayerMeta {
  title: string;
  geometryType: string;
  featureCount: number;
  namedCount: number;
  unnamedCount: number;
  bbox: [number, number, number, number] | null;
  limitations: string;
}
export interface OsmProcessedMetadata {
  id: string;
  provider: string;
  retrievedAt: string;
  processedAt: string;
  license: string;
  attribution: string;
  crs: string;
  boundaryFilter: string;
  report: {
    inputRecords: number;
    duplicateOsmIds: number;
    droppedNoGeometry: number;
    droppedOutsideLagos: number;
    unnamedKept: { health: number; marine: number; waterway: number };
  };
  layers: Record<string, OsmLayerMeta>;
}

// The processed files are immutable for the lifetime of the server process, so
// memoise the parsed result across requests (React `cache` only dedupes within
// one request).
const fileMemo = new Map<string, Promise<unknown>>();
function readCollection<T>(file: string): Promise<T> {
  let cached = fileMemo.get(file);
  if (!cached) {
    cached = readFile(join(PROCESSED_DIR, file), "utf8").then((text) => JSON.parse(text));
    fileMemo.set(file, cached);
  }
  return cached as Promise<T>;
}

export const getOsmHealthFacilities = cache(
  async (): Promise<FeatureCollection<Point, OsmHealthProps>> =>
    readCollection("osm-health-facilities.geojson"),
);
export const getOsmMarineAccess = cache(
  async (): Promise<FeatureCollection<Point, OsmMarineProps>> =>
    readCollection("osm-marine-access.geojson"),
);
export const getOsmWaterways = cache(
  async (): Promise<FeatureCollection<LineString, OsmWaterwayProps>> =>
    readCollection("osm-waterways.geojson"),
);
export const getOsmProcessedMetadata = cache(
  async (): Promise<OsmProcessedMetadata> => readCollection("osm-processed.metadata.json"),
);

export type { Feature };
