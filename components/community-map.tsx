"use client";

import type { Community } from "@/lib/domain";
import { CATEGORY_COLORS } from "@/lib/constants";
import { communitiesToGeoJson, type CommunityFeatureCollection } from "@/lib/geo";
import type { AdministrativeFeatureCollection } from "@/lib/spatial";
import { FIT_PADDING, LAGOS_BOUNDS, cameraDuration } from "@/lib/motion";
import { BASEMAP_ATTRIBUTION, BASEMAP_TILES, paintFor } from "@/lib/basemap";
import { useThemeName } from "./theme";
import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

type Basemap = "map" | "light" | "satellite";

const tiles: Record<Basemap, { url: string; label: string; attribution: string }> = {
  map: { url: BASEMAP_TILES.dark, label: "Dark", attribution: BASEMAP_ATTRIBUTION.canvas },
  light: { url: BASEMAP_TILES.light, label: "Light", attribution: BASEMAP_ATTRIBUTION.canvas },
  satellite: {
    url: BASEMAP_TILES.satellite,
    label: "Satellite",
    attribution: BASEMAP_ATTRIBUTION.satellite,
  },
};

/** The basemap key as the shared paint helper names it. */
const paintKey = (basemap: Basemap) => (basemap === "map" ? "dark" : basemap);

/* --------------------------------------------------------------------------
   Community points
   -------------------------------------------------------------------------- */
export function updateCommunityMap(
  map: import("maplibre-gl").Map,
  data: CommunityFeatureCollection,
) {
  const source = map.getSource("communities") as import("maplibre-gl").GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource("communities", { type: "geojson", data });
  if (!map.getLayer("communities"))
    map.addLayer({
      id: "communities",
      type: "circle",
      source: "communities",
      paint: {
        // The selected community reads larger and fully opaque; everything
        // else steps back slightly so focus is unmistakable.
        "circle-radius": [
          "case",
          ["==", ["get", "selected"], 1], 10,
          ["==", ["get", "critical"], 1], 7,
          5,
        ],
        "circle-color": ["get", "color"],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "selected"], 1], "#ffffff",
          ["==", ["get", "critical"], 1], "#ff7380",
          "#d9f6ff",
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "selected"], 1], 3,
          ["==", ["get", "critical"], 1], 2.2,
          1,
        ],
        "circle-opacity": ["case", ["==", ["get", "dimmed"], 1], 0.45, 0.92],
      },
    });
  if (!map.getLayer("community-labels"))
    map.addLayer({
      id: "community-labels",
      type: "symbol",
      source: "communities",
      minzoom: 11,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 10,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#dff5fd",
        "text-halo-color": "#07131d",
        "text-halo-width": 1.5,
      },
    });
}

const ADMIN_LAYER_IDS = [
  "lagos-state-fill",
  "lagos-state-line",
  "lagos-lga-fill",
  "lagos-lga-line",
  "lagos-lga-label",
] as const;

/* --------------------------------------------------------------------------
   Optional layers
   Labels are plain English; the technical provenance sits in the tooltip and
   the note underneath the toggles.
   -------------------------------------------------------------------------- */
export interface MapOverlays {
  osmHealth?: GeoJSON.FeatureCollection;
  osmMarine?: GeoJSON.FeatureCollection;
  osmWaterways?: GeoJSON.FeatureCollection;
  h3?: GeoJSON.FeatureCollection;
}

/** Layers the map can fetch on demand instead of receiving up front. */
export type LazyOverlayKey = keyof MapOverlays;

export interface OverlaySpec {
  key: LazyOverlayKey;
  sourceId: string;
  layerIds: string[];
  /** Plain-English toggle label. */
  label: string;
  /** Technical provenance, shown on hover. */
  provenance: string;
  /** Route that serves the layer when it is switched on. */
  endpoint: string;
  /** Legend entries shown only while this layer is visible. */
  legend: Array<{ label: string; color: string; shape?: "dot" | "line" | "area" }>;
}

