"use client";

import Link from "next/link";
import { ArrowUpRight, Link2, TriangleAlert, FileText } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { useDemoContent } from "@/i18n/demo";
import { scoreLabels } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";
import { Confidence, ScoreBreakdown, ScoreRing } from "@/components/shared";

/**
 * A real link into the demo, with synthetic evidence explicitly identified.
 * It is built from the same data and components as the workspace
 * (ScoreRing, Confidence, the key-risk callout), so it cannot drift from
 * the product the way a hand-drawn mockup or a static screenshot would,
 * and it follows the interface language and colour scheme.
 */
export function EvidencePreview() {
  const copy = useCopy();
  const { opportunities } = useDemoContent();
  const lead = opportunities[0];
  return (
    <section
      aria-label={copy("Demonstration report")}
      className="hero-preview overflow-hidden rounded-2xl border bg-card text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-primary" />
          {copy("Research complete")}
        </span>
        <Badge variant="secondary">{copy("Synthetic demo")}</Badge>
      </div>
      <div className="space-y-5 p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <ScoreRing
            score={lead.score}
            label={copy("Demo score: {score} out of 100", { score: lead.score })}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
            <p className="text-sm text-muted-foreground">{lead.category}</p>
            <Link
              href={`/demo/opportunities/${lead.id}`}
              className="group flex items-start gap-2 text-xl font-semibold leading-snug hover:text-primary sm:text-2xl"
            >
              {lead.title}
              <ArrowUpRight className="mt-1 size-5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {lead.description}
        </p>
        <dl className="grid gap-4 border-y py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{copy("Likely buyer")}</dt>
            <dd className="mt-1 font-medium">{lead.buyer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {copy("Monthly price hypothesis")}
            </dt>
            <dd className="mt-1 font-medium tabular-nums">
              {lead.revenue}
              <span className="ml-1 font-normal text-muted-foreground">
                {copy("USD / customer")}
              </span>
            </dd>
          </div>
        </dl>
        <ScoreBreakdown
          labels={scoreLabels.slice(0, 3)}
          scores={lead.scores.slice(0, 3)}
        />
        <div className="flex gap-3 rounded-lg border border-warm/25 bg-warm-soft p-4">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warm"
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <p className="font-medium">{copy("Key risk to validate")}</p>
            <p className="leading-relaxed">{lead.risk}</p>
          </div>
        </div>
        <Confidence level={lead.confidence} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Link2 className="size-4" />
            {copy("4 hypotheses · 12 sample sources")}
          </span>
          <Link
            href="/demo/research/results"
            className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline"
          >
            {copy("View research")}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          {copy(
            "Illustrative opportunities and scores. Not verified findings or financial advice.",
          )}
        </p>
      </div>
    </section>
  );
}
