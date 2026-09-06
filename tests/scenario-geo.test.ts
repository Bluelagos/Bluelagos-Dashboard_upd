import { describe, expect, it } from "vitest";
import { calculateScenario, calculateScenarioAt, distanceKm } from "@/lib/scenario";
import { communitiesToGeoJson } from "@/lib/geo";
import { community } from "./fixtures";

describe("scenario calculations", () => {
  const origin = community({
    id: 1,
    slug: "origin",
    latitude: 6.5,
    longitude: 3.5,
    population: 0,
  });
  const near = community({
    id: 2,
    slug: "near",
    latitude: 6.51,
    longitude: 3.5,
    population: 100,
  });
  const far = community({
    id: 3,
    slug: "far",
    latitude: 6.7,
    longitude: 3.5,
    population: null,
  });
  it("returns zero for a coincident baseline", () =>
    expect(distanceKm(origin, origin)).toBe(0));
  it("returns null for missing spatial data", () =>
    expect(
      distanceKm(origin, community({ hasLocation: false, latitude: null })),
    ).toBeNull());
  it("selects communities within radius", () =>
    expect(
      calculateScenario([origin, near, far], "origin", 5).selected.map(
        (row) => row.slug,
      ),
    ).toEqual(["origin", "near"]));
  it("preserves zero and known population", () =>
    expect(calculateScenario([origin, near], "origin", 5).population).toEqual({
      value: 100,
      knownCount: 2,
      unknownCount: 0,
      completeness: 100,
    }));
  it("reports partial population", () =>
    expect(
      calculateScenario([origin, far], "origin", 30).population.unknownCount,
    ).toBe(1));
  it("handles no selected origin", () =>
    expect(calculateScenario([origin], "missing", 5).selectedCount).toBe(0));
  it("loads an arbitrary planning coordinate without requiring a community origin", () =>
    expect(calculateScenarioAt([origin, near, far], [3.5, 6.5], 5).selected.map((row) => row.id)).toEqual([1, 2]));
});

describe("GeoJSON generation", () => {
  it("creates valid point features", () =>
    expect(communitiesToGeoJson([community()]).features[0].geometry.type).toBe(
      "Point",
    ));
  it("omits invalid and missing coordinates", () =>
    expect(
      communitiesToGeoJson([
        community({ hasLocation: false, latitude: null }),
        community({ longitude: Number.NaN }),
      ]).features,
    ).toHaveLength(0));
  it("supports an empty feature collection", () =>
    expect(communitiesToGeoJson([])).toEqual({
      type: "FeatureCollection",
      features: [],
    }));
});
