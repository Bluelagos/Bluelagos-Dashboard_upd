import { DomainPage } from "@/components/domain-page";
import { CommunityMap } from "@/components/community-map";
import { Panel, SectionHead } from "@/components/ui";
import { getCommunities } from "@/lib/data";
import { getAdministrativeLayer } from "@/lib/spatial";
import { getSpatialContext } from "@/lib/spatial/context";
import { healthTakeaway } from "@/lib/takeaways";
import type { DashboardSearchParams } from "@/lib/domain";
import Link from "next/link";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, rows, spatial] = await Promise.all([
    searchParams,
    getCommunities(),
    getSpatialContext(),
  ]);

  const healthAccess = spatial.rows.map((item) => ({
    id: item.id,
    distanceKm: item.nearestOsmHealthKm,
    facility: item.nearestOsmHealthName,
  }));
  const takeaway = healthTakeaway(
    rows,
    spatial.rows.map((row) => ({ lga: row.lga, distanceKm: row.nearestOsmHealthKm })),
  );

  return (
    <>
      <DomainPage
        route="/health"
        params={params}
        config={{
          eyebrow: "Health & water",
          title: "Health & Water",
          description:
            "See where communities face gaps in healthcare access, emergency movement, drinking water and sanitation.",
          tone: "health",
          primaryLabel: "Sanitation gap and no way out",
          primary: (c) => c.sanitationDeficit === true && c.strandingStatus === "HIGHLY_STRANDED",
          primaryMetric: "stranded",
          secondaryLabel: "Sanitation gap in a flood-exposed community",
          secondary: (c) =>
            c.sanitationDeficit === true && c.floodHazard !== null && c.floodHazard >= 4,
          secondaryMetric: "sanitation",
          group: "diseaseRisk",
          tableLabel: "Communities where health and water problems land together.",
          caveat:
            "Disease risk, sanitation and emergency movement are all field observations. Population figures describe how many people live in these communities — they are not case counts, and nothing here proves that one condition causes another.",
          guide: {
            shows:
              "Where healthcare access, emergency movement, drinking water and sanitation problems overlap in the same community.",
            read: "The first figure counts communities carrying two problems at once: no working sanitation and no way to move a medical emergency out. The map lower down colours each community by how far it sits from the nearest mapped health facility.",
            look: [
              "Communities coloured red or orange on the distance map",
              "Places where a sanitation gap and a flood rating appear together",
              "Whether the furthest communities also have the highest need scores",
            ],
            method:
              "Sanitation and emergency movement come straight from the field survey. Distance to a health facility is measured in a straight line to the nearest facility on the open map of Lagos.",
          },
          takeaway,
          lookAt: [
            "Communities more than 10 km from any mapped facility",
            "Sanitation gaps in communities that also flood",
            "Where one new facility could cover several settlements",
          ],
        }}
      />

      <SectionHead
        title="Distance to healthcare"
        description="Each community is coloured by how far it sits, in a straight line, from the nearest health facility on the open map. Colour shows distance, not travel time."
      />
      <Panel
        title="Distance to the nearest mapped health facility"
        subtitle="Straight-line distance — it does not follow roads or channels"
        metric="healthDistance"
        actions={
          <Link className="btn secondary small" href="/priorities?view=areas&type=health">
            Test a shared facility
          </Link>
        }
      >
        <CommunityMap
          communities={rows}
          height={520}
          administrative={getAdministrativeLayer()}
          lazyOverlays={["osmHealth", "osmWaterways"]}
          healthAccess={healthAccess}
        />
      </Panel>
    </>
  );
}
