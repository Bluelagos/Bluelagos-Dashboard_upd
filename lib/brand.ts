import { readdirSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";

/**
 * Official Blue Lagos logo detection.
 *
 * The logo is not committed to the repository — `public/brand/` is a reserved
 * slot. When the official asset is dropped in, every brand surface (sidebar,
 * mobile header, briefing, loading screen, favicon, social card) picks it up
 * automatically with no code change. Until then the app falls back to the
 * neutral wave glyph.
 *
 * Preference order favours a scalable, recolourable asset and an
 * explicitly-named official file over an incidental one.
 */
const BRAND_DIR = join(process.cwd(), "public", "brand");
const EXTENSION_RANK = [".svg", ".webp", ".png", ".jpg", ".jpeg"];

export interface BrandLogo {
  /** Public URL to use in <img src> / metadata. */
  src: string;
  /** True for SVG, which can be scaled and themed freely. */
  scalable: boolean;
}

function score(file: string): number {
  const lower = file.toLowerCase();
  const extension = EXTENSION_RANK.findIndex((candidate) => lower.endsWith(candidate));
  if (extension === -1) return -1;
  // Lower is better: preferred extension first, then an official-looking name.
  const named = /blue[\s._-]?lagos|logo|wordmark|brand/.test(lower) ? 0 : 10;
  return extension + named;
}

export const getBrandLogo = cache((): BrandLogo | null => {
  let entries: string[];
  try {
    entries = readdirSync(BRAND_DIR);
  } catch {
    return null;
  }
  const best = entries
    .filter((file) => score(file) >= 0)
    .sort((a, b) => score(a) - score(b) || a.localeCompare(b))[0];
  if (!best) return null;
  return { src: `/brand/${best}`, scalable: best.toLowerCase().endsWith(".svg") };
});
