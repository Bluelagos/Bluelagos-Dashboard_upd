"use client";

import type { Community } from "@/lib/domain";
import type { BrandLogo } from "@/lib/brand";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, NotebookPen, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { CommunityMap } from "./community-map";
import { BrandMark } from "./app-shell";
import { aggregateKnown, formatNumber, groupCount } from "@/lib/analytics";

interface Figure {
  value: string;
  label: string;
}

interface Scene {
  /** Section name shown above the headline and in the progress bar. */
  section: string;
  /** The one thing this slide says. */
  headline: string;
  /** One short paragraph — never a wall of text. */
  message: string;
  /** What we are seeing — one sentence. */
  seeing: string;
  /** Why it matters — one sentence. */
  matters: string;
  /** Either a filtered map or a pair of large figures. */
  visual: { kind: "map"; communities: Community[]; boundaries?: boolean } | { kind: "figures"; figures: Figure[] };
  stat?: Figure;
  notes: { say: string; ifAsked: Array<[string, string]> };
  /** Where to go for the full page. */
  deepLink?: { href: string; label: string };
}

function buildScenes(rows: Community[]): Scene[] {
  const mapped = rows.filter((c) => c.hasLocation);
  const population = aggregateKnown(rows, "population");
  const urgent = rows.filter((c) => c.critical);
  const stranded = rows.filter((c) => c.strandingStatus === "HIGHLY_STRANDED");
  const sanitation = rows.filter((c) => c.sanitationDeficit === true);
  const both = rows.filter(
    (c) => c.sanitationDeficit === true && c.strandingStatus === "HIGHLY_STRANDED",
  );
  const flood = rows.filter((c) => c.floodHazard !== null && c.floodHazard >= 4);
  const erosion = rows.filter((c) => c.erosionRisk === "CRITICAL_DISPLACEMENT");
  const isolated = rows.filter((c) => c.nearestCommunityKm !== null && c.nearestCommunityKm > 5);
  const highestNeed = [...rows].sort((a, b) => b.needScore - a.needScore);
  const criticalNeed = rows.filter((c) => c.needScore >= 5);
  const lgas = Object.entries(groupCount(rows, "lga")).sort((a, b) => b[1] - a[1]);
  const needs = Object.entries(groupCount(rows, "needCategory")).sort((a, b) => b[1] - a[1]);
  const topNeed = needs[0];

  return [
    {
      section: "The coverage",
      headline: "Every riverine community, on one map",
      message:
        "The Blue Lagos survey visited riverine and coastal settlements across Lagos State and recorded conditions community by community, rather than as a single figure for each local government.",
      seeing: `Each dot is one of ${rows.length} surveyed communities.`,
      matters: "Averages hide the settlements that are worst off. Community-level data does not.",
      visual: { kind: "map", communities: mapped },
      stat: { value: formatNumber(rows.length), label: "communities surveyed" },
      notes: {
        say: "These dots are the communities covered by the Blue Lagos survey. Instead of reporting totals by local government, we can see conditions at community level and compare them across the state. Every figure you will see in the next few minutes describes these settlements.",
        ifAsked: [
          [
            "How were they selected?",
            "They are riverine and coastal settlements identified during the field survey. It is a survey of these communities, not a census of Lagos.",
          ],
          [
            "Are all of them on the map?",
            `${mapped.length} of ${rows.length} have usable coordinates. The rest stay in every count and in the register — they are simply not plotted.`,
          ],
        ],
      },
      deepLink: { href: "/explorer", label: "Open the full map" },
    },
    {
      section: "The people",
      headline: `${formatNumber(population.value)} people represented`,
      message:
        "Adding up what each community estimated for itself gives the size of the population this evidence describes. Communities that did not give an estimate are left out of the total rather than counted as zero.",
      seeing: "The population and coverage behind everything that follows.",
      matters: "It turns a list of settlements into a sense of scale for decisions.",
      visual: {
        kind: "figures",
        figures: [
          { value: formatNumber(population.value), label: "people represented" },
          { value: formatNumber(rows.length), label: "communities surveyed" },
          { value: String(lgas.length), label: "local governments covered" },
          {
            value: `${population.knownCount}/${rows.length}`,
            label: "communities that gave a population estimate",
          },
        ],
      },
      notes: {
        say: `These communities represent about ${formatNumber(population.value)} people across ${lgas.length} local governments. That number is the sum of what the communities themselves estimated. Where a community could not give a figure, we leave it out rather than guessing — so this is a floor, not a ceiling.`,
        ifAsked: [
          [
            "Is this a census figure?",
            "No. These are field estimates collected during the survey. No modelled population layer such as WorldPop is mixed in.",
          ],
          [
            "Why not fill the gaps?",
            `${population.unknownCount} communities have no estimate. Substituting a modelled value would make the total look more precise than the evidence allows.`,
          ],
        ],
      },
      deepLink: { href: "/demographics", label: "Open the people page" },
    },
    {
      section: "Where they are",
      headline: `Spread across ${lgas.length} local governments`,
      message: `${lgas[0]?.[0]} holds the largest group with ${lgas[0]?.[1]} communities. The settlements follow the lagoon and creek system rather than the road network, which is exactly why they are hard to reach.`,
      seeing: "The same communities, now inside local government boundaries.",
      matters: "Planning and budgets are organised by local government, so the data has to line up with them.",
      visual: { kind: "map", communities: mapped, boundaries: true },
      stat: { value: String(lgas[0]?.[1] ?? 0), label: `communities in ${lgas[0]?.[0] ?? "the largest LGA"}` },
      notes: {
        say: `The communities cluster where the water is, not where the roads are. ${lgas[0]?.[0]} has the largest concentration. Putting them inside local government boundaries means this evidence can go straight into an existing planning process rather than sitting beside it.`,
        ifAsked: [
          [
            "Where do the boundaries come from?",
            "GRID3 2022 via geoBoundaries. They are used as planning geography, not as legal or cadastral boundaries.",
          ],
          [
            "Some points sit outside a boundary — why?",
            "Coastal and lagoon settlements can fall just outside a simplified land polygon. We report that rather than moving the point.",
          ],
        ],
      },
      deepLink: { href: "/explorer", label: "Open the full map" },
    },
    {
      section: "What communities asked for",
      headline: topNeed ? `${topNeed[0]} came first` : "What communities asked for",
      message:
        "Each community was asked what it most needed. Their answers are kept exactly as given — this is the communities speaking, not our classification of them.",
      seeing: "How the stated priorities break down across the survey.",
      matters: "It anchors the analysis in what people actually asked for.",
      visual: {
        kind: "figures",
        figures: needs.slice(0, 4).map(([label, count]) => ({
          value: String(count),
          label: `communities named ${label.toLowerCase()}`,
        })),
      },
      notes: {
        say: `We asked every community what it most needed. ${topNeed?.[0]} came back most often, from ${topNeed?.[1]} communities. That matters because the rest of this briefing is about testing whether the measured conditions line up with what people told us — and largely, they do.`,
        ifAsked: [
          [
            "Is this a ranking?",
            "No. It is a count of stated priorities. It is deliberately kept separate from the calculated need score you will see shortly.",
          ],
        ],
      },
      deepLink: { href: "/communities", label: "Browse the communities" },
    },
    {
      section: "Health & water",
      headline: `${both.length} communities carry both problems at once`,
      message: `${sanitation.length} communities reported a sanitation gap and ${stranded.length} reported no motorised way to move someone out in a medical emergency. ${both.length} reported both.`,
      seeing: "The communities where a sanitation gap and no emergency way out land together.",
      matters: "A health problem and no way to reach care is a different order of risk from either alone.",
      visual: { kind: "map", communities: both.filter((c) => c.hasLocation) },
      stat: { value: String(both.length), label: "communities with both problems" },
      notes: {
        say: `This is where two problems meet. A sanitation gap raises the chance of waterborne illness. No motorised way out means that when someone gets seriously ill, they cannot reach care. ${both.length} communities reported both at the same time. Those are the places where a single intervention changes the most.`,
        ifAsked: [
          [
            "Are these disease cases?",
            "No. These are observed conditions from the field survey. We do not have case data and we do not imply one causes the other.",
          ],
          [
            "How is distance to a facility measured?",
            "Straight-line distance to the nearest health facility mapped in OpenStreetMap. It is not a travel time, and open-map coverage is uneven.",
          ],
        ],
      },
      deepLink: { href: "/health", label: "Open Health & Water" },
    },
    {
      section: "Access",
      headline: `${stranded.length} communities have no way out in an emergency`,
      message: `A further ${isolated.length} sit more than five kilometres from their nearest neighbouring community. On water, distance and isolation compound each other.`,
      seeing: "Communities with no recorded motorised emergency evacuation.",
      matters: "Access decides whether any other service can actually be used.",
      visual: { kind: "map", communities: stranded.filter((c) => c.hasLocation) },
      stat: { value: String(stranded.length), label: "with no emergency way out" },
      notes: {
        say: `Access is the constraint underneath everything else. ${stranded.length} communities recorded no motorised way to move a medical emergency out. ${isolated.length} are more than five kilometres from the nearest other surveyed community, which also makes them hard to serve from a shared facility. Everything we show here is straight-line distance — we are deliberately not claiming travel times we cannot verify.`,
        ifAsked: [
          [
            "Why not show travel time?",
            "We would need a verified navigable-water network. The mapped waterways carry no navigability information, so publishing journey times would be a guess dressed up as analysis.",
          ],
          ["Is there a jetty register?", "Not an official one. We show landing points mapped by OpenStreetMap contributors and label them as such."],
        ],
      },
      deepLink: { href: "/accessibility", label: "Open Access" },
    },
    {
      section: "Environment",
      headline: `${flood.length} communities already live with serious flooding`,
      message: `${erosion.length} reported erosion severe enough to displace households. These are conditions communities are living with now, not projections.`,
      seeing: "Communities that rated flooding at the top of the scale or reported displacing erosion.",
      matters: "It separates what is already happening from what might happen later.",
      visual: {
        kind: "map",
        communities: [...flood, ...erosion.filter((c) => !flood.includes(c))].filter((c) => c.hasLocation),
      },
      stat: { value: String(flood.length), label: "with the highest flood rating" },
      notes: {
        say: `${flood.length} communities rated their flood hazard at four or five out of five, and ${erosion.length} said erosion is already displacing households. I want to be clear about what this is: it is what communities reported, not a satellite flood model. We have deliberately not published a modelled flood layer because we have not processed and reviewed one.`,
        ifAsked: [
          [
            "Why no satellite flood mapping?",
            "No satellite water or land-cover product has passed processing and review yet. The Environment page lists exactly what is missing rather than hiding it.",
          ],
          ["Is this a climate projection?", "No. It is present-day field observation."],
        ],
      },
      deepLink: { href: "/climate", label: "Open Environment" },
    },
    {
      section: "Priority communities",
      headline: `${criticalNeed.length} communities carry five or more problems at once`,
      message:
        "Ten hardship conditions are checked for every community, each worth one point. It is a simple, transparent count — anyone can see exactly why a community ranks where it does.",
      seeing: "The communities with the highest combined count of recorded conditions.",
      matters: "It turns a long list into a short one, without hiding the reasoning.",
      visual: { kind: "map", communities: highestNeed.filter((c) => c.hasLocation && c.needScore >= 5) },
      stat: {
        value: highestNeed[0] ? `${highestNeed[0].needScore}/10` : "—",
        label: highestNeed[0] ? `highest score — ${highestNeed[0].name}` : "highest score",
      },
      notes: {
        say: `We check ten conditions for every community — poverty, emergency access, sanitation, power, connectivity, emergency planning, erosion, flooding, produce loss and isolation. Each one present adds a point. ${criticalNeed.length} communities scored five or more. The reason I like this method for a first pass is that it is completely explainable: you can ask why any community ranks where it does and get a list, not a black box.`,
        ifAsked: [
          [
            "Are the conditions weighted?",
            "Not in this score — all ten count equally. The Priorities page has a second, weighted view where you can change what matters and watch the order change.",
          ],
          [
            "What about missing data?",
            "A missing answer never adds a point and never counts as a zero. Completeness is shown next to every community.",
          ],
        ],
      },
      deepLink: { href: "/priorities", label: "Open Priorities" },
    },
    {
      section: "Shared service areas",
      headline: "One facility could serve several communities",
      message:
        "Communities that sit close together and share the same shortfall can be grouped, and a location tested to see how many of them one facility would reach.",
      seeing: "Where nearby communities with similar gaps cluster together.",
      matters: "It moves planning from one facility per village to what a single investment could cover.",
      visual: { kind: "map", communities: criticalNeed.filter((c) => c.hasLocation), boundaries: true },
      stat: { value: String(criticalNeed.length), label: "communities in the grouping pool" },
      notes: {
        say: "This is where the spatial work starts paying off. Instead of asking where to put a clinic for one village, we group communities that are close together and share the same gap, then test a point on land that would sit within reach of as many of them as possible. The system counts the communities and the people inside that reach, without double-counting anyone.",
        ifAsked: [
          [
            "How are they grouped?",
            "By how close they are and how similar their shortfalls are, with a grouping distance you can change on the page.",
          ],
          [
            "Does it account for water in between?",
            "It screens candidate points to sit on land and flags groups split by open water. It does not claim a boat route exists, because we have no verified navigable network.",
          ],
        ],
      },
      deepLink: { href: "/priorities?view=areas&type=health", label: "Open shared service areas" },
    },
    {
      section: "Testing a decision",
      headline: "Put a facility anywhere and see who it reaches",
      message:
        "Choose a location and a distance, and the platform counts the communities and people that fall inside it — immediately, in front of you.",
      seeing: "The step from analysis to a decision you can interrogate live.",
      matters: "A question asked in a meeting can be answered in the meeting.",
      visual: {
        kind: "figures",
        figures: [
          { value: "Any point", label: "place it anywhere on the map" },
          { value: "1–20 km", label: "set how far it should reach" },
          { value: "Live", label: "communities and people update as you move it" },
          { value: "On land", label: "the point is checked against water and the state boundary" },
        ],
      },
      notes: {
        say: "This is the part I would encourage you to test. Put a point anywhere on the map, set how far it should reach, and it tells you how many communities and how many people fall inside — straight away. If someone in this room says “what about here instead?”, we can answer it now rather than next month.",
        ifAsked: [
          [
            "Is that a service area?",
            "It is a straight-line reach, not a travel-time catchment. We label it that way everywhere, deliberately.",
          ],
          ["Does it save anything?", "No. It is a test, not a record. Nothing is written back."],
        ],
      },
      deepLink: { href: "/scenarios", label: "Open Scenarios" },
    },
    {
      section: "What this can do next",
      headline: "Evidence that stands up to questions",
      message:
        "Every number on this platform traces back to a source, missing data stays visible as missing, and anything the platform calculates is labelled as calculated. That is what makes it usable in a decision.",
      seeing: "How the platform holds itself to account.",
      matters: "Evidence only helps if it survives scrutiny.",
      visual: {
        kind: "figures",
        figures: [
          { value: formatNumber(rows.length), label: "communities, each traceable to a survey record" },
          { value: String(urgent.length), label: "flagged for urgent attention by a published rule" },
          { value: "Never zero", label: "missing values are shown as missing" },
          { value: "Labelled", label: "field, open-map and calculated figures are kept apart" },
        ],
      },
      notes: {
        say: "I want to close on credibility rather than features. Every figure here traces back to a survey record, an open-map feature, or a calculation we have written down. Where we do not have something — satellite flood mapping, verified boat routes, an official facility register — we say so on the page instead of filling the gap. That is what makes this usable when someone challenges a number.",
        ifAsked: [
          [
            "What would you add next?",
            "A verified navigable-water network would be the single biggest unlock — it turns straight-line distance into real travel time.",
          ],
          [
            "How current is the data?",
            "The community register is queried live. The Data Quality page shows exactly what the platform can reach and when it last did.",
          ],
        ],
      },
      deepLink: { href: "/data-quality", label: "Open Data Quality" },
    },
  ];
}

