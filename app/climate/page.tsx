import { DomainPage } from "@/components/domain-page";
import { Panel, SectionHead } from "@/components/ui";
import { getCommunities } from "@/lib/data";
import { environmentTakeaway } from "@/lib/takeaways";
import type { Community, DashboardSearchParams } from "@/lib/domain";

/**
 * Two tabs, because two things are actually measured: what communities
 * reported about flooding, and what they reported about erosion. Land cover,
 * elevation and surface water have no reviewed output yet, so they are listed
 * honestly in the register below rather than given an empty tab (§28).
 */
const VIEWS = {
  flood: {
    label: "Flood",
    primaryLabel: "Rated flooding at the top of the scale",
    primary: (c: Community) => c.floodHazard !== null && c.floodHazard >= 4,
    secondaryLabel: "Erosion severe enough to displace people",
    secondary: (c: Community) => c.erosionRisk === "CRITICAL_DISPLACEMENT",
    group: "floodHazard" as const,
    metric: "flood" as const,
  },
  erosion: {
    label: "Erosion",
    primaryLabel: "Erosion severe enough to displace people",
    primary: (c: Community) => c.erosionRisk === "CRITICAL_DISPLACEMENT",
    secondaryLabel: "Also rated flooding at the top of the scale",
    secondary: (c: Community) => c.floodHazard !== null && c.floodHazard >= 4,
    group: "erosionRisk" as const,
    metric: "erosion" as const,
  },
};

type ViewKey = keyof typeof VIEWS;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, rows] = await Promise.all([searchParams, getCommunities()]);
  const raw = Array.isArray(params.view) ? params.view[0] : params.view;
  const key: ViewKey = raw === "erosion" ? "erosion" : "flood";
  const view = VIEWS[key];

  const tabHref = (next: ViewKey) => {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (name !== "view" && typeof value === "string" && value) query.set(name, value);
    }
    query.set("view", next);
    return `/climate?${query.toString()}`;
  };

  return (
    <>
      <nav className="mode-tabs" aria-label="Environment view" style={{ marginBottom: 0 }}>
        {(Object.keys(VIEWS) as ViewKey[]).map((item) => (
          <a
            key={item}
            href={tabHref(item)}
            className={key === item ? "active" : ""}
            aria-current={key === item ? "page" : undefined}
          >
            {VIEWS[item].label}
          </a>
        ))}
      </nav>

      <DomainPage
        route="/climate"
        params={params}
        config={{
          eyebrow: "Environment",
          title: "Environment",
          description:
            "See reported flood and erosion conditions alongside the physical environment around each community.",
          tone: "environment",
          primaryLabel: view.primaryLabel,
          primary: view.primary,
          primaryMetric: view.metric,
          secondaryLabel: view.secondaryLabel,
          secondary: view.secondary,
          group: view.group,
          tableLabel: "Communities reporting the strongest environmental pressure.",
          caveat:
            "Flood ratings are what communities told the surveyors. They are not flood depth, not a probability, not satellite-mapped water extent and not a climate projection. Population figures describe who lives there, not modelled exposure.",
          guide: {
            shows:
              "Which communities are already living with flooding or erosion, based on what they reported during the survey.",
            read: "Flood is rated by the community on a scale of 1 to 5; this page counts those at 4 or 5. Erosion is counted where it was recorded as severe enough to displace households.",
            look: [
              "Communities that report both flooding and erosion",
              "Whether flood-exposed communities also lack sanitation",
              "Local governments where exposure is concentrated",
            ],
            method:
              "Both figures come directly from the field survey. No satellite or modelled environmental product has passed review, so none is shown.",
          },
          takeaway: environmentTakeaway(rows),
          lookAt: [
            "Communities reporting flooding and erosion together",
            "Settlements with no emergency plan in a flood-exposed area",
            "Where erosion is actively displacing households",
          ],
        }}
      />

      <SectionHead
        title="Satellite and elevation evidence"
        description="What we have not yet processed stays visible rather than being quietly inferred."
      />
      <Panel title="" subtitle="">
        <div className="panel-body evidence-grid">
          <article className="evidence-card">
            <h3>Surface water</h3>
            <p className="status-unavailable">
              Not available. No reviewed satellite water product has been processed.
            </p>
          </article>
          <article className="evidence-card">
            <h3>Vegetation</h3>
            <p className="status-unavailable">
              Not available. No acquisition period, cloud mask or resolution has been agreed.
            </p>
          </article>
          <article className="evidence-card">
            <h3>Land cover</h3>
            <p className="status-unavailable">
              Not available. ESA WorldCover is a candidate source, not an integrated result.
            </p>
          </article>
          <article className="evidence-card">
            <h3>Change in built-up area</h3>
            <p className="status-unavailable">
              Not available. No comparable pair of dates has been processed.
            </p>
          </article>
          <article className="evidence-card">
            <h3>Shoreline change</h3>
            <p className="status-unavailable">
              Method only. Tide, season and edge-detection controls are unresolved, so no erosion
              rate is claimed.
            </p>
          </article>
          <article className="evidence-card">
            <h3>Flood vulnerability model</h3>
            <p className="status-unavailable">
              Not published. Valid elevation, historical water and modelled population inputs are
              all missing, so no combined score is generated.
            </p>
          </article>
        </div>
      </Panel>
    </>
  );
}
