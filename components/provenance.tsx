import type { SpatialProvenance } from "@/lib/spatial";

export function Provenance({ data }: { data: SpatialProvenance }) {
  return (
    <details className="provenance">
      <summary>Source and methodology</summary>
      <dl>
        <div><dt>Source</dt><dd>{data.provider}</dd></div>
        <div><dt>Date</dt><dd>{data.sourceDate}</dd></div>
        <div><dt>Resolution</dt><dd>{data.geometryType}; simplified source geometry</dd></div>
        <div><dt>CRS</dt><dd>{data.crs}</dd></div>
        <div><dt>Licence</dt><dd>{data.license}</dd></div>
        <div><dt>Last processed</dt><dd>{data.retrievedAt}</dd></div>
        <div><dt>Processing</dt><dd>{data.processing}</dd></div>
        <div><dt>Confidence / limits</dt><dd>{data.confidence}. {data.limitations}</dd></div>
      </dl>
    </details>
  );
}
