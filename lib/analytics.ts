import { CATEGORY_COLORS } from "./constants";
import { districtForLga, normalizeDistrict, normalizeLga } from "./geography";
import type {
  Community,
  DataQualityIssue,
  FilterState,
  NeedCategory,
  NullableAggregate,
  SourceRecord,
} from "./domain";

const categoricalDomains: Record<string, ReadonlySet<string>> = {
  cholera_outbreak_risk: new Set(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
  healthcare_stranding_status: new Set([
    "ACCESSIBLE",
    "VULNERABLE",
    "STRANDED",
    "HIGHLY_STRANDED",
  ]),
  erosion_displacement_threat: new Set([
    "LOW",
    "MODERATE",
    "HIGH",
    "CRITICAL_DISPLACEMENT",
  ]),
  digital_exclusion_status: new Set(["CONNECTED", "LIMITED", "EXCLUDED"]),
  post_harvest_loss_risk: new Set(["LOW", "MODERATE", "HIGH", "SEVERE"]),
  energy_poverty_status: new Set(["ENERGY_SECURE", "ENERGY_POOR"]),
};
const diseaseWeights: Record<string, number> = {
  LOW: 0,
  MODERATE: 2,
  HIGH: 4,
  CRITICAL: 6,
};
const strandingWeights: Record<string, number> = {
  ACCESSIBLE: 0,
  VULNERABLE: 2,
  STRANDED: 4,
  HIGHLY_STRANDED: 6,
};
const LAGOS_ENVELOPE = {
  minLatitude: 6,
  maxLatitude: 7,
  minLongitude: 2.5,
  maxLongitude: 4.5,
};

const numberOrNull = (value: unknown): number | null => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  )
    return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanOrNull = (value: unknown): boolean | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value === true || value === "t" || value === "true" || value === 1)
    return true;
  if (value === false || value === "f" || value === "false" || value === 0)
    return false;
  return null;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function categoryOf(value: string | null): NeedCategory {
  if (!value) return "Unclassified";
  const text = value.toLowerCase();
  if (/water|borehole|drain|toilet|sanit/.test(text))
    return "Water & Sanitation";
  if (/road|bridge|transformer|light|solar|power|jetty/.test(text))
    return "Roads & Infrastructure";
  if (/hospital|health|clinic|drug|medi/.test(text)) return "Healthcare";
  if (/school|educat|teacher/.test(text)) return "Education";
  return "Civic Support";
}

export function isCritical(
  c: Pick<Community, "diseaseRisk" | "strandingStatus" | "mpi" | "erosionRisk">,
): boolean {
  return (
    c.diseaseRisk === "CRITICAL" ||
    c.strandingStatus === "HIGHLY_STRANDED" ||
    (c.mpi !== null && c.mpi >= 4) ||
    c.erosionRisk === "CRITICAL_DISPLACEMENT"
  );
}

export function needFlags(
  c: Omit<
    Community,
    "needFlags" | "needScore" | "priorityScore" | "critical" | "completeness"
  >,
): string[] {
  const flags: string[] = [];
  if (c.mpi !== null && c.mpi >= 4) flags.push("Extreme poverty");
  if (c.strandingStatus === "HIGHLY_STRANDED")
    flags.push("Highly stranded emergency access");
  if (c.sanitationDeficit === true) flags.push("Sanitation deficit");
  if (c.energyStatus === "ENERGY_POOR") flags.push("Energy poverty");
  if (c.digitalStatus === "EXCLUDED") flags.push("Digitally excluded");
  if (c.disasterPreparednessVoid === true)
    flags.push("Disaster preparedness void");
  if (c.erosionRisk === "CRITICAL_DISPLACEMENT")
    flags.push("Critical erosion displacement threat");
  if (c.floodHazard !== null && c.floodHazard >= 4)
    flags.push("High flood hazard");
  if (c.harvestRisk === "SEVERE") flags.push("Severe harvest risk");
  if (
    c.hasLocation &&
    c.nearestCommunityKm !== null &&
    c.nearestCommunityKm > 5
  )
    flags.push("Geographically isolated");
  return flags;
}

