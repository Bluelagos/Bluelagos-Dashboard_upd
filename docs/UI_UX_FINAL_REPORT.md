# UI/UX Final Report

The product-design pass that took Blue Lagos from a working analytical tool to
something that can be presented, unaided, to senior Lagos State leadership.

Nothing was rebuilt. The data layer, spatial pipelines, Supabase integration,
OSM processing, priority model, shared service areas, scenarios and data-quality
work were all left intact; this pass changed how they are presented.

---

## 1. Design direction

**Mature civic + geospatial + coastal.** Calm, informed, trustworthy. Explicitly
not a startup dashboard, not neon, not glass, not "AI".

The concrete decisions that hold that line:

- A **single design-token file** (`app/globals.css`, ~1,000 readable lines,
  replacing a minified single-line blob). Components reference semantic names —
  `--surface`, `--accent-health`, `--critical` — never a hex value. Both themes
  are one variable swap.
- **Restraint over decoration.** No gradients on cards, no glows, no shadows
  doing work that a border should do. Elevation appears only on hover, and only
  where hovering means something.
- **Colour carries meaning.** A KPI's accent is its category, not decoration
  (§10). The same tone follows a theme from its Overview card to its nav item to
  its chart series.

## 2. Theme system

Two complete themes, toggled from the top bar, persisted in `localStorage`,
following the system preference until the viewer chooses.

**Deep Coast** — deep navy ground (`#060f18`) with deliberately varied surfaces
(`--surface`, `--surface-raised`, `--surface-inset`, `--surface-hover`) rather
than one flat navy. Ocean blue, lagoon teal, muted indigo, calm green, olive,
warm amber, restrained coral.

**Warm Coast** — cream ground (`#f2ece1`), warm off-white cards (`#fffdf8`),
deep navy text (`#12242f`), Lagos blue `#0e6fa8`, teal `#0f8d84`, rust and
amber. A policy report crossed with a map room, not a beige form.

Implementation notes worth knowing:

- `THEME_INIT_SCRIPT` runs in `<head>` before first paint, so there is no flash
  of the wrong theme on any navigation. Verified by an E2E test.
- The DOM attribute `data-theme` is the single source of truth. React subscribes
  through `useSyncExternalStore` rather than keeping a duplicate copy in state.
- MapLibre and ECharts cannot read CSS variables, so `token()` resolves them
  from the live stylesheet and both restyle on a theme switch without a reload.
- Map basemaps follow the theme (dark canvas / light canvas) until the viewer
  overrides the choice, at which point their choice sticks.

## 3. Branding

`public/brand/` is a reserved slot and **is still empty** — no official logo file
has been supplied, so the app continues to use the neutral wave glyph.

What changed is that the slot is now wired end to end. `lib/brand.ts` detects an
asset on server start, preferring SVG and an official-looking filename. Drop
`blue-lagos.svg` (or `.png`/`.webp`) into `public/brand/` and it appears
automatically in the sidebar, the mobile header, the briefing header and the
favicon/social card metadata — **no code change required**. Nothing else needs
doing, and no logo was invented.

## 4. Typography

IBM Plex Sans throughout, now with `display: "swap"`.

The substantive change was **scale**. The previous interface leaned on 8–10 px
type for labels, which does not survive a projector. Body copy moved to
12.5–13.5 px, page descriptions to 13.5 px, KPI labels from 9 px uppercase to
11.5 px sentence case, and the smallest label in the product is now 10 px. A
permanent test (`e2e/layout.spec.ts`) fails the build if anything inside `main`
drops below 9.4 px.

## 5. Component system

Standardised in `components/ui.tsx` and `components/drawer.tsx`, replacing
per-page hand-styling:

`PageHeader` · `PageGuide` · `SectionHead` · `Kpi` · `Panel` · `ThemeCard` ·
`KeyTakeaway` · `WhatToLookAt` · `TakeawayRow` · `EmptyState` · `NeedScore` ·
`Skeleton` / `KpiSkeleton` / `MapSkeleton` · `Drawer` · `MetricInfo` ·
`ExplainerBody` · `FilterChips` · `GlobalSearch` · `ThemeToggle`.

