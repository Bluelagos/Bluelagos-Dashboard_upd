"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";

interface Hit {
  slug: string;
  name: string;
  lga: string;
  district: string;
  population: number | null;
  needScore: number;
  mapped: boolean;
}

/**
 * Global community search. Opens with "/" or Ctrl/Cmd-K, loads a ~10 KB index
 * on first open, and navigates straight to the community page — which fits the
 * map to that settlement. Built to be usable live in a presentation.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Hit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const router = useRouter();

  // Open shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, select, textarea, [contenteditable=true]");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, []);

  // Load the index once, the first time search is opened.
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    input.current?.focus();
    if (index || failed) return;
    fetch("/api/search")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
      .then((payload: { communities: Hit[] }) => setIndex(payload.communities))
      .catch(() => setFailed(true));
  }, [open, index, failed]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
    restoreTo.current?.focus?.();
  };

  const needle = query.trim().toLowerCase();
  const results = !needle
    ? (index ?? []).slice(0, 8)
    : (index ?? [])
        .filter(
          (hit) =>
            hit.name.toLowerCase().includes(needle) ||
            hit.lga.toLowerCase().includes(needle) ||
            hit.district.toLowerCase().includes(needle),
        )
        .slice(0, 12);

  const go = (hit: Hit) => {
    close();
    router.push(`/communities/${hit.slug}`);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") return close();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(results.length - 1, value + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(0, value - 1));
    }
    if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  };

  return (
    <>
      <button className="global-search" onClick={() => setOpen(true)} aria-label="Search communities">
        <SearchIcon aria-hidden="true" />
        <span>Search communities</span>
        <kbd>/</kbd>
      </button>
      {open && (
        <div
          className="search-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search communities">
            <div className="search-panel-input">
              <SearchIcon aria-hidden="true" />
              <input
                ref={input}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search communities"
                aria-label="Search communities"
                autoComplete="off"
              />
            </div>
            {failed ? (
              <p className="search-empty">We couldn&apos;t load the community list. Close this and try again.</p>
            ) : !index ? (
              <p className="search-empty">Loading communities…</p>
            ) : results.length === 0 ? (
              <p className="search-empty">No community matches “{query}”.</p>
            ) : (
              <ul className="search-results">
                {results.map((hit, position) => (
                  <li key={hit.slug}>
                    <button
                      data-active={position === active}
                      onMouseEnter={() => setActive(position)}
                      onClick={() => go(hit)}
                    >
                      <span>
                        <strong>{hit.name}</strong>
                        <small>
                          {hit.lga}
                          {hit.mapped ? "" : " · not yet mapped"}
                        </small>
                      </span>
                      <em>
                        {hit.population === null
                          ? "Population not recorded"
                          : `${hit.population.toLocaleString("en-NG")} people`}
                      </em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="search-hint">
              <span>↑↓ to move</span>
              <span>Enter to open</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
