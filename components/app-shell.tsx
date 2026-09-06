"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  ChevronRight,
  CircleGauge,
  CloudRain,
  Database,
  FlaskConical,
  HeartPulse,
  LandPlot,
  Map,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  ShieldCheck,
  Target,
  Users,
  Waves,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./theme";
import { GlobalSearch } from "./search";
import type { BrandLogo } from "@/lib/brand";

const groups: { label: string; items: [string, string, LucideIcon][] }[] = [
  {
    label: "Main",
    items: [
      ["/", "Overview", CircleGauge],
      ["/explorer", "Community map", Map],
      ["/communities", "Communities", Users],
      ["/briefing", "Briefing", Presentation],
    ],
  },
  {
    label: "Themes",
    items: [
      ["/health", "Health & Water", HeartPulse],
      ["/accessibility", "Access", Network],
      ["/climate", "Environment", CloudRain],
      ["/infrastructure", "Infrastructure", Building2],
      ["/economy", "Livelihoods", BarChart3],
      ["/demographics", "People", LandPlot],
    ],
  },
  {
    label: "Planning",
    items: [
      ["/priorities", "Priorities", Target],
      ["/scenarios", "Scenarios", FlaskConical],
      ["/sdgs", "SDGs", Waves],
    ],
  },
  {
    label: "Reference",
    items: [
      ["/data", "Data", Database],
      ["/data-quality", "Data Quality", ShieldCheck],
      ["/methodology", "Methodology", BookOpen],
    ],
  },
];

const allItems = groups.flatMap((group) => group.items);

export function BrandMark({ logo, size = 24 }: { logo: BrandLogo | null; size?: number }) {
  return (
    <div className={`brand-mark${logo ? " has-logo" : ""}`}>
      {logo ? (
        // The official brand asset is a small static file in /public and may be
        // an SVG, which next/image will not optimise without allowing raw SVG.
        // A plain img is the correct element for a 36px mark.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo.src} alt="" width={36} height={36} />
      ) : (
        <Waves size={size} aria-hidden="true" />
      )}
    </div>
  );
}

export function AppShell({ children, logo = null }: { children: React.ReactNode; logo?: BrandLogo | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // The briefing is a full-screen presentation route: no chrome.
  if (pathname === "/briefing") return <>{children}</>;

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));
  const current = allItems.find(([href]) => href === pathname)?.[1];

  return (
    <div className={`app-shell ${collapsed ? "nav-collapsed" : ""}`}>
      <aside className={`sidebar ${open ? "mobile-open" : ""}`}>
        <div className="brand">
          <BrandMark logo={logo} />
          <div className="brand-copy">
            <strong>Blue Lagos</strong>
            <span>Riverine communities</span>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Main">
          {groups.map((group) => (
            <section className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([href, label, Icon]) => (
                <Link
                  className={isActive(href) ? "active" : ""}
                  aria-current={isActive(href) ? "page" : undefined}
                  href={href}
                  key={href}
                  onClick={() => setOpen(false)}
                  title={collapsed ? label : undefined}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight className="nav-arrow" aria-hidden="true" />
                </Link>
              ))}
            </section>
          ))}
        </nav>
        <div className="nav-footer">
          Blue Lagos community survey
          <small>Lagos State riverine settlements</small>
        </div>
      </aside>

      {open && <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="Close navigation" />}

      <div className="workspace">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu aria-hidden="true" />
          </button>
          <button
            className="icon-btn desktop-only"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
          <div className="crumb">
            <span>Lagos State</span>
            <ChevronRight aria-hidden="true" />
            <strong>{current || "Blue Lagos"}</strong>
          </div>
          <div className="topbar-right">
            <GlobalSearch />
            <ThemeToggle />
            <span className="source-pill desktop-only">Blue Lagos survey</span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
