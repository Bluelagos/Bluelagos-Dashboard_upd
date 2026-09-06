import { describe, expect, it } from "vitest";
import { circle } from "@turf/turf";
import { circleFeature } from "@/lib/geo-circle";

/**
 * The browser bundle no longer imports Turf. These tests pin the local
 * implementation to Turf's output so the rendered catchment ring stays
 * geometrically identical to what the server-side analysis assumes.
 */
describe("circleFeature", () => {
  const centres: Array<[number, number]> = [
    [3.38, 6.45], // Lagos
    [4.36, 6.71], // eastern edge of the state
    [2.67, 6.34], // western edge
  ];

  it("matches turf.circle to within a metre at every vertex", () => {
    for (const centre of centres) {
      for (const radiusKm of [1, 5, 10, 20]) {
        const mine = circleFeature(centre, radiusKm);
        const theirs = circle(centre, radiusKm, { units: "kilometers", steps: 80 });
        const a = mine.geometry.coordinates[0];
        const b = theirs.geometry.coordinates[0];
        expect(a).toHaveLength(b.length);
        for (let index = 0; index < a.length; index += 1) {
          // ~1e-5 degrees is roughly one metre at this latitude.
          expect(a[index][0]).toBeCloseTo(b[index][0], 5);
          expect(a[index][1]).toBeCloseTo(b[index][1], 5);
        }
      }
    }
  });

  it("returns a closed ring", () => {
    const ring = circleFeature([3.38, 6.45], 5).geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("produces the requested number of segments", () => {
    expect(circleFeature([3.38, 6.45], 5, 24).geometry.coordinates[0]).toHaveLength(25);
  });

  it("records the radius it was built with", () => {
    expect(circleFeature([3.38, 6.45], 7.5).properties).toEqual({ radiusKm: 7.5 });
  });

  it("keeps longitudes inside the valid range near the antimeridian", () => {
    const ring = circleFeature([179.99, 0], 50).geometry.coordinates[0];
    for (const [longitude] of ring) {
      expect(longitude).toBeGreaterThanOrEqual(-180);
      expect(longitude).toBeLessThanOrEqual(180);
    }
  });
});
