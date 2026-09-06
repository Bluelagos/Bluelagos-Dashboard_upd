import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs helper module, no type declarations
import * as imp from "../scripts/import-blue-lagos-csv.mjs";

const {
  parseCsv,
  normalizeLga,
  normalizeName,
  resolveFieldMap,
  classifyField,
  guardSubcount,
  buildMatch,
  levenshtein,
  toNumber,
} = imp as {
  parseCsv: (t: string) => {
    header: string[];
    objects: Array<Record<string, string> & { __row: number }>;
    delimiter: string;
    hadBom: boolean;
    emptyRowIndexes: number[];
    rawDataRowCount: number;
  };
  normalizeLga: (v: string) => string;
  normalizeName: (v: unknown) => string;
  resolveFieldMap: (h: string[], cols: Record<string, string | null>) => Record<string, string>;
  classifyField: (
    t: string,
    sb: unknown,
    csv: unknown,
  ) => { kind: string; csv?: unknown; sb?: unknown; note?: string };
  guardSubcount: (
    t: string,
    csvRaw: unknown,
    rowPop: number | null,
    cls: { kind: string },
  ) => { kind: string; note?: string; csv?: unknown };
  levenshtein: (a: string, b: string) => number;
  buildMatch: (
    csv: Array<Record<string, string>>,
    sb: Array<Record<string, unknown>>,
    cols: Record<string, string | null>,
  ) => { results: Array<{ status: string; sb: Record<string, unknown> | null }>; supabaseOnly: Array<Record<string, unknown>> };
  toNumber: (v: unknown) => number | null;
};

const sbRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  community_name: "Iworo",
  final_name: "Iworo",
  lga: "badagry",
  longitude: 3.01,
  latitude: 6.41,
  estimated_population: null,
  ...over,
});

describe("parseCsv", () => {
  it("parses a comma file with a header and 1-based row numbers", () => {
    const { header, objects, delimiter } = parseCsv("Name,LGA,Pop\nIworo,Badagry,3000\n");
    expect(header).toEqual(["Name", "LGA", "Pop"]);
    expect(delimiter).toBe(",");
    expect(objects[0]).toMatchObject({ Name: "Iworo", LGA: "Badagry", Pop: "3000", __row: 2 });
  });

  it("strips a BOM and detects a semicolon delimiter", () => {
    const { header, delimiter, hadBom } = parseCsv("﻿Name;LGA\nIworo;Badagry\n");
    expect(hadBom).toBe(true);
    expect(delimiter).toBe(";");
    expect(header).toEqual(["Name", "LGA"]);
  });

  it("keeps quoted commas and quoted newlines inside one field", () => {
    const { objects } = parseCsv('Name,Note\n"A, B","line1\nline2"\n');
    expect(objects[0].Name).toBe("A, B");
    expect(objects[0].Note).toBe("line1\nline2");
  });

  it("skips fully empty rows and records their index", () => {
    const { objects, emptyRowIndexes } = parseCsv("Name,LGA\nIworo,Badagry\n,\nAjido,Badagry\n");
    expect(objects.map((o) => o.Name)).toEqual(["Iworo", "Ajido"]);
    expect(emptyRowIndexes.length).toBe(1);
  });
});

describe("normalisation", () => {
  it("normalises LGA separators and known aliases", () => {
    expect(normalizeLga("amuwo_odofin")).toBe("AMUWO ODOFIN");
    expect(normalizeLga("Ibeju-Lekki")).toBe("IBEJU LEKKI");
    expect(normalizeLga("  eti/osa ")).toBe("ETI OSA");
  });
  it("normalises community names to a comparable token string", () => {
    expect(normalizeName("Sagbokodji  Community")).toBe("sagbokodji community");
    expect(normalizeName("Oko-Abe")).toBe("oko abe");
  });
});

describe("resolveFieldMap", () => {
  it("maps population and coordinates without collision", () => {
    const map = resolveFieldMap(
      ["Community Name", "LGA", "Estimated Population", "Longitude", "Latitude"],
      { id: null, name: "Community Name", lga: "LGA", district: null, cluster: null },
    );
    expect(map.estimated_population).toBe("Estimated Population");
    expect(map.longitude).toBe("Longitude");
    expect(map.latitude).toBe("Latitude");
  });
  it("never maps the reserved identity columns as a value source", () => {
    const map = resolveFieldMap(
      ["name", "lga", "population"],
      { id: null, name: "name", lga: "lga", district: null, cluster: null },
    );
    expect(Object.values(map)).not.toContain("name");
    expect(map.estimated_population).toBe("population");
  });
  it("does not invent a mapping when no header matches", () => {
    const map = resolveFieldMap(
      ["Community Name", "LGA"],
      { id: null, name: "Community Name", lga: "LGA", district: null, cluster: null },
    );
    expect(map.estimated_population).toBeUndefined();
  });
});

