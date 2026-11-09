"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "@/components/workspace-link";
import { Bookmark, ArrowRight, TriangleAlert, Link2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confidence, ScoreRing } from "@/components/shared";
import { type WorkspaceOpportunity } from "@/lib/workspace-schema";
import { reportEvidenceCount } from "@/lib/report-presentation";
import { useDemo } from "@/components/demo-provider";
import { cn } from "@/lib/utils";
import { useDemoContent } from "@/i18n/demo";

/**
 * One opportunity hypothesis, laid out for comparison: score, then what it
 * is, who pays and how much, then the risk that could sink it. The whole
 * card is one click target (the title link is stretched over it); the save
 * button sits above that layer.
 */
export function OpportunityCard({
  opportunity: original,
}: {
  opportunity: WorkspaceOpportunity;
}) {
  const copy = useCopy();
  const { saved, toggleSave, isDemo, busy } = useDemo();
  const content = useDemoContent();
  const o = isDemo ? content.opportunity(original) : original;
  const isSaved = saved.includes(o.id);
  const showCategory = !["combined", "founder", "market"].includes(
    o.category.toLowerCase().trim(),
  );
  const sources = isDemo ? 0 : reportEvidenceCount([original]);
  return (
    <Card className="relative flex h-full min-w-0 flex-col transition-colors hover:border-primary/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <CardContent className="flex flex-1 flex-col gap-5 p-6">
        <div className="flex items-start gap-4">
          <ScoreRing
            score={o.score}
            label={copy(
              isDemo
                ? "Demo score: {score} out of 100"
                : "Research score: {score} out of 100",
              { score: o.score },
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
            {showCategory && (
              <p className="text-sm text-muted-foreground">{o.category}</p>
            )}
            <h3 className="text-lg font-semibold leading-snug text-balance">
              <Link
                href={`/opportunities/${o.id}`}
                className="stretched-link hover:text-primary"
              >
                {o.title}
              </Link>
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 -mr-2 -mt-2"
            aria-label={
              isSaved
                ? copy("Unsave {title}", { title: o.title })
                : copy("Save {title}", { title: o.title })
            }
            aria-pressed={isSaved}
            disabled={busy}
            onClick={() => toggleSave(o.id)}
          >
            <Bookmark
              className={cn(
                "text-muted-foreground",
                isSaved && "fill-primary/15 text-primary",
              )}
            />
          </Button>
        </div>
        <p className="line-clamp-3 leading-relaxed text-muted-foreground">
          {o.description}
        </p>
        <dl className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Likely buyer")}
            </dt>
            <dd className="font-medium">{o.buyer}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy(
                isDemo
                  ? "Monthly price hypothesis"
                  : "Business model and pricing assumptions",
              )}
            </dt>
            <dd
              className={cn(
                "tabular-nums",
                isDemo ? "font-medium" : "line-clamp-3 text-sm leading-relaxed",
              )}
            >
              {o.revenue}
              {isDemo && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {copy("USD / customer")}
                </span>
              )}
            </dd>
          </div>
        </dl>
        <div className="flex gap-3 rounded-lg border border-warm/25 bg-warm-soft p-4">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-warm"
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium">{copy("Key risk to validate")}</p>
            <p className="line-clamp-4 text-sm leading-relaxed">{o.risk}</p>
          </div>
        </div>
        {!isDemo && original.validation?.[0] && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {copy("Next validation step")}
            </p>
            <p className="line-clamp-2 text-sm leading-relaxed">
              {original.validation[0]}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3 border-t px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Confidence level={o.confidence} />
          {!isDemo && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link2 className="size-3.5" aria-hidden="true" />
              {copy(
                "{count, plural, one {# linked source page} other {# linked source pages}}",
                { count: sources },
              )}
            </span>
          )}
        </div>
        {/* Visual affordance only: the stretched title link is the real target. */}
        <span
          aria-hidden="true"
          className="flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          {copy("Read report")}
          <ArrowRight className="size-4" />
        </span>
      </CardFooter>
    </Card>
  );
}
