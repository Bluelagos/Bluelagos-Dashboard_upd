/**
 * Plain-English first, technical detail underneath.
 *
 * Every number that appears on a primary screen has an entry here. The visible
 * label is ordinary language; the GIS/statistical method lives in
 * `methodTechnical` and only surfaces inside an info drawer, a tooltip or the
 * Methodology page. This is the single place to edit that wording so the UI,
 * the drawers and the briefing never drift apart.
 */

export type SourceKind = "Field" | "OpenStreetMap" | "Derived" | "External";

export interface Explainer {
  /** Plain-English name shown to everyone. */
  title: string;
  /** Small secondary line placed under the label, e.g. "Straight-line estimate". */
  hint?: string;
  /** What is this? — one sentence. */
  summary: string;
  /** Why does it matter? — one sentence. */
  why: string;
  /** How was it calculated? — plain words, no jargon. */
  methodPlain: string;
  /** The same calculation for a GIS or data professional. */
  methodTechnical?: string;
  source: SourceKind;
  sourceDetail?: string;
  limitations?: string;
  /** Optional deep link, e.g. to the Methodology section. */
  link?: { href: string; label: string };
}

export const SOURCE_LABEL: Record<SourceKind, string> = {
  Field: "Blue Lagos field survey",
  OpenStreetMap: "OpenStreetMap (community-mapped)",
  Derived: "Calculated by Blue Lagos",
  External: "External published dataset",
};

const methodology = (hash: string, label: string) => ({ href: `/methodology#${hash}`, label });

