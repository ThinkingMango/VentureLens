"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { OpportunityCard } from "@/components/opportunity-card";
import { useDemo } from "@/components/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResearchReport } from "@/lib/research-types";
import {
  reportEvidenceCount,
  reportShortlist,
} from "@/lib/report-presentation";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { localeNames } from "@/i18n/config";
import { REVIEW_MAX_PENALTY, reportLanguage } from "@/lib/research-core";
import { ModelTag } from "@/components/model-tag";
import { ScoreScale } from "@/components/score-scale";
const dimensions: Record<string, string> = {
  pain: "Buyer pain",
  demand: "Demand",
  economics: "Unit economics",
  feasibility: "Delivery feasibility",
  advantage: "Founder advantage",
};
const modes = {
  founder: "Founder-led discovery",
  market: "Market-led discovery",
  combined: "Founder + market discovery",
  verify: "Idea check",
};
export function ResearchReportView({ report }: { report: ResearchReport }) {
  const copy = useCopy();
  const format = useFormats();
  const locale = useLocale();
  const { saved } = useDemo();
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState("score");
  const list = reportShortlist(
    report.opportunities,
    saved,
    savedOnly,
    sort,
    locale,
  );
  const evidenceCount = reportEvidenceCount(report.opportunities);
  const supported = report.mode === "verify" ? report.opportunities[0] : undefined;
  return (
    <>
      {supported && (
        <section aria-labelledby="verify-verdict" className="surface flex flex-col gap-2 border-primary/40 bg-primary/5 p-5 sm:p-6">
          <h2 id="verify-verdict" className="text-xl font-semibold text-primary">
            {supported.confidence === "moderate"
              ? copy("Supported by independent evidence (moderate confidence)")
              : copy("Supported by independent evidence (limited confidence)")}
          </h2>
          <p className="max-w-prose text-sm leading-relaxed">
            {copy("Independent sources describe the problem you named, so the idea passed the evidence rules. That is not proof that buyers will pay: the score compares evidence, it is not a chance of success. Test it with buyers next.")}
          </p>
        </section>
      )}
      <section
        aria-labelledby="report-summary"
        className="surface flex flex-col gap-5 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            <span className="font-medium">{copy("Research complete")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModelTag model={report.model} provider={report.provider} />
            <Badge variant="outline">{copy(modes[report.mode])}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h2 id="report-summary" className="text-xl font-semibold">
            {copy("Research summary")}
          </h2>
          <p className="max-w-prose whitespace-pre-line leading-relaxed">
            {report.summary}
          </p>
          {report.skipped_duplicates ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              {copy(
                "{count, plural, one {We skipped # idea you’ve already seen.} other {We skipped # ideas you’ve already seen.}}",
                { count: report.skipped_duplicates },
              )}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-4 text-sm">
          <span>
            {copy(
              "{count, plural, one {# opportunity hypothesis} other {# opportunity hypotheses}}",
              { count: report.opportunities.length },
            )}
          </span>
          <span>
            {copy(
              "{count, plural, one {# linked source page} other {# linked source pages}}",
              { count: evidenceCount },
            )}
          </span>
          <time
            className="text-muted-foreground"
            dateTime={report.generated_at}
          >
            {copy("{date} UTC", { date: format.date(report.generated_at, true) })}
          </time>
        </div>
        <ScoreScale methodology={report.methodology} />
        <p className="text-sm text-muted-foreground">
          {copy("Report language: {language}", {
            language: localeNames[reportLanguage(report.language)],
          })}
          {" · "}
          {copy("Source excerpts are kept in their original language so you can verify them yourself.")}
        </p>
        <details className="border-t pt-4">
          <summary className="rounded-sm text-sm font-medium">
            {copy("Methodology, weights, and limitations")}
          </summary>
          <div className="flex flex-col gap-4 pt-4">
            <p className="max-w-prose text-sm leading-relaxed">
              {report.methodology}
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {report.limitations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <dl className="flex flex-wrap gap-5">
              {Object.entries(report.weights).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">
                    {copy(dimensions[key] ?? key)}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {format.number(value, { style: "percent" })}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              {report.methodology === "evidence-driven-v1"
                ? copy(
                    "Scores are capped at 70 with limited evidence and 85 otherwise. Adversarial review can only deduct points.",
                  )
                : copy(
                    "Scores are capped at 70 with limited evidence and 85 otherwise. Adversarial review can only deduct points, at most {points}, and not again for evidence gaps the ratings already reflect.",
                    { points: REVIEW_MAX_PENALTY },
                  )}
            </p>
            <p className="text-sm text-muted-foreground">
              {copy("Research model: {model}", { model: report.model })}
            </p>
          </div>
        </details>
      </section>
      <section
        aria-labelledby="report-opportunities"
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id="report-opportunities" className="text-xl font-semibold">
              {copy("Opportunity shortlist")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {copy(
                "Scores compare hypotheses, not success probabilities. Validate with buyers.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(event) => setSavedOnly(event.target.checked)}
                className="size-4"
              />
              {copy("Saved only")}
            </label>
            <div className="flex items-center gap-2">
              <label
                htmlFor="report-sort"
                className="shrink-0 text-sm text-muted-foreground"
              >
                {copy("Sort by")}
              </label>
              <select
                id="report-sort"
                className="field-select"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="score">{copy("Highest score")}</option>
                <option value="evidence">{copy("Most linked sources")}</option>
                <option value="title">{copy("Alphabetical")}</option>
              </select>
            </div>
          </div>
        </div>
        <p className="sr-only" role="status" aria-atomic="true">
          {copy(
            "{count, plural, one {# opportunity hypothesis} other {# opportunity hypotheses}}",
            { count: list.length },
          )}
        </p>
        {list.length ? (
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {list.map((item) => (
              <OpportunityCard key={item.id} opportunity={item} />
            ))}
          </div>
        ) : (
          <div className="surface flex flex-col items-start gap-3 p-6">
            <h3 className="font-semibold">
              {copy(
                savedOnly
                  ? "No saved opportunities yet"
                  : "No opportunity hypotheses",
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {copy(
                "Save an opportunity from your research results to build your shortlist.",
              )}
            </p>
            {savedOnly && (
              <Button variant="outline" onClick={() => setSavedOnly(false)}>
                {copy("Show all opportunities")}
              </Button>
            )}
          </div>
        )}
        <details className="text-sm text-muted-foreground">
          <summary className="flex min-h-11 w-fit items-center gap-2 rounded-sm">
            <ChevronDown className="size-4" aria-hidden="true" />
            {copy("About scores and report language")}
          </summary>
          <div className="flex max-w-prose flex-col gap-2 pt-2">
            <p>{copy("A score is a starting point, not a verdict.")}</p>
            <p>
              {copy(
                "Each report is written in the language chosen when the run started. Changing the interface language afterwards does not regenerate or translate a saved report.",
              )}
            </p>
            <p>
              {copy(
                "Source counts refer to linked pages, not independent endorsements. Pricing and revenue remain unvalidated assumptions.",
              )}
            </p>
          </div>
        </details>
      </section>
    </>
  );
}
