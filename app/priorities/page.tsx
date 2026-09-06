import {
  KeyTakeaway,
  Kpi,
  PageGuide,
  PageHeader,
  TakeawayRow,
  WhatToLookAt,
} from "@/components/ui";
import { PriorityModel } from "@/components/priority-model";
import { SharedServiceAreas } from "@/components/shared-service-areas";
import { getCommunities } from "@/lib/data";
import { getAdministrativeLayer, getLagosStateFeature } from "@/lib/spatial";
import { getPersistedSpatialContext } from "@/lib/spatial/derived";
import { getOsmWaterways } from "@/lib/spatial/osm";
import type {
  ClusterMode,
  InterventionType,
} from "@/lib/spatial/service-areas";
import { analyzeSharedServiceAreasCached } from "@/lib/spatial/service-area-cache";
import { timed } from "@/lib/perf";
import { priorityTakeaway } from "@/lib/takeaways";
import type { DashboardSearchParams } from "@/lib/domain";
import { AlertTriangle, Layers, ShieldAlert, Target } from "lucide-react";

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const allowedType = (value: string | undefined): InterventionType =>
  (["health", "water", "emergency", "solar", "jetty"] as const).includes(
    value as InterventionType,
  )
    ? (value as InterventionType)
    : "health";
const allowedNumber = (
  value: string | undefined,
  choices: number[],
  fallback: number,
) => (choices.includes(Number(value)) ? Number(value) : fallback);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [rows, params] = await Promise.all([getCommunities(), searchParams]);
  const sharedMode = one(params.view) === "areas";
  const intervention = allowedType(one(params.type));
  const clusterMode: ClusterMode =
    one(params.clusterMode) === "nearby" ? "nearby" : "priority";
  const clusterDistanceKm = allowedNumber(
    one(params.clusterDistance),
    [3, 5, 7.5, 10],
    5,
  );
  const serviceRadiusKm = allowedNumber(one(params.radius), [3, 5, 7.5, 10], 5);
  const facilityCount = allowedNumber(one(params.facilities), [1, 2, 3], 1);

  const state = getLagosStateFeature();
  const [persisted, waterways] = sharedMode
    ? await Promise.all([getPersistedSpatialContext(), getOsmWaterways()])
    : [null, null];
  const analysis =
    sharedMode && persisted && waterways && state
      ? await timed("analyzeSharedServiceAreas", () =>
          analyzeSharedServiceAreasCached(
            rows,
            persisted.communities.map((item) => ({
              communityId: item.community_id,
              healthDistanceKm: item.distance_km,
              marineDistanceKm: item.marine_access_distance_km,
              waterwayDistanceKm: item.waterway_distance_km,
            })),
            {
              state: state.geometry,
              waterways: waterways.features,
              landWaterwayBufferKm: 0.05,
              shorelineToleranceKm: 0.25,
            },
            {
              intervention,
              clusterMode,
              clusterDistanceKm,
              serviceRadiusKm,
              facilityCount,
            },
          ),
        )
      : null;

  const critical = rows.filter((c) => c.needScore >= 5).length;
  const high = rows.filter((c) => c.needScore >= 3 && c.needScore < 5).length;
  const urgent = rows.filter((c) => c.critical).length;

  return (
    <>
      <PageHeader
        eyebrow="Priorities"
        title="Priorities"
        description="See which communities face the greatest combination of needs, and explore where shared facilities could serve several settlements."
      />

      <nav className="mode-tabs" aria-label="Priorities view">
        <a
          className={!sharedMode ? "active" : ""}
          aria-current={!sharedMode ? "page" : undefined}
          href="/priorities"
        >
          Community priorities
        </a>
        <a
          className={sharedMode ? "active" : ""}
          aria-current={sharedMode ? "page" : undefined}
          href="/priorities?view=areas&type=health"
        >
          Shared service areas
        </a>
      </nav>

      {sharedMode && analysis && waterways ? (
        <>
          <PageGuide
            shows="Groups of nearby communities with similar service gaps, and where a single facility could sit to serve several of them at once."
            read="Each group is a set of communities close enough together to share something. The amber marker is the tested location; the shaded ring is how far it reaches in a straight line. The figures count communities and people inside that ring, without double-counting."
            look={[
              "Groups where one location covers several communities",
              "Groups split by open water, where one facility will not work",
              "How the numbers move when you widen the reach",
            ]}
            method="Communities are grouped by how close they are and how similar their shortfalls are. Candidate locations are screened to sit on land, away from mapped open water. Reach is a straight-line distance, never a travel time."
          />
          <SharedServiceAreas
            areas={analysis.areas.map((area) => ({
              id: area.id,
              communities: area.communities,
              lgas: area.lgas,
              waterSeparated: area.waterSeparated,
              candidate: area.candidate,
            }))}
            administrative={getAdministrativeLayer()}
            intervention={intervention}
            clusterMode={clusterMode}
            clusterDistanceKm={clusterDistanceKm}
            serviceRadiusKm={serviceRadiusKm}
            facilityCount={facilityCount}
            targetCommunityCount={analysis.targetCommunityCount}
            selectedFacilityCount={analysis.selectedCandidates.length}
            uniquePopulation={analysis.uniquePopulation}
            uniqueCommunityCount={analysis.uniqueCommunityIds.length}
          />
        </>
      ) : (
        <>
          <PageGuide
            shows="Which communities face the greatest combination of recorded needs, and how that ranking changes when different things are treated as more important."
            read="The need score counts how many of ten recorded hardship conditions a community reported. The weighted ranking on the right lets you change how much each factor counts and watch the order change."
            look={[
              "Communities scoring 5 or more out of 10",
              "How the ranking shifts when emergency access is weighted higher",
              "Communities that cannot be ranked because too little was recorded",
            ]}
            method="The need score is a plain count of ten recorded conditions, each worth one point. The weighted ranking rebalances across whatever was actually recorded for each community — a missing answer is never treated as a zero."
          />

          <div className="grid kpi-grid">
            <Kpi
              label="Highest combined need"
              value={critical}
              note="Recorded 5 or more of the ten conditions"
              tone="critical"
              icon={<AlertTriangle aria-hidden="true" />}
              metric="criticalNeed"
              tinted
            />
            <Kpi
              label="Substantial need"
              value={high}
              note="Recorded 3 or 4 of the ten conditions"
              tone="warning"
              icon={<Target aria-hidden="true" />}
              metric="needScore"
            />
            <Kpi
              label="Needs urgent attention"
              value={urgent}
              note="Meets at least one hard-stop condition"
              tone="survey"
              icon={<ShieldAlert aria-hidden="true" />}
              metric="criticalAlert"
            />
            <Kpi
              label="Nothing recorded yet"
              value={rows.filter((c) => c.needScore === 0).length}
              note="No condition scored — not the same as no problem"
              tone="neutral"
              metric="completeness"
            />
            <Kpi
              label="Conditions counted"
              value="10"
              note="One point each, equally weighted"
              tone="neutral"
              metric="needScore"
            />
            <Kpi
              label="Shared service areas"
              value="Explore"
              note="Test where one facility could serve several communities"
              tone="water"
              icon={<Layers aria-hidden="true" />}
              href="/priorities?view=areas&type=health"
              action="Open shared areas"
              metric="sharedServiceAreas"
            />
          </div>

          <TakeawayRow>
            <KeyTakeaway>
              {priorityTakeaway(rows) ??
                "No community currently records five or more of the ten conditions."}
            </KeyTakeaway>
            <WhatToLookAt
              items={[
                "Communities scoring 5 or more out of 10",
                "How the order changes when you move a slider",
                "Communities with too little recorded to rank at all",
              ]}
            />
          </TakeawayRow>

          <div className="callout section-gap">
            <strong>How the need score works.</strong> Ten conditions are
            checked for each community and every one present adds a point: deep
            poverty, no emergency way out, a sanitation gap, no reliable power,
            no connectivity, no emergency plan, erosion displacing households,
            flooding rated 4 or 5, heavy produce loss, and sitting more than 5
            km from the nearest neighbour. Five or more means highest combined
            need. That is a planning band — it is separate from the
            urgent-attention rule used elsewhere in the platform.
          </div>

          <div className="section-gap">
            <PriorityModel communities={rows} />
          </div>
        </>
      )}
    </>
  );
}
