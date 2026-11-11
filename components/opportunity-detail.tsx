"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";
import Link from "@/components/workspace-link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, ChevronDown, Link2 } from "lucide-react";
import type { Opportunity } from "@/lib/demo-data";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { useDemo } from "@/components/demo-provider";
import { DemoNote, Confidence } from "@/components/shared";
import { FlagButton, FlagProvider } from "@/components/report-feedback";
import { SprintPanel, SprintStarter, useSprintActions } from "@/components/validation-sprint";
import { demoSprint, firstSteps, type Sprint } from "@/lib/sprint-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDemoContent } from "@/i18n/demo";
import { claimsBySection, dimensionLabels, scoreBand, sourceAnchor, type claimSectionOrder } from "@/lib/report-presentation";
import {
  demoOpportunityView,
  initialTab as resolveTab,
  liveOpportunityView,
  opportunityTabs,
  topClaims,
  type ViewClaim,
  type OpportunityTabId,
  type OpportunityView,
  type ViewSource,
} from "@/lib/opportunity-view";

type Copy = ReturnType<typeof useCopy>;

/** A live opportunity page: the user's own research, read from its stored payload. */
export function LiveOpportunityDetail({ opportunity, initialTab, sprint = null }: { opportunity: WorkspaceOpportunity; initialTab?: string; sprint?: Sprint | null }) {
  return <OpportunityDetail view={liveOpportunityView(opportunity)} initialTab={initialTab} sprint={sprint} />;
}

/** The demo opportunity page: the same component, fed by the fixed demo sample. */
export function DemoOpportunityDetail({ opportunity, initialTab }: { opportunity: Opportunity; initialTab?: string }) {
  const copy = useCopy();
  const content = useDemoContent();
  const view = demoOpportunityView(content.opportunity(opportunity), content.report(opportunity.id), copy);
  // One fixed example sprint (WP-10): the page's first steps and the report's first test, a few days in.
  const sprint = demoSprint(view.id, [...checklist.map((title) => copy(title)), ...(view.firstTest ? [view.firstTest] : [])], copy("Example: at least 3 of 10 owners I interview describe this problem unprompted, and 2 agree to a paid pilot."));
  return <OpportunityDetail view={view} initialTab={initialTab} sprint={sprint} />;
}

function tabLabel(copy: Copy, tab: OpportunityTabId) {
  switch (tab) {
    case "overview": return copy("Overview");
    case "evidence": return copy("Evidence");
    case "economics": return copy("Economics");
    case "validation": return copy("Validation");
  }
}
function sectionTitle(copy: Copy, section: (typeof claimSectionOrder)[number]) {
  switch (section) {
    case "buyer": return copy("Buyer");
    case "pain": return copy("Pain");
    case "demand": return copy("Demand");
    case "competition": return copy("Competition");
    case "economics": return copy("Economics");
    case "risk": return copy("Risk");
  }
}
function reliabilityLabel(copy: Copy, reliability: NonNullable<ViewSource["reliability"]>) {
  switch (reliability) {
    case "primary": return copy("Primary source");
    case "secondary": return copy("Secondary source");
    case "vendor": return copy("Vendor source");
    case "unknown": return copy("Source type unknown");
  }
}
function stanceLabel(copy: Copy, stance: NonNullable<ViewSource["stance"]>) {
  switch (stance) {
    case "supports": return copy("Supports");
    case "contradicts": return copy("Contradicts");
    case "neutral": return copy("Neutral");
  }
}

const checklist = firstSteps;

