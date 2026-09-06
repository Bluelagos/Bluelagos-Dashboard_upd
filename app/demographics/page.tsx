import { DomainPage } from "@/components/domain-page";
import { getCommunities } from "@/lib/data";
import { aggregateKnown, formatNumber } from "@/lib/analytics";
import type { DashboardSearchParams } from "@/lib/domain";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, rows] = await Promise.all([searchParams, getCommunities()]);
  const population = aggregateKnown(rows, "population");
  const withEstimate = rows.filter((c) => c.population !== null).length;

  return (
    <DomainPage
      route="/demographics"
      params={params}
      config={{
        eyebrow: "People",
        title: "People",
        description:
          "See how many people the surveyed communities represent, and how completely that was recorded.",
        tone: "people",
        primaryLabel: "Communities with a population estimate",
        primary: (c) => c.population !== null,
        primaryMetric: "population",
        secondaryLabel: "Women and youth counts recorded",
        secondary: (c) => c.women !== null && c.youth !== null,
        group: "district",
        tableLabel:
          "Every community that gave a population estimate, largest need first.",
        caveat:
          "These are estimates given by the communities themselves during the survey, not census figures. No modelled population surface is mixed into these totals, and communities without an estimate are never counted as zero.",
        guide: {
          shows:
            "How many people live in the surveyed communities, and how many communities were able to give an estimate.",
          read: "The headline total only adds up communities that gave a figure. The count of communities without an estimate is shown next to it, so you can see how complete the total is.",
          look: [
            "How many communities could not give a population estimate",
            "Whether the largest settlements are also the ones under most pressure",
            "Which senatorial districts carry the most people",
          ],
          method:
            "Population is summed only over communities with a recorded estimate. Women, youth and voter counts are reported exactly as collected.",
        },
        takeaway: `${formatNumber(population.value)} people are represented across ${withEstimate} of ${rows.length} surveyed communities; ${rows.length - withEstimate} did not give a population estimate and are excluded from the total rather than counted as zero.`,
        lookAt: [
          "Communities missing a population estimate",
          "Large settlements with a high need score",
          "Districts carrying the biggest share of people",
        ],
      }}
    />
  );
}
