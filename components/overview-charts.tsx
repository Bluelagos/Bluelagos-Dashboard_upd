"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chart, seriesColors, useChartTheme } from "./chart";
import { Panel } from "./ui";
import type { Community } from "@/lib/domain";
import { groupCount } from "@/lib/analytics";

const MPI_BANDS = ["Not recorded", "Low", "Moderate", "High", "Extreme"];

export function OverviewCharts({ communities }: { communities: Community[] }) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  /** Clicking a bar filters the whole page to that LGA (§65). */
  const filterByLga = (lga: string) => {
    const params = new URLSearchParams(search.toString());
    if (params.get("lga") === lga) params.delete("lga");
    else params.set("lga", lga);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const lgaEntries = useMemo(
    () =>
      Object.entries(groupCount(communities.filter((c) => c.critical), "lga")).sort(
        (a, b) => b[1] - a[1],
      ),
    [communities],
  );

  const mpiValues = useMemo(
    () => [
      communities.filter((c) => c.mpi === null).length,
      communities.filter((c) => c.mpi !== null && c.mpi <= 1).length,
      communities.filter((c) => c.mpi === 2).length,
      communities.filter((c) => c.mpi === 3).length,
      communities.filter((c) => c.mpi !== null && c.mpi >= 4).length,
    ],
    [communities],
  );

  const options = useMemo(() => {
    const colors = seriesColors();
    return {
      lga: {
        ...theme,
        xAxis: {
          ...theme.xAxis,
          type: "category" as const,
          data: lgaEntries.map((entry) => entry[0]),
          axisLabel: { ...theme.xAxis.axisLabel, rotate: 25 },
        },
        yAxis: { ...theme.yAxis, type: "value" as const, minInterval: 1 },
        series: [
          {
            type: "bar" as const,
            data: lgaEntries.map((entry) => entry[1]),
            itemStyle: { color: colors.critical, borderRadius: [3, 3, 0, 0] },
            cursor: "pointer",
          },
        ],
      },
      mpi: {
        ...theme,
        xAxis: { ...theme.xAxis, type: "category" as const, data: MPI_BANDS },
        yAxis: { ...theme.yAxis, type: "value" as const, minInterval: 1 },
        series: [
          {
            type: "bar" as const,
            data: mpiValues,
            itemStyle: {
              color: (params: { dataIndex: number }) =>
                [colors.neutral, colors.positive, colors.warning, colors.infrastructure, colors.critical][
                  params.dataIndex
                ],
              borderRadius: [3, 3, 0, 0],
            },
          },
        ],
      },
    };
  }, [theme, lgaEntries, mpiValues]);

  return (
    <div className="grid two-col">
      <Panel
        title="Communities needing urgent attention, by local government"
        subtitle="Select a bar to filter this page to that local government"
        metric="criticalAlert"
      >
        <div className="panel-body">
          <Chart
            option={options.lga}
            title="Communities needing urgent attention, by local government"
            description="How many communities in each local government meet at least one hard-stop condition."
            data={lgaEntries.map(([label, value]) => ({ label, value }))}
            onSelect={filterByLga}
          />
        </div>
      </Panel>
      <Panel
        title="How deep the poverty runs"
        subtitle="Communities where nothing was recorded stay visible rather than being dropped"
      >
        <div className="panel-body">
          <Chart
            option={options.mpi}
            title="Depth of poverty across surveyed communities"
            description="Community counts by recorded poverty severity, including communities where no measure was taken."
            data={MPI_BANDS.map((label, index) => ({ label, value: mpiValues[index] }))}
          />
        </div>
      </Panel>
    </div>
  );
}