export const OVERLAY_SPECS: OverlaySpec[] = [
  {
    key: "h3",
    sourceId: "overlay-h3",
    layerIds: ["overlay-h3-fill", "overlay-h3-line"],
    label: "Community concentration",
    provenance: "DERIVED — Uber H3 res-7 hexagonal aggregation of surveyed community points",
    endpoint: "/api/layers/h3",
    legend: [{ label: "More communities per cell", color: "#2fb6d3", shape: "area" }],
  },
  {
    key: "osmWaterways",
    sourceId: "overlay-waterways",
    layerIds: ["overlay-waterways-line"],
    label: "Waterways",
    provenance: "OSM — waterway=* linework; navigability not assessed",
    endpoint: "/api/layers/osm-waterways",
    legend: [{ label: "Mapped waterway", color: "#3d9be0", shape: "line" }],
  },
  {
    key: "osmMarine",
    sourceId: "overlay-marine",
    layerIds: ["overlay-marine-circle"],
    label: "Jetties & landing points",
    provenance:
      "OSM — ferry terminals / piers / landing candidates; not an official jetty register",
    endpoint: "/api/layers/osm-marine",
    legend: [{ label: "Mapped landing point", color: "#ffd166" }],
  },
  {
    key: "osmHealth",
    sourceId: "overlay-health",
    layerIds: ["overlay-health-circle"],
    label: "Health facilities",
    provenance: "OSM — contributor-mapped; not an official Lagos State registry",
    endpoint: "/api/layers/osm-health",
    legend: [{ label: "Mapped health facility", color: "#8be08b" }],
  },
];

function addOverlayLayers(map: import("maplibre-gl").Map) {
  // Keep the community points (and their labels) on top and clickable.
  const before = map.getLayer("communities") ? "communities" : undefined;
  const layer = (spec: import("maplibre-gl").LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec, before);
  };
  if (map.getSource("overlay-h3")) {
    layer({
      id: "overlay-h3-fill",
      type: "fill",
      source: "overlay-h3",
      layout: { visibility: "none" },
      paint: {
        "fill-color": [
          "interpolate", ["linear"], ["get", "communityCount"],
          1, "#123a4f", 3, "#1f6f8b", 6, "#2fb6d3", 10, "#7ff0ff",
        ],
        "fill-opacity": 0.4,
      },
    });
    layer({
      id: "overlay-h3-line",
      type: "line",
      source: "overlay-h3",
      layout: { visibility: "none" },
      paint: { "line-color": "#8fd8ea", "line-width": 0.6, "line-opacity": 0.5 },
    });
  }
  if (map.getSource("overlay-waterways"))
    layer({
      id: "overlay-waterways-line",
      type: "line",
      source: "overlay-waterways",
      layout: { visibility: "none" },
      paint: { "line-color": "#3d9be0", "line-width": 1, "line-opacity": 0.55 },
    });
  if (map.getSource("overlay-marine"))
    layer({
      id: "overlay-marine-circle",
      type: "circle",
      source: "overlay-marine",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#ffd166",
        "circle-stroke-color": "#7a5b12",
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
      },
    });
  if (map.getSource("overlay-health"))
    layer({
      id: "overlay-health-circle",
      type: "circle",
      source: "overlay-health",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": 4,
        "circle-color": "#8be08b",
        "circle-stroke-color": "#245a24",
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
      },
    });
}

/**
 * Adds the optional analytical overlays. Idempotent and style-reload safe,
 * mirroring the other update* helpers. Every layer starts hidden; visibility is
 * driven by the toggles.
 */
export function updateOverlayLayers(map: import("maplibre-gl").Map, overlays: MapOverlays) {
  const addSource = (id: string, data?: GeoJSON.FeatureCollection) => {
    if (!data) return;
    const existing = map.getSource(id) as import("maplibre-gl").GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else map.addSource(id, { type: "geojson", data });
  };
  addSource("overlay-h3", overlays.h3);
  addSource("overlay-waterways", overlays.osmWaterways);
  addSource("overlay-marine", overlays.osmMarine);
  addSource("overlay-health", overlays.osmHealth);
  addOverlayLayers(map);
}

/**
 * Adds the processed GRID3 administrative polygons (1 state, 20 LGAs) beneath
 * the community points. Idempotent: reuses the source and skips existing layers,
 * mirroring updateCommunityMap so a style reload can re-attach cleanly.
 */
