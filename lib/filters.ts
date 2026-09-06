import { normalizeDistrict, normalizeLga } from "./geography";
import type { DashboardSearchParams, FilterState, NeedCategory } from "./domain";

const needs = new Set<NeedCategory>(["Water & Sanitation", "Roads & Infrastructure", "Healthcare", "Education", "Civic Support", "Unclassified"]);
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim();

export function parseDashboardFilters(params: DashboardSearchParams, availableLgas?: Iterable<string>): FilterState {
  const q = first(params.q)?.slice(0, 120);
  const district = normalizeDistrict(first(params.district));
  const rawLga = first(params.lga);
  const lga = rawLga ? normalizeLga(rawLga) : undefined;
  const allowedLgas = availableLgas ? new Set([...availableLgas].map(normalizeLga)) : null;
  const need = first(params.need);
  return {
    ...(q ? { q } : {}),
    ...(district ? { district } : {}),
    ...(lga && (!allowedLgas || allowedLgas.has(lga)) ? { lga } : {}),
    ...(params.risk !== undefined && first(params.risk) === "critical" ? { risk: "critical" as const } : {}),
    ...(need && needs.has(need as NeedCategory) ? { need: need as NeedCategory } : {}),
  };
}
