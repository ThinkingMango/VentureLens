"use client";

import Link from "@/components/workspace-link";
import { Bookmark, ArrowRight, Users, WalletCards, ShieldAlert } from "lucide-react";
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
import { useCopy } from "@/i18n/use-copy";

export function OpportunityCard({
  opportunity: original,
}: {
  opportunity: WorkspaceOpportunity;
}) {
  const copy = useCopy();
  const { saved, toggleSave, isDemo, busy } = useDemo();
  // Demo callers pass fixtures already localized by useDemoContent, so the card never loads the demo dataset.
  const o = original;
  const isSaved = saved.includes(o.id);

  return (
    <Card
      role="article"
      aria-label={o.title}
      className="lift flex h-full min-w-0 flex-col overflow-hidden"
    >
      <CardHeader className="gap-4 p-5 pb-4 sm:p-6 sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="flex items-baseline gap-1 text-primary">
              <strong className="text-3xl font-semibold tabular-nums tracking-tight">
                {o.score}
              </strong>
              <span className="text-sm text-muted-foreground">/100</span>
            </p>
            <Confidence level={o.confidence} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 shrink-0"
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
        <div className="flex flex-col gap-2">
          {!["combined", "founder", "market"].includes(
            o.category.toLowerCase().trim(),
          ) && (
            <p className="text-sm font-medium text-muted-foreground">{o.category}</p>
          )}
          <CardTitle>
            <h3 className="text-xl font-semibold leading-snug sm:text-2xl">
              <Link
                href={`/opportunities/${o.id}`}
                className="rounded-sm hover:text-primary"
              >
                {o.title}
              </Link>
            </h3>
          </CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            {o.description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5 px-5 pb-6 sm:px-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
              {copy("Likely buyer")}
            </dt>
            <dd className="font-medium leading-relaxed">{o.buyer}</dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <WalletCards className="size-4" aria-hidden="true" />
              {copy(
                isDemo
                  ? "Monthly price hypothesis"
                  : "Business model and pricing assumptions",
              )}
            </dt>
            <dd className="font-medium leading-relaxed tabular-nums">
              {o.revenue}
              {isDemo && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {copy("USD / customer")}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="rounded-xl bg-warm-soft p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldAlert className="size-4 text-warm" aria-hidden="true" />
            {copy("Key risk to validate")}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.risk}</p>
        </div>

        {!isDemo && original.validation?.[0] && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              {copy("Next validation step")}
            </p>
            <p className="text-sm leading-relaxed">{original.validation[0]}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-4 border-t bg-background/45 px-5 py-5 sm:px-6">
        <p className="text-sm text-muted-foreground">
          {isDemo
            ? copy("Demo assessment")
            : copy(
                "{count, plural, one {# linked source page} other {# linked source pages}}",
                { count: reportEvidenceCount([original]) },
              )}
        </p>
        <Button asChild className="w-full">
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
