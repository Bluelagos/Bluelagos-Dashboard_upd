import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/data";
import { mapRecord } from "@/lib/analytics";
import { parseSourceRecord, SourceRecordSchema } from "@/lib/validation";

const records = (count: number) =>
  Array.from({ length: count }, (_, id) => ({ id }));
const paged = (count: number, failAt = -1) =>
  vi.fn(async (from: number, to: number) =>
    failAt >= from && failAt <= to
      ? { data: null, count, error: { message: "network failure" } }
      : { data: records(count).slice(from, to + 1), count, error: null },
  );

describe("Supabase pagination", () => {
  it.each([134, 1000, 1001, 2450])("fetches all %i records", async (count) => {
    const result = await fetchAllPages(paged(count), 500);
    expect(result.records).toHaveLength(count);
    expect(result.count).toBe(count);
  });
  it("uses inclusive, non-overlapping ranges", async () => {
    const fetcher = paged(1001);
    await fetchAllPages(fetcher, 500);
    expect(fetcher.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });
  it("surfaces a mid-page API failure", async () =>
    await expect(fetchAllPages(paged(1200, 700), 500)).rejects.toThrow(
      "page 2",
    ));
  it("rejects malformed page data", async () =>
    await expect(
      fetchAllPages(async () => ({ data: null, count: 1, error: null })),
    ).rejects.toThrow("malformed response"));
});

describe("remote row validation", () => {
  it("uses Zod for required identity validation", () =>
    expect(SourceRecordSchema.safeParse({ id: "bad" }).success).toBe(false));
  it("accepts a numeric string ID and trims names", () =>
    expect(
      parseSourceRecord({ id: "7", community_name: " Eredo " }).record,
    ).toMatchObject({ id: 7, community_name: "Eredo" }));
  it.each([null, "", false, 0])("rejects coercible but invalid ID %s", (id) =>
    expect(
      parseSourceRecord({ id, community_name: "Eredo" }).record,
    ).toBeNull(),
  );
  it("accepts one valid name when the alternate is blank", () =>
    expect(
      parseSourceRecord({ id: 1, community_name: "Eredo", final_name: " " })
        .record,
    ).toMatchObject({ community_name: "Eredo", final_name: null }));
  it("rejects rows without a usable name", () =>
    expect(
      parseSourceRecord({ id: 1, community_name: " " }).record,
    ).toBeNull());
  it("keeps the row but flags malformed optional text", () => {
    const result = parseSourceRecord({
      id: 1,
      community_name: "Eredo",
      lga: 42,
    });
    expect(result.record).not.toBeNull();
    expect(result.issues[0].field).toBe("lga");
  });
  it("rejects non-HTTPS survey image URLs without dropping the row", () => {
    const result = parseSourceRecord({
      id: 1,
      community_name: "Eredo",
      survey_image_url: "javascript:alert(1)",
    });
    expect(result.record?.survey_image_url).toBeNull();
    expect(
      result.issues.some((issue) => issue.field === "survey_image_url"),
    ).toBe(true);
  });
  it("prefers authoritative database district and flags a fallback conflict", () => {
    const parsed = parseSourceRecord({
      id: 1,
      community_name: "Eredo",
      lga: "Epe",
      senatorial_district: "Lagos West",
    });
    if (!parsed.record) throw new Error("Fixture parsing failed");
    const mapped = mapRecord(parsed.record);
    expect(mapped.district).toBe("Lagos West");
    expect(
      mapped.validationIssues.some(
        (issue) => issue.code === "district_conflict",
      ),
    ).toBe(true);
  });
});
