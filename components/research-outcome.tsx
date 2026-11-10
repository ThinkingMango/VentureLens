"use client";
import Link from "@/components/workspace-link";
import { ExternalLink, SearchX } from "lucide-react";
import { useCopy, type Copy } from "@/i18n/use-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CandidateDiagnosis, GateReason, ResearchOutcome, SuggestionKey } from "@/lib/research-core";

// Why a run's candidates did or did not become opportunities (spec WP-06). Reasons and suggestions are fixed codes,
// translated here; candidate titles and buyers are the run's own text, in the report language.

function reasonText(copy: Copy, reason: GateReason) {
  switch (reason) {
    case "SEARCH_FAILED": return copy("The web search for this idea returned no page we could read.");
    case "NO_SOURCES": return copy("No source we could read supported this idea.");
    case "CONTRADICTED": return copy("The relevant sources we found argue against this idea.");
    case "SINGLE_DOMAIN": return copy("Support came from only one publisher. The evidence rules need at least two independent ones.");
    case "VENDOR_ONLY": return copy("Support came only from companies selling a solution, or did not show buyer pain or demand. The evidence rules need at least one independent source that does.");
    case "REVIEW_REJECTED": return copy("It passed the evidence rules, but the adversarial review found the conclusion unsupported.");
    case "NOT_EVALUATED": return copy("It passed the evidence rules but was not evaluated in this run.");
    case "ALL_DUPLICATES": return copy("You have already seen this idea in an earlier run, so it was not researched again.");
    case "PASSED": return copy("Passed the evidence rules and the review.");
  }
}
function suggestionText(copy: Copy, key: SuggestionKey) {
  switch (key) {
    case "TRY_MARKET_MODE": return copy("Most ideas were backed only by vendor pages. Try market-first mode, which starts from buyer pain and spending instead of your profile.");
    case "NARROW_BUYER": return copy("Most ideas had support from a single publisher. Name a narrower buyer or problem in the brief's focus, so searches find more independent sources.");
    case "CHANGE_GEOGRAPHY": return copy("Many searches found little to read. Try a broader or different target market.");
    case "VERIFY_SPECIFIC_IDEA": return copy("If you already have a specific idea, check that one idea directly.");
    case "CHANGE_FOCUS": return copy("Every idea this run proposed was one you had already seen. Change the brief's focus, industries or market, or clear your idea memory on your profile page to see earlier ideas again.");
  }
}
/** For a verify run that did not pass: what evidence would change the verdict, by the reason it failed. */
function whatWouldChange(copy: Copy, reason: GateReason) {
  switch (reason) {
    case "SEARCH_FAILED": return copy("Searches that return readable pages. Try describing the buyer or problem in other words, or a broader market.");
    case "NO_SOURCES": return copy("Independent sources that describe this problem, such as buyer forums, surveys or trade press.");
    case "CONTRADICTED": return copy("Evidence that outweighs the sources arguing against it, such as buyers describing the problem first-hand.");
    case "SINGLE_DOMAIN": return copy("A second, independent publisher describing the same problem.");
    case "VENDOR_ONLY": return copy("An independent, non-vendor source showing that buyers have this problem or pay to solve it.");
    case "REVIEW_REJECTED": return copy("A clearer link between the evidence and the idea, or a narrower buyer, so the review can accept the conclusion.");
    case "NOT_EVALUATED": return copy("Running the check again.");
    case "ALL_DUPLICATES": return null;
    case "PASSED": return null;
  }
}
function reliabilityLabel(copy: Copy, reliability: string | null) {
  switch (reliability) {
    case "primary": return copy("First-hand");
    case "secondary": return copy("Independent");
    case "vendor": return copy("Vendor");
    case "unknown": return copy("Publisher unclear");
    default: return copy("Not classified");
  }
}
function stanceLabel(copy: Copy, source: CandidateDiagnosis["sources"][number]) {
  if (source.relevant === false) return copy("Not relevant");
  switch (source.stance) {
    case "supports": return copy("Supports");
    case "contradicts": return copy("Contradicts");
    case "neutral": return copy("Neutral");
    default: return null;
  }
}

