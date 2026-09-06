import type { Feature, LineString, MultiPolygon, Polygon } from "geojson";
import type { Community } from "../domain";
import { pointInPolygonGeometry, type AdministrativeFeature } from "../spatial";
import { greatCircleKm } from "./proximity";

export type InterventionType = "health" | "water" | "emergency" | "solar" | "jetty";
export type ClusterMode = "nearby" | "priority";
export type Coordinate = [number, number];

export interface DerivedCommunityMetric {
  communityId: number;
  healthDistanceKm: number | null;
  marineDistanceKm: number | null;
  waterwayDistanceKm: number | null;
}

export interface CandidateConstraints {
  state: AdministrativeFeature["geometry"];
  waterPolygons?: Array<Feature<Polygon | MultiPolygon>>;
  waterways?: Array<Feature<LineString>>;
  landWaterwayBufferKm?: number;
  shorelineToleranceKm?: number;
}

export interface CandidateLocation {
  id: string;
  coordinate: Coordinate;
  kind: "medoid" | "settlement vicinity" | "land grid" | "shoreline";
  valid: boolean;
  insideLagos: boolean;
  outsideMappedWater: boolean;
  nearShoreline: boolean;
  coveredCommunityIds: number[];
  communitiesWithinRadius: number;
  populationWithinRadius: number;
  criticalNeedCommunities: number;
  criticalAlertCommunities: number;
  averageDistanceKm: number;
  maximumDistanceKm: number;
  planningScore: number;
  scoreComponents: Record<string, number>;
}

export interface SharedServiceArea {
  id: string;
  communityIds: number[];
  communities: Community[];
  lgas: string[];
  waterSeparated: boolean;
  referencePoint: Coordinate;
  candidate: CandidateLocation | null;
  candidates: CandidateLocation[];
}

export interface SharedServiceAnalysis {
  intervention: InterventionType;
  clusterMode: ClusterMode;
  clusterDistanceKm: number;
  serviceRadiusKm: number;
  areas: SharedServiceArea[];
  selectedCandidates: Array<CandidateLocation & { areaId: string }>;
  uniqueCommunityIds: number[];
  uniquePopulation: number;
  targetCommunityCount: number;
}

const WEIGHTS: Record<InterventionType, Record<string, number>> = {
  health: { population: 0.3, deficit: 0.25, criticalNeed: 0.2, stranded: 0.15, distance: 0.1 },
  water: { population: 0.3, sanitation: 0.3, disease: 0.25, criticalNeed: 0.15 },
  emergency: { criticalAlert: 0.3, stranded: 0.25, flood: 0.2, evacuation: 0.15, population: 0.1 },
  solar: { energy: 0.35, digital: 0.2, population: 0.25, livelihood: 0.2 },
  jetty: { waterDependence: 0.25, isolation: 0.2, marineDeficit: 0.2, population: 0.2, criticalNeed: 0.15 },
};

const coordinateOf = (community: Community): Coordinate | null =>
  community.hasLocation && Number.isFinite(community.longitude) && Number.isFinite(community.latitude)
    ? [community.longitude!, community.latitude!]
    : null;

function allPolygonRings(geometry: Polygon | MultiPolygon): Coordinate[][] {
  return geometry.type === "Polygon"
    ? (geometry.coordinates as Coordinate[][])
    : (geometry.coordinates as Coordinate[][][]).flat();
}

function closestOnSegment(point: Coordinate, start: Coordinate, end: Coordinate): Coordinate {
  const latitudeScale = Math.cos((point[1] * Math.PI) / 180);
  const ax = start[0] * latitudeScale;
  const ay = start[1];
  const bx = end[0] * latitudeScale;
  const by = end[1];
  const px = point[0] * latitudeScale;
  const py = point[1];
  const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSquared));
  return [(ax + t * (bx - ax)) / latitudeScale, ay + t * (by - ay)];
}

function closestOnLines(point: Coordinate, lines: Coordinate[][]): { point: Coordinate; distanceKm: number } {
  let nearest = point;
  let distanceKm = Infinity;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const candidate = closestOnSegment(point, line[index - 1], line[index]);
      const distance = greatCircleKm(point, candidate);
      if (distance < distanceKm) {
        nearest = candidate;
        distanceKm = distance;
      }
    }
  }
  return { point: nearest, distanceKm };
}

function waterLines(constraints: CandidateConstraints): Coordinate[][] {
  return [
    ...(constraints.waterways ?? []).map((feature) => feature.geometry.coordinates as Coordinate[]),
    ...(constraints.waterPolygons ?? []).flatMap((feature) => allPolygonRings(feature.geometry)),
  ];
}

