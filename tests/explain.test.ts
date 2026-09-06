import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EXPLAIN, SOURCE_LABEL, type Explainer } from "@/lib/explain";

const entries = Object.entries(EXPLAIN) as Array<[string, Explainer]>;

/**
 * The two-level rule: the visible label is plain English, and the technical
 * vocabulary is only allowed to appear behind an info drawer. These tests keep
 * that contract enforceable rather than aspirational.
 */
const TECHNICAL_TERMS = [
  "haversine",
  "geojson",
  "h3",
  "mcda",
  "dbscan",
  "euclidean",
  "point-in-polygon",
  "centroid",
  "medoid",
  "isochrone",
  "polygon",
  "great-circle",
];

describe("metric explanations", () => {
  it("covers every explainer with the five required parts", () => {
    for (const [key, data] of entries) {
      expect(data.title, key).toBeTruthy();
      expect(data.summary, key).toBeTruthy();
      expect(data.why, key).toBeTruthy();
      expect(data.methodPlain, key).toBeTruthy();
      expect(SOURCE_LABEL[data.source], key).toBeTruthy();
    }
  });

  it("keeps the plain layer free of technical vocabulary", () => {
    for (const [key, data] of entries) {
      const plain = `${data.title} ${data.hint ?? ""} ${data.summary} ${data.why} ${data.methodPlain}`.toLowerCase();
      for (const term of TECHNICAL_TERMS) {
        expect(plain, `${key} plain text should not mention "${term}"`).not.toContain(term);
      }
    }
  });

  it("states one thing per sentence in the summary and the why", () => {
    for (const [key, data] of entries) {
      expect(data.summary.split(". ").length, `${key} summary`).toBeLessThanOrEqual(2);
      expect(data.why.split(". ").length, `${key} why`).toBeLessThanOrEqual(2);
    }
  });

  it("points every methodology link at a section that exists", () => {
    const page = readFileSync("app/methodology/page.tsx", "utf8");
    for (const [key, data] of entries) {
      if (!data.link) continue;
      const [, anchor] = data.link.href.split("#");
      expect(anchor, `${key} has a link without an anchor`).toBeTruthy();
      expect(page, `methodology page is missing section #${anchor}`).toContain(`id="${anchor}"`);
    }
  });

  it("labels the source of every figure", () => {
    const kinds = new Set(entries.map(([, data]) => data.source));
    for (const kind of kinds) expect(Object.keys(SOURCE_LABEL)).toContain(kind);
  });
});
