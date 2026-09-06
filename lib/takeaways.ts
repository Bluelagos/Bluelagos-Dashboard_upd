/**
 * Deterministic page takeaways.
 *
 * Every sentence here is assembled from counts the platform already computes.
 * Nothing is generated, inferred or phrased speculatively: if the data does not
 * support a statement the function returns null and the page omits the block.
 */
import type { Community } from "./domain";
import { groupCount } from "./analytics";

const list = (items: string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** LGAs holding the most communities, largest first. */
export function topLgas(rows: Community[], count = 2): Array<[string, number]> {
  return Object.entries(groupCount(rows, "lga"))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count);
}

export function overviewTakeaway(rows: Community[]): string | null {
  if (!rows.length) return null;
  const [leader] = topLgas(rows, 1);
  const urgent = rows.filter((community) => community.critical).length;
  const stranded = rows.filter(
    (community) => community.strandingStatus === "HIGHLY_STRANDED",
  ).length;
  if (!leader) return null;
  const parts = [
    `${leader[0]} holds the largest number of surveyed communities (${leader[1]} of ${rows.length})`,
  ];
  if (urgent) parts.push(`${urgent} ${urgent === 1 ? "community meets" : "communities meet"} at least one condition serious enough to flag on its own`);
  if (stranded)
    parts.push(
      `${stranded} recorded no motorised way to move someone out in a medical emergency`,
    );
  return `${list(parts)}.`;
}

export function healthTakeaway(
  rows: Community[],
  distances: Array<{ lga: string; distanceKm: number | null }>,
): string | null {
  const both = rows.filter(
    (community) =>
      community.sanitationDeficit === true && community.strandingStatus === "HIGHLY_STRANDED",
  );
  const far = distances.filter((row) => row.distanceKm !== null && row.distanceKm >= 10);
  if (!both.length && !far.length) return null;
  const parts: string[] = [];
  if (both.length)
    parts.push(
      `${both.length} ${both.length === 1 ? "community reports" : "communities report"} a sanitation gap and no emergency way out at the same time`,
    );
  if (far.length) {
    const lgas = [...new Set(far.map((row) => row.lga))].sort().slice(0, 3);
    parts.push(
      `${far.length} sit more than 10 km in a straight line from the nearest mapped health facility, mostly in ${list(lgas)}`,
    );
  }
  return `${list(parts)}.`;
}

export function accessTakeaway(
  rows: Array<{ lga: string; accessConstraintCount: number; nearestOsmHealthKm: number | null }>,
): string | null {
  const multi = rows.filter((row) => row.accessConstraintCount >= 2);
  if (!multi.length) return null;
  const byLga = new Map<string, number>();
  for (const row of multi) byLga.set(row.lga, (byLga.get(row.lga) ?? 0) + 1);
  const leaders = [...byLga.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([lga]) => lga);
  return `${multi.length} communities face two or more access constraints at once, concentrated in ${list(leaders)}.`;
}

export function environmentTakeaway(rows: Community[]): string | null {
  const flood = rows.filter(
    (community) => community.floodHazard !== null && community.floodHazard >= 4,
  );
  const erosion = rows.filter(
    (community) => community.erosionRisk === "CRITICAL_DISPLACEMENT",
  );
  const both = flood.filter((community) => community.erosionRisk === "CRITICAL_DISPLACEMENT");
  if (!flood.length && !erosion.length) return null;
  const parts: string[] = [];
  if (flood.length) {
    const [leader] = topLgas(flood, 1);
    parts.push(
      `${flood.length} communities rated their flood hazard at the top of the scale${leader ? `, most of them in ${leader[0]}` : ""}`,
    );
  }
  if (erosion.length)
    parts.push(`${erosion.length} reported erosion severe enough to displace households`);
  if (both.length) parts.push(`${both.length} reported both`);
  return `${list(parts)}.`;
}

export function priorityTakeaway(rows: Community[]): string | null {
  const critical = rows.filter((community) => community.needScore >= 5);
  if (!critical.length) return null;
  const [leader] = topLgas(critical, 1);
  const highest = [...critical].sort((a, b) => b.needScore - a.needScore)[0];
  return `${critical.length} communities recorded five or more of the ten hardship conditions${
    leader ? `, with the largest group in ${leader[0]}` : ""
  }. ${highest.name} has the highest count at ${highest.needScore} of 10.`;
}
