import administrativeCollection from "@/data/spatial/lagos-administrative.json";
import administrativeMetadata from "@/data/spatial/lagos-administrative.metadata.json";
import osmProcessedMetadata from "@/data/spatial/processed/osm-processed.metadata.json";
import { normalizeLga } from "./geography";

export type SpatialLayerStatus = "integrated" | "partial" | "unavailable";
export interface SpatialProvenance {
  id: string;
  title: string;
  provider: string;
  source: string;
  sourceDate: string;
  retrievedAt: string;
  license: string;
  geometryType: string;
  crs: string;
  featureCount: number;
  processing: string;
  limitations: string;
  confidence: string;
}

export type SourceQuality = "authoritative" | "field_verified" | "secondary" | "contextual";
export interface HealthFacility {
  facilityId: string;
  name: string;
  type: string;
  ownership: string | null;
  lga: string | null;
  latitude: number;
  longitude: number;
  source: string;
  sourceQuality: SourceQuality;
  verified: boolean;
}
export interface LandingPoint {
  landingId: string;
  name: string | null;
  kind: "official_jetty" | "community_landing" | "ferry_terminal" | "informal_landing" | "unknown";
  latitude: number;
  longitude: number;
  source: string;
  sourceQuality: SourceQuality;
  verified: boolean;
}
export interface WaterwaySegment {
  segmentId: string;
  waterwayType: string;
  navigabilityStatus: "verified_navigable" | "presumed_navigable" | "not_navigable" | "unknown";
  verified: boolean;
  verificationSource: string | null;
  widthEstimateMetres: number | null;
  restriction: string | null;
  source: string;
  updatedAt: string;
}
export interface EarthObservationProduct {
  productId: string;
  sensor: string;
  acquisitionPeriod: string;
  cloudFiltering: string;
  spatialResolutionMetres: number;
  processingMethod: string;
  classificationOrThreshold: string;
  units: string;
  license: string;
  processedAt: string;
  limitations: string;
  tileUrl: string;
}
export interface ModelledPopulationMetric {
  source: string;
  productYear: number;
  modelledPopulation: number | null;
  resolutionMetres: number;
  catchmentMethod: string;
  processedAt: string;
}

type Position = [number, number];
type PolygonGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: Position[][] | Position[][][];
};
export interface AdministrativeFeature {
  type: "Feature";
  geometry: PolygonGeometry;
  properties: {
    layer_id: string;
    name: string;
    admin_level: "ADM1" | "ADM2";
    source_id: string | null;
    source: string;
    source_year: string;
    confidence: string;
  };
}
export interface AdministrativeFeatureCollection {
  type: "FeatureCollection";
  features: AdministrativeFeature[];
}

