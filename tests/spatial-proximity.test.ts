import { describe, expect, it } from "vitest";
import type { Feature, LineString, Point } from "geojson";
import {
  countWithinKm,
  distanceBand,
  greatCircleKm,
  nearestLineKm,
  nearestPointFeature,
} from "@/lib/spatial/proximity";

const pt = (lon: number, lat: number, props: Record<string, unknown> = {}): Feature<Point> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: props,
});
const lineFrom = (coords: [number, number][]): Feature<LineString> => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: coords },
  properties: {},
});

describe("greatCircleKm", () => {
  it("is zero for coincident points", () => {
    expect(greatCircleKm([3.4, 6.45], [3.4, 6.45])).toBe(0);
  });
  it("matches a known Lagos separation within 1%", () => {
    // ~1 degree of longitude at 6.45N ≈ 110.6 km
    const d = greatCircleKm([3.0, 6.45], [4.0, 6.45]);
    expect(d).toBeGreaterThan(109);
    expect(d).toBeLessThan(112);
  });
});

describe("nearestPointFeature", () => {
  it("returns the closest feature's properties and distance", () => {
    const result = nearestPointFeature([3.4, 6.45], [
      pt(3.9, 6.9, { name: "far" }),
      pt(3.41, 6.45, { name: "near" }),
    ]);
    expect(result.feature?.name).toBe("near");
    expect(result.distanceKm).toBeLessThan(2);
  });
  it("returns Infinity / null for an empty layer (never a fake zero)", () => {
    const result = nearestPointFeature([3.4, 6.45], []);
    expect(result.feature).toBeNull();
    expect(result.distanceKm).toBe(Infinity);
  });
});

describe("nearestLineKm", () => {
  it("finds the perpendicular distance to the closest segment", () => {
    const km = nearestLineKm([3.4, 6.5], [lineFrom([[3.4, 6.4], [3.4, 6.45]])]);
    // point is ~5.5 km north of the line's northern end
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(7);
  });
  it("returns Infinity for no lines", () => {
    expect(nearestLineKm([3.4, 6.5], [])).toBe(Infinity);
  });
});

describe("countWithinKm", () => {
  it("counts only features inside the radius", () => {
    const features = [pt(3.4, 6.45), pt(3.41, 6.45), pt(3.9, 6.9)];
    expect(countWithinKm([3.4, 6.45], features, 5)).toBe(2);
  });
});

describe("distanceBand", () => {
  it("bands the distribution and flags missing data", () => {
    expect(distanceBand(1.2)).toBe("<2 km");
    expect(distanceBand(3)).toBe("2–5 km");
    expect(distanceBand(7)).toBe("5–10 km");
    expect(distanceBand(25)).toBe(">10 km");
    expect(distanceBand(null)).toBe("No mapped facility");
    expect(distanceBand(Infinity)).toBe("No mapped facility");
  });
});