export function updateAdministrativeLayers(
  map: import("maplibre-gl").Map,
  data: AdministrativeFeatureCollection,
) {
  const source = map.getSource("administrative") as
    | import("maplibre-gl").GeoJSONSource
    | undefined;
  if (source) source.setData(data as unknown as GeoJSON.FeatureCollection);
  else
    map.addSource("administrative", {
      type: "geojson",
      data: data as unknown as GeoJSON.FeatureCollection,
    });
  if (!map.getLayer("lagos-state-fill"))
    map.addLayer({
      id: "lagos-state-fill",
      type: "fill",
      source: "administrative",
      filter: ["==", ["get", "admin_level"], "ADM1"],
      paint: { "fill-color": "#1bb8e8", "fill-opacity": 0.04 },
    });
  if (!map.getLayer("lagos-state-line"))
    map.addLayer({
      id: "lagos-state-line",
      type: "line",
      source: "administrative",
      filter: ["==", ["get", "admin_level"], "ADM1"],
      paint: { "line-color": "#5fd0ef", "line-width": 1.8, "line-opacity": 0.9 },
    });
  if (!map.getLayer("lagos-lga-fill"))
    map.addLayer({
      id: "lagos-lga-fill",
      type: "fill",
      source: "administrative",
      filter: ["==", ["get", "admin_level"], "ADM2"],
      paint: { "fill-color": "#1bb8e8", "fill-opacity": 0.01 },
    });
  if (!map.getLayer("lagos-lga-line"))
    map.addLayer({
      id: "lagos-lga-line",
      type: "line",
      source: "administrative",
      filter: ["==", ["get", "admin_level"], "ADM2"],
      paint: {
        "line-color": "#7fa8bd",
        "line-width": 0.7,
        "line-dasharray": [2, 1.5],
        "line-opacity": 0.65,
      },
    });
  if (!map.getLayer("lagos-lga-label"))
    map.addLayer({
      id: "lagos-lga-label",
      type: "symbol",
      source: "administrative",
      filter: ["==", ["get", "admin_level"], "ADM2"],
      minzoom: 9.5,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 10,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.08,
      },
      paint: {
        "text-color": "#9fc0d0",
        "text-halo-color": "#07131d",
        "text-halo-width": 1.4,
      },
    });
}

/* --------------------------------------------------------------------------
   Distance bands — the one place the health-access colour ramp is defined
   -------------------------------------------------------------------------- */
const DISTANCE_BANDS = [
  { label: "Under 2 km", color: "#58c98d", max: 2 },
  { label: "2 to 5 km", color: "#f5d35d", max: 5 },
  { label: "5 to 10 km", color: "#f29a4a", max: 10 },
  { label: "Over 10 km", color: "#d95b72", max: Infinity },
];
const bandColor = (distance: number | null) =>
  distance === null ? "#637887" : (DISTANCE_BANDS.find((band) => distance < band.max)?.color ?? "#637887");

type HealthAccess = Array<{ id: number; distanceKm: number | null; facility: string | null }>;

function buildFeatures(
  communities: Community[],
  healthAccess: HealthAccess | undefined,
  selectedSlug: string | null,
) {
  const data = communitiesToGeoJson(communities);
  const byId = new Map(healthAccess?.map((item) => [item.id, item]));
  const communityBySlug = new Map(communities.map((community) => [community.slug, community]));
  for (const feature of data.features) {
    const community = communityBySlug.get(feature.properties.slug);
    const properties = feature.properties as Record<string, unknown>;
    properties.selected = selectedSlug && feature.properties.slug === selectedSlug ? 1 : 0;
    // Context recedes while one community is in focus (§16).
    properties.dimmed = selectedSlug && feature.properties.slug !== selectedSlug ? 1 : 0;
    properties.population = community?.population ?? null;
    properties.lga = community?.lga ?? "";
    properties.needScore = community?.needScore ?? 0;
    properties.needCategory = community?.needCategory ?? "";
    if (healthAccess) {
      const item = community ? byId.get(community.id) : null;
      const distance = item?.distanceKm ?? null;
      properties.color = bandColor(distance);
      properties.healthDistanceKm = distance;
      properties.healthFacility = item?.facility ?? null;
    }
  }
  return data;
}

