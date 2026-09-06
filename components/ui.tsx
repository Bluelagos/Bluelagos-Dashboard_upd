import Link from "next/link";
import { ChevronRight, ArrowRight, BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { MetricInfo } from "./drawer";
import type { ExplainKey } from "@/lib/explain";

/* --------------------------------------------------------------------------
   Semantic tones. Components name a category — never a colour — so both
   themes and any future palette change stay consistent (§10).
   -------------------------------------------------------------------------- */
export type Tone =
  | "survey"
  | "water"
  | "people"
  | "health"
  | "environment"
  | "infrastructure"
  | "livelihoods"
  | "critical"
  | "warning"
  | "positive"
  | "neutral";

const TONE_VAR: Record<Tone, string> = {
  survey: "var(--accent-survey)",
  water: "var(--accent-water)",
  people: "var(--accent-people)",
  health: "var(--accent-health)",
  environment: "var(--accent-environment)",
  infrastructure: "var(--accent-infrastructure)",
  livelihoods: "var(--accent-livelihoods)",
  critical: "var(--critical)",
  warning: "var(--warning)",
  positive: "var(--positive)",
  neutral: "var(--text-faint)",
};

export const toneStyle = (tone: Tone = "survey") =>
  ({
    "--tone": TONE_VAR[tone],
    "--tone-wash": `color-mix(in srgb, ${TONE_VAR[tone]} 12%, transparent)`,
  }) as React.CSSProperties;

/* --------------------------------------------------------------------------
   Page header
   -------------------------------------------------------------------------- */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ?? <div className="updated">Blue Lagos community survey</div>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Page guide — "About this page", collapsed by default (§21, §74)
   -------------------------------------------------------------------------- */
export function PageGuide({
  shows,
  read,
  look,
  method,
  open = false,
}: {
  /** What question does this page answer? */
  shows: string;
  /** What does the main map or chart mean? */
  read: string;
  /** What should the presenter point at? */
  look: string[];
  /** Source and method, in plain language. */
  method?: string;
  open?: boolean;
}) {
  return (
    <details className="page-guide" open={open}>
      <summary>
        <BookOpen aria-hidden="true" />
        About this page
        <ChevronRight className="chev" aria-hidden="true" />
      </summary>
      <div className="page-guide-body">
        <section>
          <h3>What this page shows</h3>
          <p>{shows}</p>
        </section>
        <section>
          <h3>How to read it</h3>
          <p>{read}</p>
        </section>
        <section>
          <h3>What to look for</h3>
          <ul>
            {look.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        {method && (
          <section style={{ gridColumn: "1 / -1" }}>
            <h3>Where the numbers come from</h3>
            <p>{method}</p>
          </section>
        )}
      </div>
    </details>
  );
}

/* --------------------------------------------------------------------------
   Key takeaway / what to look at (§22, §23)
   Both take content already computed from the data — never generated prose.
   -------------------------------------------------------------------------- */
export function KeyTakeaway({ children }: { children: ReactNode }) {
  return (
    <div className="takeaway">
      <h2>Key takeaway</h2>
      <p>{children}</p>
    </div>
  );
}

export function WhatToLookAt({ items }: { items: ReactNode[] }) {
  return (
    <div className="takeaway look-at">
      <h2>What to look at</h2>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function TakeawayRow({ children }: { children: ReactNode }) {
  return <div className="takeaway-row">{children}</div>;
}

/* --------------------------------------------------------------------------
   Section header — gives long pages rhythm (§19)
   -------------------------------------------------------------------------- */
export function SectionHead({ title, description }: { title: string; description?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   KPI card (§11–13)
   Label, number, one short line. Clickable only when there is somewhere
   meaningful to go; an info button when the metric needs explaining.
   -------------------------------------------------------------------------- */
export interface KpiProps {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: Tone;
  icon?: ReactNode;
  /** Navigates on click; adds hover, focus and a "View details" affordance. */
  href?: string;
  /** Label for the navigation affordance. */
  action?: string;
  /** Opens the plain-English explanation drawer. */
  metric?: ExplainKey;
  tinted?: boolean;
}

export function Kpi({
  label,
  value,
  note,
  tone = "survey",
  icon,
  href,
  action = "View details",
  metric,
  tinted = false,
}: KpiProps) {
  const body = (
    <>
      <div className="kpi-label">
        {icon && <span className="kpi-chip">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {note && <div className="kpi-note">{note}</div>}
      {href && (
        <span className="kpi-go">
          {action} <ArrowRight aria-hidden="true" />
        </span>
      )}
    </>
  );
  const className = `kpi${tinted ? " kpi-tinted" : ""}`;
  return (
    <div className="kpi-cell">
      {href ? (
        <Link className={className} style={toneStyle(tone)} href={href}>
          {body}
        </Link>
      ) : (
        <article className={className} style={toneStyle(tone)}>
          {body}
        </article>
      )}
      {metric && <MetricInfo metric={metric} label={label} className="kpi-info" />}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export function Panel({
  title,
  subtitle,
  children,
  className = "",
  actions,
  metric,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  metric?: ExplainKey;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="panel-head">
          <div>
            <h2>
              {title}
              {metric && <> <MetricInfo metric={metric} label={title} /></>}
            </h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="panel-head-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Theme navigation cards (Overview §24)
   -------------------------------------------------------------------------- */
export function ThemeCard({
  href,
  icon,
  title,
  description,
  action = "Open",
  tone = "survey",
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  action?: string;
  tone?: Tone;
}) {
  return (
    <Link className="theme-card" href={href} style={toneStyle(tone)}>
      <span className="kpi-chip">{icon}</span>
      <strong>{title}</strong>
      <span>{description}</span>
      <em>{action} →</em>
    </Link>
  );
}

/* --------------------------------------------------------------------------
   States (§69, §70)
   -------------------------------------------------------------------------- */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{message}</p>
      {action && (
        <Link className="btn secondary" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export const Skeleton = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />
);

export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid kpi-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="skeleton-kpi" />
      ))}
    </div>
  );
}

export function MapSkeleton({ height = 500 }: { height?: number }) {
  return (
    <div className="skeleton skeleton-map" style={{ height }} role="status" aria-label="Loading map">
      <span style={{ color: "var(--text-faint)", fontSize: 12 }}>Preparing map…</span>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Values and scores
   -------------------------------------------------------------------------- */
export const Value = ({ value }: { value: string | number | null }) =>
  value === null || value === "" ? <span className="muted">Not recorded</span> : <>{value}</>;

export function NeedScore({ score }: { score: number }) {
  const band = score >= 5 ? "critical" : score >= 3 ? "high" : "normal";
  return (
    <span className="score" data-band={band} title={`${score} of 10 recorded conditions`}>
      {score}/10
    </span>
  );
}

export { MetricInfo };