export function pointInRing([x, y]: Position, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygonGeometry(point: Position, geometry: PolygonGeometry) {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates as Position[][]]
    : (geometry.coordinates as Position[][][]);
  return polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

import type { Community } from "./domain";

/* -------------------------------------------------------------------------- */
/*  Administrative geography (GRID3 2022 via geoBoundaries gbOpen, CC BY 4.0) */
/*  Processed offline by pipelines/administrative/fetch.mjs. Rendered and     */
/*  used for point-in-polygon containment / LGA reconciliation checks.        */
/* -------------------------------------------------------------------------- */

const administrativeLayer = administrativeCollection as unknown as AdministrativeFeatureCollection;

export function getAdministrativeLayer(): AdministrativeFeatureCollection {
  return administrativeLayer;
}

export function getLagosStateFeature(): AdministrativeFeature | null {
  return administrativeLayer.features.find((f) => f.properties.admin_level === "ADM1") ?? null;
}

export function getLgaFeatures(): AdministrativeFeature[] {
  return administrativeLayer.features.filter((f) => f.properties.admin_level === "ADM2");
}

export function getAdministrativeProvenance(): SpatialProvenance {
  const m = administrativeMetadata;
  return {
    id: m.id,
    title: m.title,
    provider: m.provider,
    source: m.source,
    sourceDate: m.sourceDate,
    retrievedAt: m.retrievedAt,
    license: m.license,
    geometryType: m.geometryType,
    crs: m.crs,
    featureCount: m.featureCount,
    processing: m.processing,
    limitations: m.limitations,
    confidence: m.confidence,
  };
}

export function validateAdministrativeLayer(): {
  valid: boolean;
  stateCount: number;
  lgaCount: number;
  duplicateIds: number;
} {
  const ids = new Set<string>();
  let duplicateIds = 0;
  let stateCount = 0;
  let lgaCount = 0;
  let geometryValid = true;
  for (const feature of administrativeLayer.features) {
    const id = feature.properties.layer_id;
    if (ids.has(id)) duplicateIds += 1;
    ids.add(id);
    if (feature.properties.admin_level === "ADM1") stateCount += 1;
    if (feature.properties.admin_level === "ADM2") lgaCount += 1;
    if (!["Polygon", "MultiPolygon"].includes(feature.geometry?.type)) geometryValid = false;
  }
  return {
    valid: geometryValid && duplicateIds === 0 && stateCount === 1 && lgaCount === 20,
    stateCount,
    lgaCount,
    duplicateIds,
  };
}

export function communityInsideLagos(
  community: Pick<Community, "hasLocation" | "longitude" | "latitude">,
): boolean | null {
  if (!community.hasLocation || community.longitude === null || community.latitude === null) return null;
  const state = getLagosStateFeature();
  if (!state) return null;
  return pointInPolygonGeometry([community.longitude, community.latitude], state.geometry);
}

/** Returns the LGA polygon whose geometry contains the point, or null. */
export function lgaForPoint(longitude: number, latitude: number): AdministrativeFeature | null {
  for (const feature of getLgaFeatures()) {
    if (pointInPolygonGeometry([longitude, latitude], feature.geometry)) return feature;
  }
  return null;
}

export interface LgaReconciliation {
  matched: number;
  mismatched: Array<{ id: number; name: string; surveyLga: string; polygonLga: string }>;
  outsideAllLgas: Array<{ id: number; name: string; surveyLga: string }>;
  unlocated: number;
}

/**
 * Compares each geolocated community's survey-declared LGA against the LGA
 * polygon that actually contains its coordinates. A spatial data-quality check;
 * it does not overwrite the survey value.
 */
export function reconcileCommunityLga(
  communities: Array<Pick<Community, "id" | "name" | "lga" | "hasLocation" | "longitude" | "latitude">>,
): LgaReconciliation {
  const result: LgaReconciliation = { matched: 0, mismatched: [], outsideAllLgas: [], unlocated: 0 };
  for (const c of communities) {
    if (!c.hasLocation || c.longitude === null || c.latitude === null) {
      result.unlocated += 1;
      continue;
    }
    const polygon = lgaForPoint(c.longitude, c.latitude);
    if (!polygon) {
      result.outsideAllLgas.push({ id: c.id, name: c.name, surveyLga: c.lga });
      continue;
    }
    const polygonLga = normalizeLga(polygon.properties.name);
    if (polygonLga === normalizeLga(c.lga)) result.matched += 1;
    else result.mismatched.push({ id: c.id, name: c.name, surveyLga: c.lga, polygonLga });
  }
  return result;
}

export function spatialCatalogue() {
  const adminMeta = administrativeMetadata;
  return [
    {
      id: "community-baseline",
      title: "Blue Lagos surveyed communities",
      category: "Field data",
      status: "integrated" as const,
      records: "Live register count",
      type: "Point attributes",
      provider: "Blue Lagos field survey",
      source: "Supabase blue_lagos_dashboard_kpis view",
      date: "Live query; source observation date unavailable",
      license: "Internal governance terms",
      processing: "Runtime Zod validation and deterministic pagination",
      limitation: "Survey locations and supplied straight-line descriptors; not a complete settlement census.",
    },
    {
      id: "lagos-administrative-boundaries",
      title: "Lagos State and LGA boundaries",
      category: "Administrative",
      status: "integrated" as const,
      records: "21 features",
      type: "Polygon/MultiPolygon",
      provider: `${adminMeta.provider} via ${adminMeta.distributor}`,
      source: adminMeta.source,
      date: `Boundary year ${adminMeta.boundaryYear}; retrieved ${adminMeta.retrievedAt.slice(0, 10)}`,
      license: adminMeta.license,
      processing: adminMeta.processing,
      limitation: adminMeta.limitations,
    },
    ...osmProcessedLayers(),
    {
      id: "h3-analytical-grid",
      title: "H3 analytical grid",
      category: "Derived spatial metric",
      status: "integrated" as const,
      records: "Recomputed per request",
      type: `H3 res-${7} hexagons (Polygon)`,
      provider: "Derived by Blue Lagos from surveyed community geometry",
      source: "Uber H3 v4 aggregation of the live community register",
      date: "Recomputed at request time from live data",
      license: "Derived output; H3 library Apache-2.0",
      processing:
        "Each surveyed community point is binned to its H3 res-7 cell. Cell values are real counts / transparent summaries (community count, critical count, mean & max need score, sum of KNOWN survey population). Empty space produces no cell; nothing is interpolated.",
      limitation:
        "Aggregates surveyed communities only, not all settlements. Population totals exclude communities with unknown survey population.",
    },
    ...[
      ["population", "Modelled gridded population", "Modelled external evidence", "WorldPop product not selected or processed", "Unavailable"],
      ["earth-observation", "Earth observation products", "Modelled external evidence", "Offline adapter contract only; Earth Engine not authenticated", "Source-dependent"],
      ["water-network", "Validated navigable water network", "Transport", "No navigability verification or routing graph", "Unavailable"],
    ].map(([id, title, category, limitation, license]) => ({
      id, title, category, status: "unavailable" as const, records: "Unavailable", type: "Not published", provider: "Not configured",
      source: "Not selected", date: "Unavailable", license, processing: "No analytical output generated", limitation,
    })),
  ];
}

/** The reviewed OpenStreetMap layers produced by pipelines/osm/process.mjs. */
export function osmProcessedLayers() {
  const m = osmProcessedMetadata;
  const common = {
    category: "Open mapping evidence",
    status: "integrated" as const,
    provider: "OpenStreetMap contributors",
    source: `Overpass extraction, retrieved ${m.retrievedAt.slice(0, 10)}; boundary-clipped and reviewed ${m.processedAt.slice(0, 10)}`,
    date: `Retrieved ${m.retrievedAt.slice(0, 10)}`,
    license: m.license,
  };
  return Object.entries(m.layers).map(([id, layer]) => ({
    id: `osm-${id}`,
    title: layer.title,
    ...common,
    records: `${layer.featureCount} features`,
    type: `${layer.geometryType} · ${layer.featureCount} features`,
    processing: `${m.boundaryFilter} ${layer.unnamedCount} feature(s) have no OSM name and are labelled "Unnamed (OSM id)".`,
    limitation: layer.limitations,
  }));
}

export function osmProcessedSummary() {
  return osmProcessedMetadata;
}