export function validateCandidate(
  coordinate: Coordinate,
  intervention: InterventionType,
  constraints: CandidateConstraints,
) {
  const insideLagos = pointInPolygonGeometry(coordinate, constraints.state);
  const insideWaterPolygon = (constraints.waterPolygons ?? []).some((feature) =>
    pointInPolygonGeometry(coordinate, feature.geometry as AdministrativeFeature["geometry"]),
  );
  const nearestWaterKm = closestOnLines(coordinate, waterLines(constraints)).distanceKm;
  const outsideMappedWater = !insideWaterPolygon && nearestWaterKm >= (constraints.landWaterwayBufferKm ?? 0.05);
  const nearShoreline = Number.isFinite(nearestWaterKm) && nearestWaterKm <= (constraints.shorelineToleranceKm ?? 0.25);
  return {
    insideLagos,
    outsideMappedWater,
    nearShoreline,
    valid: intervention === "jetty" ? insideLagos && !insideWaterPolygon && nearShoreline : insideLagos && outsideMappedWater,
  };
}

function targetMatches(community: Community, intervention: InterventionType, metric?: DerivedCommunityMetric): boolean {
  switch (intervention) {
    case "health":
      return (metric?.healthDistanceKm ?? 0) >= 5 || community.strandingStatus === "HIGHLY_STRANDED" || community.needScore >= 5;
    case "water":
      return community.sanitationDeficit === true || /HIGH|CRITICAL/i.test(community.diseaseRisk ?? "");
    case "emergency":
      return community.critical || community.strandingStatus === "HIGHLY_STRANDED" || (community.floodHazard ?? 0) >= 4 || community.disasterPreparednessVoid === true;
    case "solar":
      return community.energyStatus === "ENERGY_POOR" || community.digitalStatus === "EXCLUDED";
    case "jetty":
      return /water/i.test(community.route ?? "") || (metric?.marineDistanceKm ?? 0) >= 5 || (community.nearestCommunityKm ?? 0) > 5;
  }
}

export function clusterCommunities(communities: Community[], distanceKm: number, minPoints = 2): Community[][] {
  const points = communities
    .filter((community) => coordinateOf(community) !== null)
    .sort((a, b) => a.id - b.id);
  const visited = new Set<number>();
  const assigned = new Set<number>();
  const clusters: Community[][] = [];
  const neighbors = (community: Community) => {
    const origin = coordinateOf(community)!;
    return points.filter((candidate) => greatCircleKm(origin, coordinateOf(candidate)!) <= distanceKm);
  };
  for (const point of points) {
    if (visited.has(point.id)) continue;
    visited.add(point.id);
    const nearby = neighbors(point);
    if (nearby.length < minPoints) continue;
    const cluster: Community[] = [];
    const queue = [...nearby];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!visited.has(current.id)) {
        visited.add(current.id);
        const expanded = neighbors(current);
        if (expanded.length >= minPoints) {
          for (const candidate of expanded) if (!queue.some((item) => item.id === candidate.id)) queue.push(candidate);
        }
      }
      if (!assigned.has(current.id)) {
        assigned.add(current.id);
        cluster.push(current);
      }
    }
    clusters.push(cluster.sort((a, b) => a.id - b.id));
  }
  for (const point of points) if (!assigned.has(point.id)) clusters.push([point]);
  return clusters.sort((a, b) => a[0].id - b[0].id);
}

function centroid(communities: Community[]): Coordinate {
  const coordinates = communities.map(coordinateOf) as Coordinate[];
  return [coordinates.reduce((sum, item) => sum + item[0], 0) / coordinates.length, coordinates.reduce((sum, item) => sum + item[1], 0) / coordinates.length];
}

function medoid(communities: Community[]): Coordinate {
  return (communities.map(coordinateOf) as Coordinate[])
    .map((coordinate) => ({ coordinate, total: communities.reduce((sum, community) => sum + greatCircleKm(coordinate, coordinateOf(community)!), 0) }))
    .sort((a, b) => a.total - b.total || a.coordinate[0] - b.coordinate[0] || a.coordinate[1] - b.coordinate[1])[0].coordinate;
}