No component library was added. The project had no Tailwind, no shadcn and no
Radix; introducing one would have meant rewriting every stable component for no
user-visible gain. The existing CSS approach was kept and made systematic
instead. Motion constants live in `lib/motion.ts` and `--motion-fast/normal/slow`
rather than being invented per component, and `prefers-reduced-motion` is
honoured globally and in every map camera move.

## 6. Two levels: plain language over technical depth

This was the central requirement, and it is enforced rather than merely intended.

`lib/explain.ts` holds one entry per published metric with five parts: what it
is, why it matters, how it is worked out in plain words, the same in technical
terms, and the source. `MetricInfo` renders it in a focus-trapped drawer.

Terms removed from primary UI and relocated to drawers and the Methodology page:
*Haversine, GeoJSON, H3, MCDA, DBSCAN, Euclidean, point-in-polygon, centroid,
medoid, isochrone, great-circle, derived dataset, analytical view, polygon
reconciliation.*

Representative relabels:

| Was | Now | Technical detail moved to |
|---|---|---|
| H3 Community Density | Community concentration | Layer tooltip + Methodology |
| Critical Alert | Needs urgent attention | Info drawer |
| Highly stranded | No way out in an emergency | Info drawer |
| MCDA dimensions | What matters most | Priorities panel, expandable |
| Straight-line distance (Haversine) | Distance to health facility · *Straight-line estimate* | Info drawer |
| Baseline Blue Lagos Need Score | Community need score · *Out of 10 recorded conditions* | Info drawer |
| Population potentially served · FIELD | People within reach | Info drawer |
| Shared service area candidate | Tested location | Info drawer |
| VERIFIED SNAPSHOT FALLBACK | Showing saved survey data from 6 Sep 2026 | "Why?" disclosure |

Two automated guards keep this from eroding: `tests/explain.test.ts` fails if
technical vocabulary appears in the plain layer or if a drawer links to a
Methodology section that does not exist, and an E2E test asserts that none of
those terms is visible in `main` on the five primary pages.

## 7. Page-by-page

**Overview** — plain subtitle, six clickable KPIs with category tones and info
buttons, a data-derived Key takeaway beside a What-to-look-at box, a large map,
a ranked "Where attention is needed" list, five theme cards, then two charts.
Twelve small panels became one readable sequence.

