import Link from "next/link";
import { CommunityMap } from "@/components/community-map";
import { Kpi, PageGuide, PageHeader, Panel, SectionHead } from "@/components/ui";
import { getCommunityDataset } from "@/lib/data";
import { communityInsideLagos, reconcileCommunityLga, spatialCatalogue, validateAdministrativeLayer } from "@/lib/spatial";
import { getSpatialContext } from "@/lib/spatial/context";
export default async function Page() {
  const { records: rows, status, issues } = await getCommunityDataset();
  const spatial = await getSpatialContext();
  const osmReport = spatial.osmMetadata.report;
  const cmp = spatial.comparison;
  const missingCoords = rows.filter((c) => !c.hasLocation);
  const boundaryCheck = validateAdministrativeLayer();
  const outsideBoundary = rows.filter((community) => communityInsideLagos(community) === false);
  const reconciliation = reconcileCommunityLga(rows);
  const percentage = (known: number) => rows.length ? Math.round((known / rows.length) * 100) : 0;
  const health = Math.round(
    (rows.filter((c) => c.diseaseRisk !== null && c.strandingStatus !== null)
      .length /
      rows.length) *
      100,
  );
  const wash = Math.round(
    (rows.filter((c) => c.sanitationDeficit !== null).length / rows.length) *
      100,
  );
  const demo = Math.round(
    (rows.filter(
      (c) => c.population !== null && c.women !== null && c.youth !== null,
    ).length /
      rows.length) *
      100,
  );
  const infra = Math.round(
    (rows.filter(
      (c) =>
        c.jettyCondition !== null &&
        c.energyStatus !== null &&
        c.digitalStatus !== null,
    ).length /
      rows.length) *
      100,
  );
  return (
    <>
      <PageHeader
        eyebrow="Data quality"
        title="Data Quality"
        description="Check how complete and consistent the information behind the platform is."
      />
      <PageGuide
        shows="How much of the survey was actually filled in, where coordinates are missing, and where two sources disagree."
        read="Each figure is a share of the survey that holds a real value. A gap is always shown as a gap — nothing on this platform substitutes a zero for a missing answer."
        look={[
          "Which parts of the survey are least complete",
          "Communities recorded without coordinates",
          "Places where the survey and the open map disagree about distance",
        ]}
        method="Completeness is the share of records holding a non-null value for the fields named. Boundary checks test each community’s coordinates against the GRID3 polygons without overwriting the survey answer."
      />
      <div className="grid kpi-grid">
        <Kpi
          label="Communities in the register"
          value={rows.length}
          note={
            status.serverCount === null
              ? "The database did not report a total to check against"
              : `The database reports ${status.serverCount}; the counts ${status.complete ? "agree" : "do not agree"}`
          }
          tone={status.complete ? "positive" : "critical"}
          metric="communities"
        />
        <Kpi
          label="Have coordinates"
          value={`${percentage(rows.length - missingCoords.length)}%`}
          note={`${missingCoords.length} communities were recorded without a location`}
          tone={missingCoords.length ? "warning" : "positive"}
        />
        <Kpi
          label="Health questions answered"
          value={`${health}%`}
          note="Both disease risk and emergency movement recorded"
          tone="health"
        />
        <Kpi
          label="Sanitation recorded"
          value={`${wash}%`}
          note="A sanitation observation was captured"
          tone="water"
        />
        <Kpi
          label="Population details recorded"
          value={`${demo}%`}
          note="Population, women and youth all captured"
          tone="people"
        />
        <Kpi
          label="Services recorded"
          value={`${infra}%`}
          note="Jetty, power and connectivity all captured"
          tone="infrastructure"
        />
        <Kpi label="Notes raised on the data" value={status.validationIssueCount} note={`Last read ${new Date(status.fetchedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`} tone={status.validationIssueCount ? "warning" : "positive"} />
        <Kpi label="Gave a population estimate" value={`${percentage(status.populationKnownCount)}%`} note={`${status.populationKnownCount} did; ${status.populationUnknownCount} did not`} tone="people" metric="population" />
        <Kpi label="Boundary check" value={boundaryCheck.valid ? "Passed" : "Needs review"} note={`${boundaryCheck.stateCount} state outline and ${boundaryCheck.lgaCount} local governments loaded`} tone={boundaryCheck.valid ? "positive" : "critical"} metric="boundaries" />
        <Kpi label="Fall outside the state outline" value={outsideBoundary.length} note="Usually coastal points near a coarsely drawn shoreline" tone={outsideBoundary.length ? "warning" : "positive"} />
      </div>
      <SectionHead
        title="The thinnest records"
        description="Communities where the least was captured. A low score here means treat that community’s figures with more caution — not that it has fewer problems."
      />
      <div className="grid two-col">
        <Panel
          title="Least complete records"
          subtitle="Sorted by how much of the core survey was filled in"
          metric="completeness"
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Community</th>
                  <th scope="col">Local government</th>
                  <th scope="col" className="num">How complete</th>
                  <th scope="col">Location</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => a.completeness - b.completeness)
                  .slice(0, 30)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/communities/${c.slug}`}>{c.name}</Link>
                      </td>
                      <td>{c.lga}</td>
                      <td className="num">{c.completeness}%</td>
                      <td>{c.hasLocation ? "Recorded" : "Not recorded"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Communities we can place"
          subtitle="Only communities with coordinates appear here. The rest stay in the table and in every total."
        >
          <CommunityMap communities={rows} height={420} />
        </Panel>
      </div>
      <SectionHead
        title="What the checks found"
        description="Anything unusual is flagged and kept, never silently dropped."
      />
      <div className="grid two-col">
        <Panel
          title="Notes raised on the data"
          subtitle="Flagged for review rather than discarded"
        >
          <div className="panel-body">
            {issues.length ? (
              issues.slice(0, 100).map((issue, index) => (
                <div className="callout" key={`${issue.code}-${issue.recordId ?? "dataset"}-${index}`}>
                  <strong>{issue.code.replaceAll("_", " ")}</strong>: {issue.message}{issue.recordId !== undefined ? ` (record ${issue.recordId})` : ""}
                </div>
              ))
            ) : (
              <div className="callout">
                No problems were found in the current register.
              </div>
            )}
          </div>
        </Panel>
<Panel title="Outside datasets" subtitle="What is integrated, and what is still missing">
          <div className="panel-body">
            {spatialCatalogue().slice(1).map((layer) => (
              <div className={layer.status === "integrated" ? "callout" : "callout warning"} key={layer.id}>
                <strong>{layer.title}: {layer.status}</strong>. {layer.limitation}
              </div>
            ))}
            <div className="callout warning"><strong>Not yet possible:</strong> checks on water-route connectivity, satellite coverage and population grids cannot run until a verified navigable network, reviewed satellite products and a population raster are available.</div>
          </div>
        </Panel>
      </div>
      <Panel title="The open map of Lagos" subtitle="Features recorded by OpenStreetMap contributors. Coverage is uneven — that is a limitation of the source, not a fault in the survey." className="section-gap">
        <div className="panel-body">
          <div className="grid status-grid">
            <div className="kpi"><div className="kpi-label">Features pulled from the open map</div><div className="kpi-value">{osmReport.inputRecords}</div><div className="kpi-note">Retrieved {spatial.osmMetadata.retrievedAt.slice(0, 10)}</div></div>
            <div className="kpi"><div className="kpi-label">Dropped for being outside Lagos</div><div className="kpi-value">{osmReport.droppedOutsideLagos}</div><div className="kpi-note">Checked against the state outline</div></div>
            <div className="kpi"><div className="kpi-label">Duplicates removed</div><div className="kpi-value">{osmReport.duplicateOsmIds}</div><div className="kpi-note">Same feature recorded more than once</div></div>
            <div className="kpi"><div className="kpi-label">Kept without a name</div><div className="kpi-value">{osmReport.unnamedKept.health + osmReport.unnamedKept.marine + osmReport.unnamedKept.waterway}</div><div className="kpi-note">{osmReport.unnamedKept.health} health, {osmReport.unnamedKept.marine} landing, {osmReport.unnamedKept.waterway} waterway. No name was invented.</div></div>
          </div>
          <div className="table-wrap section-gap">
            <table className="data-table">
              <thead><tr><th scope="col">Layer</th><th scope="col" className="num">Features</th><th scope="col" className="num">Named</th><th scope="col" className="num">Unnamed</th></tr></thead>
              <tbody>
                {Object.entries(spatial.osmMetadata.layers).map(([id, l]) => (
                  <tr key={id}><td>{l.title}</td><td className="num">{l.featureCount}</td><td className="num">{l.namedCount}</td><td className="num">{l.unnamedCount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
      <Panel title="Does the survey agree with the open map?" subtitle="A comparison, not an error report. Disagreement can mean an unmapped facility, a different kind of facility, or a route the survey knows about and the map does not." className="section-gap" metric="healthDistance">
        <div className="panel-body">
          {cmp.bothKnown === 0 && (
            <div className="callout warning">
              The field survey did not record a numeric distance to a health facility for any community
              (<code>dist_to_hospital_km</code> is empty in every row). The OSM-derived straight-line
              distance is therefore the platform&rsquo;s first facility-distance estimate, not a check
              against a survey figure. It should be read as indicative until an authoritative Lagos State
              facility register is loaded.
            </div>
          )}
          <div className="grid status-grid">
            <div className="kpi"><div className="kpi-label">Both figures available</div><div className="kpi-value">{cmp.bothKnown}</div><div className="kpi-note">Of {rows.length} communities</div></div>
            <div className="kpi"><div className="kpi-label">Agree within 1 km</div><div className="kpi-value">{cmp.withinOneKm}</div><div className="kpi-note">The two sources are close</div></div>
            <div className="kpi"><div className="kpi-label">Survey says much farther</div><div className="kpi-value">{cmp.surveyFartherBy2Km}</div><div className="kpi-note">The map may show a closer facility the community does not use</div></div>
            <div className="kpi"><div className="kpi-label">Map says much farther</div><div className="kpi-value">{cmp.osmFartherBy2Km}</div><div className="kpi-note">The map may be missing the facility the community named</div></div>
            <div className="kpi"><div className="kpi-label">Survey figure only</div><div className="kpi-value">{cmp.surveyOnly}</div><div className="kpi-note">No coordinates, or nothing mapped nearby</div></div>
            <div className="kpi"><div className="kpi-label">Neither figure</div><div className="kpi-value">{cmp.neither}</div><div className="kpi-note">Left blank rather than set to zero</div></div>
          </div>
        </div>
      </Panel>
      <Panel title="Boundary checks" subtitle="Run against the GRID3 local government boundaries" className="section-gap" metric="boundaries">
        <div className="panel-body">
          <div className={boundaryCheck.valid ? "callout" : "callout warning"}>
            <strong>Boundary layer:</strong> {boundaryCheck.stateCount} state outline and {boundaryCheck.lgaCount} local government boundaries loaded, with {boundaryCheck.duplicateIds} duplicates found. {boundaryCheck.valid ? "Passed." : "Needs review."}
          </div>
          <div className={reconciliation.mismatched.length ? "callout warning" : "callout"}>
            <strong>Does the survey’s local government match the boundary?</strong> {reconciliation.matched} agree, {reconciliation.mismatched.length} differ, {reconciliation.outsideAllLgas.length} fall outside every boundary and {reconciliation.unlocated} have no coordinates. Differences are flagged, never corrected.
          </div>
          {reconciliation.mismatched.length > 0 && (
            <div className="table-wrap section-gap">
              <table className="data-table">
                <thead><tr><th scope="col">Community</th><th scope="col">In the survey</th><th scope="col">From the boundary</th></tr></thead>
                <tbody>
                  {reconciliation.mismatched.slice(0, 40).map((row) => (
                    <tr key={row.id}><td><Link href={`/communities/${rows.find((c) => c.id === row.id)?.slug ?? ""}`}>{row.name}</Link></td><td>{row.surveyLga}</td><td>{row.polygonLga}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reconciliation.outsideAllLgas.length > 0 && (
            <div className="callout section-gap">
              Outside every local government boundary: {reconciliation.outsideAllLgas.map((row) => row.name).join(", ")}. Coastal and lagoon points can legitimately fall outside a simplified land boundary.
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
