import { Briefing } from "@/components/briefing";
import { getCommunities } from "@/lib/data";
import { getBrandLogo } from "@/lib/brand";

export const metadata = { title: "Briefing" };

export default async function Page() {
  return <Briefing rows={await getCommunities()} logo={getBrandLogo()} />;
}
