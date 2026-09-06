"use client";

import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import { token, useThemeName } from "./theme";

export interface ChartDatum {
  label: string;
  value: number | string;
}

/**
 * Chart wrapper.
 *
 * ECharts is loaded lazily (it is the largest client chunk in the app) and the
 * palette is read from the live design tokens, so a theme switch restyles every
 * chart without a reload. `onSelect` turns a chart into navigation: clicking a
 * category filters the page (§64, §65).
 */
export function Chart({
  option,
  title,
  description,
  data,
  className = "chart",
  onSelect,
}: {
  option: EChartsOption;
  title: string;
  description: string;
  data: ChartDatum[];
  className?: string;
  onSelect?: (label: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<import("echarts").ECharts | null>(null);
  // The option at mount time; later changes flow through the effect below.
  const initialOption = useRef(option);
  const titleId = useId();
  const descriptionId = useId();
  const [error, setError] = useState(false);
  const theme = useThemeName();
  // Always calls the latest handler without re-initialising the chart.
  const handleSelect = useEffectEvent((label: string) => onSelect?.(label));

  // ECharts is the single largest client chunk. Charts usually sit below the
  // fold, so the library is not fetched until one is close to being seen —
  // the page text, headline figures and map are never held up by it.
  useEffect(() => {
    let disposed = false;
    let resize: ResizeObserver | null = null;

    const start = () => {
      import("echarts")
        .then((echarts) => {
          if (!ref.current || disposed) return;
          chartRef.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
          chartRef.current.setOption(initialOption.current);
          chartRef.current.on("click", (params: { name?: string }) => {
            if (params?.name) handleSelect(params.name);
          });
          resize = new ResizeObserver(() => chartRef.current?.resize());
          resize.observe(ref.current);
        })
        .catch(() => setError(true));
    };

    const node = ref.current;
    if (!node || typeof IntersectionObserver !== "function") {
      start();
      return () => {
        disposed = true;
        chartRef.current?.dispose();
        chartRef.current = null;
      };
    }

    const visibility = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        visibility.disconnect();
        start();
      },
      // Begin loading a screenful before the chart is reached.
      { rootMargin: "600px" },
    );
    visibility.observe(node);

    return () => {
      disposed = true;
      visibility.disconnect();
      resize?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  // Re-apply on option change and on every theme switch: the option object is
  // rebuilt from the current tokens by the calling component.
  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option, theme]);

  return (
    <div className="chart-block">
      <span className="sr-only" id={titleId}>
        {title}
      </span>
      <span className="sr-only" id={descriptionId}>
        {description}
        {onSelect ? " Select a bar to filter this page; the same values are listed in the table below." : ""}
      </span>
      <div
        ref={ref}
        className={className}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      />
      {error && (
        <p role="status" className="muted">
          The chart couldn&apos;t be drawn. The underlying values are listed below.
        </p>
      )}
      <details className="chart-data">
        <summary>View these numbers as a table</summary>
        <table className="data-table">
          <caption className="sr-only">
            {title}. {description}
          </caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="num">
                Value
              </th>
              {onSelect && <th scope="col">Filter</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.label}>
                <th scope="row">{datum.label}</th>
                <td className="num">{datum.value}</td>
                {onSelect && (
                  <td>
                    <button type="button" className="link-button" onClick={() => onSelect(datum.label)}>
                      Show only {datum.label}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

/**
 * Chart styling built from the live design tokens. Call this inside a `useMemo`
 * keyed on the theme so charts follow Deep Coast / Warm Coast automatically.
 */
export function chartThemeFor() {
  const text = token("--text-secondary", "#88a0b2");
  const line = token("--border", "#294354");
  const surface = token("--surface-raised", "#07131d");
  const ink = token("--text", "#dcebf2");
  return {
    textStyle: { color: text, fontFamily: "IBM Plex Sans" },
    grid: { left: 46, right: 18, top: 26, bottom: 46 },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: surface,
      borderColor: line,
      textStyle: { color: ink, fontSize: 12 },
    },
    xAxis: {
      axisLine: { lineStyle: { color: line } },
      axisLabel: { color: text, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisLabel: { color: text, fontSize: 11 },
      splitLine: { lineStyle: { color: line, opacity: 0.45 } },
    },
  };
}

/** Hook form: rebuilds the theme object whenever the appearance changes. */
export function useChartTheme() {
  const theme = useThemeName();
  // Resolved from the live CSS variables, so it follows Deep Coast / Warm Coast.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `theme` is the input; chartThemeFor reads it from the document.
  return useMemo(() => chartThemeFor(), [theme]);
}

/** Semantic series colours, resolved from the current theme. */
export function seriesColors() {
  return {
    survey: token("--accent-survey", "#3fb9e6"),
    water: token("--accent-water", "#2fc2b0"),
    people: token("--accent-people", "#8f9ff2"),
    health: token("--accent-health", "#4fc9a2"),
    environment: token("--accent-environment", "#9fba6d"),
    infrastructure: token("--accent-infrastructure", "#eeb55c"),
    critical: token("--critical", "#f0736f"),
    warning: token("--warning", "#eeb55c"),
    positive: token("--positive", "#58c98d"),
    neutral: token("--text-faint", "#6d8496"),
  };
}
