import { describe, expect, it } from "vitest";
import {
  communityInsideLagos,
  getAdministrativeProvenance,
  getLagosStateFeature,
  getLgaFeatures,
  lgaForPoint,
  pointInPolygonGeometry,
  reconcileCommunityLga,
  validateAdministrativeLayer,
} from "@/lib/spatial";
import { community } from "./fixtures";

const outerRing: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];
const hole: [number, number][] = [
  [4, 4],
  [6, 4],
  [6, 6],
  [4, 6],
  [4, 4],
];

const square = {
  type: "Polygon" as const,
  coordinates: [outerRing] as [number, number][][],
};

const squareWithHole = {
  type: "Polygon" as const,
  coordinates: [outerRing, hole] as [number, number][][],
};

describe("pointInPolygonGeometry", () => {
  it("detects a point inside a polygon", () =>
    expect(pointInPolygonGeometry([5, 5], square)).toBe(true));
  it("detects a point outside a polygon", () =>
    expect(pointInPolygonGeometry([15, 5], square)).toBe(false));
  it("excludes points inside a hole", () =>
    expect(pointInPolygonGeometry([5, 5], squareWithHole)).toBe(false));
  it("includes points in the ring but outside the hole", () =>
    expect(pointInPolygonGeometry([1, 1], squareWithHole)).toBe(true));
  it("supports MultiPolygon geometry", () =>
    expect(
      pointInPolygonGeometry([5, 5], {
        type: "MultiPolygon",
        coordinates: [square.coordinates] as [number, number][][][],
      }),
    ).toBe(true));
});

describe("processed administrative layer", () => {
  it("validates as one state and twenty LGA polygons with no duplicate IDs", () =>
    expect(validateAdministrativeLayer()).toEqual({
      valid: true,
      stateCount: 1,
      lgaCount: 20,
      duplicateIds: 0,
    }));
  it("exposes exactly one ADM1 feature", () =>
    expect(getLagosStateFeature()?.properties.admin_level).toBe("ADM1"));
  it("exposes twenty ADM2 features", () =>
    expect(getLgaFeatures()).toHaveLength(20));
  it("carries full provenance from the pipeline metadata sidecar", () => {
    const p = getAdministrativeProvenance();
    expect(p.license).toMatch(/CC BY 4.0/);
    expect(p.crs).toMatch(/WGS84/);
    expect(p.featureCount).toBe(21);
    expect(p.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("communityInsideLagos", () => {
  it("returns null when the community has no location", () =>
    expect(
      communityInsideLagos({
        hasLocation: false,
        longitude: null,
        latitude: null,
      }),
    ).toBeNull());
  it("returns true for a point inside the state polygon", () =>
    expect(
      communityInsideLagos({
        hasLocation: true,
        longitude: 3.4,
        latitude: 6.45,
      }),
    ).toBe(true));
  it("returns false for a point outside the state polygon", () =>
    expect(
      communityInsideLagos({
        hasLocation: true,
        longitude: 2.6,
        latitude: 6.05,
      }),
    ).toBe(false));
});

describe("lgaForPoint", () => {
  it("returns the containing LGA polygon", () =>
    expect(lgaForPoint(3.4, 6.45)?.properties.name).toBe("Lagos Island"));
  it("returns the containing LGA polygon for an eastern point", () =>
    expect(lgaForPoint(3.9, 6.6)?.properties.name).toBe("Epe"));
  it("returns null for a point outside every LGA polygon", () =>
    expect(lgaForPoint(2.6, 6.05)).toBeNull());
});

describe("reconcileCommunityLga", () => {
  it("counts an agreeing declared LGA as matched", () => {
    const result = reconcileCommunityLga([
      community({ id: 1, name: "A", lga: "Lagos Island", latitude: 6.45, longitude: 3.4 }),
    ]);
    expect(result.matched).toBe(1);
    expect(result.mismatched).toHaveLength(0);
  });
  it("flags a declared LGA that disagrees with the polygon without discarding it", () => {
    const result = reconcileCommunityLga([
      community({ id: 2, name: "B", lga: "Ikorodu", latitude: 6.45, longitude: 3.4 }),
    ]);
    expect(result.matched).toBe(0);
    expect(result.mismatched[0]).toMatchObject({
      surveyLga: "Ikorodu",
      polygonLga: "LAGOS ISLAND",
    });
  });
  it("separates points outside all LGA polygons and unlocated records", () => {
    const result = reconcileCommunityLga([
      community({ id: 3, name: "C", lga: "Badagry", latitude: 6.05, longitude: 2.6 }),
      community({ id: 4, name: "D", lga: "Epe", hasLocation: false, latitude: null, longitude: null }),
    ]);
    expect(result.outsideAllLgas.map((row) => row.id)).toEqual([3]);
    expect(result.unlocated).toBe(1);
  });
  it("normalises slash and spelling variants before comparing", () => {
    // Lagos Island polygon vs a survey value written with a slash separator.
    const result = reconcileCommunityLga([
      community({ id: 5, name: "E", lga: "Lagos/Island", latitude: 6.45, longitude: 3.4 }),
    ]);
    expect(result.matched).toBe(1);
  });
});
