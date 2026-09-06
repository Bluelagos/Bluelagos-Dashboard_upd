"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, Info } from "lucide-react";
import Link from "next/link";
import { EXPLAIN, SOURCE_LABEL, type ExplainKey, type Explainer } from "@/lib/explain";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Side drawer used for "how is this calculated?" and card context.
 * Traps focus while open, restores it on close, and closes on Escape or scrim
 * click. Everything technical in the product lives behind one of these.
 */
export function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button className="drawer-scrim" aria-label="Close panel" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={panel}>
        <div className="drawer-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 id={headingId}>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close panel">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

/** The five-part explanation, rendered with progressive disclosure. */
export function ExplainerBody({ data }: { data: Explainer }) {
  return (
    <>
      <section>
        <h3>What this shows</h3>
        <p>{data.summary}</p>
      </section>
      <section>
        <h3>Why it matters</h3>
        <p>{data.why}</p>
      </section>
      <section>
        <h3>How it is worked out</h3>
        <p>{data.methodPlain}</p>
      </section>
      <section>
        <h3>Source</h3>
        <p>
          <span className="source-tag" data-kind={data.source}>
            {SOURCE_LABEL[data.source]}
          </span>
          {data.sourceDetail ? <><br />{data.sourceDetail}</> : null}
        </p>
      </section>
      {data.limitations && (
        <section>
          <h3>What to keep in mind</h3>
          <p>{data.limitations}</p>
        </section>
      )}
      {data.methodTechnical && (
        <details className="drawer-tech">
          <summary>Technical detail</summary>
          <p>{data.methodTechnical}</p>
        </details>
      )}
    </>
  );
}

/**
 * Small "i" button next to a label. Opens the explanation drawer.
 * Server components can render this because every prop is serialisable.
 */
export function MetricInfo({
  metric,
  label,
  className = "info-btn",
}: {
  metric: ExplainKey;
  label?: string;
  className?: string;
}) {
  const data = EXPLAIN[metric] as Explainer;
  const openRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), [setOpen]);
  return (
    <>
      <button
        ref={openRef}
        type="button"
        className={className}
        aria-label={`How is “${label ?? data.title}” calculated?`}
        title="About this metric"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Info aria-hidden="true" />
      </button>
      <Drawer
        open={open}
        onClose={close}
        eyebrow="How this is calculated"
        title={data.title}
        footer={
          data.link ? (
            <Link className="btn secondary" href={data.link.href} onClick={close}>
              {data.link.label}
            </Link>
          ) : undefined
        }
      >
        <ExplainerBody data={data} />
      </Drawer>
    </>
  );
}
