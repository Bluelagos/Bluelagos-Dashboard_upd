import { ScenarioLab } from "@/components/scenario-lab";
import { PageGuide, PageHeader } from "@/components/ui";
import { getCommunities } from "@/lib/data";
import { getAdministrativeLayer } from "@/lib/spatial";
import { getPersistedSpatialContext } from "@/lib/spatial/derived";
import type { DashboardSearchParams } from "@/lib/domain";
import type { InterventionType } from "@/lib/spatial/service-areas";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const numberInRange = (value: string | undefined, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [rows, params, spatial] = await Promise.all([
    getCommunities(),
    searchParams,
    getPersistedSpatialContext(),
  ]);
  const lat = numberInRange(one(params.lat), -90, 90);
  const lng = numberInRange(one(params.lng), -180, 180);
  const radius = numberInRange(one(params.radius), 1, 20) ?? 5;
  const types: InterventionType[] = ["health", "water", "emergency", "solar", "jetty"];
  const type = types.includes(one(params.type) as InterventionType)
    ? (one(params.type) as InterventionType)
    : "health";
  const communityIds = (one(params.communities) ?? "")
    .split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && rows.some((row) => row.id === id));

  return (
    <>
      <PageHeader
        eyebrow="Scenarios"
        title="Scenarios"
        description="Test a possible facility location and see which communities and people fall within its planning catchment."
      />
      <PageGuide
        shows="What a facility placed at a particular point would reach — how many communities, how many people, and which of them are under the most pressure."
        read="Choose what you are placing, put a point on the map, and set how far it should reach. Everything on the right updates as you move it. The shaded ring is a straight-line distance, not a travel time."
        look={[
          "How many communities come into reach as you widen the distance",
          "Whether the point sits on land and inside Lagos State",
          "Which communities stay outside reach no matter where the point goes",
        ]}
        method="Communities inside the distance are counted directly from their survey coordinates, and their population estimates are added together with each community counted once. Nothing is saved."
      />
      <ScenarioLab
        communities={rows}
        initial={{
          coordinate: lat !== null && lng !== null ? [lng, lat] : null,
          type,
          radius,
          clusterId: (one(params.cluster) ?? "").slice(0, 80),
          communityIds,
        }}
        administrative={getAdministrativeLayer()}
        spatialMetrics={spatial.communities.map((item) => ({
          communityId: item.community_id,
          healthDistanceKm: item.distance_km,
        }))}
      />
    </>
  );
}
