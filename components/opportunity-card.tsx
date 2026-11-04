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
import { type Opportunity } from "@/lib/demo-data";
import { useDemo } from "@/components/demo-provider";
import { cn } from "@/lib/utils";
import { useDemoContent } from "@/i18n/demo";

export function OpportunityCard({
  opportunity: original,
}: {
  opportunity: Opportunity;
}) {
  const copy = useCopy();
  const { saved, toggleSave, isDemo, busy } = useDemo();
  const content = useDemoContent();
  const o = isDemo ? content.opportunity(original) : original;
  return (
    <Card className="flex h-full min-w-0 flex-col transition-colors hover:border-primary/40">
      <CardHeader className="gap-3 pb-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{o.category}</p>
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
      <CardContent className="flex flex-1 flex-col gap-5">
        <dl className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Likely buyer")}
            </dt>
            <dd className="font-medium">{o.buyer}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Monthly price hypothesis")}
            </dt>
            <dd className="font-medium tabular-nums">
              {o.revenue}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {copy("USD / customer")}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Key risk to validate")}
            </dt>
            <dd className="text-sm leading-relaxed">{o.risk}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Confidence level={o.confidence} />
          <span className="text-sm text-muted-foreground">
            {isDemo ? copy("Demo assessment") : copy("Research assessment")}
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3 border-t px-6 py-4">
        <p className="text-sm text-muted-foreground">
          <strong className="mr-1 text-lg font-semibold tabular-nums text-foreground">
            {o.score}
            <span className="text-sm font-normal">/100</span>
          </strong>
          {isDemo ? copy("Demo score") : copy("Research score")}
        </p>
        <Button asChild variant="link" className="h-auto p-0">
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
