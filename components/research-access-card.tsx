"use client";
import Link from "next/link";
import { ArrowRight, FlaskConical, Lock } from "lucide-react";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { useDemo } from "@/components/demo-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// The research allowance shown in the sidebar, on New research, on Billing and on the dashboard. It lives on its own
// so the app shell and billing do not pull the whole live workspace module into every bundle.
export function ResearchAccessCard({ compact = false }: { compact?: boolean }) {
  const copy = useCopy();
  const format = useFormats();
  const { data } = useDemo();
  const access = data?.access;
  if (!access) return null;
  if (access.enabled)
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft p-4",
          compact && "p-4",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <FlaskConical className="size-4 text-success" />
            {copy("Live research enabled")}
          </span>
          <Badge
            variant="outline"
            className="border-success/30 bg-card text-success"
          >
            {copy("Included")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {copy(
            "{count, plural, one {# research run remaining} other {# research runs remaining}}",
            { count: access.remaining },
          )}
          {access.expiresAt
            ? ` · ${copy("Access until {date}", { date: format.date(access.expiresAt) })}`
            : ""}
        </p>
        {!compact && (
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{
                width: `${access.maxRuns ? (access.remaining / access.maxRuns) * 100 : 0}%`,
              }}
            />
          </div>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
      <span className="flex items-center gap-2 font-medium">
        <Lock className="size-4 text-muted-foreground" />
        {access.maxRuns > 0
          ? copy("No research runs left")
          : copy("No research run on this account yet")}
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {access.maxRuns > 0
          ? copy(
              "You have used your free research run. Failed runs are returned automatically, within a limit per account, and paid credits are planned. Your reports and briefs stay saved.",
            )
          : copy(
              "Every confirmed account receives one free research run. If yours is missing, sign out and back in, or contact support. You can build your profile, save briefs, and explore the full demo meanwhile.",
            )}
      </p>
      {!compact && (
        <Link
          href="/demo/research/results"
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          {copy("Read a sample report")}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