function generateCandidatePoints(communities: Community[], intervention: InterventionType, clusterDistanceKm: number, constraints: CandidateConstraints) {
  const coordinates = communities.map(coordinateOf) as Coordinate[];
  const points: Array<{ coordinate: Coordinate; kind: CandidateLocation["kind"] }> = [
    { coordinate: medoid(communities), kind: "medoid" },
    ...coordinates.map((coordinate) => ({ coordinate, kind: "settlement vicinity" as const })),
  ];
  const reference = centroid(communities);
  if (intervention === "jetty") {
    const shoreline = closestOnLines(reference, waterLines(constraints)).point;
    const towardLand: Coordinate = [shoreline[0] + (reference[0] - shoreline[0]) * 0.03, shoreline[1] + (reference[1] - shoreline[1]) * 0.03];
    points.push({ coordinate: towardLand, kind: "shoreline" });
  } else {
    const stepKm = Math.max(0.5, Math.min(1, clusterDistanceKm / 3));
    const latStep = stepKm / 111.2;
    const lonStep = stepKm / (111.2 * Math.cos((reference[1] * Math.PI) / 180));
    const minLon = Math.min(...coordinates.map((item) => item[0])) - lonStep;
    const maxLon = Math.max(...coordinates.map((item) => item[0])) + lonStep;
    const minLat = Math.min(...coordinates.map((item) => item[1])) - latStep;
    const maxLat = Math.max(...coordinates.map((item) => item[1])) + latStep;
    for (let longitude = minLon; longitude <= maxLon + lonStep / 2; longitude += lonStep) {
      for (let latitude = minLat; latitude <= maxLat + latStep / 2; latitude += latStep) {
        points.push({ coordinate: [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))], kind: "land grid" });
      }
    }
  }
  const unique = new Map<string, { coordinate: Coordinate; kind: CandidateLocation["kind"] }>();
  for (const item of points) unique.set(`${item.coordinate[0].toFixed(6)},${item.coordinate[1].toFixed(6)}`, item);
  return [...unique.values()];
}

function rawComponents(covered: Community[], distances: number[], intervention: InterventionType, metrics: Map<number, DerivedCommunityMetric>): Record<string, number> {
  const count = Math.max(covered.length, 1);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const population = sum(covered.map((community) => community.population ?? 0));
  const common = { population, criticalNeed: covered.filter((community) => community.needScore >= 5).length / count };
  if (intervention === "health") return { ...common, deficit: sum(covered.map((community) => Math.min(1, (metrics.get(community.id)?.healthDistanceKm ?? 0) / 10))) / count, stranded: covered.filter((community) => community.strandingStatus === "HIGHLY_STRANDED").length / count, distance: distances.length ? 1 / (1 + sum(distances) / distances.length) : 0 };
  if (intervention === "water") return { ...common, sanitation: covered.filter((community) => community.sanitationDeficit === true).length / count, disease: covered.filter((community) => /HIGH|CRITICAL/i.test(community.diseaseRisk ?? "")).length / count };
  if (intervention === "emergency") return { population, criticalAlert: covered.filter((community) => community.critical).length / count, stranded: covered.filter((community) => community.strandingStatus === "HIGHLY_STRANDED").length / count, flood: sum(covered.map((community) => (community.floodHazard ?? 0) / 5)) / count, evacuation: covered.filter((community) => community.disasterPreparednessVoid === true).length / count };
  if (intervention === "solar") return { population, energy: covered.filter((community) => community.energyStatus === "ENERGY_POOR").length / count, digital: covered.filter((community) => community.digitalStatus === "EXCLUDED").length / count, livelihood: sum(covered.map((community) => (community.mpi ?? 0) / 5)) / count };
  return { ...common, waterDependence: covered.filter((community) => /water/i.test(community.route ?? "")).length / count, isolation: sum(covered.map((community) => Math.min(1, (community.nearestCommunityKm ?? 0) / 5))) / count, marineDeficit: sum(covered.map((community) => Math.min(1, (metrics.get(community.id)?.marineDistanceKm ?? 0) / 5))) / count };
}

function scoreCandidates(points: ReturnType<typeof generateCandidatePoints>, communities: Community[], intervention: InterventionType, serviceRadiusKm: number, metrics: Map<number, DerivedCommunityMetric>, constraints: CandidateConstraints): CandidateLocation[] {
  const rows = points.map((item, index) => {
    const check = validateCandidate(item.coordinate, intervention, constraints);
    const reached = communities.map((community) => ({ community, distance: greatCircleKm(item.coordinate, coordinateOf(community)!) })).filter((item) => item.distance <= serviceRadiusKm);
    const covered = reached.map((item) => item.community);
    const distances = reached.map((item) => item.distance);
    return {
      id: `candidate-${index + 1}`,
      ...item,
      ...check,
      coveredCommunityIds: covered.map((community) => community.id),
      communitiesWithinRadius: covered.length,
      populationWithinRadius: covered.reduce((sum, community) => sum + (community.population ?? 0), 0),
      criticalNeedCommunities: covered.filter((community) => community.needScore >= 5).length,
      criticalAlertCommunities: covered.filter((community) => community.critical).length,
      averageDistanceKm: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0,
      maximumDistanceKm: distances.length ? Math.max(...distances) : 0,
      planningScore: 0,
      scoreComponents: rawComponents(covered, distances, intervention, metrics),
    } satisfies CandidateLocation;
  }).filter((candidate) => candidate.valid && candidate.communitiesWithinRadius > 0);
  const maxima: Record<string, number> = {};
  for (const candidate of rows) for (const [key, value] of Object.entries(candidate.scoreComponents)) maxima[key] = Math.max(maxima[key] ?? 0, value);
  for (const candidate of rows) candidate.planningScore = Object.entries(WEIGHTS[intervention]).reduce((score, [key, weight]) => score + (maxima[key] ? (candidate.scoreComponents[key] ?? 0) / maxima[key] : 0) * weight, 0) * 100;
  return rows.sort((a, b) => b.planningScore - a.planningScore || b.populationWithinRadius - a.populationWithinRadius || a.coordinate[0] - b.coordinate[0] || a.coordinate[1] - b.coordinate[1]);
}

