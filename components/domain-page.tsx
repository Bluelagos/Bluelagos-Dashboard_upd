import { CommunityMap } from "./community-map";
import { Filters } from "./filters";
import { DomainChart } from "./domain-chart";
import {
  EmptyState,
  KeyTakeaway,
  Kpi,
  NeedScore,
  PageGuide,
  PageHeader,
  Panel,
  SectionHead,
  TakeawayRow,
  WhatToLookAt,
  type Tone,
} from "./ui";
import { aggregateKnown, filterCommunities, formatNumber, groupCount } from "@/lib/analytics";
import { getCommunities } from "@/lib/data";
import type { Community, DashboardSearchParams } from "@/lib/domain";
import type { ExplainKey } from "@/lib/explain";
import { parseDashboardFilters } from "@/lib/filters";
import Link from "next/link";
import { AlertTriangle, MapPin, Users } from "lucide-react";
import type { ReactNode } from "react";

export interface DomainConfig {
  eyebrow: string;
  title: string;
  /** One plain sentence that explains the page's purpose (§20). */
  description: string;
  primaryLabel: string;
  primary: (c: Community) => boolean;
  primaryMetric?: ExplainKey;
  secondaryLabel: string;
  secondary: (c: Community) => boolean;
  secondaryMetric?: ExplainKey;
  group: keyof Community;
  tableLabel: string;
  /** Honest limits — shown once, below the numbers, not in every card. */
  caveat: string;
  tone?: Tone;
  guide: { shows: string; read: string; look: string[]; method?: string };
  /** Deterministic sentence built from the data, or null to omit. */
  takeaway?: string | null;
  lookAt?: string[];
  /** Extra content placed between the summary and the detail sections. */
  children?: ReactNode;
}

export async function DomainPage({
  config,
  params,
  route,
}: {
  config: DomainConfig;
  params: DashboardSearchParams;
  route: string;
}) {
  const all = await getCommunities();
  const filters = parseDashboardFilters(params, all.map((row) => row.lga));
  const rows = filterCommunities(all, filters);
  const primary = rows.filter(config.primary);
  const secondary = rows.filter(config.secondary);
  const affected = aggregateKnown(primary, "population");
  const tone = config.tone ?? "survey";

  return (
    <>
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
      <PageGuide {...config.guide} />
      <Filters communities={all} filters={filters} action={route} />

      <div className="grid kpi-grid">
        <Kpi
          label="Communities in view"
          value={formatNumber(rows.length)}
          note="Matching the filters above"
          tone="survey"
          icon={<MapPin aria-hidden="true" />}
        />
        <Kpi
          label={config.primaryLabel}
          value={formatNumber(primary.length)}
          note={`${rows.length ? Math.round((primary.length / rows.length) * 100) : 0}% of the communities in view`}
          tone="critical"
          icon={<AlertTriangle aria-hidden="true" />}
          metric={config.primaryMetric}
          tinted
        />
        <Kpi
          label={config.secondaryLabel}
          value={formatNumber(secondary.length)}
          note="Recorded separately from the figure on the left"
          tone="warning"
          metric={config.secondaryMetric}
        />
        <Kpi
          label="People in those communities"
          value={formatNumber(affected.value)}
          note={
            affected.unknownCount
              ? `${affected.knownCount} gave an estimate; ${affected.unknownCount} did not`
              : "Every community in this group gave an estimate"
          }
          tone="people"
          icon={<Users aria-hidden="true" />}
          metric="population"
        />
        <Kpi
          label="Local governments covered"
          value={new Set(rows.map((c) => c.lga)).size}
          note="Across the communities in view"
          tone="neutral"
        />
        <Kpi
          label="Thin records"
          value={rows.filter((c) => c.completeness < 70).length}
          note="Under 70% of core survey fields filled in"
          tone="neutral"
          metric="completeness"
        />
      </div>

      {config.takeaway && (
        <TakeawayRow>
          <KeyTakeaway>{config.takeaway}</KeyTakeaway>
          {config.lookAt && <WhatToLookAt items={config.lookAt} />}
        </TakeawayRow>
      )}

      <div className="grid two-col section-gap">
        <Panel
          title={`${config.primaryLabel} by local government`}
          subtitle="Number of communities — not a share of population. Select a bar to filter the page."
        >
          <div className="panel-body">
            <DomainChart
              groups={groupCount(primary, "lga")}
              title={`${config.primaryLabel} by local government`}
              description="Community counts by local government for the condition shown."
              tone={tone}
              filterKey="lga"
            />
          </div>
        </Panel>
        <Panel title="Where they are" subtitle="Select a community to see its summary">
          <CommunityMap communities={primary} height={330} />
        </Panel>
      </div>

      {config.children}

      <SectionHead title="Communities needing attention" description={config.tableLabel} />
      <Panel
        title=""
        subtitle=""
      >
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">{config.tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">Community</th>
                <th scope="col">Local government</th>
                <th scope="col">Status</th>
                <th scope="col">Need score</th>
                <th scope="col" className="num">
                  People
                </th>
                <th scope="col">What they asked for</th>
              </tr>
            </thead>
            <tbody>
              {[...primary]
                .sort((a, b) => b.needScore - a.needScore)
                .map((community) => (
                  <tr key={community.id}>
                    <td>
                      <Link href={`/communities/${community.slug}`}>{community.name}</Link>
                    </td>
                    <td>{community.lga}</td>
                    <td>{String(community[config.group] ?? "Not recorded").replaceAll("_", " ")}</td>
                    <td>
                      <NeedScore score={community.needScore} />
                    </td>
                    <td className="num">{formatNumber(community.population)}</td>
                    <td>{community.priorityRequest || "Not recorded"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!primary.length && (
            <EmptyState
              title="No communities match these filters"
              message="Nothing in the current selection meets this condition. Clearing the filters will show the full survey again."
              action={{ href: route, label: "Clear filters" }}
            />
          )}
        </div>
      </Panel>

      <div className="callout section-gap">{config.caveat}</div>
    </>
  );
}
