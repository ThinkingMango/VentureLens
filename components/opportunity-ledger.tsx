"use client";

import { Bookmark, ArrowUpRight } from "lucide-react";
import Link from "@/components/workspace-link";
import { useCopy } from "@/i18n/use-copy";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";

/** Shared research list for both account-backed and synthetic overview screens. */
export function OpportunityLedger({
  opportunities,
}: {
  opportunities: WorkspaceOpportunity[];
}) {
  const copy = useCopy();
  const { saved, toggleSave, busy, isDemo } = useDemo();
  return (
    <div className="surface overflow-hidden">
      <ul aria-label={copy("Opportunities")}>
        {opportunities.map((opportunity) => (
          <li key={opportunity.id} className="terminal-row">
            <div className="min-w-0">
              <Link
                href={`/opportunities/${opportunity.id}`}
                className="inline-flex min-h-8 items-center gap-2 font-medium hover:text-primary"
              >
                {opportunity.title}
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {opportunity.category}
              </p>
              <p className="mt-2 text-sm text-muted-foreground md:hidden">
                {opportunity.buyer}
              </p>
            </div>
            <div className="terminal-row-detail">
              <p className="mb-1.5 text-xs text-muted-foreground">
                {copy("Likely buyer")}
              </p>
              <p className="text-sm">{opportunity.buyer}</p>
            </div>
            <div className="terminal-row-detail">
              <p className="mb-1.5 text-xs text-muted-foreground">
                {copy("Key risk to validate")}
              </p>
              <p className="line-clamp-2 text-sm" title={opportunity.risk}>
                {opportunity.risk}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="text-right">
                <strong className="terminal-number block text-xl font-medium">
                  {opportunity.score}
                  <span className="ml-1 text-xs text-muted-foreground">
                    /100
                  </span>
                </strong>
                <span className="text-xs text-muted-foreground">
                  {isDemo ? copy("Demo score") : copy("Research score")}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                aria-pressed={saved.includes(opportunity.id)}
                aria-label={
                  saved.includes(opportunity.id)
                    ? copy("Unsave {title}", { title: opportunity.title })
                    : copy("Save {title}", { title: opportunity.title })
                }
                onClick={() => toggleSave(opportunity.id)}
              >
                <Bookmark
                  className={
                    saved.includes(opportunity.id)
                      ? "fill-primary/20 text-primary"
                      : "text-muted-foreground"
                  }
                />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