/** `sprint`: the opportunity's validation sprint (WP-10), null when it has none; leave it out to hide sprints. */
export function OpportunityDetail({ view, initialTab, sprint }: { view: OpportunityView; initialTab?: string; sprint?: Sprint | null }) {
  const copy = useCopy();
  const tabs = opportunityTabs(view);
  const [tab, setTab] = useState<OpportunityTabId>(() => resolveTab(initialTab, tabs));
  const [guideOpen, setGuideOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const guideButton = useRef<HTMLButtonElement>(null);
  const { saved, toggleSave, busy } = useDemo();
  const sourcesByKey = new Map(view.sources.map((source) => [source.key, source]));

  function select(next: OpportunityTabId, focus: "panel" | "tab" | "none" = "panel") {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      url.hash = "";
      window.history.replaceState(null, "", url);
    } catch {
      // The tab still changes when the address cannot be updated.
    }
    if (focus === "tab") document.getElementById(`opportunity-tab-${next}`)?.focus();
    if (focus === "panel") panel.current?.focus({ preventScroll: true });
  }
  /** A citation chip: show the Evidence tab, then move to the cited source card. */
  function openSource(key: string) {
    select("evidence", "none");
    requestAnimationFrame(() => {
      const card = document.getElementById(sourceAnchor(key));
      card?.scrollIntoView({ block: "start", behavior: "smooth" });
      card?.focus({ preventScroll: true });
    });
  }
  function goTo(next: OpportunityTabId) {
    select(next, "none");
    document.getElementById("opportunity-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
    panel.current?.focus({ preventScroll: true });
  }

  const band = scoreBand(view.score);
  const isSaved = saved.includes(view.id);
  return (
    <FlagProvider opportunityId={view.id} demo={view.kind === "demo"}>
      <Link href="/research/results" className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" />
        {copy("Research results")}
      </Link>
      <header className="surface flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 xl:flex-row">
          <div className="flex max-w-3xl flex-col gap-3">
            <h1 className="page-heading text-balance">{view.title}</h1>
            <p className="text-base leading-relaxed text-muted-foreground">{view.description}</p>
            <p className="text-sm text-muted-foreground">{copy("{category} · Opportunity hypothesis", { category: view.category })}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button ref={guideButton} variant="outline" onClick={() => setGuideOpen(true)}>
              <BookOpen data-icon="inline-start" />
              {copy("How to read this report")}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => toggleSave(view.id)} aria-pressed={isSaved}>
              <Bookmark className={isSaved ? "fill-primary/15 text-primary" : ""} />
              {isSaved ? copy("Saved opportunity") : copy("Save opportunity")}
            </Button>
          </div>
        </div>
        {view.kind === "demo" && (
          <div className="border-y py-4">
            <DemoNote />
          </div>
        )}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <dt className="text-sm text-muted-foreground">{copy("Likely buyer")}</dt>
            <dd className="font-medium">{view.buyer}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{copy("Research score")}</dt>
            <dd className="font-semibold tabular-nums">{view.score}/100</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{copy("Linked sources")}</dt>
            <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
              <Link2 className="size-4 text-primary" />
              {view.sources.length}
            </dd>
          </div>
        </dl>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* On phones the score panel comes first as a short summary card; on wide screens it is the sticky side panel. */}
        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6 xl:order-2">
          <section className="surface flex flex-col gap-5 p-6" aria-labelledby="score-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="score-title" className="font-semibold">{copy("Score breakdown")}</h2>
              <Badge variant="outline">{view.kind === "demo" ? copy("Demo") : copy("Evidence-driven")}</Badge>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-semibold tabular-nums tracking-tight">{view.score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
              <span className="font-medium">{copy(band.label)}</span>
            </div>
            <Confidence level={view.confidence} />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between xl:hidden"
              aria-expanded={detailsOpen}
              aria-controls="score-details"
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              {detailsOpen ? copy("Hide score details") : copy("Show score details")}
              <ChevronDown className={cn("transition-transform", detailsOpen && "rotate-180")} />
            </Button>
            <div id="score-details" className={cn("flex flex-col gap-5", !detailsOpen && "hidden xl:flex")}>
              <dl className="flex flex-col gap-4 border-t pt-5">
                {dimensionLabels.map((label, i) => (
                  <div key={label} className="flex flex-col gap-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <dt className="text-muted-foreground">{copy(label)}</dt>
                      <dd className="font-medium tabular-nums">
                        {view.scores[i]}
                        <span className="sr-only"> {copy("out of 100")}</span>
                      </dd>
                    </div>
                    <div className="progress-track" aria-hidden="true">
                      <div className="progress-fill" style={{ width: `${view.scores[i]}%` }} />
                    </div>
                  </div>
                ))}
              </dl>
              {view.breakdown && (
                <section aria-labelledby="score-steps-title" className="flex flex-col gap-3 border-t pt-5">
                  <h3 id="score-steps-title" className="text-sm font-semibold">{copy("How this score was reached")}</h3>
                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="min-w-0 text-muted-foreground">{copy("Weighted rating before review")}</dt>
                      <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">{view.breakdown.beforeReview}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="min-w-0 text-muted-foreground">{copy("Adversarial review deduction")}</dt>
                      <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">{view.breakdown.deduction > 0 ? `−${view.breakdown.deduction}` : "0"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="min-w-0 text-muted-foreground">
                        {view.breakdown.cap === 85 ? copy("Evidence cap (3+ independent supporting sources)") : copy("Evidence cap (fewer than 3 independent supporting sources)")}
                      </dt>
                      <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">{view.breakdown.cap}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-t pt-2">
                      <dt className="min-w-0 font-medium">{copy("Score")}</dt>
                      <dd className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{view.breakdown.score}</dd>
                    </div>
                  </dl>
                  {view.breakdown.capped && (
                    <p className="text-sm text-muted-foreground">{copy("The evidence cap set this score. More independent supporting sources would raise the cap.")}</p>
                  )}
                </section>
              )}
            </div>
          </section>
          {view.firstTest && (
            <section className="hidden flex-col gap-3 px-1 xl:flex">
              <h2 className="font-semibold">{copy("What to test first")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{view.firstTest}</p>
              <Button variant="outline" onClick={() => goTo("validation")}>
                {copy("Plan your validation")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </section>
          )}
        </aside>
        <div className="flex min-w-0 flex-col gap-4 xl:order-1">
          <div id="opportunity-tabs" role="tablist" aria-label={copy("Opportunity sections")} className="flex scroll-mt-6 overflow-x-auto border-b">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                id={`opportunity-tab-${t}`}
                role="tab"
                aria-selected={tab === t}
                aria-controls="opportunity-panel"
                tabIndex={tab === t ? 0 : -1}
                onClick={() => select(t)}
                onKeyDown={(event) => {
                  let index = tabs.indexOf(t);
                  if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
                  else if (event.key === "ArrowLeft") index = (index + tabs.length - 1) % tabs.length;
                  else if (event.key === "Home") index = 0;
                  else if (event.key === "End") index = tabs.length - 1;
                  else return;
                  event.preventDefault();
                  select(tabs[index], "tab");
                }}
                className={cn(
                  "min-h-12 shrink-0 whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:px-5",
                  tab === t && "border-primary text-primary",
                )}
              >
                {tabLabel(copy, t)}
              </button>
            ))}
          </div>
          <div
            ref={panel}
            id="opportunity-panel"
            role="tabpanel"
            aria-labelledby={`opportunity-tab-${tab}`}
            tabIndex={0}
            className="surface min-w-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tab === "overview" && <OverviewTab view={view} sources={sourcesByKey} openSource={openSource} goTo={goTo} />}
            {tab === "evidence" && <EvidenceTab view={view} sources={sourcesByKey} openSource={openSource} />}
            {tab === "economics" && <EconomicsTab view={view} />}
            {tab === "validation" && <ValidationTab view={view} sprint={sprint} />}
          </div>
        </div>
      </div>
      <ReadingGuide open={guideOpen} onOpenChange={setGuideOpen} returnFocus={() => guideButton.current?.focus()} />
    </FlagProvider>
  );
}