export function baselinePriorityScore(
  c: Pick<
    Community,
    | "mpi"
    | "diseaseRisk"
    | "strandingStatus"
    | "erosionRisk"
    | "disasterPreparednessVoid"
    | "sanitationDeficit"
    | "floodHazard"
  >,
): number {
  let score = (c.mpi ?? 0) * 2;
  score += c.diseaseRisk === null ? 0 : (diseaseWeights[c.diseaseRisk] ?? 0);
  score +=
    c.strandingStatus === null ? 0 : (strandingWeights[c.strandingStatus] ?? 0);
  if (c.erosionRisk === "CRITICAL_DISPLACEMENT") score += 5;
  if (c.disasterPreparednessVoid === true) score += 3;
  if (c.sanitationDeficit === true) score += 3;
  return score + (c.floodHazard ?? 0);
}

export function mapRecord(
  record: SourceRecord,
  cluster: string | null = null,
): Community {
  const issues: DataQualityIssue[] = [];
  const name = record.final_name || record.community_name || "Unnamed";
  const lga =
    typeof record.lga === "string" && record.lga.trim()
      ? normalizeLga(record.lga)
      : "Unknown";
  const numeric = (field: string, min = 0, max = Number.POSITIVE_INFINITY) => {
    const value = numberOrNull(record[field]);
    if (record[field] != null && value === null)
      issues.push({
        code: "invalid_value",
        recordId: record.id,
        field,
        message: `${field} is not numeric`,
      });
    if (value !== null && (value < min || value > max)) {
      issues.push({
        code: "invalid_value",
        recordId: record.id,
        field,
        message: `${field} is outside ${min}-${max}`,
      });
      return null;
    }
    return value;
  };
  const latitude = numeric("latitude", -90, 90);
  const longitude = numeric("longitude", -180, 180);
  const inLagos =
    latitude !== null &&
    longitude !== null &&
    latitude >= LAGOS_ENVELOPE.minLatitude &&
    latitude <= LAGOS_ENVELOPE.maxLatitude &&
    longitude >= LAGOS_ENVELOPE.minLongitude &&
    longitude <= LAGOS_ENVELOPE.maxLongitude;
  const hasLocation = inLagos && !(latitude === 0 && longitude === 0);
  if (latitude === null || longitude === null)
    issues.push({
      code: "missing_coordinates",
      recordId: record.id,
      message: "Valid latitude and longitude are required for mapping",
    });
  else if (latitude === 0 && longitude === 0)
    issues.push({
      code: "zero_coordinates",
      recordId: record.id,
      message: "Coordinates 0,0 are outside the Lagos operating area",
    });
  else if (!inLagos)
    issues.push({
      code: "invalid_coordinates",
      recordId: record.id,
      message:
        "Coordinates are outside the approved Lagos State validation envelope",
    });
  const sourceDistrict =
    normalizeDistrict(record.senatorial_district) ??
    normalizeDistrict(record.pulled_senatorial_district);
  const fallbackDistrict = districtForLga(lga);
  if (sourceDistrict && fallbackDistrict && sourceDistrict !== fallbackDistrict)
    issues.push({
      code: "district_conflict",
      recordId: record.id,
      field: "senatorial_district",
      message: `Database district ${sourceDistrict} conflicts with ${lga} fallback ${fallbackDistrict}`,
    });
  const category = (field: string) => {
    const value =
      typeof record[field] === "string"
        ? record[field]
            .trim()
            .toUpperCase()
            .replace(/[\s-]+/g, "_")
        : null;
    if (
      value &&
      categoricalDomains[field] &&
      !categoricalDomains[field].has(value)
    ) {
      issues.push({
        code: "invalid_value",
        recordId: record.id,
        field,
        message: `${value} is outside the documented ${field} domain`,
      });
      return null;
    }
    return value;
  };
  const boolean = (field: string) => {
    const value = booleanOrNull(record[field]);
    if (record[field] != null && value === null)
      issues.push({
        code: "invalid_value",
        recordId: record.id,
        field,
        message: `${field} is not a recognized boolean value`,
      });
    return value;
  };
  const base = {
    id: record.id,
    slug: `${slugify(name)}-${record.id}`,
    name,
    communityHead: record.community_head,
    lga,
    district: sourceDistrict ?? fallbackDistrict ?? "Unknown",
    latitude,
    longitude,
    hasLocation,
    population: numeric("estimated_population"),
    households:
      record.household_estimated_population == null
        ? null
        : String(record.household_estimated_population),
    voters: numeric("estimated_registered_voters"),
    women: numeric("estimated_number_of_women"),
    youth: numeric("estimated_number_of_youth"),
    route: record.primary_visit_route,
    occupation: record.primary_occupation,
    priorityRequest: record.priority_needed_amenities,
    needCategory: categoryOf(record.priority_needed_amenities),
    hospitalName: record.nearest_hospital_name,
    hospitalDistanceKm: numeric("dist_to_hospital_km"),
    diseaseRisk: category("cholera_outbreak_risk"),
    strandingStatus: category("healthcare_stranding_status"),
    mpi: numeric("multi_dimensional_poverty_index", 0, 5),
    erosionRisk: category("erosion_displacement_threat"),
    pregnanciesAtRisk: numeric("trapped_pregnant_women"),
    digitalStatus: category("digital_exclusion_status"),
    harvestRisk: category("post_harvest_loss_risk"),
    energyStatus: category("energy_poverty_status"),
    floodHazard: numeric("flood_health_hazard_score", 0, 5),
    sanitationDeficit: boolean("raw_sanitation_deficit"),
    disasterPreparednessVoid: boolean("disaster_preparedness_void"),
    jettyCondition: record.landing_jetty_condition,
    photoUrl: record.survey_image_url,
    nearestCommunityKm: numeric("nearest_neighbor_km"),
    nearestCommunityName: record.nearest_neighbor_name,
    communitiesWithin3Km: numeric("communities_within_3km"),
    density5Km: numeric("density_5km"),
    cbdDistanceKm: numeric("dist_to_cbd_km"),
    cluster,
    validationIssues: issues,
  } satisfies Omit<
    Community,
    "needFlags" | "needScore" | "priorityScore" | "critical" | "completeness"
  >;
  const flags = needFlags(base);
  const observed = [
    base.population,
    base.women,
    base.youth,
    base.mpi,
    base.floodHazard,
    base.diseaseRisk,
    base.strandingStatus,
    base.sanitationDeficit,
    base.energyStatus,
    base.digitalStatus,
    base.jettyCondition,
    hasLocation ? true : null,
  ];
  return {
    ...base,
    needFlags: flags,
    needScore: flags.length,
    priorityScore: baselinePriorityScore(base),
    critical: isCritical(base),
    completeness: Math.round(
      (observed.filter((v) => v !== null).length / observed.length) * 100,
    ),
  };
}