export const EXPLAIN = {
  communities: {
    title: "Communities surveyed",
    summary: "The number of riverine and coastal settlements visited by the Blue Lagos field survey.",
    why: "It sets the coverage of everything else on the platform — every figure describes these communities, not all of Lagos.",
    methodPlain: "A direct count of survey records after duplicate checks.",
    methodTechnical:
      "COUNT over the community register after identity validation, per-record schema parse and dataset-level duplicate detection on id, name+LGA and coordinate pairs. Row count is reconciled against the source count before any total is published.",
    source: "Field",
    sourceDetail: "Blue Lagos community survey",
    link: methodology("field-survey", "How the survey was collected"),
  },

  population: {
    title: "Population represented",
    hint: "Community estimates, added together",
    summary: "The total number of people living in the surveyed communities, as estimated during the survey.",
    why: "It converts a list of settlements into a sense of how many people the decisions affect.",
    methodPlain:
      "Each community's own population estimate added together. Communities that did not give an estimate are left out of the total rather than counted as zero.",
    methodTechnical:
      "Null-preserving sum: SUM(estimated_population) over records where the value is non-null, reported alongside known/unknown record counts. No modelled population surface (WorldPop or similar) is used.",
    source: "Field",
    sourceDetail: "Community-reported estimates",
    limitations:
      "These are field estimates, not a census. Communities missing an estimate are reported separately so the total is never silently inflated.",
    link: methodology("population", "How population is counted"),
  },

  households: {
    title: "Households represented",
    hint: "A floor, not a total",
    summary:
      "The smallest number of households the surveyed communities can contain, given the household band each one reported.",
    why: "Households, not people, are the unit most delivery programmes budget against — a latrine block, a meter, a boat, a registration visit.",
    methodPlain:
      "The survey recorded households as a band (for example '101 to 150'), never as an exact count. We add up the bottom of every band, so the figure is the least it can be rather than a guess at the middle. Communities that gave no band add nothing.",
    methodTechnical:
      "Lower-bound sum: SUM(lower edge of household_estimated_population band) over records with a parseable band. 'Below 50' contributes 0. No midpoint imputation, no distributional model, and communities without a band are reported as unknown rather than imputed.",
    source: "Field",
    sourceDetail: "Community-reported household bands",
    limitations:
      "This is a floor and will understate the true count, by more where communities reported wide or open-ended bands such as 'Above 1000'. It is not comparable to a household census.",
    link: methodology("population", "How population is counted"),
  },

  voters: {
    title: "Registered voters",
    summary:
      "The number of registered voters the surveyed communities reported, added together.",
    why: "It is the one indicator here that maps directly onto an existing government system, so it shows how far state machinery already reaches into these settlements.",
    methodPlain:
      "Each community's own figure for registered voters, added together. Communities that did not give a figure are left out rather than counted as zero.",
    methodTechnical:
      "Null-preserving sum: SUM(estimated_registered_voters) over non-null records, reported with known/unknown counts. Not reconciled against the INEC register — the two are independent counts.",
    source: "Field",
    sourceDetail: "Community-reported estimates",
    limitations:
      "Community-reported, not drawn from the national voter roll, so it should be read as the community's own account of its registration, not an official figure.",
    link: methodology("field-survey", "How the survey was collected"),
  },

  women: {
    title: "Women recorded",
    summary: "The number of women living in the surveyed communities, as estimated during the survey.",
    why: "Maternal care, water collection and market access all fall disproportionately on women in these communities, so the count sizes those interventions.",
    methodPlain:
      "Each community's own estimate of how many women live there, added together. Communities without an estimate are left out of the total.",
    methodTechnical:
      "Null-preserving sum: SUM(estimated_number_of_women) over non-null records, reported with known/unknown counts.",
    source: "Field",
    sourceDetail: "Community-reported estimates",
    limitations:
      "A field estimate given by the community head or residents, not a disaggregated census, and it is not guaranteed to be internally consistent with the population estimate.",
    link: methodology("population", "How population is counted"),
  },

  youth: {
    title: "Youth aged 18 to 35",
    summary:
      "The number of young adults aged 18 to 35 in the surveyed communities, as estimated during the survey.",
    why: "It is the group any livelihood, skills or digital-access programme would work with, and it is already resident rather than needing to be attracted in.",
    methodPlain:
      "Each community's own estimate of its 18-to-35 population, added together. Communities without an estimate are left out of the total.",
    methodTechnical:
      "Null-preserving sum: SUM(estimated_number_of_youth) over non-null records, reported with known/unknown counts.",
    source: "Field",
    sourceDetail: "Community-reported estimates",
    limitations:
      "A field estimate rather than an age-structured census; the 18-to-35 band was defined on the questionnaire and applied by the enumerator.",
    link: methodology("population", "How population is counted"),
  },

  healthDistance: {
    title: "Distance to health facility",
    hint: "Straight-line estimate",
    summary:
      "How far a community is from the nearest health facility that appears on the open map of Lagos.",
    why: "Long distances are an early signal of where getting to care is hard, especially for emergencies on water.",
    methodPlain:
      "We measure the direct distance between the community and the closest mapped health facility, as the crow flies. It is not travel time and it does not follow roads or channels.",
    methodTechnical:
      "Great-circle (Haversine) nearest-neighbour distance from each community point to the OpenStreetMap health-facility layer, computed with Turf and persisted by the spatial derivation pipeline. No network routing, isochrone or travel-time model is applied.",
    source: "OpenStreetMap",
    sourceDetail: "Health facilities mapped by OpenStreetMap contributors (ODbL)",
    limitations:
      "Open map coverage is uneven. A long distance can mean a genuine gap in services or simply a facility nobody has mapped yet — the Data Quality page compares both.",
    link: methodology("health-distance", "How distance is calculated"),
  },

  needScore: {
    title: "Community need score",
    hint: "Out of 10 recorded conditions",
    summary:
      "A count of how many of ten recorded hardship conditions a community reported.",
    why: "It lets very different problems — water, power, flooding, isolation — be compared on one consistent scale.",
    methodPlain:
      "Ten conditions are checked for each community. Each one that is present adds one point. Conditions nobody recorded add nothing, so a low score can mean either few problems or a thin record.",
    methodTechnical:
      "Baseline Blue Lagos Need Score, preserved exactly from legacy methodology v1: one point each for MPI ≥ 4, highly stranded, sanitation deficit, energy poverty, digital exclusion, preparedness void, critical erosion displacement, flood hazard ≥ 4, severe post-harvest loss risk and nearest mapped community > 5 km. Equal weights; missing observations do not score.",
    source: "Field",
    sourceDetail: "Blue Lagos field survey, legacy methodology v1",
    limitations:
      "Every condition counts the same. It is a planning aid, not Lagos State policy, and completeness is shown next to it.",
    link: methodology("community-priority", "How the score is built"),
  },

  criticalNeed: {
    title: "Highest combined need",
    hint: "Need score of 5 or more",
    summary: "Communities that reported at least five of the ten recorded hardship conditions.",
    why: "It narrows a long list down to the settlements facing the most problems at once.",
    methodPlain: "Any community whose need score is 5 or above out of 10.",
    methodTechnical:
      "needScore >= 5. This planning severity band is deliberately distinct from the canonical Critical Alert hard-stop rule used in operational views.",
    source: "Derived",
    sourceDetail: "Calculated from field survey conditions",
    link: methodology("community-priority", "How the score is built"),
  },

  criticalAlert: {
    title: "Urgent attention",
    hint: "Hard-stop rule",
    summary:
      "Communities that meet at least one condition serious enough to be flagged on its own.",
    why: "These are the cases that should not wait for a ranking exercise.",
    methodPlain:
      "A community is flagged if it has critical disease risk, no way to move a medical emergency out, extreme poverty, or erosion severe enough to displace people.",
    methodTechnical:
      "Canonical Critical Alert rule: cholera_outbreak_risk = CRITICAL OR healthcare_stranding_status = HIGHLY_STRANDED OR multi_dimensional_poverty_index >= 4 OR erosion_displacement_threat = CRITICAL_DISPLACEMENT. Known conditions trigger the alert; missing fields never do.",
    source: "Field",
    sourceDetail: "Blue Lagos field survey",
    limitations: "This is a classification of what was observed, not a prediction.",
    link: methodology("community-priority", "How the rule is defined"),
  },

  stranded: {
    title: "No way out in an emergency",
    summary:
      "Communities that recorded no motorised way to move someone out for urgent medical care.",
    why: "It is the sharpest access problem in the dataset and it usually travels with other deficits.",
    methodPlain: "Taken directly from the survey's emergency-movement question.",
    methodTechnical: "healthcare_stranding_status = HIGHLY_STRANDED, retained as observed.",
    source: "Field",
    sourceDetail: "Blue Lagos field survey",
  },

  sanitation: {
    title: "Sanitation gaps",
    summary: "Communities where the survey recorded a raw sanitation deficit.",
    why: "Sanitation, drinking water and disease risk move together in riverine settlements.",
    methodPlain: "Taken directly from the survey's sanitation observation.",
    methodTechnical: "raw_sanitation_deficit = true, retained as observed.",
    source: "Field",
    sourceDetail: "Blue Lagos field survey",
  },

  flood: {
    title: "Flood exposure",
    hint: "Reported by the community",
    summary: "Communities that rated their flood hazard at the top of the survey's scale.",
    why: "It shows where flooding is already part of daily life, before any modelling.",
    methodPlain: "Communities that gave a flood hazard rating of 4 or 5 out of 5 during the survey.",
    methodTechnical:
      "flood_health_hazard_score >= 4. This is a field observation, not flood depth, return period, remotely mapped inundation or a climate projection.",
    source: "Field",
    sourceDetail: "Blue Lagos field survey",
    limitations:
      "No satellite flood product has been processed and reviewed, so no modelled inundation extent is shown.",
    link: methodology("external-data", "Why no satellite flood map is shown"),
  },

  erosion: {
    title: "Erosion displacing people",
    summary: "Communities where erosion was recorded as severe enough to displace households.",
    why: "It marks settlements whose land is actively being lost.",
    methodPlain: "Taken directly from the survey's erosion threat question at its most severe level.",
    methodTechnical: "erosion_displacement_threat = CRITICAL_DISPLACEMENT, retained as observed.",
    source: "Field",
    sourceDetail: "Blue Lagos field survey",
  },

  isolation: {
    title: "Isolated settlements",
    hint: "Straight-line estimate",
    summary: "Communities more than 5 km from the nearest other surveyed community.",
    why: "Distance from neighbours affects whether a shared facility could ever serve them.",
    methodPlain: "The direct distance to the closest other mapped community, measured as the crow flies.",
    methodTechnical:
      "Nearest-neighbour great-circle distance between surveyed community points; threshold > 5 km. Not a travel distance and not a navigability statement.",
    source: "Derived",
    sourceDetail: "Calculated from survey coordinates",
    link: methodology("health-distance", "How distances are measured"),
  },

  concentration: {
    title: "Community concentration",
    summary: "Where surveyed communities cluster most densely across the lagoon system.",
    why: "Clusters are where one investment can reach more people than a single settlement.",
    methodPlain:
      "The map is divided into equal-sized cells and each cell is shaded by how many communities fall inside it.",
    methodTechnical:
      "Communities aggregated to an H3 hexagonal grid at resolution 7 (~5 km² per cell); cell values are community counts and summed known population.",
    source: "Derived",
    sourceDetail: "Calculated from survey coordinates",
    link: methodology("community-priority", "How the grid is built"),
  },

  sharedServiceAreas: {
    title: "Shared service areas",
    summary:
      "Groups of nearby communities with similar gaps, tested to see whether one facility could serve several of them.",
    why: "It moves planning from one-facility-per-village to what a single well-placed investment could cover.",
    methodPlain:
      "Communities that are close together and share the same kind of shortfall are grouped. Inside each group we look for a point on land that would sit within reach of as many of them as possible, then count the communities and people inside that reach.",
    methodTechnical:
      "Density-based geographic clustering (DBSCAN-style, configurable neighbourhood radius) over community points, filtered by intervention-specific need weighting. Candidate siting screens points against the Lagos State polygon and buffers mapped waterways to exclude open water; coverage is a straight-line service radius, never an isochrone. Unique population is de-duplicated across overlapping catchments.",
    source: "Derived",
    sourceDetail: "Calculated from survey data, GRID3 boundaries and OpenStreetMap waterways",
    limitations:
      "Reach is measured in a straight line. There is no validated navigable-water network, so a candidate that looks close may not be reachable in practice.",
    link: methodology("shared-service-areas", "How grouping and siting work"),
  },

  scenarioCatchment: {
    title: "Planning catchment",
    hint: "Straight-line reach",
    summary: "The communities and people that fall within a chosen distance of a tested location.",
    why: "It gives a first, honest answer to “who would this facility actually reach?”",
    methodPlain:
      "You place a point and choose a distance. Every surveyed community inside that distance is counted, along with its population estimate.",
    methodTechnical:
      "Point-in-circle test using great-circle distance from the chosen coordinate; population is a null-preserving sum over communities inside the radius. Circles are never labelled isochrones and no travel-time surface exists.",
    source: "Derived",
    sourceDetail: "Calculated at request time from survey coordinates",
    limitations:
      "A straight-line circle ignores water, shoreline and road conditions. Treat it as a first screen, not a service guarantee.",
    link: methodology("scenario-catchments", "What a catchment does and does not mean"),
  },

  boundaries: {
    title: "Local government areas",
    summary: "The administrative boundaries used to group communities for planning.",
    why: "Most government decisions are organised by LGA, so the data has to line up with them.",
    methodPlain:
      "We check which LGA boundary each community's coordinates fall inside, and compare that with the LGA recorded during the survey. The survey answer is never overwritten.",
    methodTechnical:
      "Point-in-polygon reconciliation of survey coordinates against GRID3 2022 LGA polygons (via geoBoundaries gbOpen, CC BY 4.0). Mismatches and points outside all polygons are reported, not corrected.",
    source: "External",
    sourceDetail: "GRID3 2022 / geoBoundaries",
    limitations:
      "Boundaries are generalised planning geography, not cadastral. Coastal and lagoon points can legitimately fall outside a simplified land polygon.",
    link: methodology("administrative-boundaries", "Which boundaries are used"),
  },

  completeness: {
    title: "Record completeness",
    summary: "How much of each community's core survey record was actually filled in.",
    why: "A confident-looking number built on a thin record deserves less weight.",
    methodPlain: "The share of the core survey fields that hold a real value for that community.",
    methodTechnical:
      "Percentage of non-null core fields per record. Missing values are preserved as null throughout the platform and never substituted with zero.",
    source: "Derived",
    sourceDetail: "Calculated from the survey record",
    link: methodology("field-survey", "How completeness is scored"),
  },
} as const satisfies Record<string, Explainer>;

export type ExplainKey = keyof typeof EXPLAIN;
