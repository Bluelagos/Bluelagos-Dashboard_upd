# Deputy Governor Presentation Script

*7–10 minutes. Confident, human, Nigerian-professional. No AI buzzwords. No overclaiming.*
*Bracketed notes are stage directions, not spoken. Pause where marked.*

> **Delivering this from the platform.** Every section below maps to a scene in
> **`/briefing`** — eleven scenes, arrow keys to move between them. Press **`N`**
> to open presenter notes, which carry a "Say this" paragraph and short answers
> to the questions each scene invites. The audience never sees the notes unless
> you open them. Use the briefing when you want a fixed path; use the live pages
> when you expect to be interrupted and want to follow the question.
>
> **Before you begin:** set the appearance from the top bar — **Deep Coast** for
> a bright projector, **Coastal Day** for a lit room. The choice is remembered.

---

## Opening — the problem (about 1 minute)

"Thank you for the time. I want to show you something practical.

Lagos has a coastal and riverine belt — Epe, Ojo, Amuwo-Odofin, Badagry, Ibeju-Lekki, the lagoon fringe. The communities there are some of the hardest to serve in the State, and they are the least visible in our planning data. We plan for them using Local Government figures. But a Local Government average cannot tell you whether one particular settlement can reach a health centre, or whether you can get a pregnant woman out of it during a flood.

That gap is where a hazard becomes a tragedy. So we built a tool that works at the level of the individual community, not the Local Government average."

[Open the platform on the **Overview** page.]

---

## Field evidence — what we collected (about 1 minute)

"What you're looking at is real field data. Blue Lagos surveyed 134 riverine communities. Ninety-three of them we have exact GPS coordinates for; the other 41 we have the survey answers but not yet a fixed location, and the system keeps them visible rather than dropping them.

For each community we recorded population estimates, sanitation, medical-evacuation status, flood experience, erosion threat, energy access, and — importantly — the community's own stated priority. Their words, not ours."

[Point to the KPI row: surveyed communities, geolocated, urgent-attention communities.]

"One thing I'll flag up front: this survey covers seven of the twenty Local Governments, and it's heaviest in Epe. It's a strong riverine sample. It is not yet a full-State census, and the tool never pretends otherwise."

---

## Spatial intelligence — what makes this different from a dashboard (about 2 minutes)

[Go to **Community Map**.]

"This is where it stops being a dashboard and becomes a decision tool.

First, real geography. These are the actual Lagos State and Local Government boundaries — the GRID3 2022 set, the same lineage used across the humanitarian and development sector. Every community point sits inside a real polygon, and the system checks the Local Government the surveyor wrote down against the Local Government the boundary actually contains. Where they disagree, it shows you — it does not quietly overwrite the surveyor.

Second, open mapping evidence. [Toggle on **Health facilities**, then **Jetties & landing points**, then **Waterways**.] These are 539 health facilities, 292 jetties and landing points, and nearly 1,200 waterway segments, mapped by OpenStreetMap contributors. We extracted them, cleaned them, and clipped them to Lagos. I want to be precise: this is open, contributor-maintained data. It is not the official State health registry. The system labels it exactly that way everywhere it appears.

Third — [toggle on the **Community concentration**] — this hexagon grid. It lets us compare where communities and need concentrate without the picture being distorted by the fact that Epe is huge and Apapa is small. Each hexagon just counts the surveyed communities inside it and summarises their need.

And then the analysis. [Scroll to the straight-line access panel.] For every located community, the platform calculates the straight-line distance to the nearest mapped health facility. Forty-one of our located communities are more than five kilometres from the nearest one. Twenty-seven are more than ten. [Pause.] And that's a straight line — before you account for the fact that several of these can only be reached by boat."

---

## Community drilldown — one example (about 1 minute)

[Click one community point to open its **community page**. Pick one you've rehearsed.]

"The system goes all the way down to the single community. Here is one.

People — population, households, women, youth, all survey estimates, and where we don't have a number it says 'Not recorded', not zero. Need — a transparent count of observed conditions, and you can see every one that's ticked. Health and access — disease risk, evacuation status, and now the straight-line distance to the nearest mapped facility. Environment — the field-reported flood rating and erosion threat. And the spatial context, with the source of every external comparison shown.

The point is: Lagos State to one community, and back, without losing the evidence trail."

---

## Accessibility — why riverine geography matters (about 1 minute)

[Go to **Accessibility**.]

"This page answers one question: how are these communities actually connected?

Some are road-only. Some are water-only. Some are both. The survey classified each one, and we keep that classification as the surveyors recorded it.

Here [point to the multiple-constraints table] are the communities that carry more than one access disadvantage at the same time — no way out in an emergency in an emergency, geographically isolated, far from any mapped facility, no landing point nearby. The system lists every contributing factor. It does not roll them into a single mystery score, and it does not automatically call them 'critical'. It shows you the reasons and lets you decide."

---

## Climate — what we know and what we haven't claimed (about 1 minute)

[Go to **Environment**.]

"Our flood layer here is field-reported — what communities told us they experience, scored and mapped. You can see where high flood scores cluster, and how many of those communities also have no evacuation plan or a severe sanitation gap.

What you will not see is a satellite flood map. We have not connected Earth-observation data yet. The platform is built to take it — the pipeline is there — but until it's connected and checked, we show you field evidence and we call it field evidence. I'd rather show you less and have you trust all of it."

---

## Scenario — how intervention planning works (about 1.5 minutes)

[Go to **Scenarios**.]

"This is the part that matters for budgeting.

Say we're considering a new primary health centre. [Choose Health Centre, click a point on the map, set the radius to 5 km.] The system immediately tells us: which communities fall inside that catchment, how much known population, how many of them are high-flood, how many are hard to evacuate.

[Move the point or change the radius.] Change the location, the numbers update. So you can compare two candidate sites on exactly the same criteria before a single naira is committed.

One honest caveat, and it's on the screen the whole time: this is a straight-line catchment. It is not a travel-time model. In riverine Lagos the real catchment is shaped by the water. This tells you reach as the crow flies — a planning input, not the final answer."

---

## Data quality — why the numbers are trustworthy (about 1 minute)

[Go to **Data Quality**.]

"I'll close the technical part here, because credibility is the whole point.

The system counts its own gaps. If the database says 134 communities, exactly 134 must load or it refuses to show a total. Missing values stay missing — they never become zero. The Local Government reconciliation I mentioned is on this page in full. And the open-mapping data has its own checks: what was extracted, what was dropped for being outside Lagos, what has no name.

It also tells you plainly what it does not have: no official facility registry yet, no modelled population, no satellite flood data, no travel-time routing. Those are labelled 'not configured', not hidden."

---

## Close — what this can become for Lagos State (about 1 minute)

"So where does this go.

Right now it already works with field evidence and open spatial data, and it produces community-level decisions you can defend.

The next layer is operational data. If Blue Lagos connects to LASWA for the waterways, LASEMA for emergency management, and LASHMA for health facilities, then the jetty register and the facility register become official, and each ministry can maintain its own data. At that point it stops being our tool and becomes a shared Lagos State decision system for the riverine corridor.

What I'd ask for is two things. A decision in principle on those data connections. And a pilot corridor — Epe, or the Badagry–Ojo axis — where we run this as the live planning view for a quarter and show you what it changes.

Thank you. I'm happy to take questions."
