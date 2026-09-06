# Blue Lagos Riverine Intelligence — Presentation Study Pack

*Written for someone who understands GIS and data, but does not want software-engineering jargon. Read this the morning of the presentation. Allow 30–40 minutes.*

---

# PART 1 — What Blue Lagos is

## The problem

Lagos State's coastal and riverine settlements sit along the lagoon, the creeks and the Atlantic fringe — mostly in Epe, Ojo, Amuwo-Odofin, Badagry, Ibeju-Lekki, with a little in Apapa and Eti-Osa. They share a set of problems that ordinary planning data hides:

- They are **counted at Local Government level**, so a settlement of 400 people with no clinic and no road is invisible inside an LGA total.
- Their **access is not road-shaped**. Some are reachable only by boat. "Nearest facility" measured on roads is meaningless for them.
- They are **first to fail** in a flood, a difficult childbirth, or a waterborne-disease outbreak, and slowest to receive help.

## Why riverine communities are different from the rest of Lagos

| Ordinary urban Lagos | Riverine Lagos |
|---|---|
| Dense road network; routing is a solved problem | Access is a mix of road, water, and foot; often water-only |
| Facilities are close and numerous | Nearest facility can be 5–20 km away, across water |
| Well mapped | Sparsely mapped; official registries thin or absent |
| Flood is a drainage problem | Flood and erosion are existential; whole communities displace |

## What was surveyed

A Blue Lagos household/community survey of **134 riverine communities**. For each:

- Identity: name, community head, Local Government, senatorial district.
- Location: GPS coordinates for **93** of the 134. The other **41** have survey answers but no fixed point yet, and the platform keeps them in every table.
- People: estimated population, households, registered voters, women, youth.
- Health, water and sanitation: waterborne-disease risk, medical-evacuation ("stranding") status, sanitation deficit, trapped pregnant women where stranding is severe.
- Climate: a field flood-hazard score (0–5), erosion-displacement threat.
- Access & infrastructure: primary visit route, jetty/landing condition, energy-poverty status, digital-exclusion status, nearest community, distance to CBD.
- Economy: primary occupation, multi-dimensional poverty index (0–5), post-harvest loss risk.
- The community's own **stated priority request**, preserved verbatim.

## What the platform does

It takes that field evidence, places it on real Lagos geography, adds open mapping evidence, runs transparent spatial calculations, and turns the result into decisions:

```
Field survey → database → spatial checks → analysis → map + dashboard → intervention decision
```

Concretely you can: filter and rank communities; see where multiple risks overlap in space; open a single community's full dossier; measure straight-line distance to the nearest mapped facility; test where a hypothetical intervention would reach; and inspect the data's own gaps and provenance.

---

# PART 2 — The data

There are **four classes of evidence** in the platform, and the interface labels them:

| Badge | Class | Meaning |
|---|---|---|
| **FIELD** | Field evidence | Collected directly by Blue Lagos enumerators |
| **OSM** | Open mapping evidence | Mapped by OpenStreetMap contributors |
| **DERIVED** | Derived spatial metric | Calculated by the platform from field/open geometry |
| **MODELLED** | Modelled external evidence | WorldPop / Earth observation — **not yet integrated** |

## 2.1 Blue Lagos field survey — FIELD

- **What it contains**: the 134-community register described in Part 1.
- **Where it lives**: a Supabase (hosted PostgreSQL) database, in an analytical view called `blue_lagos_dashboard_kpis`. The platform reads it live, every time a page loads.
- **How it's protected**: the browser only ever holds a read-only public key to a read-only view. No write access, no admin key, anywhere near the front end.
- **Known gaps**: 41/134 have no coordinates. `dist_to_hospital_km` and `nearest_hospital_name` are **empty for every community** — the survey did not capture a numeric facility distance. Flood score is present for 74/134, jetty condition for 72/134. Population is known for 93/134 (the geolocated ones).

## 2.2 Lagos administrative boundaries — (authoritative-style)