export function Briefing({ rows, logo = null }: { rows: Community[]; logo?: BrandLogo | null }) {
  const [step, setStep] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const router = useRouter();
  const scenes = buildScenes(rows);
  const scene = scenes[step];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button, a, input, select, textarea, [contenteditable=true]")
      )
        return;
      if (event.key === "ArrowRight" || event.key === "PageDown")
        setStep((value) => Math.min(scenes.length - 1, value + 1));
      if (event.key === "ArrowLeft" || event.key === "PageUp")
        setStep((value) => Math.max(0, value - 1));
      if (event.key.toLowerCase() === "n") setNotesOpen((value) => !value);
      if (event.key === "Escape") router.push("/");
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, [router, scenes.length]);

  return (
    <div className="briefing">
      <header>
        <div className="brand">
          <BrandMark logo={logo} />
          <div className="brand-copy">
            <strong>Blue Lagos</strong>
            <span>Briefing</span>
          </div>
        </div>
        <div className="brief-count">
          {step + 1} / {scenes.length}
        </div>
        <button
          className="icon-btn"
          aria-label={notesOpen ? "Hide presenter notes" : "Show presenter notes"}
          aria-pressed={notesOpen}
          title="Presenter notes (N)"
          onClick={() => setNotesOpen((value) => !value)}
        >
          <NotebookPen aria-hidden="true" />
        </button>
        <Link href="/" className="icon-btn" aria-label="Exit the briefing">
          <X aria-hidden="true" />
        </Link>
      </header>

      <main>
        <div className="brief-copy">
          <div className="eyebrow">{scene.section}</div>
          <h1 aria-live="polite">{scene.headline}</h1>
          <p>{scene.message}</p>
          <div className="brief-lines">
            <div>
              <h2>What we are seeing</h2>
              <p>{scene.seeing}</p>
            </div>
            <div>
              <h2>Why it matters</h2>
              <p>{scene.matters}</p>
            </div>
          </div>
          {scene.stat && (
            <div className="brief-stat">
              <strong>{scene.stat.value}</strong>
              <span>{scene.stat.label}</span>
            </div>
          )}
        </div>

        <section className="brief-visual">
          {scene.visual.kind === "map" ? (
            <div className="brief-map" style={{ border: 0 }}>
              <CommunityMap
                key={`scene-${step}`}
                communities={scene.visual.communities}
                height={600}
                administrative={undefined}
              />
            </div>
          ) : (
            <div className="brief-figures">
              {scene.visual.figures.map((figure) => (
                <div key={figure.label}>
                  <strong>{figure.value}</strong>
                  <span>{figure.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {notesOpen && (
        <aside className="presenter-notes" aria-label="Presenter notes">
          <header>
            <strong>Presenter notes</strong>
            <button className="icon-btn" onClick={() => setNotesOpen(false)} aria-label="Hide presenter notes">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="presenter-notes-body">
            <h3>Say this</h3>
            <p>{scene.notes.say}</p>
            <h3>If asked</h3>
            <dl>
              {scene.notes.ifAsked.map(([question, answer]) => (
                <div key={question}>
                  <dt>{question}</dt>
                  <dd>{answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      )}

      <footer>
        <div className="brief-progress" role="tablist" aria-label="Briefing sections">
          {scenes.map((item, index) => (
            <button
              key={item.section}
              aria-label={`${index + 1}. ${item.section}`}
              aria-current={index === step ? "step" : undefined}
              className={index === step ? "active" : ""}
              onClick={() => setStep(index)}
            />
          ))}
        </div>
        <div className="brief-nav">
          {scene.deepLink && (
            <Link className="btn ghost" href={scene.deepLink.href}>
              {scene.deepLink.label}
            </Link>
          )}
          <button className="btn secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft aria-hidden="true" /> Previous
          </button>
          <button
            className="btn"
            disabled={step === scenes.length - 1}
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}
