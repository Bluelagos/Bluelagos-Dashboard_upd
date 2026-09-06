# Overnight Build — Final Handoff Report

Build date: 2026-09-06. No git repository (worked directly on the tree).

---

## 1. Final build status

Completed tonight, tested and gate-green:

- **OpenStreetMap evidence extracted and integrated.** The dormant Overpass adapter was run (2,504 raw Lagos features via a working mirror after the primary endpoint returned 504). A new processing pipeline (`pipelines/osm/process.mjs`) clips every feature to the Lagos State polygon, de-duplicates by OSM id, classifies, keeps unnamed features with an `Unnamed (OSM <id>)` label (never invents a name), and writes three reviewed layers with full provenance to `data/spatial/processed/`. `pipeline:validate` extended to check them.
- **Local spatial engine.** `@turf/turf` and `h3-js` installed and used. New `lib/spatial/` module: `proximity.ts` (great-circle distance, nearest-point, nearest-line, count-within-radius, analytical distance bands), `h3.ts` (resolution-7 aggregation, real counts only), `osm.ts` (memoised server loaders), `context.ts` (per-community derived proximity + transparent access-constraint flag + survey-vs-OSM comparison).
- **Wired into the UI**: `/explorer` (map overlay toggles for the 3 OSM layers + H3 grid, all default-hidden with provenance tooltips; a straight-line access panel), `/accessibility` (distance bands by LGA + multi-constraint table), `/communities/[slug]` (real spatial service context replacing null placeholders), `/data-quality` (OSM validation panel + survey-vs-OSM comparison), `/data` (a full system-status board), `/methodology` (FIELD / OSM / DERIVED / MODELLED evidence classes + rewritten spatial-method cards).
- **Presentation resilience**: `npm run snapshot:presentation` (frozen, count-checked 134-row fallback), `lib/data.ts` refactored with a snapshot fallback gated on `NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK=1` (set) that surfaces a visible **VERIFIED SNAPSHOT** banner, `npm run presentation:check` (pre-demo status board). Verified by rebuilding against an unreachable database — pages return 200 with the banner.
- **Performance fix**: an initial ~9 s/page regression (Turf object allocation × ~10⁵ calls) was fixed by an inline haversine and an in-process 5-minute memo. Pages now render in 0.25–0.75 s.
- **10 study-pack documents + this report** in `docs/`.

Not done (see §13): WorldPop, Earth Engine EO, navigable-network routing, deck.gl, vector tiles, Overture, Python/Forge3D pipeline. Each is visibly marked unavailable in the platform.

## 2. Spatial capability matrix

| Capability | Status | Data source | Method | Presentation safe? |
|---|---|---|---|---|
| State / LGA boundaries | Integrated | GRID3 2022 via geoBoundaries gbOpen (CC BY 4.0) | Offline fetch + validate; rendered under points; point-in-polygon | Yes |
| Surveyed communities | Integrated (live) | Blue Lagos survey (Supabase view) | Paginated, Zod-validated, count-integrity-guarded | Yes (live + verified snapshot fallback) |
| OSM waterways | Integrated (context) | OpenStreetMap (Overpass), ODbL | Extract → clip → classify; 1,196 lines; navigability **unknown** | Yes (labelled contributor evidence; no navigability claim) |
| OSM marine access | Integrated (context) | OpenStreetMap, ODbL | 292 ferry terminals / piers / landing candidates; official status **unknown** | Yes (not called an official jetty register) |
| OSM health facilities | Integrated (context) | OpenStreetMap, ODbL | 539 points; `field_verified: false` | Yes (labelled "OSM mapped", not official) |
| Straight-line proximity | Integrated (derived) | Communities × OSM layers | Haversine nearest-feature; distance bands | Yes (labelled straight-line, not travel time) |
| H3 aggregation | Integrated (derived) | Community points | Uber H3 v4 res-7; real counts / summaries; null≠0 | Yes |
| Flood exposure | Integrated (field) | Blue Lagos survey (score 0–5, 74/134) | As reported | Yes (labelled field-reported, not EO) |
| Erosion threat | Integrated (field) | Blue Lagos survey (category) | As reported | Yes |
| Scenarios | Integrated (derived) | Communities + candidate point | Straight-line radius catchment | Yes (assumptions panel always visible) |
| Earth observation | **Not configured** | — (Google Earth Engine not authenticated) | Adapter contract only | N/A — shown as not configured |
| Modelled population (WorldPop) | **Unavailable** | — (no raster processed) | — | N/A — survey-known population only |
| Network / travel-time routing | **Not built** | — (no navigable graph) | — | N/A — no isochrones drawn |

