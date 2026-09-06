import { DomainPage } from "@/components/domain-page";
import { getCommunities } from "@/lib/data";
import type { DashboardSearchParams } from "@/lib/domain";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, rows] = await Promise.all([searchParams, getCommunities()]);
  const extreme = rows.filter((c) => c.mpi !== null && c.mpi >= 4).length;
  const harvest = rows.filter((c) => c.harvestRisk === "SEVERE").length;

  return (
    <DomainPage
      route="/economy"
      params={params}
      config={{
        eyebrow: "Livelihoods",
        title: "Livelihoods",
        description:
          "See what people do for a living in these communities, and what puts that income at risk.",
        tone: "livelihoods",
        primaryLabel: "Deepest poverty",
        primary: (c) => c.mpi !== null && c.mpi >= 4,
        secondaryLabel: "Losing much of the catch or harvest",
        secondary: (c) => c.harvestRisk === "SEVERE",
        group: "occupation",
        tableLabel: "Communities under the most economic pressure.",
        caveat:
          "Where two conditions appear together, that is co-occurrence only. Nothing here establishes that one causes the other, and no statistical significance is claimed.",
        guide: {
          shows:
            "The main occupations across surveyed communities, how deep poverty runs, and where produce or catch is being lost before it reaches a market.",
          read: "The chart groups communities by local government. The table lists the communities under the most pressure, with the occupation each one reported.",
          look: [
            "Fishing-dependent communities that also report losing their catch",
            "Local governments where deep poverty is concentrated",
            "Communities asking for market or storage support",
          ],
          method:
            "Poverty depth uses the multidimensional poverty measure recorded during the survey. Loss risk is the community's own assessment of post-harvest loss.",
        },
        takeaway:
          extreme || harvest
            ? `${extreme} communities recorded the deepest level of poverty, and ${harvest} reported losing a severe share of their catch or harvest before sale.`
            : null,
        lookAt: [
          "Communities where deep poverty and produce loss overlap",
          "Occupations that dominate the worst-affected settlements",
          "Places where storage or transport would change the picture",
        ],
      }}
    />
  );
}