- **What**: 1 Lagos State polygon + 20 Local Government polygons.
- **Where they came from**: the **GRID3 Nigeria 2022** boundary set, distributed through **geoBoundaries (gbOpen)**, licence **CC BY 4.0**. GRID3 is the boundary lineage used across the Nigerian humanitarian and development sector; it is aligned with National Population Commission / OCHA usage. It is *planning-grade*, not a cadastral/survey boundary.
- **How used**: rendered under the community points; used to test whether a point is inside Lagos, and which LGA polygon contains it; used to reconcile the surveyor's declared LGA against the polygon.
- **Coordinate system**: WGS84 longitude/latitude (EPSG:4326 / OGC:CRS84). Everything in the platform is WGS84.

## 2.3 OpenStreetMap — OSM

- **What we use it for**: three layers — **mapped health facilities** (539), **mapped marine access points** (292: ferry terminals, piers, informal landing candidates), and **mapped waterways** (1,196 line segments).
- **How we got it**: a query to the Overpass API (an OpenStreetMap query service) for features inside the Lagos administrative area, run once, offline. The result is cleaned and saved into the project. **The presentation never queries Overpass live.**
- **How it's cleaned**: every feature is clipped to the Lagos State polygon (4 dropped); duplicates removed by OSM id; features with no name are **kept but labelled "Unnamed (OSM 12345)"** — a name is never invented; every feature keeps its OSM id, its original tags, the retrieval date, and a flag `field_verified: false`.
- **Licence**: **ODbL 1.0**. Attribution "© OpenStreetMap contributors" is shown.
- **What it can prove**: that *someone mapped a feature there*. It is real, citable, and often the only spatial evidence available for these areas.
- **What it cannot prove**: completeness (many real facilities are unmapped), currency (a mapped clinic may have closed), official status (a "pier" tag is not a LASWA jetty registration), or navigability (a mapped waterway is not a certified route).
- **The honest headline**: it is *OpenStreetMap mapped health facilities*, never *"Lagos State health facilities"*.

## 2.4 Derived spatial analysis — DERIVED

Calculated by the platform, in memory, from the data above:

- Straight-line distance from each community to the nearest mapped health facility, marine access point, and waterway.
- Count of mapped marine access points within 5 km of each community.
- An **H3 hexagon grid** aggregating the community points (see Part 5).
- A **transparent "access constraints" flag** — a list of named disadvantages a community carries, not a hidden score.
- Scenario catchments — communities within a chosen radius of a candidate point.

All of it is recomputed from live data (cached for 5 minutes inside the server for speed). Nothing is stored as a "fact".

## 2.5 WorldPop (modelled population) — MODELLED — **NOT integrated**

- **Status**: the platform has the adapter and the provenance schema for it, but **no WorldPop raster has been processed** and **no modelled population value is shown anywhere**.
- **Why**: assigning raster population to point communities correctly needs a documented aggregation method (a catchment, a settlement polygon, or an H3 join) that has not been validated. Rather than do it badly, the platform shows **survey-known population only** and marks modelled population "Not recorded".

## 2.6 Earth observation — MODELLED — **NOT integrated**

- **Status**: adapter contract only. **Google Earth Engine is not authenticated.** No NDVI, no satellite flood extent, no shoreline-change layer exists in the platform.
- **What the platform shows instead**: the **field-reported** flood-hazard score, clearly labelled as field evidence.
- **The line to hold**: "Our current flood layer is field evidence. Satellite-derived flood evidence is the next integration." You (the presenter) will connect Earth Engine separately later.

---

# PART 3 — How the platform works

## The flow

```
1. Enumerators collect the survey          →  Supabase database
2. Every page load: the server reads the       (paginated, schema-checked,
   full register from Supabase, live            count-integrity-guarded)
3. Offline, once: OSM extracted + cleaned  →  saved GeoJSON files in the project
   GRID3 boundaries downloaded + validated →  saved GeoJSON in the project
4. Per request: the server joins communities to boundaries and OSM,
   runs Turf (distances) and H3 (hex grid)
5. The result is rendered as a map (MapLibre) + dashboard pages
6. You use it to compare places and test interventions
```

## The small technical section (only if asked)

