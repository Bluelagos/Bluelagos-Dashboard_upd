"use client";

import type { Community } from "@/lib/domain";
import type { AdministrativeFeatureCollection } from "@/lib/spatial";
import { calculateScenarioAt, distanceKm } from "@/lib/scenario";
import { validateCandidate, type InterventionType } from "@/lib/spatial/service-areas";
import { circleFeature } from "@/lib/geo-circle";
import { useThemeName } from "./theme";
import { BASEMAP_TILES, paintFor } from "@/lib/basemap";
import { cameraDuration } from "@/lib/motion";
import { Kpi, MetricInfo, Panel } from "./ui";
import { useWaterways } from "./use-waterways";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MapPin, Route, Users, ShieldAlert } from "lucide-react";


/**
 * Keyless Esri basemaps, matched to the current appearance. There is no dark
 * canvas any more, so the dark appearance falls back to imagery, which reads
 * correctly against a night palette instead of glaring white.
 */
const BASEMAPS = { deep: BASEMAP_TILES.satellite, warm: BASEMAP_TILES.light } as const;
const BASEMAP_PAINT = { deep: paintFor("satellite"), warm: paintFor("light") } as const;

const LABELS: Record<InterventionType, string> = {
  health: "Health centre",
  water: "Water point",
  emergency: "Emergency post",
  solar: "Solar hub",
  jetty: "Jetty or landing",
};

function ScenarioMap({
  communities,
  candidate,
  radius,
  administrative,
  waterways,
  onPick,
}: {
  communities: Community[];
  candidate: [number, number] | null;
  radius: number;
  administrative: AdministrativeFeatureCollection;
  waterways: GeoJSON.FeatureCollection | null;
  onPick: (coordinate: [number, number]) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const theme = useThemeName();
  // Read at map-construction time only; later switches go through setTiles.
  const currentBasemap = useEffectEvent(() => BASEMAPS[theme]);
  const currentPaint = useEffectEvent(() => BASEMAP_PAINT[theme]);

  const update = useEffectEvent((map: import("maplibre-gl").Map) => {
    const current = { communities, candidate, radius };
    const communitiesData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: current.communities.map((community) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [community.longitude!, community.latitude!] },
        properties: { name: community.name, critical: community.critical ? 1 : 0 },
      })),
    };
    const candidateData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: current.candidate
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: current.candidate }, properties: {} }]
        : [],
    };
    const catchmentData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: current.candidate ? [circleFeature(current.candidate, current.radius)] : [],
    };
    (map.getSource("scenario-communities") as import("maplibre-gl").GeoJSONSource)?.setData(communitiesData);
    (map.getSource("scenario-candidate") as import("maplibre-gl").GeoJSONSource)?.setData(candidateData);
    (map.getSource("scenario-catchment") as import("maplibre-gl").GeoJSONSource)?.setData(catchmentData);
  });
  const pickLocation = useEffectEvent((coordinate: [number, number]) => onPick(coordinate));

  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!container.current || cancelled) return;
      map = new maplibregl.Map({
        container: container.current,
        center: [3.5, 6.48],
        zoom: 8.7,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            base: {
              type: "raster",
              tiles: [currentBasemap()],
              tileSize: 256,
              attribution: "Esri, HERE, Garmin, OpenStreetMap contributors",
            },
            admin: { type: "geojson", data: administrative as unknown as GeoJSON.FeatureCollection },
            waterways: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
            "scenario-communities": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
            "scenario-candidate": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
            "scenario-catchment": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          },
          layers: [
            { id: "base", type: "raster", source: "base", paint: currentPaint() },
            {
              id: "waterways",
              type: "line",
              source: "waterways",
              paint: { "line-color": "#267caf", "line-opacity": 0.5, "line-width": 1 },
            },
            {
              id: "lga",
              type: "line",
              source: "admin",
              filter: ["==", ["get", "admin_level"], "ADM2"],
              paint: { "line-color": "#7894a3", "line-width": 0.7, "line-dasharray": [2, 2] },
            },
            {
              id: "scenario-catchment",
              type: "fill",
              source: "scenario-catchment",
              paint: { "fill-color": "#31c7b5", "fill-opacity": 0.14, "fill-outline-color": "#55dfce" },
            },
            {
              id: "scenario-communities",
              type: "circle",
              source: "scenario-communities",
              paint: {
                "circle-radius": 6,
                "circle-color": "#36c5f0",
                "circle-stroke-color": ["case", ["==", ["get", "critical"], 1], "#f45b69", "#e8f8ff"],
                "circle-stroke-width": 2,
              },
            },
            {
              id: "scenario-candidate",
              type: "circle",
              source: "scenario-candidate",
              paint: {
                "circle-radius": 12,
                "circle-color": "#f5b942",
                "circle-stroke-color": "#fff4ce",
                "circle-stroke-width": 4,
              },
            },
          ],
        },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (!map) return;
        setReady(true);
        update(map);
      });
      map.on("click", (event) => pickLocation([event.lngLat.lng, event.lngLat.lat]));
    });
    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, [administrative]);

  // Waterways arrive after the map is already usable.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !waterways) return;
    (map.getSource("waterways") as import("maplibre-gl").GeoJSONSource)?.setData(waterways);
  }, [waterways, ready]);

  // Follow the appearance toggle without rebuilding the map.
  useEffect(() => {
    const source = mapRef.current?.getSource("base") as
      | import("maplibre-gl").RasterTileSource
      | undefined;
    source?.setTiles([BASEMAPS[theme]]);
    const map = mapRef.current;
    if (map?.getLayer("base")) {
      for (const [property, value] of Object.entries(BASEMAP_PAINT[theme])) {
        map.setPaintProperty("base", property as "raster-opacity", value);
      }
    }
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    update(map);
    if (candidate)
      map.flyTo({
        center: candidate,
        zoom: Math.max(map.getZoom(), 10),
        duration: cameraDuration("nudge"),
        essential: true,
      });
  }, [candidate, communities, radius, ready]);

  return (
    <div className="scenario-map">
      <div
        ref={container}
        className="map"
        role="region"
        aria-label="Scenario map. Select a point to test another location."
        tabIndex={0}
      />
      {!ready && <div className="map-loading">Preparing map…</div>}
      <div className="scenario-map-hint">Select anywhere on the map to test that location</div>
    </div>
  );
}

