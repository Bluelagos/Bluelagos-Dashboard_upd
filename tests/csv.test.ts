import { describe, expect, it } from "vitest";
import { csvCell, createCsv } from "@/lib/csv";

describe("safe CSV cells", () => {
  it.each(["=SUM(A1:A2)", "+cmd", "-cmd", "@evil"])(
    "neutralizes formula text %s",
    (value) => expect(csvCell(value)).toBe(`"'${value}"`),
  );
  it("protects the first meaningful character", () =>
    expect(csvCell("  =evil")).toBe('"\'  =evil"'));
  it("does not corrupt negative typed numbers", () =>
    expect(csvCell(-42, "number")).toBe('"-42"'));
  it("preserves normal text", () =>
    expect(csvCell("Normal community")).toBe('"Normal community"'));
  it("escapes quotes and commas", () =>
    expect(csvCell('"quoted,value"')).toBe('"""quoted,value"""'));
  it("quotes multiline text", () =>
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"'));
  it("creates headers and rows", () =>
    expect(
      createCsv(
        [{ name: "Epe", count: 0 }],
        [
          { key: "name", label: "Name" },
          { key: "count", label: "Count", type: "number" },
        ],
      ),
    ).toBe('"Name","Count"\r\n"Epe","0"'));
});
