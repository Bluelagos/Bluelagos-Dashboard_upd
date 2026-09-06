import { PageGuide, PageHeader, Panel, SectionHead } from "@/components/ui";
import { METRICS } from "@/lib/constants";
import type { ReactNode } from "react";

export const metadata = { title: "Methodology" };

/**
 * The one place where technical depth is the point.
 *
 * Each section leads with a plain explanation anyone can follow, then opens
 * into the technical detail a GIS or data professional would ask for. The
 * anchor ids are linked to from every info drawer in the product, so a reader
 * can always get from a number on screen to the method behind it.
 */
function Section({
  id,
  title,
  lead,
  plain,
  technical,
}: {
  id: string;
  title: string;
  lead: string;
  plain: ReactNode;
  technical: ReactNode;
}) {
  return (
    <details className="page-guide" id={id} style={{ marginBottom: 10 }}>
      <summary>
        {title}
        <span className="chip-row-label" style={{ marginLeft: "auto", marginRight: 8 }}>
          {lead}
        </span>
      </summary>
      <div style={{ padding: 16 }}>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 10,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          In plain terms
        </h3>
        <div className="method-plain">{plain}</div>
        <details className="drawer-tech" style={{ marginTop: 14 }}>
          <summary>Technical details</summary>
          <div className="method-technical">{technical}</div>
        </details>
      </div>
    </details>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Methodology"
        title="Methodology"
        description="How every figure on this platform is produced, in plain terms first and full technical detail underneath."
      />
      <PageGuide
        shows="The method behind each part of the platform: how the survey was collected, how population is counted, how distances are measured, and how priorities and shared service areas are worked out."
        read="Open a section for the plain explanation. Inside each one, “Technical details” gives the exact calculation, source and limitation."
        look={[
          "Which figures come from the field and which are calculated",
          "Where a limitation is stated rather than worked around",
          "What is deliberately not published, and why",
        ]}
      />

      <SectionHead
        title="How to read any number on this platform"
        description="Every figure carries one of four labels. Knowing which one tells you how much weight it can bear."
      />
      <Panel title="" subtitle="">
        <div className="panel-body evidence-grid">
          <article className="evidence-card">
            <h3>
              <span className="source-tag" data-kind="Field">
                Field
              </span>{" "}
              Collected in the community
            </h3>
            <p>
              Recorded by Blue Lagos enumerators during the visit: population estimates, sanitation,
              emergency movement, flooding, erosion and the community&rsquo;s own priority request.
              Read live from the community register.
            </p>
          </article>
          <article className="evidence-card">
            <h3>
              <span className="source-tag" data-kind="OpenStreetMap">
                Open map
              </span>{" "}
              Mapped by contributors
            </h3>
            <p>
              Health facilities, landing points and waterways recorded in OpenStreetMap (ODbL),
              extracted, clipped to Lagos and reviewed offline. Coverage is uneven, and it is never
              presented as an official Lagos State register.
            </p>
          </article>
          <article className="evidence-card">
            <h3>
              <span className="source-tag" data-kind="Derived">
                Calculated
              </span>{" "}
              Worked out by the platform
            </h3>
            <p>
              Distances to the nearest mapped feature, counts within a radius, the concentration
              grid and scenario catchments. All straight-line, never travel time.
            </p>
          </article>
          <article className="evidence-card">
            <h3>
              <span className="source-tag" data-kind="External">
                External
              </span>{" "}
              Published elsewhere
            </h3>
            <p className="status-unavailable">
              Administrative boundaries are integrated. Modelled population and satellite products
              are not: the adapters exist, but nothing has passed processing and review, so no
              modelled value is published or estimated.
            </p>
          </article>
        </div>
      </Panel>

      <SectionHead
        title="How each part works"
        description="Open a section for the plain explanation; the technical detail sits inside it."
      />

      <Section
        id="field-survey"
        title="The field survey"
        lead="Where everything starts"
        plain={
          <>
            <p>
              Blue Lagos enumerators visited riverine and coastal settlements across Lagos State and
              recorded, for each one, how many people live there, how they travel, what services they
              have, what they are exposed to, and what they most need. Answers are kept exactly as
              given.
            </p>
            <p>
              Where a question was not answered, the record stays blank. Nothing is filled in with a
              zero, an average or an estimate, and each community&rsquo;s completeness is shown
              beside its figures so a thin record is never mistaken for a good one.
            </p>
          </>
        }
        technical={
          <>
            <p>
              Records are read from the hosted analytical view at request time and paginated to
              completion. Each row passes identity validation and a schema parse before it is
              admitted; a row without valid identity fields blocks the whole dataset rather than
              being dropped silently.
            </p>
            <p>
              Dataset-level checks look for duplicate ids, duplicate name + LGA pairs and shared
              coordinate pairs, and the fetched row count is reconciled against the server count
              before any total is published. Completeness is the share of non-null core fields per
              record. Nulls are preserved end to end.
            </p>
          </>
        }
      />

      <Section
        id="population"
        title="Population"
        lead="Community estimates, added up"
        plain={
          <p>
            Each community gave its own estimate of how many people live there. The platform adds
            those together. Communities that could not give a figure are left out of the total and
            reported separately, rather than counted as zero — so the total is a floor, not a guess.
          </p>
        }
        technical={
          <>
            <p>
              Null-preserving aggregation: SUM over non-null values only, returned alongside the
              known and unknown record counts so every total can state its own coverage. The same
              function is used for households, women, youth and voter counts.
            </p>
            <p>
              No gridded population surface (WorldPop or equivalent) is integrated. Mixing a modelled
              surface with field estimates would produce a total that looks more precise than the
              evidence supports, so it is not done.
            </p>
          </>
        }
      />

      <Section
        id="administrative-boundaries"
        title="Local government boundaries"
        lead="Planning geography"
        plain={
          <p>
            Communities are grouped by local government so the evidence lines up with how Lagos State
            actually plans and budgets. The platform checks which boundary each community&rsquo;s
            coordinates fall inside and compares that with the local government recorded during the
            survey. Where they differ, both are shown — the survey answer is never overwritten.
          </p>
        }
        technical={
          <>
            <p>
              GRID3 2022 boundaries via geoBoundaries gbOpen (CC BY 4.0): one ADM1 state polygon and
              20 ADM2 local government polygons, validated for geometry type and duplicate
              identifiers on load. Attribution is a point-in-polygon test against the ADM2 layer.
            </p>
            <p>
              These are generalised planning boundaries, not cadastral. Coastal and lagoon
              settlements can legitimately fall outside a simplified land polygon; those cases are
              reported on the Data Quality page rather than corrected by moving the point.
            </p>
          </>
        }
      />

      <Section
        id="health-distance"
        title="Distance to services"
        lead="Straight-line estimates"
        plain={
          <>
            <p>
              For each community with coordinates, the platform finds the closest mapped health
              facility, landing point and waterway, and measures the direct distance to it — as the
              crow flies.
            </p>
            <p>
              This is not a journey time. It does not follow roads or channels and it takes no
              account of tides, vessels or road condition. A long distance can also mean a facility
              that simply has not been mapped yet, which is why the Data Quality page compares these
              figures with what communities themselves reported.
            </p>
          </>
        }
        technical={
          <>
            <p>
              Great-circle (Haversine) nearest-neighbour distances computed with Turf against the
              processed OpenStreetMap layers, precomputed by the spatial derivation pipeline
              (<code>npm run spatial:derive</code>) and loaded from disk at request time rather than
              recalculated per page.
            </p>
            <p>
              Distance bands (&lt;2, 2–5, 5–10, &gt;10 km) are presentational groupings, not policy
              thresholds. No routed network distance, isochrone or travel-time surface is published,
              because the mapped waterways carry no navigability attribution and no validated
              navigable network exists.
            </p>
          </>
        }
      />

      <Section
        id="community-priority"
        title="Community need and priority"
        lead="A transparent count, then a weighted view"
        plain={
          <>
            <p>
              Ten hardship conditions are checked for every community: deep poverty, no way to move a
              medical emergency out, a sanitation gap, no reliable power, no connectivity, no
              emergency plan, erosion displacing households, flooding rated 4 or 5 out of 5, heavy
              produce loss, and sitting more than 5 km from the nearest neighbouring community. Each
              one present adds a point, out of ten.
            </p>
            <p>
              A community with five or more is described as having the highest combined need. That is
              a planning band, and it is deliberately separate from the urgent-attention rule, which
              flags a community on the strength of any single severe condition.
            </p>
            <p>
              The Priorities page also offers a weighted view where you can change how much each
              factor counts and watch the ranking change. Communities are only ranked there when at
              least four of the six factors were actually recorded.
            </p>
          </>
        }
        technical={
          <>
            <p>
              <strong>Baseline need score</strong> (legacy methodology v1, preserved exactly): one
              point each for MPI ≥ 4, healthcare_stranding_status = HIGHLY_STRANDED,
              raw_sanitation_deficit, energy poverty, digital exclusion, disaster preparedness void,
              erosion_displacement_threat = CRITICAL_DISPLACEMENT, flood_health_hazard_score ≥ 4,
              severe post-harvest loss risk, and nearest_neighbor_km &gt; 5. Equal weights; missing
              observations contribute nothing.
            </p>
            <p>
              <strong>Urgent attention</strong> is a separate boolean rule: cholera_outbreak_risk =
              CRITICAL OR highly stranded OR MPI ≥ 4 OR critical erosion displacement.
            </p>
            <p>
              <strong>Weighted ranking:</strong> six dimensions min-max normalised to 0–1, multiplied
              by user weights, summed, then divided by the total weight of the dimensions actually
              observed for that record. Records with fewer than four observed dimensions return null
              rather than a partial score.
            </p>
            <p>
              <strong>Concentration grid:</strong> community points aggregated to an Uber H3
              hexagonal grid at resolution 7 (~5 km² per cell), with cell values being community
              counts and summed known population.
            </p>
          </>
        }
      />

      <Section
        id="shared-service-areas"
        title="Shared service areas"
        lead="Grouping and siting"
        plain={
          <>
            <p>
              Communities that sit close together and share the same kind of shortfall are grouped.
              Within each group, the platform looks for a point on land that would sit within reach
              of as many of those communities and people as possible, then reports how many fall
              inside that reach — counting each community once, even where groups overlap.
            </p>
            <p>
              Groups separated by open water are flagged, because a location that looks close on a
              map may not be reachable in practice.
            </p>
          </>
        }
        technical={
          <>
            <p>
              Density-based geographic clustering over community points with a configurable
              neighbourhood radius (3, 5, 7.5 or 10 km), optionally restricted to communities meeting
              the intervention&rsquo;s need criterion. Candidate points are screened by point-in-polygon
              against the Lagos State polygon and by proximity to buffered mapped waterways, so
              candidates on open water are rejected; jetty candidates invert that test and require
              shoreline proximity.
            </p>
            <p>
              Coverage is a straight-line service radius, never an isochrone. Unique population is
              de-duplicated across overlapping catchments. The candidate score compares points within
              a group only; it does not evaluate land ownership, buildability, planning approval,
              facility capacity or travel time.
            </p>
          </>
        }
      />

      <Section
        id="scenario-catchments"
        title="Scenario catchments"
        lead="Testing one location"
        plain={
          <p>
            You choose a point and a distance. Every surveyed community whose coordinates fall inside
            that distance is counted, along with its population estimate. The point is checked to make
            sure it sits on land inside Lagos State — or, for a jetty, on the shoreline.
          </p>
        }
        technical={
          <>
            <p>
              Point-in-circle test using great-circle distance from the chosen coordinate, with a
              null-preserving population sum over the communities inside the radius. The rendered ring
              is a spherical destination-point polygon (radius 6371.0088 km, 80 segments), computed
              locally rather than by importing the full Turf bundle into the browser.
            </p>
            <p>
              Circles are never labelled isochrones. Nothing is persisted: the scenario is a query,
              not a record.
            </p>
          </>
        }
      />

      <Section
        id="openstreetmap"
        title="The open map of Lagos"
        lead="Contributor evidence"
        plain={
          <p>
            Health facilities, jetties and waterways shown on the map were recorded by OpenStreetMap
            contributors. That makes them genuine evidence, but uneven evidence: a feature missing
            from the map is not proof it does not exist. Everywhere these appear, they are labelled
            as coming from the open map rather than from Lagos State.
          </p>
        }
        technical={
          <>
            <p>
              Extracted via Overpass, deduplicated on osm_type/osm_id, clipped by point-in-polygon
              against the GRID3 state boundary, and processed offline into committed GeoJSON so the
              application never calls Overpass at request time. Every feature retains its OSM id and
              original source tags.
            </p>
            <p>
              Unnamed features are kept and labelled as unnamed — no name is ever invented. Licensed
              ODbL; attribution is carried on every map. Navigability is recorded as unknown for every
              waterway, which is why no routing is offered.
            </p>
          </>
        }
      />

      <Section
        id="external-data"
        title="What is deliberately not published"
        lead="Known gaps"
        plain={
          <p>
            Some things people reasonably expect from a platform like this are missing on purpose:
            satellite flood mapping, modelled population grids, land cover, shoreline change rates and
            travel times by road or water. In each case the source has not been processed and
            reviewed, so publishing a number would mean presenting a guess as evidence.
          </p>
        }
        technical={
          <>
            <p>
              Earth-observation adapters are present but not authenticated, and no product has passed
              acquisition-period, cloud-mask and resolution review. No composite flood vulnerability
              score is generated because its elevation, historical water and modelled population
              inputs are all absent.
            </p>
            <p>
              Routing and isochrone outputs are withheld pending a validated navigable-water network.
              Marine access is limited to OSM ferry terminals and piers; there is no official Lagos
              State jetty register behind it.
            </p>
          </>
        }
      />

      <SectionHead
        title="Metric register"
        description="The formal definition, formula and caveat for each published metric."
      />
      <div className="grid two-col">
        {METRICS.map((metric) => (
          <Panel key={metric.key} title={metric.label} subtitle={metric.source}>
            <div className="panel-body">
              <p style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 0 }}>{metric.definition}</p>
              <div className="detail">
                <label>Formula</label>
                <strong>{metric.formula}</strong>
              </div>
              <div className="callout section-gap">{metric.caveat}</div>
            </div>
          </Panel>
        ))}
      </div>

      <SectionHead title="Method history" description="Changes are versioned, not silently swapped in." />
      <Panel title="" subtitle="">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>v1 legacy</td>
                <td>Baseline need score</td>
                <td>
                  <span className="badge positive">Preserved</span>
                </td>
                <td>Ten binary conditions, one point each; isolation is strictly &gt;5 km.</td>
              </tr>
              <tr>
                <td>v1 legacy</td>
                <td>Additive priority score</td>
                <td>
                  <span className="badge positive">Preserved</span>
                </td>
                <td>Retained for continuity with the original baseline report.</td>
              </tr>
              <tr>
                <td>v2</td>
                <td>Weighted ranking</td>
                <td>
                  <span className="badge">Exploratory</span>
                </td>
                <td>
                  Rebalanced across observed dimensions; unranked below four observed dimensions. Not
                  Lagos State policy.
                </td>
              </tr>
              <tr>
                <td>v2</td>
                <td>Straight-line spatial context</td>
                <td>
                  <span className="badge positive">Active</span>
                </td>
                <td>
                  Precomputed nearest-feature distances and H3 aggregation; superseded only when a
                  validated network exists.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
