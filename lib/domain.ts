export type NullableNumber = number | null;
export type NeedCategory = "Water & Sanitation" | "Roads & Infrastructure" | "Healthcare" | "Education" | "Civic Support" | "Unclassified";
export type SenatorialDistrict = "Lagos Central" | "Lagos East" | "Lagos West";
export type QualityIssueCode = "invalid_record" | "invalid_value" | "missing_coordinates" | "invalid_coordinates" | "zero_coordinates" | "duplicate_coordinates" | "duplicate_id" | "duplicate_name_lga" | "district_conflict" | "count_mismatch";

export interface DataQualityIssue {
  code: QualityIssueCode;
  message: string;
  recordId?: number;
  field?: string;
}

export interface SourceRecord {
  [key: string]: unknown;
  id: number;
  community_name: string | null;
  final_name: string | null;
  community_head: string | null;
  lga: string | null;
  senatorial_district: string | null;
  pulled_senatorial_district: string | null;
  longitude: unknown;
  latitude: unknown;
  estimated_population: unknown;
  household_estimated_population: unknown;
  estimated_registered_voters: unknown;
  estimated_number_of_women: unknown;
  estimated_number_of_youth: unknown;
  primary_visit_route: string | null;
  primary_occupation: string | null;
  priority_needed_amenities: string | null;
  survey_image_url: string | null;
  nearest_hospital_name: string | null;
  dist_to_hospital_km: unknown;
  cholera_outbreak_risk: string | null;
  healthcare_stranding_status: string | null;
  multi_dimensional_poverty_index: unknown;
  erosion_displacement_threat: string | null;
  trapped_pregnant_women: unknown;
  digital_exclusion_status: string | null;
  post_harvest_loss_risk: string | null;
  energy_poverty_status: string | null;
  flood_health_hazard_score: unknown;
  raw_sanitation_deficit: unknown;
  disaster_preparedness_void: unknown;
  landing_jetty_condition: string | null;
  nearest_neighbor_km: unknown;
  density_5km: unknown;
  dist_to_cbd_km: unknown;
  nearest_neighbor_name: string | null;
  communities_within_3km: unknown;
}

export interface Community {
  id: number;
  slug: string;
  name: string;
  communityHead: string | null;
  lga: string;
  district: string;
  latitude: NullableNumber;
  longitude: NullableNumber;
  hasLocation: boolean;
  population: NullableNumber;
  households: string | null;
  voters: NullableNumber;
  women: NullableNumber;
  youth: NullableNumber;
  route: string | null;
  occupation: string | null;
  priorityRequest: string | null;
  needCategory: NeedCategory;
  hospitalName: string | null;
  hospitalDistanceKm: NullableNumber;
  diseaseRisk: string | null;
  strandingStatus: string | null;
  mpi: NullableNumber;
  erosionRisk: string | null;
  pregnanciesAtRisk: NullableNumber;
  digitalStatus: string | null;
  harvestRisk: string | null;
  energyStatus: string | null;
  floodHazard: NullableNumber;
  sanitationDeficit: boolean | null;
  disasterPreparednessVoid: boolean | null;
  jettyCondition: string | null;
  photoUrl: string | null;
  nearestCommunityKm: NullableNumber;
  nearestCommunityName: string | null;
  communitiesWithin3Km: NullableNumber;
  density5Km: NullableNumber;
  cbdDistanceKm: NullableNumber;
  cluster: string | null;
  needFlags: string[];
  needScore: number;
  priorityScore: number;
  critical: boolean;
  completeness: number;
  validationIssues: DataQualityIssue[];
}

export interface FilterState {
  district?: string;
  lga?: string;
  risk?: "critical";
  need?: NeedCategory;
  q?: string;
}

export type DashboardSearchParams = Record<string, string | string[] | undefined>;

export interface NullableAggregate {
  value: number | null;
  knownCount: number;
  unknownCount: number;
  completeness: number;
}

export interface RegisterStatus {
  rowCount: number;
  serverCount: number | null;
  geolocatedCount: number;
  populationKnownCount: number;
  populationUnknownCount: number;
  validationIssueCount: number;
  fetchedAt: string;
  complete: boolean;
  /** "live" = queried Supabase now; "snapshot" = served the verified presentation snapshot after a live failure. */
  mode: "live" | "snapshot";
  /** ISO timestamp the snapshot was generated, when mode === "snapshot". */
  snapshotCreatedAt?: string;
}

export interface CommunityDataset {
  records: Community[];
  status: RegisterStatus;
  issues: DataQualityIssue[];
}

export interface MetricDefinition {
  key: string;
  label: string;
  definition: string;
  source: string;
  formula: string;
  caveat: string;
  domain?: string;
  sourceFields?: string[];
  missingDataPolicy?: string;
}
