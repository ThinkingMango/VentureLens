"use client";

import Link from "@/components/workspace-link";
import { ArrowRight, Compass } from "lucide-react";
import { Confidence } from "@/components/shared";
import { recommendation, CLEAR_LEAD_POINTS } from "@/lib/report-presentation";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { useCopy } from "@/i18n/use-copy";

/**
 * Says which opportunity to validate first. It names one only when the ranking supports it: a clear lead, or a sole
 * survivor. When the top two are close it shows both, because the scores cannot separate them.
 */
export function ReportRecommendation({ opportunities }: { opportunities: WorkspaceOpportunity[] }) {
  const copy = useCopy();
  const pick = recommendation(opportunities);
  if (pick.kind === "none") return null;
  const close = pick.kind === "close";
  return (
    <section aria-labelledby="report-recommendation" className="surface flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-primary">
        <Compass className="size-5 shrink-0" aria-hidden="true" />
        <h2 id="report-recommendation" className="text-xl font-semibold text-foreground">
          {copy(close ? "Two close candidates" : "Start here")}
        </h2>
      </div>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        {pick.kind === "single"
          ? copy("This is the only hypothesis that passed the evidence check and the adversarial review.")
          : pick.kind === "leader"
            ? copy("{points, plural, one {Leads the next hypothesis by # point.} other {Leads the next hypothesis by # points.}} Run its first test before spending on the others.", { points: pick.gap })
            : copy("{points, plural, one {Their scores are # point apart,} other {Their scores are # points apart,}} which is closer than the scores can reliably separate (a clear lead is {lead} points or more). Run the first test for both before committing to either.", { points: pick.gap, lead: CLEAR_LEAD_POINTS })}
      </p>
      <div className={close ? "grid gap-4 lg:grid-cols-2" : "flex flex-col"}>
        {(close ? [pick.lead, pick.runnerUp] : [pick.lead]).map((item) => (
          <article key={item.id} aria-label={item.title} className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="flex items-baseline gap-1 text-primary">
                <strong className="text-2xl font-semibold tabular-nums">{item.score}</strong>
                <span className="text-sm text-muted-foreground">/100</span>
              </p>
              <Confidence level={item.confidence} />
            </div>
            <h3 className="font-semibold leading-snug">{item.title}</h3>
            {item.validation?.[0] && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{copy("First validation step")}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.validation[0]}</p>
              </div>
            )}
            {item.falsification && (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{copy("Test that could disprove it")}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.falsification}</p>
              </div>
            )}
            <Link
              href={`/opportunities/${item.id}`}
              aria-label={copy("Read report: {title}", { title: item.title })}
              className="mt-auto inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {copy("Read report")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
