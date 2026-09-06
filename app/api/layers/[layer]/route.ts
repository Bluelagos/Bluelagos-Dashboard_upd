import { NextResponse } from "next/server";
import {
  getOsmHealthFacilities,
  getOsmMarineAccess,
  getOsmWaterways,
} from "@/lib/spatial/osm";
import { getAdministrativeLayer } from "@/lib/spatial";
import { getSpatialContext } from "@/lib/spatial/context";
import { h3CellsToGeoJSON } from "@/lib/spatial/h3";

/**
 * Optional map layers, served on demand.
 *
 * These files are large (the waterway linework alone is ~800 KB) and most
 * visitors never switch them on. Serving them from here instead of embedding
 * them in the page payload keeps the first paint small, and because the
 * processed files are immutable between pipeline runs they can be cached hard
 * by the browser.
 */
const LAYERS = {
  "osm-health": () => getOsmHealthFacilities(),
  "osm-marine": () => getOsmMarineAccess(),
  "osm-waterways": () => getOsmWaterways(),
  administrative: async () => getAdministrativeLayer(),
  h3: async () => {
    const spatial = await getSpatialContext();
    return h3CellsToGeoJSON(spatial.h3.cells);
  },
} as const;

export type LayerKey = keyof typeof LAYERS;

export async function GET(_request: Request, context: { params: Promise<{ layer: string }> }) {
  const { layer } = await context.params;
  const load = LAYERS[layer as LayerKey];
  if (!load) return NextResponse.json({ error: "Unknown layer." }, { status: 404 });
  try {
    const data = await load();
    return NextResponse.json(data, {
      headers: {
        // Processed layers only change when the offline pipeline reruns.
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: `The ${layer} layer is unavailable.` }, { status: 503 });
  }
}