- **Front end**: Next.js / React / TypeScript. Server-rendered — the browser receives finished pages, not a pile of API calls.
- **Map**: MapLibre GL (open-source; no vendor lock-in, no per-tile billing).
- **Spatial maths**: Turf.js for distance/geometry, H3 for the hex grid. These run on the server, in plain JavaScript. **No PostGIS is required** for what's shown.
- **Database**: Supabase, which is managed PostgreSQL. Could be re-hosted on Lagos State infrastructure.
- **Boundaries**: processed once by a script, then read as files. Same for OSM.
- **Tests**: 119 automated unit tests + 19 browser (end-to-end) tests, all passing, plus a spatial-pipeline validator and a pre-presentation check script.

## Resilience for the demo

- If Supabase is unreachable during the presentation, the platform falls back to a **verified snapshot** (a frozen, count-checked copy of all 134 rows) and shows a **"VERIFIED SNAPSHOT"** banner with the timestamp. It never fails silently and never silently swaps.
- The default basemap is a plain dark map, not satellite — so a failing satellite tile provider cannot break the demo. Boundaries, communities and analysis stay visible regardless.

---

# PART 4 — Main indicators

For each: **what it means · why it matters · how it's calculated · limitation.**

### Needs urgent attention
- **Means**: a community that trips at least one of the most severe single conditions.
- **Matters**: it's the "look here first" flag.
- **Calculated**: `TRUE` if waterborne-disease risk = CRITICAL, **or** medical-evacuation status = HIGHLY_STRANDED, **or** poverty index ≥ 4 (of 5), **or** erosion threat = CRITICAL_DISPLACEMENT. A fixed rule, not a model.
- **Limitation**: binary; a community just below every threshold looks "clear" even if it's stressed on all of them. Use alongside the need score.

### Highest combined need
- **Means**: need score of 5 or more (of a possible 10).
- **Matters**: breadth of disadvantage, not just depth on one axis.
- **Calculated**: count of ticked conditions ≥ 5 (see Need score).
- **Limitation**: a count — it weights every condition equally.

### Need score (0–10)
- **Means**: how many distinct adverse conditions were observed.
- **Calculated**: one point each for: extreme poverty (index ≥ 4); no way out in an emergency emergency access; sanitation deficit; energy poverty; digital exclusion; disaster-preparedness void; critical erosion threat; high flood hazard (score ≥ 4); severe post-harvest loss; geographically isolated (nearest surveyed community > 5 km).
- **Limitation**: unweighted; a missing input can't score, so an incomplete record may understate need. Shown with a completeness %.

### Poverty / deprivation (multi-dimensional poverty index, 0–5)
- **Means**: a composite deprivation score from the survey.
- **Matters**: baseline disadvantage independent of hazard.
- **Calculated**: supplied by the survey view (0–5). ≥ 4 counts as "extreme".
- **Limitation**: the sub-components aren't exposed in the platform; take the score as given from the survey instrument.

### Health / waterborne-disease risk
- **Means**: field-assessed risk of a cholera-type outbreak: LOW / MODERATE / HIGH / CRITICAL.
- **Calculated**: field classification, mapped to weights (0/2/4/6) in the priority score.
- **Limitation**: a risk judgement, not a case count. Present for most but not all communities.

### Sanitation deficit
- **Means**: severe sanitation gap (e.g. open defecation, no safe facility) observed.
- **Calculated**: a field boolean. Present for 134/134? — no: known where recorded; blank stays blank.
- **Limitation**: binary; doesn't grade severity.

### Medical evacuation ("stranding") status
- **Means**: how hard it is to get a patient out in an emergency: ACCESSIBLE / VULNERABLE / STRANDED / HIGHLY_STRANDED.
- **Matters**: this is the riverine-specific killer — obstructed labour, snakebite, trauma.
- **Calculated**: field classification, weighted 0/2/4/6 in the priority score; HIGHLY_STRANDED alone triggers Needs urgent attention.
- **Limitation**: a field judgement about a typical case, not a measured response time.

