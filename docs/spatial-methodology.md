# Spatial methodology and integration status

## Administrative boundaries

The application uses GRID3 2022 Nigeria state and LGA boundaries distributed through geoBoundaries gbOpen under CC BY 4.0. `npm run pipeline:administrative` retrieves source metadata and simplified GeoJSON, selects Lagos State by source name, spatially selects the 20 LGA geometries, validates polygon types and WGS84 ranges, and fails if the expected count changes. It writes `data/spatial/lagos-administrative.json` plus a metadata sidecar. The result is planning context, not cadastral evidence. Senatorial polygons are unavailable because no reviewed geometry source has been integrated.

The processed layer (1 ADM1 + 20 ADM2 features) is rendered beneath the community points on the Spatial Explorer and community dossier maps (`state fill/line`, `LGA fill/line/label`), with a visibility toggle, boundary-line opacity control and click-to-identify on LGA polygons. `lib/spatial.ts` loads the same file server-side for three deterministic checks: `validateAdministrativeLayer()` (feature counts, duplicate layer IDs, geometry types), `communityInsideLagos()` (ray-cast point-in-polygon of each survey point against the state polygon) and `reconcileCommunityLga()` (compares the survey-declared LGA against the LGA polygon that contains the point). LGA name variants are normalised through `normalizeLga` (slash/underscore separators plus an alias table) before comparison. None of these checks overwrite survey values; disagreements are surfaced on `/explorer` and `/data-quality`. Points near the simplified coastline can fall outside the generalised land polygons and are reported separately rather than flagged as errors.

## Community geometry and distance

Community coordinates come from the Blue Lagos field survey view. Browser geometry is WGS84 longitude/latitude. Existing nearest-community, hospital and CBD distances are supplied by the analytical view and are labelled straight-line descriptors because their generating SQL is not in this repository. Scenario radius membership uses deterministic Haversine great-circle distance. It is not a route, isochrone or observed travel time.

## OSM extraction and water transport

`npm run pipeline:osm` is a repeatable Overpass adapter for health facilities, schools, markets, ferry terminals, piers, waterways and ferry routes inside the Lagos administrative area. It stores source type/ID, unmodified tags, retrieval time, geometry and provenance. It tries a list of public Overpass mirrors in order (the primary endpoint frequently returns HTTP 504). OSM facilities are contextual rather than an authoritative registry. Piers are landing candidates, not official jetties. Every waterway is assigned `unknown` navigability until separately verified. OSM and Blue Lagos records are not merged automatically.

### Reviewed OSM layers (`npm run pipeline:osm:process`)

The raw extraction (2,504 features on the 2026-09-06 run) is processed into three presentation-ready GeoJSON layers under `data/spatial/processed/`, each committed so the application never queries Overpass at request time:

| Layer | Geometry | Features (2026-09-06) | Unnamed kept |
|---|---|---|---|
| `osm-health-facilities.geojson` | Point | 539 | 3 |
| `osm-marine-access.geojson` | Point | 292 | 145 |
| `osm-waterways.geojson` | LineString | 1,196 | 1,150 |

Processing steps: point-in-polygon clip to the GRID3 Lagos State boundary (4 features dropped); de-duplication by `osm_type/osm_id`; classification into `facility_type` / `access_kind` / `waterway_type`; unnamed features retained but relabelled `Unnamed (OSM <id>)` — **no name is synthesised**. Every output feature carries `osm_id`, the original `source_tags`, `retrieved_at`, `confidence: "openstreetmap_mapped_unverified"` and `field_verified: false`. Marine and waterway features carry `navigability: "unknown"`. `npm run pipeline:validate` re-checks all of this (counts vs metadata, duplicate ids, provenance present, no navigability assertion, coordinate ranges). Server-side loaders in `lib/spatial/osm.ts` memoise the parsed files for the process lifetime.

No validated navigable graph exists. Consequently network distance, pgRouting, vessel travel time, multimodal routes and isochrones are not published. Future graph costs must preserve length, navigability, restrictions and explicit vessel speed assumptions.

## Derived proximity analysis (Turf, `lib/spatial/`)

`npm run spatial:derive` persists one compatible analytical file at `data/spatial/derived/community-spatial-context.json`. The current file contains 93 geolocated communities and, for each, the nearest mapped health feature ID/name/type/source, great-circle distance, mapped marine-access distance, true point-to-line waterway distance and H3 resolution-7 cell. The calculation timestamp is tied to the verified source snapshot so unchanged inputs produce byte-stable output. The observed mapped-health distribution is 33 under 2 km, 19 at 2–5 km, 14 at 5–10 km and 27 over 10 km; these remain analytical distance bands rather than policy standards.

`lib/spatial/proximity.ts` provides pure functions over GeoJSON: `greatCircleKm` (direct haversine, earth radius 6371.0088 km, equivalent to `@turf/distance` without per-call object allocation), `nearestPointFeature`, `nearestLineKm` (minimum distance to a waterway *vertex*; OSM waterway geometry is densely sampled so this tracks perpendicular distance to within tens of metres), `countWithinKm`, and descriptive `distanceBand` classes (`<2 / 2–5 / 5–10 / >10 km / No mapped facility` — analytical bands, not policy thresholds).

