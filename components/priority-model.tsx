"use client";
import type { Community } from "@/lib/domain";
import Link from "next/link";
import { useState } from "react";
import { CommunityMap } from "./community-map";
import { NeedScore } from "./ui";
import { getAdministrativeLayer } from "@/lib/spatial";

const defaults = {
  vulnerability: 25,
  population: 15,
  accessibility: 20,
  climate: 15,
  services: 20,
  isolation: 5,
};
type WeightKey = keyof typeof defaults;
const labels: Record<WeightKey, string> = {
  vulnerability: "Depth of poverty",
  population: "People affected",
  accessibility: "Emergency access",
  climate: "Flood and erosion",
  services: "Missing basic services",
  isolation: "Distance from neighbours",
};
const clamp = (v: number, max: number) => (max ? Math.min(1, v / max) : 0);
export function PriorityModel({ communities }: { communities: Community[] }) {
  const [weights, setWeights] = useState(defaults);
  const [focused, setFocused] = useState<string | null>(null);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const maxPop = Math.max(
    ...communities.flatMap((c) =>
      c.population === null ? [] : [c.population],
    ),
    1,
  );
  const maxDistance = Math.max(
    ...communities.flatMap((c) =>
      c.nearestCommunityKm === null ? [] : [c.nearestCommunityKm],
    ),
    1,
  );
  const ranked = communities
    .map((c) => {
      const serviceValues = [
        c.sanitationDeficit === null ? null : c.sanitationDeficit,
        c.energyStatus === null ? null : c.energyStatus === "ENERGY_POOR",
        c.digitalStatus === null ? null : c.digitalStatus === "EXCLUDED",
        c.disasterPreparednessVoid === null ? null : c.disasterPreparednessVoid,
      ];
      const knownServices = serviceValues.filter(
        (value): value is boolean => value !== null,
      );
      const climateValues = [
        c.floodHazard === null ? null : clamp(c.floodHazard, 5),
        c.erosionRisk === null
          ? null
          : c.erosionRisk === "CRITICAL_DISPLACEMENT"
            ? 1
            : 0,
      ].filter((value): value is number => value !== null);
      const dimensions: Record<WeightKey, number | null> = {
        vulnerability: c.mpi === null ? null : clamp(c.mpi, 5),
        population: c.population === null ? null : clamp(c.population, maxPop),
        accessibility:
          c.strandingStatus === "HIGHLY_STRANDED"
            ? 1
            : c.strandingStatus === "VULNERABLE"
              ? 0.5
              : c.strandingStatus === null
                ? null
                : 0,
        climate: climateValues.length ? Math.max(...climateValues) : null,
        services: knownServices.length
          ? knownServices.filter(Boolean).length / knownServices.length
          : null,
        isolation:
          c.nearestCommunityKm === null
            ? null
            : clamp(c.nearestCommunityKm, maxDistance),
      };
      const observedWeight = (Object.keys(weights) as WeightKey[]).reduce(
        (sum, key) => sum + (dimensions[key] === null ? 0 : weights[key]),
        0,
      );
      const observedDimensions = Object.values(dimensions).filter(
        (value) => value !== null,
      ).length;
      const score =
        observedWeight && observedDimensions >= 4
          ? ((Object.keys(weights) as WeightKey[]).reduce(
              (sum, key) => sum + (dimensions[key] ?? 0) * weights[key],
              0,
            ) /
              observedWeight) *
            100
          : null;
      return { c, score, dimensions, observedDimensions };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <div className="model-grid">
      <PanelControls weights={weights} setWeights={setWeights} total={total} />
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Ranked by weighted need</h2>
            <p>
              Reordered live as you change the weights on the left
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Community</th>
                <th scope="col">Local government</th>
                <th scope="col" className="num">Weighted score</th>
                <th scope="col" className="num">Factors recorded</th>
                <th scope="col" className="num">Need score</th>
                <th scope="col">Biggest factors</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 30).map((r, i) => (
                <tr key={r.c.id}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => setFocused(r.c.slug)}>{r.c.name}</button> · <Link href={`/communities/${r.c.slug}`}>Open</Link>
                  </td>
                  <td>{r.c.lga}</td>
                  <td className="num">
                    <strong>
                      {r.score === null ? "Not enough recorded" : r.score.toFixed(1)}
                    </strong>
                  </td>
                  <td className="num">{r.observedDimensions}/6</td>
                  <td className="num">
                    <NeedScore score={r.c.needScore} />
                  </td>
                  <td>
                    {Object.entries(r.dimensions)
                      .filter(
                        (entry): entry is [string, number] => entry[1] !== null,
                      )
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([k]) => labels[k as WeightKey])
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel priority-map-panel"><div className="panel-head"><div><h2>Where they are</h2><p>Select a community in the table to fly to it on the map</p></div></div><CommunityMap communities={ranked.slice(0,30).map((item)=>item.c)} height={430} administrative={getAdministrativeLayer()} focusCommunitySlug={focused} /></section>
    </div>
  );
}
function PanelControls({
  weights,
  setWeights,
  total,
}: {
  weights: typeof defaults;
  setWeights: (v: typeof defaults) => void;
  total: number;
}) {
  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <h2>What matters most</h2>
          <p>Move a slider to change how much each factor counts. These are test assumptions, not Lagos State policy.</p>
        </div>
      </div>
      <div className="panel-body">
        {(Object.keys(weights) as WeightKey[]).map((k) => (
          <label className="weight-row" key={k}>
            <span>
              <strong style={{ fontSize: 11.5 }}>{labels[k]}</strong>
              <input
                type="range"
                min="0"
                max="50"
                value={weights[k]}
                onChange={(e) =>
                  setWeights({ ...weights, [k]: Number(e.target.value) })
                }
              />
            </span>
            <output>
              {total ? ((weights[k] / total) * 100).toFixed(1) : "0.0"}%
            </output>
          </label>
        ))}
        <button
          className="btn secondary"
          onClick={() => setWeights(defaults)}
          style={{ width: "100%" }}
        >
          Reset to the starting weights
        </button>
        <div className="callout section-gap">
          A community is only ranked when at least four of the six factors were
          actually recorded, and the score is rebalanced across whatever was
          recorded. A missing answer never counts as a zero.
          <details className="drawer-tech" style={{ marginTop: 10 }}>
            <summary>Technical detail</summary>
            <p>
              Weighted multi-criteria score: each dimension is min-max normalised
              to 0–1, multiplied by its weight, summed, then divided by the total
              weight of the dimensions that were observed for that record.
              Records with fewer than four observed dimensions return null rather
              than a partial score.
            </p>
          </details>
        </div>
      </div>
    </aside>
  );
}
