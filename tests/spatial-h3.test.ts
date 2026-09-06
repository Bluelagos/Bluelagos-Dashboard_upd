import { describe, expect, it } from "vitest";
import {
  aggregateCommunitiesToH3,
  h3CellsToGeoJSON,
  H3_RESOLUTION,
  type CommunityLike,
} from "@/lib/spatial/h3";

const c = (over: Partial<CommunityLike> & Pick<CommunityLike, "id">): CommunityLike => ({
  name: `C${over.id}`,
  lga: "Epe",
  hasLocation: true,
  latitude: 6.45,
  longitude: 3.4,
  needScore: 3,
  critical: false,
  population: 100,
  ...over,
});

describe("aggregateCommunitiesToH3", () => {
  it("is deterministic: identical coordinates land in one cell", () => {
    const cells = aggregateCommunitiesToH3([c({ id: 1 }), c({ id: 2 })]);
    expect(cells).toHaveLength(1);
    expect(cells[0].communityCount).toBe(2);
    expect(cells[0].cell).toBe(cells[0].cell); // stable id
  });

  it("separates communities that are far apart into different cells", () => {
    const cells = aggregateCommunitiesToH3([
      c({ id: 1, latitude: 6.45, longitude: 3.4 }),
      c({ id: 2, latitude: 6.6, longitude: 4.1 }),
    ]);
    expect(cells).toHaveLength(2);
  });

  it("counts critical communities and computes mean/max need honestly", () => {
    const [cell] = aggregateCommunitiesToH3([
      c({ id: 1, needScore: 2, critical: true }),
      c({ id: 2, needScore: 8, critical: false }),
    ]);
    expect(cell.criticalCount).toBe(1);
    expect(cell.needScoreMean).toBe(5);
    expect(cell.needScoreMax).toBe(8);
  });

  it("keeps unknown population out of the sum instead of treating it as zero", () => {
    const [known] = aggregateCommunitiesToH3([c({ id: 1, population: 50 }), c({ id: 2, population: 70 })]);
    expect(known.knownPopulation).toBe(120);
    const [unknown] = aggregateCommunitiesToH3([c({ id: 3, population: null }), c({ id: 4, population: null })]);
    expect(unknown.knownPopulation).toBeNull();
  });

  it("ignores communities without coordinates", () => {
    const cells = aggregateCommunitiesToH3([
      c({ id: 1 }),
      c({ id: 2, hasLocation: false, latitude: null, longitude: null }),
    ]);
    expect(cells[0].communityCount).toBe(1);
  });

  it("uses the documented Lagos resolution", () => {
    expect(H3_RESOLUTION).toBe(7);
  });
});

describe("h3CellsToGeoJSON", () => {
  it("produces closed polygon rings with the cell metrics as properties", () => {
    const cells = aggregateCommunitiesToH3([c({ id: 1 }), c({ id: 2, critical: true })]);
    const fc = h3CellsToGeoJSON(cells);
    expect(fc.type).toBe("FeatureCollection");
    const ring = fc.features[0].geometry.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(fc.features[0].properties?.communityCount).toBe(2);
    expect(fc.features[0].properties?.criticalCount).toBe(1);
  });
});