export function ScenarioLab({
  communities,
  initial,
  administrative,
  spatialMetrics,
}: {
  communities: Community[];
  initial: {
    coordinate: [number, number] | null;
    type: InterventionType;
    radius: number;
    clusterId: string;
    communityIds: number[];
  };
  administrative: AdministrativeFeatureCollection;
  spatialMetrics: Array<{ communityId: number; healthDistanceKm: number }>;
}) {
  const mapped = communities.filter(
    (community) => community.hasLocation && community.longitude !== null && community.latitude !== null,
  );
  const fallback: [number, number] | null = mapped[0]
    ? [mapped[0].longitude!, mapped[0].latitude!]
    : null;
  const [type, setType] = useState<InterventionType>(initial.type);
  const [candidate, setCandidate] = useState<[number, number] | null>(initial.coordinate ?? fallback);
  const [radius, setRadius] = useState(initial.radius);
  const [warning, setWarning] = useState<string | null>(null);

  // The waterway network is only needed for the land/shoreline check, so it is
  // fetched after first paint rather than shipped with the page.
  const waterways = useWaterways();

  const state = administrative.features.find(
    (feature) => feature.properties.admin_level === "ADM1",
  )!.geometry;
  const constraints = {
    state,
    waterways: (waterways?.features ?? []) as never[],
    landWaterwayBufferKm: 0.05,
    shorelineToleranceKm: 0.25,
  };
  const check = candidate && waterways ? validateCandidate(candidate, type, constraints) : null;
  const scenario = calculateScenarioAt(communities, candidate, radius);
  const covered = scenario.selected;
  const associated = new Set(initial.communityIds);
  const metricById = new Map(spatialMetrics.map((metric) => [metric.communityId, metric.healthDistanceKm]));
  const baselineHealth = communities.filter(
    (community) => (metricById.get(community.id) ?? Infinity) <= radius,
  ).length;

  const pick = (coordinate: [number, number]) => {
    if (!waterways) {
      // Still loading the land/water check — accept the point and let the
      // check catch up rather than blocking the interaction.
      setCandidate(coordinate);
      return;
    }
    const next = validateCandidate(coordinate, type, constraints);
    if (!next.valid) {
      setWarning(
        type === "jetty"
          ? "A jetty or landing needs to sit on the shoreline. Try a point closer to the water's edge."
          : "This point falls on open water. Try a location on land.",
      );
      return;
    }
    setWarning(null);
    setCandidate(coordinate);
  };

  const distanceFromCandidate = (community: Community) =>
    distanceKm(
      { hasLocation: candidate !== null, longitude: candidate?.[0] ?? null, latitude: candidate?.[1] ?? null },
      community,
    );

  return (
    <div className="scenario-layout">
      <aside className="panel scenario-control">
        <div className="panel-head">
          <div>
            <h2>Set up the test</h2>
            <p>Nothing is saved. This is a way of asking “who would this reach?”</p>
          </div>
        </div>
        <div className="panel-body">
          <label htmlFor="scenario-type">What are you placing?</label>
          <select
            id="scenario-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as InterventionType);
              setWarning(null);
            }}
          >
            {Object.entries(LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="scenario-location">Where?</label>
          <select
            id="scenario-location"
            value={
              mapped.some(
                (community) =>
                  community.longitude === candidate?.[0] && community.latitude === candidate?.[1],
              )
                ? `${candidate?.[0]},${candidate?.[1]}`
                : "candidate"
            }
            onChange={(event) => {
              if (event.target.value === "candidate") return;
              const [longitude, latitude] = event.target.value.split(",").map(Number);
              pick([longitude, latitude]);
            }}
          >
            <option value="candidate">Point chosen on the map</option>
            {mapped.map((community) => (
              <option value={`${community.longitude},${community.latitude}`} key={community.id}>
                {community.name} · {community.lga}
              </option>
            ))}
          </select>

          <label htmlFor="scenario-radius">
            How far should it reach? {radius} km <MetricInfo metric="scenarioCatchment" label="How far it reaches" />
          </label>
          <input
            id="scenario-radius"
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
          />

          {warning && (
            <div className="callout warning section-gap" role="alert">
              {warning}
            </div>
          )}

          <div className="location-check section-gap">
            <strong>Location check</strong>
            {!waterways ? (
              <span>Checking this location…</span>
            ) : (
              <>
                <span>Inside Lagos State: {check?.insideLagos ? "yes" : "no"}</span>
                {type === "jetty" ? (
                  <span>On the shoreline: {check?.nearShoreline ? "yes" : "no"}</span>
                ) : (
                  <span>On land, clear of open water: {check?.outsideMappedWater ? "yes" : "no"}</span>
                )}
              </>
            )}
          </div>

          <div className="callout section-gap">
            The reach shown is a straight-line distance. It is not a travel time, a route, an
            engineering assessment or any kind of approval.
          </div>
        </div>
      </aside>

      <div>
        <div className="grid status-grid">
          <Kpi
            label="Location being tested"
            value={
              <span className="scenario-coordinate">
                {candidate ? `${candidate[1].toFixed(4)}, ${candidate[0].toFixed(4)}` : "None chosen"}
              </span>
            }
            note={`${LABELS[type]}${initial.clusterId ? ` · from ${initial.clusterId}` : ""}`}
            tone="infrastructure"
            icon={<MapPin aria-hidden="true" />}
          />
          <Kpi
            label="Communities within reach"
            value={covered.length}
            note={`Inside ${radius} km in a straight line`}
            tone="survey"
            icon={<Route aria-hidden="true" />}
            metric="scenarioCatchment"
          />
          <Kpi
            label="People within reach"
            value={covered
              .reduce((sum, community) => sum + (community.population ?? 0), 0)
              .toLocaleString("en-NG")}
            note="Each community counted once"
            tone="people"
            icon={<Users aria-hidden="true" />}
            metric="population"
          />
          <Kpi
            label="Urgent-attention communities reached"
            value={covered.filter((community) => community.critical).length}
            note="Meeting at least one hard-stop condition"
            tone="critical"
            icon={<ShieldAlert aria-hidden="true" />}
            metric="criticalAlert"
          />
        </div>

        {associated.size > 0 && (
          <div className="notice-bar section-gap">
            <MapPin aria-hidden="true" />
            {covered.filter((community) => associated.has(community.id)).length} of {associated.size}{" "}
            communities from the shared service area you came from fall inside this reach.
          </div>
        )}

        <Panel
          title="Testing this location"
          subtitle="Select anywhere on the map to move the point"
          className="section-gap"
        >
          <ScenarioMap
            communities={covered}
            candidate={candidate}
            radius={radius}
            administrative={administrative}
            waterways={waterways}
            onPick={pick}
          />
        </Panel>

        <Panel
          title="Communities inside this reach"
          subtitle="Communities that would fall within the distance — not a list of confirmed beneficiaries"
          className="section-gap"
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Community</th>
                  <th scope="col">Local government</th>
                  <th scope="col" className="num">
                    Distance
                  </th>
                  <th scope="col" className="num">
                    People
                  </th>
                  <th scope="col">How it got here</th>
                </tr>
              </thead>
              <tbody>
                {[...covered]
                  .sort((a, b) => (distanceFromCandidate(a) ?? 0) - (distanceFromCandidate(b) ?? 0))
                  .map((community) => (
                    <tr key={community.id}>
                      <td>
                        <Link href={`/communities/${community.slug}`}>{community.name}</Link>
                      </td>
                      <td>{community.lga}</td>
                      <td className="num">{distanceFromCandidate(community)?.toFixed(1)} km</td>
                      <td className="num">{(community.population ?? 0).toLocaleString("en-NG")}</td>
                      <td>{associated.has(community.id) ? "From the shared area" : "Within reach"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!covered.length && (
              <div className="empty">
                <strong>Nothing within reach yet</strong>
                <p>Move the point or widen the distance to bring communities into range.</p>
              </div>
            )}
          </div>
        </Panel>

        {type === "health" && (
          <p className="muted section-gap">
            For comparison, {baselineHealth} communities already sit within {radius} km of a health
            facility that appears on the open map of Lagos.
          </p>
        )}
      </div>
    </div>
  );
}
