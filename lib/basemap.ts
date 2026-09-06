/**
 * Raster basemaps.
 *
 * These are keyless Esri services: the CARTO tiles previously used now stamp
 * "API KEY REQUIRED" across every tile, which is not something to discover
 * during a presentation.
 *
 * The Esri canvas tiles are lighter than the Deep Coast palette, so the dark
 * basemap is dimmed and desaturated to sit under the community points instead
 * of competing with them. Satellite imagery is deliberately left untouched —
 * recolouring aerial photography would misrepresent it.
 */
export const BASEMAP_TILES = {
  dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  light:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  satellite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
} as const;

export const BASEMAP_ATTRIBUTION = {
  canvas: "Esri, HERE, Garmin and OpenStreetMap contributors",
  satellite: "Esri World Imagery",
} as const;

export type BasemapPaint = {
  "raster-opacity": number;
  "raster-brightness-min": number;
  "raster-brightness-max": number;
  "raster-saturation": number;
  "raster-contrast": number;
};

/** Dimmed so community points and boundaries stay the brightest thing on screen. */
export const DARK_CANVAS_PAINT: BasemapPaint = {
  "raster-opacity": 1,
  "raster-brightness-min": 0,
  "raster-brightness-max": 0.42,
  "raster-saturation": -0.2,
  "raster-contrast": 0.05,
};

export const LIGHT_CANVAS_PAINT: BasemapPaint = {
  "raster-opacity": 1,
  "raster-brightness-min": 0.08,
  "raster-brightness-max": 1,
  "raster-saturation": -0.15,
  "raster-contrast": 0,
};

/** Imagery is shown as captured. */
export const SATELLITE_PAINT: BasemapPaint = {
  "raster-opacity": 1,
  "raster-brightness-min": 0,
  "raster-brightness-max": 1,
  "raster-saturation": 0,
  "raster-contrast": 0,
};

export const paintFor = (basemap: "dark" | "light" | "satellite"): BasemapPaint =>
  basemap === "satellite"
    ? SATELLITE_PAINT
    : basemap === "light"
      ? LIGHT_CANVAS_PAINT
      : DARK_CANVAS_PAINT;
