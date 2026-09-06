import { describe, expect, it } from "vitest";
import register from "@/data/report-register.json";
import { districtForLga, normalizeLga } from "@/lib/geography";
import { parseDashboardFilters } from "@/lib/filters";

describe("district source of truth", () => {
  it("matches every LGA represented in the baseline register", () => {
    for (const row of register)
      expect(districtForLga(row.lga), row.lga).toBe(row.district);
  });
  it.each([
    ["Kosofe", "Lagos East"],
    ["Ikorodu", "Lagos East"],
    ["Mushin", "Lagos West"],
    ["Surulere", "Lagos Central"],
    ["Somolu", "Lagos East"],
    ["Shomolu", "Lagos East"],
    ["Bariga", "Lagos East"],
  ])("maps %s to %s", (lga, district) =>
    expect(districtForLga(lga)).toBe(district),
  );
  it("normalizes common aliases", () => {
    expect(normalizeLga(" Ifako_Ijaiye ")).toBe("IFAKO-IJAIYE");
    expect(normalizeLga("Oshodi/Isolo")).toBe("OSHODI-ISOLO");
    expect(normalizeLga("Shomolu")).toBe("SOMOLU");
  });
});

describe("dashboard filter parser", () => {
  it("returns defaults for missing values", () =>
    expect(parseDashboardFilters({})).toEqual({}));
  it("accepts and trims normal values", () =>
    expect(
      parseDashboardFilters({ q: " Epe ", district: "east", risk: "critical" }),
    ).toEqual({ q: "Epe", district: "Lagos East", risk: "critical" }));
  it("takes the first repeated value deterministically", () =>
    expect(
      parseDashboardFilters({
        q: ["first", "second"],
        risk: ["bad", "critical"],
      }),
    ).toEqual({ q: "first" }));
  it("ignores invalid enum values", () =>
    expect(
      parseDashboardFilters({ district: "north", risk: "yes", need: "urgent" }),
    ).toEqual({}));
  it("ignores empty and whitespace strings", () =>
    expect(parseDashboardFilters({ q: "  ", lga: " " })).toEqual({}));
  it("caps long searches", () =>
    expect(parseDashboardFilters({ q: "x".repeat(500) }).q).toHaveLength(120));
  it("preserves safe special characters", () =>
    expect(parseDashboardFilters({ q: "O'Brien & Sons" }).q).toBe(
      "O'Brien & Sons",
    ));
  it("normalizes and validates available LGAs", () => {
    expect(parseDashboardFilters({ lga: "shomolu" }, ["Somolu"]).lga).toBe(
      "SOMOLU",
    );
    expect(
      parseDashboardFilters({ lga: "unknown" }, ["Epe"]).lga,
    ).toBeUndefined();
  });
});
