import { notFound } from "next/navigation";
import { CommunityMap } from "@/components/community-map";
import { Panel, Value } from "@/components/ui";
import { formatNumber } from "@/lib/analytics";
import { getCommunities } from "@/lib/data";
import { getAdministrativeLayer, lgaForPoint } from "@/lib/spatial";
import { getSpatialContext } from "@/lib/spatial/context";
import { getPersistedSpatialContext } from "@/lib/spatial/derived";
import { getOsmWaterways } from "@/lib/spatial/osm";
import { analyzeSharedServiceAreasCached } from "@/lib/spatial/service-area-cache";
import Link from "next/link";

const Detail = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) => (
  <div className="detail">
    <label>{label}</label>
    <strong>
      <Value value={value} />
    </strong>
  </div>
);
export default async function Dossier({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rows = await getCommunities();
  const c = rows.find((x) => x.slug === slug);
  if (!c) notFound();
  const spatial = (await getSpatialContext()).byId.get(c.id) ?? null;
  const [persisted, waterways] = c.hasLocation ? await Promise.all([getPersistedSpatialContext(), getOsmWaterways()]) : [null, null];
  const state = getAdministrativeLayer().features.find((feature) => feature.properties.admin_level === "ADM1");
  const defaultHealthArea = persisted && waterways && state ? analyzeSharedServiceAreasCached(rows, persisted.communities.map((item) => ({ communityId: item.community_id, healthDistanceKm: item.distance_km, marineDistanceKm: item.marine_access_distance_km, waterwayDistanceKm: item.waterway_distance_km })), { state: state.geometry, waterways: waterways.features, landWaterwayBufferKm: 0.05, shorelineToleranceKm: 0.25 }, { intervention: "health", clusterDistanceKm: 5, serviceRadiusKm: 5 }).areas.find((area) => area.communityIds.includes(c.id)) ?? null : null;
  const pregnancyAccess =
    c.strandingStatus === "HIGHLY_STRANDED" && c.pregnanciesAtRisk !== null
      ? c.pregnanciesAtRisk
      : null;
  const polygonLga =
    c.hasLocation && c.longitude !== null && c.latitude !== null
      ? (lgaForPoint(c.longitude, c.latitude)?.properties.name ?? "Outside mapped LGA polygons")
      : null;
  return (
    <>
      <div className="dossier-hero">
        <section className="panel community-title">
          <div className="eyebrow">{c.district}</div>
          <h1>{c.name}</h1>
          <div className="community-meta">
            <span className="badge">{c.lga}</span>
            <span className="badge">{c.cluster || "No cluster recorded"}</span>
            {c.critical && (
              <span className="badge critical">Needs urgent attention</span>
            )}
            <span className="badge">{c.completeness}% of the record filled in</span>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 12.5,
              lineHeight: 1.6,
              marginTop: 18,
            }}
          >
            {c.hasLocation
              ? `Recorded at ${c.latitude?.toFixed(5)}, ${c.longitude?.toFixed(5)} during the survey.`
              : "No coordinates were recorded for this community. Everything else it reported is still included in every total."}
          </p>
        </section>
        <Panel
          title="Need score"
          subtitle="How many of ten recorded hardship conditions this community reported"
          metric="needScore"
        >
          <div className="panel-body">
            <div className="kpi-value">
              {c.needScore}
              <span style={{ fontSize: 13, color: "var(--muted)" }}> / 10</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {c.needFlags.length ? (
                c.needFlags.map((x) => (
                  <span className="badge critical" key={x}>
                    {x}
                  </span>
                ))
              ) : (
                <span className="muted">
                  No hardship condition was recorded. That is not the same as no
                  problem — check how complete the record is.
                </span>
              )}
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid two-col section-gap">
        <Panel
          title="People"
          subtitle="Estimates given by the community. A blank means it was not recorded, never zero."
          metric="population"
        >
          <div className="panel-body detail-grid">
            <Detail label="Population" value={formatNumber(c.population)} />
            <Detail label="Households" value={c.households} />
            <Detail label="Registered voters" value={formatNumber(c.voters)} />
            <Detail label="Women" value={formatNumber(c.women)} />
            <Detail label="Youth" value={formatNumber(c.youth)} />
            <Detail
              label="Pregnancies with no way out in an emergency"
              value={formatNumber(pregnancyAccess)}
            />
          </div>
        </Panel>
        <Panel title="Health, water and sanitation" subtitle="What the survey recorded on the day of the visit">
          <div className="panel-body detail-grid">
            <Detail
              label="Waterborne disease risk"
              value={c.diseaseRisk?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Moving a medical emergency out"
              value={c.strandingStatus?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Sanitation"
              value={
                c.sanitationDeficit === null
                  ? null
                  : c.sanitationDeficit
                    ? "A gap was recorded"
                    : "No gap recorded"
              }
            />
            <Detail
              label="Flooding, rated by the community"
              value={
                c.floodHazard === null ? null : `${c.floodHazard} out of 5`
              }
            />
            <Detail label="Nearest hospital they named" value={c.hospitalName} />
            <Detail
              label="How far that hospital is"
              value={
                c.hospitalDistanceKm === null
                  ? null
                  : `${c.hospitalDistanceKm.toFixed(1)} km in a straight line`
              }
            />
          </div>
        </Panel>
      </div>
      <div className="grid two-col section-gap">
        <Panel
          title="Getting there and basic services"
          subtitle="Distances are straight-line estimates, not journey times"
        >
          <div className="panel-body detail-grid">
            <Detail
              label="How people travel here"
              value={c.route?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Jetty or landing"
              value={c.jettyCondition?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Electricity"
              value={c.energyStatus?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Phone and internet"
              value={c.digitalStatus?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Nearest other community"
              value={
                c.nearestCommunityKm === null
                  ? null
                  : `${c.nearestCommunityName || "Unnamed"} · ${c.nearestCommunityKm.toFixed(1)} km`
              }
            />
            <Detail
              label="Distance to the city centre"
              value={
                c.cbdDistanceKm === null
                  ? null
                  : `${c.cbdDistanceKm.toFixed(1)} km in a straight line`
              }
            />
          </div>
        </Panel>
        <Panel
          title="Livelihoods and environment"
          subtitle="Conditions as recorded, without inferring their effects"
        >
          <div className="panel-body detail-grid">
            <Detail
              label="Main occupation"
              value={c.occupation?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Depth of poverty"
              value={c.mpi === null ? null : `${c.mpi} out of 5`}
            />
            <Detail
              label="Catch or harvest lost before sale"
              value={c.harvestRisk?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Erosion"
              value={c.erosionRisk?.replaceAll("_", " ") || null}
            />
            <Detail
              label="Emergency plan"
              value={
                c.disasterPreparednessVoid === null
                  ? null
                  : c.disasterPreparednessVoid
                    ? "None recorded"
                    : "One is in place"
              }
            />
            <Detail label="Other communities within 3 km" value={c.communitiesWithin3Km} />
          </div>
        </Panel>
      </div>
      <Panel
        title="What this community asked for"
        subtitle="Kept exactly as it was given during the survey"
        className="section-gap"
      >
        <div className="panel-body voice">
          {c.priorityRequest || "No request was recorded."}
        </div>
      </Panel>
      {c.hasLocation && (
        <Panel
          title="Where it is"
          subtitle="The survey location, inside the state and local government boundaries"
          className="section-gap"
        >
          <CommunityMap communities={[c]} height={390} administrative={getAdministrativeLayer()} />
        </Panel>
      )}
      <Panel title="Distance to services" subtitle="Straight-line distances to the nearest features on the open map. The survey’s own figures are shown alongside and never replaced." className="section-gap" metric="healthDistance">
        <div className="panel-body detail-grid">
          <Detail label="Local government, from the survey" value={c.lga} />
          <Detail label="Local government, from the boundary" value={polygonLga} />
          <Detail
            label="Nearest health facility on the open map"
            value={
              spatial?.nearestOsmHealthKm == null
                ? null
                : `${spatial.nearestOsmHealthKm.toFixed(1)} km${spatial.nearestOsmHealthName ? ` · ${spatial.nearestOsmHealthName}` : ""}${spatial.nearestOsmHealthType ? ` (${spatial.nearestOsmHealthType})` : ""}`
            }
          />
          <Detail
            label="What the survey said, for comparison"
            value={
              spatial?.surveyHospitalDistanceKm == null
                ? null
                : `${spatial.surveyHospitalDistanceKm.toFixed(1)} km${c.hospitalName ? ` · ${c.hospitalName}` : ""}`
            }
          />
          <Detail
            label="Difference between the two"
            value={
              spatial?.surveyVsOsmHealthDeltaKm == null
                ? null
                : `${spatial.surveyVsOsmHealthDeltaKm > 0 ? "+" : ""}${spatial.surveyVsOsmHealthDeltaKm.toFixed(1)} km — a comparison, not a correction`
            }
          />
          <Detail
            label="Nearest landing point on the open map"
            value={
              spatial?.nearestOsmMarineKm == null
                ? null
                : `${spatial.nearestOsmMarineKm.toFixed(1)} km straight-line${spatial.nearestOsmMarineName ? ` · ${spatial.nearestOsmMarineName}` : ""}${spatial.nearestOsmMarineKind ? ` (${spatial.nearestOsmMarineKind.replaceAll("_", " ")})` : ""}`
            }
          />
          <Detail
            label="Landing points within 5 km"
            value={spatial?.hasLocation ? String(spatial.osmMarineWithin5Km) : null}
          />
          <Detail
            label="Nearest mapped waterway"
            value={spatial?.nearestOsmWaterwayKm == null ? null : `${spatial.nearestOsmWaterwayKm.toFixed(1)} km`}
          />
          <Detail
            label="Access problems recorded"
            value={
              spatial == null
                ? null
                : spatial.accessConstraintCount === 0
                  ? "None"
                  : `${spatial.accessConstraintCount}: ${spatial.accessConstraintFactors.join("; ")}`
            }
          />
          <Detail label="Modelled population nearby" value={null} />
          <Detail label="Satellite flood mapping" value={null} />
          <Detail label="Shoreline change" value={null} />
          <Detail label="Travel time by road or water" value={null} />
        </div>
        <div className="panel-body callout">
          Features &ldquo;on the open map&rdquo; were recorded by OpenStreetMap contributors, not by Lagos
          State, so coverage is uneven. Every distance here is measured in a straight line, not as a
          journey. The last four rows are blank because those datasets have not been processed and
          reviewed — they are withheld rather than estimated.
          <details className="drawer-tech" style={{ marginTop: 10 }}>
            <summary>Technical detail</summary>
            <p>
              Distances are great-circle (Haversine) nearest-neighbour calculations against the
              processed OpenStreetMap layers (ODbL). Boundary attribution is a point-in-polygon test
              against GRID3 2022 geometry. No modelled population surface, earth-observation product
              or routed travel-time network is integrated.
            </p>
          </details>
        </div>
      </Panel>
      {defaultHealthArea?.candidate && <Panel title="Could a shared facility work here?" subtitle="Using the default settings: highest-need communities, grouped within 5 km, with a 5 km reach" className="section-gap" metric="sharedServiceAreas"><div className="panel-body detail-grid"><Detail label="Other communities in the group" value={defaultHealthArea.communities.length - 1}/><Detail label="Location being tested" value={`${defaultHealthArea.candidate.coordinate[1].toFixed(4)}, ${defaultHealthArea.candidate.coordinate[0].toFixed(4)}`}/><Detail label="How far this community is from it" value={`${distanceToCandidate(c, defaultHealthArea.candidate.coordinate).toFixed(1)} km`}/></div><div className="panel-body"><Link className="btn" href="/priorities?view=areas&type=health">Open shared service areas</Link></div></Panel>}
      <Panel title="Where this record comes from" subtitle="" className="section-gap">
        <div className="panel-body callout">
          Everything above was collected by the Blue Lagos community survey and is read from the live
          register each time this page loads. Population, household and voter figures are the
          community&rsquo;s own estimates. The distances supplied with the survey are straight-line
          descriptors. Nothing here claims a route, a cause or a satellite measurement.
        </div>
      </Panel>
    </>
  );
}

function distanceToCandidate(community: { longitude: number | null; latitude: number | null }, candidate: [number, number]) {
  if (community.longitude === null || community.latitude === null) return 0;
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(candidate[1] - community.latitude);
  const dLon = radians(candidate[0] - community.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(community.latitude)) * Math.cos(radians(candidate[1])) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}
