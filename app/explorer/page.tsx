import { CommunityMap } from "@/components/community-map";
import { Filters } from "@/components/filters";
import { Kpi, PageGuide, PageHeader, Panel, SectionHead } from "@/components/ui";
import { filterCommunities } from "@/lib/analytics";
import { getCommunities } from "@/lib/data";
import type { DashboardSearchParams } from "@/lib/domain";
import { parseDashboardFilters } from "@/lib/filters";
import {
  getAdministrativeLayer,
  getAdministrativeProvenance,
  reconcileCommunityLga,
  validateAdministrativeLayer,
} from "@/lib/spatial";
import { getSpatialContext } from "@/lib/spatial/context";
import { Provenance } from "@/components/provenance";
import { SnapshotBanner } from "@/components/system-status";

function medianKm(values: Array<number | null>): string {
  const known = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!known.length) return "Not available";
  const mid = Math.floor(known.length / 2);
  const value = known.length % 2 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
  return `${value.toFixed(1)} km`;
}

export default async function Explorer({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const all = await getCommunities();
  const filters = parseDashboardFilters(await searchParams, all.map((row) => row.lga));
  const rows = filterCommunities(all, filters);
  const administrative = getAdministrativeLayer();
  const boundaryCheck = validateAdministrativeLayer();
  const reconciliation = reconcileCommunityLga(all);
  const geolocated = all.filter((c) => c.hasLocation).length;
  const spatial = await getSpatialContext();

  return (
    <>
      <PageHeader
        eyebrow="Map"
        title="Community Map"
        description="Explore surveyed communities, services, waterways and planning layers across Lagos."
      />
      <SnapshotBanner />
      <PageGuide
        shows="Every surveyed community placed inside Lagos State and its local government boundaries, with optional layers for health facilities, waterways, landing points and community concentration."
        read="Each dot is a community, coloured by the main need it reported. Use the layer panel on the map to switch extra layers on — they load only when you ask for them. Select a local government boundary to identify it, or a community to see its summary."
        look={[
          "How communities follow the water rather than the roads",
          "Where mapped health facilities are thin or absent",
          "Communities sitting outside every local government polygon",
        ]}
        method="Community points come from the field survey. Boundaries come from GRID3 2022 via geoBoundaries. Health facilities, waterways and landing points come from OpenStreetMap contributors and are labelled as such."
      />

      <Filters communities={all} filters={filters} action="/explorer" />

      <Panel
        title="Map view"
        subtitle={`${rows.filter((c) => c.hasLocation).length} communities shown inside the state outline and ${boundaryCheck.lgaCount} local government boundaries`}
      >
        <CommunityMap
          communities={rows}
          height={650}
          spatialControls
          administrative={administrative}
          lazyOverlays={["h3", "osmWaterways", "osmMarine", "osmHealth"]}
        />
      </Panel>

      <SectionHead
        title="How far communities sit from services"
        description="Every distance here is measured in a straight line to the nearest feature on the open map. It is not a travel time, and survey-reported distances are shown separately rather than replaced."
      />
      <div className="grid status-grid">
        <Kpi
          label="Typical distance to a health facility"
          value={medianKm(spatial.rows.map((row) => row.nearestOsmHealthKm))}
          note={`Middle value across ${spatial.rows.filter((r) => r.nearestOsmHealthKm !== null).length} mapped communities`}
          tone="health"
          metric="healthDistance"
        />
        <Kpi
          label="5 km or more from a health facility"
          value={spatial.rows.filter((r) => r.nearestOsmHealthKm !== null && r.nearestOsmHealthKm >= 5).length}
          note="A distance band, not a policy threshold"
          tone="warning"
          metric="healthDistance"
        />
        <Kpi
          label="No landing point within 5 km"
          value={spatial.rows.filter((r) => r.hasLocation && r.osmMarineWithin5Km === 0).length}
          note={`Of ${spatial.rows.filter((r) => r.hasLocation).length} mapped communities`}
          tone="water"
        />
        <Kpi
          label="More than one access problem"
          value={spatial.rows.filter((r) => r.accessConstraintCount >= 2).length}
          note="Every contributing factor is listed on the Access page"
          tone="critical"
          href="/accessibility"
          action="Open Access"
        />
      </div>

      <Panel
        title="Communities furthest from a mapped health facility"
        subtitle="Straight-line distance. The survey's own hospital distance is shown alongside it and never overwritten."
        className="section-gap"
        metric="healthDistance"
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Community</th>
                <th scope="col">Local government</th>
                <th scope="col" className="num">
                  Nearest mapped facility
                </th>
                <th scope="col" className="num">
                  Survey&apos;s own figure
                </th>
                <th scope="col" className="num">
                  Nearest landing point
                </th>
                <th scope="col" className="num">
                  Access problems
                </th>
              </tr>
            </thead>
            <tbody>
              {spatial.rows
                .filter((row) => row.hasLocation)
                .sort((a, b) => (b.nearestOsmHealthKm ?? 0) - (a.nearestOsmHealthKm ?? 0))
                .slice(0, 15)
                .map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.lga}</td>
                    <td className="num">
                      {row.nearestOsmHealthKm === null ? "Not available" : `${row.nearestOsmHealthKm.toFixed(1)} km`}
                      {row.nearestOsmHealthName ? ` · ${row.nearestOsmHealthName}` : ""}
                    </td>
                    <td className="num">
                      {row.surveyHospitalDistanceKm === null ? (
                        <span className="muted">Not recorded</span>
                      ) : (
                        `${row.surveyHospitalDistanceKm} km`
                      )}
                    </td>
                    <td className="num">
                      {row.nearestOsmMarineKm === null ? "Not available" : `${row.nearestOsmMarineKm.toFixed(1)} km`}
                    </td>
                    <td className="num">{row.accessConstraintCount || "0"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="muted panel-body">
          A facility appearing on the open map means an OpenStreetMap contributor recorded it. It is
          not an official Lagos State register, and coverage is uneven — so a long distance can mean
          a real gap or an unmapped facility.
        </p>
      </Panel>

      <SectionHead
        title="Does the survey's local government match the boundary?"
        description="We check which boundary each community's coordinates fall inside and compare it with the local government recorded during the survey. The survey answer is never overwritten."
      />
      <Panel title="" subtitle="" metric="boundaries">
        <div className="panel-body">
          <div className="grid status-grid">
            <Kpi
              label="Communities with coordinates"
              value={geolocated}
              note={`Of ${all.length} in the register`}
              tone="survey"
            />
            <Kpi
              label="Boundary agrees with the survey"
              value={reconciliation.matched}
              note="The recorded local government contains the point"
              tone="positive"
            />
            <Kpi
              label="Boundary differs"
              value={reconciliation.mismatched.length}
              note="Worth review; often just a boundary drawn coarsely"
              tone="warning"
            />
            <Kpi
              label="Outside every boundary"
              value={reconciliation.outsideAllLgas.length}
              note="Coastal and lagoon points can fall outside simplified land polygons"
              tone="neutral"
            />
          </div>
          {reconciliation.mismatched.length > 0 && (
            <div className="table-wrap section-gap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Community</th>
                    <th scope="col">Local government in the survey</th>
                    <th scope="col">Local government from the boundary</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.mismatched.slice(0, 25).map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.surveyLga}</td>
                      <td>{row.polygonLga}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Provenance data={getAdministrativeProvenance()} />
        </div>
      </Panel>
    </>
  );
}
