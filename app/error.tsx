"use client";

import { RotateCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel empty">
      <strong>We couldn&apos;t load this information</strong>
      <p>
        Nothing has been filled in with placeholder values. Check the connection and try again — if
        it keeps happening, the Data Quality page shows what the platform can currently reach.
      </p>
      <button className="btn" onClick={reset}>
        <RotateCw aria-hidden="true" /> Try again
      </button>
      <details>
        <summary>Technical details</summary>
        <p style={{ marginTop: 8 }}>
          {error.message || "No error message was returned."}
          {error.digest ? ` (reference ${error.digest})` : ""}
        </p>
      </details>
    </section>
  );
}