interface Focus {
  slug: string;
  name: string;
  lga: string;
  population: number | null;
  needCategory: string;
  needScore: number;
  facility: string | null;
  distanceKm: number | null;
}

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */
export function CommunityMap({
  communities,
  height,
  interactive = true,
  spatialControls = false,
  administrative,
  overlays,
  lazyOverlays,
  healthAccess,
  focusCommunitySlug,
}: {
  communities: Community[];
  height?: number;
  interactive?: boolean;
  spatialControls?: boolean;
  administrative?: AdministrativeFeatureCollection;
  /** Layers supplied up front (small ones only). */
  overlays?: MapOverlays;
  /** Layers fetched the first time they are switched on. */
  lazyOverlays?: LazyOverlayKey[];
  healthAccess?: HealthAccess;
  focusCommunitySlug?: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const firstFit = useRef(false);
  const readyRef = useRef(false);
  const theme = useThemeName();
  const [basemap, setBasemap] = useState<Basemap>(theme === "warm" ? "light" : "map");
  const basemapRef = useRef<Basemap>(basemap);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  // Only the user's own selection is state. When the page hands us a
  // `focusCommunitySlug`, that acts as the selection until the user picks
  // another one, so nothing has to be copied into state to stay in sync.
  const [selected, setSelected] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const activeSlug = selected ?? (cleared ? null : (focusCommunitySlug ?? null));
  const [boundariesVisible, setBoundariesVisible] = useState(true);
  const [boundaryOpacity, setBoundaryOpacity] = useState(65);
  const [identifiedLga, setIdentifiedLga] = useState<string | null>(null);
  const [loadingLayer, setLoadingLayer] = useState<string | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);

  const dataRef = useRef(buildFeatures(communities, healthAccess, null));
  const administrativeRef = useRef(administrative);
  const overlaysRef = useRef(overlays);
  useEffect(() => {
    administrativeRef.current = administrative;
  }, [administrative]);
  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  // Which optional layers this map offers: inline data plus lazy endpoints.
  const availableOverlays = OVERLAY_SPECS.filter(
    (spec) => overlays?.[spec.key] || lazyOverlays?.includes(spec.key),
  );
  const loadedOverlays = useRef(new Set<LazyOverlayKey>());
  const [visibleOverlays, setVisibleOverlays] = useState<Record<string, boolean>>({});

  const applyOverlayVisibility = useCallback((next: Record<string, boolean>) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const spec of OVERLAY_SPECS) {
      const on = next[spec.key] === true;
      for (const id of spec.layerIds) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    }
  }, []);

  /**
   * Fetch a layer the first time it is switched on, then reveal it.
   * The toggle flips immediately so the control never feels unresponsive while
   * the data is in flight; it flips back only if the fetch actually fails.
   */
  const toggleOverlay = useCallback(
    async (spec: OverlaySpec, on: boolean) => {
      setLayerError(null);
      setVisibleOverlays((previous) => ({ ...previous, [spec.key]: on }));
      if (!on) return;

      const map = mapRef.current;
      const needsFetch =
        !overlaysRef.current?.[spec.key] && !loadedOverlays.current.has(spec.key);
      if (!needsFetch || !map) return;

      setLoadingLayer(spec.key);
      try {
        const response = await fetch(spec.endpoint);
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as GeoJSON.FeatureCollection;
        loadedOverlays.current.add(spec.key);
        updateOverlayLayers(map, { [spec.key]: data } as MapOverlays);
        // The layers are added hidden, so reveal them now that they exist.
        for (const id of spec.layerIds) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
        }
      } catch {
        setLayerError(spec.label);
        setVisibleOverlays((previous) => ({ ...previous, [spec.key]: false }));
      } finally {
        setLoadingLayer(null);
      }
    },
    [],
  );

  /* ---- map lifecycle ---- */
  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (!container.current || cancelled) return;
        map = new maplibregl.Map({
          container: container.current,
          center: [3.38, 6.45],
          zoom: 8.8,
          attributionControl: false,
          interactive,
          style: {
            version: 8,
            sources: {
              basemap: {
                type: "raster",
                tiles: [tiles[basemapRef.current].url],
                tileSize: 256,
                attribution: "Basemap: Esri, HERE, Garmin and OpenStreetMap contributors",
              },
            },
            layers: [
              {
                id: "basemap",
                type: "raster",
                source: "basemap",
                paint: paintFor(paintKey(basemapRef.current)),
              },
            ],
          },
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

        const load = () => {
          if (cancelled || !map) return;
          if (administrativeRef.current) updateAdministrativeLayers(map, administrativeRef.current);
          updateCommunityMap(map, dataRef.current);
          if (overlaysRef.current) updateOverlayLayers(map, overlaysRef.current);
          readyRef.current = true;
          setReady(true);
        };
        const click = (event: import("maplibre-gl").MapLayerMouseEvent) => {
          const slug = event.features?.[0]?.properties?.slug;
          if (!interactive || !slug) return;
          setSelected(String(slug));
          setCleared(false);
          // A decisive drop onto one community, distinct from a state-wide fit.
          map?.flyTo({
            center: event.lngLat,
            zoom: 12.5,
            duration: cameraDuration("community"),
            essential: true,
          });
        };
        const identify = (event: import("maplibre-gl").MapLayerMouseEvent) => {
          const name = event.features?.[0]?.properties?.name;
          if (name) setIdentifiedLga(String(name));
          const coordinates: number[][] = [];
          const collect = (value: unknown): void => {
            if (Array.isArray(value) && typeof value[0] === "number" && typeof value[1] === "number")
              coordinates.push(value as number[]);
            else if (Array.isArray(value)) value.forEach(collect);
          };
          collect(
            event.features?.[0]?.geometry && "coordinates" in event.features[0].geometry
              ? event.features[0].geometry.coordinates
              : [],
          );
          if (coordinates.length && map) {
            // A smooth settle onto an LGA, slower than a community drop.
            map.fitBounds(
              [
                [Math.min(...coordinates.map((item) => item[0])), Math.min(...coordinates.map((item) => item[1]))],
                [Math.max(...coordinates.map((item) => item[0])), Math.max(...coordinates.map((item) => item[1]))],
              ],
              { padding: FIT_PADDING, maxZoom: 12, duration: cameraDuration("lga") },
            );
          }
        };
        const enter = () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        };
        const leave = () => {
          if (map) map.getCanvas().style.cursor = "";
        };
        const mapError = () => {
          if (!readyRef.current) setError(true);
        };
        const styleData = () => {
          if (!map?.isStyleLoaded()) return;
          if (administrativeRef.current && !map.getSource("administrative"))
            updateAdministrativeLayers(map, administrativeRef.current);
          if (!map.getSource("communities")) updateCommunityMap(map, dataRef.current);
          if (overlaysRef.current && !map.getSource("overlay-h3"))
            updateOverlayLayers(map, overlaysRef.current);
        };
        map.on("load", load);
        map.on("click", "communities", click);
        map.on("click", "lagos-lga-fill", identify);
        map.on("mouseenter", "communities", enter);
        map.on("mouseleave", "communities", leave);
        map.on("error", mapError);
        map.on("styledata", styleData);
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      readyRef.current = false;
      mapRef.current = null;
      map?.remove();
    };
  }, [healthAccess, interactive]);

  /* ---- data + selection ---- */
  useEffect(() => {
    const data = buildFeatures(communities, healthAccess, activeSlug);
    dataRef.current = data;
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    if (administrativeRef.current && !map.getSource("administrative"))
      updateAdministrativeLayers(map, administrativeRef.current);
    updateCommunityMap(map, data);
    if (!firstFit.current && data.features.length) {
      const coordinates = data.features.map((feature) => feature.geometry.coordinates);
      const xs = coordinates.map(([x]) => x);
      const ys = coordinates.map(([, y]) => y);
      map.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        { padding: FIT_PADDING, maxZoom: 12, duration: cameraDuration("cluster") },
      );
      firstFit.current = true;
    }
  }, [communities, healthAccess, ready, activeSlug]);

  /* ---- basemap follows the theme until the viewer overrides it ---- */
  const basemapTouched = useRef(false);
  useEffect(() => {
    if (basemapTouched.current) return;
    setBasemap(theme === "warm" ? "light" : "map");
  }, [theme]);
  useEffect(() => {
    basemapRef.current = basemap;
    const map = mapRef.current;
    const source = map?.getSource("basemap") as
      | import("maplibre-gl").RasterTileSource
      | undefined;
    source?.setTiles([tiles[basemap].url]);
    // Imagery keeps its own appearance; the canvas basemaps are dimmed so the
    // community points stay the brightest thing on the map.
    if (map?.getLayer("basemap")) {
      const paint = paintFor(paintKey(basemap));
      for (const [property, value] of Object.entries(paint)) {
        map.setPaintProperty("basemap", property as keyof typeof paint, value);
      }
    }
  }, [basemap]);

  /* ---- boundary + overlay visibility ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const visibility = boundariesVisible ? "visible" : "none";
    for (const id of ADMIN_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
    }
    if (map.getLayer("lagos-lga-line"))
      map.setPaintProperty("lagos-lga-line", "line-opacity", boundaryOpacity / 100);
  }, [boundariesVisible, boundaryOpacity, ready]);

  useEffect(() => {
    if (ready) applyOverlayVisibility(visibleOverlays);
  }, [visibleOverlays, ready, applyOverlayVisibility]);

  /* ---- camera moves ---- */
  /** Moves the camera only. Selection is handled by the caller. */
  const flyToCommunity = useCallback(
    (community: Community, move: "community" | "nudge" = "community") => {
      if (community.longitude === null || community.latitude === null) return;
      mapRef.current?.flyTo({
        center: [community.longitude, community.latitude],
        zoom: 13,
        duration: cameraDuration(move),
        essential: true,
      });
    },
    [],
  );

  const selectCommunity = (community: Community) => {
    setSelected(community.slug);
    setCleared(false);
    flyToCommunity(community);
  };

  // A slug handed down from the page moves the camera; the selection itself is
  // already derived from it, so no state is written here.
  const flyToActive = useEffectEvent(() => {
    const community = communities.find((item) => item.slug === activeSlug);
    if (community) flyToCommunity(community);
  });
  useEffect(() => {
    if (!ready || !activeSlug) return;
    flyToActive();
  }, [ready, activeSlug]);

  const clearFocus = () => {
    setSelected(null);
    setCleared(true);
  };

  /* ---- the focused community's summary, derived from the active slug ---- */
  const focus: Focus | null = useMemo(() => {
    if (!activeSlug) return null;
    const community = communities.find((item) => item.slug === activeSlug);
    if (!community) return null;
    const health = healthAccess?.find((item) => item.id === community.id);
    return {
      slug: community.slug,
      name: community.name,
      lga: community.lga,
      population: community.population,
      needCategory: community.needCategory,
      needScore: community.needScore,
      facility: health?.facility ?? null,
      distanceKm: health?.distanceKm ?? null,
    };
  }, [activeSlug, communities, healthAccess]);

  const mapped = communities.filter(
    (community) =>
      community.hasLocation && community.latitude !== null && community.longitude !== null,
  );

  /* ---- legend adapts to what is actually on screen (§84) ---- */
  const activeOverlayLegend = availableOverlays
    .filter((spec) => visibleOverlays[spec.key])
    .flatMap((spec) => spec.legend);
  const baseLegend = healthAccess
    ? { title: "Distance to health facility", rows: DISTANCE_BANDS.map((band) => ({ label: band.label, color: band.color })) }
    : { title: "Main need reported", rows: Object.entries(CATEGORY_COLORS).map(([label, color]) => ({ label, color })) };

  return (
    <div className="map-block">
      <div className="map-wrap" style={height !== undefined ? { height } : undefined}>
        <div
          ref={container}
          className="map"
          role="region"
          aria-label={`Map of ${mapped.length} mapped communities`}
          tabIndex={0}
        />
        {!ready && !error && (
          <div className="map-loading" role="status">
            Preparing map…
          </div>
        )}
        {error && (
          <div className="map-state" role="status">
            We couldn&apos;t load the background map. The community list below still works.
          </div>
        )}
        {ready && !mapped.length && (
          <div className="map-state" role="status">
            No mapped communities in this selection.
          </div>
        )}

        <div className="map-switch" role="group" aria-label="Background map">
          {(Object.keys(tiles) as Basemap[]).map((item) => (
            <button
              type="button"
              aria-pressed={basemap === item}
              className={basemap === item ? "active" : ""}
              onClick={() => {
                basemapTouched.current = true;
                setBasemap(item);
              }}
              key={item}
            >
              {tiles[item].label}
            </button>
          ))}
        </div>

        <div className="map-legend" aria-label="Legend">
          <strong>{baseLegend.title}</strong>
          {baseLegend.rows.map((row) => (
            <div className="legend-row" key={row.label}>
              <span className="legend-dot" style={{ background: row.color }} />
              {row.label}
            </div>
          ))}
          {activeOverlayLegend.length > 0 && (
            <>
              <strong style={{ marginTop: 10 }}>Layers shown</strong>
              {activeOverlayLegend.map((row) => (
                <div className="legend-row" key={row.label}>
                  <span
                    className="legend-dot"
                    style={{
                      background: row.color,
                      borderRadius: row.shape === "dot" || !row.shape ? "50%" : 2,
                      height: row.shape === "line" ? 2 : 9,
                    }}
                  />
                  {row.label}
                </div>
              ))}
            </>
          )}
        </div>

        {spatialControls && (
          <div className="map-layers" aria-label="Map layers">
            <strong>Always shown</strong>
            <label>
              <input
                type="checkbox"
                checked={boundariesVisible}
                onChange={(event) => setBoundariesVisible(event.target.checked)}
              />{" "}
              Local government boundaries
            </label>
            <label>
              Boundary strength
              <input
                aria-label="Boundary strength"
                type="range"
                min="10"
                max="100"
                value={boundaryOpacity}
                onChange={(event) => setBoundaryOpacity(Number(event.target.value))}
              />
            </label>
            <label>
              <input type="checkbox" checked readOnly /> Surveyed communities
            </label>
            {availableOverlays.length > 0 && (
              <>
                <strong>Add a layer</strong>
                {availableOverlays.map((spec) => (
                  <label key={spec.key} title={spec.provenance}>
                    <input
                      type="checkbox"
                      checked={visibleOverlays[spec.key] === true}
                      onChange={(event) => void toggleOverlay(spec, event.target.checked)}
                    />{" "}
                    {spec.label}
                    {loadingLayer === spec.key ? " …" : ""}
                  </label>
                ))}
                <p className="map-layers-note">
                  Extra layers load when you switch them on. Mapped features come from
                  OpenStreetMap contributors, so coverage is uneven.
                </p>
                {layerError && (
                  <p className="map-layers-note" role="status" style={{ color: "var(--warning)" }}>
                    We couldn&apos;t load {layerError}. Try again in a moment.
                  </p>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() =>
                mapRef.current?.fitBounds(LAGOS_BOUNDS, {
                  padding: FIT_PADDING,
                  duration: cameraDuration("state"),
                })
              }
            >
              Reset to Lagos
            </button>
          </div>
        )}

        {identifiedLga && (
          <div className="map-identify" role="status">
            Local government: <strong>{identifiedLga}</strong>
            <button type="button" aria-label="Clear identified boundary" onClick={() => setIdentifiedLga(null)}>
              Clear
            </button>
          </div>
        )}

        {/* Focused community card — the redesigned popup (§83) */}
        {focus && (
          <div className="health-map-info" role="status">
            <div className="map-popup-head" style={{ padding: 0, border: 0 }}>
              <strong>{focus.name}</strong>
              <span>{focus.lga}</span>
            </div>
            <dl style={{ padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: "5px 10px" }}>
              <dt style={{ color: "var(--text-faint)" }}>People</dt>
              <dd style={{ margin: 0, textAlign: "right", fontWeight: 600 }}>
                {focus.population?.toLocaleString("en-NG") ?? "Not recorded"}
              </dd>
              <dt style={{ color: "var(--text-faint)" }}>Main need</dt>
              <dd style={{ margin: 0, textAlign: "right", fontWeight: 600 }}>{focus.needCategory}</dd>
              {healthAccess && (
                <>
                  <dt style={{ color: "var(--text-faint)" }}>Health facility</dt>
                  <dd style={{ margin: 0, textAlign: "right", fontWeight: 600 }}>
                    {focus.distanceKm === null ? "Not recorded" : `${focus.distanceKm.toFixed(1)} km away`}
                  </dd>
                </>
              )}
            </dl>
            <div style={{ display: "flex", gap: 7 }}>
              <Link href={`/communities/${focus.slug}`}>View community</Link>
              <button type="button" onClick={clearFocus}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <details className="map-results">
        <summary>Community list ({mapped.length})</summary>
        <ul>
          {mapped.map((community) => (
            <li key={community.id} aria-current={activeSlug === community.slug ? "true" : undefined}>
              <span>
                {community.name} ({community.lga}); {community.needCategory}
                {community.critical ? "; needs urgent attention" : ""}
              </span>
              <button type="button" onClick={() => selectCommunity(community)}>
                Show on map
              </button>
              <Link href={`/communities/${community.slug}`}>Open</Link>
            </li>
          ))}
        </ul>
      </details>

      {spatialControls && (
        <div className="map-provenance" aria-label="Source and methodology">
          <strong>Source</strong>: boundaries from GRID3 2022 via geoBoundaries gbOpen (CC BY 4.0).
          They are planning geography, not legal land boundaries.
        </div>
      )}
    </div>
  );
}
