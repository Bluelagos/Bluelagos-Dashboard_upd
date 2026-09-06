/**
 * Motion constants.
 *
 * UI durations mirror the CSS custom properties in globals.css. Map camera
 * durations are deliberately different per interaction so a transition reads as
 * intentional rather than uniform: fitting the whole state is a slow settle,
 * dropping into a single community is a shorter, more decisive move.
 */

export const DURATION = {
  fast: 140,
  normal: 210,
  slow: 320,
} as const;

/** True when the viewer has asked for reduced motion. */
export const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Camera durations, in milliseconds, keyed by what the move means. */
export const CAMERA = {
  /** Lagos-wide fit on first render or "reset view". */
  state: 900,
  /** Zooming from the state down to one LGA. */
  lga: 700,
  /** Fitting the members of a cluster or a filtered set. */
  cluster: 650,
  /** Dropping into a single community. */
  community: 550,
  /** A small nudge onto an already-visible feature. */
  nudge: 350,
} as const;

export type CameraMove = keyof typeof CAMERA;

/** Duration for a camera move, honouring reduced-motion. */
export const cameraDuration = (move: CameraMove) => (reducedMotion() ? 0 : CAMERA[move]);

/** Padding used with fitBounds so points never sit under the map chrome. */
export const FIT_PADDING = { top: 48, right: 48, bottom: 64, left: 48 };

/** Lagos State bounding box, used for the "reset view" control. */
export const LAGOS_BOUNDS: [[number, number], [number, number]] = [
  [2.67, 6.34],
  [4.36, 6.71],
];
