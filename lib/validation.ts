import { z } from "zod";
import type { DataQualityIssue, SourceRecord } from "./domain";

export const SourceRecordSchema = z
  .object({
    id: z.preprocess(
      (value) =>
        typeof value === "string" && /^\d+$/.test(value.trim())
          ? Number(value)
          : value,
      z.number().int().positive(),
    ),
    community_name: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? null : value),
      z.string().trim().min(1).nullable().optional(),
    ),
    final_name: z.preprocess(
      (value) => (typeof value === "string" && !value.trim() ? null : value),
      z.string().trim().min(1).nullable().optional(),
    ),
  })
  .catchall(z.unknown())
  .refine((row) => row.community_name || row.final_name, {
    message: "A community name or final name is required",
  });

const textFields = [
  "community_head",
  "lga",
  "senatorial_district",
  "pulled_senatorial_district",
  "primary_visit_route",
  "primary_occupation",
  "priority_needed_amenities",
  "survey_image_url",
  "nearest_hospital_name",
  "cholera_outbreak_risk",
  "healthcare_stranding_status",
  "erosion_displacement_threat",
  "digital_exclusion_status",
  "post_harvest_loss_risk",
  "energy_poverty_status",
  "landing_jetty_condition",
  "nearest_neighbor_name",
] as const;

export function parseSourceRecord(input: unknown): {
  record: SourceRecord | null;
  issues: DataQualityIssue[];
} {
  const parsed = SourceRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      record: null,
      issues: [
        {
          code: "invalid_record",
          message: parsed.error.issues.map((issue) => issue.message).join("; "),
        },
      ],
    };
  }
  const row = parsed.data;
  const issues: DataQualityIssue[] = [];
  const normalized: Record<string, unknown> = { ...row };
  for (const field of textFields) {
    const value = row[field];
    if (value === null || value === undefined || value === "")
      normalized[field] = null;
    else if (typeof value === "string")
      normalized[field] = value.trim() || null;
    else {
      normalized[field] = null;
      issues.push({
        code: "invalid_value",
        recordId: row.id,
        field,
        message: `${field} must be text`,
      });
    }
  }
  if (typeof normalized.survey_image_url === "string") {
    try {
      const url = new URL(normalized.survey_image_url);
      if (url.protocol !== "https:") throw new Error("protocol");
    } catch {
      normalized.survey_image_url = null;
      issues.push({ code: "invalid_value", recordId: row.id, field: "survey_image_url", message: "survey_image_url must be a valid HTTPS URL" });
    }
  }
  return {
    record: {
      ...normalized,
      id: row.id,
      community_name: row.community_name ?? null,
      final_name: row.final_name ?? null,
    } as SourceRecord,
    issues,
  };
}
