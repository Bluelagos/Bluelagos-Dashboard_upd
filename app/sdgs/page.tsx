import { CommunityMap } from "@/components/community-map";
import { PageGuide, PageHeader, Panel } from "@/components/ui";
import { getCommunities } from "@/lib/data";
import { SDG_INDICATORS } from "@/lib/constants";
export default async function Page() {
  const rows = await getCommunities();
  return (
    <>
      <PageHeader
        eyebrow="SDG alignment"
        title="SDGs"
        description="See how the survey evidence maps onto the Sustainable Development Goals, using only what can actually be measured here."
      />
      <PageGuide
        shows="Where the surveyed communities stand against a set of goal-aligned measures built from the field survey."
        read="Each percentage is the share of communities that show the problem, counted only among communities where the underlying question was answered. The number of communities missing that answer is shown beside it."
        look={[
          "Goals where a large share of communities are affected",
          "Goals where too little was recorded to say anything",
          "How these local measures differ from the official UN indicators",
        ]}
        method="These are local stand-ins built from survey answers, not official UN indicator calculations. They are labelled that way wherever they appear."
      />
      <div className="callout">
        These are local stand-ins for the official indicators, not the UN measures themselves. Each
        percentage counts only communities where the underlying question was answered; communities
        with no answer are reported separately rather than assumed to be fine.
      </div>
      <div className="grid two-col section-gap">
        {SDG_INDICATORS.map((definition) => {
          const observed = rows.filter(definition.observed);
          const affected = observed.filter(definition.affected);
          const missing = rows.length - observed.length;
          const pct = observed.length
            ? (affected.length / observed.length) * 100
            : null;
          return (
            <Panel
              key={definition.goal}
              title={`SDG ${definition.goal} · ${definition.name}`}
              subtitle={`Target ${definition.target} · local measure`}
            >
              <div className="panel-body">
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 12 }}
                >
                  <strong
                    style={{
                      fontSize: 28,
                      color:
                        pct === null
                          ? "var(--text-secondary)"
                          : pct >= 50
                            ? "var(--critical)"
                            : pct >= 20
                              ? "var(--warning)"
                              : "var(--positive)",
                    }}
                  >
                    {pct === null ? "Not enough recorded" : `${pct.toFixed(1)}%`}
                  </strong>
                  <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                    {affected.length} of {observed.length} communities that answered
                    {missing ? `; ${missing} did not` : ""}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>{definition.label}</p>
                <div
                  style={{ height: 5, background: "var(--surface-inset)", borderRadius: 4, border: "1px solid var(--border)" }}
                >
                  {pct !== null && (
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "var(--brand)",
                        borderRadius: 4,
                      }}
                    />
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel
        title="Where these communities are"
        subtitle="Communities affected by at least one of the measures above"
        className="section-gap"
      >
        <CommunityMap
          communities={rows.filter((c) =>
            SDG_INDICATORS.some((definition) => definition.affected(c)),
          )}
          height={430}
        />
      </Panel>
      <div className="callout section-gap">
        Education and statewide voter figures that appeared in the original report are not
        recalculated here — they remain historical report figures rather than current measures. Only
        the goals with a formula the survey can actually support are shown, which is why seven appear
        rather than a longer list.
      </div>
    </>
  );
}
