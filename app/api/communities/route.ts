import { getCommunities } from "@/lib/data";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    const rows = await getCommunities();
    return NextResponse.json(
      {
        type: "FeatureCollection",
        features: rows
          .filter((c) => c.hasLocation)
          .map((c) => ({
            type: "Feature",
            id: c.id,
            geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
            properties: {
              id: c.id,
              slug: c.slug,
              name: c.name,
              lga: c.lga,
              district: c.district,
              criticalAlert: c.critical,
              needScore: c.needScore,
              needCategory: c.needCategory,
            },
          })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Community spatial data is unavailable." },
      { status: 503 },
    );
  }
}