### Flood exposure (flood-hazard score, 0–5)
- **Means**: field-reported severity/frequency of flooding.
- **Matters**: the dominant climate hazard here.
- **Calculated**: survey score 0–5; ≥ 4 counts as "high flood" in the need score.
- **Limitation**: **field-reported, not satellite-derived.** Present for 74/134. Do not describe it as remotely sensed.

### Erosion (erosion-displacement threat)
- **Means**: LOW / MODERATE / HIGH / CRITICAL_DISPLACEMENT risk of the community losing land/homes.
- **Calculated**: field classification; CRITICAL_DISPLACEMENT adds 5 to the priority score and triggers Needs urgent attention.
- **Limitation**: not tied to a shoreline-change measurement (that would need EO).

### Energy poverty
- **Means**: ENERGY_SECURE vs ENERGY_POOR from the survey.
- **Calculated**: field boolean-like category; ENERGY_POOR scores 1 in the need score.

### Digital exclusion
- **Means**: CONNECTED / LIMITED / EXCLUDED.
- **Calculated**: field category; EXCLUDED scores 1 in the need score.

### Isolation (geographic)
- **Means**: far from any other surveyed community.
- **Calculated**: nearest surveyed community > 5 km (straight-line, from the survey view). Scores 1 in the need score.
- **Limitation**: measured against *surveyed* communities only, and straight-line. A community could be near an unsurveyed settlement.

### Priority score (baseline, additive)
- **Means**: a weighted sum used to rank.
- **Calculated**: `poverty×2 + disease weight + stranding weight + (erosion critical ? 5) + (preparedness void ? 3) + (sanitation deficit ? 3) + flood score`. Nominal range up to ~38.
- **Limitation**: additive and hand-weighted. The Priorities page also offers a configurable 6-factor model for comparison; both are shown, neither is hidden.

---

# PART 5 — Spatial analysis (teach-yourself)

### Point-in-polygon
**Idea**: is this dot inside this shape? Draw a line from the dot to infinity; count how many times it crosses the shape's edge. Odd = inside, even = outside.
**Used for**: "is this community inside Lagos?" and "which LGA polygon contains it?" — which drives the survey-LGA-vs-polygon reconciliation.

### Nearest-neighbour distance
**Idea**: for a community, measure the distance to every candidate facility and keep the smallest.
**Used for**: nearest mapped health facility / marine access / waterway.
**Caveat**: "nearest" here means nearest *in the OSM layer*. If the layer is missing a facility, "nearest" jumps to the next one mapped — which is why a big number can mean a mapping gap rather than real remoteness.

### Straight-line (great-circle) distance — and why it is not travel time
**Idea**: the distance "as the crow flies" over the curved earth (a haversine calculation).
**Why not travel time**: it ignores roads, water channels, the fact that you may need a boat, tides, vehicle availability, and terrain. It is always **less than or equal to** the real travel distance. Treat it as a *lower bound* and a *comparison measure*, never as "how long it takes to get there".

### Buffers / catchments — what the scenario radius means
**Idea**: draw a circle of radius R around a candidate point; everything inside is "in the catchment".
**In the platform**: choose an intervention type and a radius, click the map, and the platform lists the communities inside the circle with their known population and risk mix.
**Caveat**: the circle is a **planning catchment**, not a service area. A real catchment in riverine Lagos is shaped by the water, not a circle. The scenario screen states this the whole time.

### H3
**Idea**: H3 is a global grid of hexagons at fixed sizes ("resolutions"). Every point on earth falls in exactly one hexagon at a given resolution. Hexagons are used because they have uniform neighbour distances (unlike squares).
**In the platform**: resolution **7** (about 5.16 km² per hexagon, ~1.4 km across). Each surveyed community is dropped into its hexagon; the hexagon then carries the count of communities, the count of Needs urgent attention communities, the mean and max need score, and the sum of *known* survey population.
**Why it helps**: it lets you compare "where is need dense?" without the answer being dominated by the fact that Epe LGA is enormous and Apapa is tiny.
**Caveat**: it aggregates *surveyed communities only*. An empty hexagon means "no surveyed community here", not "nothing here".

