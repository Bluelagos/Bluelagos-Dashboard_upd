/**
 * Raster basemaps.
 *
 * These are keyless Esri services: the CARTO tiles previously used now stamp
 * "API KEY REQUIRED" across every tile, which is not something to discover
 * during a presentation.
 *
 * Two basemaps only. Satellite imagery is the default — for riverine
 * settlements the water, the sandbars and the built footprint carry most of the
 * meaning, and a drawn canvas throws all of that away. The light canvas stays
 * as the alternative for reading names and boundaries. There is no dark canvas:
 * it competed with the community symbols and photographed badly on a projector.
 */
export const BASEMAP_TILES = {
  light:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  satellite:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
} as const;

export const BASEMAP_ATTRIBUTION = {
  canvas: "Esri, HERE, Garmin and OpenStreetMap contributors",
  satellite: "Esri World Imagery",
} as const;

export type BasemapKey = keyof typeof BASEMAP_TILES;

export type BasemapPaint = {
  "raster-opacity": number;
  "raster-brightness-min": number;
  "raster-brightness-max": number;
  "raster-saturation": number;
  "raster-contrast": number;
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

export const paintFor = (basemap: BasemapKey): BasemapPaint =>
  basemap === "satellite" ? SATELLITE_PAINT : LIGHT_CANVAS_PAINT;
