import { describe, expect, it } from "vitest";
import {
  aggregateKnown,
  baselinePriorityScore,
  filterCommunities,
  isCritical,
  mapRecord,
  needFlags,
} from "@/lib/analytics";
import { parseSourceRecord } from "@/lib/validation";
import { community } from "./fixtures";

describe("analytics", () => {
  it("calculates the documented priority score", () =>
    expect(
      baselinePriorityScore(
        community({
          mpi: 4,
          diseaseRisk: "CRITICAL",
          strandingStatus: "HIGHLY_STRANDED",
          erosionRisk: "CRITICAL_DISPLACEMENT",
          disasterPreparednessVoid: true,
          sanitationDeficit: true,
          floodHazard: 5,
        }),
      ),
    ).toBe(36));
  it("scores ordered disease and stranding severity monotonically", () => {
    const score = (
      diseaseRisk: string | null,
      strandingStatus: string | null,
    ) =>
      baselinePriorityScore(
        community({
          mpi: null,
          diseaseRisk,
          strandingStatus,
          erosionRisk: null,
          disasterPreparednessVoid: null,
          sanitationDeficit: null,
          floodHazard: null,
        }),
      );
    expect(score("HIGH", "STRANDED")).toBeGreaterThan(
      score("MODERATE", "VULNERABLE"),
    );
  });
  it("applies every Critical Alert hard stop", () => {
    expect(isCritical(community({ diseaseRisk: "CRITICAL" }))).toBe(true);
    expect(
      isCritical(
        community({ diseaseRisk: null, strandingStatus: "HIGHLY_STRANDED" }),
      ),
    ).toBe(true);
    expect(
      isCritical(
        community({ diseaseRisk: null, strandingStatus: null, mpi: 4 }),
      ),
    ).toBe(true);
    expect(
      isCritical(
        community({
          diseaseRisk: null,
          strandingStatus: null,
          mpi: null,
          erosionRisk: "CRITICAL_DISPLACEMENT",
        }),
      ),
    ).toBe(true);
  });
  it("does not turn missing conditions into need flags", () =>
    expect(
      needFlags(
        community({ mpi: null, floodHazard: null, sanitationDeficit: null }),
      ),
    ).not.toContain("High flood hazard"));
  it("preserves valid numeric zero", () =>
    expect(mapRecord(record({ estimated_population: 0 })).population).toBe(0));
  it("rejects whitespace and negative population rather than coercing zero", () => {
    expect(
      mapRecord(record({ estimated_population: "   " })).population,
    ).toBeNull();
    expect(
      mapRecord(record({ estimated_population: -1 })).population,
    ).toBeNull();
  });
  it("validates MPI and flood score domains", () => {
    const mapped = mapRecord(
      record({
        multi_dimensional_poverty_index: 6,
        flood_health_hazard_score: -1,
      }),
    );
    expect(mapped.mpi).toBeNull();
    expect(mapped.floodHazard).toBeNull();
    expect(mapped.validationIssues.length).toBeGreaterThanOrEqual(2);
  });
  it("rejects coordinates outside the Lagos operating envelope", () => {
    const mapped = mapRecord(record({ latitude: 51.5, longitude: -0.1 }));
    expect(mapped.hasLocation).toBe(false);
    expect(
      mapped.validationIssues.some(
        (issue) => issue.code === "invalid_coordinates",
      ),
    ).toBe(true);
  });
  it("nulls invalid categorical values and booleans while flagging them", () => {
    const mapped = mapRecord(
      record({
        cholera_outbreak_risk: "impossible",
        raw_sanitation_deficit: "perhaps",
      }),
    );
    expect(mapped.diseaseRisk).toBeNull();
    expect(mapped.sanitationDeficit).toBeNull();
    expect(
      mapped.validationIssues.filter((issue) => issue.code === "invalid_value"),
    ).toHaveLength(2);
  });
  it("returns unavailable when all aggregate values are missing", () =>
    expect(
      aggregateKnown([community({ population: null })], "population"),
    ).toEqual({
      value: null,
      knownCount: 0,
      unknownCount: 1,
      completeness: 0,
    }));
  it("returns partial aggregate metadata", () =>
    expect(
      aggregateKnown(
        [
          community({ id: 1, population: 0 }),
          community({ id: 2, population: 12 }),
          community({ id: 3, population: null }),
        ],
        "population",
      ),
    ).toEqual({ value: 12, knownCount: 2, unknownCount: 1, completeness: 67 }));
  it("filters only for the explicit critical enum", () =>
    expect(
      filterCommunities([community({ critical: false })], { risk: "critical" }),
    ).toHaveLength(0));
});

function record(overrides: Record<string, unknown>) {
  const result = parseSourceRecord({
    id: 1,
    community_name: "Test",
    lga: "Epe",
    ...overrides,
  });
  if (!result.record) throw new Error("Fixture parsing failed");
  return result.record;
}
