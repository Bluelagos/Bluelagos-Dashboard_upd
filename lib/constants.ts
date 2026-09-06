import type { Community, MetricDefinition, NeedCategory } from "./domain";

export const CATEGORY_COLORS: Record<NeedCategory, string> = {
  "Water & Sanitation": "#1bb8e8",
  "Roads & Infrastructure": "#a8b4c4",
  Healthcare: "#f45b69",
  Education: "#f5b942",
  "Civic Support": "#a78bfa",
  Unclassified: "#53677d",
};

export const METRICS: MetricDefinition[] = [
  {
    key: "critical-alert",
    label: "Critical Alert",
    definition: "A canonical hard-stop rule requiring executive attention.",
    source: "Live community view",
    formula:
      "Disease risk = CRITICAL OR highly stranded OR MPI >= 4 OR critical displacement",
    caveat: "An alert classification, not a prediction.",
    domain: "Boolean",
    sourceFields: [
      "cholera_outbreak_risk",
      "healthcare_stranding_status",
      "multi_dimensional_poverty_index",
      "erosion_displacement_threat",
    ],
    missingDataPolicy:
      "Known hard-stop conditions trigger an alert; missing fields do not.",
  },
  {
    key: "critical-need",
    label: "Critical Need",
    definition:
      "A high count of documented adverse conditions, distinct from a Critical Alert.",
    source: "Live community view; legacy methodology v1",
    formula: "Baseline Blue Lagos Need Score >= 5",
    caveat:
      "This threshold is a planning severity band and is not the emergency hard-stop rule.",
    domain: "0-10",
    sourceFields: ["needScore"],
    missingDataPolicy:
      "Unknown conditions do not add points; review completeness.",
  },
  {
    key: "need",
    label: "Baseline Blue Lagos Need Score",
    definition: "Count of ten documented adverse conditions.",
    source: "Live community view; legacy methodology v1",
    formula:
      "One point each for extreme poverty, evacuation, sanitation, energy, digital, preparedness, erosion, flood, harvest and isolation deficits.",
    caveat:
      "Conditions are equally weighted; missing observations do not add points.",
    domain: "0-10",
    missingDataPolicy:
      "Unknown conditions remain unscored and completeness is shown separately.",
  },
  {
    key: "isolation",
    label: "Spatial isolation",
    definition: "Nearest mapped community is more than 5 km away.",
    source: "Precomputed spatial fields in Supabase",
    formula: "nearest_neighbor_km > 5",
    caveat: "Straight-line baseline only; it is not waterway travel time.",
  },
  {
    key: "population",
    label: "Survey-based population estimate",
    definition: "Community estimate recorded in the baseline dataset.",
    source: "Blue Lagos field survey",
    formula: "Sum of observed estimated_population values",
    caveat:
      "Missing values remain unavailable and are excluded, never converted to observed zero.",
  },
  {
    key: "poverty",
    label: "Extreme poverty",
    definition: "Observed multidimensional poverty index at level 4 or 5.",
    source: "Live community view",
    formula: "MPI >= 4",
    caveat: "Unknown MPI is excluded from the observed denominator.",
    domain: "MPI 0-5",
    sourceFields: ["multi_dimensional_poverty_index"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "medical-evacuation",
    label: "Medical evacuation constraint",
    definition:
      "Community classified as highly stranded for emergency health access.",
    source: "Live community view",
    formula: "healthcare_stranding_status = HIGHLY_STRANDED",
    caveat: "A field classification, not modeled travel time.",
    sourceFields: ["healthcare_stranding_status"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "sanitation",
    label: "Sanitation deficit",
    definition: "Observed raw sanitation deficit.",
    source: "Live community view",
    formula: "raw_sanitation_deficit = true",
    caveat: "Does not infer a specific sanitation practice.",
    sourceFields: ["raw_sanitation_deficit"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "energy",
    label: "Energy poverty",
    definition: "Community energy status is energy poor.",
    source: "Live community view",
    formula: "energy_poverty_status = ENERGY_POOR",
    caveat: "Categorical field evidence.",
    sourceFields: ["energy_poverty_status"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "digital",
    label: "Digital exclusion",
    definition: "Community digital status is excluded.",
    source: "Live community view",
    formula: "digital_exclusion_status = EXCLUDED",
    caveat: "Categorical field evidence.",
    sourceFields: ["digital_exclusion_status"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "preparedness",
    label: "Disaster preparedness void",
    definition: "A preparedness void is documented.",
    source: "Live community view",
    formula: "disaster_preparedness_void = true",
    caveat: "Does not measure plan effectiveness.",
    sourceFields: ["disaster_preparedness_void"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "erosion",
    label: "Critical erosion displacement",
    definition: "Critical displacement threat is documented.",
    source: "Live community view",
    formula: "erosion_displacement_threat = CRITICAL_DISPLACEMENT",
    caveat: "Field status, not a remote-sensing trend.",
    sourceFields: ["erosion_displacement_threat"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "flood",
    label: "High flood hazard",
    definition: "Observed flood-health hazard score is 4 or 5.",
    source: "Live community view",
    formula: "flood_health_hazard_score >= 4",
    caveat: "Field score, not modeled depth or probability.",
    domain: "0-5",
    sourceFields: ["flood_health_hazard_score"],
    missingDataPolicy: "Unavailable",
  },
  {
    key: "harvest",
    label: "Severe post-harvest risk",
    definition: "Post-harvest loss risk is severe.",
    source: "Live community view",
    formula: "post_harvest_loss_risk = SEVERE",
    caveat: "Categorical field evidence.",
    sourceFields: ["post_harvest_loss_risk"],
    missingDataPolicy: "Unavailable",
  },
];

export interface SdgIndicator {
  goal: number;
  name: string;
  target: string;
  label: string;
  observed: (community: Community) => boolean;
  affected: (community: Community) => boolean;
}
export const SDG_INDICATORS: SdgIndicator[] = [
  {
    goal: 1,
    name: "No Poverty",
    target: "1.4",
    label: "Local proxy: extreme deprivation (MPI 4-5)",
    observed: (c) => c.mpi !== null,
    affected: (c) => c.mpi !== null && c.mpi >= 4,
  },
  {
    goal: 3,
    name: "Good Health",
    target: "3.d",
    label: "Local proxy: highly stranded emergency access",
    observed: (c) => c.strandingStatus !== null,
    affected: (c) => c.strandingStatus === "HIGHLY_STRANDED",
  },
  {
    goal: 6,
    name: "Clean Water & Sanitation",
    target: "6.2",
    label: "Local proxy: observed raw sanitation deficit",
    observed: (c) => c.sanitationDeficit !== null,
    affected: (c) => c.sanitationDeficit === true,
  },
  {
    goal: 7,
    name: "Affordable & Clean Energy",
    target: "7.1",
    label: "Local proxy: energy poverty status",
    observed: (c) => c.energyStatus !== null,
    affected: (c) => c.energyStatus === "ENERGY_POOR",
  },
  {
    goal: 9,
    name: "Industry & Infrastructure",
    target: "9.c",
    label: "Local proxy: digital exclusion status",
    observed: (c) => c.digitalStatus !== null,
    affected: (c) => c.digitalStatus === "EXCLUDED",
  },
  {
    goal: 11,
    name: "Sustainable Communities",
    target: "11.b",
    label: "Local proxy: disaster preparedness void",
    observed: (c) => c.disasterPreparednessVoid !== null,
    affected: (c) => c.disasterPreparednessVoid === true,
  },
  {
    goal: 13,
    name: "Climate Action",
    target: "13.1",
    label: "Local proxy: critical erosion displacement",
    observed: (c) => c.erosionRisk !== null,
    affected: (c) => c.erosionRisk === "CRITICAL_DISPLACEMENT",
  },
];
