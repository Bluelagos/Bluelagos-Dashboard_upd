import { describe, expect, it } from "vitest";
import type { Feature, LineString, Polygon } from "geojson";
import { analyzeSharedServiceAreas, clusterCommunities, validateCandidate, type CandidateConstraints } from "@/lib/spatial/service-areas";
import { pointInPolygonGeometry, type AdministrativeFeature } from "@/lib/spatial";
import { community } from "./fixtures";

const state: AdministrativeFeature["geometry"] = {
  type: "Polygon",
  coordinates: [[[2.5, 6], [4.5, 6], [4.5, 7], [2.5, 7], [2.5, 6]]],
};
const emptyConstraints: CandidateConstraints = { state, waterways: [], waterPolygons: [] };
const metric = (communityId: number, healthDistanceKm = 8, marineDistanceKm = 8) => ({ communityId, healthDistanceKm, marineDistanceKm, waterwayDistanceKm: 1 });
const located = (id: number, longitude: number, latitude: number, population = 100) => community({ id, slug: `c-${id}`, name: `Community ${id}`, hasLocation: true, longitude, latitude, population, needScore: 6 });

describe("geographic DBSCAN service areas", () => {
  it("handles zero targets", () => {
    const result = analyzeSharedServiceAreas([], [], emptyConstraints, { intervention: "health" });
    expect(result.areas).toEqual([]);
    expect(result.targetCommunityCount).toBe(0);
  });

  it("retains one target as an isolated service area", () => {
    expect(clusterCommunities([located(1, 3.5, 6.5)], 3)).toHaveLength(1);
  });

  it("keeps two distant targets in separate areas", () => {
    expect(clusterCommunities([located(1, 3, 6.5), located(2, 4, 6.5)], 3)).toHaveLength(2);
  });

  it("groups a dense settlement pattern", () => {
    expect(clusterCommunities([located(1, 3.5, 6.5), located(2, 3.505, 6.5), located(3, 3.51, 6.5)], 2)).toHaveLength(1);
  });

  it("allows a cluster to cross survey LGA labels", () => {
    const rows = [located(1, 3.5, 6.5), located(2, 3.505, 6.5)];
    rows[0].lga = "Epe";
    rows[1].lga = "Ibeju-Lekki";
    const result = analyzeSharedServiceAreas(rows, rows.map((row) => metric(row.id)), emptyConstraints, { intervention: "health" });
    expect(result.areas[0].lgas).toEqual(["Epe", "Ibeju-Lekki"]);
  });

  it("excludes null and invalid coordinates", () => {
    const rows = [located(1, 3.5, 6.5), community({ id: 2, hasLocation: false, longitude: null, latitude: null }), community({ id: 3, hasLocation: true, longitude: Number.NaN, latitude: 6.5 })];
    expect(clusterCommunities(rows, 5).flat().map((row) => row.id)).toEqual([1]);
  });
});

describe("candidate water constraints", () => {
  const water: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[3.49, 6.49], [3.51, 6.49], [3.51, 6.51], [3.49, 6.51], [3.49, 6.49]]] },
  };
  const shoreline: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [[3.5, 6.4], [3.5, 6.6]] },
  };

  it("rejects a centroid in water and selects a land candidate", () => {
    const rows = [located(1, 3.48, 6.5), located(2, 3.52, 6.5)];
    const constraints = { state, waterPolygons: [water], waterways: [] };
    const result = analyzeSharedServiceAreas(rows, rows.map((row) => metric(row.id)), constraints, { intervention: "health", clusterDistanceKm: 6, serviceRadiusKm: 6 });
    const candidate = result.areas[0].candidate;
    expect(pointInPolygonGeometry([3.5, 6.5], water.geometry as AdministrativeFeature["geometry"])).toBe(true);
    expect(candidate).not.toBeNull();
    expect(pointInPolygonGeometry(candidate!.coordinate, water.geometry as AdministrativeFeature["geometry"])).toBe(false);
    expect(candidate!.outsideMappedWater).toBe(true);
  });

  it("keeps land facilities land-side and jetty candidates shoreline-side", () => {
    const rows = [located(1, 3.495, 6.49), located(2, 3.495, 6.51)];
    const constraints = { state, waterPolygons: [water], waterways: [shoreline], landWaterwayBufferKm: 0.05, shorelineToleranceKm: 0.25 };
    const land = analyzeSharedServiceAreas(rows, rows.map((row) => metric(row.id)), constraints, { intervention: "health", serviceRadiusKm: 3 }).areas[0].candidate;
    const jetty = analyzeSharedServiceAreas(rows.map((row) => ({ ...row, route: "water_only" })), rows.map((row) => metric(row.id)), constraints, { intervention: "jetty", serviceRadiusKm: 3 }).areas[0].candidate;
    expect(land?.outsideMappedWater).toBe(true);
    expect(jetty?.nearShoreline).toBe(true);
    expect(jetty?.valid).toBe(true);
  });

  it("flags a water-separated cluster", () => {
    const rows = [located(1, 3.49, 6.5), located(2, 3.51, 6.5)];
    const result = analyzeSharedServiceAreas(rows, rows.map((row) => metric(row.id)), { state, waterways: [shoreline] }, { intervention: "health", clusterDistanceKm: 3 });
    expect(result.areas[0].waterSeparated).toBe(true);
  });

  it("reports explicit validity checks", () => {
    expect(validateCandidate([3.5, 6.5], "health", { state, waterPolygons: [water] })).toMatchObject({ insideLagos: true, outsideMappedWater: false, valid: false });
  });
});

describe("maximum coverage", () => {
  it("uses marginal coverage and sums each community population once", () => {
    const rows = [located(1, 3, 6.5, 100), located(2, 3.01, 6.5, 200), located(3, 4, 6.5, 300), located(4, 4.01, 6.5, 400)];
    const result = analyzeSharedServiceAreas(rows, rows.map((row) => metric(row.id)), emptyConstraints, { intervention: "health", clusterDistanceKm: 3, serviceRadiusKm: 3, facilityCount: 2 });
    expect(result.selectedCandidates).toHaveLength(2);
    expect(result.uniqueCommunityIds).toEqual([1, 2, 3, 4]);
    expect(result.uniquePopulation).toBe(1000);
    expect(new Set(result.uniqueCommunityIds).size).toBe(result.uniqueCommunityIds.length);
  });
});
