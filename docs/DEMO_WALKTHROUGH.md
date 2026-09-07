# Demo Walkthrough — Click by Click

*Target: 8 minutes (7–10 acceptable). Each step: page · action · expected · say · fallback.*
*Rehearse until you can do it without reading. Numbers below are from the
2026-09-06 build — re-check the KPI row on the day.*

> **Two ways to run this.** The steps below drive the live pages, which is the
> stronger demo because you can be interrupted and follow the question. If you
> would rather have a fixed path with speaker support, open **`/briefing`**
> instead: eleven scenes, arrow keys to move, and press **`N`** for presenter
> notes that give you the words for each scene and short answers to the
> questions it invites. Use the briefing when the room is large or the time is
> tight; use the pages below when the room wants to poke at it.

**Before you start:** open the theme toggle in the top bar and pick the
appearance that suits the room. **Deep Coast** (moon icon) is better on a bright
projector; **Coastal Day** (sun icon) is better on a screen in a well-lit room or
in a printed screenshot. The choice persists.

---

## Step 1 — Overview (1:00)

- **Page**: `/`
- **Do**: nothing at first. Point at the six headline figures, then the Key
  takeaway, then the map, then the ranked list on the right.
- **Expected**: *Communities surveyed 134* · *Population represented 502,002* ·
  *Needs urgent attention* · *No way out in an emergency* · *Sanitation gaps* ·
  *Flood exposure*. Below them, a Key takeaway written from the data and a
  "What to look at" box. Then a large map and "Where attention is needed".
- **Say**: *"This is real field data — 134 riverine communities, just over half a
  million people. We start at community level, not Local Government average. And
  note: this covers 7 of 20 Local Governments, heaviest in Epe. It's a strong
  riverine sample, not a full census."*
- **If someone asks how a number is worked out**: hover the card and click the
  small **i**. A panel opens with what it shows, why it matters, how it is
  worked out, the source, and a "Technical detail" section for the method. Use
  this instead of improvising.
- **Fallback**: Overview screenshot.

## Step 2 — Community Map: geography and open mapping (2:00)

- **Page**: `/explorer` (sidebar: **Community map**)
- **Do**:
  1. Let the map load — boundaries and community points.
  2. In the layer panel, tick **Health facilities**, then **Jetties & landing
     points**, then **Waterways**, then **Community concentration**.
  3. Scroll to **"How far communities sit from services"**.
- **Expected**: each layer appears a moment after you tick it (they load on
  demand — that is deliberate, so the map itself opens fast). The legend adds an
  entry for each layer you switch on. The section below shows the typical
  distance to a health facility and counts for 5 km+, no landing point within
  5 km, and more than one access problem.
- **Say**: *"Real Lagos boundaries — GRID3 2022. 539 mapped health facilities,
  292 jetties and landing points, nearly 1,200 waterway segments — from
  OpenStreetMap, cleaned and clipped to Lagos. This is open contributor data,
  not the official State registry, and the platform labels it that way
  everywhere. The hexagon layer lets us compare where communities concentrate
  without huge Epe swamping tiny Apapa."*
- **Then**: *"And here — these communities are more than five kilometres in a
  straight line from the nearest mapped facility. Before you even account for
  the water."*
- **Fallback**: Community Map screenshot with layers on.

## Step 3 — One community (1:00)

- **Page**: press **`/`** to open search, type the community you rehearsed,
  press Enter. (Or `/communities` → click the row.)
- **Do**: scroll the page — People · Health, water and sanitation · Getting
  there and basic services · Livelihoods and environment · What this community
  asked for · Where it is · Distance to services.
- **Expected**: survey estimates with **Not recorded** where the survey was
  blank; the need score with its conditions listed; distances to the nearest
  mapped features, with the survey's own figure shown alongside and not replaced;
  the four withheld rows (modelled population, satellite flood mapping,
  shoreline change, travel time) visibly blank.
- **Say**: *"The system goes all the way down to one community — and back —
  without losing the evidence trail. Where we don't have a number it says Not
  recorded, not zero. And you can see the survey's own answer next to what we
  calculated, because we don't overwrite what the surveyor wrote down."*
- **Fallback**: community page screenshot.

## Step 4 — Access (1:00)

- **Page**: `/accessibility` (sidebar: **Access**)
- **Do**: scroll to **"How far from healthcare, by local government"**, then to
  **"Communities facing more than one access problem"**.
- **Expected**: per-LGA counts across *Under 2 km / 2 to 5 km / 5 to 10 km /
  Over 10 km / Nothing mapped nearby*; then a table where every contributing
  problem is spelled out per community.
