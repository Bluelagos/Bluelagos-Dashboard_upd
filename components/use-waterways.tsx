"use client";

import { useEffect, useState } from "react";

/**
 * The mapped waterway network, fetched after first paint.
 *
 * The processed linework is ~800 KB. Passing it through the server-rendered
 * payload made the Priorities and Scenarios pages several times heavier than
 * anything else in the app and delayed the text and headline figures behind it.
 * Fetching it here means the page is readable immediately, the browser caches
 * the file across routes, and the layer simply appears when it arrives.
 */
let shared: Promise<GeoJSON.FeatureCollection> | null = null;

export function useWaterways(): GeoJSON.FeatureCollection | null {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    let cancelled = false;
    shared ??= fetch("/api/layers/osm-waterways")
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<GeoJSON.FeatureCollection>;
      })
      .catch((error) => {
        shared = null; // allow a later retry
        throw error;
      });
    shared
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        /* the map stays usable without the waterway layer */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
