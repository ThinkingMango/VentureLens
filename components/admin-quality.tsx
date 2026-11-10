"use client";
import Link from "next/link";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { PageHeader } from "@/components/shared";
import { AdminNav } from "@/components/admin-nav";
import { formatDuration } from "@/components/admin-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { metricWindows } from "@/lib/quality-metrics";
import type { QualityReport } from "@/lib/admin-runs";
import { cn } from "@/lib/utils";

function Metric({ label, value, definition }: { label: string; value: string; definition: string }) {
  return (
    <Card className="gap-2 p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground text-pretty">{definition}</p>
    </Card>
  );
}

export function AdminQuality({ report }: { report: QualityReport }) {
  const copy = useCopy();
  const formats = useFormats();
  const { metrics: m, days } = report;
  const percent = (value: number | null) => (value === null ? "—" : formats.number(value, { style: "percent", maximumFractionDigits: 0 }));
  const usd = (value: number | null) => (value === null ? "—" : formats.usd(value, 3));
  const number = (value: number | null, digits = 1) => (value === null ? "—" : formats.number(value, { maximumFractionDigits: digits }));
  const distribution = Object.entries(m.opportunitiesPerCompletedRun.distribution).sort(([a], [b]) => Number(a) - Number(b));
  const errors = Object.entries(m.errorCodes).sort(([, a], [, b]) => b - a);
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <PageHeader
        title={copy("Research quality")}
        description={copy("How research runs performed over the chosen window, calculated from the run, usage, evidence and opportunity records.")}
      >
        <nav aria-label={copy("Time window")} className="flex gap-1">
          {metricWindows.map(window => (
            <Link
              key={window}
              href={`/admin/quality?days=${window}`}
              aria-current={window === days ? "page" : undefined}
              className={cn("inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-4 text-sm font-medium hover:bg-secondary", window === days ? "bg-secondary" : "text-muted-foreground")}
            >
              {copy("{days} days", { days: window })}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <p className="text-sm text-muted-foreground">
        {copy("{total} runs created since {since}: {completed} completed, {failed} failed, {active} still active.", { total: m.runs.total, since: formats.date(report.since, true), completed: m.runs.completed, failed: m.runs.failed, active: m.runs.active })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label={copy("Completion rate")} value={percent(m.completionRate)} definition={copy("Completed ÷ (completed + failed), leaving out runs the pre-flight budget check stopped before any request ({n}).", { n: m.runs.preflightBlocked })} />
        <Metric label={copy("Insufficient-evidence rate")} value={percent(m.insufficientEvidenceRate)} definition={copy("Runs that failed with INSUFFICIENT_EVIDENCE ÷ all finished runs.")} />
        <Metric label={copy("Opportunities per completed run")} value={number(m.opportunitiesPerCompletedRun.mean)} definition={copy("Mean number of opportunities that passed the gate and the review.")} />
        <Metric label={copy("Independent supporting domains")} value={number(m.supportingDomainsMedian)} definition={copy("Median per saved opportunity, counted as the evidence gate counts them.")} />
        <Metric label={copy("Vendor share of sources")} value={percent(m.vendorShare)} definition={copy("Sources classified as vendor ÷ all classified sources.")} />
        <Metric label={copy("Duration")} value={`${formatDuration(copy, m.duration.medianMs)} / ${formatDuration(copy, m.duration.p95Ms)}`} definition={copy("Median / 95th percentile from start to finish, over {n} finished runs.", { n: m.duration.runs })} />
        <Metric label={copy("Cost per completed run")} value={usd(m.cost.meanCompletedRunUsd)} definition={copy("Mean committed cost of one completed run.")} />
        <Metric label={copy("Spend per completed run")} value={usd(m.cost.spendPerCompletedRunUsd)} definition={copy("All spend in the window, failed runs included, ÷ completed runs.")} />
        <Metric label={copy("Spend per surviving opportunity")} value={usd(m.cost.spendPerOpportunityUsd)} definition={copy("All spend in the window ÷ opportunities that survived the gate and the review.")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy("Opportunities per completed run")}</CardTitle>
            <CardDescription>{copy("How many completed runs produced each number of opportunities.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {distribution.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No completed runs in this window.")}</p> : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {distribution.map(([n, runs]) => (
                  <div key={n} className="contents">
                    <dt>{copy("Opportunities: {n}", { n })}</dt>
                    <dd className="tabular-nums">{copy("Runs: {runs}", { runs })}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy("Failures by error code")}</CardTitle>
            <CardDescription>{copy("Total committed spend in the window: {usd}. Calls with unknown cost, counted at their reservation: {n}.", { usd: formats.usd(m.cost.totalUsd, 3), n: m.cost.uncertainCalls })}</CardDescription>
          </CardHeader>
          <CardContent>
            {errors.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No failed runs in this window.")}</p> : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                {errors.map(([code, count]) => (
                  <div key={code} className="contents">
                    <dt><Link className="font-mono text-xs text-primary hover:underline" href={`/admin/runs?status=failed&error=${encodeURIComponent(code)}`}>{code}</Link></dt>
                    <dd className="tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