- **Say**: *"How are these communities actually connected — road, water, both?
  Here are the ones carrying more than one disadvantage at once. The system
  lists every reason. It doesn't roll them into a mystery score, and it doesn't
  automatically call them critical."*
- **Fallback**: Access screenshot.

## Step 5 — Environment (0:45)

- **Page**: `/climate` (sidebar: **Environment**)
- **Do**: stay on the **Flood** tab, then switch to **Erosion** to show both.
- **Say**: *"Our flood layer is field-reported — what communities told us,
  scored and mapped. What you won't see is a satellite flood map. We haven't
  connected Earth observation yet. The pipeline is built for it; until it's
  connected and checked, we show field evidence and call it field evidence."*
- **Point at**: the "Satellite and elevation evidence" section listing exactly
  what is not available. *"We list what we don't have, on the page."*
- **Fallback**: Environment screenshot.

## Step 6 — Priorities and shared service areas (1:30)

- **Page**: `/priorities`
- **Do**:
  1. Read the six headline figures, then the Key takeaway.
  2. Scroll to **"What matters most"** and move one slider — *Emergency access*
     is the most persuasive — and let them watch the ranking reorder.
  3. Switch to the **Shared service areas** tab.
- **Expected**: the ranked table reorders live. On the shared tab: groups of
  communities, a tested location per group, and a summary strip — communities
  considered, groups found, locations tested, **people within reach**,
  communities within reach.
- **Say**: *"The need score is a plain count: ten recorded conditions, one point
  each. Nothing hidden. And if you disagree with the weighting — [move the
  slider] — you can change it and see what happens. That's the point: it's
  arguable, in public."*
- **Then, on the shared tab**: *"Instead of asking where to put a clinic for one
  village, we group communities that are close together and share the same gap,
  then find a point on land that reaches as many of them as possible."*
- **Fallback**: Priorities screenshot; shared service areas screenshot.

## Step 7 — Scenarios (1:30)

- **Page**: from the shared tab, click **Test this location** (this carries the
  candidate across), or go to `/scenarios`.
- **Do**:
  1. **What are you placing?** → *Health centre*.
  2. Click a point on the map near a cluster of high-need communities.
  3. Set the reach slider to **5 km**.
  4. Read the four figures, then move the point ~2 km and let them change.
- **Expected**: *Location being tested* · *Communities within reach* · *People
  within reach* · *Urgent-attention communities reached*. The **Location check**
  confirms the point is inside Lagos and on land.
- **Say**: *"This is the part I'd encourage you to test. Put a point anywhere,
  set how far it should reach, and it tells you how many communities and how
  many people fall inside — straight away. If someone in this room says 'what
  about here instead?', we can answer it now rather than next month."*
- **Guardrail**: *"That circle is a straight-line reach, not a travel time. We
  label it that way deliberately."*
- **Fallback**: Scenarios screenshot.

## Step 8 — Data Quality (0:45)

- **Page**: `/data-quality`
- **Do**: point at the status figures, then open one **Technical detail**
  disclosure.
- **Expected**: completeness percentages, a boundary check that passes, counts
  of records without coordinates, and the survey-versus-open-map comparison.
- **Say**: *"Last thing, and it's the one I care most about. Every figure traces
  back to a record. Where the data is thin, this page says so. Where two sources
  disagree, we show both rather than picking one. That's what makes it usable
  when someone challenges a number."*
- **Fallback**: Data Quality screenshot.

## Close (0:30)

*"Everything you've seen is community-level evidence from the field, held to a
standard where nothing is invented and nothing is hidden. The next unlock is a
verified navigable-water network — that turns every straight-line distance you
saw into a real travel time. That's the single biggest improvement available,
and it's a data problem, not a software one."*

---

## If something fails

| Problem | Do this |
|---|---|
| A page won't load | Reload once. If it still fails, move to the next step and come back. Screenshots are the fallback. |
| The map is blank | The page still works — open **Community list** below the map and drive it from there. |
| A layer won't switch on | Say *"that layer loads on demand and it's not reaching the service"* and move on. Nothing else depends on it. |
| Numbers look different from this document | Trust the screen. This document was written on 2026-09-06 and the register is read live. |
| A banner says "Showing saved survey data" | The database is unreachable and it is using the last saved copy. Say so plainly: *"we're on the saved copy from [date] — the figures are frozen at that point."* |
| You're asked something you don't know | *"I'd need to confirm the exact figure — let me follow up."* Never improvise a number or a capability. |

## Keyboard shortcuts worth knowing

| Key | Does |
|---|---|
| `/` or `Ctrl/Cmd-K` | Open community search from anywhere |
| `←` `→` | Move between briefing scenes |
| `N` | Toggle presenter notes in the briefing |
| `Esc` | Close a panel, or exit the briefing |
