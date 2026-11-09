"use client";

import Link from "next/link";
import { ArrowUpRight, Link2, Swords, FileText } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { useDemoContent } from "@/i18n/demo";
import { scoreLabels } from "@/lib/demo-data";
import { Badge } from "@/components/ui/badge";

/** A real link into the demo, with synthetic evidence explicitly identified. */
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              {lead.category}
            </p>
            <Link
              href={`/demo/opportunities/${lead.id}`}
              className="group flex items-start gap-2 text-xl font-semibold leading-snug hover:text-primary sm:text-2xl"
            >
              {lead.title}
              <ArrowUpRight className="mt-1 size-5 shrink-0 transition-transform group-hover:-translate-y-0.5" />
            </Link>
          </div>
          <div className="rounded-xl bg-secondary px-4 py-3 text-center text-primary">
            <strong className="block text-3xl font-semibold tabular-nums">
              {lead.score}
            </strong>
            <span className="text-xs">{copy("Demo score")}</span>
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
            <dd className="mt-1 font-medium">{lead.revenue}</dd>
          </div>
        </dl>
        <dl className="space-y-3">
          {scoreLabels.slice(0, 3).map((label, i) => (
            <div
              key={label}
              className="grid grid-cols-[1fr_5rem_2rem] items-center gap-3 text-sm"
            >
              <dt className="text-muted-foreground">{copy(label)}</dt>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ width: `${lead.scores[i]}%` }}
                />
              </div>
              <dd className="text-right font-medium tabular-nums">
                {lead.scores[i]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="flex items-start gap-2 rounded-lg bg-warm-soft p-3 text-sm">
          <Swords className="mt-0.5 size-4 shrink-0 text-warm" />
          {copy(
            "Review note: established proposal tools may bundle similar features.",
          )}
        </p>
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
