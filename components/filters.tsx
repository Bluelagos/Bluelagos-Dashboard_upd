import type { Community, FilterState, NeedCategory } from "@/lib/domain";
import { Search, X } from "lucide-react";
import Link from "next/link";

const NEEDS: NeedCategory[] = [
  "Water & Sanitation",
  "Roads & Infrastructure",
  "Healthcare",
  "Education",
  "Civic Support",
  "Unclassified",
];

/**
 * Primary filters stay on one line: search, LGA, need. Anything else lives
 * behind "More filters" so the bar never becomes a wall of dropdowns (§67).
 */
export function Filters({
  communities,
  filters,
  action = "",
}: {
  communities: Community[];
  filters: FilterState;
  action?: string;
}) {
  const districts = [
    ...new Set(communities.map((c) => c.district).filter((district) => district !== "Unknown")),
  ].sort();
  const lgas = [
    ...new Set(
      communities
        .filter((c) => !filters.district || c.district === filters.district)
        .map((c) => c.lga),
    ),
  ].sort();
  const secondaryActive = Boolean(filters.district || filters.risk);

  return (
    <>
      <form className="filterbar" action={action}>
        <div className="filterbar-search">
          <Search aria-hidden="true" />
          <input
            aria-label="Search communities"
            name="q"
            defaultValue={filters.q}
            placeholder="Search communities"
          />
        </div>
        <select aria-label="Local government area" name="lga" defaultValue={filters.lga || ""}>
          <option value="">All local governments</option>
          {lgas.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select aria-label="Main need reported" name="need" defaultValue={filters.need || ""}>
          <option value="">All needs</option>
          {NEEDS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <details className="more-filters-wrap" open={secondaryActive}>
          <summary className="btn secondary" style={{ listStyle: "none" }}>
            More filters
          </summary>
          <div className="more-filters" style={{ marginTop: 8 }}>
            <select
              aria-label="Senatorial district"
              name="district"
              defaultValue={filters.district || ""}
            >
              <option value="">All senatorial districts</option>
              {districts.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select aria-label="Attention level" name="risk" defaultValue={filters.risk || ""}>
              <option value="">Any attention level</option>
              <option value="critical">Needs urgent attention only</option>
            </select>
          </div>
        </details>
        <button className="btn" type="submit">
          Apply
        </button>
      </form>
      <FilterChips filters={filters} action={action} />
    </>
  );
}

/**
 * Active filters shown as removable chips so the current state of the page is
 * always obvious during a walkthrough (§68).
 */
export function FilterChips({ filters, action = "" }: { filters: FilterState; action?: string }) {
  const base = action || "/";
  const entries: Array<[keyof FilterState, string]> = [];
  if (filters.q) entries.push(["q", `“${filters.q}”`]);
  if (filters.lga) entries.push(["lga", filters.lga]);
  if (filters.district) entries.push(["district", filters.district]);
  if (filters.need) entries.push(["need", filters.need]);
  if (filters.risk) entries.push(["risk", "Needs urgent attention"]);
  if (!entries.length) return null;

  const href = (omit: keyof FilterState) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (key !== omit && value) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  return (
    <div className="chip-row">
      <span className="chip-row-label">Showing:</span>
      {entries.map(([key, label]) => (
        <Link className="filter-chip" href={href(key)} key={key} aria-label={`Remove filter ${label}`}>
          {label}
          <X aria-hidden="true" />
        </Link>
      ))}
      <Link className="filter-chip clear-all" href={base}>
        Clear all
      </Link>
    </div>
  );
}
