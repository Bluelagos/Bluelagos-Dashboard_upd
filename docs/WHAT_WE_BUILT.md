# What We Built — Blue Lagos Riverine Intelligence System

*Plain-English record of the platform and the final overnight build. For your own understanding, not marketing.*

Last build: 2026-09-06. All quality gates green (lint, typecheck, 119 unit tests, production build, 19 end-to-end browser tests, spatial pipeline validation, presentation check).

---

## 1. What existed before tonight

A working decision dashboard for Lagos riverine communities:

- **Live field data** from a Supabase database (the `blue_lagos_dashboard_kpis` view), read at page-load time through a strict, validated pipeline: deterministic pagination, runtime schema checks, a count-integrity guard (if the database says 134 rows, exactly 134 must arrive or the page refuses to render a total), and null-preserving mapping (a blank value never becomes a zero).
- **134 surveyed communities**, of which **93 have GPS coordinates** and 41 are survey-only (attributes but no location).
- Pages for overview, communities, community dossiers, health & WASH, climate, accessibility, economy, infrastructure, demographics, intervention priorities, a scenario lab, an SDG tracker, a data catalogue, a data-quality page, a methodology page, and a presentation/briefing mode.
- A MapLibre map with the **GRID3 2022 Lagos State + 20 LGA boundary polygons** (from geoBoundaries, CC BY 4.0), point-in-polygon containment checks, and a survey-LGA-vs-polygon-LGA reconciliation check.
- Hardened CSV export, accessible map/chart alternatives, dynamic (always-fresh) rendering of live routes.

## 2. What changed tonight

### a. OpenStreetMap evidence — extracted, cleaned, integrated

The OSM extraction adapter existed but had never been run. Tonight it was run (via a working Overpass mirror after the main endpoint timed out), producing **2,504 raw Lagos features**. A new processing pipeline (`pipelines/osm/process.mjs`) then:

- clipped every feature to the Lagos State polygon (point-in-polygon), dropping 4 outside;
- removed duplicates by OSM id;
- kept unnamed features but labelled them `Unnamed (OSM <id>)` — **no name is ever invented**;
- split them into three reviewed layers, each feature carrying its OSM id, original tags, retrieval date, a confidence label (`openstreetmap_mapped_unverified`) and `field_verified: false`.

| Layer | Features | Named | Unnamed |
|---|---|---|---|
| OSM mapped health facilities | 539 | 536 | 3 |
| OSM mapped marine access (ferry terminals / piers / landing candidates) | 292 | 147 | 145 |
| OSM mapped waterways (line geometry, navigability **not** assessed) | 1,196 | 46 | 1,150 |

Committed to `data/spatial/processed/` so the presentation never calls Overpass live.

### b. Local spatial analysis engine (Turf + H3)

New `lib/spatial/` module. Real calculations, all pure and unit-tested:

- **`proximity.ts`** — great-circle ("straight-line") distance via a direct haversine (fast enough to run ~100,000 times per page); nearest-point, nearest-line, count-within-radius, and analytical distance bands.
- **`h3.ts`** — Uber H3 v4 aggregation at **resolution 7** (~5.16 km² per hexagon). Each surveyed community is binned to its cell; cell values are real counts and transparent summaries (community count, critical count, mean & max need score, sum of *known* survey population). Empty space produces no cell.
- **`context.ts`** — joins the live register to the OSM layers and produces, per community: nearest mapped health facility (km + name + type), nearest mapped marine access (km + name + kind), count of marine access points within 5 km, nearest mapped waterway (km), and a **transparent "access constraints" flag** that lists each contributing factor rather than hiding them in a score. Cached in-process for 5 minutes, keyed on a signature of the community coordinates.

### c. Where it shows up

- **Spatial Explorer** — the map now has toggle-able overlays for the three OSM layers and the H3 density grid (all start hidden, each with a provenance tooltip). A new panel ranks communities by straight-line distance to the nearest mapped health facility and shows the access-constraint counts.
- **Accessibility** — distance-to-nearest-mapped-health-facility banded by LGA, and a table of communities with two or more access constraints (every factor listed).
- **Community dossier** — the "Spatial service context" panel now shows the real OSM-derived distances (with survey values kept separate) and still lists the genuinely unavailable items (modelled population, EO, travel-time network) as withheld.
- **Data Quality** — an OSM checks panel (records extracted, dropped-outside-Lagos, duplicates, unnamed-kept counts, per-layer named/unnamed) and a survey-vs-OSM health-distance comparison. Note: the survey recorded **no** numeric hospital distance for any community, so the OSM distance is the platform's first facility-distance estimate, not a cross-check — the page says so explicitly.
- **Data Catalogue** — a full "Blue Lagos system status" board and the OSM + H3 layers listed as integrated datasets with counts, licence and limitations.
- **Methodology** — a new "Evidence classes" section (FIELD / OSM / DERIVED / MODELLED) and rewritten spatial-methods cards.