function segmentsIntersect(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate) {
  const cross = (p: Coordinate, q: Coordinate, r: Coordinate) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

function isWaterSeparated(communities: Community[], constraints: CandidateConstraints) {
  const lines = waterLines(constraints);
  const coordinates = communities.map(coordinateOf) as Coordinate[];
  for (let first = 0; first < coordinates.length; first += 1) for (let second = first + 1; second < coordinates.length; second += 1) {
    for (const line of lines) for (let index = 1; index < line.length; index += 1) if (segmentsIntersect(coordinates[first], coordinates[second], line[index - 1], line[index])) return true;
  }
  return false;
}

export function analyzeSharedServiceAreas(
  communities: Community[],
  metricsInput: DerivedCommunityMetric[],
  constraints: CandidateConstraints,
  options: { intervention: InterventionType; clusterMode?: ClusterMode; clusterDistanceKm?: number; serviceRadiusKm?: number; facilityCount?: number },
): SharedServiceAnalysis {
  const clusterMode = options.clusterMode ?? "priority";
  const clusterDistanceKm = options.clusterDistanceKm ?? 5;
  const serviceRadiusKm = options.serviceRadiusKm ?? 5;
  const metrics = new Map(metricsInput.map((metric) => [metric.communityId, metric]));
  const geolocated = communities.filter((community) => coordinateOf(community) !== null);
  const targets = clusterMode === "nearby" ? geolocated : geolocated.filter((community) => targetMatches(community, options.intervention, metrics.get(community.id)));
  const areas = clusterCommunities(targets, clusterDistanceKm).map((members, index) => {
    const candidates = scoreCandidates(generateCandidatePoints(members, options.intervention, clusterDistanceKm, constraints), members, options.intervention, serviceRadiusKm, metrics, constraints);
    return { id: `area-${index + 1}`, communityIds: members.map((community) => community.id), communities: members, lgas: [...new Set(members.map((community) => community.lga))].sort(), waterSeparated: isWaterSeparated(members, constraints), referencePoint: centroid(members), candidate: candidates[0] ?? null, candidates };
  });
  const pool = areas.flatMap((area) => area.candidates.slice(0, 3).map((candidate) => ({ ...candidate, areaId: area.id })));
  const selectedCandidates: Array<CandidateLocation & { areaId: string }> = [];
  const covered = new Set<number>();
  for (let selection = 0; selection < Math.max(1, Math.min(3, options.facilityCount ?? 1)); selection += 1) {
    const next = pool.filter((candidate) => !selectedCandidates.some((selected) => selected.id === candidate.id && selected.areaId === candidate.areaId)).map((candidate) => ({ candidate, marginal: candidate.coveredCommunityIds.filter((id) => !covered.has(id)).reduce((sum, id) => sum + (communities.find((community) => community.id === id)?.population ?? 0), 0) })).sort((a, b) => b.marginal - a.marginal || b.candidate.planningScore - a.candidate.planningScore || a.candidate.areaId.localeCompare(b.candidate.areaId))[0];
    if (!next || next.marginal === 0 && selectedCandidates.length > 0) break;
    selectedCandidates.push(next.candidate);
    next.candidate.coveredCommunityIds.forEach((id) => covered.add(id));
  }
  return {
    intervention: options.intervention,
    clusterMode,
    clusterDistanceKm,
    serviceRadiusKm,
    areas: areas.sort((a, b) => (b.candidate?.planningScore ?? -1) - (a.candidate?.planningScore ?? -1) || a.id.localeCompare(b.id)),
    selectedCandidates,
    uniqueCommunityIds: [...covered].sort((a, b) => a - b),
    uniquePopulation: [...covered].reduce((sum, id) => sum + (communities.find((community) => community.id === id)?.population ?? 0), 0),
    targetCommunityCount: targets.length,
  };
}

export const SERVICE_AREA_WEIGHTS = WEIGHTS;
