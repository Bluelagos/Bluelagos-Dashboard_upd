# Likely Questions & Answers

*Concise, defensible answers. None of these overclaim. If you don't know, say "I'd need to confirm that" — it is always better than guessing.*

---

## Data

**1. Where did this data come from?**
Three sources. The community data is a Blue Lagos field survey of 134 riverine communities. The boundaries are the GRID3 2022 Lagos set via geoBoundaries. The facility, jetty and waterway layers are from OpenStreetMap, extracted and cleaned. Every layer's source is shown in the platform.

**2. How many communities?**
134 surveyed. 93 have GPS coordinates; 41 have survey answers but no fixed location yet, and they stay visible in every table.

**3. Which Local Governments does it cover?**
Seven of the twenty: Epe, Ojo, Amuwo-Odofin, Badagry, Ibeju-Lekki, Apapa and Eti-Osa — heaviest in Epe. It's a riverine sample, not a full-State census, and the platform doesn't pretend otherwise.

**4. How recent is it?**
The survey is read live from the database every time a page loads, so it's as current as the database. The OpenStreetMap extract was taken on the build date and is shown with that date. Boundaries are the 2022 GRID3 vintage.

**5. Is the population data census data?**
No. They are survey estimates. Where a community has no estimate, the platform shows "Not recorded" — it never fills it with zero. Census or WorldPop modelled population is not integrated.

**6. How do you handle missing data?**
Missing stays missing. Totals are sums of known values with a completeness percentage attached. If the database row count and the fetched count disagree, the platform refuses to display a total rather than show a wrong one.

**7. Why is `distance to hospital` blank everywhere?**
The survey instrument didn't capture a numeric facility distance. That's why we added the OpenStreetMap-derived straight-line distance — it's the platform's first facility-distance estimate. The Data Quality page states this explicitly.

**8. Can we see the raw survey?**
The platform reads a defined analytical view. The underlying survey forms and raw responses sit with the Blue Lagos survey team; those can be shared through the proper channel.

**9. Who owns this data?**
The field survey is Blue Lagos'. The boundaries are CC BY 4.0 (free to use with attribution). OpenStreetMap is ODbL (free to use with attribution and share-alike). Nothing here has a licence that blocks Lagos State use.

**10. How big is the dataset?**
Small and fast — 134 community rows, ~2,000 cleaned OSM features, 21 boundary polygons. It loads in well under a second.

---

## GIS

**11. How did you determine which LGA a community is in?**
Two ways, and we compare them. The surveyor recorded an LGA. Separately, we test which GRID3 LGA polygon geometrically contains the GPS point (point-in-polygon). Where they disagree, the Data Quality and Explorer pages list it. We never overwrite the surveyor's value.

**12. Why straight-line distance and not a real route?**
Because a validated route requires a navigable network with every segment checked, a road-to-water transfer model, and verified speeds — none of which exist for this corridor yet. Straight-line is an honest lower bound and a fair comparison measure. We label it as straight-line everywhere and we never call it travel time.

**13. Why not route by water?**
Same reason. We have mapped waterway *lines* from OpenStreetMap, but navigability is not assessed — a line on a map is not a certified channel. Building a real water routing graph is exactly the kind of thing LASWA data would let us do properly.

**14. What is H3?**
A global grid of equal-size hexagons. Every point falls in one hexagon. We use it to aggregate community points so we can compare where need is dense without the picture being distorted by very different LGA sizes. We use resolution 7 — about 5 square kilometres per hexagon.

**15. Are your H3 numbers modelled?**
No. Each hexagon just carries counts and averages of the surveyed communities inside it — community count, critical count, mean and max need score, sum of known population. Nothing is interpolated. An empty hexagon means no surveyed community there.

**16. How accurate are the boundaries?**
They're the GRID3 2022 set — planning-grade, widely used across the Nigerian development sector, aligned with NPC/OCHA usage. They're generalised, not cadastral. Near the coast and lagoon they can differ from a survey boundary by tens of metres, which is why a few community points fall just outside their expected polygon — the platform flags those rather than hiding them.

**17. What coordinate system?**
WGS84 longitude/latitude — EPSG:4326 / OGC:CRS84 — throughout. Every input was checked into that range by the processing pipeline.

**18. How do you know the OSM facilities are real?**
We know a contributor mapped them — with a type, usually a name, and coordinates inside Lagos. We don't claim they're all operational or that the list is complete. That's why the label is "OpenStreetMap mapped health facilities", not "Lagos State health facilities".

**19. What if a community is near an unmapped clinic?**
Then our "nearest mapped facility" distance is an overestimate for that community. That's a coverage limitation of open data, and it's the argument for connecting the official LASHMA registry.

