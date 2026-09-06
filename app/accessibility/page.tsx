import { DomainPage } from "@/components/domain-page";
import { EmptyState, Panel, SectionHead } from "@/components/ui";
import { getCommunities } from "@/lib/data";
import { getSpatialContext } from "@/lib/spatial/context";
import { distanceBand, type DistanceBand } from "@/lib/spatial/proximity";
import { accessTakeaway } from "@/lib/takeaways";
import type { DashboardSearchParams } from "@/lib/domain";
import Link from "next/link";

const BANDS: DistanceBand[] = ["<2 km", "2–5 km", "5–10 km", ">10 km", "No mapped facility"];
const BAND_LABEL: Record<DistanceBand, string> = {
  "<2 km": "Under 2 km",
  "2–5 km": "2 to 5 km",
  "5–10 km": "5 to 10 km",
  ">10 km": "Over 10 km",
  "No mapped facility": "Nothing mapped nearby",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, communities, spatial] = await Promise.all([
    searchParams,
    getCommunities(),
    getSpatialContext(),
  ]);

  const routeCounts = new Map<string, number>();
  for (const community of communities) {
    const route = community.route?.replaceAll("_", " ") ?? "Not recorded";
    routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
  }

  const bandByLga = new Map<string, Record<DistanceBand, number>>();
  for (const row of spatial.rows.filter((r) => r.hasLocation)) {
    const band = distanceBand(row.nearestOsmHealthKm);
    const entry =
      bandByLga.get(row.lga) ??
      ({ "<2 km": 0, "2–5 km": 0, "5–10 km": 0, ">10 km": 0, "No mapped facility": 0 } as Record<
        DistanceBand,
        number
      >);
    entry[band] += 1;
    bandByLga.set(row.lga, entry);
  }

  const multiConstraint = [...spatial.rows]
    .filter((row) => row.accessConstraintCount >= 2)
    .sort((a, b) => b.accessConstraintCount - a.accessConstraintCount);

  return (
    <>
      <DomainPage
        route="/accessibility"
        params={params}
        config={{
          eyebrow: "Access",
          title: "Access",
          description:
            "Understand how communities connect to health facilities, waterways, jetties and nearby settlements.",
          tone: "water",
          primaryLabel: "No way out in an emergency",
          primary: (community) => community.strandingStatus === "HIGHLY_STRANDED",
          primaryMetric: "stranded",
          secondaryLabel: "More than 5 km from any neighbour",
          secondary: (community) =>
            community.hasLocation &&
            community.nearestCommunityKm !== null &&
            community.nearestCommunityKm > 5,
          secondaryMetric: "isolation",
          group: "route",
          tableLabel: "Communities with the hardest emergency access.",
          caveat:
            "Every distance here is measured in a straight line. There is no verified map of which channels are navigable, no official jetty register and no travel-time model, so none of these circles or distances should be read as journey times.",
          guide: {
            shows:
              "How each community reaches the outside world — by road, by water, or not at all in an emergency.",
            read: "The table further down groups communities by how far they sit from the nearest mapped health facility. A large distance can mean a real gap or simply a facility nobody has mapped yet.",
            look: [
              "Communities far from any mapped health facility",
              "Settlements that depend entirely on water to move",
              "Places where several access problems overlap",
            ],
            method:
              "Access type comes from the survey exactly as recorded. Distances are straight-line measurements to the nearest feature on the open map of Lagos.",
          },
          takeaway: accessTakeaway(spatial.rows),
          lookAt: [
            "Communities far from mapped health facilities",
            "Settlements relying on water access alone",
            "Areas where several access problems overlap",
          ],
        }}
      />

      <SectionHead
        title="How far from healthcare, by local government"
        description="Each community is placed in a distance band by how far it sits, in a straight line, from the nearest health facility on the open map."
      />
      <Panel
        title="Distance bands by local government"
        subtitle="Community counts. Not a policy threshold and not travel time."
        metric="healthDistance"
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Local government</th>
                {BANDS.map((band) => (
                  <th scope="col" className="num" key={band}>
                    {BAND_LABEL[band]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...bandByLga.entries()]
                .sort(
                  (a, b) =>
                    b[1][">10 km"] + b[1]["5–10 km"] - (a[1][">10 km"] + a[1]["5–10 km"]),
                )
                .map(([lga, counts]) => (
                  <tr key={lga}>
                    <td>{lga}</td>
                    {BANDS.map((band) => (
                      <td className="num" key={band}>
                        {counts[band] || ""}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="muted panel-body">
          Facilities come from the open map of Lagos (
          {spatial.osmMetadata.layers["osm-health-facilities"].featureCount} mapped, ODbL licence).
          Coverage is uneven, so a large distance can reflect a mapping gap as much as real
          remoteness — Data Quality compares the survey and open-map figures side by side.
        </p>
      </Panel>

      <SectionHead
        title="Communities facing more than one access problem"
        description="Every contributing factor is listed. Nothing is automatically labelled critical."
      />
      <Panel title="" subtitle="">
        {multiConstraint.length === 0 ? (
          <EmptyState
            title="No community currently has two access problems at once"
            message="Nothing in the survey trips two or more access factors together."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Community</th>
                  <th scope="col">Local government</th>
                  <th scope="col" className="num">
                    Problems
                  </th>
                  <th scope="col">What they are</th>
                </tr>
              </thead>
              <tbody>
                {multiConstraint.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.lga}</td>
                    <td className="num">{row.accessConstraintCount}</td>
                    <td>
                      {row.accessConstraintFactors.join("; ")}{" "}
                      <Link href="/priorities?view=areas&type=emergency">
                        See shared service options
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SectionHead
        title="What we can and cannot measure"
        description="Being clear about the limits is part of the evidence."
      />
      <Panel title="" subtitle="">
        <div className="panel-body evidence-grid">
          <article className="evidence-card">
            <h3>How communities travel</h3>
            <p>
              {[...routeCounts].map(([route, count]) => `${route}: ${count}`).join("; ")}. Recorded
              exactly as observed rather than recoded into modes we cannot verify.
            </p>
          </article>
          <article className="evidence-card">
            <h3>Straight-line distance</h3>
            <p>
              Available for the nearest community, hospital and city centre. It ignores shoreline,
              channel, road and any operational restriction.
            </p>
          </article>
          <article className="evidence-card">
            <h3 className="status-unavailable">Travel time by water or road</h3>
            <p>
              Not available. Every mapped waterway is marked as unknown navigability and
              unverified, so no journey time or reachable-area estimate is published.
            </p>
          </article>
        </div>
      </Panel>
    </>
  );
}
