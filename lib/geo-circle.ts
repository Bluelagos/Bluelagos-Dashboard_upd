/**
 * Great-circle catchment ring, computed without pulling the full Turf bundle
 * into the browser.
 *
 * `@turf/turf` is a ~220 KB client chunk and the map components used exactly
 * one function from it. This is the same destination-point calculation Turf
 * performs (spherical earth, radius 6371.0088 km), so the rendered ring is
 * geometrically identical to `turf.circle(centre, km, { steps })`.
 *
 * Server-side code still uses Turf directly — it costs nothing there.
 */

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Destination point given a start, a bearing in radians and a distance in km. */
function destination(
  [lng, lat]: [number, number],
  bearing: number,
  distanceKm: number,
): [number, number] {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [((toDegrees(lng2) + 540) % 360) - 180, toDegrees(lat2)];
}

/**
 * A closed polygon approximating a straight-line service radius.
 * Never an isochrone — see the shared-service-areas explainer.
 */
export function circleFeature(
  centre: [number, number],
  radiusKm: number,
  steps = 80,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  for (let step = 0; step < steps; step += 1) {
    // Turf walks clockwise from bearing 0; match it vertex for vertex so the
    // ring is interchangeable with the server-side geometry.
    ring.push(destination(centre, (step * -2 * Math.PI) / steps, radiusKm));
  }
  ring.push(ring[0]);
  return {
    type: "Feature",
    properties: { radiusKm },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}
