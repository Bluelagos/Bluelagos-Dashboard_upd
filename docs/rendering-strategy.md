# Rendering strategy

Routes that consume `getCommunityDataset()` or `getCommunities()` call Next.js `connection()` at the shared data boundary. They are runtime-rendered on every request and query the complete Supabase register. React `cache()` only deduplicates repeated reads during that server request.

## Dynamic live routes

`/`, `/accessibility`, `/briefing`, `/climate`, `/communities`, `/communities/[slug]`, `/data`, `/data-quality`, `/demographics`, `/economy`, `/explorer`, `/health`, `/infrastructure`, `/priorities`, `/scenarios`, `/sdgs`, and `/api/communities`.

The GeoJSON API uses `Cache-Control: no-store`. Supabase updates can therefore appear on the next request without a deployment.

## Revalidated routes

None. No current operational dataset has an approved staleness interval.

## Static reference routes

`/methodology` and framework routes such as `/_not-found`. Methodology definitions are versioned source content and do not query Supabase.
