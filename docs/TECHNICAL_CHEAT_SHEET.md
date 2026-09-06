# Technical Cheat Sheet

*One glance. Keep it open in a browser tab during the demo.*

---

## Stack

| Layer | Choice | One-line explanation |
|---|---|---|
| **Frontend** | Next.js / React / TypeScript | Server-rendered web app; the browser gets finished pages, not a wall of API calls. |
| **Map** | MapLibre GL JS | Open-source interactive map; no vendor lock-in, no per-tile billing. |
| **Advanced spatial rendering** | *(not used)* deck.gl | Considered; MapLibre renders the H3 grid and OSM layers reliably, so we didn't add GPU layers before a live demo. |
| **Spatial analysis** | Turf.js (`@turf/*`) + a direct haversine | Great-circle distances, nearest-feature, point-in-polygon, radius catchments — run on the server in plain JavaScript. No PostGIS required. |
| **Spatial grid** | H3 (`h3-js` v4), resolution 7 | Uber's global hexagon grid; ~5.16 km² per cell; used to aggregate community points independent of LGA size. |
| **Database** | Supabase (managed PostgreSQL) | Holds the `blue_lagos_dashboard_kpis` survey view; read live at request time; re-hostable on government infrastructure. |
| **Field source** | Blue Lagos community survey | 134 communities, 93 geolocated, 7 of 20 LGAs. |
| **Boundaries** | GRID3 2022 via geoBoundaries gbOpen | 1 State + 20 LGA polygons; CC BY 4.0; WGS84; planning-grade, not cadastral. |
| **Open mapping** | OpenStreetMap via Overpass (ODbL 1.0) | 539 mapped health facilities · 292 marine access points · 1,196 waterway segments; extracted once, cleaned, committed — never queried live. |
| **Earth observation** | **Not configured** | Google Earth Engine not authenticated; no satellite layer exists; flood layer is field-reported. |
| **Routing / travel time** | **Not built** | No navigable graph, no isochrones; all distances are straight-line and labelled as such. |
| **Modelled population** | **Not integrated** | No WorldPop raster processed; survey-known population only. |
| **Tests** | 119 unit + 19 end-to-end (Playwright), all green | Plus `pipeline:validate` (spatial data) and `presentation:check` (pre-demo status). |

## Coordinate system

WGS84 longitude/latitude — EPSG:4326 / OGC:CRS84 — everywhere. Pipeline validates all coordinates into range.

## Key numbers

- 134 communities · 93 with coordinates · 41 survey-only
- ~322,000 known survey population (across the 93 with estimates); 41 communities' population "Not recorded"
- Nearest OSM-mapped health facility: median ≈ 3.4 km straight-line; 41 communities ≥ 5 km; 27 ≥ 10 km
- Nearest OSM-mapped marine access: median ≈ 2.6 km straight-line
- `dist_to_hospital_km` in the survey: empty for all 134 (OSM distance is the first facility-distance estimate)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | 119 unit tests (Vitest) |
| `npm run test:e2e` / `npx playwright test` | 19 browser tests |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run pipeline:osm` | Re-extract OSM from Overpass (auto-tries mirrors) |
| `npm run pipeline:osm:process` | Clean/clip/split raw OSM into the 3 reviewed layers |
| `npm run pipeline:administrative` | Re-fetch GRID3 boundaries |
| `npm run pipeline:validate` | Validate all spatial data files |
| `npm run snapshot:presentation` | Build the verified fallback snapshot of the register |
| `npm run presentation:check` | Pre-demo readiness board |

## Resilience switches

- `.env.local` → `NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK=1` — app falls back to `data/presentation-snapshot.json` if the live query fails, and shows a **VERIFIED SNAPSHOT** banner. Currently **on**.
- Default basemap is dark raster, not satellite — a failing imagery provider does not break the map.

## Data files (committed, no live dependency)

```
data/report-register.json                         baseline cluster join
data/presentation-snapshot.json                   frozen 134-row fallback
data/spatial/lagos-administrative.json            1 + 20 boundary polygons
data/spatial/processed/osm-health-facilities.geojson   539 points
data/spatial/processed/osm-marine-access.geojson       292 points
data/spatial/processed/osm-waterways.geojson         1,196 lines
data/spatial/processed/osm-processed.metadata.json    provenance + validation report
```

## Security one-liners

- Browser holds only a **read-only anon key** to a **read-only view**.
- No service-role key / private key / connection string in the repo or client bundle.
- Headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, restrictive `Permissions-Policy`; `poweredByHeader` off.
- CSV export sanitises `= + - @` formula-injection prefixes.
- Snapshot contains only rows the anon key can already read.
