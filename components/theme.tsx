"use client";

/**
 * Theme system for Blue Lagos.
 *
 *   "coast" — Coastal Day (cool off-white policy-report / map-room) — DEFAULT
 *   "deep"  — Deep Coast (night lagoon)
 *
 * The storage key still reads "warm" for the light theme so an existing
 * preference survives the palette change; only the palette and the name moved.
 *
 * The chosen theme lives in one place: the `data-theme` attribute on the
 * document element. That makes the whole palette a single CSS variable swap,
 * and it means React reads the theme the same way a stylesheet does. Components
 * subscribe through `useSyncExternalStore`, so the DOM attribute is the source
 * of truth rather than a duplicate copy in React state.
 *
 * THEME_INIT_SCRIPT runs in the document head before first paint, so the stored
 * theme — or the default — is applied with no flash.
 */

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemeName = "deep" | "warm";
export const THEME_STORAGE_KEY = "blue-lagos-theme";
const THEME_EVENT = "bluelagos:themechange";
/** Coastal Day is what the platform is presented in unless someone opts out. */
const DEFAULT_THEME: ThemeName = "warm";

/** Runs before paint. Kept dependency-free and small on purpose. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="deep"&&t!=="warm"){t="${DEFAULT_THEME}"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}")}})()`;

function applyTheme(next: ThemeName) {
  document.documentElement.setAttribute("data-theme", next);
  dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

/* --- external store: the DOM attribute --- */

function getSnapshot(): ThemeName {
  return document.documentElement.getAttribute("data-theme") === "deep" ? "deep" : "warm";
}

/** The server always renders the default; the init script corrects it before paint. */
const getServerSnapshot = (): ThemeName => DEFAULT_THEME;

// Coastal Day is the default everywhere, including on machines set to dark
// mode: the platform is presented on projectors and in printed screenshots, and
// a stable default matters more there than following the operating system.
function subscribe(onChange: () => void) {
  addEventListener(THEME_EVENT, onChange);
  return () => removeEventListener(THEME_EVENT, onChange);
}

/**
 * Kept as a component so the tree has one obvious place the theme is owned,
 * even though the state itself lives on the document element.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setTheme = useCallback((next: ThemeName) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* the preference simply will not persist */
    }
    applyTheme(next);
  }, []);
  return { theme, setTheme };
}

/** Current theme name; re-renders on every switch. */
export function useThemeName(): ThemeName {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Appearance">
      <button
        type="button"
        aria-pressed={theme === "deep"}
        aria-label="Deep Coast — dark appearance"
        title="Deep Coast (dark)"
        onClick={() => setTheme("deep")}
      >
        <Moon aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-pressed={theme === "warm"}
        aria-label="Coastal Day — light appearance"
        title="Coastal Day (light)"
        onClick={() => setTheme("warm")}
      >
        <Sun aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Read a resolved design token from the live stylesheet. Used by MapLibre and
 * ECharts, which cannot consume CSS variables directly.
 */
export function token(name: string, fallback = "#888"): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
