# Performance Audit

Measured, not estimated. Every number below came from a local **production
build** (`npm run build` + `next start -p 3100`) on the development machine,
against the live Supabase register.

- **Method (server timings):** each route requested once to warm it, then three
  further requests; the fastest `curl -w '%{time_total}'` is reported. This is
  time to last byte of the HTML document.
- **Method (payload):** `curl <route> | wc -c` — the uncompressed HTML/RSC
  document, which is what the browser must parse before the page is usable.
- **Method (per-route weight):** Playwright, one fresh browser context per
  route, summing decoded response bodies until `networkidle` + 2.5s.
- **Environment:** Windows 11, Next.js 16.3.4 (Turbopack), Node 22, remote
  Supabase project. Absolute times include a real network round trip to
  Supabase and will differ on other hardware and connections.

---

## 1. Before

The complaint was "the application takes too long to load information". Server
response time was not the problem — the payload was.

| Route | TTFB | HTML/RSC payload |
|---|---:|---:|
| `/` | 0.295 s | 255 KB |
| `/explorer` | 0.407 s (0.965 s cold) | **1,725 KB** |
| `/communities` | 0.264 s | 255 KB |
| `/health` | 0.344 s | **1,473 KB** |
| `/priorities` | 0.284 s | 241 KB |
| `/priorities?view=areas&type=health` | **1.476 s** | **1,013 KB** |
| `/scenarios` | 0.295 s | **1,130 KB** |
| `/data-quality` | 0.313 s | — |
| `/methodology` (static) | 0.003 s | — |

Total client JavaScript emitted by the build: **2,895 KB**.

---

## 2. Bottlenecks, with evidence

**(a) Large GeoJSON serialised into the page payload — the dominant cost.**
`/explorer`, `/health`, `/scenarios` and the shared-service-areas view passed
processed OpenStreetMap layers to client components as props. Those props are
serialised into the RSC payload on every request. The waterway linework alone is
778 KB:

```
data/spatial/processed/osm-waterways.geojson       778 KB
data/spatial/processed/osm-health-facilities.geojson  268 KB
data/spatial/processed/osm-marine-access.geojson      190 KB
```

That is why `/explorer` shipped 1,725 KB before a single pixel of map appeared —
and it was paid on every navigation, by every viewer, whether or not they ever
switched those layers on.

**(b) Shared-service-area analysis recomputed per request.**
`/priorities?view=areas` took 1.48 s while every other dynamic route sat at
~0.28 s. The gap is `analyzeSharedServiceAreas`, which clusters every geolocated
community, then generates and scores candidate points inside each cluster,
screening each candidate against the state polygon and the buffered waterway
network. Pure, deterministic, and repeated in full on every request.

**(c) The whole Turf bundle shipped to the browser for one function.**
`components/scenario-lab.tsx` and `components/shared-service-areas.tsx` each did
`import { circle } from "@turf/turf"`, pulling a 223 KB client chunk to draw a
catchment ring.

**(d) ECharts loaded eagerly on pages whose charts are below the fold.**
ECharts is the single largest chunk (1,115 KB raw / 367 KB gzip). On the
Overview both charts sit well below the fold, yet the library was fetched during
initial load, competing with the map for bandwidth.

**(e) Not a bottleneck — checked and cleared.**
Supabase fetching is *not* duplicated. `getCommunityDataset` is already wrapped
in React `cache()`, so the register is fetched once per request no matter how
many components ask for it; `/api/search` (essentially a bare Supabase query)
returns in 0.32 s, which matches the ~0.25 s floor seen on every data-backed
route. That floor is the round trip to the hosted database, not application
code. The derived spatial context and the processed OSM files were already
memoised at process level.

---

## 3. Fixes