### OSM evidence — what it can and cannot prove
**Can**: show that a feature was mapped at a location, with a type and often a name; give you a citable open dataset where no official one exists.
**Cannot**: prove completeness, currency, official status, or navigability. Coverage is uneven and contributor-driven.

### Network routing — why it is not claimed
Real travel-time analysis needs (a) a validated navigable network with every segment checked for navigability, (b) a transfer model between road and water, and (c) verified vessel/vehicle speeds. None of those exist yet. So the platform does **not** draw isochrones and does **not** relabel any circle as a "travel-time service area". Straight-line only, said out loud.

---

# PART 6 — Each page (purpose · what to show · what the numbers mean · what NOT to claim · one line you can say)

### Overview (`/`)
- **Purpose**: statewide situation at a glance.
- **Show**: the KPI row (surveyed communities, geolocated, critical), the map, the ranked list.
- **Numbers**: counts and known-value aggregates; "Not recorded" is not zero.
- **Don't claim**: that the totals cover all of riverine Lagos — 7 of 20 LGAs, Epe-heavy.
- **Say**: "We start at community level, not at Local Government aggregate."

### Community Map (`/explorer`)
- **Purpose**: the main GIS workspace.
- **Show**: boundaries on, then toggle OSM health / marine / waterways, then the H3 grid; then the straight-line access panel.
- **Numbers**: straight-line km to nearest mapped facility; access-constraint counts.
- **Don't claim**: that the OSM layers are official registries, or that the distances are travel distances.
- **Say**: "Real Lagos geography, the surveyed communities inside it, and open mapping evidence — with the source of every layer shown."

### Communities (`/communities`)
- **Purpose**: searchable, filterable list.
- **Show**: filter by LGA / district / critical; search.
- **Numbers**: per-community need score and category.
- **Don't claim**: completeness.
- **Say**: "Every surveyed community, filterable, each one clickable through to its full record."

### Community dossier (`/communities/[slug]`)
- **Purpose**: everything known about one community.
- **Show**: people, need flags, health & WASH, access, climate, the local map, and the spatial service context with provenance.
- **Numbers**: survey estimates + the DERIVED OSM distances (kept separate from survey values); withheld items shown as withheld.
- **Don't claim**: that the OSM nearest-facility figure is a verified or routed distance.
- **Say**: "The system goes from Lagos State down to one community without losing the evidence trail."

### Health, water and sanitation (`/health`)
- **Purpose**: where disease, sanitation and evacuation deficits coincide.
- **Show**: combined WASH + evacuation deficit; high-flood + sanitation.
- **Numbers**: overlap counts; population totals are *potential exposure among records with estimates*, not case counts.
- **Don't claim**: causation; case numbers.
- **Say**: "The nearest facility is not necessarily the accessible facility, particularly across water."

### Climate & Environment (`/climate`)
- **Purpose**: flood and erosion exposure from field evidence.
- **Show**: flood-score clusters, erosion burden by LGA, flood × evacuation overlap.
- **Numbers**: field flood score 0–5 (present for 74/134); erosion categories.
- **Don't claim**: satellite-derived flooding; that water proximity *causes* flooding (it's a spatial relationship).
- **Say**: "We keep field-reported hazard evidence separate from satellite-derived evidence — and we haven't claimed the satellite layer yet."

### Accessibility (`/accessibility`)
- **Purpose**: how communities are connected.
- **Show**: survey route mix; distance-to-nearest-mapped-facility banded by LGA; the multiple-constraints table with every factor listed.
- **Numbers**: analytical distance bands (`<2 / 2–5 / 5–10 / >10 km`) — descriptive, **not policy thresholds**; constraint counts.
- **Don't claim**: that the bands are official standards; that constraint count = "critical".
- **Say**: "These settlements cannot be analysed with road geography alone."

### Economy & Livelihoods (`/economy`)
- **Purpose**: occupation, poverty, post-harvest loss.
- **Show**: poverty distribution, harvest-risk overlap with deprivation.
- **Numbers**: poverty index 0–5; category counts.
- **Don't claim**: income figures (not collected).
- **Say**: "Livelihood and deprivation, as observed — not inferred impact."

