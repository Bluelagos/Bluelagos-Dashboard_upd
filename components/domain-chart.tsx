"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chart, seriesColors, useChartTheme } from "./chart";
import type { Tone } from "./ui";

export function DomainChart({
  groups,
  title = "Communities by category",
  description = "Community counts grouped by the displayed category.",
  tone = "survey",
  /** When set, clicking a bar filters the page by that value. */
  filterKey,
}: {
  groups: Record<string, number>;
  title?: string;
  description?: string;
  tone?: Tone;
  filterKey?: "lga" | "need" | "district";
}) {
  const theme = useChartTheme();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const entries = useMemo(
    () => Object.entries(groups).sort((a, b) => b[1] - a[1]),
    [groups],
  );

  const option = useMemo(() => {
    const colors = seriesColors();
    return {
      ...theme,
      xAxis: {
        ...theme.xAxis,
        type: "category" as const,
        data: entries.map((entry) => entry[0]),
        axisLabel: { ...theme.xAxis.axisLabel, rotate: 22 },
      },
      yAxis: { ...theme.yAxis, type: "value" as const, minInterval: 1 },
      series: [
        {
          type: "bar" as const,
          data: entries.map((entry) => entry[1]),
          itemStyle: { color: colors[tone as keyof typeof colors] ?? colors.survey, borderRadius: [3, 3, 0, 0] },
          cursor: filterKey ? "pointer" : "default",
        },
      ],
    };
  }, [theme, entries, tone, filterKey]);

  const onSelect = filterKey
    ? (label: string) => {
        const params = new URLSearchParams(search.toString());
        if (params.get(filterKey) === label) params.delete(filterKey);
        else params.set(filterKey, label);
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      }
    : undefined;

  return (
    <Chart
      option={option}
      title={title}
      description={description}
      data={entries.map(([label, value]) => ({ label, value }))}
      onSelect={onSelect}
    />
  );
}
