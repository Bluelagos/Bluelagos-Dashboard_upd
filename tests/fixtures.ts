import { mapRecord } from "@/lib/analytics";
import { parseSourceRecord } from "@/lib/validation";
import type { Community } from "@/lib/domain";

export function community(overrides: Partial<Community> = {}): Community {
  const parsed = parseSourceRecord({
    id: 1,
    community_name: "Test Community",
    lga: "Epe",
    latitude: 6.5,
    longitude: 3.8,
  });
  if (!parsed.record) throw new Error("Test fixture could not be parsed");
  return { ...mapRecord(parsed.record), ...overrides };
}
