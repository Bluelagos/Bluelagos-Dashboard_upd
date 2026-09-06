# Blue Lagos Riverine Intelligence — Executive Summary

*For senior Lagos State policy leadership. One page. No technical detail.*

---

## The problem

Lagos State's coastal and riverine settlements — in Epe, Ojo, Amuwo-Odofin, Badagry, Ibeju-Lekki and along the lagoon — are hard to see in conventional planning data. They are counted at Local Government level, if at all. Whether a community is reachable by road, by water, or not at all in an emergency does not show up in an LGA-level table. Yet these are the places where a flood, a difficult childbirth or a cholera outbreak becomes a crisis fastest.

## What Blue Lagos is

A decision-support platform that works at the level of the **individual community**, not the LGA average. It combines:

1. **Field evidence** — a Blue Lagos household survey of **134 riverine communities** (93 with GPS locations), covering population, sanitation, medical-evacuation status, flood experience, erosion threat, energy and the community's own stated priority.
2. **Real Lagos geography** — the official-style GRID3 State and 20 Local Government boundary polygons.
3. **Open mapping evidence** — **539 health facilities, 292 jetties/landing points and 1,196 waterway segments** mapped by OpenStreetMap contributors, cleaned and clipped to Lagos.
4. **Transparent spatial analysis** — for every located community: how far, in a straight line, to the nearest mapped clinic or hospital; how many landing points are within reach; which communities carry several access disadvantages at once.

## What it lets you do

- See **where need concentrates** — not just how many communities are in difficulty, but where several risks overlap in the same place.
- **Drill from Lagos State to one community** in two clicks, with every number's source shown.
- **Test an intervention before committing to it**: place a hypothetical health centre or jetty on the map, choose a catchment radius, and see which communities and how much known population fall inside, and what risks they carry.
- **Trust the numbers**: a missing value is shown as "Not recorded", never converted to zero; the survey's declared LGA is checked against the boundary polygon and disagreements are surfaced, not silently corrected.

## Current coverage and honest limits

- The survey currently covers **7 of 20 LGAs**, concentrated in Epe. It is a strong riverine sample, not a full-state census.
- The survey did not capture a numeric distance to a health facility; the platform's facility distances currently come from **OpenStreetMap**, which is contributor-maintained and uneven in coverage. It is not an official Lagos State health registry.
- Distances are **straight-line**, not travel time. Water routing and road condition are not yet modelled.
- **Satellite-derived flood mapping and modelled population are not yet integrated.** The current flood layer is field-reported. The platform is built to take these layers; they are the next step.

## The institutional opportunity

The platform already turns field and open-mapping evidence into community-level decisions. The next layer is **operational data integration** — connecting LASWA (waterways), LASEMA (emergency management), LASHMA (health) and the Ministry of Physical Planning so that jetty registries, facility registries and incident data flow in, and so ministries can update their own data. That converts a strong analytical tool into a shared Lagos State decision system for the riverine corridor.