describe("classifyField", () => {
  it("safe_fill when Supabase is null and CSV is a valid number", () => {
    expect(classifyField("estimated_population", null, "4100")).toEqual({ kind: "safe_fill", csv: 4100 });
  });
  it("verify_equal when both present and equal", () => {
    expect(classifyField("estimated_population", 3000, "3000").kind).toBe("verify_equal");
  });
  it("conflict when both present and different — never overwrites", () => {
    expect(classifyField("estimated_population", 5000, "5200").kind).toBe("conflict");
  });
  it("invalid_csv for a negative population, and it is not coerced to zero", () => {
    const r = classifyField("estimated_population", null, "-5");
    expect(r.kind).toBe("invalid_csv");
    expect(r.csv).toBe("-5");
  });
  it("invalid_csv for an impossible latitude", () => {
    expect(classifyField("latitude", null, "88").kind).toBe("invalid_csv");
  });
  it("ignores a blank CSV cell rather than nulling Supabase", () => {
    expect(classifyField("estimated_population", 3000, "").kind).toBe("ignored_blank_csv");
    expect(classifyField("estimated_population", null, "n/a").kind).toBe("ignored_blank_csv");
  });
});

describe("buildMatch", () => {
  const cols = { id: null, name: "Name", lga: "LGA", district: null, cluster: null };

  it("matches on exact normalised name + LGA", () => {
    const { results } = buildMatch([{ Name: "Iworo", LGA: "Badagry" }], [sbRow()], cols);
    expect(results[0].status).toBe("exact_name_lga_match");
    expect(results[0].sb?.id).toBe(1);
  });

  it("matches a normalised name variant to the same community", () => {
    const { results } = buildMatch([{ Name: "iworo  ", LGA: "badagry" }], [sbRow()], cols);
    expect(results[0].sb?.id).toBe(1);
  });

  it("flags a name-only hit in a different LGA as probable_match_review", () => {
    const { results } = buildMatch([{ Name: "Iworo", LGA: "Epe" }], [sbRow()], cols);
    expect(results[0].status).toBe("probable_match_review");
  });

  it("reports a CSV-only community and does not fabricate a match", () => {
    const { results } = buildMatch([{ Name: "Brand New Place", LGA: "Epe" }], [sbRow()], cols);
    expect(results[0].status).toBe("csv_only");
    expect(results[0].sb).toBeNull();
  });

  it("reports Supabase-only communities that the CSV never mentions", () => {
    const { supabaseOnly } = buildMatch(
      [{ Name: "Iworo", LGA: "Badagry" }],
      [sbRow(), sbRow({ id: 2, community_name: "Ajido", final_name: "Ajido" })],
      cols,
    );
    expect(supabaseOnly.map((r) => r.id)).toEqual([2]);
  });

  it("prefers a stable id over the name when an id column is present", () => {
    const { results } = buildMatch(
      [{ id: "1", Name: "Totally Different", LGA: "Nowhere" }],
      [sbRow()],
      { ...cols, id: "id" },
    );
    expect(results[0].status).toBe("exact_id_match");
    expect(results[0].sb?.id).toBe(1);
  });

  it("does not match one Supabase row to two CSV rows", () => {
    const { results } = buildMatch(
      [{ Name: "Iworo", LGA: "Badagry" }, { Name: "Iworo", LGA: "Badagry" }],
      [sbRow()],
      cols,
    );
    const matched = results.filter((r) => r.sb);
    expect(matched.length).toBe(1);
  });
});

describe("guardSubcount", () => {
  const ok = { kind: "safe_fill" as const };
  it("passes a sub-count that is within the population", () => {
    expect(guardSubcount("estimated_number_of_women", "35", 50, ok)).toBe(ok);
  });
  it("rejects women greater than the community population as corrupted", () => {
    const r = guardSubcount("estimated_number_of_women", "7495", 312, ok);
    expect(r.kind).toBe("invalid_csv");
    expect(r.note).toMatch(/exceeds community population/);
  });
  it("rejects youth greater than population", () => {
    expect(guardSubcount("estimated_number_of_youth", "3747", 312, ok).kind).toBe("invalid_csv");
  });
  it("leaves non-subcount fields (population itself) untouched", () => {
    expect(guardSubcount("estimated_population", "99999", 312, ok)).toBe(ok);
  });
  it("does nothing when the population is unknown", () => {
    expect(guardSubcount("estimated_number_of_women", "500", null, ok)).toBe(ok);
  });
});

describe("levenshtein", () => {
  it("is 0 for equal strings and 1 for a single-letter change", () => {
    expect(levenshtein("tafi", "tafi")).toBe(0);
    expect(levenshtein("tafi", "taffi")).toBe(1);
    expect(levenshtein("takwa bay", "tarkwa bay")).toBe(1);
  });
});

describe("toNumber", () => {
  it("parses thousands separators and rejects junk without returning zero", () => {
    expect(toNumber("12,500")).toBe(12500);
    expect(toNumber("abc")).toBeNull();
    expect(toNumber("")).toBeNull();
  });
});
