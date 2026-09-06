/**
 * Local spatial proximity analysis (Turf-backed).
 *
 * These are pure functions over GeoJSON. Every distance returned here is a
 * great-circle ("straight-line") distance in kilometres. It is NOT a travel
 * distance and NOT a travel time — riverine access, road condition and water
 * routing are not modelled. Callers must label results accordingly.
 */
import type { Feature, LineString, Point } from "geojson";

/**
 * Direct haversine great-circle distance in km. Equivalent to @turf/distance
 * (same earth radius, 6371.0088 km) but without per-call GeoJSON object
 * allocation — this runs ~10^5 times per request over the OSM layers.
 */
const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;
function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Lon = number;
export type Lat = number;
export interface NearestResult<P = Record<string, unknown>> {
  /** Great-circle distance in kilometres. */
  distanceKm: number;
  /** Properties of the nearest feature, or null when the layer was empty. */
  feature: P | null;
}

/** Great-circle distance in km between two [lon, lat] positions. */
export function greatCircleKm(a: [Lon, Lat], b: [Lon, Lat]): number {
  return haversineKm(a, b);
}

/**
 * Nearest point feature to `from` within a point FeatureCollection.
 * Returns distanceKm = Infinity and feature = null for an empty collection.
 */
export function nearestPointFeature<P = Record<string, unknown>>(
  from: [Lon, Lat],
  features: Array<Feature<Point, P>>,
): NearestResult<P> {
  let best: NearestResult<P> = { distanceKm: Infinity, feature: null };
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const d = greatCircleKm(from, [coords[0], coords[1]]);
    if (d < best.distanceKm) best = { distanceKm: d, feature: feature.properties };
  }
  return best;
}

/**
 * Approximate shortest great-circle distance (km) from `from` to any mapped
 * waterway line: the minimum distance to a line *vertex*. OSM waterway geometry
 * is densely sampled (tens of vertices per segment), so vertex distance tracks
 * true perpendicular distance to within a few tens of metres — well inside the
 * "straight-line, not travel distance" caveat this metric already carries, and
 * far cheaper than a per-segment projection across ~1,200 lines. Infinity when
 * the collection is empty.
 */
export function nearestLineKm(
  from: [Lon, Lat],
  features: Array<Feature<LineString>>,
): number {
  let best = Infinity;
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    for (const vertex of coords) {
      const d = greatCircleKm(from, [vertex[0], vertex[1]]);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Count of point features within `radiusKm` great-circle distance of `from`. */
export function countWithinKm<P = Record<string, unknown>>(
  from: [Lon, Lat],
  features: Array<Feature<Point, P>>,
  radiusKm: number,
): number {
  let count = 0;
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    if (greatCircleKm(from, [coords[0], coords[1]]) <= radiusKm) count += 1;
  }
  return count;
}

/**
 * Analytical distance bands for straight-line access to a mapped facility.
 * These are descriptive bands for visualising the data distribution — they are
 * NOT policy thresholds.
 */
export type DistanceBand = "<2 km" | "2–5 km" | "5–10 km" | ">10 km" | "No mapped facility";
export function distanceBand(distanceKm: number | null): DistanceBand {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return "No mapped facility";
  if (distanceKm < 2) return "<2 km";
  if (distanceKm < 5) return "2–5 km";
  if (distanceKm < 10) return "5–10 km";
  return ">10 km";
}
