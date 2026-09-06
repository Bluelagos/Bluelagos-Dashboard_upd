import { getCommunityDataset } from "@/lib/data";
import { getOsmProcessedMetadata } from "@/lib/spatial/osm";
import { validateAdministrativeLayer } from "@/lib/spatial";
import { Archive } from "lucide-react";

type State = "ready" | "partial" | "unavailable";

const BADGE: Record<State, { label: string; className: string }> = {
  ready: { label: "Working", className: "badge positive" },
  partial: { label: "Partly working", className: "badge warning" },
  unavailable: { label: "Not available", className: "badge" },
};

/**
 * One honest board for what the platform can and cannot currently do.
 * The plain state comes first; the technical detail sits underneath it, so a
 * non-technical reader gets the answer without wading through the reasoning.
 */
export async function SystemStatus() {
  const [{ status }, osm] = await Promise.all([getCommunityDataset(), getOsmProcessedMetadata()]);
  const boundary = validateAdministrativeLayer();

  const rows: Array<{ name: string; state: State; plain: string; technical: string }> = [
    {
      name: "Community records",
      state: status.mode === "snapshot" ? "partial" : "ready",
      plain:
        status.mode === "snapshot"
          ? `Using a saved copy of the survey from ${new Date(
              status.snapshotCreatedAt ?? status.fetchedAt,
            ).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" })}.`
          : `${status.rowCount} communities, read live from the database.`,
      technical: `Row count ${status.rowCount}; server count reconciliation ${status.complete ? "passed" : "needs review"}; ${status.validationIssueCount} validation notes recorded.`,
    },
    {
      name: "Local government boundaries",
      state: boundary.valid ? "ready" : "partial",
      plain: `${boundary.lgaCount} local government areas and the state outline are loaded.`,
      technical: `${boundary.stateCount} ADM1 + ${boundary.lgaCount} ADM2 polygons from GRID3 2022 via geoBoundaries gbOpen (CC BY 4.0). Planning geography, not cadastral.`,
    },
    {
      name: "Open map of Lagos",
      state: "ready",
      plain: `${osm.layers["osm-health-facilities"].featureCount} health facilities, ${osm.layers["osm-marine-access"].featureCount} landing points and ${osm.layers["osm-waterways"].featureCount} waterway segments are available.`,
      technical: `OpenStreetMap extract retrieved ${osm.retrievedAt.slice(0, 10)}, ODbL licence. Contributor-mapped, so coverage is uneven and it is not an official Lagos State register.`,
    },
    {
      name: "Distances and concentration",
      state: "ready",
      plain: "Distances between communities and mapped services are calculated and kept up to date.",
      technical:
        "Great-circle (Haversine) nearest-neighbour distances via Turf, plus an H3 resolution-7 aggregation, recomputed from the survey coordinates.",
    },
    {
      name: "Jetties and landing points",
      state: "partial",
      plain: "Only landing points mapped by open-map contributors are available.",
      technical:
        "OSM ferry terminals and piers only. There is no official Lagos State jetty register behind this layer.",
    },
    {
      name: "Satellite and elevation data",
      state: "unavailable",
      plain: "No satellite flood, land cover or elevation product is in use.",
      technical:
        "Earth-observation adapter present but not authenticated; no product has passed processing and review. Field flood evidence only.",
    },
    {
      name: "Modelled population",
      state: "unavailable",
      plain: "Population comes only from what communities reported.",
      technical: "No gridded population surface (WorldPop or similar) is integrated into any total.",
    },
    {
      name: "Travel time by road or water",
      state: "unavailable",
      plain: "Every distance shown is measured in a straight line.",
      technical:
        "No validated navigable-water or road network exists, so no routing, isochrone or travel-time output is published.",
    },
  ];

  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">What the platform can and cannot currently do</caption>
        <thead>
          <tr>
            <th scope="col">Part of the platform</th>
            <th scope="col">Status</th>
            <th scope="col">What that means</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>
                <span className={BADGE[row.state].className}>{BADGE[row.state].label}</span>
              </td>
              <td>
                {row.plain}
                <details className="drawer-tech" style={{ marginTop: 8 }}>
                  <summary>Technical detail</summary>
                  <p>{row.technical}</p>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small, non-alarming strip shown only when the saved dataset is in use. */
export async function SnapshotBanner() {
  const { status } = await getCommunityDataset();
  if (status.mode !== "snapshot") return null;
  const saved = new Date(status.snapshotCreatedAt ?? status.fetchedAt).toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="notice-bar" role="status">
      <Archive aria-hidden="true" />
      Showing saved survey data from {saved}
      <details>
        <summary>Why?</summary>
        <p>
          The live database was unreachable, so the platform is using the last saved copy of the
          dataset ({status.rowCount} communities, count check passed). Every figure is frozen at that
          date. No value has been estimated or filled in.
        </p>
      </details>
    </div>
  );
}
