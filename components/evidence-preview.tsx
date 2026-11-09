"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { useDemoContent } from "@/i18n/demo";
import { scoreLabels } from "@/lib/demo-data";

/** An interactive, clearly labeled synthetic report using the actual demo fixtures. */
export function EvidencePreview() {
  const copy = useCopy();
  const { opportunities } = useDemoContent();
  const [selectedId, setSelectedId] = useState(opportunities[0].id);
  const lead =
    opportunities.find((opportunity) => opportunity.id === selectedId) ??
    opportunities[0];
  return (
    <section
      aria-label={copy("Demonstration report")}
      className="hero-preview overflow-hidden text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 text-xs">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="size-4 text-primary" />
          {copy("Research workspace")}
        </span>
        <span className="text-muted-foreground">
          {copy("Synthetic demo")} / {copy("4 hypotheses · 12 sample sources")}
        </span>
      </div>
      <div className="grid lg:grid-cols-[1fr_1.15fr]">
        <div className="border-b lg:border-b-0 lg:border-r">
          <div className="flex justify-between gap-4 border-b bg-background/40 px-5 py-3 text-xs text-muted-foreground">
            <span>{copy("Opportunities")}</span>
            <span>{copy("Demo score")}</span>
          </div>
          <div
            className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1"
            aria-label={copy("Opportunities")}
          >
            {opportunities.map((opportunity) => (
              <button
                key={opportunity.id}
                type="button"
                aria-pressed={lead.id === opportunity.id}
                aria-controls="preview-detail"
                onClick={() => setSelectedId(opportunity.id)}
                className={`flex min-w-0 items-start justify-between gap-3 rounded-lg border px-4 py-4 text-left hover:border-primary/50 hover:bg-secondary/40 ${lead.id === opportunity.id ? "border-primary/60 bg-secondary/60" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium leading-snug">
                    {opportunity.title}
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {opportunity.category}
                  </span>
                </span>
                <span className="terminal-number text-lg text-primary">
                  {opportunity.score}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div
          id="preview-detail"
          className="space-y-5 p-5 sm:p-6"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="max-w-md text-lg font-medium leading-snug">
              {lead.title}
            </h2>
            <Link
              href={`/demo/opportunities/${lead.id}`}
              aria-label={copy("Read report: {title}", { title: lead.title })}
              className="flex size-11 shrink-0 items-center justify-center rounded border text-primary hover:bg-secondary"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {lead.description}
          </p>
          <dl className="grid gap-4 border-y py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy("Likely buyer")}
              </dt>
              <dd className="mt-1.5">{lead.buyer}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy("Monthly price hypothesis")}
              </dt>
              <dd className="mt-1.5 tabular-nums">{lead.revenue}</dd>
            </div>
          </dl>
          <dl className="grid grid-cols-3 gap-4">
            {scoreLabels.slice(0, 3).map((label, i) => (
              <div key={label}>
                <dt className="mb-2 text-xs text-muted-foreground">
                  {copy(label)}
                </dt>
                <dd className="terminal-number text-lg">
                  {lead.scores[i]}
                  <span className="ml-1 text-xs text-muted-foreground">
                    /100
                  </span>
                </dd>
                <div className="progress-track mt-2" aria-hidden="true">
                  <div
                    className="progress-fill"
                    style={{ width: `${lead.scores[i]}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
          <div className="rounded-xl bg-warm-soft p-4">
            <p className="mb-1 text-xs font-semibold text-foreground">
              {copy("Key risk to validate")}
            </p>
            <p className="text-sm text-muted-foreground">{lead.risk}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <p>
          {copy(
            "Illustrative opportunities and scores. Not verified findings or financial advice.",
          )}
        </p>
        <Link
          href="/demo/research/results"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-primary hover:underline"
        >
          {copy("View research")}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
