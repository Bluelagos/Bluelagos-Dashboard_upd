import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel empty">
      <strong>We couldn&apos;t find that page</strong>
      <p>The page or community you asked for isn&apos;t part of the current dataset.</p>
      <Link className="btn secondary" href="/communities">
        Browse all communities
      </Link>
    </section>
  );
}