### d. Presentation resilience

- **`npm run snapshot:presentation`** — fetches the full paginated register from Supabase, checks count integrity and identity fields, and writes a frozen `data/presentation-snapshot.json` (134 rows, no secrets).
- The data layer now falls back to that snapshot **only** if the live query fails **and** `NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK=1` (it is set in `.env.local`). When it does, every page shows a **"VERIFIED SNAPSHOT"** banner with the snapshot timestamp. It is never a silent swap.
- **`npm run presentation:check`** — a read-only status board (live data reachable? snapshot present and fresh? boundaries valid? OSM layers present? key routes present?) to run before leaving for the meeting.
- The map defaults to satellite imagery, with a light canvas basemap one click away, so a failing tile provider still leaves the boundaries, community points and analysis on screen.

## 3. Architecture in one picture

```
Field survey (enumerators)
      │
      ▼
Supabase Postgres view  ──(live, validated, paginated)──►  Next.js server
      │                                                          │
      │  (offline, one-off)                                       │  joins
      ▼                                                          ▼
Overpass → extract → clip/clean → data/spatial/processed/*.geojson
GRID3 boundaries → data/spatial/lagos-administrative.json
      │                                                          │
      └──────────────────────────┬───────────────────────────────┘
                                 ▼
              Turf (distances) + H3 (hex grid) — in Node, per request, cached
                                 ▼
        Map (MapLibre) + dashboard pages + community dossiers
                                 ▼
                 Intervention scenario / priority decisions
```

## 4. Calculations, stated plainly

- **Straight-line distance**: haversine great-circle between two points. Ignores roads, water routes, terrain. A *lower bound* on real travel distance. Never called travel time.
- **Point-in-polygon**: ray-casting test of a point against a boundary polygon. Used for "inside Lagos?" and "which LGA polygon contains this point?".
- **Nearest facility**: minimum straight-line distance from a community to any point in an OSM layer.
- **H3 grid**: fixed hexagons, resolution 7. Counts and averages of the communities that fall inside each hexagon. Nothing interpolated.
- **Scenario catchment**: communities within a chosen straight-line radius of a candidate point, with their known population and risk mix. A planning catchment, not an isochrone.
- **Need score**: unchanged from before — a count of up to 10 observed adverse conditions, one point each.
- **Access constraints**: a count of named factors (highly stranded by survey; isolated >5 km; ≥10 km to nearest mapped health facility; no mapped marine access within 5 km; water-dependent route with poor/absent landing). Listed, never collapsed into a hidden score.

## 5. Datasets

| Dataset | Source | What it is | Licence |
|---|---|---|---|
| Community baseline | Blue Lagos field survey (Supabase view) | 134 communities, attributes + 93 GPS points | Internal governance terms |
| Lagos State + LGA boundaries | GRID3 2022 via geoBoundaries gbOpen | 1 + 20 polygons | CC BY 4.0 |
| OSM mapped health facilities | OpenStreetMap contributors (Overpass) | 539 points | ODbL 1.0 |
| OSM mapped marine access | OpenStreetMap contributors | 292 points | ODbL 1.0 |
| OSM mapped waterways | OpenStreetMap contributors | 1,196 lines | ODbL 1.0 |
| H3 analytical grid | Derived from Blue Lagos geometry | hexagons, recomputed per request | Derived; H3 lib Apache-2.0 |

## 6. Security / reliability

- No service-role key, private key or connection string in the repo or shipped to the browser. The browser only ever holds the public anon key (read-only view).
- Response headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, restrictive `Permissions-Policy`. `poweredByHeader` off.
- CSV export sanitises formula-injection characters. URL/filter parsing is allow-listed and cannot crash a page.
- The snapshot file contains only rows the public anon key can already read.

## 7. What is deliberately NOT built (and why)

| Capability | Status | Why not tonight |
|---|---|---|
| Modelled population (WorldPop) | Adapter + schema only | No processed raster; would require a raster-to-community aggregation method we have not validated. Survey-known population only. |
| Earth observation (flood extent, NDVI, shoreline change) | Adapter only | Google Earth Engine is not authenticated. You will connect it separately. No satellite-derived values are shown or faked. |
| Validated navigable water network + travel-time routing / isochrones | Not started | Needs navigability verification per waterway and a routing graph. Every straight-line figure is labelled as such. |
| deck.gl GPU layers, vector tiles (PMTiles), Overture Maps, a Python/Forge3D pipeline | Not started | Higher integration risk than justified for an unsupervised overnight build before a live demo. MapLibre renders the H3 grid and OSM layers reliably as-is. |

Nothing above is presented as working. Each appears in the system-status board as not-configured / unavailable.