1. **Optional map layers moved behind an API and fetched on demand.**
   New route `app/api/layers/[layer]/route.ts` serves the OSM health, marine,
   waterway, H3 and administrative layers with
   `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. The map
   fetches a layer the first time it is switched on, and the browser then caches
   it across routes. Default-visible layers are only the communities and the
   boundaries (§49).
2. **Waterways fetched after first paint on Priorities and Scenarios.**
   `components/use-waterways.tsx` shares one in-flight request across
   components. The page text, headline figures and map are usable immediately;
   the waterway layer and the land/water location check arrive a moment later,
   with the check showing "Checking this location…" until it does.
3. **Shared-service-area analysis memoised at process level.**
   `lib/spatial/service-area-cache.ts` keys on a signature of the community
   coordinates plus the chosen options, with a 5-minute TTL and a 24-entry cap.
   Live data changes still produce a fresh result; the same query does not
   recompute.
4. **Turf removed from the browser.** `lib/geo-circle.ts` implements the one
   needed function — a spherical destination-point ring. `tests/geo-circle.test.ts`
   pins it to `turf.circle` vertex-for-vertex to within a metre. (That test
   caught a real defect: the first implementation wound the ring in the opposite
   direction from Turf.)
5. **ECharts deferred until a chart approaches the viewport.** An
   `IntersectionObserver` with a 600 px margin starts the import, so a page whose
   charts are below the fold no longer pays for them up front.
6. **Skeletons instead of blank waits.** `app/loading.tsx` and the map's
   "Preparing map…" placeholder reserve the right space, so nothing jumps.

---

## 4. After

Same method, same machine, shipped build.

| Route | TTFB | HTML/RSC payload | Change in payload |
|---|---:|---:|---|
| `/` | 0.283 s | 294 KB | +39 KB (added guides and takeaways) |
| `/explorer` | 0.280 s | 338 KB | **−1,387 KB (−80%)** |
| `/communities` | 0.251 s | 273 KB | +18 KB |
| `/health` | 0.278 s | 340 KB | **−1,133 KB (−77%)** |
| `/accessibility` | 0.256 s | 107 KB | — |
| `/climate` | 0.253 s | 126 KB | — |
| `/priorities` | 0.252 s | 262 KB | +21 KB |
| `/priorities?view=areas&type=health` | **0.245 s** | 176 KB | **−837 KB (−83%)**, TTFB **−83%** |
| `/scenarios` | 0.256 s | 298 KB | **−832 KB (−74%)** |
| `/demographics` | 0.281 s | 387 KB | — |
| `/data` | 0.236 s | 63 KB | — |
| `/data-quality` | 0.263 s | 346 KB | — |
| `/methodology` (static) | 0.003 s | 93 KB | — |
| `/briefing` | 0.245 s | 223 KB | — |

Every dynamic route now lands in a **0.24–0.28 s** band. The remaining ~0.25 s
is the Supabase round trip, confirmed by `/methodology` (no database, 0.003 s)
and `/api/search` (essentially only the database, 0.32 s).

**On-demand layer endpoints** (served once, then browser-cached):

| Endpoint | Time | Size |
|---|---:|---:|
| `/api/layers/osm-waterways` | 0.081 s | 778 KB |
| `/api/layers/osm-health` | 0.011 s | 268 KB |
| `/api/layers/h3` | 0.271 s | 31 KB |
| `/api/layers/administrative` | 0.004 s | 54 KB |
| `/api/search` | 0.320 s | 16 KB |

**JavaScript actually loaded per route** (decoded bytes, fresh context):

| Route | Before | After |
|---|---:|---:|
| `/` | 2,770 KB | **1,655 KB** |
| `/explorer` | — | 1,647 KB |
| `/communities` | — | 645 KB |
| `/health` | — | 2,767 KB |
| `/data`, `/methodology` | — | 605 KB |

The Overview drop is exactly the ECharts chunk, now deferred. `/health` still
loads it because its chart genuinely sits near the fold — which is the intended
behaviour, not a miss. Pages with neither a map nor a chart load 605 KB, the
framework baseline.

**Over the wire** (gzip, as actually served):

| Asset | Raw | gzip |
|---|---:|---:|
| ECharts chunk | 1,115 KB | 367 KB |
| MapLibre chunk | 1,007 KB | 267 KB |
| `/` document | 294 KB | 35 KB |
| `/explorer` document | 338 KB | 50 KB |
| `/health` document | 340 KB | 51 KB |

Total client JavaScript emitted: 2,895 KB → **2,928 KB**. The total is
marginally larger because features were added (theme system, search palette,
drawers); what changed is that far less of it is fetched to view any given page.

---

## 5. What is still heavy

- **MapLibre — 1,007 KB raw / 267 KB gzip.** Unavoidable for an interactive
  vector map, and already loaded lazily. It is fetched only on routes that show
  a map.
- **ECharts — 1,115 KB raw / 367 KB gzip.** Now viewport-deferred. If it becomes
  a problem, importing only the bar/line renderers instead of the full build
  would cut it substantially; that is a contained follow-up, not done here
  because the deferral already removed it from the critical path.
- **The ~0.25 s Supabase floor.** Every data-backed route pays one remote round
  trip. Options, in order of effort: co-locate the deployment with the database
  region; add a short revalidating cache in front of `getCommunityDataset`
  (which would trade freshness — the register is deliberately read live today);
  or accept it, since 0.25 s is not perceptible as a delay.
- **`/health` at 2,767 KB of JS.** Both a map and an above-the-fold chart. Could
  be improved by moving the chart below the distance map.

## 6. Repeating these measurements

Server-side timings can be printed per operation without touching production
behaviour:

```bash
BLUE_LAGOS_PERF=1 npm start          # or simply: npm run dev
```

`lib/perf.ts` prints `[perf] <label> <ms>` for instrumented operations
(currently `analyzeSharedServiceAreas`). It is inert in an ordinary production
run and never renders anything to users.