**20. Can I measure a distance on the map myself?**
The Explorer map supports layer toggles, feature identify and reset-to-Lagos. Freehand measurement and drawing are on the roadmap; the scenario tool already does radius catchments interactively.

**21. Do you do any interpolation or heatmap smoothing?**
No continuous risk surface. The H3 grid is discrete counts. If we ever show a density visual it's labelled as "community concentration", not a hazard surface.

---

## Technology

**22. What is the backend?**
Supabase, which is managed PostgreSQL, holding the survey view. The application is a server-rendered Next.js app that reads that view live and does the spatial maths in Node.

**23. What is Supabase?**
A hosted PostgreSQL database with an access layer. It can be replaced with a Lagos State-hosted PostgreSQL instance without changing the application logic.

**24. Is the platform live?**
Yes — every page reads current data at load time. For the demo there's also a verified frozen snapshot it falls back to if the network drops, and it clearly labels the screen "VERIFIED SNAPSHOT" when that happens.

**25. Can government host this?**
Yes. It's a standard web application plus a PostgreSQL database and a few static data files. It can run on Lagos State infrastructure or a government cloud tenancy. No proprietary GIS server, no per-seat licence.

**26. Can it scale?**
The application layer is stateless and scales horizontally. The current dataset is tiny. Scaling to all of Lagos means more survey rows and larger boundary/feature files — at which point we'd move the big geometry to vector tiles, which is a known, cheap step.

**27. Is it secure?**
The browser only ever gets a read-only key to a read-only view — no write access, no admin key on the front end. Security headers are set (clickjacking, MIME-sniffing, referrer, permissions). CSV export is sanitised against formula injection. No secrets in the code.

**28. Can it work offline?**
Partly. The verified snapshot plus the committed boundary and OSM files mean the core map and dashboards work without the live database. Fully offline (no internet at all) would also need the basemap tiles packaged, which is doable but not done.

**29. What happens if OpenStreetMap or the tile server goes down during the demo?**
Nothing breaks. The OSM data is already saved in the project — we never call it live. The default basemap is a plain map; if even that fails, the boundaries, communities and analysis still render.

**30. Is this built on ArcGIS?**
No — it's open-source (MapLibre, Turf, H3). That's deliberate: no licence cost, no vendor lock-in, and it can be hosted anywhere.

---

## Methodology

**31. How is "Critical" defined?**
Needs urgent attention is a fixed rule: waterborne-disease risk CRITICAL, or medical-evacuation status HIGHLY_STRANDED, or poverty index 4+ of 5, or erosion threat CRITICAL_DISPLACEMENT. Highest combined need is a need score of 5 or more out of 10. Both definitions are on the Methodology page.

**32. How is priority calculated?**
Two ways, both shown. A baseline additive score: poverty ×2, plus fixed increments for disease risk, evacuation status, critical erosion, no disaster plan, sanitation deficit, plus the flood score. And a configurable six-factor model where you can move the weights and see the ranking change. Neither is hidden and neither is called "the answer".

**33. Why are weights used at all?**
Because "worst first" needs *some* way to combine different kinds of disadvantage. We keep the weights explicit and adjustable rather than burying them. If Lagos State prefers different weights, they're a settings change.

**34. Is this AI?**
No. There's no machine-learning model and no chatbot. It's transparent arithmetic and standard GIS operations — every number can be traced to a formula and a source.

**35. Is it predictive?**
No. It describes current, observed conditions and computes distances and overlaps from them. It does not forecast floods, disease or displacement.

**36. Why should we trust a straight-line number for decisions?**
You shouldn't trust it as a travel time — and we never present it as one. You *can* use it to compare communities on a consistent basis and to spot the ones that are clearly far from everything. It's a screening measure, not a routing result.

---

## Policy

**37. How does government actually use this?**
To screen and compare: which communities to visit first, where a facility or jetty would reach the most people at risk, which LGAs carry the most overlapping conditions. And to test a proposed intervention's catchment before budgeting.

**38. How do we decide where to build a facility with this?**
Open the Scenarios, place the candidate, set a catchment radius, and read how many communities and how much known population fall inside, and their risk mix. Do the same for a second candidate and compare on identical criteria. It's a decision input, not a decision.

**39. Can ministries update the data?**
Not yet through the interface. Today the survey is updated by the Blue Lagos team in the database. Ministry self-service is part of the operational-integration step — connecting LASWA, LASEMA, LASHMA so each maintains its own layer.

**40. Can this monitor projects once they're built?**
Not currently. It's a planning and screening tool. Project monitoring — tracking whether a built facility changed access or outcomes — is a natural extension once operational data flows in.

**41. Can it cover all of Lagos?**
The application can. The data can't yet — it's 7 of 20 LGAs. Extending coverage is a survey exercise plus loading the rest of the boundary and facility data, which the platform already supports.

