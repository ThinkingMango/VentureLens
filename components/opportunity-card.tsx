"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "@/components/workspace-link";
import { Bookmark, ArrowRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confidence } from "@/components/shared";
import { type WorkspaceOpportunity } from "@/lib/workspace-schema";
import { reportEvidenceCount } from "@/lib/report-presentation";
import { useDemo } from "@/components/demo-provider";
import { cn } from "@/lib/utils";
import { useDemoContent } from "@/i18n/demo";

export function OpportunityCard({
  opportunity: original,
}: {
  opportunity: WorkspaceOpportunity;
}) {
  const copy = useCopy();
  const { saved, toggleSave, isDemo, busy } = useDemo();
  const content = useDemoContent();
  const o = isDemo ? content.opportunity(original) : original;
  return (
    <Card
      role="article"
      aria-label={o.title}
      className="flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:border-primary/40"
    >
      <CardHeader className="gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="rounded-md border border-primary/20 bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            <strong className="mr-2 text-xl font-semibold tabular-nums text-foreground">
              {o.score}
              <span className="text-sm font-normal">/100</span>
            </strong>
            {isDemo ? copy("Demo score") : copy("Research score")}
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              saved.includes(o.id)
                ? copy("Unsave {title}", { title: o.title })
                : copy("Save {title}", { title: o.title })
            }
            aria-pressed={saved.includes(o.id)}
            disabled={busy}
            onClick={() => toggleSave(o.id)}
          >
            <Bookmark
              className={cn(
                "text-muted-foreground",
                saved.includes(o.id) && "fill-primary/15 text-primary",
              )}
            />
          </Button>
        </div>
        {!["combined", "founder", "market"].includes(
          o.category.toLowerCase().trim(),
        ) && <p className="text-sm text-muted-foreground">{o.category}</p>}
        <CardTitle>
          <h3 className="text-xl font-semibold leading-snug">
            <Link
              href={`/opportunities/${o.id}`}
              className="hover:text-primary"
            >
              {o.title}
            </Link>
          </h3>
        </CardTitle>
        <CardDescription className="leading-relaxed">
          {o.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5 px-5 pb-5 sm:px-6 sm:pb-6">
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Likely buyer")}
            </dt>
            <dd className="font-medium">{o.buyer}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy(
                isDemo
                  ? "Monthly price hypothesis"
                  : "Business model and pricing assumptions",
              )}
            </dt>
            <dd className="text-sm leading-relaxed tabular-nums">
              {o.revenue}
              {isDemo && (
                <span className="ml-1 font-normal text-muted-foreground">
                  {copy("USD / customer")}
                </span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-warm/60 pl-3">
            <dt className="text-sm text-warm">
              {copy("Key risk to validate")}
            </dt>
            <dd className="text-sm leading-relaxed">{o.risk}</dd>
          </div>
          {!isDemo && original.validation?.[0] && (
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">
                {copy("Next validation step")}
              </dt>
              <dd className="text-sm leading-relaxed">
                {original.validation[0]}
              </dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Confidence level={o.confidence} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t bg-background/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-muted-foreground">
          {isDemo
            ? copy("Demo assessment")
            : copy(
                "{count, plural, one {# linked source page} other {# linked source pages}}",
                { count: reportEvidenceCount([original]) },
              )}
        </p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link
            href={`/opportunities/${o.id}`}
            aria-label={copy("Read report: {title}", { title: o.title })}
          >
            {copy("Read report")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