function CandidateRow({ candidate, demo, checkHref }: { candidate: CandidateDiagnosis; demo: boolean; checkHref?: string }) {
  const copy = useCopy();
  // Demo text is fixed English, translated through the catalogues; a live run's text is shown as written.
  const text = (value: string) => (demo ? copy(value) : value);
  return (
    <li className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-pretty">{text(candidate.title)}</h3>
        <p className="text-sm text-muted-foreground">{copy("For {buyer}", { buyer: text(candidate.buyer) })}</p>
      </div>
      <p className="text-sm leading-relaxed">{reasonText(copy, candidate.reason)}</p>
      {candidate.sources.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label={copy("Sources read for this idea")}>
          {candidate.sources.map((source, index) => {
            const stance = stanceLabel(copy, source);
            const label = source.domain ?? source.url;
            return (
              <li key={`${source.url}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                {demo ? (
                  <span className="font-medium">{label}</span>
                ) : (
                  <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline" title={source.title}>
                    {label}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">{copy("(opens in a new tab)")}</span>
                  </a>
                )}
                <Badge variant="outline">{reliabilityLabel(copy, source.reliability)}</Badge>
                {stance && <Badge variant="secondary">{stance}</Badge>}
              </li>
            );
          })}
        </ul>
      ) : candidate.reason === "ALL_DUPLICATES" ? null : (
        <p className="text-sm text-muted-foreground">{copy("No pages were read for this idea.")}</p>
      )}
      {checkHref && (
        <Button asChild variant="outline" className="w-fit">
          <Link href={checkHref}>{copy("Check this idea on its own")}</Link>
        </Button>
      )}
    </li>
  );
}

/**
 * `variant="failed"`: the full explanation for a run that ended with no opportunity.
 * `variant="completed"`: a collapsed list of the candidates a completed report left out.
 */
export function ResearchOutcomeView({ outcome, variant, runId, demo = false }: { outcome: ResearchOutcome; variant: "failed" | "completed"; runId?: string; demo?: boolean }) {
  const copy = useCopy();
  const notPassed = outcome.candidates.filter(candidate => candidate.reason !== "PASSED");
  const verifyRun = outcome.mode === "verify";
  // WP-04: idea memory skipped every proposed idea, so nothing was searched.
  const allRepeats = notPassed.length > 0 && notPassed.every(candidate => candidate.reason === "ALL_DUPLICATES");
  // A check of one idea needs no "check one idea" suggestion; a discovery run offers it per idea and in general.
  const suggestions = verifyRun ? outcome.suggestions.filter(key => key !== "VERIFY_SPECIFIC_IDEA") : outcome.suggestions;
  // WorkspaceLink maps the path into /demo in the demo workspace.
  const rerun = demo || !runId ? "/research/new" : `/research/new?from=${runId}`;
  const checkHref = (key: string) => (verifyRun ? undefined : demo || !runId ? "/research/new?mode=verify" : `/research/new?from=${runId}&idea=${key}`);
  if (variant === "completed") {
    if (!notPassed.length) return null;
    return (
      <details className="surface p-5 sm:p-6">
        <summary className="min-h-11 rounded-sm font-medium">
          {copy("Ideas that did not pass the evidence rules ({count})", { count: notPassed.length })}
        </summary>
        <ul className="mt-4 flex flex-col gap-4">
          {notPassed.map(candidate => <CandidateRow key={candidate.key} candidate={candidate} demo={demo} checkHref={checkHref(candidate.key)} />)}
        </ul>
      </details>
    );
  }
  if (verifyRun) {
    const [candidate] = outcome.candidates;
    const change = candidate ? whatWouldChange(copy, candidate.reason) : null;
    return (
      <section aria-labelledby="outcome-heading" className="surface flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <SearchX className="size-5 shrink-0" aria-hidden="true" />
            <h2 id="outcome-heading" className="text-xl font-semibold text-foreground">{copy("Not yet supported by independent evidence")}</h2>
          </div>
          <p className="max-w-prose text-sm leading-relaxed">
            {copy("This is not a verdict that the idea is bad. The public web did not show enough independent evidence for it yet: an idea is supported only with supporting sources from at least two independent publishers, one of them first-hand or independent evidence of buyer pain or demand.")}
          </p>
          <p className="text-sm text-muted-foreground">
            {copy("{count, plural, one {# source read} other {# sources read}}", { count: outcome.counts.sources })}
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {outcome.candidates.map(item => <CandidateRow key={item.key} candidate={item} demo={demo} />)}
        </ul>
        <div className="flex flex-col gap-3 border-t pt-4">
          <h3 className="font-semibold">{copy("What would change this")}</h3>
          {change && <p className="text-sm leading-relaxed">{change}</p>}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {copy("Evidence you collect yourself counts most: talk to five buyers about the problem and what they pay today.")}
          </p>
          <Button asChild className="w-fit">
            <Link href={rerun}>{copy("Edit the idea and check again")}</Link>
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="outcome-heading" className="surface flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <SearchX className="size-5 shrink-0" aria-hidden="true" />
          <h2 id="outcome-heading" className="text-xl font-semibold text-foreground">
            {allRepeats ? copy("Every idea was one you had already seen") : copy("What we looked for, and why nothing passed")}
          </h2>
        </div>
        {allRepeats ? (
          <p className="max-w-prose text-sm leading-relaxed">
            {copy("{count, plural, one {Idea memory skipped the # idea this run proposed, because you saw it in an earlier run.} other {Idea memory skipped all # ideas this run proposed, because you saw them in earlier runs.}} Nothing was searched and no report was made.", { count: outcome.counts.candidates })}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {copy("{count, plural, one {# idea searched} other {# ideas searched}}", { count: outcome.counts.candidates })}
              {" · "}
              {copy("{count, plural, one {# source read} other {# sources read}}", { count: outcome.counts.sources })}
              {" · "}
              {copy("{count} passed", { count: outcome.counts.passed })}
            </p>
            <p className="max-w-prose text-sm leading-relaxed">
              {copy("An idea becomes an opportunity only with supporting sources from at least two independent publishers, one of them first-hand or independent evidence of buyer pain or demand. Nothing in this run met that bar, so no report was made. A result like this is still useful: it tells you where the evidence is thin.")}
            </p>
          </>
        )}
      </div>
      <ul className="flex flex-col gap-4">
        {notPassed.map(candidate => <CandidateRow key={candidate.key} candidate={candidate} demo={demo} checkHref={checkHref(candidate.key)} />)}
      </ul>
      <div className="flex flex-col gap-3 border-t pt-4">
        <h3 className="font-semibold">{copy("What to try next")}</h3>
        {suggestions.length > 0 && (
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {suggestions.map(key => <li key={key}>{suggestionText(copy, key)}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          <Button asChild className="w-fit">
            <Link href={rerun}>{copy("Edit the brief and run again")}</Link>
          </Button>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/research/new?mode=verify">{copy("Check an idea")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** The demo's fixed "nothing passed" run, reached from the demo research history. */
export function DemoOutcome({ outcome }: { outcome: ResearchOutcome }) {
  const copy = useCopy();
  return (
    <>
      <Link href="/research" className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        {copy("Research history")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="page-heading text-balance">{copy("Clinic tools for independent physiotherapists")}</h1>
        <p className="text-muted-foreground text-pretty">{copy("A sample run where no idea met the evidence rules, shown with the explanation a real run gives.")}</p>
      </div>
      <ResearchOutcomeView outcome={outcome} variant="failed" demo />
    </>
  );
}

/** The demo's fixed "Verify my idea" example: one idea that is not yet supported, with the verdict a real check gives. */
export function DemoVerifyOutcome({ outcome }: { outcome: ResearchOutcome }) {
  const copy = useCopy();
  return (
    <>
      <Link href="/research" className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
        {copy("Research history")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="page-heading text-balance">{copy("Checked idea: Group booking for climbing gyms")}</h1>
        <p className="text-muted-foreground text-pretty">{copy("A sample check of one idea, shown with the verdict a real check gives.")}</p>
      </div>
      <ResearchOutcomeView outcome={outcome} variant="failed" demo />
    </>
  );
}
