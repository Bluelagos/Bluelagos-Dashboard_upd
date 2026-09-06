import { Filters } from "@/components/filters";
import { CommunityTable } from "@/components/community-table";
import { EmptyState, PageGuide, PageHeader, Panel } from "@/components/ui";
import { filterCommunities } from "@/lib/analytics";
import { getCommunities } from "@/lib/data";
import type { DashboardSearchParams } from "@/lib/domain";
import { parseDashboardFilters } from "@/lib/filters";
import { CommunityMap } from "@/components/community-map";
import { getAdministrativeLayer } from "@/lib/spatial";

export default async function Communities({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const all = await getCommunities();
  const filters = parseDashboardFilters(await searchParams, all.map((row) => row.lga));
  const rows = filterCommunities(all, filters);
  const showMap = Boolean(filters.q) && rows.some((row) => row.hasLocation);

  return (
    <>
      <PageHeader
        eyebrow="Community register"
        title="Communities"
        description="Search and compare every surveyed settlement, and open any one of them in full."
      />
      <PageGuide
        shows="The full list of surveyed communities, with the figures most often asked about in one place."
        read="Select a column heading to sort. Select a community name to open its full record. Communities without coordinates are still listed — they stay in every total on the platform."
        look={[
          "Communities with a high need score and a large population",
          "Communities marked urgent",
          "Records where the population was never captured",
        ]}
        method="Everything in this table comes straight from the field survey. The need score is a count of ten recorded conditions."
      />

      <Filters communities={all} filters={filters} action="/communities" />

      {showMap && (
        <Panel title="Search results on the map" subtitle={`${rows.filter((r) => r.hasLocation).length} of ${rows.length} matches can be mapped`}>
          <CommunityMap
            communities={rows}
            height={420}
            administrative={getAdministrativeLayer()}
            focusCommunitySlug={rows.find((row) => row.hasLocation)?.slug}
          />
        </Panel>
      )}

      <Panel title="" subtitle="" className={showMap ? "section-gap" : ""}>
        {rows.length ? (
          <CommunityTable rows={rows} />
        ) : (
          <EmptyState
            title="No communities match these filters"
            message="Try a different local government, or clear the filters to see the whole survey again."
            action={{ href: "/communities", label: "Clear filters" }}
          />
        )}
      </Panel>
    </>
  );
}