export function filterCommunities(
  rows: Community[],
  filters: FilterState,
): Community[] {
  const q = filters.q?.trim().toLowerCase();
  return rows.filter(
    (c) =>
      (!filters.district || c.district === filters.district) &&
      (!filters.lga || c.lga === filters.lga) &&
      (!filters.risk || c.critical) &&
      (!filters.need || c.needCategory === filters.need) &&
      (!q || `${c.name} ${c.lga} ${c.district}`.toLowerCase().includes(q)),
  );
}

export const aggregateKnown = (
  rows: Community[],
  key: "population" | "women" | "youth" | "voters" | "pregnanciesAtRisk",
): NullableAggregate => {
  const values = rows.map((row) => row[key]);
  const known = values.filter((value): value is number => value !== null);
  return {
    value: known.length ? known.reduce((sum, value) => sum + value, 0) : null,
    knownCount: known.length,
    unknownCount: rows.length - known.length,
    completeness: rows.length
      ? Math.round((known.length / rows.length) * 100)
      : 0,
  };
};
export const sumKnown = (
  rows: Community[],
  key: "population" | "women" | "youth" | "voters" | "pregnanciesAtRisk",
) => aggregateKnown(rows, key).value;
export const groupCount = (rows: Community[], key: keyof Community) =>
  rows.reduce<Record<string, number>>((groups, row) => {
    const value = row[key];
    const label =
      value == null ? "Unavailable" : String(value).replaceAll("_", " ");
    groups[label] = (groups[label] ?? 0) + 1;
    return groups;
  }, {});
export const formatNumber = (value: number | null | undefined) =>
  value == null ? "Unavailable" : new Intl.NumberFormat("en-NG").format(value);
export { CATEGORY_COLORS };