function ClaimText({ claim, sources, openSource }: { claim: ViewClaim; sources: Map<string, ViewSource>; openSource: (key: string) => void }) {
  const copy = useCopy();
  return (
    <p>
      {claim.kind !== "observed" && (
        <span className={cn("mr-2 rounded px-1.5 py-0.5 text-xs font-semibold", claim.kind === "assumption" ? "bg-warm-soft" : "bg-secondary")}>
          {claim.kind === "assumption" ? copy("Assumption") : copy("Inference")}
        </span>
      )}
      {claim.text}
      {claim.source_keys.map((key) => {
        const source = sources.get(key);
        if (!source) return null;
        return (
          <a
            key={key}
            href={`#${sourceAnchor(key)}`}
            onClick={(event) => {
              event.preventDefault();
              openSource(key);
            }}
            className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1 align-baseline text-xs font-semibold text-primary underline-offset-2 hover:underline"
            aria-label={copy("Source {number}: {title}", { number: source.number, title: source.title })}
          >
            [{source.number}]
          </a>
        );
      })}
    </p>
  );
}

function OverviewTab({ view, sources, openSource, goTo }: { view: OpportunityView; sources: Map<string, ViewSource>; openSource: (key: string) => void; goTo: (tab: OpportunityTabId) => void }) {
  const copy = useCopy();
  const band = scoreBand(view.score);
  const top = topClaims(view.claims);
  return (
    <>
      <section className="report-section" aria-labelledby="verdict-heading">
        <h2 id="verdict-heading" className="text-xl font-semibold">{copy("Verdict")}</h2>
        <p className="text-lg font-medium">
          {copy(band.label)} · <span className="tabular-nums">{view.score}/100</span>
        </p>
        <p className="max-w-prose leading-relaxed text-muted-foreground">{copy(band.meaning)}</p>
        {view.breakdown && (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {copy("Rated {rating} before review, {deduction} points deducted by the adversarial review, under an evidence cap of {cap}.", {
              rating: view.breakdown.beforeReview,
              deduction: view.breakdown.deduction,
              cap: view.breakdown.cap,
            })}
            {view.breakdown.capped && <> {copy("The evidence cap set this score. More independent supporting sources would raise the cap.")}</>}
          </p>
        )}
        {view.rationale && <p className="max-w-prose leading-relaxed">{view.rationale}</p>}
      </section>
      <section className="report-section">
        <h2 className="text-xl font-semibold">{copy("The problem worth solving")}</h2>
        <p className="max-w-prose text-lg leading-relaxed">{view.pain}</p>
        {view.approach && (
          <div className="flex flex-col gap-3 border-t pt-5">
            <h3 className="font-semibold">{copy("The GenAI-enabled approach")}</h3>
            <p className="max-w-prose leading-relaxed text-muted-foreground">{view.approach}</p>
          </div>
        )}
      </section>
      <section className="report-section">
        <h2 className="text-xl font-semibold">{copy("Buyer and buying context")}</h2>
        <p className="font-medium">{view.buyer}</p>
        {view.buyerContext && (
          <dl className="grid gap-6 sm:grid-cols-3">
            {[
              [copy("Job to be done"), view.buyerContext.job],
              [copy("Current alternative"), view.buyerContext.alternative],
              [copy("Potential buying trigger"), view.buyerContext.trigger],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-2">
                <dt className="text-sm font-medium">{label}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      {top.length > 0 && (
        <section className="report-section" aria-labelledby="top-claims-heading">
          <h2 id="top-claims-heading" className="text-xl font-semibold">{copy("Key claims")}</h2>
          <ul className="flex flex-col gap-3 text-sm leading-relaxed">
            {top.map((claim, index) => (
              <li key={index}>
                <ClaimText claim={claim} sources={sources} openSource={openSource} />
              </li>
            ))}
          </ul>
          <Button variant="link" className="h-auto justify-start whitespace-normal p-0 text-left" onClick={() => goTo("evidence")}>
            {copy("See every claim and source")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </section>
      )}
      <section className="report-section">
        <h2 className="text-xl font-semibold">{copy("Key risk to validate")}</h2>
        <p className="max-w-prose leading-relaxed">{view.risk}</p>
        {view.critique && (
          <div className="flex flex-col gap-2 border-t pt-5">
            <h3 className="font-semibold">{copy("What the adversarial review found")}</h3>
            <p className="max-w-prose leading-relaxed text-muted-foreground">{view.critique}</p>
          </div>
        )}
        <Button variant="link" className="h-auto justify-start whitespace-normal p-0 text-left" onClick={() => goTo("validation")}>
          {copy("Turn assumptions into a validation plan")}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </section>
    </>
  );
}

function SourceCard({ source }: { source: ViewSource }) {
  const copy = useCopy();
  const format = useFormats();
  return (
    <article
      id={sourceAnchor(source.key)}
      tabIndex={-1}
      className="flex scroll-mt-24 flex-col gap-3 rounded-xl bg-background/70 p-4 transition-shadow target:ring-2 target:ring-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
    >
      {source.stance === "contradicts" && (
        // Counter-evidence is kept visible but must never read as support for the opportunity.
        <p className="w-fit rounded-md bg-warm-soft px-2 py-1 text-xs font-semibold text-foreground">
          {copy("Counter-evidence: this source contradicts the opportunity")}
        </p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-sm font-semibold text-muted-foreground" aria-hidden="true">[{source.number}]</span>
        {source.url ? (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">
            {source.title}
          </a>
        ) : (
          <h3 className="font-medium">{source.title}</h3>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {source.domain && <span className="break-all">{source.domain}</span>}
        {source.reliability && <Badge variant="outline">{reliabilityLabel(copy, source.reliability)}</Badge>}
        {source.stance && source.stance !== "contradicts" && <Badge variant="secondary">{stanceLabel(copy, source.stance)}</Badge>}
        {source.synthetic && (
          <>
            <Badge variant="outline">{source.synthetic.type}</Badge>
            <span>{copy("Synthetic · Not verified")}</span>
          </>
        )}
      </div>
      {source.synthetic && <p className="text-sm text-muted-foreground">{source.synthetic.detail}</p>}
      {source.quote && (
        <blockquote className="whitespace-pre-wrap border-l-2 pl-3 text-sm leading-relaxed">{source.quote}</blockquote>
      )}
      {source.synthetic && (
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="font-medium">{copy("Working interpretation")}</dt>
            <dd className="leading-relaxed text-muted-foreground">{source.synthetic.interpretation}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium">{copy("Limitations")}</dt>
            <dd className="leading-relaxed text-muted-foreground">{source.synthetic.limitation}</dd>
          </div>
        </dl>
      )}
      {source.retrievedAt && (
        <p className="text-sm text-muted-foreground">
          {copy("Retrieved: {date} UTC · Published: {published}", {
            date: format.date(source.retrievedAt, true),
            published: source.publishedAt ?? copy("Unknown"),
          })}
        </p>
      )}
      <FlagButton target="source" targetKey={source.key} label={source.title} className="-ml-1.5 w-fit" />
    </article>
  );
}

function EvidenceTab({ view, sources, openSource }: { view: OpportunityView; sources: Map<string, ViewSource>; openSource: (key: string) => void }) {
  const copy = useCopy();
  const groups = claimsBySection(view.claims);
  const support = view.sources.filter((source) => source.stance !== "contradicts");
  const counter = view.sources.filter((source) => source.stance === "contradicts");
  const quoted = view.sources.some((source) => source.quote && !source.synthetic);
  return (
    <>
      {groups.length > 0 && (
        <section aria-labelledby="claims-heading" className="report-section">
          <h2 id="claims-heading" className="text-xl font-semibold">{copy("What the research claims")}</h2>
          {groups.map((group) => (
            <div key={group.section} className="flex flex-col gap-2">
              <h3 className="font-semibold">{sectionTitle(copy, group.section)}</h3>
              <ul className="flex flex-col gap-3">
                {group.claims.map((claim, index) => (
                  <li key={`${group.section}-${index}`} className="flex flex-col gap-1 text-sm leading-relaxed">
                    <ClaimText claim={claim} sources={sources} openSource={openSource} />
                    {claim.kind === "assumption" && claim.confirm && (
                      <p className="text-muted-foreground">{copy("To confirm: {hint}", { hint: claim.confirm })}</p>
                    )}
                    <FlagButton target="claim" targetKey={claim.key} label={claim.text} className="-ml-1.5 w-fit" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {support.length > 0 && (
        <section aria-labelledby="sources-heading" className="report-section">
          <h2 id="sources-heading" className="text-xl font-semibold">{copy("Sources")}</h2>
          {quoted && <p className="text-sm text-muted-foreground">{copy("Source excerpts are kept in their original language so you can verify them yourself.")}</p>}
          {support.map((source) => <SourceCard key={source.key} source={source} />)}
        </section>
      )}
      {counter.length > 0 && (
        <section aria-labelledby="counter-heading" className="report-section">
          <h2 id="counter-heading" className="text-xl font-semibold">{copy("Counter-evidence")}</h2>
          {counter.map((source) => <SourceCard key={source.key} source={source} />)}
        </section>
      )}
    </>
  );
}

function EconomicsTab({ view }: { view: OpportunityView }) {
  const copy = useCopy();
  return (
    <section className="report-section" aria-labelledby="economics-heading">
      <h2 id="economics-heading" className="text-xl font-semibold">{copy("Price and cost hypotheses")}</h2>
      <dl className="flex flex-col">
        {[
          [copy("Price hypothesis"), view.revenue],
          [copy("Delivery cost hypothesis"), view.cost],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-2 border-b py-4">
            <dt className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {label}
              <span className="rounded bg-warm-soft px-1.5 py-0.5 text-xs font-semibold text-foreground">{copy("Assumption")}</span>
            </dt>
            <dd className="leading-relaxed">{value}</dd>
          </div>
        ))}
      </dl>
      {view.assumptions.length > 0 && (
        <>
          <h3 className="font-semibold">{copy("The assumptions that matter")}</h3>
          <ul className="flex list-disc flex-col gap-3 pl-5 text-muted-foreground">
            {view.assumptions.map((text) => <li key={text}>{text}</li>)}
          </ul>
        </>
      )}
      <h3 className="font-semibold">{copy("What would confirm this")}</h3>
      {view.confirmations.length > 0 ? (
        <ul className="flex flex-col gap-3 text-sm leading-relaxed">
          {view.confirmations.map((item) => (
            <li key={item.claim} className="flex flex-col gap-1">
              <span>{item.claim}</span>
              {item.confirm && <span className="text-muted-foreground">{copy("To confirm: {hint}", { hint: item.confirm })}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {copy("Ask buyers what the problem costs them today and what they pay for their current workaround, then offer a small paid pilot at the hypothesised price.")}
        </p>
      )}
    </section>
  );
}

function ValidationTab({ view, sprint }: { view: OpportunityView; sprint?: Sprint | null }) {
  const copy = useCopy();
  const { completed, toggleTask, busy } = useDemo();
  const [current, setCurrent] = useState<Sprint | null>(sprint ?? null);
  const actions = useSprintActions(view.kind === "demo", setCurrent, current);
  const sprints = sprint !== undefined;
  const activeSprint = sprints && current?.status === "active" ? current : null;
  const notes = [
    copy("Start with this assumption: {buyer} experience this problem often enough to pay for a solution.", { buyer: view.buyer }),
    copy("Use your network and relevant professional communities. Ask permission before reaching out."),
    copy("Ask about the last time this happened, their existing workaround, and what it costs them. Avoid pitching."),
    copy("Offer a manual version of the outcome for a small fee before building software."),
  ];
  const done = checklist.filter((_, i) => completed.includes(`${view.id}-${i}`)).length;
  return (
    <section className="report-section" aria-labelledby="validation-heading">
      <h2 id="validation-heading" className="text-xl font-semibold">{copy("Your first validation sprint")}</h2>
      {sprints && !activeSprint && (
        <SprintStarter
          busy={actions.busy}
          previous={current}
          onStart={(length) => void actions.send({ action: "start", opportunity_id: view.id, length, checklist: checklist.map((title) => copy(title)) })}
        />
      )}
      {view.firstTest && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{copy("What to test first")}</h3>
          <p className="max-w-prose leading-relaxed">{view.firstTest}</p>
        </div>
      )}
      {!activeSprint && view.validation.length > 1 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{copy("Next validation steps")}</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
            {view.validation.map((text) => <li key={text}>{text}</li>)}
          </ol>
        </div>
      )}
      {view.falsification && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{copy("How to falsify this opportunity")}</h3>
          <p className="max-w-prose leading-relaxed text-muted-foreground">{view.falsification}</p>
        </div>
      )}
      {activeSprint && (
        <div className="border-t pt-5">
          <SprintPanel sprint={activeSprint} send={actions.send} busy={actions.busy} demo={view.kind === "demo"} />
        </div>
      )}
      {!activeSprint && (<>
      <div className="flex flex-col gap-3 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{copy("Checklist")}</h3>
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {copy("{count} of {total} steps complete", { count: done, total: checklist.length })}
          </span>
        </div>
        <progress className="h-2 w-full accent-primary" value={done} max={checklist.length} aria-label={copy("Validation steps complete")} />
        <p className="text-sm text-muted-foreground">
          {view.kind === "demo"
            ? copy("Demo checklist · Changes reset on refresh. No interviews are scheduled or messages sent.")
            : copy("Checklist progress is saved with this opportunity. No messages or meeting invitations are sent.")}
        </p>
      </div>
      <div className="flex flex-col">
        {checklist.map((title, i) => {
          const checked = completed.includes(`${view.id}-${i}`);
          return (
            <label key={title} className="flex cursor-pointer items-start gap-4 border-b py-5 last:border-0">
              <input type="checkbox" checked={checked} disabled={busy} onChange={() => toggleTask(`${view.id}-${i}`)} className="mt-1 size-5 shrink-0" />
              <span className="flex flex-col gap-2">
                <span className={cn("font-medium", checked && "text-muted-foreground line-through")}>{copy(title)}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{notes[i]}</span>
              </span>
            </label>
          );
        })}
      </div>
      </>)}
      <div className="flex flex-col gap-3 border-t pt-5">
        <h3 className="font-semibold">{copy("A better first question")}</h3>
        <blockquote className="max-w-prose text-base leading-relaxed">
          {copy("“Walk me through the last time you dealt with this. What did you do, and what happened next?”")}
        </blockquote>
      </div>
    </section>
  );
}

/** The single reading guide for an opportunity page: how scores, sources and claims are meant to be read. */
function ReadingGuide({ open, onOpenChange, returnFocus }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocus: () => void }) {
  const copy = useCopy();
  const topics: [string, string[]][] = [
    [copy("Score"), [
      copy("Five dimensions are rated 0–100 and weighted by discovery mode. Scores compare hypotheses; they are not probabilities of success or investment advice."),
      copy("Strong candidate: 65 and above. Promising: 50–64. Mixed evidence: 35–49. Weak case: below 35."),
    ]],
    [copy("Evidence cap"), [
      copy("A score cannot exceed 70, or 85 when three or more independent sources support the opportunity. When the cap sets the score, more independent support would raise it."),
    ]],
    [copy("Adversarial review deduction"), [
      copy("A separate review step argues against each opportunity. It can only deduct points, never add them."),
    ]],
    [copy("Source types"), [
      copy("Primary: first-hand data, such as surveys, studies, government data or buyers describing their own experience. Secondary: independent reporting or analysis, such as news, trade press or industry bodies. Vendor: a company marketing a product for this pain, never counted as independent proof of demand. Unknown: the publisher is unclear."),
      copy("Sources are webpage excerpts returned by retrieval services, not completed interviews or full due diligence."),
    ]],
    [copy("Stance"), [
      copy("Supports: the source backs the opportunity. Contradicts: it argues against it and is listed as counter-evidence. Neutral: relevant context either way."),
    ]],
    [copy("Claim kinds"), [
      copy("Observed: stated by a cited supporting source. Inference: the research model's reasoning, which may cite sources. Assumption: not backed by a source yet, with what would confirm it."),
    ]],
    [copy("Report language and quotes"), [
      copy("The report is written in the language you chose. Quotes are kept verbatim in their original language so you can check them against the source."),
    ]],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
        className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-md translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none rounded-l-2xl data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0">
        <DialogHeader>
          <DialogTitle>{copy("How to read this report")}</DialogTitle>
          <DialogDescription>{copy("What the score, sources and claims on this page mean.")}</DialogDescription>
        </DialogHeader>
        {topics.map(([title, lines]) => (
          <section key={title} className="flex flex-col gap-2">
            <h3 className="font-semibold">{title}</h3>
            {lines.map((line) => <p key={line} className="text-sm leading-relaxed text-muted-foreground">{line}</p>)}
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
