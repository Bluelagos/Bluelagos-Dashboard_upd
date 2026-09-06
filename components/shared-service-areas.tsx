"use client";

import type { Community } from "@/lib/domain";
import type { AdministrativeFeatureCollection } from "@/lib/spatial";
import type { CandidateLocation, ClusterMode, InterventionType } from "@/lib/spatial/service-areas";
import { circleFeature } from "@/lib/geo-circle";
import { useThemeName } from "./theme";
import { BASEMAP_TILES, paintFor } from "@/lib/basemap";
import { cameraDuration, FIT_PADDING } from "@/lib/motion";
import { useWaterways } from "./use-waterways";
import { MetricInfo } from "./ui";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";

const INTERVENTIONS: Array<[InterventionType, string]> = [
  ["health", "Health centre"],
  ["water", "Water point"],
  ["emergency", "Emergency post"],
  ["solar", "Solar hub"],
  ["jetty", "Jetty or landing"],
];

/** Keyless Esri canvas basemaps, matched to the current appearance. */
const BASEMAPS = { deep: BASEMAP_TILES.dark, warm: BASEMAP_TILES.light } as const;
const BASEMAP_PAINT = { deep: paintFor("dark"), warm: paintFor("light") } as const;

const COLORS = ["#36c5f0", "#f5b942", "#a78bfa", "#58c98d", "#f28c5c", "#e879b9", "#82c46c"];

export interface ServiceAreaView {
  id: string;
  communities: Community[];
  lgas: string[];
  waterSeparated: boolean;
  candidate: CandidateLocation | null;
}

