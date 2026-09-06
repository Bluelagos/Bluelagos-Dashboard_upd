"use client";

/**
 * Theme system for Blue Lagos.
 *
 *   "deep" — Deep Coast (night lagoon)
 *   "warm" — Warm Coast (cream policy-report / map-room)
 *
 * The chosen theme lives in one place: the `data-theme` attribute on the
 * document element. That makes the whole palette a single CSS variable swap,
 * and it means React reads the theme the same way a stylesheet does. Components
 * subscribe through `useSyncExternalStore`, so the DOM attribute is the source
 * of truth rather than a duplicate copy in React state.
 *
 * THEME_INIT_SCRIPT runs in the document head before first paint, so the stored
 * (or system-preferred) theme is applied with no flash.
 */

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemeName = "deep" | "warm";
export const THEME_STORAGE_KEY = "blue-lagos-theme";
const THEME_EVENT = "bluelagos:themechange";

/** Runs before paint. Kept dependency-free and small on purpose. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="deep"&&t!=="warm"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"warm":"deep"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","deep")}})()`;

function storedPreference(): ThemeName | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "deep" || value === "warm" ? value : null;
  } catch {
    return null; // storage blocked — follow the system instead
  }
}

function applyTheme(next: ThemeName) {
  document.documentElement.setAttribute("data-theme", next);
  dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

/* --- external store: the DOM attribute --- */

function getSnapshot(): ThemeName {
  return document.documentElement.getAttribute("data-theme") === "warm" ? "warm" : "deep";
}

/** The server always renders the default; the init script corrects it before paint. */
const getServerSnapshot = (): ThemeName => "deep";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  // Keep following the system for as long as no explicit choice has been made.
  const onSystemChange = () => {
    if (storedPreference()) return;
    applyTheme(media.matches ? "warm" : "deep");
  };
  media.addEventListener("change", onSystemChange);
  addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onSystemChange);
    removeEventListener(THEME_EVENT, onChange);
  };
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
        aria-label="Warm Coast — light appearance"
        title="Warm Coast (light)"
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
