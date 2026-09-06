"use client";

import type { Community } from "@/lib/domain";
import { createCsv } from "@/lib/csv";
import { NeedScore } from "./ui";
import Link from "next/link";
import { Download } from "lucide-react";
import { useState } from "react";

const fields: ReadonlyArray<{
  key: keyof Community;
  label: string;
  type?: "text" | "number" | "boolean";
}> = [
  { key: "name", label: "Community" },
  { key: "lga", label: "LGA" },
  { key: "district", label: "Senatorial district" },
  { key: "latitude", label: "Latitude", type: "number" },
  { key: "longitude", label: "Longitude", type: "number" },
  { key: "hasLocation", label: "Valid location", type: "boolean" },
  { key: "population", label: "Population estimate", type: "number" },
  { key: "needCategory", label: "Priority sector" },
  { key: "needScore", label: "Need score", type: "number" },
  { key: "critical", label: "Critical Alert", type: "boolean" },
  { key: "priorityRequest", label: "Priority request" },
];

type SortKey = "name" | "lga" | "population" | "needScore";

/**
 * Five columns that matter, sortable, with everything else available in the
 * export or on the community page (§62).
 */
export function CommunityTable({ rows }: { rows: Community[] }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({
    key: "needScore",
    direction: -1,
  });

  const sorted = [...rows].sort((a, b) => {
    const { key, direction } = sort;
    if (key === "population") {
      // Communities with no estimate always sit at the end, either way up.
      if (a.population === null) return 1;
      if (b.population === null) return -1;
      return (a.population - b.population) * direction;
    }
    if (key === "needScore") return (a.needScore - b.needScore) * direction;
    return String(a[key]).localeCompare(String(b[key])) * direction;
  });

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 1 ? -1 : 1 }
        : { key, direction: key === "name" || key === "lga" ? 1 : -1 },
    );

  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.direction === 1 ? "ascending" : "descending") : "none";

  const exportCsv = () => {
    const blob = new Blob(["﻿" + createCsv(rows, fields)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "blue-lagos-communities.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const header = (key: SortKey, label: string, numeric = false) => (
    <th scope="col" aria-sort={ariaSort(key)} className={numeric ? "num" : undefined}>
      <button type="button" className="link-button" onClick={() => toggle(key)} style={{ textDecoration: "none" }}>
        {label}
        {sort.key === key ? (sort.direction === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <>
      <div className="panel-head">
        <div>
          <h2>All communities</h2>
          <p>
            {rows.length} communities. Communities without coordinates stay in this list and in every
            total.
          </p>
        </div>
        <button className="btn secondary" onClick={exportCsv}>
          <Download aria-hidden="true" /> Download as spreadsheet
        </button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <caption className="sr-only">
            Blue Lagos community register. Select a column heading to sort.
          </caption>
          <thead>
            <tr>
              {header("name", "Community")}
              {header("lga", "Local government")}
              <th scope="col">How they travel</th>
              {header("population", "People", true)}
              {header("needScore", "Need score", true)}
              <th scope="col">Main need</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((community) => (
              <tr key={community.id}>
                <td>
                  <Link href={`/communities/${community.slug}`}>{community.name}</Link>
                  {community.critical && (
                    <span className="badge critical" style={{ marginLeft: 7 }}>
                      Urgent
                    </span>
                  )}
                </td>
                <td>
                  {community.lga}
                  <br />
                  <span className="muted">{community.district}</span>
                </td>
                <td>{community.route?.replaceAll("_", " ") || "Not recorded"}</td>
                <td className="num">
                  {community.population === null
                    ? <span className="muted">Not recorded</span>
                    : community.population.toLocaleString("en-NG")}
                </td>
                <td className="num">
                  <NeedScore score={community.needScore} />
                </td>
                <td>
                  {community.needCategory}
                  {!community.hasLocation && (
                    <>
                      <br />
                      <span className="muted">Not yet mapped</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
