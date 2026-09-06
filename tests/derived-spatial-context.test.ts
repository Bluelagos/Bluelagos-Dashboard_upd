import { describe, expect, it } from "vitest";
import derived from "@/data/spatial/derived/community-spatial-context.json";

describe("persisted community spatial context", () => {
  it("contains one row for every verified geolocated community", () => {
    expect(derived.metadata.community_count).toBe(93);
    expect(derived.communities).toHaveLength(93);
  });

  it("is deterministically ordered with unique community identifiers", () => {
    const ids = derived.communities.map((row) => row.community_id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("persists mapped health feature provenance and finite distance", () => {
    for (const row of derived.communities) {
      expect(row.nearest_health_feature_id).toMatch(/^(node|way|relation)\//);
      expect(row.nearest_health_source).toBe("OpenStreetMap mapped health facilities");
      expect(row.method).toBe("great-circle straight-line distance");
      expect(row.distance_km).toBeGreaterThanOrEqual(0);
    }
  });

  it("persists marine, waterway and H3 context without duplicating files", () => {
    for (const row of derived.communities) {
      expect(row.marine_access_distance_km).toBeGreaterThanOrEqual(0);
      expect(row.waterway_distance_km).toBeGreaterThanOrEqual(0);
      expect(row.h3_cell).toBeTruthy();
    }
  });

  it("uses the documented analytical health-distance bands", () => {
    const distances = derived.communities.map((row) => row.distance_km);
    expect([
      distances.filter((value) => value < 2).length,
      distances.filter((value) => value >= 2 && value < 5).length,
      distances.filter((value) => value >= 5 && value < 10).length,
      distances.filter((value) => value >= 10).length,
    ]).toEqual([33, 19, 14, 27]);
  });
});