### Infrastructure (`/infrastructure`)
- **Purpose**: jetty/landing condition, energy, digital.
- **Show**: jetty condition mix (72/134 recorded), energy-poor and digitally-excluded counts.
- **Don't claim**: an asset inventory — it's condition-as-reported, not a register.
- **Say**: "Infrastructure condition as the community reported it."

### Demographics (`/demographics`)
- **Purpose**: population, women, youth, voters.
- **Show**: known-value totals with completeness.
- **Numbers**: population known for 93/134; the rest are "Not recorded", not zero.
- **Don't claim**: census accuracy — these are survey estimates.
- **Say**: "Survey estimates, with the unknowns kept visible."

### Intervention Priority (`/priorities`)
- **Purpose**: rank communities for action, transparently.
- **Show**: the baseline need score next to the configurable 6-factor model; for a top community, the ticked contributors.
- **Numbers**: need score (count) and priority score (weighted sum, up to ~38); the MCDA model needs ≥ 4 of 6 dimensions present.
- **Don't claim**: that either ranking is "the answer" or that it's predictive.
- **Say**: "No mystery score — you can see every factor and adjust the weights."

### Scenarios (`/scenarios`)
- **Purpose**: test where an intervention would reach.
- **Show**: pick type, click map, set radius; read communities covered, known population, unknown-population count, risk composition; change location and compare.
- **Numbers**: everything is "within a straight-line radius"; unknown population is reported as a count, not imputed.
- **Don't claim**: travel time; that it's a proposed government project (it's a planning scenario).
- **Say**: "We can test where an intervention could reach before implementation — as a straight-line planning catchment, not a travel-time isochrone."

### SDG Tracker (`/sdgs`)
- **Purpose**: map the indicators to Sustainable Development Goals (3, 6, 7, 11, 13…).
- **Don't claim**: official SDG reporting status.
- **Say**: "How the field evidence lines up with the SDG framework."

### Data Quality (`/data-quality`)
- **Purpose**: make gaps visible.
- **Show**: completeness by domain; validation-issue register; boundary integrity + LGA reconciliation; OSM checks; survey-vs-OSM health comparison (which currently shows the survey never captured a hospital distance).
- **Numbers**: count integrity pass/fail; % completeness; issue counts.
- **Don't claim**: that OSM incompleteness is a "failure" — it's a coverage limitation.
- **Say**: "If a number is missing, the system does not convert it to zero."

### Data Catalogue (`/data`)
- **Purpose**: the honest dataset register + system-status board.
- **Show**: the status board (LIVE / READY / PARTIAL / NOT CONFIGURED / UNAVAILABLE); each dataset's count, source, licence, use, limitation.
- **Say**: "Every component, including the ones that aren't finished."

### Methodology (`/methodology`)
- **Purpose**: definitions, formulas, evidence classes, method history.
- **Show**: the FIELD / OSM / DERIVED / MODELLED classes; per-indicator formula + caveat; the spatial-methods cards.
- **Say**: "Every definition, every formula, every limitation — for technical review."

### Briefing / Presentation Mode (`/briefing`)
- **Purpose**: the guided 7–10-minute walkthrough (next/previous, arrow keys).
- **Say**: use it if you want the scenes pre-sequenced; otherwise drive the pages directly per the script.

---

# Reading order for the morning

1. This study pack (you're here).
2. `EXECUTIVE_SUMMARY.md` — the one-pager you could hand over.
3. `DEPUTY_GOVERNOR_SCRIPT.md` — rehearse it twice out loud.
4. `DEMO_WALKTHROUGH.md` — click-by-click, with fallbacks.
5. `LIKELY_QUESTIONS_AND_ANSWERS.md` — read all of it once.
6. `PRESENTATION_GUARDRAILS.md` — the phrases to never say, and their safe versions.
7. `MORNING_DEMO_CHECKLIST.md` — do this before you leave and again five minutes before.
8. `TWO_MINUTE_PITCH.md` — in case the meeting collapses to two minutes.
9. `TECHNICAL_CHEAT_SHEET.md` — glance at it; keep it open in a tab.