function AreaMap({ areas, selectedId, onSelect, administrative, waterways, radiusKm, intervention }: {
  areas: ServiceAreaView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  administrative: AdministrativeFeatureCollection;
  waterways: GeoJSON.FeatureCollection | null;
  radiusKm: number;
  intervention: InterventionType;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const theme = useThemeName();
  // Read at map-construction time only; later switches go through setTiles.
  const currentBasemap = useEffectEvent(() => BASEMAPS[theme]);
  const currentPaint = useEffectEvent(() => BASEMAP_PAINT[theme]);
  const [error, setError] = useState(false);
  const selected = areas.find((area) => area.id === selectedId) ?? areas[0] ?? null;
  const update = useEffectEvent((map: import("maplibre-gl").Map) => {
    const current = { areas, selected };
    const communityData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: current.areas.flatMap((area, areaIndex) => area.communities.map((community) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [community.longitude!, community.latitude!] },
        properties: { id: community.id, areaId: area.id, name: community.name, population: community.population ?? 0, color: COLORS[areaIndex % COLORS.length], critical: community.critical ? 1 : 0 },
      }))),
    };
    const candidates: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: current.areas.flatMap((area) => area.candidate ? [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: area.candidate.coordinate }, properties: { areaId: area.id, selected: area.id === current.selected?.id ? 1 : 0, label: intervention === "jetty" ? "Shoreline candidate" : "Candidate service location" } }] : []),
    };
    const relationships: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: current.selected?.candidate ? current.selected.communities.map((community) => ({ type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [current.selected!.candidate!.coordinate, [community.longitude!, community.latitude!]] }, properties: {} })) : [],
    };
    const catchment: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: current.selected?.candidate ? [circleFeature(current.selected.candidate.coordinate, radiusKm)] : [] };
    const set = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as import("maplibre-gl").GeoJSONSource | undefined)?.setData(data);
    set("service-communities", communityData);
    set("service-candidates", candidates);
    set("service-relationships", relationships);
    set("service-catchment", catchment);
  });
  const selectArea = useEffectEvent((id: string) => onSelect(id));

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!container.current || cancelled) return;
      map = new maplibregl.Map({
        container: container.current,
        center: [3.55, 6.48],
        zoom: 8.7,
        attributionControl: false,
        style: { version: 8, sources: { basemap: { type: "raster", tiles: [currentBasemap()], tileSize: 256, attribution: "Esri, HERE, Garmin, OpenStreetMap contributors" }, administrative: { type: "geojson", data: administrative as unknown as GeoJSON.FeatureCollection }, waterways: { type: "geojson", data: { type: "FeatureCollection", features: [] } }, "service-communities": { type: "geojson", data: { type: "FeatureCollection", features: [] } }, "service-candidates": { type: "geojson", data: { type: "FeatureCollection", features: [] } }, "service-relationships": { type: "geojson", data: { type: "FeatureCollection", features: [] } }, "service-catchment": { type: "geojson", data: { type: "FeatureCollection", features: [] } } }, layers: [
          { id: "basemap", type: "raster", source: "basemap", paint: currentPaint() },
          { id: "state-fill", type: "fill", source: "administrative", filter: ["==", ["get", "admin_level"], "ADM1"], paint: { "fill-color": "#0d2633", "fill-opacity": 0.25 } },
          { id: "waterways", type: "line", source: "waterways", paint: { "line-color": "#267caf", "line-opacity": 0.5, "line-width": 1.1 } },
          { id: "lga-lines", type: "line", source: "administrative", filter: ["==", ["get", "admin_level"], "ADM2"], paint: { "line-color": "#7695a6", "line-opacity": 0.55, "line-width": 0.7, "line-dasharray": [2, 2] } },
          { id: "catchment", type: "fill", source: "service-catchment", paint: { "fill-color": "#31c7b5", "fill-opacity": 0.12, "fill-outline-color": "#56decf" } },
          { id: "relationships", type: "line", source: "service-relationships", paint: { "line-color": "#8ac9d9", "line-opacity": 0.35, "line-width": 0.8, "line-dasharray": [2, 2] } },
          { id: "target-communities", type: "circle", source: "service-communities", paint: { "circle-radius": ["case", ["==", ["get", "critical"], 1], 7, 5.5], "circle-color": ["get", "color"], "circle-stroke-color": ["case", ["==", ["get", "critical"], 1], "#f45b69", "#e7f8ff"], "circle-stroke-width": ["case", ["==", ["get", "critical"], 1], 2.5, 1.2] } },
          { id: "candidate-sites", type: "circle", source: "service-candidates", paint: { "circle-radius": ["case", ["==", ["get", "selected"], 1], 12, 9], "circle-color": "#f5b942", "circle-stroke-color": "#fff4ce", "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 4, 2] } },
        ] },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => { if (!map || cancelled) return; readyRef.current = true; setReady(true); update(map); });
      map.on("click", "candidate-sites", (event) => { const id = event.features?.[0]?.properties?.areaId; if (id) selectArea(String(id)); });
      map.on("click", "target-communities", (event) => { const id = event.features?.[0]?.properties?.areaId; if (id) selectArea(String(id)); });
      map.on("mouseenter", "candidate-sites", () => { if (map) map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "candidate-sites", () => { if (map) map.getCanvas().style.cursor = ""; });
      map.on("error", () => { if (!readyRef.current) setError(true); });
    }).catch(() => setError(true));
    return () => { cancelled = true; readyRef.current = false; mapRef.current = null; map?.remove(); };
  }, [administrative, intervention]);

  // The waterway network arrives after first paint; drop it in when it lands.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !waterways) return;
    (map.getSource("waterways") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(waterways);
  }, [waterways, ready]);

  // Follow the appearance toggle without rebuilding the map.
  useEffect(() => {
    const source = mapRef.current?.getSource("basemap") as
      | import("maplibre-gl").RasterTileSource
      | undefined;
    source?.setTiles([BASEMAPS[theme]]);
    const map = mapRef.current;
    if (map?.getLayer("basemap")) {
      for (const [property, value] of Object.entries(BASEMAP_PAINT[theme])) {
        map.setPaintProperty("basemap", property as "raster-opacity", value);
      }
    }
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    update(map);
    if (!selected?.candidate) return;
    const coordinates = [...selected.communities.map((community) => [community.longitude!, community.latitude!] as [number, number]), selected.candidate.coordinate];
    const longitude = coordinates.map((item) => item[0]);
    const latitude = coordinates.map((item) => item[1]);
    map.fitBounds([[Math.min(...longitude), Math.min(...latitude)], [Math.max(...longitude), Math.max(...latitude)]], { padding: FIT_PADDING, maxZoom: 13, duration: cameraDuration("cluster") });
  }, [areas, radiusKm, ready, selected]);

  return <div className="service-map-wrap"><div ref={container} className="map" role="region" aria-label="Shared service area planning map" tabIndex={0} />{!ready && !error && <div className="map-loading">Preparing map…</div>}{error && <div className="map-state">We could not load the background map. The list of groups beside it still works.</div>}<div className="service-map-legend"><span><i className="legend-candidate" />Tested location</span><span><i className="legend-community" />Community in the group</span><span><i className="legend-catchment" />How far it reaches</span></div></div>;
}

