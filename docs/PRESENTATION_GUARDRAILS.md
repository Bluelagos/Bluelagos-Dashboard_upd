# Presentation Guardrails — "Do Not Say This"

*Every claim boundary in the platform. Left column loses you credibility the moment a technical person in the room pushes back. Right column is defensible.*

---

## Distance and travel

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "This shows travel time to the nearest clinic." | "This is a straight-line distance to the nearest mapped clinic — a screening measure, not travel time." |
| "It's a 20-minute catchment." | "It's a 5-kilometre straight-line planning catchment. Travel time isn't modelled yet." |
| "The scenario shows the service area." | "The scenario shows everything within a straight-line radius of the candidate point." |
| "We routed it by water." | "We have mapped waterway lines, but navigability isn't assessed, so we don't route on them." |
| "These communities are 10 km from care." | "These communities are 10 km in a straight line from the nearest *mapped* facility — often further by the actual water or road route." |

## Facilities and jetties

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "These are all the health facilities in Lagos." | "These are health facilities currently mapped in OpenStreetMap — open, contributor-maintained data, not the official State registry." |
| "This is the Lagos jetty register." | "These are ferry terminals, piers and landing points mapped in OpenStreetMap. An official jetty register would come from LASWA." |
| "Every community's nearest facility is shown." | "The nearest *mapped* facility is shown. If a real facility isn't in OpenStreetMap, our distance is an overestimate for that community." |
| "This facility is operational." | "This facility is mapped. We haven't verified that it's open or its service level." |

## Satellite / Earth observation

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "Satellite data confirms the flooding." | "Our flood layer is field-reported — what communities told us. Satellite-derived flood evidence is the next integration." |
| "This is the flood extent." | "This is the field flood-hazard score, community by community. It isn't a mapped flood extent." |
| "We used Sentinel / Landsat imagery." | "We haven't connected Earth observation yet. The pipeline is built for it; Earth Engine authentication is a separate step." |
| "The shoreline has moved X metres." | "Erosion threat here is a field classification. Measured shoreline change needs the EO layer, which isn't connected." |

## Population

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "The catchment covers 50,000 people." | "The catchment covers about 50,000 in *known* survey population — some communities inside it have no population estimate, and that count is shown separately." |
| "Population is from WorldPop / the census." | "Population figures are survey estimates. Modelled population isn't integrated." |
| "Zero people affected." | "No population estimate is available for those communities — it's shown as Not recorded, not zero." |

## Boundaries and geography

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "These are the official Lagos State boundaries." | "These are the GRID3 2022 boundaries via geoBoundaries — the set used across the Nigerian development sector. Planning-grade, generalised, not cadastral." |
| "The surveyor got the LGA wrong." | "The declared LGA and the boundary polygon disagree here — could be a near-edge generalisation or a survey note. We flag it, we don't overwrite it." |
| "Every community is inside its LGA." | "A few coastal points fall just outside their expected polygon — the boundary is generalised near the water. Those are flagged on Data Quality." |

## Analytics and AI

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "The AI tells you where to build." | "The platform compares locations on the same transparent spatial criteria. The decision stays with you." |
| "It predicts which communities will flood." | "It describes observed conditions. It doesn't forecast." |
| "It's an AI-powered optimiser." | "It's transparent arithmetic and standard GIS operations — every number traces to a formula and a source." |
| "The model decided these are critical." | "'Needs urgent attention' is a fixed published rule — four named conditions. No model, no black box." |
| "The heatmap shows risk." | "That's community concentration — a count of surveyed communities per hexagon. It isn't a risk surface." |

## Coverage

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "We've surveyed riverine Lagos." | "We've surveyed 134 communities across 7 of the 20 LGAs, heaviest in Epe. It's a strong sample, not a full census." |
| "This is every community." | "This is every *surveyed* community. There are unsurveyed settlements, and an empty hexagon means 'not surveyed here', not 'nothing here'." |

## Data quality

| ❌ Do NOT say | ✅ Say instead |
|---|---|
| "The data is complete." | "Completeness varies by field — it's shown per record and per domain. Missing is kept as missing." |
| "OpenStreetMap coverage is a problem with our system." | "Uneven OpenStreetMap coverage is a limitation of open data — the fix is connecting the official registries." |

---

## Naming things on screen

The interface deliberately uses plain language, with the technical term one
click away. Use the words the audience can see; reach for the technical term
only when a technical person asks for it.

| On screen | If a specialist asks |
|---|---|
| Needs urgent attention | "A published hard-stop rule — four named conditions, no model." |
| Community need score | "The baseline Blue Lagos need score: ten binary conditions, one point each, equally weighted." |
| Distance to health facility · *straight-line estimate* | "Haversine nearest-neighbour against the OpenStreetMap health layer, precomputed." |
| Community concentration | "An H3 hexagonal grid at resolution 7 — roughly 5 km² per cell." |
| Shared service areas | "Density-based geographic clustering, with candidate siting screened by point-in-polygon against the state boundary and a buffer on mapped waterways." |
| How far it reaches | "A straight-line service radius. Not an isochrone — we have no validated navigable network." |
| Not recorded | "Null. Preserved as null throughout; never substituted with zero." |

**Every one of these is available in the room.** Hover any headline figure and
click the small **i** — the panel gives you the plain explanation, the source
and the technical method. If you are unsure, open it and read from it rather
than improvising. The Methodology page holds the full version.


## The three sentences to have ready

1. "Every distance on screen is straight-line — a screening measure, not travel time."
2. "The facility and jetty layers are OpenStreetMap — open mapping evidence, not an official Lagos State registry."
3. "Where we don't have a number, it says 'Not recorded' — the system never turns a blank into a zero."
4. "If you want to know how any figure is calculated, there's an information button on it — I can open it right now."

## If you're pushed on something you're unsure of

Say: **"I'd need to confirm the exact figure — let me follow up."** Never improvise a number or a capability.