`lib/spatial/context.ts` (`getSpatialContext`) joins the live register to the three OSM layers and produces, per community: nearest OSM health facility (km + name + type), nearest OSM marine access (km + name + kind), count of OSM marine access points within 5 km, nearest OSM waterway (km), a survey-vs-OSM health-distance delta (labelled a *spatial comparison*, not a correction), and an `accessConstraintFactors` string list (highly stranded by survey; isolated >5 km; ≥10 km to nearest OSM health facility; no OSM marine access within 5 km; water-dependent route with poor/absent landing). Survey values are never overwritten; communities without coordinates receive `null`, never `0`. The result is memoised in-process for 5 minutes, keyed on a signature of the geolocated community coordinates. Note: the survey view's `dist_to_hospital_km` is empty for every community, so the OSM straight-line distance is currently the platform's only facility-distance estimate; `/data-quality` states this.

## Facilities and landings

Typed contracts distinguish health facility source quality and verification. Landings use `official_jetty`, `community_landing`, `ferry_terminal`, `informal_landing` or `unknown`. No point registry has passed review, so nearest-facility and nearest-landing calculations are not recomputed from an external registry.

## Population and H3

Survey population remains distinct from modelled gridded population. No WorldPop raster has been selected or processed, and no modelled exposure is shown.

H3 (Uber H3 v4, `lib/spatial/h3.ts`) aggregates the surveyed community points at **resolution 7** (~5.16 km² per cell, ~1.4 km edge — chosen so neighbouring riverine settlements group while intra-LGA variation still resolves). `aggregateCommunitiesToH3` bins each geolocated community to its cell and reports real values only: community count, Critical Alert count, mean and max need score, and the sum of *known* survey population (`null` when no community in the cell has a known population — never `0`). Empty space produces no cell; nothing is interpolated. `h3CellsToGeoJSON` emits closed Polygon rings for MapLibre fill layers on `/explorer`. It is not used for population modelling.

## Presentation resilience

`npm run snapshot:presentation` fetches the full paginated register from Supabase exactly as the app does, checks identity fields and count integrity, and writes `data/presentation-snapshot.json` (134 rows, no secrets — only rows the anon key can already read). `lib/data.ts` falls back to this snapshot **only** when the live query throws **and** `NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK === "1"`; the shared `finalizeDataset` pipeline (identity validation, Zod parse, cluster join, null-preserving map, duplicate + count-integrity checks) runs identically on snapshot rows, and `RegisterStatus.mode` becomes `"snapshot"` with `snapshotCreatedAt`. `SnapshotBanner` renders a visible "VERIFIED SNAPSHOT" strip in that state — never a silent swap. `npm run presentation:check` is a read-only pre-demo status board (live reachability, snapshot freshness, boundary validity, OSM layers present, key routes present).

## Earth observation

Earth observation processing is offline-only. A publishable product requires sensor, acquisition period, cloud filtering, native/output resolution, processing method, thresholds/classes, units, licence, limitations and processing timestamp. Pages never call Google Earth Engine in presentation flow. Surface water, NDVI, land cover, built-up change, flood extent and shoreline change currently remain unavailable. No erosion rate or composite flood model is inferred.

## Scenario and candidate screening

Shared Service Areas use deterministic DBSCAN over haversine kilometres (default 5 km, minimum two points). DBSCAN was selected because Lagos settlement spacing is irregular, the cluster count does not need to be guessed, and the threshold is explainable; isolated targets are retained as single-community planning areas rather than hidden as noise. Priority mode filters to service-specific field/derived deficits, while Nearby mode groups every valid surveyed coordinate.

Each area evaluates its community medoid, settlement-vicinity points and a regular 0.5–1 km local grid. A geometric centroid is retained only as a reference. Land interventions must be inside the GRID3 Lagos State geometry and at least 50 metres from mapped OSM waterway linework; this narrow interim buffer prevents a marker sitting on mapped water while avoiding a broad inland exclusion around waterfront communities. Jetty/Landing candidates instead require land-side proximity within 250 metres of mapped water linework. The repository does not yet contain open-water polygons, so these checks are explicitly incomplete and are not engineering, cadastral, navigation or construction approval.

Candidate dimensions are normalized among valid points before Blue Lagos planning weights are applied. The five intervention models differ: health uses population, mapped-health deficit, Critical Need, stranding and distance efficiency; water uses population, sanitation, disease risk and Critical Need; emergency uses Critical Alert, stranding, flood, preparedness and population; solar uses energy, digital, population and observed deprivation; jetty uses water-route dependence, isolation, mapped marine-access deficit, population and Critical Need. Selecting two or three facilities uses deterministic greedy marginal population coverage and never counts a community or its field population twice.

All active scenarios are straight-line catchments centred on surveyed community points. For primary healthcare only, baseline coverage uses the supplied nearest-hospital distance at the selected radius; additional communities are those inside the proposed radius but outside that supplied baseline. This combines two straight-line measures but does not validate facility identity or route access.

Preliminary health candidates are ranked using 40% additional community count, 30% log-scaled known survey population and 30% Critical Alert count. Population completeness is exposed. The result is screening, not a site recommendation: land tenure, cost, clinical capacity, network access, flood suitability and modelled population are absent.
