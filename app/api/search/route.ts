import { getCommunities } from "@/lib/data";
import { NextResponse } from "next/server";

/**
 * Small index for the global search palette. Deliberately separate from the
 * full community payload so opening search never pulls the whole register into
 * the browser — this is ~10 KB for the entire survey.
 */
export async function GET() {
  try {
    const rows = await getCommunities();
    return NextResponse.json(
      {
        communities: rows.map((community) => ({
          slug: community.slug,
          name: community.name,
          lga: community.lga,
          district: community.district,
          population: community.population,
          needScore: community.needScore,
          mapped: community.hasLocation,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Search is unavailable." }, { status: 503 });
  }
}