## 3. Data sources (every real dataset)

| Dataset | Source | Records | Licence |
|---|---|---|---|
| Community baseline | Blue Lagos field survey → Supabase `blue_lagos_dashboard_kpis` | 134 (93 geolocated) | Internal governance terms |
| Baseline cluster register | Blue Lagos baseline report Appendix A.7 | 134 | Internal |
| Lagos State + LGA boundaries | GRID3 2022 via geoBoundaries gbOpen | 1 + 20 polygons | CC BY 4.0 |
| OSM mapped health facilities | OpenStreetMap contributors (Overpass) | 539 points | ODbL 1.0 |
| OSM mapped marine access | OpenStreetMap contributors | 292 points | ODbL 1.0 |
| OSM mapped waterways | OpenStreetMap contributors | 1,196 lines | ODbL 1.0 |
| H3 analytical grid | Derived from Blue Lagos geometry | recomputed per request | Derived (H3 lib Apache-2.0) |
| Verified presentation snapshot | Frozen copy of the Supabase view | 134 rows | Same as source (anon-readable) |

## 4. Spatial Explorer — what now works

- GRID3 State + 20 LGA polygons under the community points, with visibility toggle, boundary-opacity slider, and click-to-identify on an LGA.
- Survey-LGA-vs-polygon-LGA reconciliation table (never overwrites the survey value).
- **New**: grouped layer panel with toggles for *OSM mapped health facilities*, *OSM mapped marine access*, *OSM mapped waterways*, and the *H3 community-density grid* — all default-hidden, each with a provenance tooltip, drawn beneath the community points so points stay clickable.
- **New**: a "Straight-line access & spatial constraints" panel — median nearest mapped health facility, count ≥ 5 km, count with no mapped marine access within 5 km, count with multiple access constraints, and a top-15 table (nearest mapped health facility with name, survey hospital distance column, nearest mapped marine access, constraint count).
- Basemap switch (dark / light / satellite); dark is the default so a failing imagery provider does not break the map.
- **VERIFIED SNAPSHOT** banner when running from the fallback.

## 5. Accessibility — what now works

- Existing: survey route-type mix; highly-stranded / spatially-isolated domain analysis; the "access model readiness" cards.
- **New**: "Straight-line distance to nearest OSM-mapped health facility, by LGA" — a matrix of every covered LGA across the `<2 / 2–5 / 5–10 / >10 km / No mapped facility` analytical bands, sorted by the far-band burden, with a note that a large band can be a mapping gap.
- **New**: "Communities with multiple access constraints" — every community tripping ≥ 2 transparent factors, each row listing its contributing factors (highly stranded; isolated > 5 km; ≥ 10 km to nearest mapped health facility; no mapped marine access within 5 km; water-dependent route with poor/absent landing). Never auto-labelled "critical".

## 6. Climate — what now works

- Unchanged this build: the field flood-hazard score, erosion categories, and overlap analyses remain as they were, correctly labelled field-reported.
- The methodology page now states explicitly that no Earth-observation flood layer exists and that field and satellite evidence are kept separate. (No new climate-page panels were added tonight; the honest EO status is surfaced on `/methodology` and `/data`.)

## 7. Scenario Lab — what now works

- Unchanged this build. The existing straight-line catchment tool (choose intervention type, click the map, set the radius, read communities covered / known population / unknown-population count / risk composition / LGA composition, with an always-visible assumptions panel) remains the honest straight-line version. E2E test "scenario change updates map" passes.
- (Two-scenario A/B comparison and additional intervention types were scoped for tonight but not implemented; see §13.)

