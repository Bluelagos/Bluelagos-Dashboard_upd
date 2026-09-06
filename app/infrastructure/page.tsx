import { DomainPage } from "@/components/domain-page";
import { getCommunities } from "@/lib/data";
import type { Community, DashboardSearchParams } from "@/lib/domain";

const deficitCount = (c: Community) =>
  [
    c.energyStatus === "ENERGY_POOR",
    c.digitalStatus === "EXCLUDED",
    c.sanitationDeficit === true,
    c.disasterPreparednessVoid === true,
  ].filter(Boolean).length;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, rows] = await Promise.all([searchParams, getCommunities()]);
  const multiple = rows.filter((c) => deficitCount(c) >= 2).length;
  const noPlan = rows.filter((c) => c.disasterPreparednessVoid === true).length;

  return (
    <DomainPage
      route="/infrastructure"
      params={params}
      config={{
        eyebrow: "Infrastructure",
        title: "Infrastructure",
        description:
          "See where power, connectivity, sanitation and emergency readiness are missing at the same time.",
        tone: "infrastructure",
        primaryLabel: "Several basic services missing",
        primary: (c) => deficitCount(c) >= 2,
        secondaryLabel: "No emergency plan in place",
        secondary: (c) => c.disasterPreparednessVoid === true,
        group: "jettyCondition",
        tableLabel: "Communities missing the most basic services.",
        caveat:
          "Everything here is what communities reported. There is no official register of built assets behind it, so a jetty with no record is shown as not recorded — never as absent.",
        guide: {
          shows:
            "Which communities lack electricity, mobile or internet access, working sanitation, or any emergency plan — and where those gaps stack up together.",
          read: "A community counts as “several basic services missing” when two or more of those four gaps were recorded at once. The chart groups those communities by local government.",
          look: [
            "Communities missing three or four services at once",
            "Settlements with no emergency plan and no way out on water",
            "Jetty conditions recorded as poor or not recorded at all",
          ],
          method:
            "Each gap is a separate survey observation. They are counted, not weighted, and a missing answer never counts as a gap.",
        },
        takeaway:
          multiple || noPlan
            ? `${multiple} communities are missing two or more basic services at once, and ${noPlan} have no emergency plan of any kind.`
            : null,
        lookAt: [
          "Communities missing three or more services",
          "Where a lack of power and a lack of connectivity overlap",
          "Jetty condition, which shapes everything else on water",
        ],
      }}
    />
  );
}