export function SharedServiceAreas({ areas, administrative, intervention, clusterMode, clusterDistanceKm, serviceRadiusKm, facilityCount, targetCommunityCount, selectedFacilityCount, uniquePopulation, uniqueCommunityCount }: {
  areas: ServiceAreaView[];
  administrative: AdministrativeFeatureCollection;
  intervention: InterventionType;
  clusterMode: ClusterMode;
  clusterDistanceKm: number;
  serviceRadiusKm: number;
  facilityCount: number;
  targetCommunityCount: number;
  selectedFacilityCount: number;
  uniquePopulation: number;
  uniqueCommunityCount: number;
}) {
  const waterways = useWaterways();
  const [selectedId, setSelectedId] = useState(areas[0]?.id ?? null);
  const selected = areas.find((area) => area.id === selectedId) ?? areas[0] ?? null;
  const scenarioUrl = selected?.candidate ? `/scenarios?type=${intervention}&lat=${selected.candidate.coordinate[1].toFixed(6)}&lng=${selected.candidate.coordinate[0].toFixed(6)}&radius=${serviceRadiusKm}&cluster=${selected.id}&communities=${selected.communities.map((community) => community.id).join(",")}` : "/scenarios";
  return <div>
    <form className="service-controls panel" action="/priorities" method="get">
      <input type="hidden" name="view" value="areas" />
      <label>What to place<select name="type" defaultValue={intervention}>{INTERVENTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Which communities<select name="clusterMode" defaultValue={clusterMode}><option value="priority">Those with the greatest need</option><option value="nearby">All nearby communities</option></select></label>
      <label>How close to group them<select name="clusterDistance" defaultValue={clusterDistanceKm}>{[3, 5, 7.5, 10].map((value) => <option key={value} value={value}>{value} km</option>)}</select></label>
      <label>How far it reaches<select name="radius" defaultValue={serviceRadiusKm}>{[3, 5, 7.5, 10].map((value) => <option key={value} value={value}>{value} km</option>)}</select></label>
      <label>How many facilities<select name="facilities" defaultValue={facilityCount}>{[1, 2, 3].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="btn" type="submit">Update</button>
    </form>
    <div className="service-summary" aria-label="Summary of the shared service areas"><span><strong>{targetCommunityCount}</strong> communities considered</span><span><strong>{areas.length}</strong> groups found</span><span><strong>{selectedFacilityCount}</strong> locations tested</span><span><strong>{uniquePopulation.toLocaleString("en-NG")}</strong> people within reach</span><span><strong>{uniqueCommunityCount}</strong> communities within reach</span></div>
    <div className="service-layout section-gap">
      <AreaMap areas={areas} selectedId={selected?.id ?? null} onSelect={setSelectedId} administrative={administrative} waterways={waterways} radiusKm={serviceRadiusKm} intervention={intervention} />
      <aside className="area-list" aria-label="Groups of communities">
        {areas.length === 0 && <div className="panel empty"><strong>No groups match these settings</strong><p>Widen the grouping distance, or switch to all nearby communities, to find settlements that could share a facility.</p></div>}
        {areas.map((area, index) => {
          const candidate = area.candidate;
          return <button type="button" className={`area-card ${selected?.id === area.id ? "selected" : ""}`} onClick={() => setSelectedId(area.id)} key={area.id}>
            <span className="area-card-title"><i style={{ background: COLORS[index % COLORS.length] }} />Group {index + 1}</span>
            <strong>{area.communities.length} {area.communities.length === 1 ? "community" : "communities"}</strong>
            <span>{area.communities.reduce((sum, community) => sum + (community.population ?? 0), 0).toLocaleString("en-NG")} people</span>
            <span>{area.communities.filter((community) => community.needScore >= 5).length} with the highest combined need</span>
            <span>{area.lgas.join(", ")}</span>
            {candidate && <span>Average distance to the tested point: {candidate.averageDistanceKm.toFixed(1)} km</span>}
            {area.waterSeparated && <em>Split by open water</em>}
          </button>;
        })}
      </aside>
    </div>
    {selected?.candidate && <section className="panel candidate-detail section-gap">
      <div><div className="eyebrow">{intervention === "jetty" ? "Shoreline location" : "Tested location"}</div><h2>Why here?</h2><p>Of the points tested inside this group, this one sits on land within Lagos State and reaches the most communities and people. It is a place to start a conversation, not a construction site.</p><MetricInfo metric="sharedServiceAreas" label="How grouping works" /></div>
      <div className="candidate-facts"><span><small>Communities within reach</small><strong>{selected.candidate.communitiesWithinRadius}</strong></span><span><small>People within reach</small><strong>{selected.candidate.populationWithinRadius.toLocaleString("en-NG")}</strong></span><span><small>Of those, highest need</small><strong>{selected.candidate.criticalNeedCommunities}</strong></span><span><small>Average distance</small><strong>{selected.candidate.averageDistanceKm.toFixed(1)} km</strong></span><span><small>Comparison score</small><strong>{selected.candidate.planningScore.toFixed(1)}</strong></span></div>
      <div className="candidate-actions"><Link className="btn" href={scenarioUrl}>Test this location</Link><details className="limitations"><summary>What this does not tell you</summary><p>Nothing here checks who owns the land, whether it can be built on, whether approval would be given, how long the journey actually takes, how big a facility would need to be, or whether every stretch of water has been mapped.</p></details></div>
    </section>}
  </div>;
}
