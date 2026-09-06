/**
 * H3 hexagonal aggregation.
 *
 * H3 (Uber's open hierarchical hex grid) gives a fixed, boundary-independent
 * grid so spatial concentrations can be compared without being distorted by
 * unequal LGA sizes. We aggregate the surveyed community points only — every
 * cell value is a real count or a transparent summary of the communities that
 * fall inside it. Empty space produces no cell. Nothing is interpolated.
 *
 * Resolution 7 is used for Lagos: an average H3 res-7 cell is ~5.16 km² with an
 * edge of ~1.4 km, which groups neighbouring riverine settlements while still
 * resolving differences across an LGA. Documented in docs/spatial-methodology.md.
 */
import { cellToBoundary, cellToLatLng, latLngToCell } from "h3-js";
import type { Feature, FeatureCollection, Polygon } from "geojson";

export const H3_RESOLUTION = 7;

export interface CommunityLike {
  id: number;
  name: string;
  lga: string;
  hasLocation: boolean;
  latitude: number | null;
  longitude: number | null;
  needScore: number;
  critical: boolean;
  population: number | null;
}

export interface H3Cell {
  cell: string;
  center: [number, number]; // [lon, lat]
  communityCount: number;
  criticalCount: number;
  needScoreMean: number;
  needScoreMax: number;
  /** Sum of KNOWN survey populations only; null when no community in the cell has a known population. */
  knownPopulation: number | null;
  communities: Array<{ id: number; name: string; lga: string }>;
}

export function aggregateCommunitiesToH3(
  communities: CommunityLike[],
  resolution: number = H3_RESOLUTION,
): H3Cell[] {
  const buckets = new Map<string, CommunityLike[]>();
  for (const c of communities) {
    if (!c.hasLocation || c.latitude === null || c.longitude === null) continue;
    const cell = latLngToCell(c.latitude, c.longitude, resolution);
    const list = buckets.get(cell);
    if (list) list.push(c);
    else buckets.set(cell, [c]);
  }

  const cells: H3Cell[] = [];
  for (const [cell, list] of buckets) {
    const needScores = list.map((c) => c.needScore);
    const knownPops = list.map((c) => c.population).filter((p): p is number => p !== null);
    const [lat, lng] = cellToLatLng(cell);
    cells.push({
      cell,
      center: [lng, lat],
      communityCount: list.length,
      criticalCount: list.filter((c) => c.critical).length,
      needScoreMean: needScores.reduce((s, v) => s + v, 0) / needScores.length,
      needScoreMax: Math.max(...needScores),
      knownPopulation: knownPops.length ? knownPops.reduce((s, v) => s + v, 0) : null,
      communities: list.map((c) => ({ id: c.id, name: c.name, lga: c.lga })),
    });
  }
  return cells.sort((a, b) => b.communityCount - a.communityCount);
}

export type H3Metric = "communityCount" | "criticalCount" | "needScoreMean" | "needScoreMax";

/** Convert aggregated cells to a Polygon FeatureCollection for MapLibre fill layers. */
export function h3CellsToGeoJSON(cells: H3Cell[]): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: cells.map((cell): Feature<Polygon> => {
      // cellToBoundary returns [lat, lng] pairs; GeoJSON needs [lng, lat] and a closed ring.
      const ring = cellToBoundary(cell.cell).map(([lat, lng]) => [lng, lat] as [number, number]);
      ring.push(ring[0]);
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {
          cell: cell.cell,
          communityCount: cell.communityCount,
          criticalCount: cell.criticalCount,
          needScoreMean: Number(cell.needScoreMean.toFixed(2)),
          needScoreMax: cell.needScoreMax,
          knownPopulation: cell.knownPopulation,
        },
      };
    }),
  };
}
