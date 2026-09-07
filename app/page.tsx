import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CloudRain,
  Droplets,
  GraduationCap,
  HeartPulse,
  Home,
  LifeBuoy,
  MapPin,
  Network,
  ShieldAlert,
  UserRound,
  Users,
  Vote,
  Waves,
} from "lucide-react";
import { CommunityMap } from "@/components/community-map";
import { Filters } from "@/components/filters";
import {
  KeyTakeaway,
  Kpi,
  PageGuide,
  PageHeader,
  Panel,
  SectionHead,
  TakeawayRow,
  ThemeCard,
  WhatToLookAt,
  NeedScore,
} from "@/components/ui";
import {
  aggregateHouseholdFloor,
  aggregateKnown,
  filterCommunities,
  formatNumber,
} from "@/lib/analytics";
import { getCommunities } from "@/lib/data";
import type { DashboardSearchParams } from "@/lib/domain";
import { parseDashboardFilters } from "@/lib/filters";
import { overviewTakeaway } from "@/lib/takeaways";
import { OverviewCharts } from "@/components/overview-charts";
import { SnapshotBanner } from "@/components/system-status";

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const all = await getCommunities();
  const params = await searchParams;
  const filters = parseDashboardFilters(params, all.map((row) => row.lga));
  const rows = filterCommunities(all, filters);

  const ranked = [...rows]
    .sort((a, b) => b.needScore - a.needScore || b.priorityScore - a.priorityScore)
    .slice(0, 7);
  const mapped = rows.filter((c) => c.hasLocation).length;
  const urgent = rows.filter((c) => c.critical).length;
  const stranded = rows.filter((c) => c.strandingStatus === "HIGHLY_STRANDED").length;
  const sanitation = rows.filter((c) => c.sanitationDeficit === true).length;
  const highFlood = rows.filter((c) => c.floodHazard !== null && c.floodHazard >= 4).length;
  const population = aggregateKnown(rows, "population");
  const households = aggregateHouseholdFloor(rows);
  const voters = aggregateKnown(rows, "voters");
  const women = aggregateKnown(rows, "women");
  const youth = aggregateKnown(rows, "youth");

  const takeaway = overviewTakeaway(rows);

  return (
    <>
      <PageHeader
        eyebrow="Statewide overview"
        title="Overview"
        description="A community map of Lagos' riverine settlements — their needs, access and environment."
      />
      <SnapshotBanner />
      <PageGuide
        shows="Every riverine and coastal community visited by the Blue Lagos survey, how many people they represent, and where conditions are hardest."
        read="The headline figures describe the communities currently in view. The map shows each settlement, coloured by the main need it reported. The list on the right ranks communities by how many hardship conditions they recorded."
        look={[
          "How the communities spread along the lagoon and creek system rather than the road network",
          "Where urgent-attention communities cluster together instead of appearing one by one",
          "Which parts of the state are thin on mapped services",
        ]}
        method="Community counts, population and reported conditions come from the Blue Lagos field survey. Boundaries come from GRID3. Anything calculated by the platform is labelled where it appears."
      />

      <Filters communities={all} filters={filters} />

      <div className="grid kpi-grid kpi-grid-wide">
        <Kpi
          label="Communities surveyed"
          value={formatNumber(rows.length)}
          note={`${mapped} placed on the map; ${rows.length - mapped} recorded without coordinates`}
          tone="survey"
          icon={<MapPin aria-hidden="true" />}
          href="/communities"
          action="Browse communities"
          metric="communities"
        />
        <Kpi
          label="Population represented"
          value={formatNumber(population.value)}
          note={
            population.unknownCount
              ? `${population.knownCount} communities gave an estimate; ${population.unknownCount} did not`
              : `Across ${rows.length} surveyed communities`
          }
          tone="people"
          icon={<Users aria-hidden="true" />}
          href="/demographics"
          action="See the people page"
          metric="population"
        />
        <Kpi
          label="Households represented"
          value={households.value === null ? "Unavailable" : `at least ${formatNumber(households.value)}`}
          note={
            households.unknownCount
              ? `Floor implied by the bands ${households.knownCount} communities reported; ${households.unknownCount} gave none`
              : "Floor implied by the household band each community reported"
          }
          tone="infrastructure"
          icon={<Home aria-hidden="true" />}
          href="/demographics"
          action="See the people page"
          metric="households"
        />
        <Kpi
          label="Registered voters"
          value={formatNumber(voters.value)}
          note={
            voters.unknownCount
              ? `${voters.knownCount} communities gave a figure; ${voters.unknownCount} did not`
              : `Reported across ${rows.length} surveyed communities`
          }
          tone="survey"
          icon={<Vote aria-hidden="true" />}
          href="/sdgs"
          action="See civic access"
          metric="voters"
        />
        <Kpi
          label="Women recorded"
          value={formatNumber(women.value)}
          note={
            women.unknownCount
              ? `${women.knownCount} communities gave a figure; ${women.unknownCount} did not`
              : `Reported across ${rows.length} surveyed communities`
          }
          tone="people"
          icon={<UserRound aria-hidden="true" />}
          href="/demographics"
          action="See the people page"
          metric="women"
        />
        <Kpi
          label="Youth aged 18 to 35"
          value={formatNumber(youth.value)}
          note={
            youth.unknownCount
              ? `${youth.knownCount} communities gave a figure; ${youth.unknownCount} did not`
              : `Reported across ${rows.length} surveyed communities`
          }
          tone="livelihoods"
          icon={<GraduationCap aria-hidden="true" />}
          href="/economy"
          action="Open livelihoods"
          metric="youth"
        />
        <Kpi
          label="Needs urgent attention"
          value={formatNumber(urgent)}
          note="Meets at least one hard-stop condition"
          tone="critical"
          icon={<ShieldAlert aria-hidden="true" />}
          href="/priorities?risk=critical"
          action="Open priorities"
          metric="criticalAlert"
          tinted
        />
        <Kpi
          label="No way out in an emergency"
          value={formatNumber(stranded)}
          note="No motorised medical evacuation recorded"
          tone="water"
          icon={<LifeBuoy aria-hidden="true" />}
          href="/accessibility"
          action="Open access"
          metric="stranded"
        />
        <Kpi
          label="Sanitation gaps"
          value={formatNumber(sanitation)}
          note="Raw sanitation deficit observed in the field"
          tone="health"
          icon={<Droplets aria-hidden="true" />}
          href="/health"
          action="Open health & water"
          metric="sanitation"
        />
        <Kpi
          label="Flood exposure"
          value={formatNumber(highFlood)}
          note="Rated 4 or 5 out of 5 by the community"
          tone="environment"
          icon={<CloudRain aria-hidden="true" />}
          href="/climate"
          action="Open environment"
          metric="flood"
        />
      </div>

      {takeaway && (
        <TakeawayRow>
          <KeyTakeaway>{takeaway}</KeyTakeaway>
          <WhatToLookAt
            items={[
              "Communities strung along the water rather than along roads",
              "Places where several problems land on the same settlement",
              "Large populations sitting far from anything mapped",
            ]}
          />
        </TakeawayRow>
      )}

      <div className="grid overview-main section-gap">
        <Panel
          title="Where the communities are"
          subtitle={`${mapped} of ${rows.length} communities in view can be placed on the map`}
        >
          <CommunityMap communities={rows} lazyOverlays={["h3", "osmWaterways"]} />
        </Panel>
        <Panel
          title="Where attention is needed"
          subtitle="Ranked by how many hardship conditions each community recorded"
          metric="needScore"
        >
          <div className="panel-body">
            <ol className="rank-list">
              {ranked.map((community, index) => (
                <li key={community.id}>
                  <span className="rank-num">{String(index + 1).padStart(2, "0")}</span>
                  <Link href={`/communities/${community.slug}`}>
                    <strong>{community.name}</strong>
                    <small>
                      {community.lga}
                      {community.needFlags.length
                        ? ` · ${community.needFlags.slice(0, 2).join(" · ")}`
                        : ""}
                    </small>
                  </Link>
                  <NeedScore score={community.needScore} />
                </li>
              ))}
            </ol>
            <Link href="/priorities" className="btn secondary" style={{ width: "100%", marginTop: 14 }}>
              See all priorities <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </Panel>
      </div>

      <SectionHead
        title="Explore by theme"
        description="Each theme takes the same communities and looks at one part of their situation."
      />
      <div className="theme-cards">
        <ThemeCard
          href="/health"
          tone="health"
          icon={<HeartPulse aria-hidden="true" />}
          title="Health & Water"
          description="Healthcare access, emergency movement, drinking water and sanitation."
        />
        <ThemeCard
          href="/accessibility"
          tone="water"
          icon={<Network aria-hidden="true" />}
          title="Access"
          description="How communities connect to facilities, waterways and each other."
        />
        <ThemeCard
          href="/climate"
          tone="environment"
          icon={<CloudRain aria-hidden="true" />}
          title="Environment"
          description="Reported flooding and erosion, and the land around each settlement."
        />
        <ThemeCard
          href="/infrastructure"
          tone="infrastructure"
          icon={<Building2 aria-hidden="true" />}
          title="Infrastructure"
          description="Power, connectivity and the built services communities rely on."
        />
        <ThemeCard
          href="/economy"
          tone="livelihoods"
          icon={<BarChart3 aria-hidden="true" />}
          title="Livelihoods"
          description="What people do for a living and what puts that at risk."
        />
      </div>

      <SectionHead
        title="How the picture breaks down"
        description="The same communities, grouped two ways."
      />
      <OverviewCharts communities={rows} />

      <div className="notice-bar section-gap">
        <Waves aria-hidden="true" />
        Ready to present? The briefing walks through this in eleven steps.
        <Link className="btn small" href="/briefing" style={{ marginLeft: "auto" }}>
          Open briefing
        </Link>
      </div>
    </>
  );
}