**42. Can it integrate LASWA / LASEMA / LASHMA data?**
That's the headline next step. LASWA gives verified waterways and jetties — which unlocks real water routing. LASHMA gives the official facility registry — which replaces the OpenStreetMap layer. LASEMA gives incident and response data — which turns planning into operations. The platform is structured to take each as its own provenance-tagged layer.

---

## Challenge questions

**43. What is your biggest limitation?**
Coverage and evidence type. The survey is 7 of 20 LGAs, the facility layer is open data not an official registry, distances are straight-line, and there's no satellite or modelled-population layer yet. None of that is hidden — it's on the system-status board.

**44. What if the OpenStreetMap data is wrong?**
It will be, in places — incomplete or out of date. That's why it's labelled as contributor evidence, kept separate from survey values, and why the Data Quality page shows what was extracted and what was dropped. The fix is the official LASHMA registry.

**45. What if the survey is wrong?**
Field surveys have error. The platform mitigates it by validating every value against an expected range, flagging conflicts (like the LGA reconciliation), showing completeness per record, and never converting a blank to a zero. It surfaces doubt rather than smoothing it.

**46. Are these official boundaries?**
They're the GRID3 2022 boundaries — the set used across the Nigerian humanitarian and development sector, aligned with NPC/OCHA usage. They're planning-grade and generalised. If Lagos State has an official cadastral set, we can swap it in.

**47. Why should government trust this over its own systems?**
It's not a replacement for government systems — it's a lens that puts field evidence and open spatial data together at community level, which the LGA-level systems don't do. Its value grows when it's *connected* to the government systems, not instead of them.

**48. What's new here? We already have dashboards.**
Three things a dashboard doesn't do: it works at individual-community level with real geometry; it keeps evidence classes separate and labelled (field vs open-mapping vs derived vs not-yet-available); and it lets you test an intervention's catchment interactively. And it counts its own gaps.

**49. How is this different from an ArcGIS dashboard or Power BI?**
Those are excellent for showing data you already trust. This adds the spatial analysis layer — point-in-polygon reconciliation, nearest-facility computation, H3 aggregation, scenario catchments — and an explicit evidence-provenance discipline, on an open stack with no licence cost.

**50. Could you have faked all these numbers?**
Everything traces to a source you can inspect: the live database view, the GRID3 boundary files, the OpenStreetMap features with their IDs and tags. The derived numbers are recomputed on the fly from those. And 184 automated unit tests plus 41 end-to-end tests check the maths and the interface. Nothing in the platform is a sample or placeholder presented as real — where something isn't available, it says "Not recorded" and why.

**51. What happens after today?**
Two asks: a decision in principle on connecting LASWA/LASEMA/LASHMA data, and a nominated pilot corridor where we run this as the live planning view for a quarter.

---

## About the interface itself

**52. How do I find out how a number was calculated, in the room?**
Hover the figure and click the small **i**. A panel opens with what it shows,
why it matters, how it is worked out in plain words, the source, and a
"Technical detail" section with the exact method. Every headline figure has one.
The Methodology page holds the same explanations in full, and the panel links
straight to the relevant section.

**53. Why does it say "Not recorded" instead of a number?**
Because the survey did not capture that value for that community. The platform
never substitutes a zero, an average or a modelled estimate for a missing
answer — a blank stays a blank, and the count of blanks is shown alongside every
total. That is deliberate: a total that quietly includes invented values is
worse than a total that admits its coverage.

**54. Can this be shown in a lighter appearance for print or a lit room?**
Yes. The toggle in the top bar switches between **Deep Coast** (dark) and
**Warm Coast** (light). It changes the whole interface including maps and
charts, and the choice is remembered. Deep Coast reads better on a projector;
Warm Coast reads better in a lit room and in printed screenshots.

**55. Why do some map layers take a moment to appear?**
Because they are only fetched when you ask for them. The waterway network alone
is most of a megabyte, and most people never switch it on — loading it up front
would slow every page for everyone. Switching a layer on fetches it once, then
the browser keeps it.

**56. Is there a version of this I can present from directly?**
Yes — `/briefing`. Eleven scenes, arrow keys to move, and `N` for presenter
notes that give you the words and short answers to the likely questions. It is
built for a projector and deliberately curated: no filters, no tables, no layer
controls.

**57. Is the interface accessible?**
It is built to be. Every clickable card is keyboard-reachable, panels trap and
restore focus, every chart has a screen-reader description and a data table with
the same filtering available as buttons, every map has a community list
alternative, colour is never the only signal, and the whole interface honours
the operating system's reduced-motion setting. It has not been through a formal
external audit, and that would be the honest answer if pressed.
