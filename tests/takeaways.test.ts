import { describe, expect, it } from "vitest";
import { community } from "./fixtures";
import {
  accessTakeaway,
  environmentTakeaway,
  healthTakeaway,
  overviewTakeaway,
  priorityTakeaway,
  topLgas,
} from "@/lib/takeaways";

/**
 * Takeaways are presented to senior decision-makers, so they must be strictly
 * derived from the data: the same input always produces the same sentence, and
 * an empty or unsupported input produces no sentence at all rather than a
 * speculative one.
 */
describe("page takeaways", () => {
  const rows = [
    community({ id: 1, name: "Alpha", lga: "Epe", critical: true, needScore: 7 }),
    community({ id: 2, name: "Beta", lga: "Epe", strandingStatus: "HIGHLY_STRANDED", needScore: 6 }),
    community({ id: 3, name: "Gamma", lga: "Ojo", needScore: 2 }),
  ];

  it("returns null rather than inventing a sentence when there is no data", () => {
    expect(overviewTakeaway([])).toBeNull();
    expect(priorityTakeaway([])).toBeNull();
    expect(environmentTakeaway([])).toBeNull();
    expect(accessTakeaway([])).toBeNull();
    expect(healthTakeaway([], [])).toBeNull();
  });

  it("is deterministic for the same input", () => {
    expect(overviewTakeaway(rows)).toBe(overviewTakeaway(rows));
    expect(priorityTakeaway(rows)).toBe(priorityTakeaway(rows));
  });

  it("names the LGA holding the most communities and the counts behind it", () => {
    const text = overviewTakeaway(rows);
    expect(text).toContain("Epe");
    expect(text).toContain("2 of 3");
    expect(text).toContain("1 community meets");
    expect(text).toMatch(/\.$/);
  });

  it("orders LGAs by count and breaks ties by name", () => {
    expect(topLgas(rows, 2)).toEqual([
      ["Epe", 2],
      ["Ojo", 1],
    ]);
  });

  it("omits the priority sentence when nothing reaches the threshold", () => {
    expect(priorityTakeaway([community({ needScore: 2 })])).toBeNull();
  });

  it("reports the highest-scoring community by name when one qualifies", () => {
    const text = priorityTakeaway(rows);
    expect(text).toContain("2 communities recorded five or more");
    expect(text).toContain("Alpha has the highest count at 7 of 10");
  });

  it("counts flood and erosion separately and reports the overlap", () => {
    const text = environmentTakeaway([
      community({ id: 1, floodHazard: 5, erosionRisk: "CRITICAL_DISPLACEMENT", lga: "Ojo" }),
      community({ id: 2, floodHazard: 4, lga: "Ojo" }),
      community({ id: 3, erosionRisk: "CRITICAL_DISPLACEMENT", lga: "Epe" }),
    ]);
    expect(text).toContain("2 communities rated their flood hazard");
    expect(text).toContain("2 reported erosion severe enough");
    expect(text).toContain("1 reported both");
  });

  it("summarises health overlap and long distances with the LGAs involved", () => {
    const text = healthTakeaway(
      [community({ id: 1, sanitationDeficit: true, strandingStatus: "HIGHLY_STRANDED" })],
      [
        { lga: "Badagry", distanceKm: 14 },
        { lga: "Ojo", distanceKm: 11 },
        { lga: "Epe", distanceKm: 2 },
      ],
    );
    expect(text).toContain("1 community reports");
    expect(text).toContain("2 sit more than 10 km");
    expect(text).toContain("Badagry and Ojo");
  });

  it("concentrates access constraints in the busiest LGAs", () => {
    const text = accessTakeaway([
      { lga: "Ojo", accessConstraintCount: 3, nearestOsmHealthKm: 9 },
      { lga: "Ojo", accessConstraintCount: 2, nearestOsmHealthKm: 4 },
      { lga: "Epe", accessConstraintCount: 2, nearestOsmHealthKm: 6 },
      { lga: "Epe", accessConstraintCount: 1, nearestOsmHealthKm: 1 },
    ]);
    expect(text).toBe(
      "3 communities face two or more access constraints at once, concentrated in Ojo and Epe.",
    );
  });
});