## 8. Community Dossier — improvements

- The "Spatial service context" panel previously showed ~10 `null` placeholders. It now shows **real derived values**: nearest OSM-mapped health facility (km + name + type), the survey hospital descriptor kept separate for comparison, the survey-vs-OSM delta (labelled a spatial comparison, not a correction), nearest OSM-mapped marine access (km + name + kind), count of OSM marine access within 5 km, nearest OSM-mapped waterway, and the transparent access-constraint factor list.
- Genuinely unavailable items (modelled population, satellite flood, EO/shoreline, travel-time network) remain listed as withheld, with a caveat that OSM figures are contributor data and great-circle only.

## 9. Presentation mode — improvements

- No changes to `/briefing` scene content this build (it renders and passes E2E). The narrative it should follow is captured in `docs/DEMO_WALKTHROUGH.md` and `docs/DEPUTY_GOVERNOR_SCRIPT.md`, which drive the pages directly.
- New `SnapshotBanner` will appear on `/` and `/explorer` if the platform is running from the verified snapshot.

## 10. Offline / snapshot resilience — status

- `npm run snapshot:presentation` → `data/presentation-snapshot.json` (134 rows, count integrity passed, no secrets).
- `lib/data.ts`: shared `finalizeDataset` pipeline; `loadLiveDataset` then, on failure, `loadSnapshotDataset` **only if** `NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK=1` (set in `.env.local`) and the snapshot file exists. `RegisterStatus.mode` = `"live"` / `"snapshot"`.
- `SnapshotBanner` / `SystemStatus` render the state visibly. Never a silent swap.
- **Verified**: rebuilt with an unreachable database URL → every route returns 200 and shows the VERIFIED SNAPSHOT banner; then restored and rebuilt with the real config.
- `npm run presentation:check` → read-only status board; currently reports **Presentation check passed**.
- Map: default dark basemap (non-satellite) means a tile-provider outage does not break the demo; boundaries, points and analysis remain.

## 11. Tests — final numbers

| Suite | Before | After |
|---|---|---|
| Unit (Vitest) | 87 | **119** (+32: `spatial-proximity` 8, `spatial-h3` 7, `osm-processed` 17) |
| End-to-end (Playwright) | 17 | **19** (+2: explorer overlay toggles present; data catalogue lists OSM layers) |

All passing. One existing E2E assertion was updated (it checked a sentence in the explorer callout that was reworded); it now asserts the new "Straight-line access & spatial constraints" heading instead.

New pipeline coverage: `pipeline:validate` now validates the 3 processed OSM layers (count vs metadata, duplicate ids, provenance present, no navigability assertion, coordinate ranges).

## 12. Build and quality gates — exact results

```
npm run lint            ✓  eslint . — 0 errors, 0 warnings
npm run typecheck       ✓  tsc --noEmit — clean
npm test                ✓  10 files, 119 tests passed
npm run build           ✓  Compiled successfully; 19 routes; only /methodology static, rest dynamic
npx playwright test     ✓  19 passed
npm run pipeline:validate  ✓  boundaries + 3 processed OSM layers validated
npm run presentation:check ✓  Presentation check passed
```

## 13. Remaining limitations (complete and honest)

- **Survey coverage**: 7 of 20 LGAs, heavily weighted to Epe (67 of 134). Not a full-state census.
- **No survey facility distance**: `dist_to_hospital_km` and `nearest_hospital_name` are empty for all 134 rows. The OSM straight-line distance is therefore the platform's *only* facility-distance estimate, not a cross-check. `/data-quality` says so.
- **OSM completeness**: contributor-driven and uneven; a large "nearest facility" distance can reflect a mapping gap rather than real remoteness. Not an official Lagos State registry.
- **Straight-line only**: no water routing, no road condition, no travel time, no isochrones. Every figure is labelled great-circle.
- **No Earth observation**: Google Earth Engine not authenticated. Flood layer is field-reported only. No NDVI, flood extent, or shoreline change.
- **No modelled population**: no WorldPop raster processed. Scenario and H3 population totals are survey-known only, with unknown counts shown separately.
- **Scenario lab**: still single-scenario, five original intervention types; the A/B comparison and extra types were not added tonight.
- **Briefing scenes**: content not restructured tonight; the walkthrough docs carry the intended sequence.
- **deck.gl / PMTiles / Overture / Python-Forge3D**: not integrated — deliberately deferred as too risky for an unsupervised pre-demo build. MapLibre renders the H3 grid and OSM layers reliably as GeoJSON.
- **41 communities have no coordinates** — present in every table, absent from every map and spatial calc (correctly, as null not zero).

