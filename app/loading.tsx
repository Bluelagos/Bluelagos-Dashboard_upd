import { KpiSkeleton, Skeleton } from "@/components/ui";

/**
 * Restrained skeleton rather than a spinner: the page shell is already on
 * screen, so this only stands in for the parts still arriving.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <span className="sr-only">Loading Blue Lagos community data.</span>
      <div style={{ marginBottom: 18 }}>
        <Skeleton className="skeleton-line" style={{ width: 120, height: 10 }} />
        <Skeleton className="skeleton-line" style={{ width: 260, height: 26, marginTop: 12 }} />
        <Skeleton className="skeleton-line" style={{ width: "min(620px, 90%)", height: 12 }} />
      </div>
      <KpiSkeleton />
      <div className="grid overview-main section-gap">
        <Skeleton className="skeleton-map" style={{ height: 500 }} />
        <Skeleton className="skeleton-map" style={{ height: 500 }} />
      </div>
    </div>
  );
}