**Community Map (`/explorer`)** — map made dominant, plain-language layer panel
("Community concentration", "Waterways", "Jetties & landing points", "Health
facilities"), layers loading on demand, legend adapting to what is switched on,
distance and boundary-reconciliation sections given their own headings.

**Communities** — sortable five-column table with a details route, chips for
active filters, a real empty state.

**Health & Water** — "See where communities face gaps in healthcare access,
emergency movement, drinking water and sanitation." Overlap KPIs, data-derived
takeaway, then the distance-to-healthcare map with a link into shared service
areas.

**Access** — distance bands relabelled ("Under 2 km" … "Nothing mapped
nearby"), multi-constraint table, and an honest "What we can and cannot measure"
section.

**Environment** — Flood and Erosion tabs (only the two with real data; the rest
stay listed as not available rather than given empty tabs).

**Priorities** — two clearly-switched modes. Community priorities explains the
ten-condition score in plain words before showing it; the weighted model's
sliders are labelled "Depth of poverty", "Emergency access", "Missing basic
services". Shared service areas explains grouping in one sentence with the
clustering method behind an info drawer.

**Scenarios** — "Test a possible facility location and see which communities and
people fall within its planning catchment." Controls read as questions: *What
are you placing? Where? How far should it reach?*

**Data / Data Quality / Methodology** — Data Quality leads with pass/warning
badges and hides the QA vocabulary behind "Technical detail". Methodology is
rebuilt as nine accordions, each with a plain explanation and a technical
disclosure, with anchor IDs that every info drawer links into.

## 8. Briefing

Rebuilt as a presentation route rather than another dashboard page: eleven
scenes, each with one headline, one message, one visual, and a "What we are
seeing / Why it matters" pair.

The coverage · The people · Where they are · What communities asked for ·
Health & water · Access · Environment · Priority communities · Shared service
areas · Testing a decision · What this can do next.

**Presenter notes** (the `N` key, or the notebook icon) open a panel with *Say
this* — 2–4 sentences of natural speech — and *If asked* — short, honest answers
to the questions each scene invites, including the ones about what is missing.
Hidden by default; the audience never sees them unless the presenter opens them.

Navigation: Next/Previous, arrow keys, PageUp/PageDown, a clickable progress
bar, `Esc` to exit, and a per-scene deep link into the full page. Controls are
sized for a projector (42 px buttons, 46 px headline).

## 9. Interactivity

- **KPI cards** navigate where there is somewhere meaningful to go, with hover,
  keyboard focus and a "View details" affordance. Cards without a destination
  stay inert.
- **Charts are navigation**: selecting an LGA bar filters the page; the same
  filter is available as a button in the accessible data table.
- **Community selection** flies the map to the settlement, enlarges the marker,
  dims the surrounding points and opens a summary card with a route into the
  full record.
- **Map camera moves are differentiated** (`lib/motion.ts`): a state-wide fit
  settles over 900 ms, an LGA over 700 ms, a cluster over 650 ms, a single
  community over 550 ms, a nudge over 350 ms — all zero under reduced motion.
- **Search** (`/` or `Ctrl/Cmd-K`) loads a 16 KB index on first open and
  navigates straight to a community.
- **Filter chips** make the current state obvious and removable.

## 10. Responsiveness

Desktop-first, as the use case demands, verified at 1920×1080, 1440×900 and
1366×768 in both themes with **no horizontal overflow on any page**
(`e2e/layout.spec.ts`). Below 760 px the sidebar becomes a drawer, the drawer
becomes a bottom sheet, KPIs stack two-up and the map legend hides in favour of
the accessible list.

## 11. Accessibility

- Theme toggle is a labelled `role="group"` with `aria-pressed` buttons.
- Clickable cards are real links: keyboard reachable, `Enter`-activatable
  (tested).
- Drawers trap focus, restore it on close, close on `Escape`, and lock body
  scroll.
- Every chart has a screen-reader title, description and a data table, with the
  cross-filter available as a button for people who cannot click a bar.
- Every map has a list alternative with "Show on map" and "Open" per community.
- Tables use `aria-sort`, `scope`, captions and sticky headers.
- Colour is never the only signal — distance bands, need scores and statuses all
  carry text.
- Focus rings are 3 px and theme-aware.
- `prefers-reduced-motion` disables transitions, animations and map flights.

## 12. Known limitations

1. **No official logo.** `public/brand/` is empty; the wave glyph is a
   placeholder. Detection is wired, so supplying the file is the entire task.
2. **`/health` loads ECharts on first paint** because its chart sits near the
   fold. Moving that chart below the distance map would defer it.
3. **ECharts is imported whole.** Importing only the required renderers would
   cut ~700 KB raw from that chunk.
4. **Contrast is judged, not automatically audited.** Both palettes were
   designed against WCAG AA for body text and checked visually at all three
   resolutions, but no automated contrast assertion runs in CI. Worth adding.
5. **The layout test checks geometry, not appearance.** It catches overflow and
   tiny text; it will not catch an ugly page. Visual review remains manual.
6. **Basemaps depend on Esri's public tile service.** CARTO's free tiles began
   returning "API KEY REQUIRED" watermarks and were replaced during this pass.
   Esri needs no key today, but any public tile service is an external
   dependency — worth a pre-presentation check.
7. **Mobile is usable, not optimised.** It was not the target and did not get a
   dedicated design pass.