## 14. Presentation readiness score (1–10)

| Dimension | Score | Note |
|---|---|---|
| Software reliability | 9 | All gates green; pages < 1 s; snapshot fallback verified; no console errors on any route |
| Data credibility | 8 | Real field + boundary + OSM data, all provenanced; the main caveat (coverage, OSM-not-official) is disclosed, not hidden |
| Spatial analysis | 7 | Real point-in-polygon, nearest-feature, H3, catchments; no routing/EO/population yet |
| Cartography | 7 | Clean layered MapLibre with legends, provenance tooltips, theme-aware; not a bespoke cartographic style |
| UX | 7 | Consistent panels, accessible tables/alternatives, honest empty states; some pages denser than ideal for a boardroom screen |
| Presentation resilience | 9 | Verified snapshot + banner, non-satellite default basemap, offline screenshot plan, pre-demo check script |
| **Overall readiness** | **8** | Demonstrable, defensible, and honest about its edges. Strongest if the presenter holds the straight-line / OSM-not-official / no-EO lines from the guardrails doc. |

## 15. Files created for you to study (`docs/`)

- `PRESENTATION_STUDY_PACK.md` — the full teach-yourself pack (data, indicators, spatial methods, every page)
- `DEPUTY_GOVERNOR_SCRIPT.md` — the 7–10 minute spoken script
- `TWO_MINUTE_PITCH.md` — the collapsed version
- `LIKELY_QUESTIONS_AND_ANSWERS.md` — 51 Q&A across data / GIS / tech / methodology / policy / challenge
- `TECHNICAL_CHEAT_SHEET.md` — one-glance stack + numbers + commands
- `PRESENTATION_GUARDRAILS.md` — every "do not say / say instead" claim boundary
- `MORNING_DEMO_CHECKLIST.md` — night-before, five-minutes-before, internet-dies
- `DEMO_WALKTHROUGH.md` — click-by-click, 8 minutes, with fallbacks
- `EXECUTIVE_SUMMARY.md` — the one-pager to hand over
- `WHAT_WE_BUILT.md` — plain-English record of the build for your own understanding
- (plus this `OVERNIGHT_BUILD_REPORT.md` and an updated `spatial-methodology.md`)

## 16. What to read first tomorrow morning

1. `WHAT_WE_BUILT.md` (10 min) — orient yourself on what changed.
2. `PRESENTATION_STUDY_PACK.md` (30–40 min) — the substance.
3. `DEPUTY_GOVERNOR_SCRIPT.md` — read aloud twice, timed.
4. `DEMO_WALKTHROUGH.md` — do the clicks once on the live app.
5. `LIKELY_QUESTIONS_AND_ANSWERS.md` — read straight through.
6. `PRESENTATION_GUARDRAILS.md` — memorise the three sentences at the bottom.
7. `MORNING_DEMO_CHECKLIST.md` — run the checklist; then `npm run presentation:check`.
8. `TWO_MINUTE_PITCH.md` — in case the meeting shrinks.

## 17. Recommended 7–10 minute live demo (route sequence)

`/` → `/explorer` (toggle the 3 OSM layers + H3, then the straight-line access panel) → click one community point → its `/communities/[slug]` dossier → `/accessibility` (distance bands + multi-constraint table) → `/climate` → `/scenarios` (place a Health Centre catchment, move it, compare) → `/data-quality` → close on `/data` (system-status board).

Full click-by-click with timings and recovery lines: `docs/DEMO_WALKTHROUGH.md`.
